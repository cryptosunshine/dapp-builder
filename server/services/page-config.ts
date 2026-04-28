import type { AnalyzeContractResult, ChainKey, Experience, PageConfig, PageMethod, PageSection, SkillName } from '../../shared/schema.js';

const chainIdByKey: Record<ChainKey, number> = {
  'conflux-espace-testnet': 71,
};

const skillLabels: Record<SkillName, string> = {
  'auto': 'Auto dApp',
  'token-dashboard': 'Token Dashboard',
  'nft-mint-experience': 'NFT Mint Experience',
  'voting-participation': 'Voting App',
  'injected-wallet': 'Injected Wallet',
  'eip-6963-wallet-discovery': 'Wallet Discovery',
  'chain-switching': 'Chain Switching',
  'guided-flow': 'Guided Flow',
  'transaction-timeline': 'Transaction Timeline',
  'risk-explainer': 'Risk Explainer',
  'explorer-links': 'Explorer Links',
  'nft-mint-page': 'NFT Mint Page',
  'claim-page': 'Claim Page',
  'staking-page': 'Staking Page',
};

function uniqueMethods(methods: PageMethod[]) {
  const methodMap = new Map<string, PageMethod>();
  for (const method of methods) {
    methodMap.set(method.name, method);
  }
  return [...methodMap.values()];
}

function pickSkill(analysis: AnalyzeContractResult): SkillName {
  if (analysis.skillMatch) {
    return analysis.requestedSkill;
  }
  return analysis.recommendedSkills?.[0] ?? analysis.requestedSkill;
}

export function buildPageConfig(analysis: AnalyzeContractResult, experience?: Experience): PageConfig {
  const skill = pickSkill(analysis);
  const safeReadMethods = uniqueMethods(
    analysis.readMethods ?? analysis.methods.filter((method) => method.type === 'read' && method.dangerLevel !== 'danger'),
  );
  const actionMethods = uniqueMethods(
    analysis.writeMethods ?? analysis.methods.filter((method) => method.type === 'write' && method.dangerLevel !== 'danger'),
  );
  const safeMethods = uniqueMethods([...safeReadMethods, ...actionMethods]);
  const dangerousMethods = uniqueMethods(analysis.dangerousMethods);

  const sections: PageSection[] = [
    {
      id: 'overview',
      title: 'Overview',
      description: 'Contract summary and wallet requirements.',
      variant: 'overview',
      methodNames: [],
    },
  ];

  if (safeReadMethods.length > 0) {
    sections.push({
      id: 'read-data',
      title: 'Read methods',
      description: 'Safe read-only methods for inspecting contract state.',
      variant: 'read',
      methodNames: safeReadMethods.map((method) => method.name),
    });
  }

  if (actionMethods.length > 0) {
    sections.push({
      id: 'actions',
      title: 'Write methods',
      description: 'Primary user-facing contract interactions.',
      variant: 'write',
      methodNames: actionMethods.map((method) => method.name),
    });
  }

  if (dangerousMethods.length > 0) {
    sections.push({
      id: 'danger-zone',
      title: 'Danger zone',
      description: 'Administrative or risky methods. Keep away from casual users.',
      variant: 'danger',
      methodNames: dangerousMethods.map((method) => method.name),
    });
  }

  const title = analysis.contractName
    ? `${analysis.contractName} ${skillLabels[skill]}`
    : skillLabels[skill];

  return {
    title,
    description: `Generated ${skillLabels[skill]} preview for ${analysis.contractName || analysis.contractAddress}.`,
    chain: analysis.chain,
    chainId: chainIdByKey[analysis.chain],
    rpcUrl: 'https://evmtestnet.confluxrpc.com',
    contractAddress: analysis.contractAddress,
    contractName: analysis.contractName,
    skill,
    skills: [skill],
    warnings: analysis.warnings,
    dangerousMethods,
    methods: safeMethods,
    sections,
    experience,
  };
}
