"use client";

import React, { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserResource } from "@clerk/types";
import { motion, AnimatePresence } from "framer-motion";
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

  // Animation variants
  const sidebarVariants = {
    show: {
      x: 0,
      opacity: 1,
      width: "16rem", // w-64
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    hide: {
      x: "-100%",
      opacity: 0,
      width: 0,
      transition: {
        duration: 0.3,
      },
    },
  };

  // Animation variants for staggered children
  const listItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.3,
      },
    }),
  };

  return (
    <>
      {/* Left Sidebar for Documents */}
      <motion.aside
        className="absolute md:relative z-20 md:z-0 border-r bg-white h-full flex flex-col"
        variants={sidebarVariants}
        initial={isVisible ? "show" : "hide"}
        animate={isVisible ? "show" : "hide"}
      >
        {/* Sidebar Header */}
        <motion.div
          className="p-4 border-b flex justify-between items-center shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-medium">Documents</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewDocument}
            title="Create new document"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </motion.div>

        {/* User Profile */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <UserProfile user={user} />
        </motion.div>

        {/* Search Box */}
        <motion.div
          className="p-2 border-b shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
              placeholder="Search documents"
            />
          </div>
        </motion.div>

        {/* Document List */}
        <motion.div
          className="flex-1 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {filteredDocuments.length === 0 ? (
            <motion.div
              className="p-4 text-center text-gray-500 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              No documents found
            </motion.div>
          ) : (
            <AnimatePresence>
              <DocumentList
                documents={filteredDocuments}
                selectedDocumentId={selectedDocument}
                onSelectDocument={onSelectDocument}
                onDeleteDocument={handleDeleteDocument}
              />
            </AnimatePresence>
          )}
        </motion.div>
      </motion.aside>

      {/* Mobile Overlay with animation */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="md:hidden fixed inset-0 bg-black z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onSelectDocument(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
