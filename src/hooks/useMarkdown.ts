import { useState, useEffect } from "react";

export default function useMarkdown(initialContent = "") {
  const [markdownContent, setMarkdownContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Update word count when content changes
  const updateWordCount = (content: string) => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  };

  // Initialize word count
  useEffect(() => {
    updateWordCount(markdownContent);
  }, []);

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setMarkdownContent(newContent);
    updateWordCount(newContent);
  };

  return {
    markdownContent,
    setMarkdownContent,
    isEditing,
    setIsEditing,
    wordCount,
    setWordCount,
    updateWordCount,
    handleContentChange,
  };
}
