# Tauri Integration Guide for MLX Inference Server

This guide explains how to integrate the MLX Inference Server with a Tauri desktop application, allowing you to run local AI models directly within your desktop app.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup](#setup)
- [Configuration](#configuration)
- [Implementation](#implementation)
- [Frontend Integration](#frontend-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The MLX Inference Server can be integrated with Tauri to provide local AI inference capabilities in desktop applications. This integration allows you to:

- Run AI models locally on macOS without external API dependencies
- Maintain user privacy by processing data on-device
- Reduce latency compared to cloud-based solutions
- Work offline without internet connectivity

## Architecture

The integration follows this architecture:

```
┌─────────────────────┐
│   Tauri Frontend    │
│    (React/Vue/etc)  │
└──────────┬──────────┘
           │
           │ IPC (invoke commands)
           │
┌──────────▼──────────┐
│    Tauri Backend    │
│      (Rust)         │
└──────────┬──────────┘
           │
           │ HTTP/Process Management
           │
┌──────────▼──────────┐
│  MLX Inference      │
│     Server          │
│   (Python/MLX)      │
└─────────────────────┘
```

## Setup

### 1. Prepare the Inference Server

First, ensure the MLX Inference Server is built and packaged:

```bash
# Build the server
cd packages/inference-server-macos
python build.py

# This creates a standalone executable
```

### 2. Add Server as Tauri Sidecar

Place the built server executable in your Tauri project:

```bash
# Copy to Tauri resources
cp dist/openchat-mlx-server src-tauri/resources/
```

### 3. Configure Tauri

Update your `tauri.conf.json` to include necessary permissions and bundle the server:

```json
{
  "tauri": {
    "allowlist": {
      "shell": {
        "all": false,
        "execute": false,
        "sidecar": true,
        "open": false,
        "scope": [
          {
            "name": "openchat-mlx-server",
            "sidecar": true,
            "args": true
          }
        ]
      },
      "http": {
        "all": false,
        "request": true,
        "scope": ["http://localhost:8080/*", "http://127.0.0.1:8080/*"]
      },
      "fs": {
        "all": false,
        "readFile": true,
        "writeFile": true,
        "readDir": true,
        "createDir": true,
        "removeDir": false,
        "removeFile": false,
        "renameFile": false,
        "exists": true,
        "scope": ["$APPDATA/*", "$APPCONFIG/*"]
      }
    },
    "bundle": {
      "resources": ["resources/openchat-mlx-server", "resources/models/*"],
      "externalBin": ["resources/openchat-mlx-server"]
    }
  }
}
```

## Configuration

### Server Configuration

Create a configuration file for the MLX server that will be used by Tauri:

```json
{
  "host": "127.0.0.1",
  "port": 8080,
  "models_dir": "$APPDATA/models",
  "cache_dir": "$APPCACHE/mlx_cache",
  "max_concurrent": 1,
  "default_model": "mlx-community/Llama-3.2-3B-Instruct-4bit",
  "auto_download": true
}
```

## Implementation

### Rust Backend (src-tauri/src/main.rs)

```rust
use tauri::api::process::{Command, CommandEvent};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

struct ServerState {
    process: Option<tauri::api::process::CommandChild>,
    port: u16,
}

#[derive(Serialize, Deserialize)]
struct InferenceRequest {
    prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    model: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct InferenceResponse {
    text: String,
    tokens_used: u32,
    model: String,
}

#[tauri::command]
async fn start_inference_server(
    state: tauri::State<'_, Mutex<ServerState>>,
    config_path: Option<String>,
) -> Result<String, String> {
    let mut server_state = state.lock().unwrap();

    if server_state.process.is_some() {
        return Ok("Server already running".to_string());
    }

    // Start the MLX server as a sidecar
    let (mut rx, child) = Command::new_sidecar("openchat-mlx-server")
        .expect("failed to create `openchat-mlx-server` command")
        .args(&[
            "--config",
            &config_path.unwrap_or_else(|| "config.json".to_string()),
            "--port",
            &server_state.port.to_string(),
        ])
        .spawn()
        .expect("Failed to spawn openchat-mlx-server");

    // Store the process handle
    server_state.process = Some(child);

    // Monitor server output
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    println!("MLX Server: {}", line);
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("MLX Server Error: {}", line);
                }
                _ => {}
            }
        }
    });

    // Wait for server to be ready
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    Ok(format!("Server started on port {}", server_state.port))
}

#[tauri::command]
async fn stop_inference_server(
    state: tauri::State<'_, Mutex<ServerState>>,
) -> Result<String, String> {
    let mut server_state = state.lock().unwrap();

    if let Some(child) = server_state.process.take() {
        child.kill().map_err(|e| e.to_string())?;
        Ok("Server stopped".to_string())
    } else {
        Ok("Server not running".to_string())
    }
}

#[tauri::command]
async fn generate_text(
    state: tauri::State<'_, Mutex<ServerState>>,
    request: InferenceRequest,
) -> Result<InferenceResponse, String> {
    let server_state = state.lock().unwrap();
    let port = server_state.port;
    drop(server_state); // Release lock before async operation

    // Make HTTP request to MLX server
    let client = reqwest::Client::new();
    let response = client
        .post(format!("http://127.0.0.1:{}/v1/completions", port))
        .json(&serde_json::json!({
            "model": request.model.unwrap_or_else(|| "default".to_string()),
            "prompt": request.prompt,
            "max_tokens": request.max_tokens.unwrap_or(512),
            "temperature": request.temperature.unwrap_or(0.7),
            "stream": false
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Server error: {}", response.status()));
    }

    let result: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    Ok(InferenceResponse {
        text: result["choices"][0]["text"].as_str().unwrap_or("").to_string(),
        tokens_used: result["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32,
        model: result["model"].as_str().unwrap_or("unknown").to_string(),
    })
}

#[tauri::command]
async fn download_model(model_name: String) -> Result<String, String> {
    // Call the MLX server's model download endpoint
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:8080/v1/models/download")
        .json(&serde_json::json!({
            "model": model_name
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok(format!("Model {} downloaded successfully", model_name))
    } else {
        Err(format!("Failed to download model: {}", response.status()))
    }
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(ServerState {
            process: None,
            port: 8080,
        }))
        .invoke_handler(tauri::generate_handler![
            start_inference_server,
            stop_inference_server,
            generate_text,
            download_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Direct JavaScript Process Management (No Rust Required)

For developers who prefer to minimize Rust code, you can manage the MLX server directly from JavaScript using Tauri's shell API. This approach allows you to spawn and control the server as a sidecar process without writing custom Rust commands.

### Setup Shell Permissions

First, ensure your `tauri.conf.json` has the necessary shell permissions:

```json
{
  "tauri": {
    "allowlist": {
      "shell": {
        "sidecar": true,
        "scope": [
          {
            "name": "openchat-mlx-server",
            "sidecar": true,
            "args": true
          }
        ]
      },
      "process": {
        "all": false,
        "relaunch": false,
        "exit": false
      }
    },
    "bundle": {
      "externalBin": ["openchat-mlx-server"]
    }
  }
}
```

### JavaScript Server Manager

Create a JavaScript/TypeScript class to manage the server lifecycle:

```typescript
// src/lib/server-manager.ts
import type { Child } from '@tauri-apps/api/shell'
import { Command } from '@tauri-apps/api/shell'
import { invoke } from '@tauri-apps/api/tauri'

export class MLXServerManager {
  private serverProcess: Child | null = null
  private isRunning = false
  private port = 8080
  private startupTimeout = 10000 // 10 seconds

  constructor(options?: { port?: number; startupTimeout?: number }) {
    if (options?.port) {
      this.port = options.port
    }
    if (options?.startupTimeout) {
      this.startupTimeout = options.startupTimeout
    }
  }

  async start(configPath?: string): Promise<void> {
    if (this.isRunning) {
      console.log('Server already running')
      return
    }

    try {
      // Build command arguments
      const args = ['--port', this.port.toString()]
      if (configPath) {
        args.push('--config', configPath)
      }

      // Spawn the MLX server as a sidecar
      const command = Command.sidecar('openchat-mlx-server', args)

      // Set up event listeners for stdout and stderr
      command.on('close', (data) => {
        console.log(`MLX server exited with code ${data.code}`)
        this.isRunning = false
        this.serverProcess = null
      })

      command.on('error', (error) => {
        console.error('MLX server error:', error)
      })

      command.stdout.on('data', (line) => {
        console.log('MLX server:', line)
      })

      command.stderr.on('data', (line) => {
        console.error('MLX server stderr:', line)
      })

      // Spawn the process
      this.serverProcess = await command.spawn()

      // Wait for server to be ready
      await this.waitForServer()

      this.isRunning = true
      console.log(`MLX server started on port ${this.port}`)
    } catch (error) {
      console.error('Failed to start MLX server:', error)
      throw new Error(`Failed to start server: ${error}`)
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.serverProcess) {
      console.log('Server not running')
      return
    }

    try {
      await this.serverProcess.kill()
      this.isRunning = false
      this.serverProcess = null
      console.log('MLX server stopped')
    } catch (error) {
      console.error('Failed to stop MLX server:', error)
      throw error
    }
  }

  async restart(configPath?: string): Promise<void> {
    await this.stop()
    // Wait a bit for the process to fully terminate
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await this.start(configPath)
  }

  private async waitForServer(): Promise<void> {
    const startTime = Date.now()
    const checkInterval = 500 // Check every 500ms

    while (Date.now() - startTime < this.startupTimeout) {
      try {
        const response = await fetch(`http://127.0.0.1:${this.port}/health`)
        if (response.ok) {
          return // Server is ready
        }
      } catch {
        // Server not ready yet, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }

    throw new Error('Server startup timeout')
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isRunning) {
      return false
    }

    try {
      const response = await fetch(`http://127.0.0.1:${this.port}/health`)
      return response.ok
    } catch {
      return false
    }
  }

  getPort(): number {
    return this.port
  }

  isServerRunning(): boolean {
    return this.isRunning
  }
}
```

### Advanced Process Management

For more sophisticated process management, including automatic restart and monitoring:

```typescript
// src/lib/advanced-server-manager.ts
import type { Child } from '@tauri-apps/api/shell'
import { Command } from '@tauri-apps/api/shell'
import { listen } from '@tauri-apps/api/event'
import { appWindow } from '@tauri-apps/api/window'

interface ServerConfig {
  port?: number
  modelPath?: string
  maxMemory?: number
  autoRestart?: boolean
  healthCheckInterval?: number
}

export class AdvancedMLXServer {
  private process: Child | null = null
  private config: Required<ServerConfig>
  private healthCheckTimer: number | null = null
  private restartAttempts = 0
  private maxRestartAttempts = 3
  private eventListeners: Array<() => void> = []

  constructor(config: ServerConfig = {}) {
    this.config = {
      port: config.port ?? 8080,
      modelPath: config.modelPath ?? './models',
      maxMemory: config.maxMemory ?? 8192,
      autoRestart: config.autoRestart ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 30000, // 30 seconds
    }

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // Listen for app window events
    const unlistenClose = appWindow.onCloseRequested(async () => {
      await this.shutdown()
    })

    this.eventListeners.push(unlistenClose)

    // Listen for low memory warnings (custom event)
    const unlistenMemory = listen('low-memory', async () => {
      console.warn('Low memory detected, restarting MLX server...')
      await this.restart()
    })

    this.eventListeners.push(() => unlistenMemory.then((fn) => fn()))
  }

  async start(): Promise<void> {
    if (this.process) {
      console.log('Server already running')
      return
    }

    const command = Command.sidecar('openchat-mlx-server', [
      '--port',
      this.config.port.toString(),
      '--model-path',
      this.config.modelPath,
      '--max-memory',
      this.config.maxMemory.toString(),
    ])

    // Capture output for debugging
    let startupOutput = ''
    let errorOutput = ''

    command.stdout.on('data', (line) => {
      startupOutput += line + '\n'
      console.log('[MLX]', line)

      // Check for specific startup messages
      if (line.includes('Server ready') || line.includes('Listening on')) {
        this.onServerReady()
      }
    })

    command.stderr.on('data', (line) => {
      errorOutput += line + '\n'
      console.error('[MLX Error]', line)

      // Check for critical errors
      if (line.includes('CRITICAL') || line.includes('FATAL')) {
        this.handleCriticalError(line)
      }
    })

    command.on('close', async (data) => {
      console.log(`MLX server exited with code ${data.code}`)
      this.process = null

      // Auto-restart if enabled and not a clean exit
      if (this.config.autoRestart && data.code !== 0) {
        await this.handleUnexpectedExit(data.code)
      }
    })

    try {
      this.process = await command.spawn()
      this.restartAttempts = 0 // Reset on successful start
      this.startHealthCheck()
    } catch (error) {
      console.error('Failed to spawn MLX server:', error)
      throw new Error(`Server spawn failed: ${error}`)
    }
  }

  private async handleUnexpectedExit(exitCode: number): Promise<void> {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error('Max restart attempts reached, giving up')
      return
    }

    this.restartAttempts++
    console.log(
      `Attempting restart ${this.restartAttempts}/${this.maxRestartAttempts}...`,
    )

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.restartAttempts), 30000)
    await new Promise((resolve) => setTimeout(resolve, delay))

    await this.start()
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = window.setInterval(async () => {
      const isHealthy = await this.checkHealth()
      if (!isHealthy && this.config.autoRestart) {
        console.warn('Health check failed, restarting server...')
        await this.restart()
      }
    }, this.config.healthCheckInterval)
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(
        `http://127.0.0.1:${this.config.port}/health`,
        {
          signal: AbortSignal.timeout(5000),
        },
      )
      return response.ok
    } catch {
      return false
    }
  }

  async stop(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    if (!this.process) {
      return
    }

    try {
      await this.process.kill()
      this.process = null
    } catch (error) {
      console.error('Error stopping server:', error)
      throw error
    }
  }

  async restart(): Promise<void> {
    await this.stop()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await this.start()
  }

  async shutdown(): Promise<void> {
    // Clean shutdown
    this.config.autoRestart = false // Disable auto-restart
    await this.stop()

    // Clean up event listeners
    this.eventListeners.forEach((unlisten) => unlisten())
    this.eventListeners = []
  }

  private onServerReady(): void {
    console.log('MLX server is ready')
    // Emit custom event that other parts of the app can listen to
    window.dispatchEvent(
      new CustomEvent('openchat-mlx-server-ready', {
        detail: { port: this.config.port },
      }),
    )
  }

  private handleCriticalError(error: string): void {
    console.error('Critical error detected:', error)
    // Emit error event
    window.dispatchEvent(
      new CustomEvent('openchat-mlx-server-error', {
        detail: { error, critical: true },
      }),
    )
  }

  // API wrapper methods
  async generateText(prompt: string, options?: any): Promise<string> {
    if (!this.process) {
      throw new Error('Server not running')
    }

    const response = await fetch(
      `http://127.0.0.1:${this.config.port}/v1/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ...options,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0].text
  }
}
```

### Usage Example

Here's how to use the JavaScript-only approach in your application:

```react
// src/App.tsx
import { useEffect, useState } from 'react'
import { MLXServerManager } from './lib/server-manager'

const serverManager = new MLXServerManager({ port: 8080 })

function App() {
  const [serverStatus, setServerStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped')
  const [response, setResponse] = useState('')

  useEffect(() => {
    // Start server on mount
    startServer()

    // Cleanup on unmount
    return () => {
      serverManager.stop()
    }
  }, [])

  const startServer = async () => {
    setServerStatus('starting')
    try {
      await serverManager.start()
      setServerStatus('running')

      // Listen for server ready event
      window.addEventListener('openchat-mlx-server-ready', (e) => {
        console.log('Server ready on port:', e.detail.port)
      })
    } catch (error) {
      console.error('Failed to start server:', error)
      setServerStatus('error')
    }
  }

  const generateText = async (prompt: string) => {
    if (!serverManager.isServerRunning()) {
      alert('Server not running!')
      return
    }

    try {
      const response = await fetch(`http://127.0.0.1:${serverManager.getPort()}/v1/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: 200,
          temperature: 0.7
        })
      })

      const data = await response.json()
      setResponse(data.choices[0].text)
    } catch (error) {
      console.error('Generation failed:', error)
    }
  }

  return (
    <div>
      <div>Server Status: {serverStatus}</div>
      {serverStatus === 'stopped' && (
        <button onClick={startServer}>Start Server</button>
      )}
      {serverStatus === 'running' && (
        <button onClick={() => generateText('Hello, world!')}>
          Generate Text
        </button>
      )}
      {response && <div>Response: {response}</div>}
    </div>
  )
}

