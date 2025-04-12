from datetime import datetime, timedelta
import traceback
from typing import List, Dict, Any, Optional
from bson import ObjectId
import json

from api.db.index import db

# Get collections
chat_history_collection = db.get_collection("chat_history")


async def ensure_chat_history_index():
    """Ensure necessary indexes exist for the chat history collection."""
    await chat_history_collection.create_index("clerk_id")
    await chat_history_collection.create_index("created_at")
    await chat_history_collection.create_index("updated_at")
    await chat_history_collection.create_index([("clerk_id", 1), ("metadata.client_session_id", 1)])


async def save_chat_history(
    clerk_id: str, 
    messages: List[Dict[str, Any]], 
    model: str = "gpt-4o",
    title: Optional[str] = None,
    usage: Optional[Dict[str, int]] = None,
    error: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Save a chat history to the database.
    
    Args:
        clerk_id: The ID of the user
        messages: List of messages in the chat
        model: The model used for the chat
        title: The title of the chat (auto-generated if not provided)
        usage: Token usage information
        error: Any error encountered during chat completion
        metadata: Additional metadata for the chat
        
    Returns:
        The ID of the saved chat history
    """
    print(f"Saving chat history for {clerk_id} with {len(messages)} messages")
    
    # Check for exact duplicate (based on last few messages)
    if len(messages) >= 2:
        # Create a fingerprint of the last user and assistant messages
        fingerprint = []
        user_found = False
        assistant_found = False
        
        # Iterate through messages in reverse to find the last user and assistant messages
        for msg in reversed(messages):
            role = msg.get("role", "")
            if role == "user" and not user_found:
                content = msg.get("content", "")
                fingerprint.append(f"U:{content[:100]}")
                user_found = True
            elif role == "assistant" and not assistant_found:
                content = msg.get("content", "")
                fingerprint.append(f"A:{content[:100]}")
                assistant_found = True
            
            if user_found and assistant_found:
                break
                
        if fingerprint:
            # Check if we have a duplicate based on this fingerprint
            fingerprint_str = "|".join(fingerprint)
            existing_count = await chat_history_collection.count_documents({
                "clerk_id": clerk_id,
                "fingerprint": fingerprint_str,
                "created_at": {"$gte": datetime.now() - timedelta(minutes=5)}  # Fix timedelta usage
            })
            
            if existing_count > 0:
                print(f"Duplicate chat detected for clerk_id {clerk_id}, not saving")
                return "duplicate"
    
    # Process messages for MongoDB storage
    processed_messages = []
    
    for msg in messages:
        processed_msg = {
            "role": msg.get("role", "unknown"),
        }
        
        # Process content field
        content = msg.get("content")
        if content is not None:
            processed_msg["content"] = content
        
        # Add optional fields if present
        for field in ["name", "tool_call_id", "tool_calls"]:
            if field in msg:
                processed_msg[field] = msg[field]
        
        processed_messages.append(processed_msg)
    
    # Extract title from the first user message if not provided
    if not title and processed_messages:
        for msg in processed_messages:
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str) and content.strip():
                    # Use first 30 chars of first user message as title
                    title_text = content.strip()[:30]
                    title = f"{title_text}{'...' if len(content) > 30 else ''}"
                    break
        
        if not title:
            title = f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    
    # Get the last message for preview
    last_message = None
    for msg in reversed(processed_messages):
        if msg.get("role") in ["assistant", "user"] and msg.get("content"):
            content = msg.get("content")
            if isinstance(content, str):
                last_message = content[:150] + ("..." if len(content) > 150 else "")
                break
    
    # Create chat history object
    chat_history = {
        "clerk_id": clerk_id,
        "title": title,
        "messages": processed_messages,
        "model": model,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "usage": usage,
        "last_message": last_message
    }
    
    # Add fingerprint if we created one
    if "fingerprint_str" in locals():
        chat_history["fingerprint"] = fingerprint_str
    
    # Add metadata if provided
    if metadata:
        chat_history["metadata"] = metadata
    
    if error:
        chat_history["error"] = error
    
    # Insert into database
    try:
        print(f"Inserting chat into database for {clerk_id}")
        result = await chat_history_collection.insert_one(chat_history)
        chat_id = str(result.inserted_id)
        print(f"Successfully saved chat with ID: {chat_id}")
        return chat_id
    except Exception as e:
        print(f"Error saving chat to database: {str(e)}")
        traceback.print_exc()
        raise


async def get_chat_history(chat_id: str, clerk_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get a specific chat history by ID.
    If clerk_id is provided, verify that the user owns the chat.
    """
    try:
        # Convert string ID to ObjectId
        chat_obj_id = ObjectId(chat_id)
        
        # Create query - add clerk_id check if provided
        query = {"_id": chat_obj_id}
        if clerk_id:
            query["clerk_id"] = clerk_id
            
        # Find the chat
        chat = await chat_history_collection.find_one(query)
        
        if not chat:
            return None
            
        # Convert ObjectId to string for JSON serialization
        chat["id"] = str(chat["_id"])
        del chat["_id"]
        
        # Convert datetime objects to strings
        if "created_at" in chat and isinstance(chat["created_at"], datetime):
            chat["created_at"] = chat["created_at"].isoformat()
            
        if "updated_at" in chat and isinstance(chat["updated_at"], datetime):
            chat["updated_at"] = chat["updated_at"].isoformat()
            
        return chat
        
    except Exception as e:
        print(f"Error getting chat {chat_id}: {str(e)}")
        traceback.print_exc()
        return None


async def get_user_chat_histories(clerk_id: str) -> List[Dict[str, Any]]:
    """
    Get chat histories for a user with improved error handling.
    """
    try:
        print(f"Fetching chat histories for clerk_id: {clerk_id}")
        
        # Query the database with error handling
        try:
            # Create a cursor for the query
            cursor = chat_history_collection.find({"clerk_id": clerk_id})
            
            # Sort by updated_at or created_at in descending order
            cursor = cursor.sort("updated_at", -1)
            
            # Convert cursor to list with error handling
            chat_histories = []
            async for chat in cursor:
                try:
                    # Format the chat for JSON response
                    formatted_chat = {
                        "id": str(chat["_id"]),
                        "title": chat.get("title", "Untitled Chat"),
                    }
                    
                    # Add created_at if it exists, otherwise use current time
                    if "created_at" in chat:
                        try:
                            if isinstance(chat["created_at"], datetime):
                                formatted_chat["created_at"] = chat["created_at"].isoformat()
                            else:
                                formatted_chat["created_at"] = str(chat["created_at"])
                        except:
                            formatted_chat["created_at"] = datetime.now().isoformat()
                    else:
                        formatted_chat["created_at"] = datetime.now().isoformat()
                    
                    # Add updated_at if it exists
                    if "updated_at" in chat:
                        try:
                            if isinstance(chat["updated_at"], datetime):
                                formatted_chat["updated_at"] = chat["updated_at"].isoformat()
                            else:
                                formatted_chat["updated_at"] = str(chat["updated_at"])
                        except:
                            pass
                    
                    # Add last_message if it exists
                    if "messages" in chat and len(chat["messages"]) > 0:
                        try:
                            last_message = chat["messages"][-1].get("content", "")
                            if isinstance(last_message, str):
                                # Truncate long messages
                                if len(last_message) > 100:
                                    formatted_chat["last_message"] = last_message[:100] + "..."
                                else:
                                    formatted_chat["last_message"] = last_message
                        except:
                            pass
                    
                    # Add model if it exists
                    if "model" in chat:
                        formatted_chat["model"] = chat["model"]
                        
                    chat_histories.append(formatted_chat)
                except Exception as e:
                    print(f"Error formatting chat: {str(e)}")
                    print(f"Problematic chat: {str(chat.get('_id', 'unknown'))}")
                    continue
                
            print(f"Retrieved {len(chat_histories)} chat histories for user {clerk_id}")
            return chat_histories
        except Exception as db_error:
            print(f"Database query error: {str(db_error)}")
            traceback.print_exc()
            return []
            
    except Exception as e:
        print(f"Error retrieving chat histories: {str(e)}")
        traceback.print_exc()
        return []


async def update_chat_history(
    chat_id: str, 
    clerk_id: str, 
    messages: List[Dict[str, Any]], 
    title: Optional[str] = None,
    model: str = "gpt-4o",
    usage: Optional[Dict[str, int]] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Update an existing chat history.
    Returns the ID of the updated chat or None if there was an error.
    """
    try:
        # Get existing chat first to verify ownership
        chat_obj_id = ObjectId(chat_id)
        existing_chat = await chat_history_collection.find_one({
            "_id": chat_obj_id
        })
        
        if not existing_chat:
            print(f"Chat {chat_id} not found for update")
            return None
            
        # Verify ownership
        if existing_chat.get("clerk_id") != clerk_id:
            print(f"Ownership mismatch: {existing_chat.get('clerk_id')} != {clerk_id}")
            return None
            
        # Prepare update document
        update_doc = {
            "messages": messages,
            "updated_at": datetime.now()
        }
        
        # Add title if provided
        if title:
            update_doc["title"] = title
            
        # Update metadata if provided
        if metadata:
            # Merge with existing metadata if any
            if "metadata" in existing_chat:
                merged_metadata = existing_chat["metadata"].copy()
                merged_metadata.update(metadata)
                update_doc["metadata"] = merged_metadata
            else:
                update_doc["metadata"] = metadata
                
        # Update the document
        await chat_history_collection.update_one(
            {"_id": chat_obj_id},
            {"$set": update_doc}
        )
        
        return chat_id
        
    except Exception as e:
        print(f"Error updating chat {chat_id}: {str(e)}")
        traceback.print_exc()
        return None


async def delete_chat_history(chat_id: str) -> bool:
    """
    Delete a chat history by ID.
    Returns True if successful, False otherwise.
    """
    try:
        # Convert string ID to ObjectId
        chat_obj_id = ObjectId(chat_id)
        
        # Delete the document
        result = await chat_history_collection.delete_one({"_id": chat_obj_id})
        
        # Check if delete was successful
        return result.deleted_count > 0
        
    except Exception as e:
        print(f"Error deleting chat {chat_id}: {str(e)}")
        traceback.print_exc()
        return False


def is_valid_object_id(id_string):
    """Check if a string is a valid MongoDB ObjectID"""
    try:
        ObjectId(id_string)
        return True
    except:
        return False