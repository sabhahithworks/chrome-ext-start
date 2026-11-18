import { useEffect, useId, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiErrorMessage } from '@/lib/api/errors';
import { enabledProviders } from '@/lib/auth/providers';
import { saveTokens } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/types';
import type { AuthProvider } from '@/lib/auth/types';
import { t } from '@/lib/i18n';
import { createLogger } from '@/lib/logger';
import { errorMessage } from '@/lib/errorMessage';

const log = createLogger('LoginForm');

function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code === 'BAD_CREDENTIALS') return t('auth.badCredentials');
    if (error.code === 'CANCELLED') return t('auth.cancelled');
    return t('auth.failed', [error.message]);
  }
  if (error instanceof ApiError) return apiErrorMessage(error);
  return t('auth.failed', [errorMessage(error)]);
}

export function LoginForm() {
  const providers = enabledProviders();
  const queryClient = useQueryClient();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signIn = useMutation({
    mutationFn: async ({
      provider,
      input,
    }: {
      provider: AuthProvider;
      input?: { email: string; password: string };
    }) => {
      const tokens = await provider.signIn(input);
      await saveTokens(provider.id, tokens);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
    onError: (error) => {
      log.warn('sign-in failed', { error });
    },
  });

  const noProviders = providers.length === 0;
  useEffect(() => {
    if (noProviders) log.warn('no auth providers enabled');
  }, [noProviders]);
  if (noProviders) return null;

  const password_ = providers.find((p) => p.id === 'password');
  const oauth = providers.find((p) => p.id === 'oauth');
  const empty = email.trim() === '' || password === '';

  function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password_ || empty || signIn.isPending) return;
    signIn.mutate({ provider: password_, input: { email: email.trim(), password } });
  }

  return (
    <div className="space-y-4">
      {password_ && (
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor={`${id}-email`}>{t('auth.email')}</Label>
            <Input
              id={`${id}-email`}
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-password`}>{t('auth.password')}</Label>
            <Input
              id={`${id}-password`}
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
            />
          </div>
          <Button type="submit" disabled={empty || signIn.isPending}>
            {t('auth.signIn')}
          </Button>
        </form>
      )}
      {oauth && (
        <Button
          type="button"
          variant="outline"
          disabled={signIn.isPending}
          onClick={() => {
            if (!signIn.isPending) signIn.mutate({ provider: oauth });
          }}
        >
          {t('auth.sso')}
        </Button>
      )}
      {signIn.isError && (
        <Alert variant="destructive">
          <AlertDescription>{authErrorMessage(signIn.error)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
