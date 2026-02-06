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
export const SQLITE_MISSING_MESSAGE =
  "Cursor Usage Stats requires sqlite3 which was not found " +
  "on this system.";

/** Sqlite3 install prompt button labels. */
export const SqlitePromptAction = {
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
