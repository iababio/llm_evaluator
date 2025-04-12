"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Edit,
  Download,
  Share,
  Save,
  MessageCircle,
} from "lucide-react";

interface EditorToolbarProps {
  isEditing: boolean;
  wordCount: number;
  onSaveChat?: () => void; // Add this prop
  hasUnsavedChanges?: boolean;
}

export default function EditorToolbar({
  isEditing,
  wordCount,
  onSaveChat,
  hasUnsavedChanges = false,
}: EditorToolbarProps) {
  return (
    <div className="py-2 px-4 border-b flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost">
          <MessageCircle className="h-4 w-4 mr-2" />
          Chat
        </Button>

        <div className="text-xs text-gray-500">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline">
          <Edit className="h-4 w-4 mr-1" />
          {isEditing ? "Editing Mode" : "View Mode"}
        </Button>

        {onSaveChat && (
          <Button
            size="sm"
            variant={hasUnsavedChanges ? "default" : "outline"}
            onClick={onSaveChat}
            disabled={!hasUnsavedChanges}
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        )}

        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>

        <Button size="sm" variant="outline">
          <Share className="h-4 w-4 mr-1" />
          Share
        </Button>
      </div>
    </div>
  );
}
