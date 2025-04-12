import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

export interface ChatHistoryItem {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  last_message?: string;
  [key: string]: any;
}

export interface ChatDetail {
  id: string;
  title: string;
  messages: Array<any>;
  created_at: string;
  updated_at?: string;
  [key: string]: any;
}

export function useChatHistory() {
  // Add refs to track request states and prevent duplicate fetches
  const hasInitiallyFetched = useRef(false);
  const fetchInProgressRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const fetchDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken, isSignedIn } = useAuth();

  // Create an authenticated fetch function
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      try {
        // Only attempt to get token if signed in
        if (!isSignedIn) {
          throw new Error("User not signed in");
        }

        // Get token and add detailed error handling
        let token;
        try {
          // First try without template name
          token = await getToken();

          // If that fails, try with different template names
          if (!token) {
            // Try standard template names one by one
            for (const templateName of [
              "default",
              "api_key",
              "api-key",
              "backend",
            ]) {
              console.log(`Trying to get token with template: ${templateName}`);
              try {
                // PARAMETER ISSUE: Change "template" to "templateName"
                token = await getToken({ templateName });
                if (token) {
                  console.log(
                    `Successfully got token using template: ${templateName}`,
                  );
                  break;
                }
              } catch (templateError) {
                console.log(
                  `Failed with template ${templateName}:`,
                  templateError,
                );
              }
            }
          }

          if (!token) {
            console.warn("All token retrieval attempts failed");
            throw new Error("No authentication token available");
          }

          if (typeof token !== "string") {
            console.warn(
              `getToken() returned a non-string value: ${typeof token}`,
            );
            throw new Error("Invalid token format");
          }

          // Log token info (safely)
          console.log(
            `Token acquired (length: ${token.length}, prefix: ${token.substring(0, 10)}...)`,
          );

          // Check if token has the expected format
          if (!token.includes(".")) {
            console.warn("Token doesn't appear to be a JWT (no dots found)");
          }
        } catch (tokenError) {
          console.error("Error getting token:", tokenError);
          const errorMessage =
            tokenError instanceof Error
              ? tokenError.message
              : String(tokenError);
          throw new Error(
            `Failed to get authentication token: ${errorMessage}`,
          );
        }

        // Add authorization header
        const headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          // Add client ID to help with debugging
          "X-Client-ID": "web-app",
        };

        // Make the request with a timeout
        console.log(`Making authenticated request to ${url}`);

        // Use AbortController for timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
        }, 10000); // 10 second timeout

        try {
          const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
          });

          // Clear timeout since request completed
          clearTimeout(timeout);

          // Log response status
          console.log(
            `Response from ${url}: ${response.status} ${response.statusText}`,
          );

          if (!response.ok) {
            // For 401 errors, run diagnostic
            if (response.status === 401) {
              console.error("Authentication failed - token might be invalid");

              // Try to run auth diagnostic
              try {
                const diagnosticResponse = await fetch("/api/debug/auth", {
                  headers: { Authorization: `Bearer ${token}` },
                });

                if (diagnosticResponse.ok) {
                  const diagnosticData = await diagnosticResponse.json();
                  console.log("Auth diagnostic:", diagnosticData);
                }
              } catch (e) {
                console.error("Failed to run auth diagnostic:", e);
              }
            }

            // Log detailed error info
            try {
              const errorText = await response.text();
              console.error(`Error response body: ${errorText}`);
            } catch (e) {
              console.error("Could not read error response");
            }
          }

          return response;
        } catch (fetchError) {
          // Clear timeout in case of error
          clearTimeout(timeout);

          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            console.error(`Request to ${url} timed out`);
            throw new Error("Request timed out after 10 seconds");
          }

          console.error(`Fetch error for ${url}:`, fetchError);
          throw fetchError;
        }
      } catch (error) {
        console.error("Auth fetch error:", error);
        throw error;
      }
    },
    [getToken, isSignedIn],
  );

  // Throttled fetch function to prevent excessive API calls
  const throttledFetch = useCallback((fn: () => Promise<void>) => {
    // Don't allow new fetch if one is already in progress
    if (fetchInProgressRef.current) {
      console.log("Fetch already in progress, skipping");
      return;
    }

    // Enforce a minimum delay between fetches
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const minFetchInterval = 3000; // 3 seconds minimum between fetches

    // If we've fetched recently, delay this fetch
    if (timeSinceLastFetch < minFetchInterval) {
      const delayTime = minFetchInterval - timeSinceLastFetch;
      console.log(`Throttling fetch request. Will execute in ${delayTime}ms`);

      // Clear any existing timeout
      if (fetchDelayTimeoutRef.current) {
        clearTimeout(fetchDelayTimeoutRef.current);
      }

      // Set a new timeout
      fetchDelayTimeoutRef.current = setTimeout(() => {
        fetchDelayTimeoutRef.current = null;
        fn();
      }, delayTime);
    } else {
      // Execute immediately if enough time has passed
      fn();
    }
  }, []);

  // Modified fetchChatHistory with throttling built in
  const fetchChatHistory = useCallback(async () => {
    // Don't fetch if not signed in
    if (!isSignedIn) {
      console.log("Not fetching chat history - user not signed in");
      setChatHistory([]);
      return;
    }

    try {
      // Set loading state only if this isn't an auto-refresh
      setIsLoading(true);
      setError(null);

      console.log("Fetching chat history...");
      const response = await authFetch("/api/chat-history");

      if (!response.ok) {
        // Save response status for error message
        const status = response.status;
        let errorText;

        try {
          // Clone the response before reading it
          errorText = await response.clone().text();
        } catch (textError) {
          // If we can't read the response text, use a generic message
          errorText = "Unknown error";
          console.error("Failed to read error response:", textError);
        }

        throw new Error(`Failed to fetch chat history: ${status} ${errorText}`);
      }

      // Clone the response before parsing
      const responseClone = response.clone();

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Error parsing chat history response:", parseError);

        // Try to log the raw response for debugging
        try {
          const rawText = await responseClone.text();
          console.error("Raw response:", rawText);
        } catch (e) {
          console.error("Failed to read raw response");
        }

        // Set to empty array on parse error
        data = [];
      }

      // Ensure we always have an array, even if API returns something else
      if (Array.isArray(data)) {
        console.log(`Loaded ${data.length} chats`);
        setChatHistory(data);
      } else {
        console.error("API returned non-array data for chat history:", data);
        setChatHistory([]);
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching chat history:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsLoading(false);
      // Ensure we reset to empty array on error
      setChatHistory([]);
    }
  }, [authFetch, isSignedIn]);

  // Fetch a specific chat by ID with throttling
  const fetchChatDetail = useCallback(
    (chatId: string) => {
      throttledFetch(async () => {
        if (!isSignedIn) {
          console.log("Not fetching chat detail - user not signed in");
          return;
        }

        try {
          setIsLoading(true);
          setError(null);
          setCurrentChat(null); // Clear current chat while loading

          console.log(`Fetching chat detail for ID: ${chatId}`);
          const response = await authFetch(`/api/chat-history/${chatId}`);

          if (!response.ok) {
            if (response.status === 404) {
              console.error(`Chat not found: ${chatId}`);
              setError(`Chat not found: ${chatId}`);
              setIsLoading(false);
              return;
            }

            const errorText = await response.text();
            throw new Error(
              `Failed to fetch chat detail: ${response.status} ${errorText}`,
            );
          }

          const data = await response.json();
          console.log(
            `Retrieved chat: ${data.id} with ${
              data.messages?.length || 0
            } messages`,
          );
          setCurrentChat(data);
        } catch (err) {
          console.error("Error fetching chat detail:", err);
          setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
          setIsLoading(false);
        }
      });
    },
    [authFetch, isSignedIn, throttledFetch],
  );

  // Delete a chat
  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!isSignedIn) {
        console.log("Not deleting chat - user not signed in");
        return false;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await authFetch(`/api/chat-history/${chatId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to delete chat: ${response.status} ${errorText}`,
          );
        }

        // Remove from list if successful
        setChatHistory((prev) => prev.filter((chat) => chat.id !== chatId));

        // Clear current chat if it was deleted
        if (currentChat && currentChat.id === chatId) {
          setCurrentChat(null);
        }

        setIsLoading(false);
        return true;
      } catch (err) {
        console.error("Error deleting chat:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsLoading(false);
        return false;
      }
    },
    [authFetch, currentChat, isSignedIn],
  );

  // Add a test function to diagnose auth issues
  const testAuthentication = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isSignedIn) {
        setError("Not signed in");
        return { success: false, error: "Not signed in" };
      }

      // Step 1: Try to get the token
      let token;
      try {
        // First try without template
        token = await getToken();

        // If that fails, try with different template names
        if (!token) {
          console.log("No token from default getToken(), trying templates...");

          // Try standard template names one by one
          for (const templateName of [
            "default",
            "api_key",
            "api-key",
            "backend",
          ]) {
            console.log(`Trying template: ${templateName}`);
            try {
              token = await getToken({ template: templateName });
              if (token) {
                console.log(`Success with template: ${templateName}`);
                break;
              }
            } catch (e) {
              console.log(`Failed with template ${templateName}:`, e);
            }
          }
        }

        if (!token) {
          throw new Error("No token returned from any getToken() attempt");
        }
      } catch (tokenError) {
        const errorMessage =
          tokenError instanceof Error ? tokenError.message : String(tokenError);
        setError(`Token error: ${errorMessage}`);
        return {
          success: false,
          error: `Token error: ${errorMessage}`,
        };
      }

      // Step 2: Test the debug endpoint
      try {
        const response = await fetch("/api/debug/auth", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        const isAuthenticated = data.has_user_state && data.clerk_id;

        if (!isAuthenticated) {
          setError(`Auth test failed: ${JSON.stringify(data)}`);
          return {
            success: false,
            result: data,
            authenticated: false,
          };
        }

        return {
          success: true,
          result: data,
          authenticated: true,
        };
      } catch (fetchError) {
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        setError(`Auth test fetch error: ${errorMessage}`);
        return {
          success: false,
          error: `Fetch error: ${errorMessage}`,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(`Test error: ${errorMessage}`);
      return {
        success: false,
        error: `Test error: ${errorMessage}`,
      };
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isSignedIn]);

  // Only fetch once when auth state changes or component mounts
  useEffect(() => {
    if (
      isSignedIn &&
      !hasInitiallyFetched.current &&
      !fetchInProgressRef.current
    ) {
      console.log("Initial chat history load");
      fetchChatHistory();
    } else if (!isSignedIn) {
      // Reset state when user signs out
      hasInitiallyFetched.current = false;
      setChatHistory([]);
      setCurrentChat(null);
    }
  }, [isSignedIn, fetchChatHistory]);

  // Clear any pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (fetchDelayTimeoutRef.current) {
        clearTimeout(fetchDelayTimeoutRef.current);
      }
    };
  }, []);

  return {
    chatHistory,
    currentChat,
    isLoading,
    error,
    fetchChatHistory,
    fetchChatDetail,
    deleteChat,
    testAuthentication, // Add this
  };
}
