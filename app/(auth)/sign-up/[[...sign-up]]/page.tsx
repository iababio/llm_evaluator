'use client';

import { SignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function SignUpPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  // If the user is already signed in, redirect to the chat page
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/chat');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left side - Branding & App Info */}
      <div className="bg-blue-600 md:w-1/2 p-8 flex flex-col justify-center items-center text-white">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">LLM Evaluation Platform</h1>
          <p className="text-xl mb-8">
            Create an account to start analyzing your content with AI.
          </p>
          <div className="bg-white/10 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">What you&apos;ll get</h2>
            <ul className="space-y-3">
              <li className="flex items-start">
                <svg className="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>AI-powered content evaluation</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Document history and cloud storage</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Personalized improvement suggestions</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right side - Sign Up Component */}
      <div className="md:w-1/2 p-8 flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md">
          <SignUp 
            appearance={{
              elements: {
                card: 'shadow-none',
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                footerActionLink: 'text-blue-600 hover:text-blue-800'
              }
            }}
            redirectUrl="/chat"
          />
        </div>
      </div>
    </div>
  );
}