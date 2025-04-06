import React from "react";

interface LoadingOverlayProps {
  message?: string;
}

export default function LoadingOverlay({
  message = "Loading...",
}: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-4">
        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <p>{message}</p>
      </div>
    </div>
  );
}
