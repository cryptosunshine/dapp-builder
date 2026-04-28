import {
  experienceComponentTypeSchema,
  experienceSchema,
  type Experience,
  type ExperienceComponent,
  type PageMethod,
} from '../../shared/schema.js';

interface ValidateExperienceInput {
  incoming: unknown;
  fallback: Experience;
  methods: PageMethod[];
  dangerousMethods: PageMethod[];
  deterministicWarnings: string[];
}

interface ValidateExperienceResult {
  experience: Experience;
  diagnostics: string[];
}

function methodNamesFor(component: ExperienceComponent) {
  return [...new Set([...(component.methodName ? [component.methodName] : []), ...component.methodNames])];
}

export function validateExperience({
  incoming,
  fallback,
  methods,
  dangerousMethods,
  deterministicWarnings,
}: ValidateExperienceInput): ValidateExperienceResult {
  const diagnostics: string[] = [];
  const parsed = experienceSchema.safeParse(incoming);
  if (!parsed.success) {
    return { experience: fallback, diagnostics: ['Agent experience failed schema validation.'] };
  }

  const allMethods = new Map([...methods, ...dangerousMethods].map((method) => [method.name, method]));
  const dangerousNames = new Set(dangerousMethods.map((method) => method.name));

  const components = parsed.data.components.flatMap((component): ExperienceComponent[] => {
    const type = experienceComponentTypeSchema.safeParse(component.type);
    if (!type.success) {
      diagnostics.push(`Unsupported component type: ${component.type}`);
      return [];
    }

    const referenced = methodNamesFor(component);
    const unknown = referenced.filter((methodName) => !allMethods.has(methodName));
    if (unknown.length > 0) {
      diagnostics.push(`Component ${component.id} referenced unknown method(s): ${unknown.join(', ')}`);
      return [];
    }

    if ((component.type === 'metric' || component.type === 'lookup') && referenced.some((methodName) => allMethods.get(methodName)?.type !== 'read')) {
      diagnostics.push(`Component ${component.id} used a write method in a read component.`);
      return [];
    }

    if (component.type === 'action' && referenced.some((methodName) => allMethods.get(methodName)?.dangerLevel === 'danger')) {
      diagnostics.push(`Component ${component.id} tried to expose a dangerous method as a normal action.`);
      return [];
    }

    return [{
      ...component,
      methodName: referenced[0] ?? component.methodName,
      methodNames: referenced,
    }];
  });

  const hasRisk = components.some((component) => component.type === 'risk');
  if (!hasRisk && (dangerousMethods.length > 0 || deterministicWarnings.length > 0)) {
    components.push({
      id: 'risk-review',
      type: 'risk',
      title: 'Risk review',
      description: 'Review warnings and administrative methods before interacting.',
      methodNames: [...dangerousNames],
      warnings: deterministicWarnings,
      children: [],
    });
  }

  const repairedComponents = components.map((component) => {
    if (component.type !== 'risk') return component;
    return {
      ...component,
      methodNames: [...new Set([...component.methodNames, ...dangerousNames])],
      warnings: [...new Set([...component.warnings, ...deterministicWarnings])],
    };
  });

  const experience = experienceSchema.parse({
    ...parsed.data,
    components: repairedComponents.length > 0 ? repairedComponents : fallback.components,
    warnings: [...new Set([...parsed.data.warnings, ...deterministicWarnings])],
  });

  return { experience, diagnostics };
}
