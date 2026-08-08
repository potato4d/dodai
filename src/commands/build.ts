import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import globCallback from 'glob';
const glob = promisify(globCallback);
import ts from 'typescript';
import fsExtra from 'fs-extra';
import consolaModule, { type Consola } from 'consola';

const { copyFile, copySync } = fsExtra;
const consola = consolaModule as unknown as Consola;

const docType = `<!DOCTYPE html>\n`;

// どこかで治す
const ce = console.error;
const cl = console.log;
const cw = console.warn;

const checkOrLogging = (value: unknown, callback: (value: unknown) => void) => {
  if (
    typeof value === 'string' &&
    (value.includes('reactjs.org') ||
      value.includes('1 element as children.'))
  ) {
    return;
  }
  callback(value);
};

console.error = (v) => checkOrLogging(v, ce);
console.log = (v) => checkOrLogging(v, cl);
console.warn = (v) => checkOrLogging(v, cw);

type LayoutModule = {
  Layout: ComponentType<any>;
};

type PageModule = {
  Head?: ComponentType<any>;
  Page: ComponentType<any>;
};

type DataModule = {
  data: Array<{
    url: string;
    data: unknown;
  }>;
};

const importModule = async <T>(modulePath: string): Promise<T> =>
  (await import(pathToFileURL(modulePath).href)) as T;

export async function build(isDevServer?: boolean) {
  const cwd = process.cwd();
  const packageJson = JSON.parse(
    await fs.readFile(path.join(cwd, 'package.json'), 'utf8'),
  ) as { type?: string };
  if (packageJson.type !== 'module') {
    throw new Error(
      'dodai requires the site package.json to set "type": "module".',
    );
  }

  const cacheRoot = path.join(cwd, '.dodai-build');
  await fs.mkdir(cacheRoot, { recursive: true });
  const rootDir = await fs.mkdtemp(path.join(cacheRoot, 'build-'));

  try {
    copySync(`${cwd}/src/static/`, `${cwd}/dist/static/`);
    try {
      const rootFiles = await glob(`${cwd}/dist/static/root/**.*`);
      await Promise.all(
        rootFiles.map((rootFile) =>
          copyFile(
            rootFile,
            `${cwd}/dist/${
              rootFile.split('/')[rootFile.split('/').length - 1]
            }`,
          ),
        ),
      );
    } catch (e) {
      console.log(e);
    }

    const program = ts.createProgram(
      await glob(`${cwd}/src/**/*.{ts,tsx}`),
      {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
        skipLibCheck: true,
        rootDir: path.join(cwd, 'src'),
        outDir: rootDir,
      },
    );
    const emitResult = program.emit();
    const errors = [
      ...ts.getPreEmitDiagnostics(program),
      ...emitResult.diagnostics,
    ].filter(({ category }) => category === ts.DiagnosticCategory.Error);

    if (errors.length > 0) {
      throw new Error(
        ts.formatDiagnosticsWithColorAndContext(errors, {
          getCanonicalFileName: (fileName) => fileName,
          getCurrentDirectory: () => cwd,
          getNewLine: () => '\n',
        }),
      );
    }

    await fs.writeFile(
      path.join(rootDir, 'package.json'),
      `${JSON.stringify({ type: 'module' }, null, 2)}\n`,
      'utf8',
    );

    const pagesRoot = path.join(rootDir, 'pages');
    const paths = await glob(`${pagesRoot}/**/*.js`);
    const { Layout } = await importModule<LayoutModule>(
      path.join(rootDir, 'layouts/default.js'),
    );

    await Promise.all(
      paths.map(async (pagePath) => {
        const relativePagePath = path.relative(pagesRoot, pagePath);
        const { Head, Page } = await importModule<PageModule>(pagePath);

        if (!relativePagePath.includes('[')) {
          const html =
            docType +
            renderToStaticMarkup(
              createElement(
                Layout,
                { head: Head ? createElement(Head, null) : null },
                createElement(Page, null),
              ),
            );
          const fileName = path.join(
            cwd,
            'dist',
            relativePagePath.replace(/\.js$/, '.html'),
          );
          await fs.mkdir(path.dirname(fileName), { recursive: true });
          await fs.writeFile(fileName, html, { encoding: 'utf-8' });
          return html;
        }

        // `pages/detail/[area]/[slug]` 形式
        const metaDataPath = path.join(rootDir, 'data', relativePagePath);
        const { data: metaData } = await importModule<DataModule>(metaDataPath);
        await Promise.all(
          metaData.map(async (single) => {
            const meta = {
              url: single.url,
              data: single.data,
            };
            const head = Head ? createElement(Head, meta) : null;
            const page = createElement(Page, meta);

            const html =
              docType +
              renderToStaticMarkup(createElement(Layout, { head }, page));
            const indexFileName = `${cwd}/dist${single.url}/index.html`;
            await fs.mkdir(path.dirname(indexFileName), {
              recursive: true,
            });
            await fs.writeFile(indexFileName, html, {
              encoding: 'utf-8',
            });
          }),
        );
      }),
    );
  } catch (error) {
    consola.error(error);
    throw error;
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}
