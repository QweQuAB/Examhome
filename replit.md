# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **`artifacts/api-server`** — Shared Express API server mounted at `/api`. Routes for exams, questions, attempts, dashboard. All input/output validated with Zod schemas generated from `lib/api-spec/openapi.yaml`.
- **`artifacts/examforge`** — ExamForge React + Vite app at `/`. Professional exam generator with MCQ creation, shuffled quiz attempts, results review, dashboard, and per-exam stats. Uses Wouter for routing and react-query hooks generated from the OpenAPI spec.

## Database (Drizzle)

Schema lives in `lib/db/src/schema/exams.ts`:
- `exams` (id, title, courseCode, institution, description)
- `questions` (examId, topic, prompt, options[], correctIndex, explanation, reference, repeatNote, position)
- `attempts` (examId, status enum, score, total, startedAt, finishedAt)
- `attempt_questions` (attemptId, questionId, optionOrder[], correctIndex remapped, selectedIndex, isCorrect)

`correctIndex` is never returned to the client until the user has answered the question.

## Seed Data

`pnpm --filter @workspace/scripts run seed-asp401` — seeds the ASP 401 (African Studies) exam with 15 past questions extracted from the attached HTML. Idempotent (skips if exam already exists).
