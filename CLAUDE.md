# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup
```bash
yarn setup                    # Complete setup: install deps, create .env files, setup Prisma DB
yarn setup:envs              # Copy example .env files to actual .env files
yarn prisma:setup            # Generate Prisma client, run migrations, seed database
```

### Development Servers
```bash
yarn dev:server              # Start server (localhost:3001) - backend API
yarn dev:frontend            # Start frontend (localhost:3000) - React UI  
yarn dev:collector           # Start document collector (localhost:8888)
yarn dev:all                 # Start all services concurrently
```

### Database Management
```bash
yarn prisma:generate         # Generate Prisma client after schema changes
yarn prisma:migrate          # Run database migrations
yarn prisma:seed             # Seed database with initial data
yarn prisma:reset            # Reset database and re-run migrations
```

### Production & Testing
```bash
yarn prod:server             # Start production server
yarn prod:frontend           # Build frontend for production
yarn test                    # Run Jest tests
yarn lint                    # Run linting across all projects
```

## Architecture Overview

AnythingLLM is a monorepo consisting of three main applications:

### Core Applications

**Frontend** (`/frontend`) - React + Vite application
- Main UI for managing workspaces, documents, and chat interactions
- Built with React 18, TailwindCSS, and modern tooling
- Handles authentication, workspace management, and chat interface
- Supports multi-modal interactions and AI agent flows

**Server** (`/server`) - Node.js + Express API server  
- RESTful API and WebSocket endpoints for all backend operations
- Handles LLM interactions, vector database operations, and user management
- Built with Express, Prisma ORM, and extensive LLM provider integrations
- Manages workspaces, documents, embeddings, and chat history

**Collector** (`/collector`) - Document processing service
- Specialized service for parsing and processing various document types
- Handles PDF, DOCX, web scraping, YouTube transcripts, and more
- Converts documents to vectorizable text chunks
- Runs independently to isolate heavy processing workloads

### Key Architecture Patterns

**Database Layer**
- Prisma ORM with SQLite (default) or PostgreSQL
- Schema defined in `/server/prisma/schema.prisma`
- Models for workspaces, documents, users, chats, embeddings, and system settings

**LLM Provider Architecture**
- Modular provider system in `/server/utils/AiProviders/`
- Supports 20+ LLM providers (OpenAI, Anthropic, local models, etc.)
- Unified interface with provider-specific implementations
- Automatic model discovery and validation

**Vector Database Integration**
- Pluggable vector DB system in `/server/utils/vectorDbProviders/`
- Supports LanceDB (default), Pinecone, Chroma, Qdrant, Weaviate, and more
- Handles document embeddings and similarity search

**Agent System**
- AI Agent framework in `/server/utils/agents/`
- Supports custom agents with tools and workflows
- Built-in agents for web browsing, SQL queries, file operations
- Agent flows for complex multi-step operations

**MCP (Model Context Protocol) Support**
- Full MCP compatibility for external context providers
- MCP server management in `/server/utils/MCP/`
- Hypervisor pattern for managing multiple MCP connections

## Key Technologies

- **Backend**: Node.js 18+, Express, Prisma, SQLite/PostgreSQL
- **Frontend**: React 18, Vite, TailwindCSS, React Router
- **Document Processing**: Puppeteer, PDF parsing, OCR, media transcription
- **AI/ML**: LangChain, vector embeddings, multiple LLM providers
- **WebSockets**: Real-time chat and agent interactions
- **Authentication**: JWT tokens, multi-user support

## Environment Configuration

Each service requires its own `.env` file:
- `/server/.env.development` - Server configuration (required)
- `/frontend/.env` - Frontend configuration  
- `/collector/.env` - Collector service configuration
- `/docker/.env` - Docker deployment configuration

Critical server environment variables include database URL, LLM provider API keys, and vector database settings.

## Docker Support

Full Docker deployment available:
```bash
# See /docker/HOW_TO_USE_DOCKER.md for complete instructions
docker-compose up -d
```

Docker configuration includes multi-user support and production optimizations not available in development mode.

## Testing Strategy

- Jest for unit tests (mainly in `/server/__tests__/`)
- Focus on utility functions, database operations, and LLM integrations
- Agent system testing for complex workflows
- Integration tests for OpenAI compatibility endpoints

## Document Processing Workflow

1. Documents uploaded through frontend drag-n-drop
2. Collector service processes documents based on MIME type
3. Text extracted and chunked for optimal embedding
4. Chunks embedded using configured embedding model
5. Vectors stored in vector database linked to workspace
6. Documents searchable via semantic similarity during chat

This architecture enables private, local-first AI chat while supporting cloud LLM providers and vector databases as needed.