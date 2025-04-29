"use client";

import React, { useRef } from "react";
import EditableMarkdown from "@/components/markdown/editable-markdown";
import SentimentView from "./SentimentView";

interface SentimentResult {
  segments: Array<{
    text: string;
    sentiment: string[];
  }>;
}

interface DocumentContentProps {
  isEditing: boolean;
  markdownContent: string;
  setMarkdownContent: (content: string) => void;
  updateWordCount: (text: string) => void;
  showSentimentView: boolean;
  sentimentResults: SentimentResult | null;
  setShowSentimentView: (show: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  complete: (prompt: string) => void;
}

export default function DocumentContent({
  isEditing,
  markdownContent,
  setMarkdownContent,
  updateWordCount,
  showSentimentView,
  sentimentResults,
  setShowSentimentView,
  textareaRef,
  complete,
}: DocumentContentProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {showSentimentView ? (
        <SentimentView
          sentimentResults={sentimentResults}
          onClose={() => setShowSentimentView(false)}
        />
      ) : isEditing ? (
        <textarea
          ref={textareaRef}
          className="flex-1 overflow-y-auto p-4 focus:outline-none resize-none font-mono text-sm w-full h-full"
          defaultValue={markdownContent}
          onChange={(e) => {
            // When editing raw markdown, update state but don't stream yet
            const newContent = e.target.value;
            setMarkdownContent(newContent);
            updateWordCount(newContent);
          }}
        />
      ) : (
        <EditableMarkdown
          content={markdownContent}
          onChange={(newContent) => {
            // Just update the local state without triggering API calls
            setMarkdownContent(newContent);
            updateWordCount(newContent);
          }}
          onEdit={(editedContent) => {
            // This function will only be called when the user explicitly requests AI feedback
            console.log("Streaming AI feedback on edited content");

            // Show loading indicator in UI
            setMarkdownContent(editedContent + "\n\n_Getting AI feedback..._");

            // Call AI with the edited content
            complete(`I've edited this document. Please analyze and suggest improvements if needed:
            
${editedContent}

Please respond with the improved version only. Maintain the same general structure but fix any issues with grammar, clarity, or style.`);
          }}
        />
      )}
    </div>
  );
}
