import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { APP_NAME } from '@/config/app.config';
import { t } from '@/lib/i18n';
import { sendMessage } from '@/lib/messaging';

export default function HomeScreen() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['appInfo'],
    queryFn: () => sendMessage('getAppInfo'),
  });

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">{APP_NAME}</h1>
      {isPending && <Skeleton className="h-16" />}
      {isError && (
        <Card>
          <CardContent role="alert" className="text-sm">
            {t('home.bgDown')}
          </CardContent>
        </Card>
      )}
      {data && (
        <Card>
          <CardContent className="text-sm">{t('home.connected', [data.version])}</CardContent>
        </Card>
      )}
    </div>
  );
}
