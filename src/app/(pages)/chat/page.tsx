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
import { AnalysisProgress } from "@/components/ui/analysis-progress";

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
    progress,
    cancelAnalysis,
  } = useSentimentAnalysis();

  const {
    messages,
    input,
    handleSubmit: handleChatSubmit,
    handleInputChange,
    isLoading: isChatLoading,
    error: chatError,
    append,
  } = useChat({
    api: `/api/chat?protocol=text&user_id=${user?.id}`,
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

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

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
    append({
      role: "user",
      content: text,
    });
  };

  const analyzeSentiments = (optionalContent?: string) => {
    const contentToAnalyze =
      optionalContent && optionalContent !== "current-document"
        ? optionalContent
        : markdownContent;

    handleAnalyzeSentiments(contentToAnalyze);
  };

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
