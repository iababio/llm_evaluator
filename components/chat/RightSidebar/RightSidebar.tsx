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
  const panelVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 20 : -20,
      opacity: 0,
    }),
  };

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0, x: "100%" }}
      animate={{
        width: isVisible ? 500 : 0,
        opacity: isVisible ? 1 : 0,
        x: isVisible ? "0%" : "100%",
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
      className="border-l flex flex-col shrink-0 overflow-hidden"
    >
      {/* Header with tab switcher */}
      <motion.div
        className="p-4 border-b shrink-0 flex justify-between items-start"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : -10 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="font-medium">Evaluation Analysis</span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 mt-4 border-b">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`pb-2 px-3 transition-colors ${!showSentimentPanel ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
              onClick={() => setShowSentimentPanel(false)}
            >
              Suggestions
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`pb-2 px-2 transition-colors ${showSentimentPanel ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
              onClick={() => setShowSentimentPanel(true)}
              disabled={!sentimentResults}
            >
              Sentiment Analysis
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Content with animation */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence
          mode="wait"
          initial={false}
          custom={showSentimentPanel ? 1 : -1}
        >
          {showSentimentPanel ? (
            <motion.div
              key="sentiment"
              custom={1}
              variants={panelVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="h-full"
            >
              <SentimentPanel sentimentResults={sentimentResults} />
            </motion.div>
          ) : (
            <motion.div
              key="suggestions"
              custom={-1}
              variants={panelVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="h-full"
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
