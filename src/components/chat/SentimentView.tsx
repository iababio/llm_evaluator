"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { sentimentColors, sentimentTextColors } from "@/utils/sentimentColors";

interface SentimentResult {
  segments: Array<{
    text: string;
    sentiment: string[];
  }>;
}

interface SentimentViewProps {
  sentimentResults: SentimentResult | null;
  onClose: () => void;
}

// Import sentiment color mappings from a utils file to avoid duplication

export default function SentimentView({
  sentimentResults,
  onClose,
}: SentimentViewProps) {
  if (!sentimentResults || !sentimentResults.segments) {
    return <div>No sentiment data available</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 pb-2 border-b">
        <h2 className="text-xl font-semibold">Sentiment Analysis Results</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Return to Editor
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sentimentResults.segments.map((segment, index) => {
          // Get primary sentiment (first in the array) for the main color
          const primarySentiment =
            Array.isArray(segment.sentiment) && segment.sentiment.length > 0
              ? segment.sentiment[0].toLowerCase()
              : "neutral";

          const bgColorClass =
            sentimentColors[primarySentiment] || "bg-gray-100 border-gray-300";

          return (
            <div
              key={index}
              className={`mb-4 p-4 rounded-md border ${bgColorClass}`}
            >
              <p className="text-gray-800 mb-2">{segment.text}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {Array.isArray(segment.sentiment) &&
                  segment.sentiment.map((sentiment, i) => {
                    const sentimentKey = String(sentiment).toLowerCase();
                    const textColor =
                      sentimentTextColors[sentimentKey] || "text-gray-800";

                    return (
                      <span
                        key={i}
                        className={`px-3 py-1 text-xs font-medium rounded-full border ${textColor}`}
                      >
                        {String(sentiment)}
                      </span>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
