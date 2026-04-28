import { describe, expect, test } from 'vitest';
import {
  builderTaskInputSchema,
  experienceSchema,
  sanitizeTaskInput,
  supportedSkills,
} from '../shared/schema';

describe('guided generation shared schema', () => {
  test('accepts multi-select skills and modelConfig input', () => {
    const input = builderTaskInputSchema.parse({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skills: ['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow'],
      modelConfig: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.4',
        apiKey: 'secret-key',
      },
    });

    expect(input.skills).toEqual(['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow']);
    expect(input.modelConfig?.baseUrl).toBe('https://api.openai.com/v1');
  });

  test('keeps legacy single skill input compatible', () => {
    const input = builderTaskInputSchema.parse({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skill: 'token-dashboard',
      model: 'gpt-5.4',
      apiKey: '',
    });

    expect(input.skills).toEqual(['token-dashboard']);
  });

  test('sanitizeTaskInput removes model api keys', () => {
    const stored = sanitizeTaskInput({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skills: ['auto', 'explorer-links'],
      modelConfig: {
        baseUrl: 'https://example.test/v1',
        model: 'custom-model',
        apiKey: 'never-store-me',
      },
    });

    expect(stored).toEqual({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chainId: 71,
      skills: ['auto', 'explorer-links'],
      modelConfig: {
        baseUrl: 'https://example.test/v1',
        model: 'custom-model',
      },
    });
  });

  test('experience schema accepts renderer-supported components', () => {
    const experience = experienceSchema.parse({
      id: 'exp-token',
      title: 'Token Console',
      summary: 'Manage token balances and approvals.',
      template: 'token-dashboard',
      confidence: 0.92,
      skills: ['token-dashboard', 'guided-flow'],
      components: [
        { id: 'hero', type: 'hero', title: 'Token Console', description: 'A product-like token app.' },
        { id: 'balance', type: 'metric', title: 'Your balance', methodName: 'balanceOf' },
        { id: 'send', type: 'action', title: 'Send tokens', methodName: 'transfer' },
        { id: 'risk', type: 'risk', title: 'Risk review', warnings: ['Dangerous methods detected.'] },
      ],
      warnings: ['Dangerous methods detected.'],
      unsupported: [],
    });

    expect(experience.components.map((component) => component.type)).toEqual(['hero', 'metric', 'action', 'risk']);
    expect(supportedSkills).toContain('eip-6963-wallet-discovery');
  });
});
