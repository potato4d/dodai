#!/usr/bin/env node

import { program } from 'commander'
import { build } from './commands/build'
import { dev } from './commands/dev'
import { init } from './commands/init'

program
  .version('0.1.0', '-v, --version')

program.command('build')
  .action((cmd, options) => {
    build()
   })

program.command('dev')
  .action(() => { dev() })


program.command('init')
  .action(() => { init() })

program.parse(process.argv)
