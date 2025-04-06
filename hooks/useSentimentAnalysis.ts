import { useState } from "react";

interface SentimentResult {
  segments: Array<{
    text: string;
    sentiment: string[];
  }>;
}

export default function useSentimentAnalysis() {
  const [sentimentResults, setSentimentResults] =
    useState<SentimentResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSentimentPanel, setShowSentimentPanel] = useState(false);

  // Function to analyze sentiments
  const handleAnalyzeSentiments = async (markdownContent?: string) => {
    // If no content is directly provided, take it from the editor (added in main page)
    const contentToAnalyze =
      markdownContent || document.querySelector(".prose")?.textContent || "";

    if (!contentToAnalyze || contentToAnalyze.trim() === "") {
      alert("Please add some content to analyze first");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/sentiment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: contentToAnalyze,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setSentimentResults(data);

      // Show the sentiment panel when results arrive
      setShowSentimentPanel(true);
    } catch (error) {
      console.error("Failed to analyze sentiment:", error);
      alert("Error analyzing sentiments. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    sentimentResults,
    setSentimentResults,
    isAnalyzing,
    showSentimentPanel,
    setShowSentimentPanel,
    handleAnalyzeSentiments,
  };
}
