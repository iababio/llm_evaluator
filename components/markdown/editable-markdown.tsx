import React, { useEffect, useRef, useState } from 'react';
import MarkdownDisplay from './markdown-display';

interface EditableMarkdownProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
}

const EditableMarkdown: React.FC<EditableMarkdownProps> = ({ 
  content, 
  onChange,
  onBlur
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update local content when prop changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  // Handle click on the rendered markdown
  const handleContainerClick = (e: React.MouseEvent) => {
    // Don't enable editing if user clicked a link or interactive element
    if ((e.target as HTMLElement).tagName === 'A' || 
        (e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    setIsEditing(true);
  };

  // Focus textarea when switching to edit mode
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isEditing]);

  // Save changes when user finishes editing
  const handleBlur = () => {
    setIsEditing(false);
    onChange(localContent);
    if (onBlur) onBlur();
  };

  return (
    <div className="w-full h-full">
      {isEditing ? (
        <textarea
          ref={editorRef}
          className="w-full h-full p-4 focus:outline-none resize-none font-mono text-sm"
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        <div 
          ref={containerRef}
          className="w-full h-full cursor-text"
          onClick={handleContainerClick}
        >
          <MarkdownDisplay content={localContent} />
        </div>
      )}
    </div>
  );
};

export default EditableMarkdown;