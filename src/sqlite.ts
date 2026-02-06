import * as vscode from "vscode";
import { execFileSync } from "child_process";
import * as os from "os";

/** Signal payload set on globalThis for cross-bundle test verification. */
export interface SqlitePromptSignal {
  message: string;
  actions: string[];
}

declare global {
  var __sqlitePromptSignal: SqlitePromptSignal | undefined;
}

/** Sqlite3 install prompt message. */
const SQLITE_MISSING_MESSAGE =
  "Cursor Usage Stats requires sqlite3 which was not found " +
  "on this system.";

/** Sqlite3 install prompt button labels. */
const SqlitePromptAction = {
  InstallInTerminal: "Install in Terminal",
  CopyCommand: "Copy Command",
} as const;

/**
 * Checks whether the sqlite3 CLI is available on the system.
 *
 * Uses execFileSync (no shell) so PATH is respected directly
 * without shell init scripts (e.g. path_helper) resetting it.
 */
export const isSqliteAvailable = () => {
  try {
    execFileSync("sqlite3", ["--version"], { stdio: "ignore" });

    return true;
  } catch {
    return false;
  }
};

/**
 * Returns the platform-specific install command for sqlite3.
 */
export const getSqliteInstallCommand = () => {
  const platform = os.platform();

  if (platform === "darwin") return "brew install sqlite3";
  if (platform === "win32") return "winget install SQLite.SQLite";

  return "sudo apt-get install -y sqlite3";
};

/**
 * Prompts the user to install sqlite3 with a terminal action.
 */
export const promptSqliteInstall = async () => {
  const command = getSqliteInstallCommand();
  const actions = [
    SqlitePromptAction.InstallInTerminal,
    SqlitePromptAction.CopyCommand,
  ];

  // Cross-bundle signal for test verification.
  // Set before the first await so it's available immediately.
  globalThis.__sqlitePromptSignal = {
    message: SQLITE_MISSING_MESSAGE,
    actions: [...actions],
  };

  const selection = await vscode.window.showErrorMessage(
    SQLITE_MISSING_MESSAGE,
    ...actions,
  );

  if (selection === SqlitePromptAction.InstallInTerminal) {
    const terminal = vscode.window.createTerminal("Install sqlite3");
    terminal.show();
    terminal.sendText(command);

    showReloadPrompt();
  }

  if (selection === SqlitePromptAction.CopyCommand) {
    await vscode.env.clipboard.writeText(command);

    showReloadPrompt();
  }
};

/**
 * Shows a follow-up prompt to reload the window after installing sqlite3.
 */
const showReloadPrompt = async () => {
  const selection = await vscode.window.showInformationMessage(
    "After installing sqlite3, reload the window to activate " +
      "Cursor Usage Stats.",
    "Reload Window",
  );

  if (selection === "Reload Window") {
    vscode.commands.executeCommand("workbench.action.reloadWindow");
  }
};
