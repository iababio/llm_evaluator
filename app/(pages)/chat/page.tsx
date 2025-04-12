"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { CreateMessage, Message, useChat, useCompletion } from "ai/react";
import { debounce } from "@/utils/helpers";

// Components
import Header from "@/components/chat/Header/Header";
import LeftSidebar from "@/components/chat/LeftSidebar/LeftSidebar";
import Editor from "@/components/chat/Editor/Editor";
import RightSidebar from "@/components/chat/RightSidebar/RightSidebar";
import { AnalysisProgress } from "@/components/ui/analysis-progress";

// Hooks
import useMarkdown from "@/hooks/useMarkdown";
import useSentimentAnalysis from "@/hooks/useSentimentAnalysis";
import { useChatHistory } from "@/hooks/useChatHistory";
import useChatSession from "@/hooks/useChatSession";
import { Button } from "@/components/ui/button";
import router from "next/router";

/**
 * Create a fetch function that includes authentication headers
 */
function createAuthFetch(getToken: () => Promise<string | null>) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const token = await getToken();

      if (!token) {
        console.warn("No auth token available for request to:", input);
        throw new Error("No authentication token available");
      }

      // Add the authorization header to the request
      const authInit = {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${token}`,
        },
      };

      // For debugging
      if (typeof input === "string" && input.includes("/api/")) {
        console.log("Making authenticated request to:", input);
      }

      const response = await fetch(input, authInit);

      // Log failures for debugging
      if (
        !response.ok &&
        typeof input === "string" &&
        input.includes("/api/")
      ) {
        console.error(
          `Request failed: ${response.status} ${response.statusText}`,
          input,
        );
        try {
          // Try to parse error response
          const errorText = await response.text();
          console.error("Error response:", errorText);
        } catch (e) {
          // Ignore parse errors
        }
      }

      return response;
    } catch (error) {
      console.error("Auth fetch error:", error);
      // Instead of falling back to unauthenticated request, throw the error
      throw error;
    }
  };
}

export default function ChatPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  // Define all state variables at the beginning
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tokenAvailable, setTokenAvailable] = useState(false);
  const tokenInitializedRef = useRef(false);

  // Chat history hooks
  const { fetchChatDetail, currentChat, fetchChatHistory } = useChatHistory();

  // Add the chat session hook
  const {
    sessionId,
    pendingSave,
    startNewSession,
    trackMessageAdded,
    shouldSaveSession,
    markSessionSaving,
    markSessionSaved,
    markSaveFailed,
    loadSession,
  } = useChatSession();

  // Create an authenticated fetch function
  const authFetch = React.useMemo(() => createAuthFetch(getToken), [getToken]);

  // Custom hooks
  const {
    markdownContent,
    setMarkdownContent,
    isEditing,
    setIsEditing,
    wordCount,
    setWordCount,
    handleContentChange,
  } = useMarkdown();

  const {
    sentimentResults,
    isAnalyzing,
    handleAnalyzeSentiments,
    showSentimentPanel,
    setShowSentimentPanel,
    progress,
    cancelAnalysis,
  } = useSentimentAnalysis();

  const {
    completion,
    complete,
    isLoading: isCompletionLoading,
    error: completionError,
    stop: stopCompletion,
    setCompletion,
  } = useCompletion({
    api: "/api/completion",
    fetch: authFetch, // Use our custom fetch function
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    onResponse: (response) => {
      console.log("AI response started:", response);
      setMarkdownContent((prev) => (prev.trim() ? prev + "\n\nAI: " : "AI: "));
    },
    onFinish: (completion) => {
      console.log("AI completion finished:", completion);
      setMarkdownContent(completion);

      append({
        role: "assistant",
        content: completion,
      });

      updateWordCount(completion);
    },
    onError: (error) => {
      console.error("AI completion error:", error);
      setMarkdownContent(
        (prev) =>
          prev +
          "\n\nError connecting to AI service. Please check your backend server.",
      );
    },
  });

  const {
    messages,
    input,
    handleSubmit: handleChatSubmit,
    handleInputChange,
    isLoading: isChatLoading,
    error: chatError,
    append,
    setMessages,
    reload,
    stop: stopChat,
  } = useChat({
    api: "/api/chat?protocol=text",
    fetch: authFetch, // Use our custom fetch function
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    streamProtocol: "text",
    initialMessages: [
      {
        id: "initial",
        role: "assistant",
        content:
          "Welcome to your AI-powered platform, where you can chat, analyze, and gain insights from your documents using this intelligent assistant. Simply type your message below to get started! Whether you need help reviewing text, answering questions, or exploring new ideas, our assistant is here to assist you smoothly and efficiently.",
      },
    ],
    onError: (error) => {
      console.error("Chat error:", error);
      setMarkdownContent(
        (prev) =>
          prev +
          "\n\nError connecting to chat service. Please check your backend server.",
      );
    },
  });

  // Effect for authentication
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  // Effect to load chat when a chat is selected
  useEffect(() => {
    if (selectedChatId) {
      setLoadError(null); // Clear previous errors
      Promise.resolve(fetchChatDetail(selectedChatId)).catch((err) => {
        console.error("Error fetching chat:", err);
        setLoadError(`Failed to load chat: ${err.message}`);
        // Reset selected chat on error
        setSelectedChatId(null);
      });
    }
  }, [selectedChatId, fetchChatDetail]);

  // Effect to update the chat interface when a chat is loaded
  useEffect(() => {
    if (currentChat) {
      // Stop any ongoing chat or completion
      stopChat();
      stopCompletion();

      try {
        // Load the messages from the chat history
        const historyMessages = currentChat.messages.map((msg) => {
          // Ensure role is one of the valid types
          const originalRole = msg.role as string;
          const validRole = ["user", "assistant", "system", "data"].includes(
            originalRole,
          )
            ? (originalRole as "user" | "assistant" | "system" | "data")
            : "user"; // Default to user if invalid role

          return {
            id: msg.id || Math.random().toString(36).substring(2, 9),
            role: validRole,
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
          };
        });

        // Update session tracking
        loadSession(currentChat.id, historyMessages.length);

        // Reset unsaved changes flag
        setHasUnsavedChanges(false);

        setMessages(historyMessages);

        // Set the editor content to the last assistant message
        const lastAssistantMessage = [...historyMessages]
          .filter((m) => m.role === "assistant")
          .pop();

        if (lastAssistantMessage) {
          setMarkdownContent(lastAssistantMessage.content);
          updateWordCount(lastAssistantMessage.content);
        }
      } catch (error) {
        console.error("Error processing chat history:", error);
      }
    }
  }, [currentChat, stopChat, stopCompletion, setMessages, loadSession]);

  const updateWordCount = (text: string) => {
    const words = text ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastAssistantMessage = [...messages]
        .filter((m) => m.role === "assistant")
        .pop();

      if (lastAssistantMessage) {
        setMarkdownContent(lastAssistantMessage.content);
        updateWordCount(lastAssistantMessage.content);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (completion) {
      setMarkdownContent(completion);
      updateWordCount(completion);
    }
  }, [completion]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setShowLeftSidebar(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleSubmitToAI = (text: string) => {
    if (!text || !text.trim()) {
      console.warn("Attempted to submit empty text");
      return;
    }

    // If we're starting a new conversation (no selected chat and no user messages yet)
    if (!selectedChatId && !messages.some((m) => m.role === "user")) {
      startNewSession();
    }

    // Clear selected chat when starting a new conversation from an existing one
    if (selectedChatId && messages.length > 0) {
      setSelectedChatId(null);
      startNewSession();
    }

    // Log auth status for debugging
    console.log("Submitting with auth token:", authToken ? "yes" : "no");
    console.log("Session ID:", sessionId);
    console.log(
      "Submitting text:",
      text.substring(0, 50) + (text.length > 50 ? "..." : ""),
    );

    // Mark changes as unsaved
    setHasUnsavedChanges(true);

    // Append the user message
    append({
      role: "user",
      content: text,
    });

    // Use the AI completion service
    complete(text);
  };

  const handleNewChat = () => {
    // Start a new chat session
    startNewSession();

    // Clear the current chat
    setSelectedChatId(null);

    // Reset the completion
    setCompletion("");

    // Reset messages to initial state
    setMessages([
      {
        id: "initial",
        role: "assistant",
        content:
          "Welcome to your AI-powered platform, where you can chat, analyze, and gain insights from your documents using this intelligent assistant. Simply type your message below to get started! Whether you need help reviewing text, answering questions, or exploring new ideas, our assistant is here to assist you smoothly and efficiently.",
      },
    ]);

    // Reset markdown content
    setMarkdownContent(
      "Welcome to your AI-powered platform, where you can chat, analyze, and gain insights from your documents using this intelligent assistant. Simply type your message below to get started! Whether you need help reviewing text, answering questions, or exploring new ideas, our assistant is here to assist you smoothly and efficiently.",
    );

    // Update word count
    updateWordCount(
      "Welcome to your AI-powered platform, where you can chat, analyze, and gain insights from your documents using this intelligent assistant. Simply type your message below to get started! Whether you need help reviewing text, answering questions, or exploring new ideas, our assistant is here to assist you smoothly and efficiently.",
    );

    // Reset unsaved changes flag
    setHasUnsavedChanges(false);
  };

  const analyzeSentiments = (optionalContent?: string) => {
    const contentToAnalyze =
      optionalContent && optionalContent !== "current-document"
        ? optionalContent
        : markdownContent;

    handleAnalyzeSentiments(contentToAnalyze);
  };

  // Add this custom save function

  const handleSaveChat = async () => {
    if (!authToken || !messages.length) {
      console.warn("Cannot save chat - no auth token or empty messages");
      return;
    }

    console.log("Manually saving chat...");

    // Set saving state
    markSessionSaving();

    try {
      // Try to find the chat-history/save endpoint first
      let saveUrl = "/api/chat-history/save";

      // Check if the save endpoint exists first
      const checkResponse = await fetch(saveUrl, {
        method: "OPTIONS",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // If OPTIONS fails, try the fallback endpoint
      if (checkResponse.status === 404) {
        console.log("Save endpoint not found, trying fallback endpoint");
        saveUrl = "/api/chat/save"; // Fallback endpoint
      }

      // Make the actual save request
      const response = await fetch(saveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: messages,
          title: currentChat?.title || _extractTitleFromMessages(messages),
          session_id: sessionId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Chat saved with ID:", data.id);

        // Update session saved state
        markSessionSaved(messages.length);
        setHasUnsavedChanges(false);

        // If we don't have a selected chat yet, set it
        if (!selectedChatId) {
          setSelectedChatId(data.id);
        }

        // Refresh chat history after saving, but only for new chats
        if (!currentChat) {
          // Use setTimeout to avoid immediate re-fetch
          setTimeout(() => {
            fetchChatHistory();
          }, 1000);
        }
      } else {
        // Attempt to read error message
        let errorMessage = "Unknown error";
        try {
          const errorData = await response.text();
          errorMessage = errorData;
        } catch (e) {
          console.error("Could not read error response", e);
        }

        console.error(
          `Failed to save chat (${response.status}): ${errorMessage}`,
        );
        markSaveFailed();
      }
    } catch (error) {
      console.error("Error saving chat:", error);
      markSaveFailed();
    }
  };

  // Helper function to extract title
  const _extractTitleFromMessages = (messages: any[]) => {
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length > 0) {
      const content = userMessages[0].content;
      if (typeof content === "string" && content.trim()) {
        return content.slice(0, 30) + (content.length > 30 ? "..." : "");
      }
    }
    return `Chat ${new Date().toLocaleString()}`;
  };

  // Update append function to mark changes as unsaved
  const handleAppendMessage = (message: Message | CreateMessage) => {
    append(message);
    setHasUnsavedChanges(true);
  };

  // Create a debounced save function that persists between renders
  const debouncedAutoSave = React.useCallback(
    debounce(
      async (
        authToken: string,
        messages: Message[],
        handleSaveChat: () => Promise<void>,
      ) => {
        if (!authToken || messages.length < 2) return;
        console.log("Executing debounced auto-save");
        await handleSaveChat();
      },
      3000,
    ),
    [], // Empty deps array means this function is created only once
  );

  // Replace your auto-save effect
  useEffect(() => {
    // Track message changes
    if (messages.length > 0) {
      trackMessageAdded(messages);
    }

    // Only auto-save if we have unsaved changes and we're not currently saving
    if (hasUnsavedChanges && !pendingSave && authToken) {
      console.log("Scheduling auto-save");
      debouncedAutoSave(authToken, messages, handleSaveChat);
    }
  }, [hasUnsavedChanges, pendingSave, messages, authToken, debouncedAutoSave]);

  // Replace the token effect with this improved version
  useEffect(() => {
    // Only run token initialization once
    const initializeAuth = async () => {
      if (tokenInitializedRef.current) return;

      try {
        if (isSignedIn) {
          console.log("Initializing authentication token");
          const token = await getToken();
          if (token) {
            setAuthToken(token);
            setTokenAvailable(true);
            console.log("Auth token initialized successfully");
          } else {
            console.warn("Failed to get auth token");
            setTokenAvailable(false);
          }
        } else {
          setAuthToken(null);
          setTokenAvailable(false);
        }
      } catch (error) {
        console.error("Error initializing auth token:", error);
        setTokenAvailable(false);
      } finally {
        tokenInitializedRef.current = true;
      }
    };

    // Only run if auth is loaded and we haven't initialized yet
    if (isLoaded && !tokenInitializedRef.current) {
      initializeAuth();
    }

    // Clear token when user signs out
    if (isLoaded && !isSignedIn && authToken) {
      console.log("User signed out, clearing auth token");
      setAuthToken(null);
      setTokenAvailable(false);
    }
  }, [isLoaded, isSignedIn, getToken]);

  // Effect for token initialization
  useEffect(() => {
    // Only run token initialization once
    const initializeAuth = async () => {
      if (tokenInitializedRef.current) return;

      try {
        if (isLoaded && isSignedIn && getToken) {
          console.log("Initializing authentication token");

          try {
            // First try standard getToken
            const token = await getToken();

            if (token) {
              console.log("Successfully obtained auth token");
              setAuthToken(token);
              setTokenAvailable(true);
            } else {
              console.warn("getToken returned null/undefined");
              setTokenAvailable(false);
            }
          } catch (tokenError) {
            console.error("Error getting auth token:", tokenError);
            setTokenAvailable(false);
          }
        } else {
          if (!isLoaded) console.log("Auth not yet loaded");
          if (!isSignedIn) console.log("User not signed in");
          setAuthToken(null);
          setTokenAvailable(false);
        }
      } catch (error) {
        console.error("Error in auth initialization:", error);
        setTokenAvailable(false);
      } finally {
        tokenInitializedRef.current = true;
      }
    };

    // Run initialization when auth is loaded
    if (isLoaded && !tokenInitializedRef.current) {
      initializeAuth();
    }

    // Reset token when user signs out
    if (isLoaded && !isSignedIn && tokenAvailable) {
      console.log("User signed out, clearing auth token");
      setAuthToken(null);
      setTokenAvailable(false);
    }
  }, [isLoaded, isSignedIn, getToken, tokenAvailable]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Authentication debug info - remove this in production */}
      {process.env.NODE_ENV !== "production" && (
        <div className="bg-yellow-50 border-yellow-200 border-b p-1 text-xs text-yellow-800">
          Auth: {isSignedIn ? "✅" : "❌"} | Token:{" "}
          {tokenAvailable ? "✅" : "❌"} | User:{" "}
          {user?.id ? user.id.substring(0, 8) + "..." : "None"} |
          {authToken ? (
            <span className="text-green-700">Token Present</span>
          ) : (
            <span className="text-red-700">No Token</span>
          )}{" "}
          |
          <button
            className="bg-blue-100 hover:bg-blue-200 px-1 py-0.5 rounded ml-1 text-blue-800"
            onClick={async () => {
              try {
                const token = await getToken();
                alert(
                  `Token retrieved: ${token ? "Yes" : "No"}\nLength: ${token?.length || 0}`,
                );
              } catch (e: any) {
                alert(`Error getting token: ${e.message}`);
              }
            }}
          >
            Test Token
          </button>
        </div>
      )}

      {/* Header */}
      <Header
        showLeftSidebar={showLeftSidebar}
        setShowLeftSidebar={setShowLeftSidebar}
        showRightSidebar={showRightSidebar}
        setShowRightSidebar={setShowRightSidebar}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        currentChatTitle={currentChat?.title}
      />

      {/* Error message */}
      {loadError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 mx-4 mt-2">
          <p>{loadError}</p>
          <button
            className="text-sm underline mt-1"
            onClick={() => setLoadError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar
          isVisible={showLeftSidebar}
          onSelectChat={setSelectedChatId}
          selectedChat={selectedChatId}
          onNewChat={handleNewChat}
          user={user}
        />

        {/* Document Editor */}
        <Editor
          content={markdownContent}
          setContent={setMarkdownContent}
          isEditing={isEditing}
          onChange={handleContentChange}
          wordCount={wordCount}
          onAnalyzeSentiment={handleAnalyzeSentiments}
          isAnalyzing={isAnalyzing}
          onSubmitToAI={handleSubmitToAI}
          isAILoading={isCompletionLoading || isChatLoading}
          onSaveChat={handleSaveChat}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* Right Sidebar */}
        <RightSidebar
          isVisible={showRightSidebar}
          showSentimentPanel={showSentimentPanel}
          setShowSentimentPanel={setShowSentimentPanel}
          sentimentResults={sentimentResults}
          isAnalyzing={isAnalyzing}
          handleAnalyzeSentiments={analyzeSentiments}
        />
      </div>

      {/* Loading Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          {progress ? (
            <AnalysisProgress
              percentage={progress.percentage}
              estimatedTimeRemaining={progress.estimatedTimeRemaining}
              status={progress.status}
              onCancel={cancelAnalysis}
            />
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-4">
              <div className="animate-spin h-5 w-5 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <p>Initializing analysis...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
