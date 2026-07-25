import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface PackageMetadata {
  name: string;
  version: string;
}

const isPackageMetadata = (value: unknown): value is PackageMetadata => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const metadata = value as Record<string, unknown>;

  return (
    typeof metadata.name === "string" && typeof metadata.version === "string"
  );
};

const installExtension = () => {
  const workspacePath = path.resolve(__dirname, "..");
  const packageJsonPath = path.join(workspacePath, "package.json");
  const packageMetadata = JSON.parse(
    fs.readFileSync(packageJsonPath, "utf-8"),
  ) as unknown;

  if (!isPackageMetadata(packageMetadata)) {
    throw new Error("package.json is missing a valid name or version.");
  }

  const vsixPath = path.join(
    workspacePath,
    `${packageMetadata.name}-${packageMetadata.version}.vsix`,
  );
  const cursorCommand = process.platform === "win32" ? "cursor.cmd" : "cursor";

  execFileSync(cursorCommand, ["--install-extension", vsixPath, "--force"], {
    stdio: "inherit",
  });

  console.log("\nReload Cursor to activate the local extension build.");
};

installExtension();
