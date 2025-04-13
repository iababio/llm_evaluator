"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PencilIcon } from "lucide-react";

interface EditableMarkdownProps {
  content: string;
  onChange: (newContent: string) => void;
}

export default function EditableMarkdown({
  content,
  onChange,
}: EditableMarkdownProps) {
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [editedText, setEditedText] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<string>("");

  // Important: Update content reference when it changes
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Split the markdown content into segments based on paragraphs and headings
  const segments = content
    .split(/\n\n+/)
    .filter((segment) => segment.trim() !== "");

  // Start editing a specific segment
  const handleStartEditing = (index: number) => {
    setEditingSegment(index);
    setEditedText(segments[index]);

    // Focus the textarea after a short delay to ensure it's rendered
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 10);
  };

  // Save changes to a segment
  const handleSaveEdit = () => {
    if (editingSegment !== null) {
      // Replace the edited segment in the content
      const newSegments = [...segments];
      newSegments[editingSegment] = editedText;

      // Reconstruct the full content
      const newContent = newSegments.join("\n\n");
      onChange(newContent);

      // Exit editing mode
      setEditingSegment(null);
    }
  };

  // Cancel editing a segment
  const handleCancelEdit = () => {
    setEditingSegment(null);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // If content is empty or very short, display it as a single segment
  if (!content || content.trim().length === 0) {
    return (
      <div className="markdown-content w-full h-full p-4 overflow-y-auto">
        <div className="prose max-w-none p-6">
          <p className="text-gray-400 italic">No content to display</p>
        </div>
      </div>
    );
  }

  // Update the content rendering section
  return (
    <div className="markdown-content w-full h-full p-4 overflow-y-auto">
      <div className="prose max-w-none p-6">
        {segments.length === 0 ? (
          // This section renders the content directly when there are no proper segments
          // Important for handling streaming content that might not have paragraph breaks yet
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose prose-sm max-w-none overflow-hidden"
          >
            {content}
          </ReactMarkdown>
        ) : (
          // Segmented content rendering for normal content
          segments.map((segment, index) => (
            <div
              key={`segment-${index}-${segment.substring(0, 10)}-${Date.now()}`}
              className="group relative mb-4"
            >
              {editingSegment === index ? (
                <div className="border rounded-md p-2">
                  <textarea
                    ref={textareaRef}
                    className="w-full min-h-[100px] p-2 focus:outline-none resize-vertical font-mono text-sm"
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      onClick={handleSaveEdit}
                    >
                      Save (Ctrl+Enter)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="markdown-segment">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      className="prose prose-sm max-w-none overflow-hidden"
                    >
                      {segment}
                    </ReactMarkdown>
                  </div>
                  <button
                    className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full border shadow"
                    onClick={() => handleStartEditing(index)}
                    aria-label="Edit section"
                  >
                    <PencilIcon className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
