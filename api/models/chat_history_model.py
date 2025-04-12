from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field


class MessageContent(BaseModel):
    """Message content which can be text or tool calls"""
    text: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


class ChatMessage(BaseModel):
    """Individual message in a chat"""
    role: str
    content: Optional[Union[str, List, Dict[str, Any]]] = None
    name: Optional[str] = None
    tool_call_id: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


class ChatHistory(BaseModel):
    """Chat history record"""
    id: Optional[str] = None
    clerk_id: str
    title: str = "New Chat"
    messages: List[Dict[str, Any]] = []
    model: str = "gpt-4o"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    usage: Optional[Dict[str, int]] = None
    error: Optional[str] = None
    last_message: Optional[str] = None