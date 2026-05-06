# MathTales

MathTales is an offline educational application that generates interactive math stories for elementary students (Grades 1–5). It runs a local language model to create adventure narratives where math problems are embedded as story obstacles. No internet connection or API keys required.

## Overview

The core idea is simple: instead of presenting math as worksheets, MathTales presents it as a story. A student picks a theme — say, "Space Explorer" — and the AI generates a narrative where the hero encounters math problems as real-world challenges (counting fuel cells, measuring distances, splitting rations). The student solves the problem to advance the story.

The system uses a locally-running Gemma 4 model (1.5 GB, 4-bit quantized) via `node-llama-cpp`, backed by a SQLite database for progress tracking and a curriculum-aligned knowledge base for grade-appropriate problem generation.

## Getting Started

**Requirements:** Node.js 20+, 8 GB RAM, ~2 GB disk space.

```bash
# Install dependencies
npm install

# Compile the native inference addon (first time only, ~2-3 min)
npx --no node-llama-cpp source download
npx --no node-llama-cpp build

# Download the model (~1.5 GB from HuggingFace)
npm run download-model

# Start the application
npm run dev
```

Open `http://localhost:3000`. The first story turn takes ~60–90 seconds on CPU. Subsequent turns benefit from KV-cache reuse and background prefetching.

> If you skip the model download, the app runs in demo mode with pre-written stories.

## How It Works

**Story generation** follows a two-layer prompt architecture:

1. A **system prompt** is sent once per session. It establishes the theme, the narrative voice, and a randomized "world hook" (e.g., *"Shadows have a life of their own"*) that forces creative diversity. This prompt stays in the model's KV cache for the entire session.

2. A **turn prompt** is sent each round. It's lightweight (~100 tokens) and specifies the current narrative style, a randomized math problem type appropriate for the student's grade, and optionally a curriculum topic from the RAG knowledge base.

**When a student answers correctly**, the story automatically continues. While the student is reading and solving, a background process prefetches the next story segment so it's ready instantly.

**The hint system** generates a `[HINT: ...]` token alongside each answer. Hints focus on strategy ("Try grouping the items by fives") rather than giving away the solution. The student can reveal the hint by clicking a button.

## Project Structure

```
server.ts            Express server, LLM session pool, SSE streaming, API routes
src/App.tsx          React frontend — story UI, dashboard, oversight panel
data/math_kb.json    Curriculum knowledge base: 30 topics, 108 examples across Grades 1–5
scripts/             Model download script
```

## Key Design Decisions

**Why local inference?** Privacy. Student data never leaves the machine. The app works in schools with restricted internet access or data protection requirements.

**Why session pooling?** Without it, every story turn re-tokenizes the full conversation history. With a persistent `LlamaChatSession` per student, the model's KV cache stays warm and subsequent turns start generating immediately.

**Why background prefetching?** CPU inference is slow (~2-3 tokens/second). Prefetching hides this latency by generating the next segment while the student is still solving the current problem.

**Why randomized world hooks?** Small models tend to fall into repetitive patterns. Injecting a unique constraint per session ("Everything is made of candy", "Water flows upward") forces the model into novel territory even when the theme is reused.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/student` | POST | Create student |
| `/api/student/:id` | GET | Get student profile |
| `/api/story/stream` | POST | Generate story segment (SSE) |
| `/api/story/prefetch` | POST | Pre-generate next segment |
| `/api/story/prefetch/:id` | GET | Check prefetch status |
| `/api/session/reset` | POST | Clear cached LLM session |
| `/api/progress` | POST | Log answer, update XP |
| `/api/oversight/:id` | GET | Teacher dashboard data |

## Tech Stack

- **Frontend:** React 19, Tailwind CSS 4, Motion, Recharts
- **Backend:** Express, TypeScript
- **Inference:** node-llama-cpp (llama.cpp bindings) with Gemma 4 E2B-it Q4_K_M
- **Database:** SQLite (WAL mode) via better-sqlite3
- **Build:** Vite 6

## Scripts

```bash
npm run dev              # Development server (port 3000)
npm run build            # Production build
npm run lint             # TypeScript type-check
npm run download-model   # Download model from HuggingFace
```

## License

MIT