export default App
```

### Benefits of JavaScript-Only Approach

1. **No Rust Required**: Perfect for JavaScript/TypeScript developers
2. **Direct Control**: Manage the process lifecycle directly from your frontend code
3. **Event-Driven**: Use JavaScript events for server status updates
4. **Simpler Build**: No need to compile Rust code during development
5. **Familiar Patterns**: Uses standard JavaScript/TypeScript patterns

### Limitations

While the JavaScript-only approach is simpler, the Rust approach offers:

- Better process isolation and security
- More robust error handling
- Access to system-level APIs
- Better performance for heavy operations
- Cleaner separation of concerns

Choose the approach that best fits your team's expertise and project requirements.

## Frontend Integration

### TypeScript/JavaScript API

Create a TypeScript module to interact with the backend:

```react
// src/lib/inference.ts
import { invoke } from '@tauri-apps/api/tauri'

export interface InferenceRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
  model?: string
}

export interface InferenceResponse {
  text: string
  tokensUsed: number
  model: string
}

export class InferenceClient {
  private serverStarted = false

  async start(configPath?: string): Promise<void> {
    if (this.serverStarted) {
      return
    }

    try {
      await invoke('start_inference_server', { configPath })
      this.serverStarted = true
      console.log('MLX Inference Server started successfully')
    } catch (error) {
      console.error('Failed to start inference server:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.serverStarted) {
      return
    }

    try {
      await invoke('stop_inference_server')
      this.serverStarted = false
      console.log('MLX Inference Server stopped')
    } catch (error) {
      console.error('Failed to stop inference server:', error)
      throw error
    }
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    if (!this.serverStarted) {
      throw new Error('Server not started. Call start() first.')
    }

    try {
      const response = await invoke<InferenceResponse>('generate_text', {
        request,
      })
      return response
    } catch (error) {
      console.error('Failed to generate text:', error)
      throw error
    }
  }

  async downloadModel(modelName: string): Promise<string> {
    try {
      const result = await invoke<string>('download_model', { modelName })
      return result
    } catch (error) {
      console.error('Failed to download model:', error)
      throw error
    }
  }

  async streamGenerate(
    request: InferenceRequest,
    onChunk: (chunk: string) => void,
  ): Promise<void> {
    // For streaming, you might want to use Server-Sent Events (SSE)
    // or WebSocket connection directly to the MLX server
    const eventSource = new EventSource(
      `http://127.0.0.1:8080/v1/completions/stream?prompt=${encodeURIComponent(
        request.prompt,
      )}`,
    )

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.choices && data.choices[0].text) {
        onChunk(data.choices[0].text)
      }
    }

