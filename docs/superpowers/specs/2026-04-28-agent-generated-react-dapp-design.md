# Agent Generated React dApp Design

## Goal

Replace the current fixed preview renderer path with a multi-stage agent workflow that produces a task-specific React app. The user should see live progress through product planning, design, frontend generation, validation, and completion, then preview the generated app in an iframe.

## Generation Flow

1. Fetch ABI and analyze the contract.
2. PM agent creates a product flow document from the address, chain, ABI, selected skills, and safe method boundary.
3. Designer agent creates a visual and interaction design document from the PM document and contract capabilities.
4. Frontend agent creates a complete Vite React app as source files.
5. Backend writes the app into `data/generated-dapps/<taskId>/source`, builds it into `data/generated-dapps/<taskId>/dist`, and stores the preview URL on the task result.
6. Frontend task page shows a stepper while processing and renders `generatedApp.previewUrl` in an iframe when complete.

## Product Constraint

The generated app must not be the existing internal template, `ExperienceRenderer`, or a method-card scan UI. The agent is responsible for the generated React source. The host app can still provide task orchestration, progress, static file serving, and iframe preview.

## Storage

Generated artifacts live under `data/generated-dapps/<taskId>/`. Source and build output are runtime artifacts and must stay out of git.

## Validation

The backend rejects generated apps that:

- omit `package.json`, `index.html`, or `src/App.jsx`
- write paths outside the task source directory
- include known secret names or submitted API keys
- fail `vite build`

The first implementation keeps ABI method safety through prompts and generated artifact validation. A deeper static analyzer for contract method calls can follow later.
