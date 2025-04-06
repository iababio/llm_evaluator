"use client";

import React from "react";
import {
  PencilIcon,
  FileText,
  SparklesIcon,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolbarSectionProps {
  isEditing: boolean;
  toggleEditMode: () => void;
  wordCount: number;
  showLeftSidebar: boolean;
  setShowLeftSidebar: (show: boolean) => void;
  showSidebarDesktop: boolean;
  setShowSidebarDesktop: (show: boolean) => void;
  showRightSidebar: boolean;
  setShowRightSidebar: (show: boolean) => void;
}

export default function ToolbarSection({
  isEditing,
  toggleEditMode,
  wordCount,
  showLeftSidebar,
  setShowLeftSidebar,
  showSidebarDesktop,
  setShowSidebarDesktop,
  showRightSidebar,
  setShowRightSidebar,
}: ToolbarSectionProps) {
  return (
    <div className="flex items-center gap-4 py-2 border-b mb-4 bg-white z-10 shrink-0">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setShowLeftSidebar(!showLeftSidebar)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Desktop sidebar toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:flex"
        onClick={(e) => {
          e.stopPropagation();
          setShowSidebarDesktop(!showSidebarDesktop);
        }}
      >
        {showSidebarDesktop ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>

      {/* Rest of toolbar buttons */}
      <Button variant="ghost" size="icon" onClick={toggleEditMode}>
        <PencilIcon className="h-4 w-4" />
        <span className="sr-only">{isEditing ? "Preview" : "Edit"}</span>
      </Button>
      <Button variant="ghost" size="icon">
        <span className="font-bold">B</span>
      </Button>
      <Button variant="ghost" size="icon">
        <span className="italic">I</span>
      </Button>
      <Button variant="ghost" size="icon">
        <span className="underline">U</span>
      </Button>
      <div className="w-px h-6 bg-gray-300"></div>
      <Button variant="ghost" size="sm">
        <span>H1</span>
      </Button>
      <Button variant="ghost" size="sm">
        <span>H2</span>
      </Button>
      <div className="w-px h-6 bg-gray-300"></div>
      <Button variant="ghost" size="icon">
        <FileText className="h-4 w-4" />
      </Button>
      <div className="w-px h-6 bg-gray-300"></div>
      <Button variant="ghost" size="icon">
        <div className="flex items-center">
          <span>•</span>
        </div>
      </Button>
      <Button variant="ghost" size="icon">
        <div className="flex items-center">
          <span>1.</span>
        </div>
      </Button>
      <div className="relative group">
        <Button variant="ghost" size="icon">
          <SparklesIcon className="h-4 w-4 text-blue-500" />
        </Button>
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded p-2 w-48">
          AI feedback is automatically requested when you make significant edits
          to the document.
        </div>
      </div>
      <div className="flex-1"></div>
      <div className="text-gray-500 text-sm mr-2">{wordCount} words</div>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          setShowRightSidebar(!showRightSidebar);
        }}
        className="ml-2"
      >
        {showRightSidebar ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
