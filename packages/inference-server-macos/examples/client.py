#!/usr/bin/env python3
"""Example client for MLX Engine Server."""

import json
import requests
from typing import Optional, List, Dict, Any
import argparse


class MLXClient:
    """Simple client for MLX Engine Server."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        """
        Initialize the client.
        
        Args:
            base_url: Base URL of the MLX Engine Server
        """
        self.base_url = base_url.rstrip("/")
    
    def health_check(self) -> Dict[str, Any]:
        """Check server health."""
        response = requests.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()
    
    def list_models(self) -> List[Dict[str, Any]]:
        """List available models."""
        response = requests.get(f"{self.base_url}/v1/models")
        response.raise_for_status()
        return response.json()["data"]
    

    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "default",
        max_tokens: int = 150,
        temperature: float = 0.7,
        stream: bool = False
    ) -> Any:
        """
        Create a chat completion.
        
        Args:
            messages: List of message dictionaries
            model: Model ID to use
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            stream: Whether to stream the response
        
        Returns:
            Completion response or stream
        """
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream
        }
        
        if stream:
            return self._stream_chat_completion(payload)
        else:
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload
            )
            response.raise_for_status()
            return response.json()
    
    def _stream_chat_completion(self, payload: Dict[str, Any]):
        """Stream chat completion."""
        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json=payload,
            stream=True
        )
        response.raise_for_status()
        
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        yield chunk
                    except json.JSONDecodeError:
                        continue
    
    def server_status(self) -> Dict[str, Any]:
        """Get server status."""
        response = requests.get(f"{self.base_url}/v1/mlx/status")
        response.raise_for_status()
        return response.json()


def main():
    """Example usage of the MLX client."""
    parser = argparse.ArgumentParser(
        description="MLX Engine Server Client Example"
    )
    parser.add_argument(
        "--server",
        default="http://localhost:8000",
        help="Server URL"
    )
    parser.add_argument(
        "--prompt",
        default="Hello! How are you today?",
        help="Prompt to send"
    )
    parser.add_argument(
        "--stream",
        action="store_true",
        help="Enable streaming"
    )
    parser.add_argument(
        "--system",
        default="You are a helpful assistant.",
        help="System message"
    )
    
    args = parser.parse_args()
    
    # Create client
    client = MLXClient(args.server)
    
    try:
        # Check server health
        print("🔍 Checking server health...")
        health = client.health_check()
        print(f"✅ Server is {health['status']}")
        
        # List models
        print("\n📋 Loaded model:")
        models = client.list_models()
        if models:
            for model in models:
                print(f"  - {model['id']}")
        else:
            print("  ❌ No model loaded")
            print("  The server must be started with a model path")
            return
        
        # Create chat completion
        print(f"\n💬 Sending prompt: {args.prompt}")
        
        messages = [
            {"role": "system", "content": args.system},
            {"role": "user", "content": args.prompt}
        ]
        
        if args.stream:
            print("📡 Streaming response:")
            print("-" * 50)
            for chunk in client.chat_completion(
                messages,
                stream=True
            ):
                if chunk["choices"][0]["delta"].get("content"):
                    print(chunk["choices"][0]["delta"]["content"], end="", flush=True)
            print("\n" + "-" * 50)
        else:
            response = client.chat_completion(messages)
            print("📝 Response:")
            print("-" * 50)
            print(response["choices"][0]["message"]["content"])
            print("-" * 50)
            
            # Show usage stats
            if "usage" in response:
                usage = response["usage"]
                print(f"\n📊 Usage:")
                print(f"  Prompt tokens: {usage['prompt_tokens']}")
                print(f"  Completion tokens: {usage['completion_tokens']}")
                print(f"  Total tokens: {usage['total_tokens']}")
        
        # Show server status
        print("\n📈 Server Status:")
        status = client.server_status()
        print(f"  Status: {status['status']}")
        print(f"  Model loaded: {'Yes' if status.get('model_loaded') else 'No'}")
        if status.get('model_info'):
            print(f"  Model type: {status['model_info']['type']}")
        print(f"  Uptime: {status['uptime']}")
        print(f"  MLX version: {status['mlx_version']}")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Is it running?")
        print(f"   Try starting it with: openchat-mlx-server")
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e}")
        if e.response.text:
            try:
                error = json.loads(e.response.text)
                print(f"   {error.get('error', {}).get('message', 'Unknown error')}")
            except:
                print(f"   {e.response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    main()