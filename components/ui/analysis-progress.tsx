import React from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface AnalysisProgressProps {
  percentage: number;
  estimatedTimeRemaining: number;
  status: string;
  onCancel: () => void;
}

export function AnalysisProgress({
  percentage,
  estimatedTimeRemaining,
  status,
  onCancel,
}: AnalysisProgressProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-lg max-w-md w-full">
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-lg">Analyzing Content</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>{status}</span>
          <span>{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      <div className="text-sm text-gray-500">
        {estimatedTimeRemaining > 0 ? (
          <span>
            Estimated time remaining: {estimatedTimeRemaining}{" "}
            {estimatedTimeRemaining === 1 ? "second" : "seconds"}
          </span>
        ) : (
          <span>Finishing up...</span>
        )}
      </div>
    </div>
  );
}
