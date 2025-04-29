"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Send,
  PaperclipIcon,
  Mic,
  Image,
  SquarePen,
  Sparkles,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputSectionProps {
  onSendMessage: (message: string) => void;
  onAnalyzeSentiment?: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function ChatInputSection({
  onSendMessage,
  onAnalyzeSentiment,
  isLoading = false,
  placeholder = "Type a message...",
  autoFocus = false,
}: ChatInputSectionProps) {
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Auto-focus textarea on mount if prop is true
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Handle submitting the message
  const handleSubmit = () => {
    if (message.trim() === "" && !attachment) return;

    onSendMessage(message);
    setMessage("");
    setAttachment(null);
    setAttachmentPreview(null);

    // Refocus textarea after sending
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Handle key press events (Enter to send, Shift+Enter for new line)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle attachment selection
  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachment(file);

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachmentPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove attachment
  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle analyzing sentiment
  const handleAnalyzeSentiment = () => {
    if (message.trim() === "") return;
    if (onAnalyzeSentiment) {
      onAnalyzeSentiment(message);
    }
  };

  return (
    <div className="border-t bg-white p-4">
      {/* Attachment Preview */}
      {attachmentPreview && (
        <div className="relative mb-2 inline-block">
          <img
            src={attachmentPreview}
            alt="Attachment preview"
            className="max-h-32 rounded-md border"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full shadow-sm"
            onClick={removeAttachment}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Main Input Area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 bg-gray-100 rounded-lg p-2 flex items-end">
          {/* Attachment Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <PaperclipIcon className="h-5 w-5 text-gray-500" />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleAttachment}
            accept="image/*,application/pdf"
            disabled={isLoading}
          />

          {/* Text Input */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isLoading ? "AI is thinking..." : placeholder}
            disabled={isLoading}
            className="flex-1 border-0 bg-transparent min-h-[40px] max-h-[200px] py-2 px-3 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Sentiment Analysis Button (if provided) */}
          {onAnalyzeSentiment && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleAnalyzeSentiment}
              disabled={isLoading || message.trim() === ""}
            >
              <SquarePen className="h-5 w-5 text-gray-500" />
            </Button>
          )}

          {/* AI button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSubmit}
            disabled={isLoading || message.trim() === ""}
          >
            <Sparkles className="h-5 w-5 text-blue-500" />
          </Button>
        </div>

        {/* Send Button */}
        <Button
          className={`h-10 w-10 rounded-full ${isLoading ? "opacity-70" : ""}`}
          disabled={isLoading || message.trim() === ""}
          onClick={handleSubmit}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      {/* Character Count */}
      <div className="mt-1 text-xs text-gray-400 text-right">
        {message.length > 0 && `${message.length} characters`}
        {isLoading && (
          <span className="ml-2 text-blue-500">
            AI is generating a response...
          </span>
        )}
      </div>
    </div>
  );
}
