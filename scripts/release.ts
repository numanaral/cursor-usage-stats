import { execSync } from "child_process";

const BRANCH_PREFIX = "numanaral";

type BumpType = "patch" | "minor" | "major";

const VALID_BUMP_TYPES = ["patch", "minor", "major"] as const;

/**
 * Runs a shell command and returns trimmed stdout.
 */
const run = (command: string) => {
  console.log(`  $ ${command}`);

  return execSync(command, { encoding: "utf-8", stdio: "pipe" }).trim();
};

/**
 * Runs a shell command with inherited stdio (visible output).
 */
const runVisible = (command: string) => {
  console.log(`  $ ${command}`);
  execSync(command, { stdio: "inherit" });
};

/**
 * Reads the current version from package.json.
 */
const getCurrentVersion = () => {
  return run("node -p \"require('./package.json').version\"");
};

/**
 * Checks that the working tree is clean.
 */
const ensureCleanWorkingTree = () => {
  const status = run("git status --porcelain");

  if (status) {
    console.error(
      "\n✗ Working tree is not clean. Commit or stash changes first.\n",
    );
    process.exit(1);
  }
};

/**
 * Checks that we're on main and up to date with origin.
 */
const ensureOnMain = () => {
  const branch = run("git branch --show-current");

  if (branch !== "main") {
    console.error(`\n✗ Must be on main branch (currently on ${branch}).\n`);
    process.exit(1);
  }

  runVisible("git pull origin main");
};

/**
 * Creates a release branch, bumps version, commits, pushes,
 * and creates a PR.
 */
const release = (bumpType: BumpType, dryRun: boolean) => {
  console.log(
    dryRun ? "\n🧪 Dry run — no push or PR.\n" : "\n🚀 Starting release...\n",
  );

  // Ensure clean state on main.
  ensureCleanWorkingTree();
  ensureOnMain();

  const oldVersion = getCurrentVersion();
  console.log(`\n  Current version: ${oldVersion}`);

  // Bump version in package.json (no git tag, no commit).
  run(`npm version ${bumpType} --no-git-tag-version`);

  const newVersion = getCurrentVersion();
  console.log(`  New version:     ${newVersion}\n`);

  // Create and checkout release branch.
  const branchName = `${BRANCH_PREFIX}/release-v${newVersion}`;
  runVisible(`git checkout -b ${branchName}`);

  // Stage and commit.
  runVisible("git add package.json");
  runVisible(`git commit -m "release: v${newVersion}"`);

  // Tag.
  runVisible(`git tag v${newVersion}`);

  if (dryRun) {
    console.log("\n✓ Dry run complete. To clean up:\n");
    console.log(`  git tag -d v${newVersion}`);
    console.log("  git checkout main");
    console.log(`  git branch -D ${branchName}\n`);

    return;
  }

  // Push branch and tag.
  runVisible(`git push -u origin ${branchName}`);
  runVisible(`git push origin v${newVersion}`);

  // Create PR.
  runVisible(
    `gh pr create --title "release: v${newVersion}" --body "Bumps version from ${oldVersion} to ${newVersion}."`,
  );

  console.log(`\n✓ Release PR created for v${newVersion}.\n`);
  console.log("  Merge the PR to trigger the publish workflow.\n");
};

// --- Entry point ---

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const bumpType = args.find((a) => !a.startsWith("--")) as BumpType;

if (!VALID_BUMP_TYPES.includes(bumpType)) {
  console.error("\nUsage: yarn release <patch|minor|major> [--dry-run]\n");
  console.error("  patch    1.0.1 → 1.0.2");
  console.error("  minor    1.0.1 → 1.1.0");
  console.error("  major    1.0.1 → 2.0.0");
  console.error("\n  --dry-run  Do everything locally but skip push and PR.\n");
  process.exit(1);
}

release(bumpType, dryRun);
