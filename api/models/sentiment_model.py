from typing import List
from pydantic import BaseModel, Field

class SentimentSegment(BaseModel):
    text: str = Field(description="A segment of text from the original input")
    sentiment: List[str] = Field(description="The sentiments detected in this text segment")

class SentimentAnalysisResponse(BaseModel):
    segments: List[SentimentSegment] = Field(description="List of text segments with their detected sentiments")
