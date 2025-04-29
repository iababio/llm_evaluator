import os
import certifi
from dotenv import load_dotenv
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment variables
load_dotenv('.env.local')

# Get MongoDB connection string
MONGODB_URI: str | None = os.environ.get("MONGODB_URL")
if not MONGODB_URI:
    raise ValueError("MONGODB_URL environment variable is not set")

# Initialize MongoDB client
client = AsyncIOMotorClient(MONGODB_URI, tlsCAFile=certifi.where())
db = client.llm_eval


async def create_collections():
    """Create necessary collections if they don't exist."""
    try:
        collection_names = await db.list_collection_names()
        
        if "chats" not in collection_names:
            await db.create_collection("chats")
        
        if "users" not in collection_names:
            await db.create_collection("users")
            
        if "chat_history" not in collection_names:
            await db.create_collection("chat_history")
            await db.chat_history.create_index("user_id")
            await db.chat_history.create_index("timestamp")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create collections: {str(e)}")


async def create_indexes():
    """Create necessary indexes for the database"""
    users = db.get_collection("users")
    chat_history = db.get_collection("chat_history")
    
    await users.create_index("clerk_id", unique=True)
    await users.create_index("email")
    
    await chat_history.create_index("clerk_id")
    await chat_history.create_index("created_at")
    await chat_history.create_index("fingerprint")
    await chat_history.create_index([("clerk_id", 1), ("fingerprint", 1), ("created_at", -1)])


async def initialize_database():
    """Initialize the database by creating collections and indexes."""
    try:
        await create_collections()
        await create_indexes()
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database initialization failed: {str(e)}")


# Export collection references
db_chat = db.get_collection("chats")
db_user = db.get_collection("users")
db_history = db.get_collection("chat_history")
