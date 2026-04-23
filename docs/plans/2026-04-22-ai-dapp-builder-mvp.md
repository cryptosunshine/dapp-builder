# AI dApp Builder MVP Implementation Plan

> For Hermes: implement directly in this repo with a thin MVP scope. Keep it usable, readable, and easy to extend.

Goal: Build a minimal full-stack web app that accepts a contract + skill request, fetches ABI from Conflux eSpace Testnet, generates a structured pageConfig, stores it as a task result, and renders an interactive dApp preview from that pageConfig.

Architecture: Use a single TypeScript project with a React + Vite frontend, an Express backend, and shared schema/util files. The backend owns task creation, ABI fetching, contract analysis, optional LLM enhancement, and persisted task results. The frontend owns the builder form, task polling, preview routing, wallet connection, chain validation, dynamic method rendering, and result/error/risk display.

Tech Stack: TypeScript, React, Vite, Express, Zod, viem, Vitest, Testing Library.

---

## MVP scope

1. Single supported chain for now: Conflux eSpace Testnet (chainId 71).
2. Input fields: contractAddress, chain, skill, model, apiKey.
3. Backend task flow:
   - POST /api/tasks
   - persist queued task
   - fetch ABI from ConfluxScan
   - analyze contract and skill fit
   - generate pageConfig
   - save completed / failed task result
   - GET /api/tasks/:id for polling
4. Agent flow:
   - ABI fetch
   - method classification
   - skill match detection
   - dangerous method detection
   - warnings generation
   - pageConfig generation
   - optional LLM enhancement if apiKey + model are present
5. Frontend:
   - builder form
   - task status panel
   - preview route
   - wallet connect
   - network validation / switch
   - dynamic section rendering from pageConfig
   - read/write method forms
   - result area and error/risk UI

Out of scope:
- auth / user accounts
- database server
- production deployment pipeline
- full page theme system
- multi-chain engine
- contract source-code reasoning beyond ABI-driven MVP

---

## File plan

Create:
- package.json
- tsconfig.json
- tsconfig.server.json
- vite.config.ts
- index.html
- src/main.tsx
- src/App.tsx
- src/styles.css
- src/lib/api.ts
- src/lib/chains.ts
- src/lib/wallet.ts
- src/lib/contract.ts
- src/components/BuilderForm.tsx
- src/components/TaskStatusCard.tsx
- src/components/PreviewPage.tsx
- src/components/MethodCard.tsx
- src/components/WalletBar.tsx
- src/components/WarningBanner.tsx
- src/types.ts
- server/index.ts
- server/app.ts
- server/routes/tasks.ts
- server/services/abi.ts
- server/services/agent.ts
- server/services/analyzer.ts
- server/services/llm.ts
- server/services/page-config.ts
- server/services/task-store.ts
- server/config.ts
- shared/schema.ts
- tests/analyzer.test.ts
- tests/page-config.test.ts
- tests/task-store.test.ts
- tests/frontend-preview.test.tsx
- README.md
- .gitignore

Persistent data directory at runtime:
- data/tasks/*.json

---

## Implementation order

### Task 1: Scaffold base project
Objective: get a runnable React + Express TypeScript skeleton in place.
Verification:
- npm install succeeds
- npm run build succeeds once code is in place

### Task 2: Write failing unit tests for the core analysis layer
Objective: lock the expected behavior before implementing analyzer logic.
Tests to cover:
- token-dashboard skill match for ERC20-like ABI
- nft-mint-page skill match for mintable NFT ABI
- claim-page skill match for claim-heavy ABI
- staking-page skill match for stake/unstake/reward ABI
- dangerousMethods includes owner/admin/pause/upgrade/set* methods
- pageConfig groups methods into useful sections
- task store persists and reloads tasks
- preview renderer shows warnings and method labels from pageConfig
Verification:
- vitest reports expected failures before implementation

### Task 3: Implement shared schema and chain config
Objective: centralize task input, task result, pageConfig, section, method, and warning types.
Verification:
- tests compile
- schema validation works in backend route parsing

### Task 4: Implement task store and API routes
Objective: backend can create, update, persist, and return tasks.
Verification:
- task store tests pass
- POST /api/tasks returns task id + queued/processing state
- GET /api/tasks/:id returns persisted status

### Task 5: Implement ABI fetcher and analyzer
Objective: fetch ABI from ConfluxScan and classify contract capabilities from ABI alone.
Verification:
- analyzer tests pass
- fetcher handles missing ABI / invalid address with clear errors

### Task 6: Implement pageConfig generator and optional LLM enhancement
Objective: build a structured pageConfig with warnings, dangerousMethods, methods, and sections. If apiKey/model exist, ask an OpenAI-compatible model to improve labels/descriptions but always fall back safely to deterministic output.
Verification:
- page config tests pass
- malformed LLM output falls back to deterministic config

### Task 7: Implement frontend builder and polling flow
Objective: collect inputs, create task, poll status, and route into preview.
Verification:
- form can submit
- UI reflects queued / processing / completed / failed

### Task 8: Implement dynamic preview page and contract interaction
Objective: render sections from pageConfig and support wallet-based method interaction.
Verification:
- read methods call public client
- write methods require wallet + chain validation
- warning banners and result/error panels display correctly

### Task 9: Polish docs and run verification
Objective: document how to run the MVP and ensure build/tests pass.
Verification:
- npm run test passes
- npm run build passes
- README explains dev workflow and architecture clearly

---

## Key design rules

1. Deterministic first, AI second.
   - The app must still work if model/apiKey are invalid.
   - ABI-based heuristics are the source of truth for method safety and rendering.

2. Keep pageConfig explicit.
   - Frontend should not need to infer meaning from raw ABI at render time.
   - Each rendered method should carry enough metadata to build a usable form.

3. Thin storage.
   - Persist tasks as JSON files under data/tasks.
   - No database for MVP.

4. Accessible, not flashy.
   - Simple layout, readable warnings, obvious buttons, clear errors.

5. Easy to extend.
   - Shared schema first.
   - Add new skills by extending analyzer heuristics + page config presets.

---

## Verification commands

- npm install
- npm run test
- npm run build
- npm run dev

Expected end state:
- local full-stack app runs
- user can submit a testnet contract + skill request
- backend returns a stored task result with pageConfig
- frontend renders a usable interactive dApp preview from pageConfig
