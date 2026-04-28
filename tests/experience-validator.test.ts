import { describe, expect, test } from 'vitest';
import { validateExperience } from '../server/services/experience-validator';
import type { Experience, PageMethod } from '../shared/schema';

const transfer: PageMethod = {
  name: 'transfer',
  label: 'Transfer',
  type: 'write',
  dangerLevel: 'warn',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
  description: 'Send tokens.',
};

const pause: PageMethod = {
  name: 'pause',
  label: 'Pause',
  type: 'write',
  dangerLevel: 'danger',
  stateMutability: 'nonpayable',
  inputs: [],
  outputs: [],
  description: 'Pause the contract.',
};

const deterministic: Experience = {
  id: 'fallback',
  title: 'Fallback',
  summary: 'Fallback experience',
  template: 'token-dashboard',
  confidence: 0.9,
  skills: ['token-dashboard'],
  components: [
    { id: 'hero', type: 'hero', title: 'Fallback', description: '', methodNames: [], warnings: [], children: [] },
    { id: 'risk', type: 'risk', title: 'Risk review', description: '', methodNames: ['pause'], warnings: ['Dangerous methods detected.'], children: [] },
  ],
  warnings: ['Dangerous methods detected.'],
  unsupported: [],
};

describe('validateExperience', () => {
  test('removes invented method references and preserves deterministic warnings', () => {
    const incoming: Experience = {
      id: 'agent',
      title: 'Agent Token App',
      summary: 'Agent generated',
      template: 'token-dashboard',
      confidence: 0.95,
      skills: ['token-dashboard'],
      components: [
        { id: 'send', type: 'action', title: 'Send', description: '', methodName: 'transferFromNowhere', methodNames: ['transferFromNowhere'], warnings: [], children: [] },
        { id: 'risk', type: 'risk', title: 'Risks', description: '', methodNames: [], warnings: [], children: [] },
      ],
      warnings: [],
      unsupported: [],
    };

    const validated = validateExperience({
      incoming,
      fallback: deterministic,
      methods: [transfer],
      dangerousMethods: [pause],
      deterministicWarnings: ['Dangerous methods detected.'],
    });

    expect(validated.experience.warnings).toContain('Dangerous methods detected.');
    expect(validated.experience.components.find((component) => component.id === 'send')).toBeUndefined();
    expect(validated.experience.components.find((component) => component.type === 'risk')?.methodNames).toContain('pause');
    expect(validated.diagnostics).toEqual(expect.arrayContaining([expect.stringMatching(/unknown method/i)]));
  });
});
