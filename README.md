# OpenChat

Private, local-first AI chat desktop app built with Tauri (Rust) + React + TypeScript. OpenChat runs a local MLC server process and chats with models entirely on your machine.

<img width="2846" height="2046" alt="Welcome to OpenChat!" src="https://github.com/user-attachments/assets/228a684f-c0ff-4418-9121-fd219b42ccb9" />

## Features

- **Local Inference**: Chat with a variety of LLMs running locally via MLC LLM.
- **Privacy-First**: Your conversations never leave your machine.
- **Streaming Responses**: Get real-time feedback from the AI as it thinks.
- **Reasoning**: See the AI's thought process with `<think>` tag extraction.
- **Rich Markdown**: Full support for Markdown, including GFM, Math/KaTeX, and Shiki code highlighting.
- **Conversation Management**: All conversations are stored locally in a SQLite database.
- **Search**: Full-text search for conversations and messages.
- **AI Tools (MCP)**: Extend AI capabilities by adding tools via the Model Context Protocol (MCP).
- **Model Management**: Download new models from Hugging Face and switch between them from within the app.

## Usage

### Download

You can download the latest release from the [Releases](https://github.com/openai-chat/openchat/releases) page.

### System Requirements

- Apple Silicon
- macOS 15.5+
- 32GB of RAM

### App damaged error

If you see a "OpenChat is damaged and can't be opened" error, run this to override the gatekeeper:

```bash
xattr -dr com.apple.quarantine /Applications/OpenChat.app
```

## Developer Quick Start

The following instructions are just for developers who want to contribute to the project.

### Prerequisites

1.  **Node.js**: Version 18+ and `pnpm`.
2.  **Rust**: The Rust toolchain (`rustup`, `cargo`).
3.  **Tauri**: Follow the [Tauri prerequisites guide](https://tauri.app/v1/guides/getting-started/prerequisites) for your OS.
4.  **MLC LLM**: The MLC LLM command-line tools must be installed and available on your `PATH`. See the [MLC LLM documentation](https://github.com/mlc-ai/mlc-llm) for setup instructions.

### Installation & Running

1.  **Install dependencies**:

    ```bash
    pnpm install
    ```

2.  **Run the app**:
    ```bash
    pnpm tauri dev
    ```

The app will start, and the backend will automatically spawn an `mlc_llm serve` process on a free port, health-check it, and update the UI status.

## Default Model

OpenChat uses a default model if none is selected in the settings. The current default is:

- `lmstudio-community/Qwen3-30B-A3B-Instruct-2507-MLX-4bit`

You can download this model or choose another from the **Settings > Model** view inside the app.

## Settings

You can configure OpenChat by navigating to the settings view ( `⌘/Ctrl + ,` ).

- **System Prompt**: Customize the system prompt to guide the AI's behavior.
- **Model**: Select the model to use for your conversations.
- **Download Model**: Download new MLX-compatible models from Hugging Face.
- **AI Tools**: Add, configure, and test MCP servers to provide tools to your AI.
- **Danger Zone**: Permanently delete all conversation history.

## Keyboard Shortcuts

- `⌘/Ctrl + N`: New chat
- `⌘/Ctrl + B`: Toggle sidebar
- `⌘/Ctrl + ,`: Open settings
- `Enter`: Send message
- `Shift + Enter`: Newline in message

## Architecture

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/Radix UI, and TanStack Query.
- **Backend**: Tauri (Rust)
  - `MLCServerManager`: Spawns and monitors the `mlc_llm` process, tracks its status, and communicates with the frontend via events.
  - **Database**: SQLite via `tauri-plugin-sql` with migrations located in `src-tauri/migrations/`.
- **Data Model**:
  - `conversations`: Stores conversation metadata.
  - `messages`: Stores individual chat messages, including reasoning and status.
  - `app_settings`: Stores global settings like the system prompt and selected model.
  - `mcp_servers`: Stores configuration for AI tools.

## Development

- **Run frontend only**: `pnpm dev`
- **Run desktop app**: `pnpm tauri dev`
- **Build assets**: `pnpm build`
- **Type-check**: `pnpm typecheck`
- **Lint**: `pnpm lint`
- **Fix linting issues**: `pnpm fix`
- **Run tests**: `pnpm test`
- **Check Rust code**: `cd src-tauri && cargo check`

## Privacy

All inference happens locally against your MLC server. No chat data leaves your machine unless an MCP server you configure sends requests externally.

## Screenshots

<img width="2846" height="2046" alt="Chat with a model" src="https://github.com/user-attachments/assets/d94a9caf-e9aa-4e5b-a8ae-19d938107d3d" />

<img width="2846" height="2046" alt="Settings" src="https://github.com/user-attachments/assets/2c4ed531-23b8-4763-983f-eb981682d6ca" />

<img width="2846" height="2046" alt="MCP Servers" src="https://github.com/user-attachments/assets/0f2b0166-11ec-4edd-aa1c-d17b0ef9dbb3" />

## License

MIT
