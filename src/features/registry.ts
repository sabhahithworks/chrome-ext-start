import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { Home } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MessageKey } from '@/lib/i18n';
import type { ScreenId } from '@/stores/ui';

export interface ScreenDef {
  id: ScreenId;
  labelKey: MessageKey;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>;
  requiresAuth: boolean;
}

export const SCREENS: readonly ScreenDef[] = [
  {
    id: 'home',
    labelKey: 'nav.home',
    icon: Home,
    component: lazy(() => import('./home/HomeScreen')),
    requiresAuth: false,
  },
];
