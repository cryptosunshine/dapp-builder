# Top-Tier AI dApp Productization Plan

> For Hermes: implement directly in this repo in sharp, small, user-visible slices. Treat this as the active roadmap for turning dapp-builder from an ABI previewer into a product-quality dApp generator.

Goal: Transform dapp-builder into an AI-assisted contract productizer that turns ABI analysis into a polished, user-friendly dApp with clear user tasks, wallet-aware data surfaces, and safe interaction flows.

Architecture: Keep deterministic ABI analysis as the safety boundary for methods, risk labels, and allowed operations. Layer richer product intent on top of that boundary via better agent prompts, richer pageConfig semantics, and frontend components that render task-oriented dApp surfaces instead of generic method grids.

Tech Stack: TypeScript, React, Vite, Express, Zod, viem, Vitest, Testing Library, hermes-agent integration.

---

## Product bar

The generated result should feel like a real dApp product, not a block explorer:
- hero explains purpose in user language
- primary actions are obvious
- wallet-aware data appears in the right place
- common contract tasks are grouped into flows
- dangerous/admin actions are isolated
- ERC20, NFT, claim, and staking contracts each get product-specific structure

---

## Phase 1 — Product intent injection into agent generation

Objective: make the backend generation prompt explicitly optimize for product-quality dApp UX instead of generic method listing.

Success criteria:
- hermes-agent prompt includes “not scan / not ABI dump / productized dApp” guidance
- ERC20-specific user tasks like balance, transfer, approvals, revoke approval are explicitly requested
- tests prove the prompt contains productization instructions

Files:
- Create: `docs/prompts/agent-generated-dapp-product-prompt.md`
- Modify: `server/services/hermes-agent.ts`
- Test: `tests/hermes-agent.test.ts`

Verification:
- `npm test -- --run tests/hermes-agent.test.ts tests/agent.test.ts`
- `npm run build`

---

## Phase 2 — Richer pageConfig semantics for product surfaces

Objective: extend pageConfig so the generator can describe product intent, not just flat sections and methods.

Add schema concepts like:
- page-level `productType` / `userIntent`
- highlighted `primaryActions`
- wallet-dependent `dataPanels`
- `advancedMethods` / `dangerZone`
- per-method `userGoal`, `requiresWallet`, `recommended`, `hiddenByDefault`

Success criteria:
- schema can represent a token dashboard as a product surface
- deterministic generator can populate useful defaults for token/nft/claim/staking
- old previews still render safely if fields are absent

Files:
- Modify: `shared/schema.ts`
- Modify: `server/services/page-config.ts`
- Modify: `server/services/analyzer.ts`
- Test: `tests/page-config.test.ts`
- Test: `tests/analyzer.test.ts`

Verification:
- focused test red → green for new schema fields
- `npm test -- --run tests/page-config.test.ts tests/analyzer.test.ts`
- `npm run build`

---

## Phase 3 — ERC20 flagship experience

Objective: make ERC20 output feel like a real token operations dApp.

Required UX:
- hero with token identity and simple explanation
- wallet balance panel
- transfer panel
- approvals panel
- revoke approval flow surfaced as a first-class safety action
- advanced reads separated from main task flow
- danger/admin actions isolated

Success criteria:
- token page is clearly more valuable than scan
- the most common token operations are visible without hunting through ABI names
- preview tests assert presence/order of token-specific panels

Files:
- Modify: `server/services/page-config.ts`
- Modify: `src/components/PreviewPage.tsx`
- Modify: `src/components/MethodCard.tsx`
- Create/Modify tests around token preview rendering

Verification:
- `npm test -- --run tests/frontend-preview.test.tsx tests/agent.test.ts tests/hermes-agent.test.ts`
- `npm run build`

---

## Phase 4 — Wallet-aware live utility panels

Objective: upgrade preview from static generated copy to useful wallet-aware interaction surfaces.

Potential slices:
- “Your wallet” panel for ERC20/NFT/staking pages
- balance auto-load after wallet connect
- allowance lookup shortcuts
- prefilled wallet address where appropriate
- clearer waiting/success/failure copy around writes

Success criteria:
- page feels alive after wallet connection
- common read data is surfaced automatically instead of requiring manual method calls

Files:
- Modify: `src/lib/contract.ts`
- Modify: `src/components/PreviewPage.tsx`
- Modify: `src/components/WalletBar.tsx`
- Modify tests around preview behavior

Verification:
- targeted frontend tests
- `npm run build`

---

## Phase 5 — Other contract archetypes as products

Objective: apply the same productization pattern to NFT, claim, staking, and generic contracts.

Per archetype:
- NFT: mint / holdings / token lookup / metadata
- Claim: claimable / claim status / claim action
- Staking: stake / unstake / earned / claim rewards
- Generic: overview / common actions / advanced reads / isolated danger zone

Success criteria:
- each archetype has distinct product structure
- the generated page title/description/sections differ meaningfully by use case

Files:
- Modify: `server/services/page-config.ts`
- Modify: `server/services/hermes-agent.ts`
- Modify preview renderer/tests as needed

Verification:
- analyzer + page-config + frontend preview targeted tests
- `npm run build`

---

## Phase 6 — Product polish and trust layer

Objective: make the product feel premium and safe.

Potential slices:
- stronger copy hierarchy
- better empty/loading/error states
- safer spender/approval explanations
- clearer result formatting
- better progressive disclosure for advanced methods

Success criteria:
- page feels less like a dev tool and more like a polished user product

---

## Implementation principles

1. Deterministic safety boundary stays authoritative.
2. AI chooses product framing and layout, not unsafe capability expansion.
3. Common user jobs beat ABI completeness.
4. One sharp slice at a time, with TDD and verification before each commit.
5. ERC20 is the flagship benchmark: if it still feels like scan, keep iterating.

---

## Immediate next slice

After this plan lands, implement Phase 2 starting with the smallest valuable schema addition:
- add product-intent metadata to pageConfig and/or methods
- prove it with a failing test first
- use it to unlock a more productized ERC20 preview in the next slice
