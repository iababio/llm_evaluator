"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { useChat, useCompletion } from "ai/react";
import { motion, AnimatePresence } from "framer-motion";

import Header from "@/components/chat/Header/Header";
import LeftSidebar from "@/components/chat/LeftSidebar/LeftSidebar";
import Editor from "@/components/chat/Editor/Editor";
import RightSidebar from "@/components/chat/RightSidebar/RightSidebar";
import { Spinner } from "@/components/ui/spinner";

import useMarkdown from "@/hooks/useMarkdown";
import useSentimentAnalysis from "@/hooks/useSentimentAnalysis";
import { useChatHistory } from "@/hooks/useChatHistory";
import useChatSession from "@/hooks/useChatSession";
import { createAuthFetch } from "@/lib/auth";
import type { Message, CreateMessage } from "ai";

// This interface is properly typed for use with motion components
interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  initial?: { opacity: number };
  animate?: { opacity: number };
  transition?: { duration: number };
  children?: React.ReactNode;
}

export default function ChatPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  // Define all state variables at the beginning
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tokenAvailable, setTokenAvailable] = useState(false);
  const tokenInitializedRef = useRef(false);
  const [trackedMessageIds, setTrackedMessageIds] = useState<Set<string>>(
    new Set(),
  );
  const [streamInProgress, setStreamInProgress] = useState(false);

  // Chat history hooks
  const { fetchChatDetail, currentChat } = useChatHistory();

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

  // Update the completion hook to properly update the editor content during streaming
  // Update the completion hook to properly update the editor content during streaming
  const {
    completion,
    complete,
    isLoading: isCompletionLoading,
    error: completionError,
    stop: stopCompletion,
    setCompletion,
  } = useCompletion({
    api: "/api/completion",
    fetch: authFetch,
    onStream(streamingCompletion: React.SetStateAction<string>) {
      console.log("Stream updating in real-time");

      // Add detailed logging
      const before = markdownContent;
      setMarkdownContent(streamingCompletion);

      // Log to see what's happening with content updates
      const textString =
        typeof streamingCompletion === "function"
          ? streamingCompletion(markdownContent)
          : streamingCompletion;

      console.log("Stream content updated:", {
        contentLength: textString.length,
        contentPreview: textString.substring(textString.length - 30),
      });

      updateWordCount(textString);
    },
    onResponse(response) {
      console.log("AI response started");
    },
    onFinish(completion) {
      console.log("AI completion finished");

      // Only update if content changed - prevent infinite loops
      if (completion !== markdownContent) {
        // Use setTimeout to break recursive update cycles
        setTimeout(() => {
          setMarkdownContent(completion);
          updateWordCount(completion);

          // Allow streaming again after a delay
          setTimeout(() => {
            setStreamInProgress(false);
            console.log("Stream completed: allowing new requests");
          }, 100);
        }, 0);
      } else {
        setStreamInProgress(false);
      }
    },
    onError(error) {
      console.error("AI error:", error);
      setStreamInProgress(false); // Reset on error too
    },
  });
  // Also update the chat hook to handle streaming properly
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
    fetch: authFetch,
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
    // Add this crucial handler to see streaming messages
    onMessage: (message: {
      role: string;
      content: React.SetStateAction<string>;
    }) => {
      console.log("Message streaming update");
      if (message.role === "assistant") {
        // Important: Always set the content without any conditions
        setMarkdownContent(message.content);
        // Extract string value before passing to updateWordCount
        const textContent =
          typeof message.content === "function"
            ? message.content(markdownContent)
            : message.content;
        updateWordCount(textContent);
      }
    },
    onResponse: (response) => {
      console.log("Stream message starting");
    },
    onError: (error) => {
      console.error("Chat error:", error);
      setMarkdownContent(
        (prev) =>
          prev +
          "\n\nError connecting to chat service. Please check your backend server.",
      );
      setStreamInProgress(false);
    },
    onFinish: (message) => {
      console.log("Chat completed");
      // Update the editor content when the message is complete
      if (message.role === "assistant" && typeof message.content === "string") {
        setMarkdownContent(message.content);
        updateWordCount(message.content);
      }
      setStreamInProgress(false);
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

  // ADD A SINGLE CONSOLIDATED EFFECT (replacing the useEffect at lines ~244-260)
  useEffect(() => {
    // Skip updates during active streaming
    if (isCompletionLoading || isChatLoading) return;

    const lastContent = completion || markdownContent;

    // Handle messages updates
    if (messages.length > 0) {
      const lastAssistantMessage = [...messages]
        .filter((m) => m.role === "assistant")
        .pop();

      if (lastAssistantMessage && lastAssistantMessage.content) {
        // Only update if content actually changed to prevent infinite loops
        if (lastAssistantMessage.content !== markdownContent) {
          console.log("Updating editor from consolidated effect");
          setMarkdownContent(lastAssistantMessage.content);
          updateWordCount(lastAssistantMessage.content);
        }
      }
    }
  }, [
    messages,
    isChatLoading,
    isCompletionLoading,
    streamInProgress,
    completion,
  ]);

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
    if (!text || !text.trim() || streamInProgress) {
      console.warn("Skipping submission: empty text or stream in progress");
      return;
    }

    setStreamInProgress(true);
    console.log("Stream started: preventing duplicate requests");

    // Generate a unique request ID
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    // If we're starting a new conversation (no selected chat and no user messages yet)
    if (!selectedChatId && !messages.some((m) => m.role === "user")) {
      startNewSession();

      // Replace the initial welcome message
      const userMessage: Message = {
        role: "user",
        content: text,
        id: Math.random().toString(36).substring(2, 9),
      };

      // Set messages first to update UI
      setMessages([userMessage]);

      // Include the request_id in your API requests
      complete(text, {
        body: {
          request_id: requestId,
        },
      });
    } else {
      // For existing conversations, include the request_id
      append(
        {
          role: "user",
          content: text,
        },
        {
          body: {
            request_id: requestId,
          },
        },
      );
    }

    // Clear selected chat when starting a new conversation
    if (selectedChatId) {
      setSelectedChatId(null);
      startNewSession();
    }

    console.log(`Request submitted with ID: ${requestId}`);
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
  };

  const analyzeSentiments = (optionalContent?: string) => {
    const contentToAnalyze =
      optionalContent && optionalContent !== "current-document"
        ? optionalContent
        : markdownContent;

    handleAnalyzeSentiments(contentToAnalyze);
  };

  // Remove the custom save function

  // Instead of the handleSaveChat function, replace it with a stub that logs the request

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
  };

  // Replace your auto-save effect
  useEffect(() => {
    // Track message changes, but filter out the initial welcome message
    if (messages.length > 0) {
      // Filter out the initial welcome message by ID and already tracked messages
      const newMessages = messages.filter((msg) => {
        // Skip initial welcome message
        if (msg.id === "initial") return false;

        // Skip already tracked messages
        return !trackedMessageIds.has(msg.id);
      });

      // Only track if we have new messages to track
      if (newMessages.length > 0) {
        // Create a new set of IDs to track
        const newIds = new Set(newMessages.map((msg) => msg.id));

        // Batch update the tracked IDs
        setTrackedMessageIds((prev) => {
          const combined = new Set([...prev]);
          newMessages.forEach((msg) => combined.add(msg.id));
          return combined;
        });

        // Now track the messages
        trackMessageAdded(newMessages);
      }
    }
  }, [messages, trackMessageAdded]); // Remove trackedMessageIds from dependencies

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

  // Define animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Spinner size="sm" className="bg-black dark:bg-white" />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col h-screen bg-white"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Header with animations */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Header
          showLeftSidebar={showLeftSidebar}
          setShowLeftSidebar={setShowLeftSidebar}
          showRightSidebar={showRightSidebar}
          setShowRightSidebar={setShowRightSidebar}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          currentChatTitle={currentChat?.title}
        />
      </motion.div>

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
        <motion.div
          className="flex-1"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
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
            hasUnsavedChanges={false} // Always pass false since we're not tracking changes
          />
        </motion.div>

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
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center"
            >
              <div className="mb-4">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              </div>
              <p className="text-lg font-medium">Analyzing content...</p>
              <p className="text-sm text-gray-500 mt-1">
                This may take a moment
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                onClick={cancelAnalysis}
              >
                Cancel
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {loadError && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-800 px-4 py-3 rounded-lg shadow-lg"
          >
            {loadError}
            <button
              onClick={() => setLoadError(null)}
              className="ml-3 text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
