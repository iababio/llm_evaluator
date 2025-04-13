import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs/server";

export interface ChatHistoryItem {
  id: string;
  title: string;
  clerk_id: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  messages: Array<{
    id?: string;
    role: string;
    content: string;
  }>;
}

export interface ChatDetail extends ChatHistoryItem {
  metadata?: Record<string, any>;
}

export function useChatHistory() {
  const hasInitiallyFetched = useRef(false);
  const fetchInProgressRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const fetchDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken, isSignedIn, userId } = useAuth();

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
                // Use "template" as the property name
                token = await getToken({ template: templateName });
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

  // Update the fetchChatHistory function with better error handling

  const fetchChatHistory = useCallback(async () => {
    // Don't fetch if not signed in
    if (!isSignedIn) {
      console.log("Not fetching chat history - user not signed in");
      return [];
    }

    try {
      setIsLoading(true);
      setError(null);
      fetchInProgressRef.current = true;
      lastFetchTimeRef.current = Date.now();

      console.log("Fetching chat history");

      // Get a fresh token for this request
      let token;
      try {
        // Try multiple template options to ensure we get a token
        const tokenOptions = [
          undefined, // Default
          { template: "default" },
          { template: "jwt" },
          { template: "backend" },
        ];

        for (const option of tokenOptions) {
          try {
            token = await getToken(option);
            if (token) {
              console.log(
                `Got token with option: ${JSON.stringify(option) || "default"}`,
              );
              break;
            }
          } catch (e) {
            console.warn(
              `Token attempt failed with option ${JSON.stringify(option) || "default"}:`,
              e,
            );
          }
        }

        if (!token) {
          throw new Error("Failed to get token with any method");
        }

        console.log(
          `Got token (length: ${token.length}, starts with: ${token.substring(0, 8)}...)`,
        );

        // Extract clerk_id from token for logging only
        try {
          const tokenParts = token.split(".");
          if (tokenParts.length === 3) {
            const payloadBase64 = tokenParts[1];
            // Add padding if needed
            const padding = payloadBase64.length % 4;
            const paddedPayload = padding
              ? payloadBase64 + "=".repeat(4 - padding)
              : payloadBase64;

            const decodedPayload = JSON.parse(atob(paddedPayload));
            const clerkId = decodedPayload.sub || "";
            console.log(`Extracted clerk_id from token: ${clerkId}`);
          }
        } catch (e) {
          console.warn("Could not extract clerk_id from token:", e);
        }
      } catch (tokenErr) {
        console.error("Failed to get token for chat history:", tokenErr);
        throw new Error("Authentication failed: couldn't get token");
      }

      // Make the request with explicit headers and custom logging
      console.log("Making chat history request with fresh token");
      const requestId = `history-${Date.now()}`;

      // Make the API request
      const response = await fetch(`/api/chat-history`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Client-Info": "useChatHistory/fetch",
          "Cache-Control": "no-cache",
          "X-Request-Id": requestId,
        },
      });

      console.log(`Chat history response status: ${response.status}`);

      if (!response.ok) {
        // Try to read the response as text for error details
        let errorText = "";
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = "Could not read error response";
        }

        console.error(`Chat history error (${response.status}): ${errorText}`);

        if (response.status === 401) {
          setError("Authentication failed. Please sign out and sign in again.");

          // Try to run auth diagnostic
          try {
            const diagnosticResponse = await fetch("/api/auth-debug", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const diagData = await diagnosticResponse.json();
            console.log("Auth diagnostic:", diagData);
          } catch (diagError) {
            console.error("Diagnostic error:", diagError);
          }

          throw new Error(`Authentication failed: ${response.status}`);
        } else {
          throw new Error(`Failed to fetch chat history: ${response.status}`);
        }
      }

      try {
        const data = await response.json();
        console.log(`Retrieved ${data.length} chats`);
        hasInitiallyFetched.current = true;
        setChatHistory(data);
        return data;
      } catch (parseError) {
        console.error("Error parsing chat history response:", parseError);
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Error in fetchChatHistory:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setChatHistory([]);
      throw err;
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [isSignedIn, getToken]);

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

  // Add this function to useChatHistory to help diagnose 401 errors
  const diagnoseChatHistoryFetch = useCallback(async () => {
    try {
      // Step 1: Check if we can get a token
      let token;
      try {
        token = await getToken();
        console.log(
          `Token acquired (length: ${token ? token.length : 0}, prefix: ${token ? token.substring(0, 5) : "null"}...)`,
        );

        if (!token) {
          return { error: "No token available" };
        }
      } catch (tokenError) {
        console.error("Error getting token:", tokenError);
        return { error: `Token error: ${tokenError}` };
      }

      // Step 2: Try the auth debug endpoint
      try {
        const authDebugResponse = await fetch("/api/auth-debug", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const authDebugData = await authDebugResponse.json();
        console.log("Auth debug data:", authDebugData);

        // Step 3: Try the chat history endpoint with explicit diagnostic headers
        const chatHistoryResponse = await fetch("/api/chat-history", {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Debug": "true",
            "X-Client-ID": "diagnostic-tool",
          },
        });

        const status = chatHistoryResponse.status;
        let responseText;

        try {
          responseText = await chatHistoryResponse.text();
          // Try to parse as JSON for prettier logging
          try {
            const json = JSON.parse(responseText);
            console.log(`Chat history response (${status}):`, json);
          } catch (e) {
            console.log(`Chat history response (${status}): ${responseText}`);
          }
        } catch (textError) {
          console.error("Could not read response text:", textError);
          responseText = "Could not read response";
        }

        return {
          token_info: {
            length: token.length,
            prefix: token.substring(0, 10),
          },
          auth_debug: authDebugData,
          chat_history_status: status,
          chat_history_response: responseText,
        };
      } catch (error) {
        console.error("Diagnostic fetch error:", error);
        return { error: String(error) };
      }
    } catch (overallError) {
      console.error("Overall diagnostic error:", overallError);
      return { error: String(overallError) };
    }
  }, [getToken]);

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
    testAuthentication,
    diagnoseChatHistoryFetch, // Add this
  };
}
