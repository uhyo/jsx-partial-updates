/**
 * Run with: pnpm example
 *
 * Demonstrates streaming a document to stdout where slow async components are
 * wrapped in <Sasupensu> boundaries. Notice how the head/header and each
 * fallback are written immediately, then — once the async work settles — the
 * real content arrives as <template for> elements near the bottom of the
 * document. A browser supporting Declarative Partial Updates swaps the
 * fallbacks for the templates with no JavaScript.
 *
 * https://developer.chrome.com/blog/declarative-partial-updates
 */

import { renderToStream, Sasupensu } from "jsx-partial-updates";
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

async function User({ id, ms }: { id: number; ms: number }) {
  // Pretend this is a database / network call of varying latency.
  await new Promise((r) => setTimeout(r, ms));
  return (
    <li>
      User #{id} (loaded after {ms}ms at {new Date().toISOString()})
    </li>
  );
}

function Spinner({ label }: { label: string }) {
  return <p class="spinner">⏳ {label}</p>;
}

function Page() {
  return (
    <Layout>
      <header>
        <h1>Streaming JSX with &lt;Sasupensu&gt;</h1>
        <p>The header and both fallbacks flush before the users resolve.</p>
      </header>

      {/* The slower boundary is declared first, but its template is streamed
          after the faster one's — out-of-order, fastest-first delivery. */}
      <Sasupensu fallback={<Spinner label="loading profile…" />}>
        <ul>
          <User id={1} ms={600} />
        </ul>
      </Sasupensu>

      <Sasupensu fallback={<Spinner label="loading recommendations…" />}>
        <ul>
          <User id={2} ms={200} />
        </ul>
      </Sasupensu>

      <footer>This footer streams immediately, before either user.</footer>
    </Layout>
  );
}

const stream = renderToStream(<Page />);

for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
  process.stdout.write(chunk);
}
process.stdout.write("\n");
