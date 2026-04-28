import type { AnalyzeContractResult, Experience, ExperienceComponent, SkillName } from '../../shared/schema.js';
import type { CapabilitySet } from './capabilities.js';

interface BuildExperienceInput {
  analysis: AnalyzeContractResult;
  capabilities: CapabilitySet;
  skills: SkillName[];
}

function hasPrimitive(capabilities: CapabilitySet, id: string) {
  return capabilities.primitives.find((primitive) => primitive.id === id);
}

function component(input: ExperienceComponent): ExperienceComponent {
  return input;
}

export function buildDeterministicExperience({ analysis, capabilities, skills }: BuildExperienceInput): Experience {
  const components: ExperienceComponent[] = [
    component({
      id: 'hero',
      type: 'hero',
      title: capabilities.kind === 'generic'
        ? `${analysis.contractName} Contract Preview`
        : `${analysis.contractName} ${capabilities.kind === 'token' ? 'Token Console' : capabilities.kind === 'nft' ? 'Mint Experience' : 'Voting App'}`,
      description: `Generated product preview for ${analysis.contractName || analysis.contractAddress}.`,
      methodNames: [],
      warnings: [],
      children: [],
    }),
    component({
      id: 'wallet',
      type: 'wallet',
      title: 'Wallet connection',
      description: skills.includes('eip-6963-wallet-discovery')
        ? 'Choose from available injected wallets and connect to Conflux eSpace Testnet.'
        : 'Connect an injected EVM wallet on Conflux eSpace Testnet.',
      methodNames: [],
      warnings: [],
      children: [],
    }),
  ];

  const primaryMetrics = hasPrimitive(capabilities, 'tokenIdentity') ?? hasPrimitive(capabilities, 'supplyMetrics') ?? hasPrimitive(capabilities, 'proposalLookup');
  if (primaryMetrics) {
    components.push(component({
      id: 'primary-metrics',
      type: 'metric',
      title: capabilities.kind === 'voting' ? 'Proposal status' : 'Contract metrics',
      description: 'Read key contract state directly from the ABI-backed methods.',
      methodNames: primaryMetrics.methodNames,
      warnings: [],
      children: [],
    }));
  }

  if (hasPrimitive(capabilities, 'walletBalance')) {
    components.push(component({ id: 'wallet-balance', type: 'metric', title: 'Your balance', description: 'Read the connected wallet balance.', methodName: 'balanceOf', methodNames: ['balanceOf'], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'addressBalanceLookup')) {
    components.push(component({ id: 'address-balance-lookup', type: 'lookup', title: 'Check an address balance', description: 'Enter an address and read its token balance.', methodName: 'balanceOf', methodNames: ['balanceOf'], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'transferAction')) {
    components.push(component({ id: 'transfer-action', type: 'action', title: 'Send tokens', description: 'Transfer tokens to another address.', methodName: 'transfer', methodNames: ['transfer'], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'approvalAction')) {
    components.push(component({ id: 'approval-action', type: 'action', title: 'Approve spending', description: 'Approve a spender and amount.', methodName: 'approve', methodNames: ['approve'], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'mintAction')) {
    components.push(component({ id: 'mint-action', type: 'action', title: 'Mint NFT', description: 'Mint from this collection.', methodNames: hasPrimitive(capabilities, 'mintAction')?.methodNames ?? [], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'voteAction')) {
    components.push(component({ id: 'vote-action', type: 'action', title: 'Cast vote', description: 'Submit your vote on-chain.', methodNames: hasPrimitive(capabilities, 'voteAction')?.methodNames ?? [], warnings: [], children: [] }));
  }
  if (skills.includes('guided-flow')) {
    const actionIds = components.filter((entry) => entry.type === 'action').map((entry) => entry.id);
    if (actionIds.length > 0) {
      components.push(component({ id: 'guided-flow', type: 'flow', title: 'Guided interaction', description: 'Review inputs, connect wallet, submit transaction, and inspect the result.', methodNames: [], warnings: [], children: actionIds }));
    }
  }
  if (skills.includes('transaction-timeline')) {
    components.push(component({ id: 'transaction-timeline', type: 'timeline', title: 'Transaction timeline', description: 'Track wallet requests and confirmations in this session.', methodNames: [], warnings: [], children: [] }));
  }
  components.push(component({
    id: 'risk-review',
    type: 'risk',
    title: 'Risk review',
    description: analysis.warnings.length > 0 || analysis.dangerousMethods.length > 0 || skills.includes('risk-explainer')
      ? 'Review warnings and administrative methods before interacting.'
      : 'No deterministic risk warnings were detected for the generated product flow.',
    methodNames: analysis.dangerousMethods.map((method) => method.name),
    warnings: analysis.warnings,
    children: [],
  }));
  if (skills.includes('explorer-links')) {
    components.push(component({ id: 'contract-explorer', type: 'explorerLink', title: 'View on explorer', description: 'Open the contract on ConfluxScan.', href: `https://evmtestnet.confluxscan.org/address/${analysis.contractAddress}`, methodNames: [], warnings: [], children: [] }));
  }
  for (const reason of capabilities.unsupported) {
    components.push(component({ id: `unsupported-${components.length}`, type: 'unsupported', title: 'Partial support', description: reason, methodNames: [], warnings: [], children: [] }));
  }

  return {
    id: `experience-${analysis.contractAddress.toLowerCase()}`,
    title: components[0].title,
    summary: components[0].description,
    template: capabilities.kind === 'generic' ? 'generic' : capabilities.kind === 'token' ? 'token-dashboard' : capabilities.kind === 'nft' ? 'nft-mint-experience' : 'voting-participation',
    confidence: capabilities.confidence,
    skills,
    components,
    warnings: analysis.warnings,
    unsupported: capabilities.unsupported,
  };
}
