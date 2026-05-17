"""Schemas for the goal assistant."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatSuggestion(BaseModel):
    label: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    intent: str
    action_taken: bool = False
    suggestions: list[ChatSuggestion] = []
