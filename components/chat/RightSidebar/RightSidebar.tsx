"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import SentimentPanel from "./SentimentPanel";
// Fix the import to match the file name
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
  return (
    <aside
      className={`
        ${isVisible ? "translate-x-0 w-[500px]" : "translate-x-full w-0 opacity-0"}
        border-l flex flex-col shrink-0 overflow-hidden
        transition-all duration-300 ease-in-out
      `}
    >
      {/* Review header with toggle button */}
      <div className="p-4 border-b shrink-0 flex justify-between items-start">
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="font-medium">Evaluation Analysis</span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 mt-4 border-b">
            <button
              className={`pb-2 px-3 ${!showSentimentPanel ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
              onClick={() => setShowSentimentPanel(false)}
            >
              Suggestions
            </button>
            <button
              className={`pb-2 px-2 ${showSentimentPanel ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
              onClick={() => setShowSentimentPanel(true)}
              disabled={!sentimentResults}
            >
              Sentiment Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Conditional Content Based on Tab */}
      <div className="flex-1 overflow-y-auto">
        {showSentimentPanel ? (
          <SentimentPanel sentimentResults={sentimentResults} />
        ) : (
          <SuggestionPanel
            isAnalyzing={isAnalyzing}
            // Pass the current document content to analyze
            handleAnalyzeSentiments={handleAnalyzeSentiments}
          />
        )}
      </div>
    </aside>
  );
}
