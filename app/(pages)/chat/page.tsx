"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useChat, useCompletion } from "ai/react";

// Components
import Header from "@/components/chat/Header/Header";
import LeftSidebar from "@/components/chat/LeftSidebar/LeftSidebar";
import Editor from "@/components/chat/Editor/Editor";
import RightSidebar from "@/components/chat/RightSidebar/RightSidebar";

// Hooks
import useMarkdown from "@/hooks/useMarkdown";
import useSentimentAnalysis from "@/hooks/useSentimentAnalysis";

export default function ChatPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  } = useSentimentAnalysis();

  // Add useCompletion hook for document editing
  const {
    completion,
    complete,
    isLoading: isCompletionLoading,
    error: completionError,
  } = useCompletion({
    api: "/api/completion",
    onResponse: (response) => {
      console.log("AI response started:", response);
      // Keep existing content when a new stream starts
      setMarkdownContent((prev) => (prev.trim() ? prev + "\n\nAI: " : "AI: "));
    },
    onFinish: (completion) => {
      console.log("AI completion finished:", completion);
      // Set the markdown content directly
      setMarkdownContent(completion);

      // Also append to messages for consistency with the chat approach
      append({
        role: "assistant",
        content: completion,
      });

      // Calculate word count
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

  // Update useChat configuration
  const {
    messages,
    input,
    handleSubmit: handleChatSubmit,
    handleInputChange,
    isLoading: isChatLoading,
    error: chatError,
    append,
  } = useChat({
    api: "/api/chat?protocol=text",
    streamProtocol: "text",
    initialMessages: [
      {
        id: "initial",
        role: "assistant",
        content:
          "Welcome to your AI-powered platform, where you can chat, analyze, and gain insights from your documents using this intelligent assistant. Simply type your message below to get started! Whether you need help reviewing text, answering questions, or exploring new ideas, our assistant is here to assist you smoothly and efficiently.",
      },
    ],
    onFinish: (message) => {
      // When chat completes, update the markdown content
      setMarkdownContent(message.content);
      updateWordCount(message.content);
    },
    onError: (error) => {
      console.error("Chat error:", error);
      setMarkdownContent(
        (prev) =>
          prev +
          "\n\nError connecting to chat service. Please check your backend server.",
      );
    },
  });

  // Redirect if not authenticated - AFTER declaring all hooks
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  // Update word count function
  const updateWordCount = (text: string) => {
    const words = text ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
  };

  // Initialize content from messages
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

  // Custom hook for real-time streaming update to the editor
  useEffect(() => {
    if (completion) {
      setMarkdownContent(completion);
      updateWordCount(completion);
    }
  }, [completion]);

  // Add resize effect
  useEffect(() => {
    const handleResize = () => {
      // If we're on mobile (< 768px) and sidebar was showing, hide it
      if (window.innerWidth < 768) {
        setShowLeftSidebar(false);
      }
    };

    // Listen for window resize
    window.addEventListener("resize", handleResize);

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Handle submitting text to AI for processing
  const handleSubmitToAI = (text: string) => {
    // Add user message to chat
    append({
      role: "user",
      content: text,
    });

    // Use completion API for more complex editing tasks
    complete(text);
  };

  // Enhance the analyze sentiments function to always use current content if none provided
  const analyzeSentiments = (optionalContent?: string) => {
    // If content is not provided or is special marker, use current markdown content
    const contentToAnalyze =
      optionalContent && optionalContent !== "current-document"
        ? optionalContent
        : markdownContent;

    handleAnalyzeSentiments(contentToAnalyze);
  };

  // Handle loading state
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <Header
        showLeftSidebar={showLeftSidebar}
        setShowLeftSidebar={setShowLeftSidebar}
        showRightSidebar={showRightSidebar}
        setShowRightSidebar={setShowRightSidebar}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar
          isVisible={showLeftSidebar}
          onSelectDocument={setSelectedDocument}
          selectedDocument={selectedDocument}
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
          <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-4">
            <div className="animate-spin h-5 w-5 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <p>Analyzing sentiment...</p>
          </div>
        </div>
      )}
    </div>
  );
}
