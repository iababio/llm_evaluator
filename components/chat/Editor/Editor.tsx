"use client";

import React, { useRef } from "react";
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
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Editor Toolbar */}
      <EditorToolbar isEditing={isEditing} wordCount={wordCount} />

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="w-full h-full overflow-y-auto p-4 focus:outline-none resize-none font-mono text-sm"
            value={content}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <EditableMarkdown content={content} onChange={onChange} />
        )}
      </div>

      {/* Chat Input Section */}
      <ChatInputSection
        onSendMessage={handleSendMessage}
        onAnalyzeSentiment={onAnalyzeSentiment}
        isLoading={isAnalyzing || isAILoading}
        placeholder="Type your prompt or question here..."
        autoFocus
      />
    </main>
  );
}
