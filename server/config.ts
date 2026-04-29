import { join } from 'node:path';

export const appConfig = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: process.env.DATA_DIR ?? join(process.cwd(), 'data', 'tasks'),
  generatedDappsDir: process.env.GENERATED_DAPPS_DIR ?? join(process.cwd(), 'data', 'generated-dapps'),
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  confluxScanBaseUrl: 'https://evmtestnet.confluxscan.org',
  confluxESpaceTestnetRpcUrl: process.env.CONFLUX_ESPACE_TESTNET_RPC_URL ?? 'https://evmtestnet.confluxrpc.com',
  agentApiTimeoutMs: Number(process.env.AGENT_API_TIMEOUT_MS ?? 180_000),
  agentApiMaxAttempts: Number(process.env.AGENT_API_MAX_ATTEMPTS ?? 2),
  modelAccounts: [
    {
      id: 'nvidia-deepseek-v4-pro',
      label: 'NVIDIA DeepSeek V4 Pro',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'deepseek-ai/deepseek-v4-pro',
      apiKey: process.env.NVIDIA_API_KEY ?? process.env.NVIDIA_INTEGRATE_API_KEY ?? '',
    },
    {
      id: 'openai-gpt-5.4',
      label: 'OpenAI GPT-5.4',
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: 'gpt-5.4',
      apiKey: process.env.OPENAI_API_KEY ?? '',
    },
  ],
};
