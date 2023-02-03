import * as React from 'react';
import * as Renderer from 'react-dom/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as _glob from 'glob';
import { promisify } from 'util';
const glob = promisify(_glob);
import * as ts from 'typescript';
import * as fsx from 'fs-extra';
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
}

console.error = (v) => checkOrLogging(v, ce);
console.log = (v) => checkOrLogging(v, cl);
console.warn = (v) => checkOrLogging(v, cw);

export async function build(isDevServer?: boolean) {
  const cwd = process.cwd();
  const rootDir = `${cwd}/.dodai-build`;
  fsx.copySync(`${cwd}/src/static/`, `${cwd}/dist/static/`);
  try{
    const rootFiles = await glob(`${cwd}/dist/static/root/**.*`)
    await Promise.all(
      rootFiles.map(async (rootFile) => {
        await fsx.copyFile(rootFile, `${cwd}/dist/${rootFile.split('/')[rootFile.split('/').length-1]}`)
      })
    )
  } catch(e) {
    console.log(e)
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
  const pathes = await glob(`${rootDir}/pages/**/*.js`);
  await Promise.all(
    pathes.map(async (pagePath) => {
      try {
        Object.entries(require.cache)
          .filter(([k]) => {
            return k.includes(cwd);
          })
          .map(([k]) => {
            if (require.cache[require.resolve(k)]) {
              delete require.cache[require.resolve(k)];
            }
          });
        const Layout = require(`${rootDir}/layouts/default`).Layout;

        if (!pagePath.includes('[')) {
          const { Head, Page } = require(pagePath);
          const html =
            docType +
            Renderer.renderToString(
              React.createElement(
                Layout,
                { head: Head ? React.createElement(Head, null) : null },
                React.createElement(Page, null),
              ),
            );
          await fs.mkdir(
            path.dirname(
              `${cwd}/dist/${pagePath
                .replace(`${rootDir}/pages/`, '')
                .replace('.js', '.html')}`,
            ),
            { recursive: true },
          );
          await fs.writeFile(
            `${cwd}/dist/${pagePath
              .replace(`${rootDir}/pages/`, '')
              .replace('.js', '.html')}`,
            html,
            { encoding: 'utf-8' },
          );
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
            const head = Head ? React.createElement(Head, {
                url: single.url,
                data: single.data,
              })
            : null;
            const page = React.createElement(Page, {
              url: single.url,
              data: single.data,
            })

            const html =
              docType +
              Renderer.renderToStaticMarkup(
                React.createElement(Layout, { head }, page,)
              );
            await fs.mkdir(
              path.dirname(`${cwd}/dist${single.url}/index.html`),
              {
                recursive: true,
              },
            );
            await fs.writeFile(`${cwd}/dist${single.url}/index.html`, html, {
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
