import * as vscode from "vscode";

import {
  getSqliteInstallCommand,
  SQLITE_MISSING_MESSAGE,
  SqlitePromptAction,
} from "./utils";

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
