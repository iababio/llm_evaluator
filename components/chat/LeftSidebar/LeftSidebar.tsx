"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserResource } from "@clerk/types";
import { motion, AnimatePresence } from "framer-motion";
import DocumentList from "./DocumentList";
import UserProfile from "./UserProfile";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useAuth } from "@clerk/nextjs";

// Use the ChatHistoryItem interface from useChatHistory
import type { ChatHistoryItem } from "@/hooks/useChatHistory";

interface LeftSidebarProps {
  isVisible: boolean;
  selectedChat: string | null;
  onSelectChat: (chatId: string | null) => void;
  onNewChat: () => void;
  user: UserResource;
}

export default function LeftSidebar({
  isVisible,
  selectedChat,
  onSelectChat,
  onNewChat,
  user,
}: LeftSidebarProps) {
  // Add a ref to track initialization
  const initialized = useRef(false);
  const { isSignedIn, isLoaded } = useAuth();

  const { chatHistory, isLoading, error, fetchChatHistory, deleteChat } =
    useChatHistory();

  const [tokenAvailable, setTokenAvailable] = useState(false);
  const [authTested, setAuthTested] = useState(false);
  const hasFetchedRef = useRef(false);

  // Check auth status internally
  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/check");
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Auth check error:", error);
      return null;
    }
  };

  // Test auth status first
  useEffect(() => {
    if (isLoaded && isSignedIn && !authTested) {
      checkAuthStatus().then((result) => {
        setAuthTested(true);
        if (result?.clerk_id) {
          console.log("Auth verified, fetching chat history");
          setTokenAvailable(true);
          fetchChatHistory();
        } else {
          setTokenAvailable(false);
          console.error("Auth check failed, not fetching chat history");
        }
      });
    }
  }, [isLoaded, isSignedIn, authTested, fetchChatHistory]);

  // // Add debug info component
  // const AuthDebugPanel = () => {
  //   if (process.env.NODE_ENV === 'production') return null;

  //   return (
  //     <div className="p-2 text-xs border-t bg-yellow-50 text-yellow-800">
  //       <p>Debug: {isLoaded ? "✅" : "❌"} Loaded</p>
  //       <p>Sign-in: {isSignedIn ? "✅" : "❌"} Signed</p>
  //       <p>Token: {tokenAvailable ? "✅" : "❌"} Available</p>
  //       <p>Tested: {authTested ? "✅" : "❌"} Tested</p>
  //       <button
  //         onClick={() => checkAuthStatus()}
  //         className="underline text-blue-500 mt-1"
  //       >
  //         Test Auth
  //       </button>
  //     </div>
  //   );
  // };

  // Local state for search functionality
  const [searchQuery, setSearchQuery] = useState("");

  // Only fetch chat history once when component mounts
  useEffect(() => {
    if (isLoaded && isSignedIn && !initialized.current) {
      console.log("LeftSidebar: Initial fetch of chat history");
      initialized.current = true;
      fetchChatHistory();
    }
  }, [isLoaded, isSignedIn, fetchChatHistory]);

  // Refresh chat history if there was an error
  useEffect(() => {
    if (error) {
      // Add a delay before retrying
      const retryTimer = setTimeout(() => {
        fetchChatHistory();
      }, 5000);

      return () => clearTimeout(retryTimer);
    }
  }, [error, fetchChatHistory]);

  // Add this effect for debugging
  useEffect(() => {
    console.log("Chat history data:", chatHistory);
    console.log("Chat history type:", typeof chatHistory);
    console.log("Is Array:", Array.isArray(chatHistory));
  }, [chatHistory]);

  // Filter chats safely
  const filteredChats = React.useMemo(() => {
    // Safety check: make sure chatHistory exists and is an array
    if (!chatHistory || !Array.isArray(chatHistory)) {
      return [];
    }

    // If no search query, return all chats
    if (!searchQuery) {
      return chatHistory;
    }

    // Filter with search
    return chatHistory.filter(
      (chat) =>
        chat &&
        chat.title &&
        typeof chat.title === "string" &&
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [chatHistory, searchQuery]);

  console.log("Filtered chats:", filteredChats);

  // Map chat histories to document format with defensive coding
  const chatDocuments = filteredChats.map((chat) => {
    // Ensure all required fields have valid values
    const id = chat?.id || "";
    const title = chat?.title || "Untitled Chat";
    const createdAt = chat?.created_at ? new Date(chat.created_at) : new Date();
    const preview = chat?.last_message || "No messages";

    return {
      id,
      title,
      date: createdAt.toLocaleDateString(),
      preview,
    };
  });

  // Handle document deletion
  const handleDeleteDocument = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // Prevent triggering document selection

    if (confirm("Are you sure you want to delete this chat?")) {
      const success = await deleteChat(chatId);

      if (success) {
        // If the deleted chat was selected, clear the selection
        if (selectedChat === chatId) {
          onSelectChat(null);
        }
      }
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
      {/* Left Sidebar for Chat History */}
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
          <h2 className="font-medium">Chat History</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewChat}
            title="Start new chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
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
              placeholder="Search chats"
            />
          </div>
        </motion.div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto">
          {!isLoaded ? (
            <div className="p-4 text-center">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading user...</p>
            </div>
          ) : !isSignedIn ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              Please sign in to view chat history
            </div>
          ) : isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading chats...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500 text-sm">
              Error loading chats: {error}
              <Button
                variant="link"
                size="sm"
                className="mt-2 mx-auto block"
                onClick={() => fetchChatHistory()}
              >
                Retry
              </Button>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {searchQuery ? "No chats found" : "No chat history yet"}
              <Button
                variant="link"
                size="sm"
                className="mt-2 mx-auto block"
                onClick={onNewChat}
              >
                Start a new chat
              </Button>
            </div>
          ) : (
            <DocumentList
              documents={chatDocuments}
              selectedDocumentId={selectedChat}
              onSelectDocument={onSelectChat}
              onDeleteDocument={handleDeleteDocument}
            />
          )}
        </div>
        {/* <AuthDebugPanel /> */}
      </aside>

      {/* Mobile Overlay */}
      {isVisible && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-20 z-10"
          onClick={() => onSelectChat(null)}
        />
      )}
    </>
  );
}
