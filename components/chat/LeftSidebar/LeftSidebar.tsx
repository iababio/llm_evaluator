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
  const { isSignedIn, isLoaded, getToken } = useAuth();

  const { chatHistory, isLoading, error, fetchChatHistory, deleteChat } =
    useChatHistory();

  const [tokenAvailable, setTokenAvailable] = useState(false);
  const [authTested, setAuthTested] = useState(false);
  const hasFetchedRef = useRef(false);

  // Local state for search functionality
  const [searchQuery, setSearchQuery] = useState("");

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

  // Enhanced token checking inside the useEffect
  useEffect(() => {
    if (isLoaded && isSignedIn && !authTested) {
      // First check if we can get a token
      const checkToken = async () => {
        try {
          if (user && user.id) {
            console.log("User ID:", user.id);
          }

          // Try different approaches to get a token
          let token = null;
          let tokenMethod = "";

          try {
            // Try the default approach first
            token = await getToken();
            tokenMethod = "default";
          } catch (e) {
            console.error("Error getting token with default method:", e);

            // Try with template parameter
            try {
              token = await getToken({ template: "default" });
              tokenMethod = "template:default";
            } catch (e2) {
              console.error("Error getting token with template=default:", e2);

              // Try with JWT template
              try {
                token = await getToken({ template: "jwt" });
                tokenMethod = "template:jwt";
              } catch (e3) {
                console.error("Error getting token with template=jwt:", e3);
              }
            }
          }

          if (token) {
            console.log(
              `Got token using ${tokenMethod}: ${token.substring(0, 10)}...`,
            );

            // Make a diagnostic request to debug endpoint
            console.log("Making diagnostic request to /api/auth-debug");
            const diagResponse = await fetch("/api/auth-debug", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            const diagData = await diagResponse.json();
            console.log("Auth debug response:", diagData);

            // Now try the auth check endpoint
            const authCheckResponse = await fetch("/api/auth/check", {
              headers: {
                Authorization: `Bearer ${token}`,
                "X-Request-Id": `sidebar-auth-${Date.now()}`,
              },
            });

            const authCheckResult = await authCheckResponse.json();
            console.log("Auth check result:", authCheckResult);

            setAuthTested(true);
            if (authCheckResult?.authenticated) {
              console.log("Auth verified, fetching chat history");
              setTokenAvailable(true);

              // Try fetching chat history with explicit headers
              try {
                console.log("Explicitly fetching chat history with token");
                const chatResponse = await fetch("/api/chat-history", {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "X-Request-Id": `manual-fetch-${Date.now()}`,
                  },
                });

                if (chatResponse.ok) {
                  const chats = await chatResponse.json();
                  console.log(
                    `Successfully fetched ${chats.length} chats manually`,
                  );
                  // Let the hook handle the actual fetch
                  fetchChatHistory();
                } else {
                  console.error(
                    "Manual chat history fetch failed:",
                    await chatResponse.text(),
                  );
                  // Still try the regular fetch
                  fetchChatHistory();
                }
              } catch (fetchError) {
                console.error(
                  "Error in manual chat history fetch:",
                  fetchError,
                );
                fetchChatHistory();
              }
            } else {
              setTokenAvailable(false);
              console.error("Auth check failed, not fetching chat history");
            }
          } else {
            setTokenAvailable(false);
            setAuthTested(true);
            console.error("Could not obtain a token with any method");
          }
        } catch (error) {
          console.error("Auth check error:", error);
          setAuthTested(true);
          setTokenAvailable(false);
        }
      };

      checkToken();
    }
  }, [isLoaded, isSignedIn, authTested, fetchChatHistory, user, getToken]);

  // Only fetch chat history once when component mounts
  useEffect(() => {
    if (isLoaded && isSignedIn && !initialized.current) {
      console.log("LeftSidebar: Initial fetch of chat history");
      initialized.current = true;
      fetchChatHistory();
    }
  }, [isLoaded, isSignedIn, fetchChatHistory]);

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

  return (
    <>
      {/* Left Sidebar for Chat History */}
      <motion.aside
        initial={{ x: "-100%", opacity: 0 }}
        animate={{
          x: isVisible ? 0 : "-100%",
          opacity: isVisible ? 1 : 0,
          width: isVisible ? "16rem" : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className="absolute md:relative z-20 md:z-0 border-r bg-white h-full flex flex-col"
      >
        {/* Sidebar Header */}
        <motion.div
          className="p-4 border-b flex justify-between items-center shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-medium">Chat History</h2>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewChat}
              title="Start new chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </motion.div>
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
              placeholder="Search chats"
            />
          </div>
        </motion.div>

        {/* Chat History List with state-based content */}
        <motion.div
          className="flex-1 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <AnimatePresence mode="wait">
            {!isLoaded ? (
              <motion.div
                key="loading-user"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 text-center"
              >
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Loading user...</p>
              </motion.div>
            ) : !isSignedIn ? (
              <motion.div
                key="sign-in"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 text-center text-gray-500 text-sm"
              >
                Please sign in to view chat history
              </motion.div>
            ) : isLoading ? (
              <motion.div
                key="loading-chats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 text-center"
              >
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Loading chats...</p>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 text-center text-red-500 text-sm"
              >
                Error loading chats: {error}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 mx-auto block"
                    onClick={() => fetchChatHistory()}
                  >
                    Retry
                  </Button>
                </motion.div>
              </motion.div>
            ) : filteredChats.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 text-center text-gray-500 text-sm"
              >
                {searchQuery ? "No chats found" : "No chat history yet"}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 mx-auto block"
                    onClick={onNewChat}
                  >
                    Start a new chat
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="chat-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DocumentList
                  documents={chatDocuments}
                  selectedDocumentId={selectedChat}
                  onSelectDocument={onSelectChat}
                  onDeleteDocument={handleDeleteDocument}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.aside>

      {/* Mobile Overlay with animation */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 bg-black z-10"
            onClick={() => onSelectChat(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