    eventSource.onerror = (error) => {
      console.error('Stream error:', error)
      eventSource.close()
    }

    // Return a cleanup function
    return new Promise((resolve) => {
      eventSource.addEventListener('end', () => {
        eventSource.close()
        resolve()
      })
    })
  }
}
```

### React Component Example

```tsx
// src/components/ChatInterface.tsx
import React, { useState, useEffect } from 'react'
import { InferenceClient } from '../lib/inference'

const client = new InferenceClient()

export function ChatInterface() {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverStatus, setServerStatus] = useState<
    'stopped' | 'starting' | 'running'
  >('stopped')

  useEffect(() => {
    // Start server when component mounts
    startServer()

    // Cleanup on unmount
    return () => {
      client.stop()
    }
  }, [])

  const startServer = async () => {
    setServerStatus('starting')
    try {
      await client.start()
      setServerStatus('running')
    } catch (error) {
      console.error('Failed to start server:', error)
      setServerStatus('stopped')
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || serverStatus !== 'running') {
      return
    }

    const userMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await client.generate({
        prompt: input,
        maxTokens: 512,
        temperature: 0.7,
      })

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.text },
      ])
    } catch (error) {
      console.error('Failed to generate response:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: 'Failed to generate response. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-interface">
      <div className="status-bar">
        Server Status: {serverStatus}
        {serverStatus === 'stopped' && (
          <button onClick={startServer}>Start Server</button>
        )}
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
        {loading && <div className="loading">Generating response...</div>}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          disabled={loading || serverStatus !== 'running'}
        />
        <button
          onClick={sendMessage}
          disabled={loading || serverStatus !== 'running'}
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

## Best Practices

### 1. Resource Management

- **Auto-start/stop**: Start the server when needed and stop it when the app closes
- **Memory monitoring**: Monitor memory usage and restart the server if needed
- **Model caching**: Cache frequently used models locally

```typescript
// Auto-stop server on app close
import { appWindow } from '@tauri-apps/api/window'

appWindow.onCloseRequested(async () => {
  await client.stop()
})
```

### 2. Error Handling

Implement comprehensive error handling:

```typescript
class InferenceError extends Error {
  constructor(
    message: string,
    public code: 'SERVER_NOT_STARTED' | 'MODEL_NOT_FOUND' | 'GENERATION_FAILED',
    public details?: any,
  ) {
    super(message)
    this.name = 'InferenceError'
  }
}

// Usage
try {
  const response = await client.generate(request)
} catch (error) {
  if (error instanceof InferenceError) {
    switch (error.code) {
      case 'SERVER_NOT_STARTED':
        // Handle server not started
        break
      case 'MODEL_NOT_FOUND':
        // Prompt to download model
        break
      case 'GENERATION_FAILED':
        // Retry or show error message
        break
    }
  }
}
```

### 3. Model Management

Provide UI for model management:

```typescript
interface ModelInfo {
  name: string
  size: string
  downloaded: boolean
  path?: string
}

async function listAvailableModels(): Promise<ModelInfo[]> {
  // Fetch from MLX server or maintain a local list
  const response = await fetch('http://127.0.0.1:8080/v1/models')
  return response.json()
}

async function downloadModelWithProgress(
  modelName: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  // Implement download with progress tracking
  // You might need to extend the server API for this
}
```

### 4. Performance Optimization

- **Request queuing**: Queue requests to avoid overwhelming the server
- **Response caching**: Cache common responses for instant results
- **Token limiting**: Implement client-side token counting to avoid exceeding limits

```typescript
class RequestQueue {
  private queue: Array<() => Promise<any>> = []
  private processing = false

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.process()
      }
    })
  }

  private async process() {
    this.processing = true
    while (this.queue.length > 0) {
      const request = this.queue.shift()
      if (request) {
        await request()
      }
    }
    this.processing = false
  }
}
```

### 5. Security Considerations

- **Input sanitization**: Always sanitize user inputs before sending to the model
- **Output filtering**: Filter model outputs for sensitive information
- **Rate limiting**: Implement client-side rate limiting

```typescript
function sanitizeInput(input: string): string {
  // Remove potentially harmful content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
}

function filterOutput(output: string): string {
  // Filter sensitive patterns (emails, phone numbers, etc.)
  return output
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]')
    .replace(/\b(?:\d{3}[.-]?){2}\d{4}\b/g, '[phone]')
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Server Won't Start

```typescript
// Check if port is already in use
async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`)
    return false // Port is in use
  } catch {
    return true // Port is available
  }
}

// Find available port
async function findAvailablePort(startPort: number = 8080): Promise<number> {
  let port = startPort
  while (!(await isPortAvailable(port))) {
    port++
  }
  return port
}
```

#### 2. Model Loading Issues

```typescript
// Verify model exists before generating
async function verifyModel(modelName: string): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:8080/v1/models/${modelName}`)
    return response.ok
  } catch {
    return false
  }
}
```

#### 3. Memory Issues

```typescript
// Monitor memory usage
import { invoke } from '@tauri-apps/api/tauri'

