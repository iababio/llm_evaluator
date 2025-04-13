from datetime import datetime, timedelta
import traceback
from typing import List, Dict, Any, Optional
from bson import ObjectId
import json
import asyncio

from api.db.index import db_history




async def ensure_chat_history_index():
    """Ensure necessary indexes exist for the chat history collection."""
    await db_history.create_index("clerk_id")
    await db_history.create_index("created_at")
    await db_history.create_index("updated_at")
    await db_history.create_index([("clerk_id", 1), ("metadata.client_session_id", 1)])


async def save_chat_history(clerk_id: str, title: str, messages: List[Dict], metadata: Dict = None) -> Dict:
    """
    Save chat history to the database with detailed logging and robust error handling.
    
    Args:
        clerk_id: The ID of the user
        title: Title for the chat
        messages: List of chat messages
        metadata: Optional metadata for the chat
        
    Returns:
        The saved chat document
    """
    try:
        # Add timestamp fields
        now = datetime.now().isoformat()
        
        print(f"Saving chat for clerk_id: {clerk_id}, title: {title}, messages: {len(messages)}")
        
        # Validate inputs
        if not clerk_id:
            print("Error: Missing clerk_id, cannot save chat")
            return None
            
        if not messages or not isinstance(messages, list):
            print(f"Error: Invalid messages format: {type(messages)}")
            return None
        
        # Create the chat document
        chat_doc = {
            "clerk_id": clerk_id,
            "title": title or f"Chat {now}",
            "messages": messages,
            "created_at": now,
            "updated_at": now,
            "metadata": metadata or {}
        }
        
        # Insert into MongoDB with retry logic
        max_retries = 3
        retry_delay = 1.0  # seconds
        
        for attempt in range(max_retries):
            try:
                # Check if the task is being cancelled before database operation
                await asyncio.sleep(0)
                
                # Verify database connection
                from api.db.index import db_chat, client
                
                # Test connection before attempting insert
                await client.admin.command('ping')
                
                # Insert document
                result = await db_chat.insert_one(chat_doc)
                
                if result and result.inserted_id:
                    print(f"Successfully saved chat with ID: {result.inserted_id} (attempt {attempt+1})")
                    
                    # Add ID fields for consistency
                    chat_doc["_id"] = str(result.inserted_id)
                    chat_doc["id"] = str(result.inserted_id)
                    
                    return chat_doc
                else:
                    print(f"Insert operation didn't return an inserted_id (attempt {attempt+1})")
                    
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    
            except asyncio.CancelledError:
                print("Save operation cancelled during database insert")
                raise  # Re-raise to properly handle cancellation
                
            except Exception as db_error:
                print(f"Database error saving chat (attempt {attempt+1}): {str(db_error)}")
                traceback.print_exc()
                
                if attempt < max_retries - 1:
                    print(f"Retrying in {retry_delay} seconds...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    print("Max retries reached, giving up")
                    raise
        
        return None  # If we get here, all attempts failed
        
    except asyncio.CancelledError:
        print("Save operation cancelled before database insert")
        raise  # Re-raise to properly handle cancellation
        
    except Exception as e:
        print(f"Error in save_chat_history: {str(e)}")
        traceback.print_exc()
        return None


async def get_chat_history(chat_id: str) -> Optional[Dict]:
    """
    Get a specific chat history by ID.
    
    Args:
        chat_id: The ID of the chat
        
    Returns:
        The chat document or None if not found
    """
    try:
        # Convert string ID to ObjectId
        from bson import ObjectId
        
        # Validate ID format
        if not is_valid_object_id(chat_id):
            print(f"Invalid chat_id format: {chat_id}")
            return None
            
        object_id = ObjectId(chat_id)
        
        # Query MongoDB
        chat = await db_history.find_one({"_id": object_id})
        
        if not chat:
            print(f"Chat not found: {chat_id}")
            return None
            
        # Convert ObjectId to string for JSON serialization
        chat["id"] = str(chat["_id"])
            
        return chat
    except Exception as e:
        print(f"Error in get_chat_history: {str(e)}")
        traceback.print_exc()
        return None


async def get_user_chat_histories(clerk_id: str) -> List[Dict]:
    """
    Get all chat histories for a user.
    
    Args:
        clerk_id: The ID of the user
        
    Returns:
        List of chat documents
    """
    try:
        print(f"Fetching chat histories for clerk_id: {clerk_id}")
        
        # Defensive check for clerk_id
        if not clerk_id or not isinstance(clerk_id, str):
            print(f"Invalid clerk_id: {clerk_id}, type: {type(clerk_id)}")
            return []
        
        # Query MongoDB
        cursor = db_history.find({"clerk_id": clerk_id})
        
        # Sort by most recent first
        cursor.sort("updated_at", -1)
        
        # Convert to list
        chats = await cursor.to_list(None)
        
        # Convert ObjectId to string for JSON serialization
        for chat in chats:
            if "_id" in chat:
                chat["id"] = str(chat["_id"])
            
            # Get the last user message as a preview
            if "messages" in chat and isinstance(chat["messages"], list):
                user_messages = [
                    msg for msg in chat["messages"] 
                    if isinstance(msg, dict) and msg.get("role") == "user"
                ]
                
                if user_messages:
                    # Get the last user message content
                    last_message = user_messages[-1].get("content", "")
                    
                    # Truncate if it's too long
                    if isinstance(last_message, str) and len(last_message) > 100:
                        chat["last_message"] = last_message[:100] + "..."
                    else:
                        chat["last_message"] = last_message
        
        print(f"Found {len(chats)} chat histories for clerk_id: {clerk_id}")
        return chats
    except Exception as e:
        print(f"Error in get_user_chat_histories: {str(e)}")
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
        existing_chat = await db_history.find_one({
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
        await db_history.update_one(
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
        result = await db_history.delete_one({"_id": chat_obj_id})
        
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

# Add this helper function if it doesn't exist
def is_valid_object_id(id_str: str) -> bool:
    """Check if a string is a valid MongoDB ObjectId"""
    from bson.objectid import ObjectId
    try:
        ObjectId(id_str)
        return True
    except:
        return False