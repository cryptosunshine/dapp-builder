import type { Experience, MethodRunResult, PageMethod, WalletState } from '../types';
import { ExperienceComponentView } from './ExperienceComponents';

interface ExperienceRendererProps {
  experience: Experience;
  methods: PageMethod[];
  dangerousMethods: PageMethod[];
  walletState: WalletState;
  onConnectWallet: () => void | Promise<void>;
  onRunMethod: (method: PageMethod, formValues: Record<string, string>) => void | Promise<void>;
  activeResult: MethodRunResult | null;
}

export function ExperienceRenderer(props: ExperienceRendererProps) {
  const methodMap = new Map([...props.methods, ...props.dangerousMethods].map((method) => [method.name, method]));

  return (
    <div className="experience-page">
      {props.experience.components.map((component) => (
        <ExperienceComponentView
          key={component.id}
          component={component}
          methodMap={methodMap}
          walletState={props.walletState}
          onConnectWallet={props.onConnectWallet}
          onRunMethod={props.onRunMethod}
          activeResult={props.activeResult}
        />
      ))}
    </div>
  );
}
