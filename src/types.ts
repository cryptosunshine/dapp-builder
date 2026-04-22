export type {
  AbiEntry,
  AbiParameter,
  BuilderTask,
  BuilderTaskInput,
  BuilderTaskResult,
  ChainKey,
  PageConfig,
  PageMethod,
  PageSection,
  SkillName,
  TaskStatus,
} from '../shared/schema';

export interface WalletState {
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error?: string | null;
}

export interface MethodRunResult {
  methodName: string;
  status: 'running' | 'success' | 'error';
  message?: string;
  data?: unknown;
}
