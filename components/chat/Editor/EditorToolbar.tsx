"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Edit, Download, Share } from "lucide-react";

interface EditorToolbarProps {
  isEditing: boolean;
  wordCount: number;
}

export default function EditorToolbar({
  isEditing,
  wordCount,
}: EditorToolbarProps) {
  return (
    <div className="py-2 px-4 border-b flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost">
          <FileText className="h-4 w-4 mr-2" />
          Document
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