async function getMemoryUsage(): Promise<{ used: number; total: number }> {
  return invoke('get_memory_usage')
}

// Restart server if memory usage is too high
async function checkAndRestartIfNeeded() {
  const { used, total } = await getMemoryUsage()
  const usagePercent = (used / total) * 100

  if (usagePercent > 90) {
    console.log('High memory usage detected, restarting server...')
    await client.stop()
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await client.start()
  }
}
```

### Debug Logging

Enable debug logging for troubleshooting:

```rust
// In Rust backend
use log::{debug, error, info, warn};
use env_logger;

fn main() {
    env_logger::init();

    // Your Tauri app initialization
}
```

```typescript
// In frontend
const DEBUG = true

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[MLX Integration]', ...args)
  }
}
```

## Advanced Features

### 1. Streaming Responses

For real-time text generation, implement streaming:

```typescript
async function* streamGenerate(prompt: string) {
  const response = await fetch('http://127.0.0.1:8080/v1/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      stream: true,
      max_tokens: 512,
    }),
  })

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('No response body')
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6))
        if (data.choices?.[0]?.text) {
          yield data.choices[0].text
        }
      }
    }
  }
}

// Usage
for await (const chunk of streamGenerate('Hello, world!')) {
  console.log('Received chunk:', chunk)
}
```

### 2. Multiple Model Support

Support switching between different models:

```typescript
class ModelManager {
  private currentModel: string = 'default'
  private availableModels = new Map<string, ModelInfo>()

