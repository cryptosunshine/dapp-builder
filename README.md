# AI dApp Builder MVP

A minimal full-stack MVP for generating a usable dApp preview from a smart contract ABI.

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
   - optionally let an LLM improve labels/descriptions
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

- `src/` — frontend
- `server/` — backend services and API
- `shared/` — shared schemas/types
- `tests/` — unit/component tests
- `data/tasks/` — persisted task results at runtime
- `docs/plans/` — implementation plan
- `docs/prompts/` — prompt placeholders you can fill later

## Key files

- `server/services/abi.ts` — ABI fetch from ConfluxScan
- `server/services/analyzer.ts` — deterministic ABI analysis
- `server/services/page-config.ts` — pageConfig generation
- `server/services/agent.ts` — task orchestration
- `server/services/llm.ts` — optional OpenAI-compatible enhancement step
- `server/routes/tasks.ts` — task API
- `src/components/PreviewPage.tsx` — dynamic preview renderer
- `src/lib/contract.ts` — read/write contract execution via viem

## Install

```bash
npm install
```

## Run in development

```bash
npm run dev
```

This starts:
- backend on `http://localhost:8787`
- frontend on `http://localhost:5173`

## Run tests

```bash
npm test
```

## Build

```bash
npm run build
```

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
  "apiKey": "your-api-key"
}
```

### GET /api/tasks/:id

Fetch task status/result.

Possible statuses:
- `queued`
- `processing`
- `completed`
- `failed`

## pageConfig shape

The backend returns a pageConfig with:
- `warnings`
- `dangerousMethods`
- `methods`
- `sections`
- page title/description/contract metadata

The frontend renders directly from this structure instead of inferring UI from raw ABI at runtime.

## Notes

- Storage is file-based for MVP simplicity.
- Deterministic ABI analysis is the source of truth.
- LLM enhancement is optional and safe to fail.
- Wallet flow currently assumes an injected EVM wallet like MetaMask.

## Prompt extension points

You said you will later provide:
- backend development prompt
- agent execution prompt
- frontend dynamic preview prompt

Placeholders are ready here:
- `docs/prompts/backend-development-prompt.md`
- `docs/prompts/agent-execution-prompt.md`
- `docs/prompts/frontend-dynamic-preview-prompt.md`

If you want, I can wire those prompt files directly into `server/services/llm.ts` next.
