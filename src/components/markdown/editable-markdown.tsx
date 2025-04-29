import React, { useEffect, useRef, useState } from "react";
import MarkdownDisplay from "./markdown-display";

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
  onEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const [editDebounce, setEditDebounce] = useState<NodeJS.Timeout | null>(null);
  const [shouldTriggerAI, setShouldTriggerAI] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isInitialMount = useRef(true);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).tagName === "A" ||
      (e.target as HTMLElement).tagName === "BUTTON"
    ) {
      return;
    }
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isEditing]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);

    if (editDebounce) {
      clearTimeout(editDebounce);
    }

    if (onEdit && shouldTriggerAI) {
      setEditDebounce(
        setTimeout(() => {
          if (
            !isInitialMount.current &&
            newContent !== content &&
            newContent.length > 20
          ) {
            onEdit(newContent);
            setShouldTriggerAI(false);
          }
        }, 1500),
      ); // 1.5 second debounce
    }
  };

  const handleBlur = () => {
    setIsEditing(false);

    if (localContent !== content) {
      onChange(localContent);
    }

    if (onBlur && localContent !== content) {
      onBlur();
    }

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
