# Architecture

## Layer map

Imports go downward only:

```
entrypoints  ->  features  ->  lib  ->  config
```

| Layer       | Path                                | Holds                                                       |
| ----------- | ----------------------------------- | ----------------------------------------------------------- |
| Entrypoints | `src/entrypoints`, `src/background` | The side panel root, the background worker and its handlers |
| Features    | `src/features`, `src/components`    | One folder per screen, plus shared UI                       |
| Lib         | `src/lib`, `src/stores`             | Messaging, storage, auth, AI, API client, logger, env, i18n |
| Config      | `src/config/app.config.ts`          | Every switch and limit                                      |

Server data lives in TanStack Query (one client in `src/lib/queryClient.ts`). UI state lives in Zustand (`src/stores/ui.ts`).

## Repo rules

These are enforced in review and by tests.

- **D5, one product name.** The name "Side Panel Starter" is written only as `APP_NAME` in `src/config/app.config.ts`. The manifest name and the panel header read it.
- **D8, one messaging file.** Every runtime message is declared in `ProtocolMap` in `src/lib/messaging.ts` and sent with `@webext-core/messaging`. No raw `browser.runtime.sendMessage`, `onMessage` or `tabs.sendMessage` outside that file.
- **D9, one storage file.** Every `storage.defineItem` lives in `src/lib/storage.ts`. Each item has a `version`, a `fallback` and a zod check on read. A value that fails the check is logged and replaced by the fallback.
- **D10, one env reader.** `src/lib/env.ts` parses env with zod through the pure `parseEnv(raw)`. `wxt.config.ts` calls it at build time. Runtime code calls the memoized `getEnv()` and never reads `import.meta.env` directly. `env.ts` is the only file that does.
- **D11, limits in config.** `src/config/app.config.ts` holds every switch (`AUTH_PROVIDERS`, `AI_PROVIDERS`) and limit (`LIMITS`). No limit is written inline.
- **D33, strings through i18n.** User-facing strings live in `src/locales/en.yml` and are read with `i18n.t(key, args)` from `src/lib/i18n.ts`. No user-facing literal goes in a component.

Also: errors are never swallowed (log or surface them), and the logger in `src/lib/logger.ts` redacts secret-looking keys.

## Add a screen

1. Create a folder under `src/features` with a default-exported component, for example `src/features/page/PageScreen.tsx`.
2. Add the id to `ScreenId` in `src/stores/ui.ts`.
3. Add the label to `src/locales/en.yml`.
4. Add an entry to `SCREENS` in `src/features/registry.ts`:

```ts
{
  id: 'page',
  labelKey: 'page.title',
  icon: FileText,
  component: lazy(() => import('./page/PageScreen')),
  requiresAuth: false,
}
```

Set `requiresAuth: true` to put the screen behind the sign-in gate (`src/features/auth/RequireAuth.tsx`). The tab bar reads `SCREENS`.

## Add a message

Add a method to `ProtocolMap` in `src/lib/messaging.ts`, then handle it in the background:

```ts
interface ProtocolMap {
  getAppInfo(): { name: string; version: string };
  refreshSession(): boolean;
  // add: yourMessage(data: { id: string }): boolean;
}
```

Register the handler with `onMessage` from `src/lib/messaging.ts` in `src/entrypoints/background.ts` (handlers live in `src/background/handlers.ts`). Send it with `sendMessage`.

## Add a storage item

Add it to `src/lib/storage.ts` with a version, a fallback and a zod schema, and read it through a function that validates. Follow `settingsItem` and `readSettings` there:

```ts
export const SettingsSchema = z.object({ theme: z.enum(['system', 'light', 'dark']) });

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});
```

To change the shape later, bump `version` and add a migration. WXT runs `migrations` in order, keyed by the target version:

```ts
storage.defineItem<SettingsV2>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 2,
  migrations: {
    2: (old: SettingsV1): SettingsV2 => ({ ...old, density: 'comfortable' }),
  },
});
```

Update the zod schema to the new shape in the same change.

## Add an alarm job

Jobs are registered in `src/background/alarms.ts` and run on the shared `sync` alarm, whose period is `LIMITS.SYNC_ALARM_PERIOD_MIN`. Register one from `src/entrypoints/background.ts`, where the existing `auth-refresh` job is registered:

```ts
registerAlarmJob('my-job', async () => {
  // do the work; throw on failure
});
```

A name can be registered once, and a failing job is logged without stopping the others.

## Add an auth provider

1. Add the id to `AuthProviderIdSchema` in `src/lib/auth/types.ts`.
2. Implement `AuthProvider` (`signIn`, `refresh`, optional `signOut`) in a new file beside `src/lib/auth/passwordProvider.ts`. Throw `AuthError` with a code on failure.
3. Add the provider to the list in `src/lib/auth/providers.ts`.
4. Add a switch for it to `AUTH_PROVIDERS` in `src/config/app.config.ts`, and any env vars to `src/lib/env.ts` (D10).
5. Add its button and strings to `src/features/auth/LoginForm.tsx` and `src/locales/en.yml`.

## Add an AI provider

AI goes through the `AiProvider` interface in `src/lib/ai/types.ts`. Only `builtin` exists (`src/lib/ai/builtinProvider.ts`, on-device `LanguageModel` and `Summarizer`).

1. Widen the `id` type in `src/lib/ai/types.ts` and implement the interface in a new file beside `src/lib/ai/builtinProvider.ts`.
2. Add it to the list in `src/lib/ai/providers.ts` and a switch to `AI_PROVIDERS` in `src/config/app.config.ts`.

Bring-your-own-key (BYOK) is not built (D20). When you add it, follow these rules:

- keep keys in `local:` storage only (declared in `src/lib/storage.ts`)
- show them masked
- never log them (the logger redacts `apikey` and `api_key`, but do not rely on that)
- send a key only to its own provider
- put it behind the same `AiProvider` interface

## Add a permission

Add it to `permissions` in `wxt.config.ts`. WXT adds some permissions on its own (for example `sidePanel`), so the built manifest can list more than the config does. Origins are not added there by hand: `host_permissions` are built from `WXT_API_BASE_URL` and `WXT_OAUTH_TOKEN_URL`. Document the reason in the permissions table in `README.md`, because each permission is visible to users at install.
