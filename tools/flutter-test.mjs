#!/usr/bin/env node
/**
 * Runs `flutter analyze` + `flutter test` for every Flutter/Dart package
 * in the workspace (apps/* and packages/*).
 */
import { existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const roots = ['packages', 'apps'];
const dirs = [];

for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const dir = `${root}/${entry.name}`;
    if (entry.isDirectory() && existsSync(`${dir}/pubspec.yaml`)) {
      dirs.push(dir);
    }
  }
}

if (dirs.length === 0) {
  console.log('No Flutter/Dart packages found.');
  process.exit(0);
}

for (const dir of dirs) {
  console.log(`\n=== ${dir}`);
  execSync('flutter analyze', { cwd: dir, stdio: 'inherit', shell: true });
  execSync('flutter test', { cwd: dir, stdio: 'inherit', shell: true });
}
