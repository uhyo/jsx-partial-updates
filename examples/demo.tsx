/**
 * Run with: pnpm example
 *
 * Demonstrates streaming a document to stdout where a slow async component
 * appears partway through — notice how the head/header are written
 * immediately, then a pause, then the rest.
 */

import { renderToStream } from "jsx-partial-updates";
import type { JSXNode } from "jsx-partial-updates";

function Layout({ children }: { children?: JSXNode }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>jsx-partial-updates demo</title>
      </head>
      <body>{children}</body>
    </html>
  );
}

async function User({ id }: { id: number }) {
  // Pretend this is a database / network call.
  await new Promise((r) => setTimeout(r, 500));
  return (
    <li>
      User #{id} (loaded at {new Date().toISOString()})
    </li>
  );
}

function Page() {
  return (
    <Layout>
      <header>
        <h1>Streaming JSX</h1>
        <p>The header is flushed before the user list resolves.</p>
      </header>
      <ul>
        <User id={1} />
        <User id={2} />
      </ul>
    </Layout>
  );
}

const stream = renderToStream(<Page />);

for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
  process.stdout.write(chunk);
}
process.stdout.write("\n");
