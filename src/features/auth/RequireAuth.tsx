import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/useSession';
import { t } from '@/lib/i18n';

export function RequireAuth({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { status } = useSession();
  if (status === 'loading') return <Skeleton className="m-4 h-24" />;
  if (status === 'signedOut') {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm">{t('auth.required')}</p>
        {fallback}
      </div>
    );
  }
  return <>{children}</>;
}
