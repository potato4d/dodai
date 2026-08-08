#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { program } from 'commander';
import { build, dev, init } from './index.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

program.version(version, '-v, --version');

program.command('build').action(() => build());

program.command('dev').action(() => dev());

program.command('init').action(() => init());

await program.parseAsync(process.argv);
