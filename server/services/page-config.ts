import type { AnalyzeContractResult, ChainKey, PageConfig, PageMethod, PageSection, SkillName } from '../../shared/schema.js';

const chainIdByKey: Record<ChainKey, number> = {
  'conflux-espace-testnet': 71,
};

const skillLabels: Record<SkillName, string> = {
  'token-dashboard': 'Token Dashboard',
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

export function buildPageConfig(analysis: AnalyzeContractResult): PageConfig {
  const skill = pickSkill(analysis);
  const allMethods = uniqueMethods([...analysis.methods, ...analysis.dangerousMethods]);
  const safeReadMethods = allMethods.filter((method) => method.type === 'read' && method.dangerLevel !== 'danger');
  const actionMethods = allMethods.filter((method) => method.type === 'write' && method.dangerLevel !== 'danger');
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
      title: 'Read data',
      description: 'Safe read-only methods for inspecting contract state.',
      variant: 'read',
      methodNames: safeReadMethods.map((method) => method.name),
    });
  }

  if (actionMethods.length > 0) {
    sections.push({
      id: 'actions',
      title: 'Actions',
      description: 'Primary user-facing contract interactions.',
      variant: 'actions',
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
    warnings: analysis.warnings,
    dangerousMethods,
    methods: allMethods,
    sections,
  };
}
