# Guided dApp Generation MVP Design

## Purpose

The MVP generates a product-like micro dApp preview from a contract address, chain, selected skills, and optional model configuration.

This is not a general ABI explorer and does not promise full protocol frontends for complex systems such as Aave or Uniswap. It focuses on single-contract or simple-contract experiences where the system can identify useful capabilities and let a guided agent design a polished, safe interaction flow.

## Product Scope

The first version supports Conflux eSpace Testnet only. It renders generated experiences inside the existing previewer and does not export standalone code.

Supported business directions:

- `auto`
- `token-dashboard`
- `nft-mint-experience`
- `voting-participation`

Supported wallet skills:

- `injected-wallet`
- `eip-6963-wallet-discovery`
- `chain-switching`

Supported experience skills:

- `guided-flow`
- `transaction-timeline`
- `risk-explainer`
- `explorer-links`

Model configuration is separate from skills:

```ts
modelConfig?: {
  baseUrl: string;
  apiKey: string;
  model: string;
}
```

The API key is task-scoped secret input. It must not be persisted and must not be sent to local agent subprocesses unless a later explicit design changes that boundary.

## Agent Mode

The MVP uses a fixed guided agent mode:

```ts
agentMode: "guided"
```

The guided agent acts as a product designer, interaction designer, and copy designer. It may:

- Recommend the best product direction from selected skills and detected capabilities.
- Compose page sections and interaction flows from validated capabilities.
- Explain ABI parameters and contract actions in user-friendly language.
- Generate titles, descriptions, labels, empty states, risk explanations, and guidance.
- Suggest partial-support messaging when a selected skill is not fully supported.

The guided agent must not:

- Invent contract methods that are not present in the ABI.
- Remove or weaken deterministic warnings.
- Change deterministic dangerous method classification.
- Hide risky or administrative methods.
- Generate UI components that the renderer does not support.
- Force a low-confidence contract into a product template.

Future versions may expose:

```ts
agentMode: "conservative" | "guided" | "autonomous"
```

The MVP keeps this fixed to reduce product and safety ambiguity.

## Generation Flow

```text
contractAddress + chain + skills + modelConfig
-> fetch ABI and contract metadata
-> deterministic capability analysis
-> build capability primitives
-> guided agent generates app experience schema
-> validator checks schema, methods, safety, and skill compatibility
-> renderer previews generated dApp
```

The deterministic capability analysis is the source of truth for available methods, method risk, contract metadata, and skill compatibility. The agent may shape the experience, but every output must pass validation before rendering.

## Capability Primitives

Capability primitives are normalized building blocks derived from ABI analysis. The agent receives these instead of raw function lists as its primary design material.

ERC20-like primitives may include:

- `tokenIdentity`: name, symbol, decimals, totalSupply.
- `walletBalance`: balance lookup for the connected account.
- `addressBalanceLookup`: balance lookup for any address.
- `transferAction`: transfer to a recipient.
- `allowanceLookup`: allowance for owner/spender.
- `approvalAction`: approve spender and amount.
- `adminRiskPanel`: risky methods such as mint, pause, ownership, role, or config changes.

NFT-like primitives may include:

- `collectionIdentity`: name, symbol, contract metadata.
- `mintAction`: mint or safeMint interaction.
- `payableMintAction`: mint action requiring native value.
- `supplyMetrics`: totalSupply, maxSupply, minted count when available.
- `ownershipLookup`: ownerOf and balanceOf.
- `tokenMetadataLookup`: tokenURI when available.
- `adminRiskPanel`: risky minting, ownership, or config methods.

Voting-like primitives may include:

- `proposalLookup`: proposal or proposal-state reads when available.
- `voteAction`: cast vote or equivalent voting method.
- `voterStatus`: hasVoted, receipt, voting power, or eligibility checks.
- `proposalLifecycle`: state, deadline, execute, queue, or cancel when available.
- `adminRiskPanel`: proposal control, ownership, role, or governor config methods.

If no product capability is strong enough, the system should produce a generic contract preview with clear partial-support messaging rather than forcing a business template.

## Skill Registry

Skills are composable generation capabilities. Each skill should be registered with enough metadata for validation and prompting:

```ts
type SkillDefinition = {
  id: string;
  category: "business" | "wallet" | "experience";
  label: string;
  description: string;
  requires?: string[];
  conflictsWith?: string[];
  supportedInPreview: boolean;
  agentInstructions: string;
  rendererCapabilities: string[];
};
```

Business skills define the product intent. Wallet skills define account connection behavior. Experience skills define interaction quality, guidance, and supporting UI.

The system must normalize selected skills, detect unsupported or conflicting combinations, and pass those findings to both the agent and renderer.

## Experience Schema

The agent outputs an experience schema, not arbitrary React code. The schema describes product sections and supported components that the renderer knows how to display.

Initial component types:

- `hero`: product title, description, contract summary, primary call to action.
- `wallet`: wallet connection and chain state.
- `metric`: read-only values such as balance, supply, proposal count, or status.
- `lookup`: user-provided read action such as address balance or tokenURI.
- `action`: transaction action such as transfer, approve, mint, or vote.
- `flow`: guided multi-step interaction composed from validated lookup/action components.
- `timeline`: transaction status and result history for the current session.
- `risk`: warnings, dangerous methods, and risk explanations.
- `explorerLink`: links to contract, account, or transaction explorer pages.
- `unsupported`: partial-support or missing-capability messaging.

The schema should include method references by stable method name, not copied ABI fragments. The validator resolves method references against deterministic analysis.

## Validator Rules

The validator is mandatory between agent output and rendering.

It must reject or repair output that:

- References methods not present in deterministic capability analysis.
- References methods incompatible with the selected component type.
- Omits deterministic warnings.
- Reclassifies dangerous methods as safe.
- Hides dangerous methods when they exist.
- Uses unsupported component types.
- Produces invalid required fields.
- Selects a business skill with insufficient capability confidence without marking partial support.

When validation fails, the system should fall back to a deterministic experience schema built from capability primitives.

## Renderer Boundary

The preview renderer renders only schema-supported components. It does not evaluate arbitrary code from the agent.

Renderer responsibilities:

- Display product-like page sections from the experience schema.
- Connect wallets through supported wallet skills.
- Run read and write methods through validated method references.
- Show transaction lifecycle states.
- Display risk and unsupported-capability messaging.
- Link to Conflux eSpace Testnet explorer pages when `explorer-links` is selected.

Renderer non-goals for MVP:

- Code export.
- Arbitrary custom layouts.
- Multi-chain support.
- Full protocol adapters.
- Off-chain indexer or subgraph integration.

## Fallback Behavior

The system should still produce useful output if the agent or model call fails.

Fallback levels:

1. Use deterministic experience schema for strongly detected capabilities.
2. Use generic contract preview for weak or unknown capabilities.
3. Show task failure only when ABI fetching, parsing, or core validation fails beyond recovery.

Failures should be visible and helpful, not silent.

## MVP Acceptance Criteria

- A standard ERC20-like contract can generate a product-like token management preview with identity, balance, transfer, allowance, approval, risk, and explorer sections when methods exist.
- A standard NFT-like contract can generate a mint or collection interaction preview when mint and metadata capabilities exist.
- A simple on-chain voting contract can generate a participation preview when voting and voter-status capabilities exist.
- Selected wallet and experience skills affect the generated page where supported.
- Unsupported skill combinations produce clear partial-support messages.
- Agent output cannot add nonexistent methods or remove deterministic risk warnings.
- Missing local agent or failed model enhancement falls back to deterministic preview generation.
- API keys are not persisted.

