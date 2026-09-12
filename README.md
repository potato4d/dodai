<p align="center">
  <img width="80" src="https://i.gyazo.com/254eeef7553c4f0d7955822270195540.png" alt="dodai logo" />
</p>

<h1 align="center">@potato4d/dodai</h1>

**A small static site generator that turns React and TypeScript into HTML.**

dodai uses TSX components as build-time templates. Write a shared document layout,
add pages under `src/pages`, and export arrays of data to generate multiple pages
from one template. The result is a `dist/` directory of HTML and static files that
you can publish to a static web host.

- **React templates:** compose layouts, page content, and document metadata with TSX.
- **File-based pages:** turn page files into HTML at predictable paths.
- **Data-driven generation:** render one page per record using explicit output URLs.
- **Static assets:** copy CSS, images, and browser scripts alongside generated HTML.
- **Local development:** preview the site with rebuilds and full-page reloads.
- **Native ESM:** use ESM imports throughout the library, CLI, and site modules.
- **Static output:** no dodai or Node.js process is needed to serve the built site.

dodai renders with React's `renderToStaticMarkup`. It does not create a browser
JavaScript bundle or hydrate React components. Add browser scripts explicitly when
a page needs interaction.

## Contents

- [Quick start](#quick-start)
- [Native ESM and migration](#native-esm-and-migration)
- [Project structure](#project-structure)
- [Layouts and document metadata](#layouts-and-document-metadata)
- [Static pages and routes](#static-pages-and-routes)
- [Data-driven pages](#data-driven-pages)
- [Styles, scripts, and static files](#styles-scripts-and-static-files)
- [Development and automatic reload](#development-and-automatic-reload)
- [Production builds and deployment](#production-builds-and-deployment)
- [Command reference](#command-reference)
- [Programmatic API](#programmatic-api)
- [How the build works](#how-the-build-works)
- [Troubleshooting](#troubleshooting)
- [Developing dodai](#developing-dodai)
- [Releasing](#releasing)
- [License](#license)

## Quick start

You need Node.js and npm. The repository does not declare a supported Node.js
version range. The following setup was verified with Node.js **24.14.1** and npm
**11.11.0**, using the repository's React 18 and TypeScript 4.9 dependency baseline.

Run these commands in a **new project directory**:

```sh
mkdir my-dodai-site
cd my-dodai-site
npm init -y
npm install --save-dev @potato4d/dodai@0.8.0
npx dodai init
npx dodai dev
```

`dodai init` creates the starter, installs compatible React and TypeScript
dependencies with npm, and sets `"type": "module"` in your site's `package.json`.
Keep the generated lockfile in version control. npm is used here because the
initializer invokes it directly; development of dodai itself uses pnpm.

Open the preview URL printed in the terminal, usually
`http://localhost:3000`. The starter includes a home page and two generated item
pages at `/items/1/` and `/items/2/`.

**Run `dodai init` only once per new project.** It appends template contents to
existing files, including `tsconfig.json` and `.gitignore`; it does not merge or
replace them safely. Initialization also invokes npm to install dependencies.

For convenient commands, add these entries to your site's `package.json` scripts:

```json
{
  "scripts": {
    "dev": "dodai dev",
    "typecheck": "tsc --noEmit",
    "build": "dodai build"
  }
}
```

Then use `npm run dev`, `npm run typecheck`, and
`NODE_ENV=production npm run build`. See [production builds](#production-builds-and-deployment)
for the clean build procedure and PowerShell syntax.

## Native ESM and migration

As of **0.8.0**, dodai is ESM-only. The published library, CLI, and temporary site
modules all run as native ESM. The public package entry points are:

```ts
import { build, dev, init } from '@potato4d/dodai';
import { HotReload } from '@potato4d/dodai/hotreload';
```

Use these exports instead of importing private files from `dist/`. The package
does not provide a CommonJS `require` entry point.

For an existing site migrating from 0.7.x or earlier:

1. Set `"type": "module"` in the site's `package.json`.
2. Use `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` in
   `tsconfig.json`. The starter also uses `"target": "ES2022"` and `"jsx": "react"`.
3. Replace CommonJS `require()` and `module.exports` with ESM imports and exports.
4. Include the emitted `.js` extension in relative TypeScript imports, such as
   `import { Card } from './components/Card.js'` for `Card.tsx`.
5. Replace old `@potato4d/dodai/dist/hotreload` imports with
   `@potato4d/dodai/hotreload`.
6. Remove old build output and run a production build to verify the migration.

Apply these changes directly to existing files; rerunning `init` appends templates
and is not a migration command. New projects receive the ESM settings from `init`.

## Project structure

The initializer creates the source files below; npm creates the package files:

```text
my-dodai-site/
├── src/
│   ├── layouts/
│   │   └── default.tsx       # Shared HTML document; exports Layout
│   ├── pages/
│   │   ├── index.tsx         # Home page; exports Page and optionally Head
│   │   └── items/
│   │       └── [item].tsx    # Template for the item pages
│   ├── data/
│   │   └── items/
│   │       └── [item].tsx    # Matching template data; exports data
│   └── static/
│       └── robots.txt       # Copied to /static/robots.txt
├── .gitignore
├── package.json
├── package-lock.json
└── tsconfig.json
```

Builds also create `.dodai-build/build-*/` for temporary JavaScript and `dist/` for
the publishable site. Each build removes its temporary directory on completion;
the `.dodai-build/` parent may remain. The generated `.gitignore` excludes both
output directories and `node_modules/`.

All commands resolve paths from the current working directory. Run them from your
site's project root. Source paths, the layout filename, and output directories are
fixed; there is no dodai configuration file or CLI flag to change them.

## Layouts and document metadata

Every page uses the named `Layout` export from `src/layouts/default.tsx`. The layout
owns the entire HTML document and receives two props:

| Prop | Value |
| --- | --- |
| `head` | The page's rendered `Head` component, or `null` when it has no `Head` export. |
| `children` | The page's rendered `Page` component. |

For example, replace `src/layouts/default.tsx` with:

```tsx
import * as React from 'react';
import { HotReload } from '@potato4d/dodai/hotreload';

type LayoutProps = {
  head: JSX.Element | null;
  children?: React.ReactNode;
};

export const Layout: React.FC<LayoutProps> = ({ head, children }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      {head}
      <HotReload />
    </head>
    <body>
      <header>
        <a href="/">My site</a>
      </header>
      <main>{children}</main>
    </body>
  </html>
);
```

Keep shared metadata in the layout and page-specific titles or descriptions in
each page's `Head`. dodai prepends `<!DOCTYPE html>` to the rendered document.
The layout does not receive the dynamic page's `url` or `data` props directly.

The generated starter already contains an inline reload script. When adopting
`<HotReload />`, replace that script so that there is only one reload subscriber.

## Static pages and routes

A page must export a named `Page` component. A named `Head` component is optional;
default exports are not used. Static pages receive no props from dodai.

For example, create `src/pages/about.tsx`:

```tsx
import * as React from 'react';

export const Head: React.FC = () => (
  <>
    <title>About | My site</title>
    <meta name="description" content="A small site built with dodai." />
  </>
);

export const Page: React.FC = () => (
  <article>
    <h1>About this site</h1>
    <p>This page is rendered to HTML at build time.</p>
  </article>
);
```

Static output preserves the path beneath `src/pages` and changes the extension to
`.html`:

| Source file | Generated file | Preview URL |
| --- | --- | --- |
| `src/pages/index.tsx` | `dist/index.html` | `/` |
| `src/pages/about.tsx` | `dist/about.html` | `/about.html` |
| `src/pages/guide/index.tsx` | `dist/guide/index.html` | `/guide/` |
| `src/pages/guide/install.tsx` | `dist/guide/install.html` | `/guide/install.html` |

Use `about/index.tsx` if you want `/about/`. dodai's preview server does not rewrite
`/about` to `about.html`; configure any additional URL rewrites on your host.

Shared components can live outside `src/pages`, for example in `src/components`.
Files under `src/pages` are treated as page modules, so keep helper components
elsewhere and import them from your pages or layout.

## Data-driven pages

A page path containing `[` is treated as a dynamic template. dodai loads a data
module at the same relative path under `src/data` and renders one page for each
entry in its named `data` export.

For example, these files form a pair:

```text
src/pages/entry/[single].tsx
src/data/entry/[single].tsx
```

Create the data module at `src/data/entry/[single].tsx`:

```tsx
export type EntryProps = {
  url: string;
  data: {
    title: string;
    date: string;
    body: string;
  };
};

export const data: EntryProps[] = [
  {
    url: '/entry/hello',
    data: {
      title: 'Hello, dodai',
      date: '2026-09-12',
      body: 'This entry was generated from a data record.',
    },
  },
  {
    url: '/entry/next',
    data: {
      title: 'The next entry',
      date: '2026-09-13',
      body: 'One template can generate many pages.',
    },
  },
];
```

Then create the page at `src/pages/entry/[single].tsx`:

```tsx
import * as React from 'react';
import type { EntryProps } from '../../data/entry/[single].js';

export const Head: React.FC<EntryProps> = ({ data }) => (
  <title>{data.title} | My site</title>
);

export const Page: React.FC<EntryProps> = ({ url, data }) => (
  <article>
    <h1>{data.title}</h1>
    <time dateTime={data.date}>{data.date}</time>
    <p>{data.body}</p>
    <a href={url}>Permalink</a>
  </article>
);
```

This generates `dist/entry/hello/index.html` and `dist/entry/next/index.html`.
Both `Head` and `Page` receive `{ url, data }` for the current record.

### Data and URL rules

- Export an array named `data`. An empty array generates no pages. Export the
  resolved array itself, rather than a Promise or a loader function.
- Data modules may use `.ts` or `.tsx`; the build discovers both extensions.
- Match the template's relative path and basename. Nested templates such as
  `pages/docs/[section]/[slug].tsx` use `data/docs/[section]/[slug].tsx`.
- Set `url` to a site path beginning with `/`, such as `/docs/start`. The output is
  `dist${url}/index.html`; use a directory path without an `.html` extension.
- Bracket names identify templates. dodai does not extract route parameters or
  substitute `[single]` into a URL; the record's `url` specifies the full path.
- Keep output URLs unique across all templates and static pages. dodai does not
  detect output collisions. Use site-local paths without `..`, query strings, or
  fragments because URLs are used directly as filesystem paths.

For content from a CMS, API, or database, prepare a local data file before running
dodai, or use top-level `await` in an ESM data module and export the resulting
array. Module loading is asynchronous; rendering still happens at build time.
There is no framework-specific data-loader API, Markdown processor, or
request-time data fetching. React escapes string content by default; use
`dangerouslySetInnerHTML` only with HTML you trust or have sanitized.

When reading local content, resolve paths from `process.cwd()` to refer to your
site project. `import.meta.url` inside a compiled module points into the temporary
build directory, where source content files are not automatically copied.

## Styles, scripts, and static files

Everything in `src/static/` is copied to `dist/static/`. Keep this directory
present, even for a site without assets: the build expects it to exist.

| Source file | Generated file | Reference in HTML |
| --- | --- | --- |
| `src/static/site.css` | `dist/static/site.css` | `/static/site.css` |
| `src/static/images/logo.svg` | `dist/static/images/logo.svg` | `/static/images/logo.svg` |
| `src/static/site.js` | `dist/static/site.js` | `/static/site.js` |

Reference files directly from your TSX:

```tsx
// In the layout's <head>:
<link rel="stylesheet" href="/static/site.css" />

// In a page:
<img src="/static/images/logo.svg" alt="My site" />

// In the layout's <body>:
<script src="/static/site.js" defer />
```

Assets are copied as supplied. There is no CSS pipeline, image optimization,
asset hashing, or browser bundler. Compile Sass or browser TypeScript separately
and place their output in `src/static/`. React event handlers such as `onClick`
do not become interactive in the generated HTML; attach browser behavior from
your own script.

### Files at the site root

Put files such as `robots.txt`, `favicon.ico`, or `sitemap.xml` in
`src/static/root/` to copy them to the root of `dist/` as well:

```text
src/static/root/robots.txt  → dist/robots.txt
                           → dist/static/root/robots.txt
```

This extra copy applies to non-hidden files directly inside `root/` whose names
contain a dot. It is not a recursive directory copy to the site root.

The starter's `src/static/robots.txt` is served at `/static/robots.txt`. Move it to
`src/static/root/robots.txt` when you need the conventional `/robots.txt` URL.

## Development and automatic reload

Start the development server from the site root:

```sh
npx dodai dev
```

It builds the site, serves `dist/`, and watches `src/` for changes. The preview
prefers port `3000`; set `PORT` to request another port:

```sh
PORT=4000 npx dodai dev
```

The port finder may select a different available port, so use the printed preview
URL. The preview binds to `0.0.0.0`.

Automatic reload uses a separate HTTP long-poll server, defaulting to **port
`10020`**. The starter layout or `HotReload` component subscribes to it and reloads the whole
page after a rebuild. This is a full browser refresh, so local page state resets.

| `HotReload` prop | Behavior |
| --- | --- |
| Omitted | Include the script when `NODE_ENV !== 'production'`. |
| `dev={true}` | Always include the reload script. |
| `dev={false}` | Never include the reload script. |

The import path is `@potato4d/dodai/hotreload`. Use it once in your layout.

Set `DODAI_RELOAD_PORT` to change the polling port for both the server and the
generated reload script:

```sh
PORT=4000 DODAI_RELOAD_PORT=10021 npx dodai dev
```

Use distinct, available preview and polling ports for each dev server. Set these
variables before starting the process, including when using the programmatic API.

Current development constraints:

- Changes, additions, and removals under `src/` trigger queued rebuilds. Each build
  uses a fresh temporary module directory so imported source modules are reloaded.
- If a rebuild fails, the error is logged and the watcher continues. A successful
  rebuild is required before browsers receive a reload notification.
- Builds do not remove old files from `dist/`. After deleting or renaming pages,
  stop the server, remove `dist/`, and restart to discard their old output.
- Changes outside `src/`, such as dependency or configuration changes, require a
  restart.
- The polling port must be free; it does not automatically fall back to another
  port. Changing `PORT` alone does not change the polling port.
- The reload script uses `http://localhost:<polling-port>`. Reloading from another
  device or an HTTPS preview needs a custom setup; the supplied script targets
  local HTTP development.

## Production builds and deployment

Build with `NODE_ENV=production` so that the starter layout and the default
`HotReload` behavior omit the development script. `dodai build` does not set this
environment variable for you.

From your **site project root**, run a clean build on macOS or Linux:

```sh
rm -rf .dodai-build dist
npx tsc --noEmit
NODE_ENV=production npx dodai build
```

Run these commands in order and resolve type errors before building. On
PowerShell, the equivalent is:

```powershell
Remove-Item -Recurse -Force .dodai-build, dist -ErrorAction SilentlyContinue
npx tsc --noEmit
$env:NODE_ENV = 'production'
npx dodai build
```

To return to development in the same PowerShell session, clear the variable with
`Remove-Item Env:NODE_ENV`.

Publish **the contents of `dist/`** to your static host. Neither `.dodai-build/`,
the source files, nor Node.js dependencies are needed on the serving host.

For CI, install the committed dependency lockfile with `npm ci --include=dev`
before type checking and building. The starter's build tools are development
dependencies, so they must be available during the build even when the output is
for production.

Compilation, module-loading, and page-rendering failures cause the CLI build to
exit with an error. Check the build log and expected HTML files before uploading;
a failed build can leave copied assets or partial HTML in `dist/`. A clean build
also prevents removed pages and assets from lingering in the deployed site.

Configure your host to serve `index.html` for directory URLs. Root-relative URLs
in these examples assume deployment at the domain root; adjust links and assets
yourself for a subdirectory deployment because dodai has no base-path setting.

## Command reference

Use `npx dodai <command>` with a local installation, or `dodai <command>` inside an
npm script.

| Command | Purpose |
| --- | --- |
| `dodai init` | Append starter files and install template dependencies with npm. |
| `dodai dev` | Build, serve `dist/`, watch `src/`, and start the reload server. |
| `dodai build` | Copy assets, compile TSX, and render HTML into `dist/`. |
| `dodai --help` | Show the available commands. |
| `dodai --version` | Show the installed package version. |

| Environment variable | Effect |
| --- | --- |
| `PORT` | Preferred preview port for `dev`; defaults to `3000`. |
| `DODAI_RELOAD_PORT` | Polling server and reload-script port; defaults to `10020`. |
| `NODE_ENV` | Controls the starter and `HotReload` development script; set to `production` for deployment. |

## Programmatic API

The package root exports the same asynchronous operations as the CLI. For example,
save this as `build-site.mjs` in your site project root:

```js
import { build } from '@potato4d/dodai';

await build();
```

Run it with `NODE_ENV=production node build-site.mjs`.

| Export | Behavior |
| --- | --- |
| `await build()` | Compile and render the site in the current working directory. Rejects on compilation or rendering failures. |
| `await init()` | Generate starter files, install dependencies, and configure the site for ESM. |
| `await dev()` | Perform the initial build and start the preview server, polling server, and watcher. |

These functions use `process.cwd()` and the same environment variables as the CLI.
`dev()` leaves servers and a watcher running; it does not return a shutdown handle.
For ordinary site development, use the CLI and stop it with Ctrl+C.

## How the build works

1. Require `"type": "module"` in the site's `package.json` and create an isolated
   temporary directory under `.dodai-build/`.
2. Copy `src/static/` to `dist/static/`, then copy matching `static/root` files to
   the output root.
3. Discover `src/**/*.{ts,tsx}`, compile with ES2022 and NodeNext settings, and
   reject TypeScript compilation errors.
4. Load the shared layout and compiled pages with native dynamic `import()`. For
   dynamic templates, load the matching data array too.
5. Render `Head` and `Page` inside `Layout` with `renderToStaticMarkup`, prepend the
   doctype, and write the HTML files.
6. Remove that build's temporary directory, including when the build fails.

The build invokes TypeScript with fixed compiler options; it does **not** read
your `tsconfig.json`. That file remains useful for editor tooling and a separate
`tsc --noEmit` check, but changing its output paths or JSX settings does not
configure dodai. Path aliases and other custom compiler behavior are not wired
into the build.

The separate `tsc --noEmit` command applies your site's own settings, including
the starter's `strict` checks. Keep it as an additional check before deployment.
dodai does not clean `dist/` or provide a production server; output cleanup and
hosting remain explicit steps around the HTML generator.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| The build requires `"type": "module"` | Set it in the site's `package.json`, and follow the ESM migration steps for an existing site. |
| A relative import cannot be resolved | Include the emitted `.js` extension in local imports, including imports written in `.ts` or `.tsx` files. |
| Importing `dist/hotreload` fails | Use the public `@potato4d/dodai/hotreload` export. |
| React or JSX type errors after changing dependencies | The starter targets React 18, `@types/react` 18, and TypeScript 4.9; keep these versions compatible. |
| Initialization leaves invalid TSX or JSON | `init` appends to existing files. Start in a fresh directory or manually repair the appended contents. |
| The build cannot copy static files | Make sure `src/static/` exists and run the command from the site root. |
| A page is missing or fails to render | Confirm the named `Page` export, the named `Layout` export in `src/layouts/default.tsx`, and the build log. |
| A dynamic page has no output | Check the matching `.ts` or `.tsx` data path, the named `data` array, and each record's `url`. |
| `/about` returns 404 | `pages/about.tsx` produces `/about.html`. Use `pages/about/index.tsx` for `/about/`. |
| The browser does not update after an edit | Check the terminal for a failed rebuild and confirm that the layout includes one reload script. |
| Removed pages still appear | Stop the server and remove `dist/` before rebuilding. |
| Reload fails or port `10020` is busy | Choose a free `DODAI_RELOAD_PORT` before starting the server, and confirm that the layout uses the same port. |
| A deployed page requests `localhost:10020` | Rebuild with `NODE_ENV=production` and remove any forced `dev={true}` setting. |
| `onClick` does nothing | React templates render to static HTML. Add the interaction through an explicit browser script. |

## Developing dodai

To work on the generator itself, use Node.js and **pnpm 11.10.0**, the version
declared in `package.json`. Clone the repository and install its locked
dependencies:

```sh
git clone https://github.com/potato4d/dodai.git
cd dodai
pnpm install --frozen-lockfile
pnpm test
```

`pnpm test` builds the package and runs its Node.js integration tests. Coverage
includes the packed package's ESM exports and type declarations, CLI version and
failure handling, starter configuration, static and dynamic output, ESM-only
dependencies, and module refresh during repeated builds and development.

Use `pnpm build` to compile the package on its own, or `pnpm test:integration` to
run the tests against an already built package. The package build clears its own
`dist/`, emits JavaScript and declarations, and marks `dist/cli.js` executable.
A site's `dodai build` instead produces HTML in the site's `dist/`.

| File | Responsibility |
| --- | --- |
| [`src/index.ts`](src/index.ts) | Public ESM library exports. |
| [`src/cli.ts`](src/cli.ts) | CLI command registration and package-version reporting. |
| [`src/commands/init.ts`](src/commands/init.ts) | Starter templates and dependency installation. |
| [`src/commands/build.ts`](src/commands/build.ts) | Asset copying, TSX compilation, and HTML generation. |
| [`src/commands/dev.ts`](src/commands/dev.ts) | Preview server, source watcher, and reload notifications. |
| [`src/hotreload.tsx`](src/hotreload.tsx) | Optional development reload component. |
| [`tests/native-esm.test.mjs`](tests/native-esm.test.mjs) | Package, CLI, build, and dev-server integration tests. |

When changing user-facing behavior, also smoke-test a separate starter site:
check a static nested route, a data-driven route, copied assets, and production
output without the reload script.

Report reproducible bugs and propose changes through
[GitHub Issues](https://github.com/potato4d/dodai/issues) and pull requests. Include
the package and Node.js versions, the command you ran, and a minimal example of
the relevant layout, page, or data file.

## Releasing

Releases are published by the [Publish to npm workflow](.github/workflows/publish.yml)
using npm Trusted Publishing and GitHub Actions OIDC. A push to `master` alone does
not publish the package.

The workflow runs for a published, non-prerelease GitHub Release. It installs
locked dependencies, verifies that the tag is `v<package.json version>`, runs
`pnpm test`, and publishes the package. The
[release runbook](docs/releasing.md) documents the one-time npm configuration and
the release steps; no `NPM_TOKEN` GitHub secret is needed for this workflow.

## License

[MIT](LICENSE).
