import { useState, useRef, useEffect } from "react";

interface SentimentResult {
  segments: Array<{
    text: string;
    sentiment: string[];
  }>;
}

interface AnalysisProgress {
  percentage: number;
  estimatedTimeRemaining: number; // in seconds
  status: string;
}

export default function useSentimentAnalysis() {
  const [sentimentResults, setSentimentResults] =
    useState<SentimentResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSentimentPanel, setShowSentimentPanel] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);

  // Refs for tracking analysis state
  const analysisCancelRef = useRef<AbortController | null>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const analysisStartTimeRef = useRef<number>(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
      if (analysisCancelRef.current) {
        analysisCancelRef.current.abort();
      }
    };
  }, []);

  // Helper to estimate completion time based on content length
  const estimateCompletionTime = (content: string): number => {
    // Rough estimate: 1 second per 200 characters with a minimum of 3 seconds
    const characters = content.length;
    return Math.max(3, Math.ceil(characters / 200));
  };

  // Function to start progress updates
  const startProgressUpdates = (totalEstimatedTime: number) => {
    let elapsed = 0;
    const updateInterval = 250; // ms

    const updateProgress = () => {
      elapsed += updateInterval / 1000;
      const percentage = Math.min(
        95,
        Math.round((elapsed / totalEstimatedTime) * 100),
      ); // Cap at 95% until complete
      const remaining = Math.max(0, totalEstimatedTime - elapsed);

      setProgress({
        percentage,
        estimatedTimeRemaining: Math.round(remaining),
        status: getStatusMessage(percentage),
      });

      if (elapsed < totalEstimatedTime * 2) {
        // Allow extra time before stopping updates
        analysisTimeoutRef.current = setTimeout(updateProgress, updateInterval);
      }
    };

    // Start updates
    analysisTimeoutRef.current = setTimeout(updateProgress, updateInterval);
  };

  // Function to get status message based on progress
  const getStatusMessage = (percentage: number): string => {
    if (percentage < 10) return "Initializing analysis...";
    if (percentage < 30) return "Processing text segments...";
    if (percentage < 50) return "Identifying emotional tones...";
    if (percentage < 70) return "Extracting sentiment patterns...";
    if (percentage < 90) return "Finalizing analysis...";
    return "Almost complete...";
  };

  // Function to cancel analysis
  const cancelAnalysis = () => {
    if (analysisCancelRef.current) {
      analysisCancelRef.current.abort();
    }

    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    setIsAnalyzing(false);
    setProgress(null);
    return true;
  };

  // Function to analyze sentiments
  const handleAnalyzeSentiments = async (markdownContent?: string) => {
    // If no content is directly provided, take it from the editor
    const contentToAnalyze =
      markdownContent || document.querySelector(".prose")?.textContent || "";

    if (!contentToAnalyze || contentToAnalyze.trim() === "") {
      alert("Please add some content to analyze first");
      return;
    }

    // Cancel any existing analysis
    if (isAnalyzing) {
      cancelAnalysis();
    }

    setIsAnalyzing(true);

    // Create abort controller for fetch API
    analysisCancelRef.current = new AbortController();
    const signal = analysisCancelRef.current.signal;

    // Set up progress tracking
    analysisStartTimeRef.current = Date.now();
    const estimatedTime = estimateCompletionTime(contentToAnalyze);
    setProgress({
      percentage: 0,
      estimatedTimeRemaining: estimatedTime,
      status: "Initializing analysis...",
    });

    // Start progress updates
    startProgressUpdates(estimatedTime);

    try {
      // Add timeout to prevent hanging forever
      const timeoutId = setTimeout(() => {
        if (analysisCancelRef.current) {
          analysisCancelRef.current.abort();
        }
        throw new Error("Request timed out after 60 seconds");
      }, 60000);

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
        signal, // Add abort signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();

      // Complete the progress indicator
      setProgress({
        percentage: 100,
        estimatedTimeRemaining: 0,
        status: "Analysis complete!",
      });

      // Short delay to show completion state
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSentimentResults(data);

      // Show the sentiment panel when results arrive
      setShowSentimentPanel(true);
    } catch (error) {
      // Don't show error for aborted requests
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to analyze sentiment:", error);

        // Create a basic result structure for the error case
        setSentimentResults({
          segments: [
            {
              text: `Sorry, we couldn't analyze the sentiment: ${(error as Error).message}`,
              sentiment: ["neutral"],
            },
          ],
        });

        setShowSentimentPanel(true);
      }
    } finally {
      // Clean up
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }

      setIsAnalyzing(false);
      setProgress(null);
    }
  };

  return {
    sentimentResults,
    setSentimentResults,
    isAnalyzing,
    showSentimentPanel,
    setShowSentimentPanel,
    handleAnalyzeSentiments,
    progress,
    cancelAnalysis,
  };
}
