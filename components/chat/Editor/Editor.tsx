"use client";

import React, { useRef, useEffect } from "react";
import EditableMarkdown from "./EditableMarkdown";
import EditorToolbar from "./EditorToolbar";
import ChatInputSection from "@/components/chat/ChatInputSection";

interface EditorProps {
  content: string;
  setContent: (content: string) => void;
  isEditing: boolean;
  onChange: (newContent: string) => void;
  wordCount: number;
  onAnalyzeSentiment?: (text: string) => void;
  isAnalyzing?: boolean;
  onSubmitToAI?: (text: string) => void;
  isAILoading?: boolean;
  onSaveChat?: () => void;
  hasUnsavedChanges?: boolean;
}

export default function Editor({
  content,
  setContent,
  isEditing,
  onChange,
  wordCount,
  onAnalyzeSentiment,
  isAnalyzing = false,
  onSubmitToAI,
  isAILoading = false,
  onSaveChat,
  hasUnsavedChanges = false,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef<string>(content);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (!isEditing && isAILoading && contentAreaRef.current) {
      // Auto-scroll to bottom when content changes during streaming
      const scrollArea = contentAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [content, isAILoading, isEditing]);

  // Add this useEffect to ensure content is always displayed and scrolled
  useEffect(() => {
    if (
      contentAreaRef.current &&
      (isAILoading || content !== lastContentRef.current)
    ) {
      // Update ref to track content changes
      lastContentRef.current = content;

      // Scroll to bottom during streaming
      const scrollArea = contentAreaRef.current;
      setTimeout(() => {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }, 10); // Small delay to ensure rendering completes
    }
  }, [content, isAILoading]);

  // Handle sending a new message/content
  const handleSendMessage = (message: string) => {
    if (onSubmitToAI) {
      // If AI submission handler is provided, use it
      onSubmitToAI(message);
    } else {
      // Default behavior - append to current content
      if (isEditing) {
        const newContent = content ? `${content}\n\n${message}` : message;
        onChange(newContent);
      } else {
        // Otherwise, replace content
        onChange(message);
      }
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Editor Toolbar */}
      <EditorToolbar
        isEditing={isEditing}
        wordCount={wordCount}
        onSaveChat={onSaveChat}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Document Content - Make it flex-1 to take available space and scrollable */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div ref={contentAreaRef} className="flex-1 overflow-y-auto pb-4">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="w-full h-full overflow-y-auto p-4 focus:outline-none resize-none font-mono text-sm"
              value={content}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <EditableMarkdown
                // Add a key that changes during streaming to force re-rendering
                key={`markdown-${isAILoading ? Date.now() : "idle"}`}
                content={content}
                onChange={onChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chat Input Section - Fixed at the bottom with z-index to ensure it stays on top */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 z-10">
        <ChatInputSection
          onSendMessage={handleSendMessage}
          onAnalyzeSentiment={onAnalyzeSentiment}
          isLoading={isAnalyzing || isAILoading}
          placeholder="Type your prompt or question here..."
          autoFocus
        />
      </div>
    </main>
  );
}
