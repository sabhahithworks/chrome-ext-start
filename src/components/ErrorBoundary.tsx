import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { createLogger } from '@/lib/logger';

const log = createLogger('error-boundary');

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('screen crashed', { error, componentStack: info.componentStack });
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm">{t('errors.screen')}</p>
        <Button
          onClick={() => {
            location.reload();
          }}
        >
          {t('errors.reload')}
        </Button>
      </div>
    );
  }
}
