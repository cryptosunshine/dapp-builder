# AI dApp Builder MVP

A thin full-stack MVP that turns a contract ABI into a usable dApp preview.

## What it does

1. Frontend collects:
   - contractAddress
   - chain
   - selected skills
   - optional modelConfig
2. Backend creates a task and processes it:
   - fetch ABI from ConfluxScan
   - analyze contract capabilities
   - normalize selected skills
   - build capability primitives
   - classify methods
   - flag dangerous/admin methods
   - generate deterministic pageConfig and experience fallback
   - call `hermes-agent` for guided product experience generation
   - validate agent output against deterministic methods and warnings
   - optionally let an OpenAI-compatible model improve copy
   - store task result on disk without API keys
3. Frontend polls task status and renders a product-like preview from the validated experience schema.

## Supported chain

- Conflux eSpace Testnet
- chainId: 71
- rpcUrl: https://evmtestnet.confluxrpc.com

## Supported MVP skills

Business:
- auto
- token-dashboard
- nft-mint-experience
- voting-participation

Wallet:
- injected-wallet
- eip-6963-wallet-discovery
- chain-switching

Experience:
- guided-flow
- transaction-timeline
- risk-explainer
- explorer-links

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
- `server/services/capabilities.ts` — capability primitive generation
- `server/services/experience.ts` — deterministic experience fallback
- `server/services/experience-validator.ts` — guided agent output validation
- `server/services/skills.ts` — skill registry and normalization
- `server/services/page-config.ts` — deterministic pageConfig safety boundary
- `server/services/hermes-agent.ts` — hermes-agent subprocess integration for generated page output
- `server/services/agent.ts` — task orchestration
- `server/services/llm.ts` — optional OpenAI-compatible enhancement step
- `server/services/task-store.ts` — JSON task persistence
- `src/App.tsx` — builder + task preview routes
- `src/components/TaskStatusCard.tsx` — task progress/failure/completion status UI
- `src/components/PreviewPage.tsx` — dynamic preview renderer
- `src/lib/contract.ts` — read/write contract execution via viem
- `shared/schema.ts` — source-of-truth task/pageConfig schema

## Architecture in one pass

The backend is deterministic-first, agent-generated second:
- parse and validate task input
- fetch ABI
- analyze the ABI for contract capabilities and risky methods
- normalize selected skills
- build capability primitives
- build deterministic `pageConfig` and `experience` safety boundaries
- call `hermes-agent` with sanitized task, ABI, skills, capabilities, pageConfig, and experience context
- validate generated experience before rendering
- optionally enhance copy with an OpenAI-compatible model if `modelConfig.apiKey` + `modelConfig.model` are present
- persist the task as JSON under `data/tasks/`

The frontend is pageConfig-driven:
- submit a task
- poll `/api/tasks/:id`
- render status changes (`queued`, `processing`, `completed`, `failed`)
- render the preview from `pageConfig.experience` when present
- fall back to legacy pageConfig section rendering
- run read/write methods through viem + injected wallet flow

Important rule: deterministic ABI analysis stays the source of truth. Agent/LLM output can improve generated experience structure and copy, but must not override safety-critical methods, dangerous-method flags, or warnings.

### Agent runtime

The backend runs the multi-stage dApp generation agents after ABI analysis creates the deterministic safety boundary. It first tries a local `hermes-agent` runtime. If that command is not installed, it uses the submitted OpenAI-compatible `modelConfig.baseUrl`, `modelConfig.model`, and `modelConfig.apiKey` for the agent calls.

Local runtime knobs:

- `HERMES_AGENT_COMMAND` — command to execute, default `hermes-agent`
- `HERMES_AGENT_TIMEOUT_MS` — subprocess timeout, default `120000`
- `HERMES_AGENT_MAX_BUFFER_BYTES` — stdout buffer cap, default `2000000`
- `AGENT_API_TIMEOUT_MS` — OpenAI-compatible API request timeout, default `600000`
- `AGENT_API_MAX_ATTEMPTS` — OpenAI-compatible API retry attempts for transient network/429/5xx failures, default `3`

The submitted model API key is never persisted. It is only used for the live task process, either as the local agent subprocess API key or as the Authorization header for the configured OpenAI-compatible API fallback.

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
4. backend builds deterministic `pageConfig` + `experience`, calls hermes-agent for guided experience output, then validates and safely merges allowed layout/copy
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
  "skills": ["token-dashboard", "eip-6963-wallet-discovery", "guided-flow"],
  "modelConfig": {
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-5.4",
    "apiKey": "***"
  }
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
- `experience`
- page title/description/contract metadata

The frontend renders from `experience` first, then falls back to legacy sections. It never infers UI from raw ABI at render time.

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
