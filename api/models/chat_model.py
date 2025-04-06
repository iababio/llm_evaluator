from typing import List
from pydantic import BaseModel

from api.utils.prompt import ClientMessage


class Request(BaseModel):
    messages: List[ClientMessage]


class CompletionRequest(BaseModel):
    prompt: str = None
    messages: List[ClientMessage] = None