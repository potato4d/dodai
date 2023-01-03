# @potato4d/dodai

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
      date: new Date(),
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
import { HotReload } from '@potato4d/dodai/dist/hotreload';

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

## LICENCE

MIT
