import { pageConfigSchema, type AnalyzeContractResult, type ModelConfig, type PageConfig } from '../../shared/schema.js';
import { appConfig } from '../config.js';

interface LlmEnhancementInput {
  modelConfig?: ModelConfig;
  apiKey?: string;
  model?: string;
  analysis: AnalyzeContractResult;
  pageConfig: PageConfig;
}

function extractJsonBlock(content: string) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return content.slice(start, end + 1);
}

function mergeMethods(baseMethods: PageConfig['methods'], incomingMethods?: PageConfig['methods']) {
  if (!incomingMethods || incomingMethods.length === 0) {
    return baseMethods;
  }

  const byName = new Map(baseMethods.map((method) => [method.name, method]));
  for (const method of incomingMethods) {
    const existing = byName.get(method.name);
    byName.set(method.name, existing ? { ...existing, ...method } : method);
  }
  return [...byName.values()];
}

function mergeWarnings(baseWarnings: string[], incomingWarnings?: string[]) {
  if (!incomingWarnings || incomingWarnings.length === 0) {
    return baseWarnings;
  }

  return [...new Set([...baseWarnings, ...incomingWarnings])];
}

function mergeSections(baseSections: PageConfig['sections'], incomingSections?: PageConfig['sections']) {
  if (!incomingSections || incomingSections.length === 0) {
    return baseSections;
  }

  const incomingById = new Map(incomingSections.map((section) => [section.id, section]));
  return baseSections.map((section) => {
    const incoming = incomingById.get(section.id);
    if (!incoming) {
      return section;
    }

    return {
      ...section,
      ...(incoming.title ? { title: incoming.title } : {}),
      ...(incoming.description ? { description: incoming.description } : {}),
    };
  });
}

export async function enhancePageConfigWithLlm({ modelConfig, apiKey, model, analysis, pageConfig }: LlmEnhancementInput) {
  const effectiveApiKey = modelConfig?.apiKey ?? apiKey;
  const effectiveModel = modelConfig?.model ?? model;
  const baseUrl = modelConfig?.baseUrl ?? appConfig.openAiBaseUrl;

  if (!effectiveApiKey || !effectiveModel) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are an AI dApp builder assistant. Improve labels and descriptions in a generated pageConfig while preserving the contract methods, sections, and risk boundaries. Return JSON only.',
          },
          {
            role: 'user',
            content: JSON.stringify({ analysis, pageConfig }, null, 2),
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return null;
    }

    const jsonBlock = extractJsonBlock(content);
    if (!jsonBlock) {
      return null;
    }

    const patch = JSON.parse(jsonBlock) as Partial<PageConfig>;
    const merged: PageConfig = {
      ...pageConfig,
      ...(patch.title ? { title: patch.title } : {}),
      ...(patch.description ? { description: patch.description } : {}),
      ...(patch.experience && pageConfig.experience
        ? {
            experience: {
              ...pageConfig.experience,
              ...patch.experience,
              components: pageConfig.experience?.components.map((component) => {
                const incoming = patch.experience?.components?.find((entry) => entry.id === component.id);
                if (!incoming) return component;
                return {
                  ...component,
                  ...(incoming.title ? { title: incoming.title } : {}),
                  ...(incoming.description ? { description: incoming.description } : {}),
                };
              }) ?? pageConfig.experience?.components,
              warnings: pageConfig.experience?.warnings ?? [],
            },
          }
        : {}),
      warnings: mergeWarnings(pageConfig.warnings, patch.warnings),
      sections: mergeSections(pageConfig.sections, patch.sections),
      methods: mergeMethods(pageConfig.methods, patch.methods),
      dangerousMethods: mergeMethods(pageConfig.dangerousMethods, patch.dangerousMethods),
    };

    return pageConfigSchema.parse(merged);
  } catch {
    return null;
  }
}
