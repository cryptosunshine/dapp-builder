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

function buildTokenSections(safeReadMethods: PageMethod[], actionMethods: PageMethod[], dangerousMethods: PageMethod[]): PageSection[] {
  const sections: PageSection[] = [
    {
      id: 'overview',
      title: 'Token overview',
      description: 'Key token details and contract context for normal users.',
      variant: 'overview',
      methodNames: [],
    },
  ];

  const walletMethods = safeReadMethods
    .filter((method) => ['balanceOf', 'name', 'symbol', 'decimals', 'totalSupply'].includes(method.name))
    .map((method) => method.name);
  if (walletMethods.length > 0) {
    sections.push({
      id: 'wallet',
      title: 'Your wallet',
      description: 'The token reads most users care about first after connecting a wallet.',
      variant: 'read',
      methodNames: walletMethods,
    });
  }

  const transferMethods = actionMethods.filter((method) => method.name === 'transfer').map((method) => method.name);
  if (transferMethods.length > 0) {
    sections.push({
      id: 'send-tokens',
      title: 'Send tokens',
      description: 'Move tokens to another wallet with a focused transfer flow.',
      variant: 'actions',
      methodNames: transferMethods,
    });
  }

  const approvalMethods = [...safeReadMethods, ...actionMethods]
    .filter((method) => ['allowance', 'approve'].includes(method.name))
    .map((method) => method.name);
  if (approvalMethods.length > 0) {
    sections.push({
      id: 'approvals',
      title: 'Approvals & spender safety',
      description: 'Review token approvals, set spender access, and reset risky approvals.',
      variant: 'write',
      methodNames: approvalMethods,
    });
  }

  const advancedWrites = actionMethods
    .filter((method) => !transferMethods.includes(method.name) && !approvalMethods.includes(method.name))
    .map((method) => method.name);
  if (advancedWrites.length > 0) {
    sections.push({
      id: 'advanced-actions',
      title: 'Advanced token actions',
      description: 'Less common but still safe token write flows for power users.',
      variant: 'write',
      methodNames: advancedWrites,
    });
  }

  const advancedReads = safeReadMethods
    .filter((method) => !walletMethods.includes(method.name) && !approvalMethods.includes(method.name))
    .map((method) => method.name);
  if (advancedReads.length > 0) {
    sections.push({
      id: 'advanced-reads',
      title: 'Advanced token reads',
      description: 'Lower-priority token details for users who want deeper inspection.',
      variant: 'read',
      methodNames: advancedReads,
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

  return sections;
}

export function buildPageConfig(analysis: AnalyzeContractResult): PageConfig {
  const skill = pickSkill(analysis);
  const safeReadMethods = uniqueMethods(
    analysis.readMethods ?? analysis.methods.filter((method) => method.type === 'read' && method.dangerLevel !== 'danger'),
  );
  const actionMethods = uniqueMethods(
    analysis.writeMethods ?? analysis.methods.filter((method) => method.type === 'write' && method.dangerLevel !== 'danger'),
  );
  const safeMethods = uniqueMethods([...safeReadMethods, ...actionMethods]);
  const dangerousMethods = uniqueMethods(analysis.dangerousMethods);

  const sections: PageSection[] =
    skill === 'token-dashboard'
      ? buildTokenSections(safeReadMethods, actionMethods, dangerousMethods)
      : [
          {
            id: 'overview',
            title: 'Overview',
            description: 'Contract summary and wallet requirements.',
            variant: 'overview',
            methodNames: [],
          },
          ...(safeReadMethods.length > 0
            ? [
                {
                  id: 'read-data',
                  title: 'Read methods',
                  description: 'Safe read-only methods for inspecting contract state.',
                  variant: 'read' as const,
                  methodNames: safeReadMethods.map((method) => method.name),
                },
              ]
            : []),
          ...(actionMethods.length > 0
            ? [
                {
                  id: 'actions',
                  title: 'Write methods',
                  description: 'Primary user-facing contract interactions.',
                  variant: 'write' as const,
                  methodNames: actionMethods.map((method) => method.name),
                },
              ]
            : []),
          ...(dangerousMethods.length > 0
            ? [
                {
                  id: 'danger-zone',
                  title: 'Danger zone',
                  description: 'Administrative or risky methods. Keep away from casual users.',
                  variant: 'danger' as const,
                  methodNames: dangerousMethods.map((method) => method.name),
                },
              ]
            : []),
        ];

  const title =
    skill === 'token-dashboard'
      ? `${analysis.contractName || 'Token'} Wallet & Transfer Hub`
      : analysis.contractName
        ? `${analysis.contractName} ${skillLabels[skill]}`
        : skillLabels[skill];

  const description =
    skill === 'token-dashboard'
      ? `A user-friendly token operations app for ${analysis.contractName || analysis.contractAddress}: check balances, move tokens, review approvals, and stay safe.`
      : `Generated ${skillLabels[skill]} preview for ${analysis.contractName || analysis.contractAddress}.`;

  const primaryActions =
    skill === 'token-dashboard'
      ? [
          ...(safeReadMethods.some((method) => method.name === 'balanceOf') ? ['Check wallet balance'] : []),
          ...(actionMethods.some((method) => method.name === 'transfer') ? ['Transfer tokens'] : []),
          ...([safeReadMethods, actionMethods].some((methods) => methods.some((method) => ['allowance', 'approve'].includes(method.name)))
            ? ['Review approvals']
            : []),
          ...(actionMethods.some((method) => method.name === 'approve') ? ['Revoke approval'] : []),
        ]
      : [];

  return {
    title,
    description,
    chain: analysis.chain,
    chainId: chainIdByKey[analysis.chain],
    rpcUrl: 'https://evmtestnet.confluxrpc.com',
    contractAddress: analysis.contractAddress,
    contractName: analysis.contractName,
    skill,
    warnings: analysis.warnings,
    primaryActions,
    dangerousMethods,
    methods: safeMethods,
    sections,
  };
}
