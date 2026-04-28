# Agent Generated React dApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-stage agent pipeline that generates a React app per task, stores it as an artifact, shows progress, and previews it through an iframe.

**Architecture:** Keep contract analysis deterministic, then require three agent stages for product plan, design spec, and frontend source. Store generated files under `data/generated-dapps/<taskId>`, build with the repo Vite dependency, and expose the build output through Express static middleware.

**Tech Stack:** Express, TypeScript, Zod, Vite, React, Vitest.

---

### Task 1: Extend Shared Schema

**Files:**
- Modify: `shared/schema.ts`
- Test: `tests/schema.test.ts`

- [ ] Add generated app schemas for agent documents, generated files, and generated app artifacts.
- [ ] Add task progress stages for PM, design, frontend generation, validation, and completion.
- [ ] Add `generatedApp` to `builderTaskResultSchema`.
- [ ] Verify schema parsing with `npm test -- tests/schema.test.ts`.

### Task 2: Add Generated App Artifact Service

**Files:**
- Create: `server/services/generated-apps.ts`
- Test: `tests/generated-apps.test.ts`

- [ ] Write tests for safe path handling, required files, secret rejection, and preview URL output.
- [ ] Implement `writeGeneratedAppSource`, `buildGeneratedApp`, and `createGeneratedAppArtifact`.
- [ ] Verify with `npm test -- tests/generated-apps.test.ts`.

### Task 3: Add Multi-Stage Agent Workflow

**Files:**
- Create: `server/services/agent-workflow.ts`
- Modify: `server/services/agent.ts`
- Test: `tests/agent-workflow.test.ts`, `tests/agent.test.ts`

- [ ] Write tests proving the PM, designer, and frontend stages invoke the agent in order.
- [ ] Parse fenced or plain JSON from agent output.
- [ ] Wire `runBuilderAgent` to call the workflow and return `generatedApp`.
- [ ] Verify with `npm test -- tests/agent-workflow.test.ts tests/agent.test.ts`.

### Task 4: Persist Progress and Serve Generated Apps

**Files:**
- Modify: `server/services/task-store.ts`
- Modify: `server/routes/tasks.ts`
- Modify: `server/config.ts`
- Modify: `server/app.ts`
- Test: `tests/tasks-api.test.ts`

- [ ] Allow task updates to persist `progress` and `summary`.
- [ ] Update route background execution after each generation stage.
- [ ] Serve `data/generated-dapps` at `/generated-dapps`.
- [ ] Verify with `npm test -- tests/tasks-api.test.ts`.

### Task 5: Render Progress and Generated iframe

**Files:**
- Modify: `src/components/TaskStatusCard.tsx`
- Modify: `src/components/PreviewPage.tsx`
- Modify: `src/styles.css`
- Test: `tests/task-status-card.test.tsx`, `tests/frontend-preview.test.tsx`

- [ ] Add a compact stepper for generation progress.
- [ ] Prefer `result.generatedApp.previewUrl` over internal preview components.
- [ ] Render a full-width iframe for the generated React app.
- [ ] Verify with `npm test -- tests/task-status-card.test.tsx tests/frontend-preview.test.tsx`.

### Task 6: Final Verification

**Files:**
- All changed files

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit the implementation.
