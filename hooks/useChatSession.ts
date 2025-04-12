import { useState, useCallback, useRef } from "react";
import { Message } from "ai/react";

interface ChatSessionState {
  sessionId: string | null;
  lastSavedMessageCount: number;
  hasUnsavedChanges: boolean;
  pendingSave: boolean;
}

/**
 * Hook to track chat session state and prevent multiple redundant saves
 */
export default function useChatSession() {
  // Track the current session state
  const [sessionState, setSessionState] = useState<ChatSessionState>({
    sessionId: null,
    lastSavedMessageCount: 0,
    hasUnsavedChanges: false,
    pendingSave: false,
  });

  // Keep track of save attempts for the current session
  const saveAttemptsRef = useRef<{ [key: string]: number }>({});

  /**
   * Generate or reset the session ID when starting a new chat
   */
  const startNewSession = useCallback(() => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    setSessionState({
      sessionId: newSessionId,
      lastSavedMessageCount: 0,
      hasUnsavedChanges: false,
      pendingSave: false,
    });

    console.log(`Started new chat session: ${newSessionId}`);
    return newSessionId;
  }, []);

  /**
   * Track when messages are added to the conversation
   */
  const trackMessageAdded = useCallback((messages: Message[]) => {
    setSessionState((prev) => ({
      ...prev,
      hasUnsavedChanges: messages.length > prev.lastSavedMessageCount,
    }));
  }, []);

  /**
   * Check if a session should be saved based on current state
   */
  const shouldSaveSession = useCallback(
    (messages: Message[]): boolean => {
      // Don't save if there's a save in progress
      if (sessionState.pendingSave) {
        console.log("Save already in progress, not saving again");
        return false;
      }

      // Don't save if there are no changes
      if (messages.length <= sessionState.lastSavedMessageCount) {
        console.log("No new messages to save");
        return false;
      }

      // Check if we have both user and assistant messages
      const hasUserMessage = messages.some((m) => m.role === "user");
      const hasAssistantMessage = messages.some((m) => m.role === "assistant");

      if (!hasUserMessage || !hasAssistantMessage) {
        console.log("Missing user or assistant messages, not saving");
        return false;
      }

      // Check if we've tried to save this exact count of messages recently
      const key = `${sessionState.sessionId}_${messages.length}`;
      const now = Date.now();
      const lastAttempt = saveAttemptsRef.current[key] || 0;

      if (lastAttempt > 0 && now - lastAttempt < 10000) {
        // 10 seconds
        console.log(
          `Attempted to save this message count recently (${messages.length}), skipping`,
        );
        return false;
      }

      // Record this save attempt
      saveAttemptsRef.current[key] = now;

      return true;
    },
    [sessionState],
  );

  /**
   * Mark the current session as saving
   */
  const markSessionSaving = useCallback(() => {
    setSessionState((prev) => ({
      ...prev,
      pendingSave: true,
    }));
  }, []);

  /**
   * Mark the current session as saved
   */
  const markSessionSaved = useCallback((messageCount: number) => {
    setSessionState((prev) => ({
      ...prev,
      lastSavedMessageCount: messageCount,
      hasUnsavedChanges: false,
      pendingSave: false,
    }));
  }, []);

  /**
   * Handle save failure
   */
  const markSaveFailed = useCallback(() => {
    setSessionState((prev) => ({
      ...prev,
      pendingSave: false,
    }));
  }, []);

  /**
   * Load an existing session
   */
  const loadSession = useCallback((sessionId: string, messageCount: number) => {
    setSessionState({
      sessionId,
      lastSavedMessageCount: messageCount,
      hasUnsavedChanges: false,
      pendingSave: false,
    });

    console.log(
      `Loaded existing session: ${sessionId} with ${messageCount} messages`,
    );
  }, []);

  return {
    sessionId: sessionState.sessionId,
    hasUnsavedChanges: sessionState.hasUnsavedChanges,
    pendingSave: sessionState.pendingSave,
    startNewSession,
    trackMessageAdded,
    shouldSaveSession,
    markSessionSaving,
    markSessionSaved,
    markSaveFailed,
    loadSession,
  };
}
