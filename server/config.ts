import { join } from 'node:path';

export const appConfig = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: process.env.DATA_DIR ?? join(process.cwd(), 'data', 'tasks'),
  generatedDappsDir: process.env.GENERATED_DAPPS_DIR ?? join(process.cwd(), 'data', 'generated-dapps'),
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  confluxScanBaseUrl: 'https://evmtestnet.confluxscan.org',
  confluxESpaceTestnetRpcUrl: process.env.CONFLUX_ESPACE_TESTNET_RPC_URL ?? 'https://evmtestnet.confluxrpc.com',
  hermesAgentCommand: process.env.HERMES_AGENT_COMMAND ?? 'hermes-agent',
  hermesAgentTimeoutMs: Number(process.env.HERMES_AGENT_TIMEOUT_MS ?? 120_000),
  hermesAgentMaxBufferBytes: Number(process.env.HERMES_AGENT_MAX_BUFFER_BYTES ?? 2_000_000),
  agentApiTimeoutMs: Number(process.env.AGENT_API_TIMEOUT_MS ?? 180_000),
  agentApiMaxAttempts: Number(process.env.AGENT_API_MAX_ATTEMPTS ?? 2),
};
