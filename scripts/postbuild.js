#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const esmDir = path.resolve(__dirname, '..', 'dist', 'esm');
fs.mkdirSync(esmDir, { recursive: true });
fs.writeFileSync(
  path.join(esmDir, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);

const cli = path.resolve(__dirname, '..', 'dist', 'index.js');
if (fs.existsSync(cli)) {
  fs.chmodSync(cli, 0o755);
}
