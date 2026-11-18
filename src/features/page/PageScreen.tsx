import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCount, t } from '@/lib/i18n';
import { createLogger } from '@/lib/logger';
import { getPageInfo } from '@/lib/page';
import { captureActiveTab } from '@/lib/screenshot';
import { pendingSelectionItem, readPendingSelection, type PendingSelection } from '@/lib/storage';

const log = createLogger('PageScreen');

export default function PageScreen() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['pageInfo'],
    queryFn: getPageInfo,
  });
  const [sent, setSent] = useState<PendingSelection | null>(null);

  // The panel stays open across tab switches, so re-read the page whenever the active tab changes.
  useEffect(() => {
    const reload = () => {
      void refetch();
    };
    const onUpdated = (_id: number, change: Browser.tabs.OnUpdatedInfo, tab: Browser.tabs.Tab) => {
      if (tab.active && change.status === 'complete') reload();
    };
    browser.tabs.onActivated.addListener(reload);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(reload);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [refetch]);

  useEffect(() => {
    let active = true;
    readPendingSelection()
      .then((value) => {
        if (active) setSent(value);
      })
      .catch((error: unknown) => {
        log.error('read pending selection failed', { error });
      });
    const unwatch = pendingSelectionItem.watch(() => {
      readPendingSelection()
        .then((value) => {
          if (active) setSent(value);
        })
        .catch((error: unknown) => {
          log.error('read pending selection failed', { error });
        });
    });
    return () => {
      active = false;
      unwatch();
    };
  }, []);

  const dismiss = () => {
    pendingSelectionItem.setValue(null).catch((error: unknown) => {
      log.error('pendingSelection dismiss failed', { error });
    });
  };

  const shot = useMutation({ mutationFn: captureActiveTab });

  const retry = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void refetch();
      }}
    >
      {t('common.retry')}
    </Button>
  );

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{t('page.title')}</h1>
      {sent && (
        <div className="space-y-2 rounded border p-3 text-sm">
          <p className="font-medium">{t('page.sentSelection')}</p>
          <p className="break-words whitespace-pre-wrap">
            {sent.text === '' ? t('page.noSelection') : sent.text}
          </p>
          {sent.truncated && (
            <p className="text-muted-foreground">
              {t('text.truncated', [formatCount(sent.shown), formatCount(sent.total)])}
            </p>
          )}
          {sent.sourceUrl && <p className="break-all">{sent.sourceUrl}</p>}
          <Button variant="outline" size="sm" onClick={dismiss}>
            {t('common.dismiss')}
          </Button>
        </div>
      )}
      {isPending && <Skeleton className="h-16" />}
      {isError && (
        <Alert>
          <AlertDescription className="gap-2">
            <p>{t('page.noAccess')}</p>
            {retry}
          </AlertDescription>
        </Alert>
      )}
      {data && !data.ok && data.code === 'RESTRICTED' && (
        <Alert>
          <AlertDescription>{t('page.restricted')}</AlertDescription>
        </Alert>
      )}
      {data && !data.ok && data.code !== 'RESTRICTED' && (
        <Alert>
          <AlertDescription className="gap-2">
            <p>{t('page.noAccess')}</p>
            {retry}
          </AlertDescription>
        </Alert>
      )}
      {data?.ok && (
        <dl className="space-y-2 text-sm">
          <dt className="font-medium">{t('page.pageTitle')}</dt>
          <dd className="break-words">{data.title}</dd>
          <dt className="font-medium">{t('page.url')}</dt>
          <dd className="break-all">{data.url}</dd>
          <dt className="font-medium">{t('page.selection')}</dt>
          <dd className="break-words whitespace-pre-wrap">
            {data.selection.text === '' ? t('page.noSelection') : data.selection.text}
          </dd>
          {data.selection.truncated && (
            <dd className="text-muted-foreground">
              {t('text.truncated', [
                formatCount(data.selection.shown),
                formatCount(data.selection.total),
              ])}
            </dd>
          )}
        </dl>
      )}
      <Button
        disabled={shot.isPending}
        onClick={() => {
          shot.mutate();
        }}
      >
        {t('shot.capture')}
      </Button>
      {shot.isError && (
        <Alert>
          <AlertDescription>{t('shot.failed', [shot.error.message])}</AlertDescription>
        </Alert>
      )}
      {shot.data && !shot.data.ok && (
        <Alert>
          <AlertDescription>
            {shot.data.code === 'RESTRICTED'
              ? t('page.restricted')
              : shot.data.code === 'FAILED'
                ? t('shot.failed', [shot.data.reason ?? ''])
                : t('page.noAccess')}
          </AlertDescription>
        </Alert>
      )}
      {shot.data?.ok && (
        <div className="space-y-2">
          <img src={shot.data.dataUrl} alt={t('shot.capture')} className="w-full rounded border" />
          <a className="text-sm underline" href={shot.data.dataUrl} download="screenshot.png">
            {t('shot.download')}
          </a>
        </div>
      )}
    </div>
  );
}
