"use client";

import React from "react";
import { UserResource } from "@clerk/types";

interface UserProfileProps {
  user: UserResource;
}

export default function UserProfile({ user }: UserProfileProps) {
  if (!user) return null;

  return (
    <div className="p-3 border-b flex items-center gap-3">
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt={user.fullName || "User"}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-sm font-medium">
            {user.firstName?.[0] || user.username?.[0] || "U"}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {user.fullName || user.username || "User"}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {user.primaryEmailAddress?.emailAddress}
        </p>
      </div>
    </div>
  );
}
