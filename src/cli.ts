#!/usr/bin/env node

import { program } from 'commander';
import { build, dev, init } from './index.js';

const { version } = require('../../package.json') as { version: string };

program.version(version, '-v, --version');

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
