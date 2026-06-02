# jsx-partial-updates

A tiny JSX runtime that renders JSX into a **WHATWG `ReadableStream`**, with
first-class support for **synchronous and asynchronous function components**.

Because the tree is walked by an async generator, HTML is flushed as it is
produced: the top of the document reaches the client before a slow async
component further down has resolved.

## Features

- 🔌 Automatic JSX runtime (`jsx`/`jsxs`/`Fragment`) — no `React` import needed.
- 🌊 `renderToStream` returns a standard `ReadableStream<Uint8Array>`.
- ⏳ Function components may be `async` (or return a `Promise`); they're
  awaited inline.
- 🎭 `<Sasupensu>` — a React-Suspense-like boundary that streams a fallback
  first and patches in the real content out-of-order via
  [Declarative Partial Updates](https://developer.chrome.com/blog/declarative-partial-updates).
- 🔒 Text and attribute values are HTML-escaped by default.
- 🪶 No runtime dependencies.

## Install

```bash
pnpm add jsx-partial-updates
```

## Configure JSX

Point your toolchain's JSX import source at the package.

**tsconfig.json**

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "jsx-partial-updates"
  }
}
```

For esbuild / Vite / Vitest:

```ts
esbuild: { jsx: "automatic", jsxImportSource: "jsx-partial-updates" }
```

## Usage

```tsx
import { renderToStream, renderToString } from "jsx-partial-updates";

async function User({ id }: { id: number }) {
  const user = await fetchUser(id); // any Promise
  return <li>{user.name}</li>;
}

function Page() {
  return (
    <html lang="en">
      <head>
        <title>Hello</title>
      </head>
      <body>
        <h1>Users</h1>
        <ul>
          <User id={1} />
          <User id={2} />
        </ul>
      </body>
    </html>
  );
}

// Stream of UTF-8 bytes — pipe it into any Response / fetch handler.
const stream = renderToStream(<Page />);

// e.g. in a fetch-style server:
return new Response(stream, {
  headers: { "content-type": "text/html; charset=utf-8" },
});
```

Need the whole thing as a string instead?

```ts
const html = await renderToString(<Page />);
```

## Suspense with `<Sasupensu>`

Awaiting an async component _inline_ blocks the stream: everything after it
waits for it to resolve. `<Sasupensu>` (Japanese for _Suspense_) breaks that
dependency. It flushes a `fallback` straight away and renders its children
concurrently, then — once they resolve — streams the real content as a
`<template>` near the bottom of the document. A browser that supports
[Declarative Partial Updates](https://developer.chrome.com/blog/declarative-partial-updates)
swaps the fallback for the template **with no JavaScript**.

```tsx
import { renderToStream, Sasupensu } from "jsx-partial-updates";

async function Recommendations() {
  const items = await fetchRecommendations(); // slow
  return <ul>{items.map((i) => <li>{i.name}</li>)}</ul>;
}

function Page() {
  return (
    <main>
      <h1>Shop</h1>
      <Sasupensu fallback={<p>Loading recommendations…</p>}>
        <Recommendations />
      </Sasupensu>
      <footer>Streams immediately — it never waits for the list.</footer>
    </main>
  );
}
```

The stream comes out roughly like this — the shell and fallback arrive first,
the resolved content arrives last:

```html
<main>
  <h1>Shop</h1>
  <?start name="S:0"><p>Loading recommendations…</p><?end>
  <footer>Streams immediately — it never waits for the list.</footer>
</main>
<template for="S:0"><ul><li>…</li></ul></template>
```

A few details worth knowing:

- **Out-of-order, fastest-first.** With multiple boundaries, whichever resolves
  first has its template streamed first — even if it was declared later.
- **Nesting works.** A nested `<Sasupensu>` is always patched _after_ its
  parent, because its marker only exists once the parent's template is applied.
- **Each boundary gets a unique marker name** (`S:0`, `S:1`, …) shared by its
  range marker and its template, so updates target the right placeholder.
- Outside a streaming browser, the markers are inert and the fallback is what's
  shown. Calling `Sasupensu(props)` directly just returns the real children.

> [!NOTE]
> Declarative Partial Updates is an experimental platform feature (Chrome 148
> behind a flag, with official polyfills). See the
> [Chrome announcement](https://developer.chrome.com/blog/declarative-partial-updates)
> for browser support.

## API

| Export                       | Description                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| `renderToStream(node)`       | `ReadableStream<Uint8Array>` of UTF-8 HTML, flushed incrementally. |
| `renderToTextStream(node)`   | `ReadableStream<string>` of HTML fragments (no byte encoding).     |
| `renderToString(node)`       | `Promise<string>` — fully buffered HTML.                           |
| `renderNode(node)`           | The underlying `AsyncGenerator<string>`.                           |
| `Sasupensu`                  | Suspense-like boundary component (`fallback` + `children`).        |
| `jsx`, `jsxs`, `Fragment`    | The JSX factory functions (used by your compiler).                 |

### Supported props

- `className` → `class`, `htmlFor` → `for`.
- Boolean attributes: `disabled`, `checked`, … render bare when `true`, omitted
  when `false`/`null`/`undefined`.
- `style` accepts a string or an object (`{ backgroundColor: "red" }` →
  `background-color:red;`).
- `dangerouslySetInnerHTML={{ __html }}` injects raw, unescaped HTML.
- Function-valued props (event handlers) are dropped — this is server output.
- Void elements (`br`, `img`, `input`, …) render without a closing tag.

## Develop

```bash
pnpm install
pnpm test        # run the vitest suite
pnpm typecheck   # tsc --noEmit
pnpm build          # emit ESM + d.ts into dist/
pnpm example        # stream the demo document to stdout
pnpm example:server # serve the stream over HTTP at http://localhost:3000
```

> [!NOTE]
> The examples import the package from `dist/`, so run `pnpm build` once first.

`pnpm example:server` boots a tiny `node:http` server that streams a JSX page
rendered by `renderToStream`. The shell and every `<Sasupensu>` fallback flush
immediately; each slow card pops in on its own as its data resolves. Watch it
arrive from the terminal with `curl -N http://localhost:3000`. The page ships a
small client-side polyfill so the partial-update swaps are visible in any
browser — browsers with native Declarative Partial Updates need no script.

## License

MIT
