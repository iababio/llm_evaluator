import os
import certifi
from dotenv import load_dotenv
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv('.env.local')

MONGODB_URI: str | None = os.environ.get("MONGODB_URL")
if not MONGODB_URI:
    raise ValueError("MONGODB_URL environment variable is not set")

client = AsyncIOMotorClient(MONGODB_URI, tlsCAFile=certifi.where())
db = client.llm_eval


async def create_collections():
    """Create necessary collections if they don't exist."""
    try:
        collection_names = await db.list_collection_names()
        
        # Create chats collection if it doesn't exist
        if "chats" not in collection_names:
            await db.create_collection("chats")
        
        # Create users collection if it doesn't exist
        if "users" not in collection_names:
            await db.create_collection("users")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create collections: {str(e)}")


# Get collections
db_chat = db.get_collection("chats")
db_user = db.get_collection("users")
