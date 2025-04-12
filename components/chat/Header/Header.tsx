"use client";

import React from "react";
import {
  Menu,
  ChevronLeft,
  PanelRight,
  Edit,
  Eye,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@clerk/nextjs";

interface HeaderProps {
  showLeftSidebar: boolean;
  setShowLeftSidebar: (value: boolean) => void;
  showRightSidebar: boolean;
  setShowRightSidebar: (value: boolean) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  currentChatTitle?: string;
}

export default function Header({
  showLeftSidebar,
  setShowLeftSidebar,
  showRightSidebar,
  setShowRightSidebar,
  isEditing,
  setIsEditing,
  currentChatTitle,
}: HeaderProps) {
  return (
    <header className="border-b bg-white flex justify-between items-center px-4 py-2">
      <div className="flex items-center">
        <Button
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          variant="ghost"
          size="icon"
          className="mr-2"
        >
          {showLeftSidebar ? <ChevronLeft /> : <Menu />}
        </Button>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          <h1 className="text-lg font-medium">
            {currentChatTitle || "New Chat"}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          {isEditing ? (
            <>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </>
          ) : (
            <>
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </>
          )}
        </Button>

        <Button
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          variant="ghost"
          size="icon"
        >
          <PanelRight />
        </Button>

        <SignOutButton>
          <Button variant="outline" size="sm">
            Sign Out
          </Button>
        </SignOutButton>
      </div>
    </header>
  );
}
