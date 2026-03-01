# Testing

## Framework

- Mocha TDD style: `suite()`, `test()`, `setup()`, `teardown()`.
- Assertions: `assert.strictEqual`, `assert.ok`, `assert.deepStrictEqual` from Node `assert`.
- Timeout: 20s default. Use `this.timeout(15000)` for longer flow simulations.

## Structure

- Unit tests: `testing/unit/*.test.ts` -- run with plain Mocha, no VS Code host.
- Integration tests: `testing/integration/<suite>/*.test.ts` -- run inside VS Code Extension Host via `@vscode/test-cli`.
- Suites: `welcomeMessage`, `usageThreshold`, `maxModeDetection`, `spendingGuard`, `wizard`, `tips`, `sqlite`.

## Critical Rules

### No `vscode` imports in unit tests

Unit tests **cannot** import modules that depend on `vscode`. If a module imports `vscode`, test it via integration tests or test its pure utility functions indirectly.

### Integration tests must trigger visible UI

Every integration test must use `await sleep(UI_PAUSE_MS)` between visible steps so the test flow is observable in slow mode (`yarn test:slow`). This is non-negotiable.

Import the helpers:

```ts
import { sleep, UI_PAUSE_MS } from "../../utils";
```

Rules:

- Every `test()` that performs a visible action (notification, Quick Pick, status bar update, modal, command execution) must `await sleep(UI_PAUSE_MS)` after the action.
- Even state-only tests should include a sleep at the end for consistent pacing.
- Flow simulation tests (multi-step sequences) must sleep between each step.
- Tests that trigger `vscode.window.showWarningMessage`, `showErrorMessage`, `showInformationMessage`, `showQuickPick`, or `showInputBox` are considered visible.
- Tests that call functions which internally trigger the above (e.g. `checkMaxModeDetection`, `checkSpendingGuard`, `showRandomTip`, `showTips`, `checkOnDemandThresholds`) are also visible.

### Integration tests must test real VS Code interactions

Integration tests exist to test code that depends on the `vscode` API. They should:

- Trigger actual notifications, Quick Picks, and status bar updates.
- Verify command registration via `vscode.commands.getCommands()`.
- Read/write configuration via `vscode.workspace.getConfiguration()`.
- Test the full flow end-to-end, not just internal state.

Do **not** write integration tests that only assert on internal state without triggering any VS Code UI. Those belong in unit tests.

### Modal dialogs are blocked in the test environment

VS Code's `DialogService` refuses to show modal dialogs (`{ modal: true }`) when running in extension test mode. This is hardcoded in VS Code -- there is no flag or workaround.

For functions that show modals (e.g. `showWarningMessage` / `showErrorMessage` with `{ modal: true }`):

- Use an injectable `AlertShowFn` parameter (see `src/events/types.ts`).
- In tests, pass a mock function that records calls and resolves with a simulated selection.
- Assert on the message, options (`modal: true`), and button items.
- To test selection handlers (snooze, dismiss), resolve the mock with the desired selection string and `await sleep(50)` for the `.then()` handler.

```ts
import { type AlertShowFn } from "../../../src/alerts/types";

const createMockShowFn = (selection?: string) => {
  const calls: Array<{
    message: string;
    options: { modal?: boolean };
    items: string[];
  }> = [];

  const mockFn: AlertShowFn = (message, options, ...items) => {
    calls.push({ message, options, items });
    return Promise.resolve(selection);
  };

  return { mockFn, calls } as const;
};
```

Non-modal notifications (`notificationMode: "toast"`) work fine and should use real `vscode.window.show*Message` calls with `waitForNotificationAndDismiss()` to be visible in slow mode.

## Mock Config Pattern

Use `EXTENSION_DEFAULT_CONFIG` for `alerts` and `tips` fields:

```ts
import { EXTENSION_DEFAULT_CONFIG } from "../../src/constants";

const createMockConfig = (
  overrides: Partial<ExtensionConfig> = {},
): ExtensionConfig => {
  return {
    // ...base fields...
    alerts: EXTENSION_DEFAULT_CONFIG.alerts,
    tips: EXTENSION_DEFAULT_CONFIG.tips,
    ...overrides,
  };
};
```

For feature-specific configs, create a focused helper:

```ts
const createAlertsConfig = (
  overrides: Partial<AlertsConfig> = {},
): AlertsConfig => ({
  ...EXTENSION_DEFAULT_CONFIG.alerts,
  ...overrides,
});
```

## Flow Simulation Tests

For features with progressive state changes (e.g. spending increasing, MAX mode calls accumulating), write a "Full Flow Simulation" test:

```ts
// eslint-disable-next-line no-restricted-syntax
test("simulates complete flow", async function () {
  this.timeout(15000);

  const sequence = [
    { input: ..., expected: ..., description: "Step 1" },
    { input: ..., expected: ..., description: "Step 2" },
  ];

  for (const step of sequence) {
    // Perform action that triggers VS Code UI.
    performAction(step.input);

    // Assert expected state.
    assert.strictEqual(getState(), step.expected, step.description);

    await sleep(UI_PAUSE_MS);
  }
});
```

## Commands

- `yarn pretest` -- compiles to `out/` via `tsc` (required before running tests).
- `yarn test:unit` -- unit tests only.
- `yarn test:integration` -- all integration test suites.
- `yarn test:integration:only <suite>` -- single suite (e.g. `yarn test:integration:only spendingGuard`).
- `yarn test` -- both unit and integration.
- `yarn test:slow` -- 1s pauses between UI steps (for observing test flow).
