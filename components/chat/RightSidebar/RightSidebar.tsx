"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import SentimentPanel from "./SentimentPanel";
import SuggestionPanel from "./SuggestionsPanel";

interface SentimentResult {
  segments: Array<{
    text: string;
    sentiment: string[];
  }>;
}

interface RightSidebarProps {
  isVisible: boolean;
  showSentimentPanel: boolean;
  setShowSentimentPanel: (show: boolean) => void;
  sentimentResults: SentimentResult | null;
  isAnalyzing: boolean;
  handleAnalyzeSentiments: (content: string) => void;
}

export default function RightSidebar({
  isVisible,
  showSentimentPanel,
  setShowSentimentPanel,
  sentimentResults,
  isAnalyzing,
  handleAnalyzeSentiments,
}: RightSidebarProps) {
  // Animation variants
  const sidebarVariants = {
    open: {
      x: 0,
      width: "500px",
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    closed: {
      x: "100%",
      width: 0,
      opacity: 0,
      transition: {
        duration: 0.3,
      },
    },
  };

  const tabVariants = {
    active: {
      borderBottom: "2px solid #2563eb",
      color: "#2563eb",
      transition: { duration: 0.3 },
    },
    inactive: {
      borderBottom: "2px solid transparent",
      color: "#4b5563",
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.aside
      variants={sidebarVariants}
      initial={isVisible ? "open" : "closed"}
      animate={isVisible ? "open" : "closed"}
      className="border-l flex flex-col shrink-0 overflow-hidden"
    >
      {/* Review header with toggle button */}
      <motion.div
        className="p-4 border-b shrink-0 flex justify-between items-start"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2">
              <motion.span
                className="font-medium"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Evaluation Analysis
              </motion.span>
            </div>
          </div>

          {/* Tab Switcher with motion */}
          <div className="flex gap-2 mt-4 border-b">
            <motion.button
              variants={tabVariants}
              initial={false}
              animate={!showSentimentPanel ? "active" : "inactive"}
              className="pb-2 px-3"
              onClick={() => setShowSentimentPanel(false)}
            >
              Suggestions
            </motion.button>
            <motion.button
              variants={tabVariants}
              initial={false}
              animate={showSentimentPanel ? "active" : "inactive"}
              className="pb-2 px-2"
              onClick={() => setShowSentimentPanel(true)}
              disabled={!sentimentResults}
            >
              Sentiment Analysis
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Conditional Content Based on Tab */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {showSentimentPanel ? (
            <motion.div
              key="sentiment"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <SentimentPanel sentimentResults={sentimentResults} />
            </motion.div>
          ) : (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <SuggestionPanel
                isAnalyzing={isAnalyzing}
                handleAnalyzeSentiments={handleAnalyzeSentiments}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
