"use client";

import React from "react";
import {
  Menu,
  MoreHorizontal,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface ChatHeaderProps {
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  setShowLeftSidebar: (show: boolean) => void;
  showLeftSidebar: boolean;
}

export default function ChatHeader({
  documentTitle,
  setDocumentTitle,
  setShowLeftSidebar,
  showLeftSidebar,
}: ChatHeaderProps) {
  const { user } = useUser();
  const router = useRouter();
  const { signOut, openSignIn } = useClerk();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/sign-in"); // Redirect to sign-in page after signing out
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSignIn = () => {
    openSignIn();
  };

  return (
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
          <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center text-white">
            G
          </div>
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

        <div className="flex items-center space-x-2">
          {user ? (
            <div className="user-info flex items-center space-x-2 relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 outline-none rounded-full focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500">
                    <Image
                      src={user.hasImage ? user.imageUrl : "/user.png"}
                      alt="User Profile"
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover border border-gray-200"
                    />
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {user.fullName || "User"}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        {user.primaryEmailAddress?.emailAddress}
                      </span>
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
                    onClick={handleSignOut}
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
              className="text-sm px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
