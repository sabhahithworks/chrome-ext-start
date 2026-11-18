import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { FileText, Home, Settings, Sparkles } from 'lucide-react';
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
  {
    id: 'page',
    labelKey: 'page.title',
    icon: FileText,
    component: lazy(() => import('./page/PageScreen')),
    requiresAuth: false,
  },
  {
    id: 'ai',
    labelKey: 'nav.ai',
    icon: Sparkles,
    component: lazy(() => import('./ai/AiScreen')),
    requiresAuth: false,
  },
  {
    id: 'settings',
    labelKey: 'nav.settings',
    icon: Settings,
    component: lazy(() => import('./settings/SettingsScreen')),
    requiresAuth: false,
  },
];
