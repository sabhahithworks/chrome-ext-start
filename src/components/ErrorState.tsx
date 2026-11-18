import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/api/errors';
import { t } from '@/lib/i18n';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{apiErrorMessage(error)}</span>
        {onRetry && <Button onClick={onRetry}>{t('common.retry')}</Button>}
      </AlertDescription>
    </Alert>
  );
}
