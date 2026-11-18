import { useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LoginForm } from '@/features/auth/LoginForm';
import { useMe, useSession } from '@/features/auth/useSession';
import { signOut } from '@/lib/auth/session';
import { t } from '@/lib/i18n';
import { createLogger } from '@/lib/logger';

const log = createLogger('AccountMenu');

function SignedInMenu() {
  const me = useMe();
  const [signOutError, setSignOutError] = useState<unknown>(null);
  const doSignOut = () => {
    setSignOutError(null);
    signOut().catch((error: unknown) => {
      log.error('sign out failed', { error });
      setSignOutError(error);
    });
  };
  const label = me.data?.email ?? (me.isPending ? t('common.loading') : t('common.retry'));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {me.isError ? (
          <ErrorState
            error={me.error}
            onRetry={() => {
              void me.refetch();
            }}
          />
        ) : (
          <DropdownMenuLabel>{me.data?.email}</DropdownMenuLabel>
        )}
        {signOutError != null && <ErrorState error={signOutError} onRetry={doSignOut} />}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            doSignOut();
          }}
        >
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SignedOutMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        {t('auth.signIn')}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('auth.signIn')}</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <LoginForm />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function AccountMenu() {
  const { status } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedIn') return <SignedInMenu />;
  return <SignedOutMenu />;
}
