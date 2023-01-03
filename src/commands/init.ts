import * as fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util';
const execPromise = promisify(exec);

type Template = {
  path: string;
  body: string;
}

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
                fetch('http://localhost:10020')
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
}`
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
}`
  },
  {
    path: 'src/data/items/[item].tsx',
    body: `export const data = [{ url: '/items/1', data: { name: 'item 1' } }, { url: '/items/2', data: { name: 'item 2' } }]`
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
}`
  },
  {
    path: 'tsconfig.json',
    body: `{
  "compilerOptions": {
    "target": "es2016",
    "lib": [
      "ESNext",
      "DOM"
    ],
    "jsx": "react",
    "module": "commonjs",
    "types": [
      "@types/node"
    ],
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}`
  },
  {
    path: 'src/static/robots.txt',
    body: '',
  },
  {
    path: '.gitignore',
    body: `node_modules
dist
.dodai-build`
  }
]
export async function init() {
  const cwd = process.cwd()
  console.log('generate template files...')
  await Promise.all(templates.map(async (template) => {
    const dir = template.path.split('/').filter((_, i, all) => i !== all.length - 1).join('/')
    if (dir.includes('/')) {
      await fs.mkdir(dir, { recursive: true })
    }
    await fs.appendFile(`${cwd}/${template.path}`, template.body, { encoding: 'utf-8' })
  }))
  console.log('install packages...')
  await execPromise('npm i -D typescript ts-node @types/node react @types/react react-dom')
  console.log('initialize typescript project...')
}
