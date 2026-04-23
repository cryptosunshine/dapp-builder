import type {
  AbiEntry,
  AnalyzeContractInput,
  AnalyzeContractResult,
  PageMethod,
  SkillName,
} from '../../shared/schema.js';

const DANGEROUS_EXACT_METHODS = new Set([
  'pause',
  'unpause',
  'transferownership',
  'renounceownership',
  'grantrole',
  'revokerole',
  'upgradeTo'.toLowerCase(),
  'upgradeToAndCall'.toLowerCase(),
  'setmerkleRoot'.toLowerCase(),
  'setadmin',
  'setowner',
  'setimplementation',
  'setsigner',
  'settreasury',
  'setfee',
  'setfeereceiver',
]);

const TOKEN_HINTS = ['balanceof', 'transfer', 'approve', 'totalsupply', 'allowance', 'symbol', 'decimals'];
const NFT_HINTS = ['ownerof', 'tokenuri', 'safeTransferFrom'.toLowerCase(), 'setApprovalForAll'.toLowerCase()];
const CLAIM_HINTS = ['claim', 'isclaimed', 'merkle', 'proof', 'airdrop'];
const STAKING_HINTS = ['stake', 'unstake', 'withdraw', 'deposit', 'earned', 'reward', 'getreward', 'claimrewards'];

const skillToContractType: Record<SkillName, AnalyzeContractResult['contractType']> = {
  'token-dashboard': 'token',
  'nft-mint-page': 'nft',
  'claim-page': 'claim',
  'staking-page': 'staking',
};

function humanizeMethodName(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function isReadable(entry: AbiEntry) {
  return entry.stateMutability === 'view' || entry.stateMutability === 'pure';
}

function classifyCategory(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('mint')) return 'mint';
  if (lowerName.includes('claim')) return 'claim';
  if (lowerName.includes('stake') && !lowerName.includes('unstake')) return 'stake';
  if (lowerName.includes('unstake') || lowerName.includes('withdraw')) return 'unstake';
  if (lowerName.includes('reward') || lowerName.includes('earned')) return 'rewards';
  if (lowerName.includes('transfer') || lowerName.includes('approve')) return 'token';
  if (lowerName.includes('ownerof') || lowerName.includes('tokenuri')) return 'nft';
  if (lowerName.includes('balance') || lowerName.includes('supply') || lowerName.includes('symbol')) return 'read';
  if (lowerName.startsWith('set') || lowerName.includes('owner') || lowerName.includes('admin')) return 'admin';
  return 'general';
}

function isDangerous(entry: AbiEntry) {
  const name = (entry.name ?? '').toLowerCase();
  if (isReadable(entry)) return false;
  if (DANGEROUS_EXACT_METHODS.has(name)) return true;
  if (name.startsWith('upgrade')) return true;
  if (name.startsWith('pause') || name.startsWith('unpause')) return true;
  if (name.includes('ownership') || name.includes('admin') || name.includes('governor')) return true;
  if (name.startsWith('set') && /(root|owner|admin|implementation|signer|fee|treasury|whitelist|operator|merkle|config|recipient)/.test(name)) {
    return true;
  }
  return false;
}

function methodDescription(name: string, type: PageMethod['type'], category: string) {
  if (category === 'mint') return 'Mint-related contract interaction.';
  if (category === 'claim') return 'Claim-related contract interaction.';
  if (category === 'stake' || category === 'unstake' || category === 'rewards') {
    return 'Staking-related contract interaction.';
  }
  if (category === 'admin') return 'Administrative contract method. Review carefully before use.';
  return type === 'read' ? 'Read contract data without sending a transaction.' : 'Send a transaction to interact with the contract.';
}

function scoreCapability(functionNames: string[], hints: string[]) {
  return hints.reduce((score, hint) => score + Number(functionNames.some((name) => name.includes(hint))), 0);
}

function detectRecommendedSkills(functionNames: string[]) {
  const tokenScore = scoreCapability(functionNames, TOKEN_HINTS);
  const nftScore = scoreCapability(functionNames, NFT_HINTS) + Number(functionNames.some((name) => name.includes('mint')));
  const claimScore = scoreCapability(functionNames, CLAIM_HINTS);
  const stakingScore = scoreCapability(functionNames, STAKING_HINTS);

  const recommendations: SkillName[] = [];

  if (tokenScore >= 3) recommendations.push('token-dashboard');
  if (nftScore >= 2) recommendations.push('nft-mint-page');
  if (claimScore >= 2) recommendations.push('claim-page');
  if (stakingScore >= 2) recommendations.push('staking-page');

  return {
    recommendations,
    scores: {
      token: tokenScore,
      nft: nftScore,
      claim: claimScore,
      staking: stakingScore,
    },
  };
}

function determineContractType(scores: Record<'token' | 'nft' | 'claim' | 'staking', number>): AnalyzeContractResult['contractType'] {
  const entries = Object.entries(scores) as Array<[AnalyzeContractResult['contractType'], number]>;
  const [winner, score] = entries.sort((left, right) => right[1] - left[1])[0];
  return score > 0 ? winner : 'generic';
}

function toPageMethod(entry: AbiEntry): PageMethod | null {
  if (entry.type !== 'function' || !entry.name) {
    return null;
  }

  const type: PageMethod['type'] = isReadable(entry) ? 'read' : 'write';
  const category = classifyCategory(entry.name);
  const dangerLevel: PageMethod['dangerLevel'] = isDangerous(entry)
    ? 'danger'
    : type === 'write'
      ? 'warn'
      : 'safe';

  return {
    name: entry.name,
    label: humanizeMethodName(entry.name),
    type,
    dangerLevel,
    stateMutability: entry.stateMutability ?? 'nonpayable',
    inputs: entry.inputs ?? [],
    outputs: entry.outputs ?? [],
    description: methodDescription(entry.name, type, category),
    category,
  };
}

export function analyzeContract(input: AnalyzeContractInput): AnalyzeContractResult {
  const methods = input.abi
    .map(toPageMethod)
    .filter((method): method is PageMethod => Boolean(method));
  const functionNames = methods.map((method) => method.name.toLowerCase());
  const { recommendations, scores } = detectRecommendedSkills(functionNames);
  const dangerousMethods = methods.filter((method) => method.dangerLevel === 'danger');
  const contractType = determineContractType(scores);
  const skillMatch = recommendations.includes(input.requestedSkill);
  const warnings: string[] = [];

  if (!skillMatch) {
    warnings.push(
      recommendations.length > 0
        ? `Requested skill ${input.requestedSkill} does not best match this ABI. Consider ${recommendations.join(', ')}.`
        : `Requested skill ${input.requestedSkill} does not clearly match this ABI.`
    );
  }

  if (dangerousMethods.length > 0) {
    warnings.push('Dangerous or administrative methods were detected. Keep them out of the primary user flow.');
  }

  if (contractType === 'generic') {
    warnings.push('This contract did not strongly match a supported MVP skill. Preview quality may be limited.');
  }

  return {
    contractAddress: input.contractAddress,
    contractName: input.contractName,
    chain: input.chain,
    requestedSkill: input.requestedSkill,
    contractType,
    skillMatch,
    recommendedSkills: recommendations,
    warnings,
    methods,
    dangerousMethods,
  };
}
