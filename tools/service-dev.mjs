#!/usr/bin/env node
/**
 * Runs the dev server of a single service.
 * Usage: node tools/service-dev.mjs auth-service
 */
import { spawn } from 'node:child_process';
import { SERVICES } from './service-list.mjs';

const service = process.argv[2];

if (!service || !SERVICES.includes(service)) {
  console.error('Unknown service. Usage: node tools/service-dev.mjs <service>');
  console.error('Known services: ' + SERVICES.join(', '));
  process.exit(1);
}

const child = spawn('npm', ['run', 'dev', '-w', '@localwala/' + service], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
