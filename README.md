# ArnAIv

ArnAIv is a desktop AI chat application built with Electron, React, TypeScript, and the OpenAI API. It provides a focused, local-first chat experience: conversations are stored as JSON files on the user’s computer and assistant responses stream into the interface as they are generated.

## Features

- Desktop interface with a session sidebar and new-chat flow
- Streaming OpenAI responses
- Local conversation persistence in Electron’s application-data directory
- Previous-session selection and continuation
- Secure Electron IPC boundary: the OpenAI API key stays in the main process
- Configurable default model and system prompt

## Requirements

- Node.js 22 or later
- An OpenAI API key

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root using `.env.example` as a reference:

```env
OPENAI_API_KEY=your_api_key_here
```

The `.env` file is ignored by Git and is never exposed to the renderer process.

## Run in development

```bash
npm run dev
```

This starts the Vite development server and opens the ArnAIv Electron window. The `localhost:5173` address is the renderer development server; use the Electron window for the application.

## Other commands

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

## Architecture

The code is separated by responsibility:

- `src/main` — Electron main process, IPC handlers, OpenAI client, and local session service
- `src/preload` — minimal, secure renderer API bridge
- `src/renderer` — React chat interface
- `src/shared` — shared types and configuration

Session files are written atomically under Electron’s `userData/sessions` directory to help preserve chat history if the application stops unexpectedly.
