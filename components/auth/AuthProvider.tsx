"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { isLoaded: authLoaded, userId, getToken } = useAuth();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const router = useRouter();
  // Add state to track if token update is complete
  const [tokenUpdated, setTokenUpdated] = useState(false);

  // First effect: handle authentication redirect
  useEffect(() => {
    // Only redirect if Clerk has loaded
    if (authLoaded && userLoaded && !isSignedIn) {
      console.log("Not authenticated, redirecting to sign-in");
      router.push("/sign-in");
    }
  }, [authLoaded, userLoaded, isSignedIn, router]);

  // Second effect: handle token storage - separate from first effect
  useEffect(() => {
    // Only run this once when signed in and not yet updated
    if (isSignedIn && !tokenUpdated && getToken) {
      const updateAuthToken = async () => {
        try {
          const token = await getToken();
          if (token) {
            // Store token in sessionStorage for access across the app
            sessionStorage.setItem("auth_token", token);
            console.log("Auth token stored in session storage");
            // Mark as updated so we don't repeatedly set it
            setTokenUpdated(true);
          }
        } catch (error) {
          console.error("Error getting auth token:", error);
        }
      };

      updateAuthToken();
    }
  }, [isSignedIn, tokenUpdated, getToken]);

  // If still loading, show nothing
  if (!authLoaded || !userLoaded) {
    return null;
  }

  // If authenticated, show content
  return <>{children}</>;
}
