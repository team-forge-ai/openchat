# OpenChat

Private, local-first AI chat desktop app built with Tauri (Rust) + React + TypeScript. OpenChat runs a local MLC server process and chats with models entirely on your machine.

## Features

- Local inference via MLC LLM (`mlc_llm serve`) — no cloud required
- Streaming responses with optional reasoning extraction from `<think>…</think>`
- Clean chat UI with Markdown (GFM, Math/KaTeX) and Shiki code highlighting
- Conversations and messages stored in SQLite (via Tauri SQL plugin)
- Auto-title conversations after completion
- MCP integration: add, enable/disable, and test servers (stdio supported; HTTP testing not yet implemented)
- Sensible keyboard shortcuts and responsive layout

## Quick start

1. Prerequisites
   - Node 18+ and `pnpm`
   - Rust toolchain (for Tauri): `rustup`, `cargo`
   - Tauri prerequisites for your OS (see Tauri docs)
   - MLC LLM CLI available on PATH: `mlc_llm`
     - Install and model setup: see the MLC LLM docs (`https://github.com/mlc-ai/mlc-llm`)

2. Install dependencies

```bash
pnpm install
```

3. Configure a model (optional)

- By default the app uses:
  - `HF://mlc-ai/Qwen3-14B-q4f16_1-MLC`
- To override, set `MLC_MODEL` before launching:

```bash
export MLC_MODEL="HF://mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC"
```

4. Run the desktop app

```bash
pnpm tauri dev
```

The backend auto-spawns `mlc_llm serve` on a free port, health-checks it, and updates the UI status.

## Scripts

- `pnpm dev` — Vite dev server (web only)
- `pnpm tauri dev` — run the desktop app (recommended)
- `pnpm build` — type-check and build web assets
- `pnpm typecheck` — TypeScript type checking
- `pnpm lint` — ESLint
- `pnpm fix` — Prettier + ESLint fix
- `pnpm test` — Vitest unit tests

Rust:

```bash
cd src-tauri && cargo check
```

## Configuration

- `MLC_MODEL`: MLC model id or path used by `mlc_llm serve`
  - If unset, defaults to `HF://mlc-ai/Qwen3-14B-q4f16_1-MLC`
- The app binds the MLC server to `127.0.0.1:<port>` and discovers readiness via `/v1/models`

## MCP servers

Open Settings → MCP Servers to:

- Add/edit MCP servers
  - `stdio` transport: fully supported, including test (tool listing)
  - `http` transport: UI available; server validation via test is not yet implemented
- Enable/disable servers
- Persisted to SQLite; tool listing and calls are proxied via Tauri commands

## Keyboard shortcuts

- `⌘/Ctrl + N`: New chat
- `⌘/Ctrl + B`: Toggle sidebar
- Enter to send, Shift+Enter for newline

## Architecture

- Frontend: React + TypeScript, Tailwind, shadcn/Radix UI, React Query
  - Providers: `MLCServerProvider` (MLC status + restart)
  - Shell: `AppHeader` (MLC status), `Sidebar` (conversations), `ChatWindow`
  - Markdown: ReactMarkdown + GFM + Math/KaTeX; Shiki code highlighting; custom elements
- Backend: Tauri (Rust)
  - `MLCServerManager` spawns and monitors `mlc_llm`, tracks readiness, port, PID
  - Emits `mlc-status-changed` events; exposes `mlc_get_status`, `mlc_restart`
  - SQLite via `tauri-plugin-sql`; migrations under `src-tauri/migrations/`
- Data model:
  - Tables: `conversations`, `messages` (with `reasoning`, `status: pending|complete|error`), `app_settings`, `mcp_servers`
  - FTS virtual tables for search
- Streaming/markdown:
  - Reasoning extraction from `<think>` tags via `ai` middleware
  - Shiki for code blocks

## Troubleshooting

- AI shows “starting…” and never ready
  - Ensure `mlc_llm` is on PATH
  - Set a valid `MLC_MODEL` id/path and confirm the model is downloaded
- Port conflicts
  - The app scans a small range near the desired port; stop any conflicting process
- “AI error” in header
  - Click the restart button in the header
  - Check terminal logs for `mlc_llm` STDERR

## Development notes

- Use `pnpm typecheck` and `pnpm lint` locally; fix lint issues with `pnpm fix`
- For Rust changes: `cd src-tauri && cargo check`
- Tests: `pnpm test` (Vitest)

## Privacy

All inference happens locally against your MLC server. No chat data leaves your machine unless an MCP server you configure sends requests externally.

## License

MIT
