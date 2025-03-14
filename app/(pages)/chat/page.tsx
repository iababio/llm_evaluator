'use client';

import React from 'react';
// import ReactMarkdown from 'react-markdown';
import {
  PencilIcon,
  FileText,
  CodeIcon,
  LightbulbIcon,
  SparklesIcon,
  MoreHorizontal,
  ArrowUpIcon,
  View,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from 'ai/react';
import { CodeBlock } from '@/components/Markdown/CodeBlock';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';

export default function AuthComponent() {
  const { messages, input, handleSubmit, handleInputChange, isLoading } =
    useChat({
      api: '/api/chat?protocol=text',
      streamProtocol: 'text',
    });

  return (
    <div className='flex min-h-[90vh] flex-col bg-white'>
      {/* Main Content */}
      <main className='relative flex flex-1 flex-col px-4'>
        {/* Messages Display */}
        <div className='flex flex-1 flex-col items-center justify-center py-4'>
          <div className='w-[35%] space-y-4'>
            {messages.map(
              (message: { id: string; role: string; content: string }) => (
                <div key={message.id} className='mb-4'>
                  <div className='capitalize text-zinc-500'>
                    <strong>{message.role}:</strong>
                  </div>
                  <div className='mt-2 rounded-lg p-4'>
                    {/* Render message content with Markdown */}
                    <MemoizedReactMarkdown
                      className='prose prose-zinc'
                      components={{
                        code: ({
                          node,
                          inline,
                          className,
                          children,
                          ...props
                        }: any) => {
                          const language = className?.replace('language-', '');
                          return inline ? (
                            <code {...props} className={className}>
                              {children}
                            </code>
                          ) : (
                            <CodeBlock
                              language={language || 'text'}
                              value={String(children).replace(/\n$/, '')}
                            />
                          );
                        },
                      }}
                    >
                      {message.content}
                    </MemoizedReactMarkdown>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Empty State */}
        {messages.length === 0 && (
          <div className='flex flex-1 flex-col items-center justify-center space-y-6'>
            <h1 className='text-center text-4xl font-semibold'>
              What can I help with?
            </h1>

            {/* Quick Actions */}
            <div className='flex flex-wrap justify-center gap-2'>
              <Button
                variant='outline'
                className='flex items-center gap-2 rounded-full px-4 py-2'
              >
                <PencilIcon className='h-4 w-4' />
                Help me write
              </Button>
              <Button
                variant='outline'
                className='flex items-center gap-2 rounded-full px-4 py-2'
              >
                <FileText className='h-4 w-4' />
                Summarize text
              </Button>
              <Button
                variant='outline'
                className='flex items-center gap-2 rounded-full px-4 py-2'
              >
                <CodeIcon className='h-4 w-4' />
                Code
              </Button>
              <Button
                variant='outline'
                className='flex items-center gap-2 rounded-full px-4 py-2'
              >
                <LightbulbIcon className='h-4 w-4' />
                Brainstorm
              </Button>
              <Button
                variant='outline'
                className='flex items-center gap-2 rounded-full px-4 py-2'
              >
                <SparklesIcon className='h-4 w-4' />
                Surprise me
              </Button>
              <Button
                variant='outline'
                className='flex items-center gap-2 rounded-full px-4 py-2'
              >
                <MoreHorizontal className='h-4 w-4' />
                More
              </Button>
            </div>

            {/* Terms */}
            <p className='text-center text-sm text-gray-600'>
              By messaging GenLoRes, you agree to our{' '}
              <a href='#' className='underline'>
                Terms
              </a>{' '}
              and have read our{' '}
              <a href='#' className='underline'>
                Privacy Policy
              </a>
              .
            </p>
          </div>
        )}

        {/* Chat Input Form */}
        <form
          onSubmit={handleSubmit}
          className='sticky bottom-0 border-t bg-white py-4'
        >
          <div className='relative mx-auto max-w-3xl'>
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder='Message GenLoRes'
              className='w-full rounded-full border bg-gray-100 p-4 pr-12 outline-none'
              disabled={isLoading}
            />
            <Button
              type='submit'
              className='absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-gray-200 p-2'
              size='icon'
              disabled={isLoading}
            >
              <ArrowUpIcon className='h-5 w-5 text-gray-600' />
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
