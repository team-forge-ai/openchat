"""Generation engine for MLX inference."""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Union, Iterator, AsyncIterator
import time

import mlx.core as mx
from mlx_lm import generate as mlx_generate

from .api_models import ChatMessage
from .utils import generate_id

logger = logging.getLogger(__name__)


class GenerationEngine:
    """Core generation engine using MLX-LM."""
    
    def __init__(self):
        """Initialize the generation engine."""
        self.active_generations = {}
        self._generation_lock = asyncio.Lock()
    
    def generate(
        self,
        model: Any,
        tokenizer: Any,
        messages: Union[str, List[Dict[str, str]]],
        max_tokens: int = 150,
        temperature: float = 0.7,
        top_p: float = 1.0,
        repetition_penalty: float = 1.0,
        stop_sequences: Optional[List[str]] = None,
        stream: bool = False,
        seed: Optional[int] = None,
        **kwargs
    ) -> Union[str, Iterator[str]]:
        """
        Generate text using MLX model.
        
        Args:
            model: MLX model object
            tokenizer: Tokenizer object
            messages: Input messages or prompt string
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            top_p: Top-p sampling parameter
            repetition_penalty: Repetition penalty
            stop_sequences: List of stop sequences
            stream: Whether to stream the response
            seed: Random seed for generation
            **kwargs: Additional MLX-LM parameters
        
        Returns:
            Generated text or iterator of text chunks
        """
        # Format messages to prompt if needed
        if isinstance(messages, list):
            prompt = self._format_messages_to_prompt(messages, tokenizer)
        else:
            prompt = messages
        
        logger.debug(f"Generating with prompt length: {len(prompt)} chars")
        
        # Set random seed if provided
        if seed is not None:
            mx.random.seed(seed)
        
        try:
            if stream:
                return self._generate_stream(
                    model, tokenizer, prompt,
                    max_tokens, temperature, top_p,
                    repetition_penalty, stop_sequences,
                    **kwargs
                )
            else:
                return self._generate_complete(
                    model, tokenizer, prompt,
                    max_tokens, temperature, top_p,
                    repetition_penalty, stop_sequences,
                    **kwargs
                )
        except Exception as e:
            logger.error(f"Generation failed: {e}", exc_info=True)
            raise
    
    async def generate_async(
        self,
        model: Any,
        tokenizer: Any,
        messages: Union[str, List[Dict[str, str]]],
        max_tokens: int = 150,
        temperature: float = 0.7,
        top_p: float = 1.0,
        repetition_penalty: float = 1.0,
        stop_sequences: Optional[List[str]] = None,
        stream: bool = False,
        seed: Optional[int] = None,
        **kwargs
    ):
        """
        Async version of generate method.
        
        Returns:
            Generated text or async iterator of text chunks
        """
        # Run generation in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        
        if stream:
            # For streaming, yield chunks
            async for chunk in self._generate_async_stream(
                model, tokenizer, messages,
                max_tokens, temperature, top_p,
                repetition_penalty, stop_sequences,
                seed, **kwargs
            ):
                yield chunk
        else:
            # For non-streaming, run in executor and yield single result
            result = await loop.run_in_executor(
                None,
                self.generate,
                model, tokenizer, messages,
                max_tokens, temperature, top_p,
                repetition_penalty, stop_sequences,
                False, seed
            )
            yield result
    
    def _format_messages_to_prompt(
        self,
        messages: List[Dict[str, str]],
        tokenizer: Any
    ) -> str:
        """
        Format messages to a prompt string using chat template.
        
        Args:
            messages: List of message dictionaries
            tokenizer: Tokenizer object
        
        Returns:
            Formatted prompt string
        """
        # Try to use tokenizer's chat template
        if hasattr(tokenizer, "apply_chat_template"):
            try:
                prompt = tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True
                )
                logger.debug("Applied tokenizer chat template")
                return prompt
            except Exception as e:
                logger.warning(f"Failed to apply chat template: {e}")
        
        # Fallback to manual formatting
        formatted = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "system":
                formatted.append(f"System: {content}")
            elif role == "user":
                formatted.append(f"User: {content}")
            elif role == "assistant":
                formatted.append(f"Assistant: {content}")
            else:
                formatted.append(f"{role}: {content}")
        
        prompt = "\n\n".join(formatted)
        prompt += "\n\nAssistant:"
        
        logger.debug("Used fallback message formatting")
        return prompt
    
    def _generate_complete(
        self,
        model: Any,
        tokenizer: Any,
        prompt: str,
        max_tokens: int,
        temperature: float,
        top_p: float,
        repetition_penalty: float,
        stop_sequences: Optional[List[str]],
        **kwargs
    ) -> str:
        """
        Generate complete response without streaming.
        
        Returns:
            Complete generated text
        """
        start_time = time.time()
        
        # Prepare generation parameters
        # NOTE: Current MLX-LM only supports max_tokens and verbose
        # Temperature, top_p, and other parameters are not yet supported
        gen_params = {
            "max_tokens": max_tokens,
            "verbose": False,  # Disable verbose output
        }
        
        # Log if unsupported parameters are requested
        if temperature != 1.0:
            logger.debug(f"Temperature {temperature} requested but not supported by MLX-LM")
        if top_p != 1.0:
            logger.debug(f"Top-p {top_p} requested but not supported by MLX-LM")
        if repetition_penalty != 1.0:
            logger.debug(f"Repetition penalty {repetition_penalty} requested but not supported by MLX-LM")
        
        # Generate text
        try:
            response = mlx_generate(
                model,
                tokenizer,
                prompt=prompt,
                **gen_params
            )
            
            # Extract generated text (remove prompt)
            if response.startswith(prompt):
                generated_text = response[len(prompt):].strip()
            else:
                generated_text = response.strip()
            
            # Apply stop sequences if any
            if stop_sequences:
                for stop_seq in stop_sequences:
                    if stop_seq in generated_text:
                        generated_text = generated_text.split(stop_seq)[0]
                        break
            
            generation_time = time.time() - start_time
            logger.info(f"Generated {len(generated_text)} chars in {generation_time:.2f}s")
            
            return generated_text
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            raise
    
    def _generate_stream(
        self,
        model: Any,
        tokenizer: Any,
        prompt: str,
        max_tokens: int,
        temperature: float,
        top_p: float,
        repetition_penalty: float,
        stop_sequences: Optional[List[str]],
        **kwargs
    ) -> Iterator[str]:
        """
        Generate response with streaming.
        
        Yields:
            Text chunks as they are generated
        """
        try:
            # Tokenize the prompt
            prompt_tokens = tokenizer.encode(prompt)
            
            # Initialize generation
            generated_tokens = []
            total_generated = 0
            
            # MLX-LM streaming implementation
            # This is a simplified version - actual implementation may vary
            for token in self._generate_tokens(
                model,
                tokenizer,
                prompt_tokens,
                max_tokens,
                temperature,
                top_p,
                repetition_penalty
            ):
                generated_tokens.append(token)
                total_generated += 1
                
                # Decode the new token(s)
                text = tokenizer.decode(generated_tokens)
                
                # Check for stop sequences
                should_stop = False
                if stop_sequences:
                    for stop_seq in stop_sequences:
                        if stop_seq in text:
                            text = text.split(stop_seq)[0]
                            should_stop = True
                            break
                
                # Yield the text chunk
                if text:
                    yield text
                    generated_tokens = []  # Reset for next chunk
                
                if should_stop or total_generated >= max_tokens:
                    break
                    
        except Exception as e:
            logger.error(f"Streaming generation failed: {e}")
            raise
    
    def _generate_tokens(
        self,
        model: Any,
        tokenizer: Any,
        prompt_tokens: List[int],
        max_tokens: int,
        temperature: float,
        top_p: float,
        repetition_penalty: float
    ) -> Iterator[int]:
        """
        Generate tokens one by one.
        
        Yields:
            Token IDs as they are generated
        """
        # This is a placeholder implementation
        # The actual implementation depends on MLX-LM's streaming capabilities
        
        # For now, generate complete and yield tokens
        # In production, this should use MLX-LM's actual streaming API
        try:
            # Generate complete response
            # NOTE: MLX-LM currently only supports max_tokens and verbose
            response = mlx_generate(
                model,
                tokenizer,
                prompt=tokenizer.decode(prompt_tokens),
                max_tokens=max_tokens,
                verbose=False
            )
            
            # Tokenize response and yield tokens
            # Note: MLX-LM's generate returns only the generated text, not prompt + response
            response_tokens = tokenizer.encode(response)
            
            for token in response_tokens:
                yield token
                
        except Exception as e:
            logger.error(f"Token generation failed: {e}")
            raise
    
    async def _generate_async_stream(
        self,
        model: Any,
        tokenizer: Any,
        messages: Union[str, List[Dict[str, str]]],
        max_tokens: int,
        temperature: float,
        top_p: float,
        repetition_penalty: float,
        stop_sequences: Optional[List[str]],
        seed: Optional[int],
        **kwargs
    ):
        """
        Generate response with async streaming.
        
        Yields:
            Text chunks as they are generated
        """
        # Run the sync generator in a thread pool
        loop = asyncio.get_event_loop()
        
        # Create a queue for communication
        queue = asyncio.Queue()
        generation_id = generate_id("gen")
        
        async def generate_worker():
            """Worker to run generation in thread pool."""
            try:
                # Run sync generation in executor
                await loop.run_in_executor(
                    None,
                    self._run_stream_generation,
                    model, tokenizer, messages,
                    max_tokens, temperature, top_p,
                    repetition_penalty, stop_sequences,
                    seed, queue, generation_id, loop
                )
            except Exception as e:
                await queue.put(("error", str(e)))
            finally:
                await queue.put(("done", None))
        
        # Start generation in background
        asyncio.create_task(generate_worker())
        
        # Yield results from queue
        while True:
            msg_type, content = await queue.get()
            
            if msg_type == "error":
                raise Exception(f"Generation error: {content}")
            elif msg_type == "done":
                break
            elif msg_type == "chunk":
                yield content
    
    def _run_stream_generation(
        self,
        model: Any,
        tokenizer: Any,
        messages: Union[str, List[Dict[str, str]]],
        max_tokens: int,
        temperature: float,
        top_p: float,
        repetition_penalty: float,
        stop_sequences: Optional[List[str]],
        seed: Optional[int],
        queue: asyncio.Queue,
        generation_id: str,
        loop: asyncio.AbstractEventLoop
    ):
        """
        Run streaming generation and put results in queue.
        """
        try:
            # Generate with streaming
            for chunk in self.generate(
                model, tokenizer, messages,
                max_tokens, temperature, top_p,
                repetition_penalty, stop_sequences,
                stream=True, seed=seed
            ):
                # Put chunk in queue
                asyncio.run_coroutine_threadsafe(
                    queue.put(("chunk", chunk)),
                    loop
                )
        except Exception as e:
            asyncio.run_coroutine_threadsafe(
                queue.put(("error", str(e))),
                loop
            )
    
    def count_tokens(self, tokenizer: Any, text: str) -> int:
        """
        Count tokens in text.
        
        Args:
            tokenizer: Tokenizer object
            text: Text to count tokens for
        
        Returns:
            Number of tokens
        """
        try:
            tokens = tokenizer.encode(text)
            return len(tokens)
        except Exception as e:
            logger.warning(f"Failed to count tokens: {e}")
            # Rough estimate: 1 token per 4 characters
            return len(text) // 4