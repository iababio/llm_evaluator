import React, { useEffect, useRef, useState } from 'react';
import MarkdownDisplay from './markdown-display';

interface EditableMarkdownProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  onEdit?: (content: string) => void; // For AI streaming
}

const EditableMarkdown: React.FC<EditableMarkdownProps> = ({ 
  content, 
  onChange,
  onBlur,
  onEdit
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const [editDebounce, setEditDebounce] = useState<NodeJS.Timeout | null>(null);
  const [shouldTriggerAI, setShouldTriggerAI] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Skip initial edit trigger
  const isInitialMount = useRef(true);

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

  // Handle content changes with debounced AI streaming
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    
    // Clear previous debounce timer
    if (editDebounce) {
      clearTimeout(editDebounce);
    }
    
    // Only set up stream debounce if onEdit is provided AND shouldTriggerAI is true
    if (onEdit && shouldTriggerAI) {
      setEditDebounce(setTimeout(() => {
        // Only call the AI if there's a significant change (more than 20 chars)
        // and we're not in the initial render
        if (!isInitialMount.current && 
            newContent !== content && 
            newContent.length > 20) {
          onEdit(newContent);
          // Reset the flag after triggering AI once
          setShouldTriggerAI(false);
        }
      }, 1500)); // 1.5 second debounce
    }
  };

  // Save changes when user finishes editing
  const handleBlur = () => {
    setIsEditing(false);
    
    // Update local state without triggering side effects
    if (localContent !== content) {
      onChange(localContent);
    }
    
    // Don't automatically call onBlur to prevent unwanted API calls
    // Only call it if explicitly requested by passing a special flag
    if (onBlur && localContent !== content) {
      onBlur();
    }
    
    // After first blur, component is no longer in initial mount state
    isInitialMount.current = false;
  };

  return (
    <div className="w-full h-full">
      {isEditing ? (
        <div className="flex flex-col h-full">
          <textarea
            ref={editorRef}
            className="flex-1 w-full p-4 focus:outline-none resize-none font-mono text-sm"
            value={localContent}
            onChange={handleContentChange}
            onBlur={handleBlur}
          />
          {onEdit && (
            <div className="flex justify-end p-2">
              <button
                type="button"
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600"
                onClick={() => {
                  if (localContent !== content && localContent.length > 0) {
                    onEdit(localContent);
                  }
                }}
              >
                Get AI suggestions
              </button>
            </div>
          )}
        </div>
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