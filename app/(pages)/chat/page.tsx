'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  PencilIcon,
  FileText,
  SparklesIcon,
  MoreHorizontal,
  ArrowUpIcon,
  Check,
  X,
  MoreVertical,
  Menu,
  Plus,
  Trash2,
  ChevronRight,
  Clock,
  Search,
  ChevronLeft,
  LogOut,
  User as UserIcon,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat, useCompletion } from 'ai/react';
import EditableMarkdown from '@/components/markdown/editable-markdown';
import { useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function AuthComponent() {
  // Add authentication check
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const { signOut, openSignIn } = useClerk();

  // ALL state declarations must be BEFORE any conditional logic
  // State for document and review
  const [documentTitle, setDocumentTitle] = useState('Untitled document');
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showSidebarDesktop, setShowSidebarDesktop] = useState(true);
  const [previousChats, setPreviousChats] = useState<Array<{
    id: string;
    title: string;
    date: string;
    preview: string;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState('1');
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  // Refs
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Define categories for the sidebar
  const categories = [
    { name: 'Peace', color: 'bg-blue-500' },
    { name: 'Joy', color: 'bg-green-500' },
    { name: 'Sexism', color: 'bg-yellow-500' },
    { name: 'love', color: 'bg-purple-500' },
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
        content: 'Welcome to your AI-powered platform, where you can chat, analyze, and gain insights from your documents using this intelligent assistant. Simply type your message below to get started! Whether you need help reviewing text, answering questions, or exploring new ideas, our assistant is here to assist you smoothly and efficiently.',
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

  // Redirect if not authenticated - AFTER declaring all hooks
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

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

  // Custom hook for real-time streaming update to the editor
  useEffect(() => {
    if (completion) {
      setMarkdownContent(completion);
      updateWordCount(completion);
    }
  }, [completion]);

  // Add resize effect
  useEffect(() => {
    const handleResize = () => {
      // If we're on mobile (< 768px) and sidebar was showing, hide it
      if (window.innerWidth < 768) {
        setShowLeftSidebar(false);
      }
    };

    // Listen for window resize
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Toggle between edit and preview modes - prevent automatic API calls
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    if (isEditing && textareaRef.current) {
      // Switching from edit to preview
      const newContent = textareaRef.current.value;
      
      // Only update state if content actually changed
      if (newContent !== markdownContent) {
        setMarkdownContent(newContent);
        updateWordCount(newContent);
      }
    }
  };

  // Function to handle suggestion actions
  const handleSuggestionAction = (suggestion: { type?: string; text: any; description: any; }) => {
    console.log('Processing suggestion:', suggestion);
    
    // Show loading state
    setMarkdownContent('Applying suggestion...');
    
    // Get the current document content to provide context
    const currentContent = markdownContent;
    
    // Apply the suggestion by prompting AI to improve the content
    complete(`Improve this document based on the following suggestion: "${suggestion.text}". 
    The suggestion specifically means: "${suggestion.description}".
    
    Here is the current document content:
    ${currentContent}
    
    Please provide an improved version of the entire document that addresses the suggestion.
    Only return the improved document content without additional commentary.`);
  };

  // Function to check for plagiarism and AI text
  const checkPlagiarism = () => {
    console.log('Checking for plagiarism...');
    
    // Show loading state
    setMarkdownContent('Analyzing content for plagiarism...');
    
    // Get the current document content
    const currentContent = markdownContent;
    
    // Here you would normally call an API
    complete(`Analyze the following document for potential plagiarism or AI-generated content: 
    
${currentContent}

Please provide a detailed analysis that includes:
1. Sections that may be plagiarized (if any)
2. Indicators of AI-generated content (if any)
3. Overall originality assessment
4. Recommendations for improving authenticity`);
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

  // Filter chats by search query
  const filteredChats = previousChats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    chat.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add this function to handle changing the active chat
  const handleChatChange = (chatId: string) => {
    setSelectedChatId(chatId);
    // In a real app, you'd fetch the content of the selected chat
    const selectedChat = previousChats.find(chat => chat.id === chatId);
    if (selectedChat) {
      setDocumentTitle(selectedChat.title);
      setMarkdownContent(`# ${selectedChat.title}\n\n${selectedChat.preview}\n\nThis is placeholder content. In a real application, the actual content of the selected chat would be loaded here.`);
    }
    
    // On mobile, close the sidebar after selecting a chat
    if (window.innerWidth < 768) {
      setShowLeftSidebar(false);
    }
  };

  // Add this function to create a new chat
  const handleNewChat = () => {
    const newChatId = String(previousChats.length + 1);
    const newChat = {
      id: newChatId,
      title: 'New Document',
      date: 'Just now',
      preview: 'Start typing to create your document...'
    };
    
    setPreviousChats([newChat, ...previousChats]);
    setSelectedChatId(newChatId);
    setDocumentTitle('New Document');
    setMarkdownContent('');
    
    // On mobile, close the sidebar after creating a new chat
    if (window.innerWidth < 768) {
      setShowLeftSidebar(false);
    }
  };

  // Add this function to delete a chat
  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setPreviousChats(previousChats.filter(chat => chat.id !== chatId));
    
    // If the deleted chat was selected, select the first chat
    if (chatId === selectedChatId && previousChats.length > 1) {
      const firstRemainingChat = previousChats.find(chat => chat.id !== chatId);
      if (firstRemainingChat) {
        setSelectedChatId(firstRemainingChat.id);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(); 
      router.push('/sign-in'); // Redirect to sign-in page after signing out
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSignIn = () => {
    openSignIn();
  };

  // If still loading authentication or not signed in, show loading
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-blue-600 mb-4"></div>
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Only render the main UI if user is authenticated
  return (
    <div className="flex flex-col h-[calc(100vh)] px-5">
      {/* Header section with added menu button for mobile */}
      <header className="flex items-center p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          >
            <Menu className="h-5 w-5" />
          </Button>
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
            <span className="text-sm">Stats</span>
          </Button>
          
          {/* <Button variant="outline" className="gap-1 rounded-lg">
            <span className="text-sm">{overallScore} Overall score</span>
          </Button> */}
           <div className='flex items-center space-x-2'>
          {user ? (
            <div className='user-info flex items-center space-x-2 relative'>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 outline-none rounded-full focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500">
                    <Image
                      src={user.hasImage ? user.imageUrl : '/user.png'}
                      alt='User Profile'
                      width={40}
                      height={40}
                      className='h-10 w-10 rounded-full object-cover border border-gray-200'
                    />
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.fullName || 'User'}</span>
                      <span className="text-xs text-gray-500 truncate">{user.primaryEmailAddress?.emailAddress}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer text-red-600 focus:text-red-600" 
                    onClick={async () => {
                      await handleSignOut();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className='text-sm px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors'
            >
              Sign In
            </button>
          )}
        </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar for Previous Chats - Conditionally shown on mobile */}
        <aside 
          className={`
            ${showLeftSidebar ? 'translate-x-0' : '-translate-x-full'} 
            md:translate-x-0
            w-64 
            ${showSidebarDesktop ? 'md:w-64' : 'md:w-0 md:opacity-0 md:invisible md:pointer-events-none'} 
            absolute md:relative z-20 md:z-0 border-r bg-white h-full 
            transition-all duration-300 ease-in-out flex flex-col
          `}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b flex justify-between items-center shrink-0">
            <h2 className="font-medium">Documents</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={handleNewChat}>
                <Plus className="h-4 w-4" />
              </Button>
              
              {/* Add collapse button - only visible on desktop */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="hidden md:flex" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSidebarDesktop(false);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Search Box */}
          <div className="p-2 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                placeholder="Search documents"
              />
            </div>
          </div>
          
          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No documents found
              </div>
            ) : (
              filteredChats.map(chat => (
                <div 
                  key={chat.id}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                    selectedChatId === chat.id ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => handleChatChange(chat.id)}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-sm line-clamp-1">{chat.title}</h3>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                    >
                      <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {chat.date}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{chat.preview}</p>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Add toggle button for collapsed sidebar with improved positioning */}
        {!showSidebarDesktop && (
          <button 
            className="hidden md:flex h-full border-r bg-white items-center px-1 hover:bg-gray-50"
            onClick={() => setShowSidebarDesktop(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Mobile Overlay */}
        {showLeftSidebar && (
          <div 
            className="md:hidden fixed inset-0 bg-black bg-opacity-20 z-10"
            onClick={() => setShowLeftSidebar(false)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Document Area */}
          <main className={`flex-1 overflow-hidden flex flex-col ${!showRightSidebar ? 'pr-0' : ''}`}>
            <div className="max-w-3xl mx-auto p-6 w-full flex flex-col flex-1 overflow-hidden">
              {/* Formatting Toolbar - Add sidebar toggle button */}
              <div className="flex items-center gap-4 py-2 border-b mb-4 bg-white z-10 shrink-0">
                {/* Mobile menu button */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden"
                  onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                
                {/* Desktop sidebar toggle button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSidebarDesktop(!showSidebarDesktop);
                  }}
                >
                  {showSidebarDesktop ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                
                {/* Rest of toolbar buttons */}
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
                <div className="relative group">
                  <Button variant="ghost" size="icon">
                    <SparklesIcon className="h-4 w-4 text-blue-500" />
                  </Button>
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded p-2 w-48">
                    AI feedback is automatically requested when you make significant edits to the document.
                  </div>
                </div>
                <div className="flex-1"></div>
                <div className="text-gray-500 text-sm mr-2">{wordCount} words</div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRightSidebar(!showRightSidebar);
                  }}
                  className="ml-2"
                >
                  {showRightSidebar ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </div>
              
              {/* Document Content - Enhanced editable markdown preview */}
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="flex-1 overflow-y-auto p-4 focus:outline-none resize-none font-mono text-sm"
                  defaultValue={markdownContent}
                  onChange={(e) => {
                    // When editing raw markdown, update state but don't stream yet
                    const newContent = e.target.value;
                    setMarkdownContent(newContent);
                    updateWordCount(newContent);
                  }}
                />
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <EditableMarkdown 
                    content={markdownContent}
                    onChange={(newContent) => {
                      // Just update the local state without triggering API calls
                      setMarkdownContent(newContent);
                      updateWordCount(newContent);
                    }}
                    onEdit={(editedContent) => {
                      // This function will only be called when the user explicitly requests AI feedback
                      // Either through a button click or after substantial edits + debounce timer
                      console.log("Streaming AI feedback on edited content");
                      
                      // Show loading indicator in UI
                      setMarkdownContent(editedContent + '\n\n_Getting AI feedback..._');
                      
                      // Call AI with the edited content
                      complete(`I've edited this document. Please analyze and suggest improvements if needed:
                      
${editedContent}

Please respond with the improved version only. Maintain the same general structure but fix any issues with grammar, clarity, or style.`);
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
          
          {/* Right sidebar with collapsible functionality */}
          <aside 
            className={`
              ${showRightSidebar ? 'translate-x-0 w-[350px]' : 'translate-x-full w-0 opacity-0'}
              border-l flex flex-col shrink-0 overflow-hidden
              transition-all duration-300 ease-in-out
            `}
          >
            {/* Review header with toggle button */}
            <div className="p-4 border-b shrink-0 flex justify-between items-start">
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Evaluation Review suggestions</span>
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
              
              {/* Add collapse button for right sidebar */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="mt-1"
                onClick={() => setShowRightSidebar(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
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
                            {isCompletionLoading ? 'Processing...' : `Apply to document`}
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
          
          {/* Add collapsed state toggle button */}
          {!showRightSidebar && (
            <div className="border-l h-full flex items-center">
              <Button 
                variant="ghost" 
                size="sm"
                className="h-20 rounded-l-none border-l-0 pr-1 pl-0.5"
                onClick={() => setShowRightSidebar(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
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
            placeholder="Message to AI..."
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