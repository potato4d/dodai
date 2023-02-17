import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as _glob from 'glob';
import { promisify } from 'util';
const glob = promisify(_glob);
import * as ts from 'typescript';
import { copySync, copyFile } from 'fs-extra';
const consola = require('consola');

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
        Object.entries(require.cache)
          .filter(([k]) => k.includes(cwd))
          .map(([k]) => {
            if (require.cache[require.resolve(k)]) {
              delete require.cache[require.resolve(k)];
            }
          });
        const { Layout } = require(`${rootDir}/layouts/default`);

        if (!pagePath.includes('[')) {
          const { Head, Page } = require(pagePath);
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
        if (require.cache[require.resolve(metaDataPath)]) {
          delete require.cache[require.resolve(metaDataPath)];
        }

        const metaData: any[] = require(metaDataPath).data;
        await Promise.all(
          metaData.map(async (single) => {
            const { Head, Page } = require(pagePath);
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
