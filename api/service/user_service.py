import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from api.db.index import db
from api.models.user_model import UserModel, UserMetadata

# Get the users collection from MongoDB
users_collection = db.get_collection("users")


async def ensure_users_index():
    """Ensure necessary indexes exist for the users collection."""
    await users_collection.create_index("clerk_id", unique=True)
    await users_collection.create_index("email", unique=True)


async def get_user_by_clerk_id(clerk_id: str) -> Optional[UserModel]:
    """Get a user from the database by Clerk ID."""
    user_data = await users_collection.find_one({"clerk_id": clerk_id})
    if user_data:
        # Convert MongoDB _id to string and return as UserModel
        user_data["_id"] = str(user_data["_id"])
        return UserModel(**user_data)
    return None


async def create_or_update_user(user_data: Dict[str, Any]) -> UserModel:
    """Create or update a user in the database based on Clerk data."""
    clerk_id = user_data.get("clerk_id")
    if not clerk_id:
        raise HTTPException(status_code=400, detail="Missing clerk_id in user data")

    # Check if user already exists
    existing_user = await get_user_by_clerk_id(clerk_id)
    
    # Prepare user metadata
    metadata = UserMetadata(
        last_sign_in=datetime.now(),
        subscription_tier=user_data.get("subscription_tier", "free"),
        preferences=user_data.get("preferences", {})
    )
    
    # Prepare user model
    user = UserModel(
        clerk_id=clerk_id,
        email=user_data.get("email", ""),
        username=user_data.get("username"),
        first_name=user_data.get("first_name"),
        last_name=user_data.get("last_name"),
        image_url=user_data.get("image_url"),
        updated_at=datetime.now(),
        metadata=metadata,
        is_active=True
    )
    
    try:
        if existing_user:
            # Update existing user
            update_result = await users_collection.update_one(
                {"clerk_id": clerk_id},
                {"$set": {
                    "email": user.email,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "image_url": user.image_url,
                    "updated_at": user.updated_at,
                    "metadata.last_sign_in": user.metadata.last_sign_in
                }}
            )
            if update_result.modified_count == 0:
                print(f"Warning: User {clerk_id} update had no effect")
        else:
            # Create new user
            await users_collection.insert_one(user.model_dump())
        
        return user
    except DuplicateKeyError as e:
        # Handle the case where email might already exist but with a different clerk_id
        if "email" in str(e):
            raise HTTPException(
                status_code=409, 
                detail="Email already exists with a different account"
            )
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save user: {str(e)}")


# Add this function for recording user activities

async def record_user_activity(clerk_id: str, activity_type: str, metadata: Dict[str, Any] = None):
    """Record user activity for analytics and tracking."""
    if not metadata:
        metadata = {}
        
    activity = {
        "clerk_id": clerk_id,
        "activity_type": activity_type,
        "timestamp": datetime.now(),
        "metadata": metadata
    }
    
    try:
        # Create activities collection if it doesn't exist
        if "user_activities" not in await db.list_collection_names():
            await db.create_collection("user_activities")
            await db.user_activities.create_index("clerk_id")
            await db.user_activities.create_index("timestamp")
            
        # Insert the activity
        await db.user_activities.insert_one(activity)
        
        # Update user's last activity timestamp
        await users_collection.update_one(
            {"clerk_id": clerk_id},
            {"$set": {"last_activity": datetime.now()}}
        )
        
        return True
    except Exception as e:
        print(f"Error recording user activity: {str(e)}")
        return False