"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { sentimentColors, sentimentTextColors } from "@/utils/sentimentColors";
import PieChart from "@/components/charts/PieChart";
import BarChart from "@/components/charts/BarChart";
import CirclePack from "@/components/charts/CirclePack";
import SunburstChart from "@/components/charts/SunburstChart";
import {
  formatSentimentForCirclePack,
  formatSentimentForSunburst,
} from "@/utils/chartFormatters";

interface SentimentSegment {
  text: string;
  sentiment: string[];
}

interface SentimentResult {
  segments: SentimentSegment[];
}

interface SentimentPanelProps {
  sentimentResults: SentimentResult | null;
}

export default function SentimentPanel({
  sentimentResults,
}: SentimentPanelProps) {
  const [expandedSegments, setExpandedSegments] = useState<
    Record<number, boolean>
  >({});
  const [chartType, setChartType] = useState<
    "pie" | "bar" | "circle" | "sunburst"
  >("sunburst");

  const toggleSegment = (index: number) => {
    setExpandedSegments((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const preparePieChartData = () => {
    if (!sentimentResults) return [];

    const sentimentCounts: Record<string, number> = {};

    sentimentResults.segments.forEach((segment) => {
      segment.sentiment.forEach((sentiment) => {
        const cleanSentiment = sentiment.trim().toLowerCase();
        sentimentCounts[cleanSentiment] =
          (sentimentCounts[cleanSentiment] || 0) + 1;
      });
    });

    return Object.entries(sentimentCounts).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const prepareBarChartData = () => {
    if (!sentimentResults) return [];

    return sentimentResults.segments.map((segment, index) => ({
      id: index,
      text:
        segment.text.substring(0, 30) + (segment.text.length > 30 ? "..." : ""),
      length: segment.text.length,
      width: segment.text.length,
      sentiments: segment.sentiment.join(", "),
    }));
  };

  const prepareCirclePackData = () => {
    return formatSentimentForCirclePack(sentimentResults);
  };

  const prepareSunburstData = () => {
    return formatSentimentForSunburst(sentimentResults);
  };

  if (!sentimentResults) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">
          No sentiment analysis results available.
        </p>
      </div>
    );
  }

  // Get sidebar width to properly size charts
  const sidebarWidth =
    typeof window !== "undefined"
      ? Math.min(window.innerWidth * 0.95, 460)
      : 400;

  // Calculate proportional height based on width (maintaining aspect ratio)
  const chartWidth = sidebarWidth - 40; // Account for padding
  const chartHeight = chartWidth; // 1:1 aspect ratio for most charts

  return (
    <div className="p-4">
      {/* Chart Type Selector */}
      <div className="mb-4 flex justify-center">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            className={`px-3 py-2 text-xs font-medium border ${chartType === "pie" ? "bg-blue-600 text-white" : "bg-white text-gray-700"} rounded-l-lg`}
            onClick={() => setChartType("pie")}
          >
            Pie
          </button>
          <button
            className={`px-3 py-2 text-xs font-medium border-t border-b border-r ${chartType === "bar" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            onClick={() => setChartType("bar")}
          >
            Bar
          </button>
          <button
            className={`px-3 py-2 text-xs font-medium border-t border-b border-r ${chartType === "circle" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            onClick={() => setChartType("circle")}
          >
            Circle
          </button>
          <button
            className={`px-3 py-2 text-xs font-medium border-t border-b border-r ${chartType === "sunburst" ? "bg-blue-600 text-white" : "bg-white text-gray-700"} rounded-r-lg`}
            onClick={() => setChartType("sunburst")}
          >
            Sunburst
          </button>
        </div>
      </div>

      {/* Charts container that fits within sidebar */}
      <div className="mb-6 w-full flex justify-center">
        <div
          className="chart-container"
          style={{ width: `${chartWidth}px`, height: `${chartHeight}px` }}
        >
          {chartType === "pie" && (
            <PieChart
              data={preparePieChartData()}
              sentimentColors={sentimentColors}
              width={chartWidth}
              height={chartHeight}
            />
          )}
          {chartType === "bar" && (
            <BarChart data={prepareBarChartData()} width={chartWidth} />
          )}
          {chartType === "circle" && (
            <CirclePack
              data={prepareCirclePackData()}
              width={chartWidth}
              height={chartHeight}
            />
          )}
          {chartType === "sunburst" && (
            <SunburstChart
              data={prepareSunburstData()}
              width={chartWidth}
              height={chartHeight}
              maxDepth={2}
            />
          )}
        </div>
      </div>

      {/* Segment List */}
      <h3 className="text-lg font-medium mb-4">Text Segments Analysis</h3>
      <div className="space-y-4">
        {sentimentResults.segments.map((segment, index) => (
          <div key={index} className="border rounded-md overflow-hidden">
            <div
              className="flex items-start gap-2 p-3 cursor-pointer bg-gray-50 hover:bg-gray-100"
              onClick={() => toggleSegment(index)}
            >
              <div className="mt-1">
                {expandedSegments[index] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium line-clamp-2">
                  {segment.text.substring(0, 100)}
                  {segment.text.length > 100 ? "..." : ""}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {segment.sentiment.map((sentiment, i) => {
                    const lowerSentiment = sentiment.toLowerCase();
                    return (
                      <span
                        key={i}
                        className={`text-xs px-2 py-1 rounded-full ${sentimentColors[lowerSentiment] || "bg-gray-100"} ${sentimentTextColors[lowerSentiment] || "text-gray-800"}`}
                      >
                        {sentiment}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {expandedSegments[index] && (
              <div className="p-3 border-t bg-white">
                <p className="text-sm">{segment.text}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
