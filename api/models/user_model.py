from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class UserMetadata(BaseModel):
    """Extended user metadata."""
    last_sign_in: Optional[datetime] = None
    subscription_tier: str = "free"
    preferences: Dict[str, Any] = Field(default_factory=dict)


class UserModel(BaseModel):
    """User model storing Clerk user data in our MongoDB."""
    clerk_id: str
    email: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: UserMetadata = Field(default_factory=UserMetadata)
    is_active: bool = True