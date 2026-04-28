import type { AnalyzeContractResult, PageMethod, SkillName } from '../../shared/schema.js';

export interface CapabilityPrimitive {
  id: string;
  label: string;
  description: string;
  methodNames: string[];
  required: boolean;
}

export interface CapabilitySet {
  kind: 'token' | 'nft' | 'voting' | 'generic';
  confidence: number;
  primitives: CapabilityPrimitive[];
  unsupported: string[];
  warnings: string[];
}

function hasMethod(methods: PageMethod[], names: string[]) {
  const lowered = new Set(names.map((name) => name.toLowerCase()));
  return methods.some((method) => lowered.has(method.name.toLowerCase()));
}

function primitive(id: string, label: string, description: string, methodNames: string[], required = false): CapabilityPrimitive {
  return { id, label, description, methodNames, required };
}

export function buildCapabilityPrimitives(analysis: AnalyzeContractResult, selectedSkills: SkillName[]): CapabilitySet {
  const methods = analysis.methods;
  const dangerousMethods = analysis.dangerousMethods;
  const primitives: CapabilityPrimitive[] = [];
  const unsupported: string[] = [];

  const tokenSignals = [
    hasMethod(methods, ['name', 'symbol', 'decimals']),
    hasMethod(methods, ['totalSupply']),
    hasMethod(methods, ['balanceOf']),
    hasMethod(methods, ['transfer']),
    hasMethod(methods, ['allowance', 'approve']),
  ].filter(Boolean).length;

  const nftSignals = [
    hasMethod(methods, ['name', 'symbol']),
    hasMethod(methods, ['ownerOf', 'balanceOf']),
    hasMethod(methods, ['tokenURI']),
    hasMethod(methods, ['mint', 'safeMint']),
    hasMethod(methods, ['totalSupply', 'maxSupply']),
  ].filter(Boolean).length;

  const votingSignals = [
    hasMethod(methods, ['proposal', 'proposals', 'state']),
    hasMethod(methods, ['vote', 'castVote']),
    hasMethod(methods, ['hasVoted', 'getReceipt', 'getVotes']),
    hasMethod(methods, ['execute', 'queue', 'cancel']),
  ].filter(Boolean).length;

  const requestedToken = selectedSkills.includes('token-dashboard');
  const requestedNft = selectedSkills.includes('nft-mint-experience');
  const requestedVoting = selectedSkills.includes('voting-participation');

  const kind =
    requestedToken && tokenSignals >= 3 ? 'token'
      : requestedNft && nftSignals >= 2 ? 'nft'
        : requestedVoting && votingSignals >= 2 ? 'voting'
          : tokenSignals >= Math.max(nftSignals, votingSignals) && tokenSignals >= 3 ? 'token'
            : nftSignals >= Math.max(tokenSignals, votingSignals) && nftSignals >= 2 ? 'nft'
              : votingSignals >= 2 ? 'voting'
                : 'generic';

  if (kind === 'token') {
    if (hasMethod(methods, ['name', 'symbol', 'decimals', 'totalSupply'])) {
      primitives.push(primitive('tokenIdentity', 'Token identity', 'Token metadata and supply details.', ['name', 'symbol', 'decimals', 'totalSupply']));
    }
    if (hasMethod(methods, ['balanceOf'])) {
      primitives.push(primitive('walletBalance', 'Wallet balance', 'Connected wallet token balance.', ['balanceOf'], true));
      primitives.push(primitive('addressBalanceLookup', 'Address balance lookup', 'Check any address token balance.', ['balanceOf']));
    }
    if (hasMethod(methods, ['transfer'])) {
      primitives.push(primitive('transferAction', 'Transfer tokens', 'Send tokens to a recipient.', ['transfer']));
    }
    if (hasMethod(methods, ['allowance'])) {
      primitives.push(primitive('allowanceLookup', 'Allowance lookup', 'Check owner and spender allowance.', ['allowance']));
    }
    if (hasMethod(methods, ['approve'])) {
      primitives.push(primitive('approvalAction', 'Approve spending', 'Approve a spender amount.', ['approve']));
    }
  }

  if (kind === 'nft') {
    if (hasMethod(methods, ['name', 'symbol'])) {
      primitives.push(primitive('collectionIdentity', 'Collection identity', 'Collection metadata.', ['name', 'symbol']));
    }
    if (hasMethod(methods, ['mint', 'safeMint'])) {
      primitives.push(primitive('mintAction', 'Mint NFT', 'Mint from the collection.', ['mint', 'safeMint'], true));
    }
    if (methods.some((method) => ['mint', 'safemint'].includes(method.name.toLowerCase()) && method.stateMutability === 'payable')) {
      primitives.push(primitive('payableMintAction', 'Payable mint', 'Mint requiring native currency.', ['mint', 'safeMint']));
    }
    if (hasMethod(methods, ['totalSupply', 'maxSupply'])) {
      primitives.push(primitive('supplyMetrics', 'Supply metrics', 'Collection supply details.', ['totalSupply', 'maxSupply']));
    }
    if (hasMethod(methods, ['ownerOf', 'balanceOf'])) {
      primitives.push(primitive('ownershipLookup', 'Ownership lookup', 'Check ownership or holder balance.', ['ownerOf', 'balanceOf']));
    }
    if (hasMethod(methods, ['tokenURI'])) {
      primitives.push(primitive('tokenMetadataLookup', 'Token metadata lookup', 'Read token metadata URI.', ['tokenURI']));
    }
  }

  if (kind === 'voting') {
    if (hasMethod(methods, ['proposal', 'proposals', 'state'])) {
      primitives.push(primitive('proposalLookup', 'Proposal lookup', 'Inspect proposal status and details.', ['proposal', 'proposals', 'state']));
    }
    if (hasMethod(methods, ['vote', 'castVote'])) {
      primitives.push(primitive('voteAction', 'Cast vote', 'Submit an on-chain vote.', ['vote', 'castVote'], true));
    }
    if (hasMethod(methods, ['hasVoted', 'getReceipt', 'getVotes'])) {
      primitives.push(primitive('voterStatus', 'Voter status', 'Check voting power or whether an account voted.', ['hasVoted', 'getReceipt', 'getVotes']));
    }
    if (hasMethod(methods, ['execute', 'queue', 'cancel'])) {
      primitives.push(primitive('proposalLifecycle', 'Proposal lifecycle', 'Governance lifecycle actions.', ['execute', 'queue', 'cancel']));
    }
  }

  if (dangerousMethods.length > 0) {
    primitives.push(primitive('adminRiskPanel', 'Admin risk panel', 'Administrative or risky methods detected.', dangerousMethods.map((method) => method.name)));
  }

  if (kind === 'generic') {
    unsupported.push('No supported product direction reached the minimum capability confidence.');
  }

  const signalCount = kind === 'token' ? tokenSignals : kind === 'nft' ? nftSignals : kind === 'voting' ? votingSignals : 0;
  const confidence = Math.min(1, signalCount / (kind === 'token' ? 5 : 4));

  return { kind, confidence, primitives, unsupported, warnings: analysis.warnings };
}
