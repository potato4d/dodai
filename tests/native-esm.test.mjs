import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const writeFixtureFile = async (root, relativePath, contents) => {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, 'utf8');
};

const reservePort = (port = 0) =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to resolve a test port'));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });

const waitFor = async (predicate, message, diagnostics = () => '') => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        return;
      }
    } catch {
      // The observed file or server may not exist until the next poll.
    }
    await delay(100);
  }
  throw new Error(`${message}\n${diagnostics()}`);
};

const stopProcess = async (child) => {
  if (child.exitCode !== null) {
    return;
  }
  const gracefulExit = once(child, 'exit');
  child.kill('SIGTERM');
  const exited = await Promise.race([
    gracefulExit.then(() => true),
    delay(3_000, false, { ref: false }),
  ]);
  if (exited) {
    return;
  }
  if (child.exitCode === null) {
    const forcedExit = once(child, 'exit');
    child.kill('SIGKILL');
    await forcedExit;
  }
};

test('the packed package contains only native ESM entry points', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'dodai-pack-'));

  try {
    const packageJson = JSON.parse(
      await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
    );
    assert.equal(packageJson.type, 'module');
    assert.equal(packageJson.version, '0.8.0');
    assert.equal(packageJson.exports['.'].require, undefined);
    assert.equal(packageJson.exports['./hotreload'].require, undefined);

    const { stdout } = await execFileAsync(
      'npm',
      [
        'pack',
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        temporaryRoot,
      ],
      { cwd: repoRoot },
    );
    const [packResult] = JSON.parse(stdout);
    const packedPaths = packResult.files.map(({ path: filePath }) => filePath);

    assert.ok(packedPaths.includes('dist/index.js'));
    assert.ok(packedPaths.includes('dist/index.d.ts'));
    assert.ok(packedPaths.includes('dist/hotreload.js'));
    assert.ok(packedPaths.includes('dist/cli.js'));
    assert.equal(
      packedPaths.some(
        (filePath) => filePath.includes('/cjs/') || filePath.endsWith('.cjs'),
      ),
      false,
    );

    const archivePath = path.join(temporaryRoot, packResult.filename);
    const consumerRoot = path.join(temporaryRoot, 'consumer');
    await writeFixtureFile(
      consumerRoot,
      'package.json',
      `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
    );
    await execFileAsync(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        archivePath,
      ],
      { cwd: consumerRoot },
    );

    const installedPackage = path.join(
      consumerRoot,
      'node_modules',
      '@potato4d',
      'dodai',
    );
    const installedPackageJson = JSON.parse(
      await readFile(path.join(installedPackage, 'package.json'), 'utf8'),
    );
    assert.equal(installedPackageJson.type, 'module');
    assert.equal(installedPackageJson.version, packageJson.version);
    assert.equal(installedPackageJson.exports['.'].require, undefined);
    assert.equal(
      installedPackageJson.exports['./hotreload'].require,
      undefined,
    );

    for (const filePath of packedPaths.filter((filePath) =>
      filePath.endsWith('.js'),
    )) {
      const source = await readFile(path.join(installedPackage, filePath), 'utf8');
      assert.doesNotMatch(source, /\brequire\s*\(|\bmodule\.exports\b/);
    }

    await writeFixtureFile(
      consumerRoot,
      'consumer.mjs',
      `import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

process.env.DODAI_RELOAD_PORT = '43123';
const { build, dev, init } = await import('@potato4d/dodai');
const { HotReload } = await import('@potato4d/dodai/hotreload');

if (![build, dev, init, HotReload].every((value) => typeof value === 'function')) {
  throw new Error('Native ESM exports are incomplete');
}

const hotReloadMarkup = renderToStaticMarkup(React.createElement(HotReload, { dev: true }));
if (!hotReloadMarkup.includes('localhost:43123')) {
  throw new Error('HotReload did not use DODAI_RELOAD_PORT');
}
`,
    );

    await execFileAsync(process.execPath, ['consumer.mjs'], {
      cwd: consumerRoot,
    });
    const installedBin = path.join(consumerRoot, 'node_modules', '.bin', 'dodai');
    await access(installedBin);
    const { stdout: cliVersion } = await execFileAsync(
      installedBin,
      ['--version'],
      { cwd: consumerRoot },
    );
    assert.equal(cliVersion.trim(), packageJson.version);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('init configures new projects for native ESM', async () => {
  const temporaryRoot = await mkdtemp(path.join(repoRoot, '.dodai-init-'));

  try {
    await writeFixtureFile(
      temporaryRoot,
      'package.json',
      `${JSON.stringify({ name: 'fixture-site', private: true }, null, 2)}\n`,
    );
    const fakeNpmPath = path.join(temporaryRoot, 'bin', 'npm');
    await writeFixtureFile(temporaryRoot, 'bin/npm', '#!/bin/sh\nexit 0\n');
    await chmod(fakeNpmPath, 0o755);

    await execFileAsync(
      process.execPath,
      [path.join(repoRoot, 'dist/cli.js'), 'init'],
      {
        cwd: temporaryRoot,
        env: {
          ...process.env,
          PATH: `${path.dirname(fakeNpmPath)}${path.delimiter}${process.env.PATH}`,
        },
      },
    );

    const packageJson = JSON.parse(
      await readFile(path.join(temporaryRoot, 'package.json'), 'utf8'),
    );
    const tsconfig = JSON.parse(
      await readFile(path.join(temporaryRoot, 'tsconfig.json'), 'utf8'),
    );
    assert.equal(packageJson.name, 'fixture-site');
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.type, 'module');
    assert.equal(tsconfig.compilerOptions.module, 'NodeNext');
    assert.equal(tsconfig.compilerOptions.moduleResolution, 'NodeNext');
    assert.match(
      await readFile(
        path.join(temporaryRoot, 'src/layouts/default.tsx'),
        'utf8',
      ),
      /DODAI_RELOAD_PORT/,
    );
    await access(path.join(temporaryRoot, 'src/pages/index.tsx'));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('the CLI reports native ESM render failures with a non-zero exit', async () => {
  const temporaryRoot = await mkdtemp(path.join(repoRoot, '.dodai-error-'));

  try {
    await writeFixtureFile(
      temporaryRoot,
      'package.json',
      `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'src/layouts/default.tsx',
      `import React from 'react';

export const Layout: React.FC<React.PropsWithChildren<{ head: React.ReactNode }>> = ({ head, children }) => (
  <html><head>{head}</head><body>{children}</body></html>
);
`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'src/pages/index.tsx',
      `import React from 'react';

export const Page = () => {
  throw new Error('native-esm-render-failure');
  return <main>unreachable</main>;
};
`,
    );
    await writeFixtureFile(temporaryRoot, 'src/static/robots.txt', '');

    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          '--unhandled-rejections=warn',
          path.join(repoRoot, 'dist/cli.js'),
          'build',
        ],
        { cwd: temporaryRoot },
      ),
      (error) => {
        assert.notEqual(error.code, 0);
        assert.match(
          `${error.stdout ?? ''}${error.stderr ?? ''}`,
          /native-esm-render-failure/,
        );
        return true;
      },
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('site builds use ESM and refresh the full imported module graph', async () => {
  const temporaryRoot = await mkdtemp(
    path.join(repoRoot, '.dodai native esm #'),
  );
  const originalCwd = process.cwd();

  const writeRevision = (revision) =>
    writeFixtureFile(
      temporaryRoot,
      'src/shared/revision.ts',
      `export const revision = '${revision}';
export const revisionModuleUrl = import.meta.url;
`,
    );

  try {
    await writeFixtureFile(
      temporaryRoot,
      'package.json',
      `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'node_modules/fixture-esm-only/package.json',
      `${JSON.stringify(
        {
          name: 'fixture-esm-only',
          version: '1.0.0',
          type: 'module',
          exports: {
            '.': {
              types: './types/index.d.ts',
              import: './dist/index.js',
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'node_modules/fixture-esm-only/dist/index.js',
      `export const esmOnlyValue = 'esm-only';\n`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'node_modules/fixture-esm-only/types/index.d.ts',
      `export declare const esmOnlyValue: string;\n`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'src/layouts/default.tsx',
      `import React from 'react';
import { revision, revisionModuleUrl } from '../shared/revision.js';

export const Layout: React.FC<React.PropsWithChildren<{ head: React.ReactNode }>> = ({ head, children }) => (
  <html>
    <head>{head}</head>
    <body data-layout={revision} data-module-url={revisionModuleUrl}>{children}</body>
  </html>
);
`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'src/pages/index.tsx',
      `import React from 'react';
import { esmOnlyValue } from 'fixture-esm-only';
import { revision, revisionModuleUrl } from '../shared/revision.js';

export const Head = () => <title>{revision}</title>;
export const Page = () => <main>{revision}:{esmOnlyValue}:{revisionModuleUrl}</main>;
`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'src/pages/items/[item].tsx',
      `import React from 'react';
import { esmOnlyValue } from 'fixture-esm-only';
import { revision } from '../../shared/revision.js';

type ItemProps = { data: { name: string } };

export const Head: React.FC<ItemProps> = ({ data }) => <title>{data.name}</title>;
export const Page: React.FC<ItemProps> = ({ data }) => (
  <main>{revision}:{esmOnlyValue}:{data.name}</main>
);
`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'src/data/items/[item].tsx',
      `import { esmOnlyValue } from 'fixture-esm-only';
import { revision } from '../../shared/revision.js';

export const data = [{
  url: \`/items/\${revision}\`,
  data: { name: \`\${revision}:\${esmOnlyValue}\` },
}];
`,
    );
    await writeFixtureFile(
      temporaryRoot,
      'src/static/root/native-esm.txt',
      'native-esm',
    );
    await writeRevision('v1');

    await execFileAsync(
      process.execPath,
      [path.join(repoRoot, 'dist/cli.js'), 'build'],
      { cwd: temporaryRoot },
    );
    assert.match(
      await readFile(path.join(temporaryRoot, 'dist/index.html'), 'utf8'),
      /v1:esm-only/,
    );

    process.chdir(temporaryRoot);
    const { build } = await import('../dist/index.js');
    await build();

    const firstHtml = await readFile(
      path.join(temporaryRoot, 'dist/index.html'),
      'utf8',
    );
    assert.match(firstHtml, /v1:esm-only/);
    await access(path.join(temporaryRoot, 'dist/items/v1/index.html'));
    assert.equal(
      await readFile(path.join(temporaryRoot, 'dist/native-esm.txt'), 'utf8'),
      'native-esm',
    );
    const firstModuleUrl = firstHtml.match(
      /file:[^"<]*\.dodai-build\/build-[^"<]*\/shared\/revision\.js/,
    )?.[0];
    assert.ok(firstModuleUrl);

    await writeRevision('v2');
    await build();

    const secondHtml = await readFile(
      path.join(temporaryRoot, 'dist/index.html'),
      'utf8',
    );
    assert.match(secondHtml, /v2:esm-only/);
    const dynamicHtml = await readFile(
      path.join(temporaryRoot, 'dist/items/v2/index.html'),
      'utf8',
    );
    assert.match(dynamicHtml, /v2:esm-only:v2:esm-only/);
    assert.match(dynamicHtml, /<title>v2:esm-only<\/title>/);
    const secondModuleUrl = secondHtml.match(
      /file:[^"<]*\.dodai-build\/build-[^"<]*\/shared\/revision\.js/,
    )?.[0];
    assert.ok(secondModuleUrl);
    assert.notEqual(secondModuleUrl, firstModuleUrl);
    assert.deepEqual(
      await readdir(path.join(temporaryRoot, '.dodai-build')),
      [],
    );

    const previewPort = await reservePort();
    const reloadPort = await reservePort();
    const devProcess = spawn(
      process.execPath,
      [path.join(repoRoot, 'dist/cli.js'), 'dev'],
      {
        cwd: temporaryRoot,
        env: {
          ...process.env,
          PORT: String(previewPort),
          DODAI_RELOAD_PORT: String(reloadPort),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let devLogs = '';
    let devError;
    devProcess.stdout.on('data', (chunk) => {
      devLogs += chunk.toString();
    });
    devProcess.stderr.on('data', (chunk) => {
      devLogs += chunk.toString();
    });
    devProcess.once('error', (error) => {
      devError = error;
    });

    try {
      await waitFor(
        async () => {
          if (devError || devProcess.exitCode !== null) {
            return false;
          }
          const response = await fetch(`http://127.0.0.1:${previewPort}/`);
          return response.ok && devLogs.includes('Preview Server');
        },
        'The native ESM dev server did not become ready',
        () => devLogs,
      );
      const devFirstHtml = await readFile(
        path.join(temporaryRoot, 'dist/index.html'),
        'utf8',
      );
      const devFirstModuleUrl = devFirstHtml.match(
        /file:[^"<]*\.dodai-build\/build-[^"<]*\/shared\/revision\.js/,
      )?.[0];
      assert.ok(devFirstModuleUrl);

      await writeRevision('v3');
      await waitFor(
        async () => {
          const indexHtml = await readFile(
            path.join(temporaryRoot, 'dist/index.html'),
            'utf8',
          );
          const itemHtml = await readFile(
            path.join(temporaryRoot, 'dist/items/v3/index.html'),
            'utf8',
          );
          const response = await fetch(`http://127.0.0.1:${previewPort}/`);
          const responseHtml = await response.text();
          return (
            indexHtml.includes('v3:esm-only') &&
            itemHtml.includes('v3:esm-only:v3:esm-only') &&
            responseHtml.includes('v3:esm-only')
          );
        },
        'The dev server did not rebuild the transitive ESM graph',
        () => devLogs,
      );

      const devSecondHtml = await readFile(
        path.join(temporaryRoot, 'dist/index.html'),
        'utf8',
      );
      const devSecondModuleUrl = devSecondHtml.match(
        /file:[^"<]*\.dodai-build\/build-[^"<]*\/shared\/revision\.js/,
      )?.[0];
      assert.ok(devSecondModuleUrl);
      assert.notEqual(devSecondModuleUrl, devFirstModuleUrl);
    } finally {
      await stopProcess(devProcess);
    }
  } finally {
    process.chdir(originalCwd);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
