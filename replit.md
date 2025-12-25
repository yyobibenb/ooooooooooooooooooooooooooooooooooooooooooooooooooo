# AI-Powered IDE Platform

## Overview

This is a full-stack AI-powered IDE (Integrated Development Environment) built as a web application. It combines a Monaco code editor, file management, and an AI chat assistant powered by Anthropic's Claude models. Users can create projects, manage files, write code, and interact with an AI assistant for coding help. The design follows Apple HIG guidelines with a glassmorphism aesthetic.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with custom glassmorphism design system
- **Code Editor**: Monaco Editor (@monaco-editor/react)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Session Management**: express-session with connect-pg-simple store
- **Authentication**: Custom email/password auth with bcrypt hashing
- **AI Integration**: Anthropic Claude SDK for chat and agent features

### Key Design Patterns
- **Three-Panel IDE Layout**: File explorer (left), code editor (center), AI chat (right) using resizable panels
- **API Route Contracts**: Shared route definitions in `shared/routes.ts` with Zod validation
- **Streaming Responses**: Server-Sent Events (SSE) for AI chat responses
- **Agent Architecture**: Multi-step AI agent with tool execution capabilities (read/write files, run commands)

### Database Schema
Located in `shared/schema.ts`:
- `users`: Authentication (email, hashed password)
- `projects`: User projects with name and description
- `files`: Project files with content and language
- `conversations`: AI chat threads
- `messages`: Individual chat messages (user/assistant roles)
- `session`: Express session storage

### AI System Architecture
Located in `server/ai/`:
- **Model Router**: Routes tasks to appropriate Claude models (Haiku for classification, Sonnet for chat, Opus for complex agent tasks)
- **Agent Orchestrator**: Multi-step reasoning loop with tool use
- **Tool Executor**: Sandboxed file operations and command execution with safety checks
- **Chat Service**: Streaming responses with conversation context

## External Dependencies

### AI Services
- **Anthropic Claude API**: Primary AI provider (`@anthropic-ai/sdk`)
  - Requires `ANTHROPIC_API_KEY` environment variable
  - Uses models: claude-haiku-4-5, claude-sonnet-4-5, claude-opus-4-5

### Database
- **PostgreSQL**: Primary database
  - Requires `DATABASE_URL` environment variable
  - Managed via Drizzle Kit migrations (`drizzle-kit push`)

### Key NPM Packages
- `@monaco-editor/react`: Code editor
- `@tanstack/react-query`: Data fetching
- `drizzle-orm` / `drizzle-zod`: Database ORM with validation
- `express-session` / `connect-pg-simple`: Session handling
- `bcrypt`: Password hashing
- `wouter`: Client-side routing
- `framer-motion`: Animations
- `react-resizable-panels`: IDE panel layout

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude
- `SESSION_SECRET`: Secret for session encryption (optional, defaults to dev-secret)