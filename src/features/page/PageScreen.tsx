import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCount, t } from '@/lib/i18n';
import { getPageInfo } from '@/lib/page';
import { captureActiveTab } from '@/lib/screenshot';

export default function PageScreen() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['pageInfo'],
    queryFn: getPageInfo,
  });
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
      {isPending && <Skeleton className="h-16" />}
      {isError && (
        <Alert className="flex-col">
          <p>{t('page.noAccess')}</p>
          {retry}
        </Alert>
      )}
      {data && !data.ok && data.code === 'RESTRICTED' && <Alert>{t('page.restricted')}</Alert>}
      {data && !data.ok && data.code !== 'RESTRICTED' && (
        <Alert className="flex-col">
          <p>{t('page.noAccess')}</p>
          {retry}
        </Alert>
      )}
      {data?.ok && (
        <dl className="space-y-2 text-sm">
          <dt className="font-medium">{t('page.title')}</dt>
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
      {shot.isError && <Alert>{t('shot.failed', [shot.error.message])}</Alert>}
      {shot.data && !shot.data.ok && (
        <Alert>
          {shot.data.code === 'RESTRICTED'
            ? t('page.restricted')
            : shot.data.code === 'FAILED'
              ? t('shot.failed', [shot.data.reason ?? ''])
              : t('page.noAccess')}
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
