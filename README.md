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

## API

| Export                       | Description                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| `renderToStream(node)`       | `ReadableStream<Uint8Array>` of UTF-8 HTML, flushed incrementally. |
| `renderToTextStream(node)`   | `ReadableStream<string>` of HTML fragments (no byte encoding).     |
| `renderToString(node)`       | `Promise<string>` — fully buffered HTML.                           |
| `renderNode(node)`           | The underlying `AsyncGenerator<string>`.                           |
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
pnpm build       # emit ESM + d.ts into dist/
pnpm example     # stream the demo document to stdout
```

## License

MIT
