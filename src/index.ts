#!/usr/bin/env node

import { program } from 'commander';
import { build } from './commands/build.js';
import { dev } from './commands/dev.js';
import { init } from './commands/init.js';

program.version('0.1.0', '-v, --version');

program.command('build').action(() => {
  build();
});

program.command('dev').action(() => {
  dev();
});

program.command('init').action(() => {
  init();
});

program.parse(process.argv);
