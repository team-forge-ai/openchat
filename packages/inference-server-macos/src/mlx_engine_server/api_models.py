"""API request and response models for OpenAI compatibility."""

from typing import List, Optional, Dict, Any, Union, Literal
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import time


# Chat Completion Models
class ChatMessage(BaseModel):
    """Chat message format."""
    role: Literal["system", "user", "assistant", "function"]
    content: str
    name: Optional[str] = None
    function_call: Optional[Dict[str, Any]] = None


class ChatCompletionRequest(BaseModel):
    """OpenAI-compatible chat completion request."""
    model: Optional[str] = Field(default="default", description="Model name (ignored, uses loaded model)")
    messages: List[ChatMessage]
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    n: Optional[int] = Field(default=1, ge=1)
    stream: Optional[bool] = False
    stop: Optional[Union[str, List[str]]] = None
    max_tokens: Optional[int] = Field(default=None, ge=1)
    presence_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    logit_bias: Optional[Dict[str, float]] = None
    user: Optional[str] = None
    seed: Optional[int] = None
    
    @field_validator('messages')
    def validate_messages(cls, v):
        if not v:
            raise ValueError("Messages list cannot be empty")
        return v


class ChatCompletionResponseChoice(BaseModel):
    """Chat completion response choice."""
    index: int
    message: ChatMessage
    finish_reason: Optional[Literal["stop", "length", "content_filter", "function_call"]]
    logprobs: Optional[Any] = None


class ChatCompletionResponseUsage(BaseModel):
    """Token usage information."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    """OpenAI-compatible chat completion response."""
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionResponseChoice]
    usage: Optional[ChatCompletionResponseUsage]
    system_fingerprint: Optional[str] = None


class ChatCompletionStreamChoice(BaseModel):
    """Streaming chat completion choice."""
    index: int
    delta: Dict[str, Any]
    finish_reason: Optional[Literal["stop", "length", "content_filter", "function_call"]] = None
    logprobs: Optional[Any] = None


class ChatCompletionStreamResponse(BaseModel):
    """OpenAI-compatible streaming chat completion response."""
    id: str
    object: Literal["chat.completion.chunk"] = "chat.completion.chunk"
    created: int
    model: str
    choices: List[ChatCompletionStreamChoice]
    system_fingerprint: Optional[str] = None


# Completion Models (for backwards compatibility)
class CompletionRequest(BaseModel):
    """OpenAI-compatible completion request."""
    model: Optional[str] = Field(default="default", description="Model name (ignored, uses loaded model)")
    prompt: Union[str, List[str]]
    suffix: Optional[str] = None
    max_tokens: Optional[int] = Field(default=16, ge=1)
    temperature: Optional[float] = Field(default=1.0, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    n: Optional[int] = Field(default=1, ge=1)
    stream: Optional[bool] = False
    logprobs: Optional[int] = None
    echo: Optional[bool] = False
    stop: Optional[Union[str, List[str]]] = None
    presence_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    best_of: Optional[int] = Field(default=1, ge=1)
    logit_bias: Optional[Dict[str, float]] = None
    user: Optional[str] = None
    seed: Optional[int] = None


class CompletionResponseChoice(BaseModel):
    """Completion response choice."""
    text: str
    index: int
    logprobs: Optional[Any] = None
    finish_reason: Optional[Literal["stop", "length"]]


class CompletionResponse(BaseModel):
    """OpenAI-compatible completion response."""
    id: str
    object: Literal["text_completion"] = "text_completion"
    created: int
    model: str
    choices: List[CompletionResponseChoice]
    usage: Optional[ChatCompletionResponseUsage]
    system_fingerprint: Optional[str] = None


# Model List Models
class ModelInfo(BaseModel):
    """Model information in OpenAI format."""
    id: str
    object: Literal["model"] = "model"
    created: int
    owned_by: str = "local"
    permission: Optional[List[Any]] = []
    root: Optional[str] = None
    parent: Optional[str] = None


class ModelListResponse(BaseModel):
    """OpenAI-compatible model list response."""
    object: Literal["list"] = "list"
    data: List[ModelInfo]





# Error Models
class ErrorDetail(BaseModel):
    """Error detail for OpenAI-compatible error responses."""
    message: str
    type: str
    param: Optional[str] = None
    code: Optional[str] = None


class ErrorResponse(BaseModel):
    """OpenAI-compatible error response."""
    error: ErrorDetail


# Embedding Models (for future implementation)
class EmbeddingRequest(BaseModel):
    """OpenAI-compatible embedding request."""
    model: str
    input: Union[str, List[str], List[int], List[List[int]]]
    encoding_format: Optional[Literal["float", "base64"]] = "float"
    user: Optional[str] = None


class EmbeddingData(BaseModel):
    """Embedding data."""
    object: Literal["embedding"] = "embedding"
    index: int
    embedding: Union[List[float], str]


class EmbeddingResponse(BaseModel):
    """OpenAI-compatible embedding response."""
    object: Literal["list"] = "list"
    data: List[EmbeddingData]
    model: str
    usage: Dict[str, int]


# Helper functions
def create_chat_completion_response(
    request_id: str,
    model: Optional[str] = None,
    content: str = "",
    finish_reason: str = "stop",
    prompt_tokens: int = 0,
    completion_tokens: int = 0
) -> ChatCompletionResponse:
    """Create a standard chat completion response."""
    return ChatCompletionResponse(
        id=request_id,
        created=int(time.time()),
        model=model or "mlx-model",
        choices=[
            ChatCompletionResponseChoice(
                index=0,
                message=ChatMessage(role="assistant", content=content),
                finish_reason=finish_reason
            )
        ],
        usage=ChatCompletionResponseUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens
        )
    )


def create_stream_response_chunk(
    request_id: str,
    model: Optional[str] = None,
    content: Optional[str] = None,
    finish_reason: Optional[str] = None,
    role: Optional[str] = None
) -> ChatCompletionStreamResponse:
    """Create a streaming response chunk."""
    delta = {}
    if role:
        delta["role"] = role
    if content is not None:
        delta["content"] = content
    
    return ChatCompletionStreamResponse(
        id=request_id,
        created=int(time.time()),
        model=model or "mlx-model",
        choices=[
            ChatCompletionStreamChoice(
                index=0,
                delta=delta,
                finish_reason=finish_reason
            )
        ]
    )


def create_error_response(
    message: str,
    error_type: str = "invalid_request_error",
    param: Optional[str] = None,
    code: Optional[str] = None
) -> ErrorResponse:
    """Create an OpenAI-compatible error response."""
    return ErrorResponse(
        error=ErrorDetail(
            message=message,
            type=error_type,
            param=param,
            code=code
        )
    )