import * as React from 'react';
import * as Renderer from 'react-dom/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as _glob from 'glob';
import { promisify } from 'util';
const glob = promisify(_glob);
import * as ts from 'typescript'

const htmlHeader = `<!DOCTYPE html>\n`

export async function build() {
  const cwd = process.cwd()
  const rootDir = `${cwd}/.dodai-build`;
  // await fs.copyFile(`${cwd}/styles/common.css`, `${cwd}/dist/common.css`);
  console.log(
    `${cwd}/src/**/*.tsx`,
    await glob(`${cwd}/src/**/*.tsx`)
  )
  const p = await ts.createProgram(await glob(`${cwd}/src/**/*.tsx`), {
    "target": 3,
    "jsx": 2,
    "module": 1,
    "esModuleInterop": true,
    "skipLibCheck": true,
    outDir: './.dodai-build/'
  })
  await p.emit();
  const pathes = await glob(`${rootDir}/pages/**/*.js`);
  await Promise.all(
    pathes.map(async (pagePath) => {
      if (require.cache[require.resolve(pagePath)]) {
        delete require.cache[require.resolve(pagePath)];
        console.debug(`clear cache: ${require.resolve(pagePath)}`);
      }
      const Layout = require(`${rootDir}/layouts/default`).Layout

      if (!pagePath.includes('[')) {
        const { Head, Page } = require(pagePath);
        const html = htmlHeader + Renderer.renderToString(
          React.createElement(Layout, { head: Head ? (React.createElement(Head, null)) : null }, React.createElement(Page, null))
        );
        await fs.mkdir(
          path.dirname(
            `${cwd}/dist/${pagePath.replace(`${rootDir}/pages/`, '').replace(
              '.js',
              '.html',
            )}`,
          ),
          { recursive: true },
        );
        await fs.writeFile(
          `${cwd}/dist/${pagePath.replace(`${rootDir}/pages/`, '').replace(
            '.js',
            '.html',
          )}`,
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
        console.debug(`clear cache: ${require.resolve(metaDataPath)}`);
      }
      const metaData: any[] = require(metaDataPath).data;
      await Promise.all(
        metaData.map(async (single) => {
          const { Head, Page } = require(pagePath);
          const html = htmlHeader + Renderer.renderToStaticMarkup(
            React.createElement(Layout, { head: Head ? (React.createElement(Head, { url: single.url, data: single.data })) : null }, React.createElement(Page, { url: single.url, data: single.data }))
          );
          await fs.mkdir(
            path.dirname(`${cwd}/dist${single.url}/index.html`),
            { recursive: true },
          );
          await fs.writeFile(
            `${cwd}/dist${single.url}/index.html`,
            html,
            { encoding: 'utf-8' },
          );
          return;
        }),
      );
    }),
  );

}
