async def create_indexes():
    """Create necessary indexes for the database"""
    from api.db.index import db
    
    # Get collections
    users = db.get_collection("users")
    chat_history = db.get_collection("chat_history")
    
    # Create indexes
    await users.create_index("clerk_id", unique=True)
    await users.create_index("email")
    
    await chat_history.create_index("clerk_id")
    await chat_history.create_index("created_at")
    await chat_history.create_index("fingerprint")
    # Add a compound index for deduplication
    await chat_history.create_index([("clerk_id", 1), ("fingerprint", 1), ("created_at", -1)])