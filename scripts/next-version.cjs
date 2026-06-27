#!/usr/bin/env node
// Reads conventional commits since the last git tag and determines the next
// semver version. Prints the new version string, or "none" if no bump is needed.
//
// Commit type → bump:
//   fix:, perf:              → patch   (0.2.0 → 0.2.1)
//   feat:                    → minor   (0.2.0 → 0.3.0)
//   <type>!:  or
//   BREAKING CHANGE in body  → major   (0.2.0 → 1.0.0)
//   chore:, docs:, refactor:,
//   test:, style:, ci:       → none    (no release)
const { execSync } = require("child_process");
const fs = require("fs");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

// Base the bump on the last published git tag, not on package.json.
// package.json may already be ahead of the last tag (e.g. manually edited),
// and the released version is what the tag says, not what's in the file.
function getLastTagVersion() {
  try {
    const tag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf8",
    }).trim();
    return tag.replace(/^v/, "");
  } catch {
    return pkg.version; // no tags yet — fall back to package.json
  }
}

const current = getLastTagVersion();

// Collect commit subjects (and bodies for BREAKING CHANGE) since the last tag.
// Falls back to all commits when no tag exists yet.
function getCommits() {
  try {
    const lastTag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf8",
    }).trim();
    return execSync(`git log ${lastTag}..HEAD --pretty=format:%B---COMMIT---`, {
      encoding: "utf8",
    });
  } catch {
    return execSync("git log --pretty=format:%B---COMMIT---", {
      encoding: "utf8",
    });
  }
}

const raw = getCommits();
const messages = raw
  .split("---COMMIT---")
  .map((m) => m.trim())
  .filter(Boolean)
  // Ignore the bot's own version bump commits so they never trigger a new bump.
  .filter((m) => !m.startsWith("chore: bump version"));

let bump = null;

for (const msg of messages) {
  const firstLine = msg.split("\n")[0];

  const isBreaking =
    /^(\w+)(\(.+\))?!:/.test(firstLine) ||
    msg.includes("BREAKING CHANGE");

  if (isBreaking) {
    bump = "major";
    break; // can't go higher
  }

  if (/^feat(\(.+\))?:/.test(firstLine)) {
    if (bump !== "major") bump = "minor";
  }

  if (/^(fix|perf)(\(.+\))?:/.test(firstLine)) {
    if (!bump) bump = "patch";
  }
}

if (!bump) {
  process.stdout.write("none");
  process.exit(0);
}

const [maj, min, pat] = current.split(".").map(Number);
const next =
  bump === "major" ? `${maj + 1}.0.0` :
  bump === "minor" ? `${maj}.${min + 1}.0` :
                     `${maj}.${min}.${pat + 1}`;

process.stdout.write(next);
