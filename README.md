<p align="center">
  <img width="80" src="https://i.gyazo.com/254eeef7553c4f0d7955822270195540.png" />
</p>

<h1 align="center"> @potato4d/dodai </h1>

Static Site Generator

## Installation

```bash
$ npm i -S @potato4d/dodai
$ dodai init
```

## Quick Start

```bash
$ dodai init
```

## Native ESM

As of 0.8.0, `@potato4d/dodai` is ESM-only. The library, CLI, and temporary
site modules used during builds all run as native ESM.

```ts
import { build, dev, init } from '@potato4d/dodai';
import { HotReload } from '@potato4d/dodai/hotreload';
```

Use these public package entry points instead of importing files from `dist`.

### Migrating from 0.7.x

- Replace CommonJS `require()` calls with ESM `import` statements.
- Set `"type": "module"` in the site project's `package.json`.
- Use `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` in
  `tsconfig.json`.
- Include the emitted `.js` extension in local TypeScript imports, for example
  `import { value } from './value.js'`.

`dodai init` applies these ESM settings for new projects.

## How to Use

### Layout

- src/layouts/default.tsx

```tsx
import * as React from 'react';

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
      </body>
    </html>
  )
}
```

### Page

#### Static Route Page

```tsx

import React from 'react'

export const Head: React.FC = () => {
  return (
    <>
      <title>static route page</title>
    </>
  )
}

export const Page: React.FC = () => {
  return (
    <div>
      static route page
    </div>
  )
}
```

#### Dynamic Route Page

```tsx
// src/pages/entry/[single].tsx
import React from 'react'

type EntryProps = {
  url: string;
  data: {
    title: string;
    date: string;
    body: string;
  }
}

export const Head: React.FC<EntryProps> = ({ url, data }) => {
  return (
    <>
      <title>{data.title}</title>
    </>
  )
}

export const Page: React.FC<EntryProps> = ({ url, data }) => {
  return (
    <div>
      <h2>{data.title}</h2>
      <time>{data.date}</time>
      <div dangerouslySetInnerHTML={{ __html: data.body }} />
    </div>
  )
}
```

### Data

#### Dynamic route data

```ts
// src/data/entry/[single].tsx

type Entry = {
  url: string;
  data: {
    title: string;
    date: string;
    body: string;
  }
}

export const data: Entry[] = [
  {
    url: '/entry/1',
    data: {
      title: 'first entry',
      date: new Date().toISOString(),
      body: '<p>hello</p>'
    }
  }
]
```

## Build

```bash
$ env NODE_ENV='production' dodai build
```

## Dev Server

```bash
$ dodai dev
```

## Components

### HotReload

- props: `{ dev?: boolean }`
  - dev: default `process.env.NODE_ENV !== 'production'`

```tsx
import * as React from 'react';
import { HotReload } from '@potato4d/dodai/hotreload';

type LayoutProps = { head: JSX.Element | null; children?: React.ReactNode };

export const Layout: React.FC<LayoutProps> = ({ head, children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {head}
        <HotReload />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
```

## Development

```bash
$ pnpm install --frozen-lockfile
$ pnpm test
```

The test command builds the native ESM package and runs its package, CLI, site
generation, dynamic route, and module-cache integration checks.

## Releasing

Releases are published from GitHub Actions with npm Trusted Publishing. See the
[release runbook](https://github.com/potato4d/dodai/blob/master/docs/releasing.md) for the automated gates and the one-time
npm configuration.

## License

[MIT](./LICENSE)
