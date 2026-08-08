import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import consolaModule, { type Consola } from 'consola';

const execPromise = promisify(exec);
const consola = consolaModule as unknown as Consola;

type Template = {
  path: string;
  body: string;
};

const templates: Template[] = [
  {
    path: 'src/layouts/default.tsx',
    body: `import * as React from 'react';

type LayoutProps = { head: JSX.Element | null; children?: React.ReactNode };

export const Layout: React.FC<LayoutProps> = ({ head, children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {head}
      </head>
      <body>
        {children}
        {
          process.env.NODE_ENV !== 'production' ? (
            <script lang="text/javascript" dangerouslySetInnerHTML={{
              __html: \`
              async function subscribe() {
                fetch('http://localhost:\${process.env.DODAI_RELOAD_PORT ?? '10020'}')
                .then(() => {
                  location.reload();
                })
                .catch((e) => {
                  setTimeout(() => {
                    subscribe();
                  }, 1000);
                })
              }
              subscribe();
            \`.split('\\n').map((l) => l.replace(/  /g, '')).join('') }} />
          ) : null
        }
      </body>
    </html>
  )
}`,
  },
  {
    path: 'src/pages/index.tsx',
    body: `import React from 'react'

export const Head: React.FC = () => {
  return (
    <>
      <title>index page</title>
    </>
  )
}

export const Page: React.FC = () => {
  return (
    <div>
      index page
    </div>
  )
}`,
  },
  {
    path: 'src/data/items/[item].tsx',
    body: `export const data = [{ url: '/items/1', data: { name: 'item 1' } }, { url: '/items/2', data: { name: 'item 2' } }]`,
  },
  {
    path: 'src/pages/items/[item].tsx',
    body: `import React from 'react'

type Item = {
  url: string;
  data: {
    name: string;
  }
}

export const Head: React.FC<Item> = ({ url, data }) => {
  return (
    <>
      <title>{data.name} page</title>
    </>
  )
}

export const Page: React.FC<Item> = ({ url, data }) => {
  return (
    <div>
      <h2>{data.name} page</h2>
    </div>
  )
}`,
  },
  {
    path: 'tsconfig.json',
    body: `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": [
      "ESNext",
      "DOM"
    ],
    "jsx": "react",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": [
      "@types/node"
    ],
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}`,
  },
  {
    path: 'src/static/robots.txt',
    body: '',
  },
  {
    path: '.gitignore',
    body: `node_modules
dist
.dodai-build`,
  },
];
export async function init() {
  const cwd = process.cwd();
  consola.log('generate template files...');
  await Promise.all(
    templates.map(async (template) => {
      const dir = template.path
        .split('/')
        .filter((_, i, all) => i !== all.length - 1)
        .join('/');
      if (dir.includes('/')) {
        await fs.mkdir(dir, { recursive: true });
      }
      await fs.appendFile(`${cwd}/${template.path}`, template.body, {
        encoding: 'utf-8',
      });
    }),
  );
  consola.log('install packages...');
  await execPromise(
    'npm i -D typescript@^4.9.4 ts-node@^10.9.1 @types/node@^18 react@^18.2.0 @types/react@^18 react-dom@^18.2.0 @types/react-dom@^18',
  );
  const packageJsonPath = `${cwd}/package.json`;
  const packageJson = JSON.parse(
    await fs.readFile(packageJsonPath, { encoding: 'utf8' }),
  ) as Record<string, unknown>;
  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify({ ...packageJson, type: 'module' }, null, 2)}\n`,
    { encoding: 'utf8' },
  );
  consola.log('initialize typescript project...');
}
