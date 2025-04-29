"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Clock, Trash2, FileText } from "lucide-react";

interface Document {
  id: string;
  title: string;
  date: string;
  preview: string;
}

interface DocumentListProps {
  documents: Document[];
  selectedDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onDeleteDocument: (e: React.MouseEvent, documentId: string) => void;
}

export default function DocumentList({
  documents,
  selectedDocumentId,
  onSelectDocument,
  onDeleteDocument,
}: DocumentListProps) {
  return (
    <div className="divide-y">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`p-3 cursor-pointer hover:bg-gray-50 group ${selectedDocumentId === doc.id ? "bg-gray-100" : ""}`}
          onClick={() => onSelectDocument(doc.id)}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 text-gray-400" />
              <h3 className="font-medium text-sm line-clamp-1 flex-1">
                {doc.title}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
              onClick={(e) => onDeleteDocument(e, doc.id)}
            >
              <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {doc.date}
          </p>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
            {doc.preview}
          </p>
        </div>
      ))}
    </div>
  );
}
