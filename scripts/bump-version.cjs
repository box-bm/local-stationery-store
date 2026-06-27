#!/usr/bin/env node
// Updates the version in package.json, src-tauri/tauri.conf.json, and
// src-tauri/Cargo.toml to keep them in sync before a release.
//
// Usage:
//   npm run bump patch        → 0.2.0 → 0.2.1
//   npm run bump minor        → 0.2.0 → 0.3.0
//   npm run bump major        → 0.2.0 → 1.0.0
//   npm run bump 1.2.3        → sets an explicit version
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

function resolveVersion(arg, current) {
  if (!arg) return null;
  if (/^\d+\.\d+\.\d+$/.test(arg)) return arg;
  const [maj, min, pat] = current.split(".").map(Number);
  if (arg === "major") return `${maj + 1}.0.0`;
  if (arg === "minor") return `${maj}.${min + 1}.0`;
  if (arg === "patch") return `${maj}.${min}.${pat + 1}`;
  return null;
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const arg = args.find((a) => a !== "--dry-run");
const version = resolveVersion(arg, pkg.version);

if (!version) {
  console.error("Usage: npm run bump <major | minor | patch | x.y.z>");
  console.error(`Current version: ${pkg.version}`);
  process.exit(1);
}

// --dry-run: just print the new version and exit (used by CI to read the value)
if (dryRun) {
  process.stdout.write(version);
  process.exit(0);
}

console.log(`${pkg.version} → ${version}\n`);

// package.json
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`✓ package.json`);

// src-tauri/tauri.conf.json
const confPath = path.join(root, "src-tauri", "tauri.conf.json");
const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
conf.version = version;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
console.log(`✓ src-tauri/tauri.conf.json`);

// src-tauri/Cargo.toml
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
const cargo = fs.readFileSync(cargoPath, "utf8");
const updated = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);
if (updated === cargo) {
  console.error("✗ Could not find version field in Cargo.toml");
  process.exit(1);
}
fs.writeFileSync(cargoPath, updated);
console.log(`✓ src-tauri/Cargo.toml`);

console.log(`\nNext: commit these files with`);
console.log(`  git commit -m "chore: bump version to ${version}"`);
