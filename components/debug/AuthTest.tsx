"use client";

import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";

export default function AuthTest() {
  // Use state to track if the component has mounted to avoid SSR issues
  const [isMounted, setIsMounted] = useState(false);

  // Use state for results and loading
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Only use useAuth after the component has mounted on the client
  const authData = isMounted ? useAuth() : null;
  const { getToken, isLoaded, isSignedIn } = authData || {
    getToken: null,
    isLoaded: false,
    isSignedIn: false,
  };

  // Set isMounted to true after component mounts
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only show in development
  if (process.env.NODE_ENV === "production") return null;

  // If not mounted yet, show loading state
  if (!isMounted) {
    return (
      <div className="fixed top-5 right-5 z-50 p-4 bg-white border border-gray-200 rounded shadow-lg">
        <p>Loading auth data...</p>
      </div>
    );
  }

  const testAllTokenMethods = async () => {
    if (!getToken) return; // Safety check

    try {
      setLoading(true);
      const testResults: Record<string, any> = {
        timestamp: new Date().toISOString(),
        tests: {},
      };

      // Test 1: Default getToken
      try {
        const token = await getToken();
        testResults.tests.default = {
          success: !!token,
          tokenLength: token ? token.length : 0,
          tokenStart: token ? token.substring(0, 10) + "..." : "none",
        };
      } catch (e) {
        testResults.tests.default = {
          error: e instanceof Error ? e.message : String(e),
        };
      }

      // Test 2-5: Different template names
      const templates = ["default", "api-key", "api_key", "backend"];
      for (const template of templates) {
        try {
          // Use template property as per Clerk's GetTokenOptions type
          const token = await getToken({ template: template });
          testResults.tests[template] = {
            success: !!token,
            tokenLength: token ? token.length : 0,
            tokenStart: token ? token.substring(0, 10) + "..." : "none",
          };
        } catch (e) {
          testResults.tests[template] = {
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      // Test server config
      try {
        const response = await fetch("/api/debug/clerk-config");
        if (response.ok) {
          testResults.serverConfig = await response.json();
        } else {
          testResults.serverConfig = {
            error: `Server returned ${response.status}: ${response.statusText}`,
          };
        }
      } catch (e) {
        testResults.serverConfig = {
          error: e instanceof Error ? e.message : String(e),
        };
      }

      setResults(testResults);
    } catch (e) {
      setResults({
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-5 right-5 z-50 p-4 bg-white border border-gray-200 rounded shadow-lg max-w-lg">
      <h3 className="font-bold text-lg mb-2">Auth Token Tester</h3>

      {/* <div className="mb-3">
        <span className="mr-2">Status:</span>
        {!isLoaded ? (
          <span className="text-yellow-600">Loading...</span>
        ) : isSignedIn ? (
          <span className="text-green-600">Signed In ✓</span>
        ) : (
          <span className="text-red-600">Not Signed In ✗</span>
        )}
      </div> */}

      <button
        onClick={testAllTokenMethods}
        disabled={loading || !isSignedIn || !getToken}
        className={`px-4 py-2 rounded text-white ${
          isSignedIn && !loading && getToken
            ? "bg-blue-500 hover:bg-blue-600"
            : "bg-gray-400 cursor-not-allowed"
        }`}
      >
        {loading ? "Testing..." : "Test All Token Methods"}
      </button>

      {results && (
        <div className="mt-4 overflow-auto max-h-96">
          <h4 className="font-semibold mb-1">Results:</h4>
          <pre className="text-xs bg-gray-100 p-2 rounded">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
