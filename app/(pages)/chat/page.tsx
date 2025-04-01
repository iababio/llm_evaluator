'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  PencilIcon,
  FileText,
  Code as CodeIcon,
  LightbulbIcon,
  SparklesIcon,
  MoreHorizontal,
  ArrowUpIcon,
  Check,
  X,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat, useCompletion } from 'ai/react';
// import MarkdownDisplay from '@/components/markdown/markdown-display';
import EditableMarkdown from '@/components/markdown/editable-markdown';

export default function AuthComponent() {
  // State for document and review
  const [documentTitle, setDocumentTitle] = useState('Untitled document');
  const [overallScore, setOverallScore] = useState(86);
  const [activeTab, setActiveTab] = useState('suggestions');
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  
  // Define categories for the sidebar
  const categories = [
    { name: 'Clarity', color: 'bg-blue-500' },
    { name: 'Flow', color: 'bg-green-500' },
    { name: 'Grammar', color: 'bg-yellow-500' },
    { name: 'Style', color: 'bg-purple-500' },
  ];
  
  // Define review suggestions
  const reviewSuggestions = [
    {
      text: 'Consider rephrasing',
      description: 'This sentence could be clearer with different wording.'
    },
    {
      text: 'Add more detail',
      description: 'This section would benefit from additional information.'
    },
    {
      text: 'Fix grammatical error',
      description: 'There appears to be a subject-verb agreement issue here.'
    }
  ];
  
  // Rest of your state declarations...

  const contentEditableRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Add useCompletion hook for document editing
  const { 
    completion, 
    complete, 
    isLoading: isCompletionLoading,
    error: completionError
  } = useCompletion({
    api: '/api/completion',
    onResponse: (response) => {
      console.log('AI response started:', response);
      // Clear existing content when a new stream starts
      setMarkdownContent('Loading...');
    },
    onFinish: (completion) => {
      console.log('AI completion finished:', completion);
      // Set the markdown content directly
      setMarkdownContent(completion);
      
      // Also append to messages for consistency with the chat approach
      append({
        role: 'assistant',
        content: completion,
      });
      
      // Calculate word count
      updateWordCount(completion);
    },
    onError: (error) => {
      console.error('AI completion error:', error);
      setMarkdownContent(prev => prev + "\n\nError connecting to AI service. Please check your backend server.");
    }
  });

  // Custom hook for real-time streaming update to the editor
  useEffect(() => {
    if (completion) {
      setMarkdownContent(completion);
      updateWordCount(completion);
    }
  }, [completion]);

  // Update useChat configuration
  const { 
    messages, 
    input, 
    handleSubmit: handleChatSubmit, 
    handleInputChange, 
    isLoading: isChatLoading,
    error: chatError,
    append 
  } = useChat({
    api: '/api/chat?protocol=text',
    streamProtocol: 'text',
    initialMessages: [
      {
        id: 'initial',
        role: 'assistant',
        content: 'Microsoft Word is a word processing software developed by Microsoft. It\'s part of the Microsoft Office suite and is widely used for creating, editing, and formatting text documents.',
      }
    ],
    onFinish: (message) => {
      // When chat completes, update the markdown content
      setMarkdownContent(message.content);
      updateWordCount(message.content);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      setMarkdownContent(prev => 
        prev + "\n\nError connecting to chat service. Please check your backend server."
      );
    }
  });

  // Update word count function
  const updateWordCount = (text: string) => {
    const words = text ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
  };
  
  // Initialize content from messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastAssistantMessage = [...messages]
        .filter(m => m.role === 'assistant')
        .pop();
      
      if (lastAssistantMessage) {
        setMarkdownContent(lastAssistantMessage.content);
        updateWordCount(lastAssistantMessage.content);
      }
    }
  }, [messages]);

  // Toggle between edit and preview modes
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    if (isEditing && textareaRef.current) {
      // Switching from edit to preview
      setMarkdownContent(textareaRef.current.value);
      updateWordCount(textareaRef.current.value);
      
      // Update the messages as well
      append({
        role: 'assistant',
        content: textareaRef.current.value,
      });
    }
  };

  // Function to handle suggestion actions
  const handleSuggestionAction = (suggestion: { type?: string; text: any; description: any; }) => {
    console.log('Processing suggestion:', suggestion);
    
    // Show loading state
    setMarkdownContent('Applying suggestion...');
    
    // Apply the suggestion by prompting AI to improve the content
    complete(`Improve this text based on the following suggestion: "${suggestion.text}". 
    The text to improve is: "${suggestion.description}".
    Only return the improved version.`);
  };

  // Function to check for plagiarism and AI text
  const checkPlagiarism = () => {
    console.log('Checking for plagiarism...');
    
    // Show loading state
    setMarkdownContent('Analyzing content for plagiarism...');
    
    // Here you would normally call an API
    complete(`Analyze the following text for potential plagiarism or AI-generated content: 
    "${markdownContent}"`);
  };

  // Function to handle form submission with fallback
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // If the input appears to be a document editing command
      if (input.toLowerCase().includes('write') || 
          input.toLowerCase().includes('edit') || 
          input.toLowerCase().includes('create')) {
        console.log('Document editing command detected:', input);
        
        // Show loading state
        setMarkdownContent('Processing your request...');
        
        // Generate content with the completion API
        complete(input);
      } else {
        // Otherwise use the chat API
        handleChatSubmit(e as any);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setMarkdownContent(prev => prev + "\n\nBackend service unavailable. Please check your server connection.");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-70px)]">
      {/* Header section */}
      <header className="flex items-center p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full">
            <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center text-white">G</div>
          </Button>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-1 flex justify-center">
          <Input 
            value={documentTitle} 
            onChange={(e) => setDocumentTitle(e.target.value)}
            className="w-64 border-none text-center focus-visible:ring-0" 
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1 rounded-lg">
            <span className="text-sm">Goals</span>
          </Button>
          
          <Button variant="outline" className="gap-1 rounded-lg">
            <span className="text-sm">{overallScore} Overall score</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Document Area */}
        <main className="flex-1 overflow-hidden flex flex-col">
          <div className="max-w-3xl mx-auto p-6 w-full flex flex-col flex-1 overflow-hidden">
            {/* Formatting Toolbar - Sticky */}
            <div className="flex items-center gap-4 py-2 border-b mb-4 bg-white z-10 shrink-0">
              <Button variant="ghost" size="icon" onClick={toggleEditMode}>
                <PencilIcon className="h-4 w-4" />
                <span className="sr-only">{isEditing ? 'Preview' : 'Edit'}</span>
              </Button>
              <Button variant="ghost" size="icon">
                <span className="font-bold">B</span>
              </Button>
              <Button variant="ghost" size="icon">
                <span className="italic">I</span>
              </Button>
              <Button variant="ghost" size="icon">
                <span className="underline">U</span>
              </Button>
              <div className="w-px h-6 bg-gray-300"></div>
              <Button variant="ghost" size="sm">
                <span>H1</span>
              </Button>
              <Button variant="ghost" size="sm">
                <span>H2</span>
              </Button>
              <div className="w-px h-6 bg-gray-300"></div>
              <Button variant="ghost" size="icon">
                <FileText className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-300"></div>
              <Button variant="ghost" size="icon">
                <div className="flex items-center">
                  <span>•</span>
                </div>
              </Button>
              <Button variant="ghost" size="icon">
                <div className="flex items-center">
                  <span>1.</span>
                </div>
              </Button>
              <div className="flex-1"></div>
              <div className="text-gray-500 text-sm">{wordCount} words</div>
            </div>
            
            {/* Document Content - Enhanced editable markdown preview */}
            {isEditing ? (
              <textarea
                ref={textareaRef}
                className="flex-1 overflow-y-auto p-4 focus:outline-none resize-none font-mono text-sm"
                defaultValue={markdownContent}
              />
            ) : (
              <div className="flex-1 overflow-y-auto">
                <EditableMarkdown 
                  content={markdownContent}
                  onChange={(newContent) => {
                    setMarkdownContent(newContent);
                    updateWordCount(newContent);
                  }}
                  onBlur={() => {
                    // When user finishes editing, append to message history
                    append({
                      role: 'assistant',
                      content: markdownContent,
                    });
                  }}
                />
              </div>
            )}
            
            {/* Loading indicator */}
            {(isCompletionLoading || isChatLoading) && (
              <div className="fixed bottom-20 right-4 bg-white shadow-lg rounded-full p-3">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}

            {/* Error indicator */}
            {(completionError || chatError) && (
              <div className="fixed bottom-20 right-20 bg-red-50 shadow-lg rounded-lg p-3 text-red-600 border border-red-200">
                <div className="flex items-center gap-2">
                  <X className="h-5 w-5" />
                  <span>Connection error. Check server status.</span>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right sidebar with review suggestions */}
        <aside className="w-[350px] border-l flex flex-col shrink-0 overflow-hidden">
          {/* Review header - Not scrollable */}
          <div className="p-4 border-b shrink-0">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Review suggestions</span>
                </div>
                <Button variant="ghost" size="icon">
                  <span className="text-gray-500 bg-gray-200 rounded-full w-5 h-5 text-xs flex items-center justify-center">?</span>
                </Button>
              </div>
              
              {/* Category Tabs */}
              <div className="flex gap-1 mt-4">
                {categories.map((category, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <Button 
                      variant="ghost" 
                      className="h-1 w-full rounded-none p-0"
                    >
                      <div className={`h-1 w-full ${category.color} rounded`}></div>
                    </Button>
                    <span className="text-xs mt-1">{category.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Suggestions List - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {reviewSuggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg mb-3 border ${selectedSuggestion === index ? 'border-blue-500 bg-blue-50' : ''}`}
                  onClick={() => setSelectedSuggestion(index)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <span className="text-sm">C</span>
                    </div>
                    <div className="text-sm">{suggestion.text}</div>
                    <Button className="ml-auto" variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {selectedSuggestion === index && (
                    <div className="mt-3">
                      <p className="text-sm mt-2">{suggestion.description}</p>
                      <div className="flex gap-2 mt-4">
                        <Button 
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleSuggestionAction(suggestion)}
                          disabled={isCompletionLoading}
                        >
                          {isCompletionLoading ? 'Processing...' : suggestion.text}
                        </Button>
                        <Button variant="outline">
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action - Not scrollable */}
          <div className="p-4 border-t shrink-0">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={checkPlagiarism}
            >
              Check for plagiarism and AI text
            </Button>
          </div>
        </aside>
      </div>
    
      {/* Chat input form */}
      <form
        onSubmit={handleSubmit}
        className="border-t bg-white py-4 shrink-0"
      >
        <div className="relative mx-auto max-w-3xl">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Message GenLoRes"
            className="w-full rounded-full border bg-gray-100 p-4 pr-12 outline-none"
            disabled={isChatLoading || isCompletionLoading}
          />
          <Button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-gray-200 p-2"
            size="icon"
            disabled={isChatLoading || isCompletionLoading}
          >
            <ArrowUpIcon className="h-5 w-5 text-gray-600" />
          </Button>
        </div>
      </form>
    </div>
  );
}