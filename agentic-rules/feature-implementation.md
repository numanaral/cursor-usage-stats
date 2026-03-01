# Feature Implementation

## Module Structure

New features go in a folder under `src/`:

```
src/featureName/
  types.ts      # Interfaces and type definitions.
  api.ts        # API fetch functions.
  utils.ts      # Pure utility/helper functions.
  index.ts      # Barrel exports.
```

## Checklist

1. **Types**: define interfaces in `types.ts`. Config types extend `ExtensionConfig` in `src/types.ts`.
2. **Settings**: add to `package.json` under `cursorUsageStats.*`, read and validate in `getConfig()` in `extension.ts`.
3. **Commands**: register in `package.json` `contributes.commands`, wire in `activate()`.
4. **Polling**: use an independent `setInterval` if the feature needs its own poll cycle. Do not couple to the existing usage poll.
5. **Mocking**: add mock data getter in `src/__mocking__.ts`, extend `scripts/mocker.ts` with new CLI commands.
6. **Barrel exports**: re-export everything from `index.ts`.
7. **Tests**: write unit tests for pure utilities, integration tests for vscode-dependent logic.

## API Helpers

- `fetchWithAuth<T>(url)` -- GET with auth cookie.
- `fetchWithAuthPost<T>(url, body)` -- POST with auth cookie + `Origin` header.

## Constants

- Add new URLs to `CURSOR_API_URLS` in `src/constants.ts`.
- Add default config values to `EXTENSION_DEFAULT_CONFIG`.
