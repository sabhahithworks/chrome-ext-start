# Side Panel Starter

A production-grade starter for a Manifest V3 side panel extension, built with WXT, React 19, Tailwind 4, TanStack Query, Zustand and zod. It ships a tabbed panel (Home, Page, AI, Settings), password and OAuth sign-in, a page-info reader, a screenshot action, a context menu, a keyboard shortcut and an on-device AI screen.

The product name lives in one place, `APP_NAME` in `src/config/app.config.ts`. The manifest and the panel header both read it.

## Requirements

- Node 22 (see `.nvmrc`)
- pnpm 10 (`packageManager` in `package.json`)
- Chrome 116 or later, or a recent Edge

## Setup

```sh
pnpm install
cp .env.example .env
```

Edit `.env` (see [Environment variables](#environment-variables)). A bad value fails the build.

## Run

```sh
pnpm dev        # Chrome, with hot reload
pnpm dev:edge   # Edge
```

To load a build by hand, run `pnpm build`, open `chrome://extensions`, enable Developer mode, choose Load unpacked and select `.output/chrome-mv3`.

## Scripts

| Script              | What it does                               |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | Start WXT in dev mode for Chrome           |
| `pnpm dev:edge`     | Start WXT in dev mode for Edge             |
| `pnpm build`        | Production build into `.output/chrome-mv3` |
| `pnpm zip`          | Build and zip for the store                |
| `pnpm typecheck`    | `wxt prepare`, then `tsc --noEmit`         |
| `pnpm lint`         | ESLint with zero warnings allowed          |
| `pnpm format`       | Prettier, write                            |
| `pnpm format:check` | Prettier, check only                       |
| `pnpm test`         | Vitest unit tests                          |
| `pnpm test:watch`   | Vitest in watch mode                       |
| `pnpm test:e2e`     | Build, then Playwright tests               |

`pnpm install` runs `wxt prepare` (postinstall) and installs the lefthook git hooks (prepare). Commit messages are checked by commitlint.

## Environment variables

`src/lib/env.ts` validates these with zod. `wxt.config.ts` runs the check at build time.

| Variable                  | Required              | Default                               | Purpose                |
| ------------------------- | --------------------- | ------------------------------------- | ---------------------- |
| `WXT_API_BASE_URL`        | yes (URL)             |                                       | Backend base URL       |
| `WXT_OAUTH_AUTHORIZE_URL` | when OAuth is enabled |                                       | IdP authorize endpoint |
| `WXT_OAUTH_TOKEN_URL`     | when OAuth is enabled |                                       | IdP token endpoint     |
| `WXT_OAUTH_CLIENT_ID`     | when OAuth is enabled |                                       | OAuth public client id |
| `WXT_OAUTH_SCOPES`        | no                    | `openid profile email offline_access` | Space-separated scopes |

Most IdPs need `offline_access` before they issue a refresh token. Remove it for an IdP that rejects it, such as Google.

## Authentication

Switches live in `AUTH_PROVIDERS` in `src/config/app.config.ts`. Set `password` or `oauth` to `false` to hide that sign-in method. When `oauth` is off, the three OAuth variables are not required.

### Password and backend contract

The default contract is below. Every request and response body is validated with zod, and the paths are in `API_PATHS` in `src/config/app.config.ts`, so you can change them.

| Request                              | Response                                 |
| ------------------------------------ | ---------------------------------------- |
| `POST /auth/login {email, password}` | `{accessToken, refreshToken, expiresIn}` |
| `POST /auth/refresh {refreshToken}`  | the same shape                           |
| `POST /auth/logout {refreshToken}`   | 204                                      |
| `GET /me`                            | `{id, email, name}`                      |

### OAuth

The OAuth flow runs through `browser.identity`, using PKCE (`src/lib/auth/pkce.ts`). Register this redirect URI with your IdP:

```
https://<extension-id>.chromiumapp.org/oauth
```

The extension id is shown on `chrome://extensions`. It is stable only when the extension has a fixed key or a published store id, so register the redirect URI again if the id changes (for example between an unpacked build and the store build).

## Keyboard shortcut

Alt+Shift+S opens the side panel. Change it at `chrome://extensions/shortcuts`.

## Permissions

| Permission         | Why                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `storage`          | Settings, tokens and the pending selection                                                                               |
| `activeTab`        | Read the current page after a user action (page info, screenshot)                                                        |
| `scripting`        | Run the page reader in the active tab                                                                                    |
| `contextMenus`     | The "send selection" menu entry                                                                                          |
| `alarms`           | Periodic sync and token refresh                                                                                          |
| `identity`         | OAuth sign-in through `browser.identity`                                                                                 |
| `sidePanel`        | Show the extension in the browser side panel (added by WXT for the side panel entrypoint, not listed in `wxt.config.ts`) |
| `host_permissions` | The origins of `WXT_API_BASE_URL` and `WXT_OAUTH_TOKEN_URL`, as `<origin>/*`                                             |

## Release

1. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:` and so on). commitlint enforces this.
2. On every push to `main`, `.github/workflows/release-please.yml` opens or updates a release pull request that bumps the version and the changelog.
3. Merging that pull request creates a release. The `submit` job in the same workflow then builds the zip and submits it to the Chrome Web Store.
4. `.github/workflows/submit.yml` runs the same submit steps on demand (`workflow_dispatch`).

Configure these in the GitHub repository settings.

Secrets (the job fails early if one is missing):

- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

Repository variables, written to `.env` before the build:

- `WXT_API_BASE_URL`
- `WXT_OAUTH_AUTHORIZE_URL`
- `WXT_OAUTH_TOKEN_URL`
- `WXT_OAUTH_CLIENT_ID`
- `WXT_OAUTH_SCOPES`

CI checks run from `.github/workflows/ci.yml`.

## Troubleshooting

**The Page tab says it cannot access the page.** The panel can read a page only after you act on it (click the toolbar icon, use the shortcut or use the context menu on that tab), because the extension relies on `activeTab`. The shortcut and the context menu refresh the Page tab by themselves; after a toolbar-icon click, press Retry. Switching tabs re-reads the new tab, which shows this message again until you act on it. Page info reads the top frame only, so text selected inside an embedded frame shows as "No text selected" (the context menu still sends it).

**The Page tab says the page is restricted.** Browser pages (`chrome://`, `edge://`, `about:`, `view-source:`, `devtools://`, `chrome-extension://`) and the Chrome and Edge web stores cannot be read by any extension. There is no Retry on these. The list is `RESTRICTED_URL_PREFIXES` in `src/config/app.config.ts`.

**The AI tab says AI is unavailable.** The AI screen uses the built-in browser `LanguageModel` and `Summarizer` APIs. They are missing on Edge and on older Chrome versions.

**The build fails on env validation.** Check `.env` against the table above.

## More

See `docs/architecture.md` for the layer map and how to extend the starter.
