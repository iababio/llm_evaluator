"use client";

import React, { useState } from "react";
import { Plus, ChevronLeft, Search, Clock, Trash2, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserResource } from "@clerk/types";
import DocumentList from "./DocumentList";
import UserProfile from "./UserProfile";

interface Document {
  id: string;
  title: string;
  date: string;
  preview: string;
}

interface LeftSidebarProps {
  isVisible: boolean;
  selectedDocument: string | null;
  onSelectDocument: (documentId: string | null) => void;
  user: UserResource;
}

export default function LeftSidebar({
  isVisible,
  selectedDocument,
  onSelectDocument,
  user,
}: LeftSidebarProps) {
  // Local state for search functionality
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data for documents (replace with actual data fetching logic)
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: "1",
      title: "Project Proposal",
      date: "2025-03-28",
      preview:
        "This document outlines the project goals, timeline, and budget requirements.",
    },
    {
      id: "2",
      title: "Meeting Notes",
      date: "2025-03-25",
      preview:
        "Notes from the weekly team meeting including action items and decisions.",
    },
    {
      id: "3",
      title: "Research Findings",
      date: "2025-03-20",
      preview:
        "Summary of research findings from user interviews and competitive analysis.",
    },
  ]);

  // Filter documents based on search query
  const filteredDocuments = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.preview.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle creating a new document
  const handleNewDocument = () => {
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: "Untitled Document",
      date: new Date().toISOString().split("T")[0],
      preview: "Empty document",
    };

    setDocuments([newDoc, ...documents]);
    onSelectDocument(newDoc.id);
  };

  // Handle document deletion
  const handleDeleteDocument = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation(); // Prevent triggering document selection
    setDocuments(documents.filter((doc) => doc.id !== docId));

    if (selectedDocument === docId) {
      onSelectDocument(null);
    }
  };

  return (
    <>
      {/* Left Sidebar for Documents */}
      <aside
        className={`
          ${isVisible ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0
          w-64 
          absolute md:relative z-20 md:z-0 border-r bg-white h-full 
          transition-all duration-300 ease-in-out flex flex-col
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h2 className="font-medium">Documents</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewDocument}
            title="Create new document"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* User Profile */}
        <UserProfile user={user} />

        {/* Search Box */}
        <div className="p-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
              placeholder="Search documents"
            />
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto">
          {filteredDocuments.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No documents found
            </div>
          ) : (
            <DocumentList
              documents={filteredDocuments}
              selectedDocumentId={selectedDocument}
              onSelectDocument={onSelectDocument}
              onDeleteDocument={handleDeleteDocument}
            />
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isVisible && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-20 z-10"
          onClick={() => onSelectDocument(null)}
        />
      )}
    </>
  );
}
