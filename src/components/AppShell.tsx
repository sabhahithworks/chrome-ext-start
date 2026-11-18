import { Suspense } from 'react';
import type { KeyboardEvent } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { APP_NAME } from '@/config/app.config';
import { SCREENS } from '@/features/registry';
import type { ScreenDef } from '@/features/registry';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui';

interface AppShellProps {
  screens?: readonly ScreenDef[];
}

export function AppShell({ screens = SCREENS }: AppShellProps) {
  const activeScreen = useUiStore((s) => s.activeScreen);
  const setActiveScreen = useUiStore((s) => s.setActiveScreen);
  const active = screens.find((s) => s.id === activeScreen) ?? screens[0];

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    const index = screens.findIndex((s) => s.id === active?.id);
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % screens.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + screens.length) % screens.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = screens.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = screens[next];
    if (!target) return;
    setActiveScreen(target.id);
    const tabs = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs[next]?.focus();
  }

  const Screen = active?.component;

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-semibold">{APP_NAME}</span>
        <div data-slot="header-actions" />
      </header>
      <main className="flex-1 overflow-y-auto">
        {Screen && (
          <ErrorBoundary key={active.id}>
            <Suspense fallback={<Skeleton className="m-4 h-24" />}>
              <Screen />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
      {screens.length > 0 && (
        <nav role="tablist" className="flex border-t" onKeyDown={onKeyDown}>
          {screens.map((s) => {
            const selected = s.id === active?.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setActiveScreen(s.id);
                }}
                className={cn(
                  'focus-visible:ring-ring/50 flex flex-1 flex-col items-center gap-1 py-2 text-xs outline-none focus-visible:ring-[3px]',
                  selected ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(s.labelKey)}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
