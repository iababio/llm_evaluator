'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { signOut, openSignIn } = useClerk();
  const { user } = useUser();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(); // Sign out the user
      router.push('/'); // Redirect to the homepage
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSignIn = () => {
    openSignIn();
  };

  return (
    <header className='sticky top-0 z-50 flex border-b border-zinc-200 bg-white'>
      <div className='container mx-auto flex items-center justify-between px-4 py-2'>
        <div className='flex items-center space-x-2'>
          <svg
            width='32'
            height='32'
            viewBox='0 0 32 32'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <rect width='32' height='32' rx='6' fill='black' />
            <path
              d='M17.5 10.5V7.5H7.5V24.5H24.5V10.5H17.5Z'
              stroke='white'
              strokeWidth='1.5'
            />
            <path
              d='M17.5 7.5V10.5H24.5L17.5 7.5Z'
              fill='white'
              stroke='white'
              strokeWidth='1.5'
              strokeLinejoin='round'
            />
          </svg>
          <span className='font-medium'>GenLoRes i/o</span>
        </div>
        <div className='flex items-center space-x-2'>
          {user ? (
            <div className='user-info flex items-center space-x-2'>
              <img
                src={user.hasImage ? user.imageUrl : '/user.png'}
                alt='User Profile'
                className='h-12 w-12 rounded-full'
              />
              <button
                onClick={async () => {
                  await handleSignOut();
                  router.push('/');
                }}
                className='text-sm text-gray-700'
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className='text-sm text-gray-700 hover:underline'
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
