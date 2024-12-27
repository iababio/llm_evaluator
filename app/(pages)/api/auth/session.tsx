'use client';

import React from 'react';

export default function SignIn() {
  const handleSignIn = () => {
    const redirectUri = 'http://localhost:8000/api/auth/callback'; // Adjust this if needed
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID; // Ensure this is set in your .env.local
    const scope = 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    
    window.location.href = authUrl;
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Sign In</h1>
      <button
        onClick={handleSignIn}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Sign in with Google
      </button>
    </div>
  );
}