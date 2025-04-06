"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Edit2Icon,
  EyeIcon,
  SaveIcon,
  PlusIcon,
  FileTextIcon,
} from "lucide-react";

interface DocumentActionsProps {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

export default function DocumentActions({
  isEditing,
  setIsEditing,
}: DocumentActionsProps) {
  // Toggle between edit and view modes
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };

  // Create a new document (placeholder functionality)
  const createNewDocument = () => {
    console.log("Creating new document");
    // Implementation will depend on your document creation logic
  };

  // Save the current document (placeholder functionality)
  const saveDocument = () => {
    console.log("Saving document");
    // Implementation will depend on your document saving logic
  };

  return (
    <div className="flex items-center gap-2">
      {/* New Document Button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-gray-600 flex items-center gap-1"
        onClick={createNewDocument}
      >
        <PlusIcon className="h-4 w-4" />
        <span className="hidden sm:inline">New</span>
      </Button>

      {/* Toggle Edit/View Button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-gray-600 flex items-center gap-1"
        onClick={toggleEditMode}
      >
        {isEditing ? (
          <>
            <EyeIcon className="h-4 w-4" />
            <span className="hidden sm:inline">View</span>
          </>
        ) : (
          <>
            <Edit2Icon className="h-4 w-4" />
            <span className="hidden sm:inline">Edit</span>
          </>
        )}
      </Button>

      {/* Save Button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-gray-600 flex items-center gap-1"
        onClick={saveDocument}
      >
        <SaveIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Save</span>
      </Button>
    </div>
  );
}