  async loadModel(modelName: string): Promise<void> {
    const response = await invoke('load_model', { modelName })
    this.currentModel = modelName
  }

  async unloadModel(modelName: string): Promise<void> {
    await invoke('unload_model', { modelName })
  }

  async switchModel(modelName: string): Promise<void> {
    if (this.currentModel !== modelName) {
      await this.unloadModel(this.currentModel)
      await this.loadModel(modelName)
    }
  }
}
```

### 3. Context Management

Implement conversation context management:

```typescript
class ConversationContext {
  private history: Array<{ role: string; content: string }> = []
  private maxTokens: number = 4096

  addMessage(role: string, content: string) {
    this.history.push({ role, content })
    this.trimContext()
  }

  private trimContext() {
    // Estimate tokens and trim old messages if needed
    let estimatedTokens = 0
    let trimIndex = this.history.length

    for (let i = this.history.length - 1; i >= 0; i--) {
      estimatedTokens += this.estimateTokens(this.history[i].content)
      if (estimatedTokens > this.maxTokens) {
        trimIndex = i + 1
        break
      }
    }

    if (trimIndex < this.history.length) {
      this.history = this.history.slice(trimIndex)
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }

  getPrompt(): string {
    return this.history.map((msg) => `${msg.role}: ${msg.content}`).join('\n')
  }
}
```

## Conclusion

This integration enables powerful local AI capabilities in your Tauri desktop application. The MLX Inference Server provides efficient model inference on macOS, while Tauri handles the desktop application framework and secure communication between the frontend and the AI backend.

Key benefits of this approach:

- **Privacy**: All processing happens locally
- **Performance**: Direct hardware acceleration via MLX
- **Flexibility**: Support for various model architectures
- **User Experience**: Native desktop application feel
- **Offline Capability**: No internet required after model download

For more information:

- [MLX Documentation](https://ml-explore.github.io/mlx/)
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [MLX Community Models](https://huggingface.co/mlx-community)
