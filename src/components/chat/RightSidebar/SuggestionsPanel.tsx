"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";

interface SuggestionProps {
  text: string;
  description: string;
}

interface SuggestionPanelProps {
  isAnalyzing: boolean;
  handleAnalyzeSentiments: (content: string) => void;
}

export default function SuggestionPanel({
  isAnalyzing,
  handleAnalyzeSentiments,
}: SuggestionPanelProps) {
  const [selectedSuggestion, setSelectedSuggestion] = useState<number>(-1);
  const [reviewSuggestions, setReviewSuggestions] = useState<SuggestionProps[]>(
    [
      {
        text: "Check Sentiments",
        description: "Check for various sentiment analysis in the document.",
      },
      {
        text: "Consider rephrasing",
        description: "This sentence could be clearer with different wording.",
      },
      {
        text: "Add more detail",
        description: "This section would benefit from additional information.",
      },
      {
        text: "Fix grammatical error",
        description: "There appears to be a subject-verb agreement issue here.",
      },
    ],
  );

  // Function to handle suggestion actions
  const handleSuggestionAction = (suggestion: SuggestionProps) => {
    if (suggestion.text === "Check Sentiments") {
      // Get the current document content from the editor
      // We're passing an empty string here, but the actual content will be
      // retrieved in the handleAnalyzeSentiments function from the page component
      handleAnalyzeSentiments("current-document");
    } else {
      // Handle other suggestions
      console.log(`Applying suggestion: ${suggestion.text}`);

      // Here you would implement the actual functionality for each suggestion type
      switch (suggestion.text) {
        case "Consider rephrasing":
          // Logic to suggest rephrasing
          alert("Rephrasing suggestion selected");
          break;
        case "Add more detail":
          // Logic to suggest adding details
          alert("Adding detail suggestion selected");
          break;
        case "Fix grammatical error":
          // Logic to fix grammar
          alert("Grammar fix suggestion selected");
          break;
        default:
          console.log("Unknown suggestion action");
      }
    }
  };

  // Function to dismiss a suggestion
  const handleDismissSuggestion = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the parent div's onClick from firing

    const updatedSuggestions = [...reviewSuggestions];
    updatedSuggestions.splice(index, 1);
    setReviewSuggestions(updatedSuggestions);

    if (selectedSuggestion === index) {
      setSelectedSuggestion(-1);
    } else if (selectedSuggestion > index) {
      setSelectedSuggestion(selectedSuggestion - 1);
    }
  };

  return (
    <div className="p-2">
      {reviewSuggestions.map((suggestion, index) => (
        <div
          key={index}
          className={`p-3 rounded-lg mb-3 border ${selectedSuggestion === index ? "border-blue-500 bg-blue-50" : ""}`}
          onClick={() => setSelectedSuggestion(index)}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <span className="text-sm">
                {suggestion.text === "Check Sentiments" ? "S" : "C"}
              </span>
            </div>
            <div className="text-sm">{suggestion.text}</div>
            <Button
              className="ml-auto"
              variant="ghost"
              size="sm"
              onClick={(e) => e.stopPropagation()} // Prevent triggering the row selection
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          {selectedSuggestion === index && (
            <div className="mt-3">
              <p className="text-sm mt-2">{suggestion.description}</p>
              <div className="flex gap-2 mt-4">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent row selection
                    handleSuggestionAction(suggestion);
                  }}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing && suggestion.text === "Check Sentiments"
                    ? "Analyzing..."
                    : suggestion.text === "Check Sentiments"
                      ? "Analyze"
                      : "Apply to document"}
                </Button>
                <Button
                  variant="outline"
                  className="text-gray-500"
                  onClick={(e) => handleDismissSuggestion(index, e)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {reviewSuggestions.length === 0 && (
        <div className="text-center p-6 text-gray-500">
          <p>No suggestions available.</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() =>
              setReviewSuggestions([
                {
                  text: "Check Sentiments",
                  description:
                    "Check for various sentiment analysis in the document.",
                },
                {
                  text: "Consider rephrasing",
                  description:
                    "This sentence could be clearer with different wording.",
                },
              ])
            }
          >
            Reset Suggestions
          </Button>
        </div>
      )}
    </div>
  );
}
