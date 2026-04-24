# AI dApp Builder MVP

A thin full-stack MVP that turns a contract ABI into a usable dApp preview.

## What it does

1. Frontend collects:
   - contractAddress
   - chain
   - skill
   - model
   - apiKey
2. Backend creates a task and processes it:
   - fetch ABI from ConfluxScan
   - analyze contract shape
   - detect skill fit
   - classify methods
   - flag dangerous/admin methods
   - generate pageConfig
   - optionally let an OpenAI-compatible model improve labels/descriptions
   - store task result on disk
3. Frontend polls task status and renders a dynamic preview page from pageConfig.

## Supported chain

- Conflux eSpace Testnet
- chainId: 71
- rpcUrl: https://evmtestnet.confluxrpc.com

## Supported MVP skills

- token-dashboard
- nft-mint-page
- claim-page
- staking-page

## Tech stack

- React + Vite
- Express
- TypeScript
- Zod
- viem
- Vitest + Testing Library

## Project structure

- `src/` — frontend app, routes, components, wallet + contract helpers
- `server/` — Express app, task routes, ABI/analyzer/page-config/task services
- `shared/` — shared schemas and types used by frontend + backend
- `tests/` — unit/component/regression tests
- `data/tasks/` — persisted task results at runtime
- `docs/plans/` — implementation plan
- `docs/prompts/` — prompt references used during development

## Key files

- `server/app.ts` — Express app wiring and API routes
- `server/routes/tasks.ts` — task create/get endpoints
- `server/services/abi.ts` — ConfluxScan ABI fetch
- `server/services/analyzer.ts` — deterministic ABI analysis + skill fit
- `server/services/page-config.ts` — pageConfig generation
- `server/services/agent.ts` — task orchestration
- `server/services/llm.ts` — optional OpenAI-compatible enhancement step
- `server/services/task-store.ts` — JSON task persistence
- `src/App.tsx` — builder + task preview routes
- `src/components/TaskStatusCard.tsx` — task progress/failure/completion status UI
- `src/components/PreviewPage.tsx` — dynamic preview renderer
- `src/lib/contract.ts` — read/write contract execution via viem
- `shared/schema.ts` — source-of-truth task/pageConfig schema

## Architecture in one pass

The backend is deterministic-first:
- parse and validate task input
- fetch ABI
- analyze the ABI for contract capabilities and risky methods
- build a structured `pageConfig`
- optionally enhance copy with an LLM if `apiKey` + `model` are present
- persist the task as JSON under `data/tasks/`

The frontend is pageConfig-driven:
- submit a task
- poll `/api/tasks/:id`
- render status changes (`queued`, `processing`, `completed`, `failed`)
- render the preview directly from `pageConfig`
- run read/write methods through viem + injected wallet flow

Important rule: deterministic ABI analysis stays the source of truth. LLM output can improve labels/descriptions, but must not override safety-critical structure.

## Install

```bash
npm install
```

## Development

Start the full stack:

```bash
npm run dev
```

This starts:
- backend on `http://localhost:8787`
- frontend on `http://localhost:5173`

### External access / remote dev

By default the Vite dev server binds to `localhost`.

If you want to access the frontend from another machine, start it with:

```bash
VITE_HOST=0.0.0.0 npm run dev
```

You can also override the port:

```bash
VITE_HOST=0.0.0.0 VITE_PORT=5173 npm run dev
```

The backend still listens on port `8787`.

## Test

Run the full suite:

```bash
npm test
```

Useful targeted UI regression set:

```bash
npm test -- --run tests/app-route.test.tsx tests/frontend-preview.test.tsx tests/task-status-card.test.tsx
```

## Build

```bash
npm run build
```

## Task flow

1. `POST /api/tasks`
2. server persists a queued task
3. backend fetches ABI + analyzes the contract
4. backend generates `pageConfig`
5. task becomes `completed` or `failed`
6. frontend polls `GET /api/tasks/:id`
7. completed tasks render preview UI; failed tasks render recovery/error UX

## API

### POST /api/tasks

Create a task.

Example body:

```json
{
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "chain": "conflux-espace-testnet",
  "skill": "claim-page",
  "model": "gpt-5.4",
  "apiKey": "***"
}
```

### GET /api/tasks/:id

Fetch task status/result.

Possible statuses:
- `queued`
- `processing`
- `completed`
- `failed`

### GET /api/health

Simple health endpoint:

```json
{ "ok": true }
```

## pageConfig shape

The backend returns a pageConfig with:
- `warnings`
- `dangerousMethods`
- `methods`
- `sections`
- page title/description/contract metadata

The frontend renders from this structure directly instead of inferring UI from raw ABI at render time.

## Notes

- Storage is file-based for MVP simplicity.
- Deterministic ABI analysis is the source of truth.
- LLM enhancement is optional and safe to fail.
- Wallet flow assumes an injected EVM wallet such as MetaMask.
- Failed tasks intentionally avoid rendering misleading preview links.

## Prompt reference docs

Reference prompt files live in `docs/prompts/`:

- `docs/prompts/backend-development-prompt.md`
- `docs/prompts/agent-execution-prompt.md`
- `docs/prompts/frontend-dynamic-preview-prompt.md`
