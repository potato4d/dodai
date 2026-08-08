import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import globCallback from 'glob';
import { createRequire } from 'module';
import { promisify } from 'util';
const glob = promisify(globCallback);
import * as ts from 'typescript';
import fsExtra from 'fs-extra';
import consola from 'consola';

const { copyFile, copySync } = fsExtra;

const docType = `<!DOCTYPE html>\n`;

// どこかで治す
const ce = console.error;
const cl = console.log;
const cw = console.warn;

const checkOrLogging = (v: any, callback: Function) => {
  if (v.includes('reactjs.org') || v.includes('1 element as children.')) {
    return;
  }
  callback(v);
};

console.error = (v) => checkOrLogging(v, ce);
console.log = (v) => checkOrLogging(v, cl);
console.warn = (v) => checkOrLogging(v, cw);

export async function build(isDevServer?: boolean) {
  const cwd = process.cwd();
  const runtimeRequire = createRequire(path.join(cwd, 'package.json'));
  const rootDir = `${cwd}/.dodai-build`;
  copySync(`${cwd}/src/static/`, `${cwd}/dist/static/`);
  try {
    const rootFiles = await glob(`${cwd}/dist/static/root/**.*`);
    await Promise.all(
      rootFiles.map((rootFile) =>
        copyFile(
          rootFile,
          `${cwd}/dist/${rootFile.split('/')[rootFile.split('/').length - 1]}`,
        ),
      ),
    );
  } catch (e) {
    console.log(e);
  }
  const p = await ts.createProgram(await glob(`${cwd}/src/**/*.tsx`), {
    target: 3,
    jsx: 2,
    module: 1,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir: './.dodai-build/',
  });
  await p.emit();
  const paths = await glob(`${rootDir}/pages/**/*.js`);
  await Promise.all(
    paths.map(async (pagePath) => {
      try {
        Object.entries(runtimeRequire.cache)
          .filter(([k]) => k.includes(cwd))
          .map(([k]) => {
            if (runtimeRequire.cache[runtimeRequire.resolve(k)]) {
              delete runtimeRequire.cache[runtimeRequire.resolve(k)];
            }
          });
        const { Layout } = runtimeRequire(`${rootDir}/layouts/default`);

        if (!pagePath.includes('[')) {
          const { Head, Page } = runtimeRequire(pagePath);
          const html =
            docType +
            renderToStaticMarkup(
              createElement(
                Layout,
                { head: Head ? createElement(Head, null) : null },
                createElement(Page, null),
              ),
            );
          const fileName = `${cwd}/dist/${pagePath
            .replace(`${rootDir}/pages/`, '')
            .replace('.js', '.html')}`;
          await fs.mkdir(path.dirname(fileName), { recursive: true });
          await fs.writeFile(fileName, html, { encoding: 'utf-8' });
          return html;
        }

        // `pages/detail/[area]/[slug]` 形式
        const userPath = pagePath.split('pages/')[1];
        const metaDataPath = `${rootDir}/data/${userPath}`;
        if (runtimeRequire.cache[runtimeRequire.resolve(metaDataPath)]) {
          delete runtimeRequire.cache[runtimeRequire.resolve(metaDataPath)];
        }

        const metaData: any[] = runtimeRequire(metaDataPath).data;
        await Promise.all(
          metaData.map(async (single) => {
            const { Head, Page } = runtimeRequire(pagePath);
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
      } catch (e) {
        consola.error(e);
      }
    }),
  ).catch((err) => {
    consola.error(err);
  });
}
