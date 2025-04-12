import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * Hook to synchronize Clerk user data with our backend database
 */
export const useUserSync = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only sync if the user is signed in and Clerk has loaded
    if (isLoaded && isSignedIn && user) {
      const syncUserWithDatabase = async () => {
        try {
          setIsSyncing(true);
          setError(null);

          // Prepare user data from Clerk
          const userData = {
            clerk_id: user.id,
            email: user.primaryEmailAddress?.emailAddress || "",
            username: user.username || undefined,
            first_name: user.firstName || undefined,
            last_name: user.lastName || undefined,
            image_url: user.imageUrl || undefined,
          };

          // Send user data to our API
          const response = await fetch("/api/users/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // In a real application, you might want to include authentication
              // "Authorization": `Bearer ${await user.getToken()}`
            },
            body: JSON.stringify(userData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to sync user data");
          }

          // User successfully synced
          console.log("User data synchronized with database");
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "An unknown error occurred",
          );
          console.error("Error syncing user:", err);
        } finally {
          setIsSyncing(false);
        }
      };

      syncUserWithDatabase();
    }
  }, [isLoaded, isSignedIn, user]);

  return { isSyncing, error };
};
