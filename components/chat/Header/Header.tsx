"use client";

import React from "react";
import { UserButton } from "@clerk/nextjs";
import {
  MenuIcon,
  PanelLeftIcon,
  PanelRightIcon,
  Edit2Icon,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DocumentActions from "./DocumentActions";

interface HeaderProps {
  showLeftSidebar: boolean;
  setShowLeftSidebar: (show: boolean) => void;
  showRightSidebar: boolean;
  setShowRightSidebar: (show: boolean) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

export default function Header({
  showLeftSidebar,
  setShowLeftSidebar,
  showRightSidebar,
  setShowRightSidebar,
  isEditing,
  setIsEditing,
}: HeaderProps) {
  return (
    <header className="h-14 border-b flex items-center justify-between px-4 shrink-0">
      {/* Left section: Logo and toggles */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          className="text-gray-500"
          aria-label="Toggle left sidebar"
          data-state={showLeftSidebar ? "active" : "inactive"}
        >
          <PanelLeftIcon className="h-5 w-5" />
        </Button>

        <div className="font-semibold text-lg">LLM Evaluation</div>
      </div>

      {/* Middle section: Document actions */}
      <DocumentActions isEditing={isEditing} setIsEditing={setIsEditing} />

      {/* Right section: User profile and right sidebar toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          className="text-gray-500"
          aria-label="Toggle right sidebar"
          data-state={showRightSidebar ? "active" : "inactive"}
        >
          <PanelRightIcon className="h-5 w-5" />
        </Button>

        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
