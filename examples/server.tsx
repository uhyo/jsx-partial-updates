/**
 * Run with: pnpm example:server  (then open http://localhost:3000)
 *
 * Spins up a tiny `node:http` server that streams a JSX document rendered by
 * `renderToStream`. The shell, the page chrome and every `<Sasupensu>` fallback
 * are flushed to the browser immediately; the slow async components resolve
 * independently and are streamed afterwards as `<template for>` elements, which
 * swap in over their fallbacks — out-of-order, fastest-first.
 *
 * Watch it stream from the terminal too:
 *
 *   curl -N http://localhost:3000
 *
 * The `-N` disables curl's buffering so you can see the shell and the spinners
 * arrive first, then each `<template>` trickle in as its data settles.
 *
 * https://developer.chrome.com/blog/declarative-partial-updates
 */

import { createServer } from "node:http";
import { renderToStream, Sasupensu } from "jsx-partial-updates";
import type { JSXNode } from "jsx-partial-updates";

const PORT = Number(process.env.PORT) || 3000;

/* -------------------------------------------------------------------------- */
/* Fake data sources — each "query" resolves after an artificial delay.       */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function Profile() {
  await sleep(800);
  return (
    <div class="card-body">
      <p class="name">Ada Lovelace</p>
      <p class="muted">Joined 1843 · 4 followers</p>
    </div>
  );
}

async function Stats() {
  await sleep(400);
  return (
    <ul class="stats">
      <li><strong>128</strong> commits</li>
      <li><strong>12</strong> open PRs</li>
      <li><strong>3</strong> reviews</li>
    </ul>
  );
}

async function Comments() {
  // Resolves *after* its parent <Feed> — demonstrates a nested boundary, which
  // can only be patched once its parent's template has been applied.
  await sleep(1200);
  return (
    <ul class="comments">
      <li>“Streaming makes this feel instant.”</li>
      <li>“No client JS required for the swap 🤯”</li>
    </ul>
  );
}

async function Feed() {
  await sleep(1500);
  return (
    <div class="card-body">
      <p>Latest activity loaded at {new Date().toLocaleTimeString()}.</p>
      <h3>Comments</h3>
      <Sasupensu fallback={<Spinner label="loading comments…" />}>
        <Comments />
      </Sasupensu>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <p class="spinner">
      <span class="dot" aria-hidden="true" /> {label}
    </p>
  );
}

function Card({ title, children }: { title: string; children?: JSXNode }) {
  return (
    <section class="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The page                                                                   */
/* -------------------------------------------------------------------------- */

function Page() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>jsx-partial-updates · streaming server demo</title>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        {/* Demo-only polyfill so the swaps are visible in any browser. */}
        <script dangerouslySetInnerHTML={{ __html: PARTIAL_UPDATES_POLYFILL }} />
      </head>
      <body>
        <header>
          <h1>Streaming JSX with &lt;Sasupensu&gt;</h1>
          <p class="muted">
            This whole page is one streamed HTTP response. The header and the
            three spinners arrived first; each card pops in on its own as its
            data resolves — fastest first.
          </p>
        </header>

        <main class="grid">
          {/* Declared first, but the slowest — its template streams last. */}
          <Card title="Activity feed">
            <Sasupensu fallback={<Spinner label="loading feed…" />}>
              <Feed />
            </Sasupensu>
          </Card>

          <Card title="Profile">
            <Sasupensu fallback={<Spinner label="loading profile…" />}>
              <Profile />
            </Sasupensu>
          </Card>

          <Card title="Stats">
            <Sasupensu fallback={<Spinner label="loading stats…" />}>
              <Stats />
            </Sasupensu>
          </Card>
        </main>

        <footer class="muted">
          Rendered by jsx-partial-updates · the footer streamed before any card
          finished loading.
        </footer>
      </body>
    </html>
  );
}

/* -------------------------------------------------------------------------- */
/* HTTP server                                                                */
/* -------------------------------------------------------------------------- */

const server = createServer(async (req, res) => {
  // Ignore the browser's incidental requests so the logs stay readable.
  if (req.url !== "/" && req.url !== "") {
    res.writeHead(req.url === "/favicon.ico" ? 204 : 404).end();
    return;
  }

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    // Hint to proxies not to buffer; lets the stream reach the client live.
    "cache-control": "no-store",
    "x-accel-buffering": "no",
  });

  const stream = renderToStream(<Page />);
  try {
    // Iterate the WHATWG stream and write each chunk as it is produced, so the
    // shell and fallbacks are flushed long before the slow cards resolve.
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      res.write(chunk);
    }
  } catch (error) {
    console.error("render error:", error);
  } finally {
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`\n  jsx-partial-updates demo server\n`);
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  streaming view:  curl -N http://localhost:${PORT}\n`);
});

/* -------------------------------------------------------------------------- */
/* Assets (kept inline so the example is a single self-contained file).       */
/* -------------------------------------------------------------------------- */

const STYLES = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem;
    font: 16px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    max-width: 60rem; margin-inline: auto;
  }
  header h1 { margin-bottom: .25rem; }
  .muted { color: color-mix(in srgb, currentColor 55%, transparent); }
  .grid {
    display: grid; gap: 1rem; margin: 1.5rem 0;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  }
  .card {
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: .75rem; padding: 1rem 1.25rem;
  }
  .card h2 { margin-top: 0; font-size: 1.05rem; }
  .card-body .name { font-weight: 600; margin: 0; }
  .stats, .comments { margin: .5rem 0 0; padding-left: 1.1rem; }
  .spinner { display: flex; align-items: center; gap: .5rem; }
  .dot {
    width: .8rem; height: .8rem; border-radius: 50%;
    border: 2px solid currentColor; border-top-color: transparent;
    display: inline-block; animation: spin .7s linear infinite; opacity: .6;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  footer { margin-top: 2rem; font-size: .9rem; }
`;

/**
 * A minimal client-side polyfill for Declarative Partial Updates, included only
 * so this demo "just works" in any browser. Browsers that support the feature
 * natively (Chrome 148+ behind a flag) apply the templates with no JavaScript
 * and consume the markers, in which case this polyfill finds nothing to do.
 *
 * Our renderer emits range markers as processing instructions, which the HTML
 * parser turns into comment nodes:
 *   <?start name="S:0">  ->  comment, data: `?start name="S:0"`
 *   <?end>               ->  comment, data: `?end`
 * followed later by  <template for="S:0">…</template>.
 */
const PARTIAL_UPDATES_POLYFILL = `
(function () {
  var START = /^\\??\\s*start\\s+name="([^"]*)"/;
  var END = /^\\??\\s*end\\b/;

  // Find the <?start name="X">…<?end> comment pair for a given name, honouring
  // nesting via a stack so a nested boundary matches its own end marker.
  function findRange(name) {
    var walker = document.createTreeWalker(
      document.documentElement, NodeFilter.SHOW_COMMENT);
    var stack = [], node;
    while ((node = walker.nextNode())) {
      var m = START.exec(node.data);
      if (m) { stack.push({ name: m[1], start: node }); continue; }
      if (END.test(node.data)) {
        var open = stack.pop();
        if (open && open.name === name) return { start: open.start, end: node };
      }
    }
    return null;
  }

  function applyTemplate(tpl) {
    var name = tpl.getAttribute("for");
    if (!name) return;
    var range = findRange(name);
    if (!range) return; // already applied (or handled natively) — no-op.
    // Drop the fallback nodes between the markers…
    var n = range.start.nextSibling;
    while (n && n !== range.end) { var next = n.nextSibling; n.remove(); n = next; }
    // …and insert the resolved content in their place.
    range.end.parentNode.insertBefore(tpl.content.cloneNode(true), range.end);
    range.start.remove();
    range.end.remove();
    tpl.remove();
  }

  function scan(root) {
    if (root.querySelectorAll)
      root.querySelectorAll("template[for]").forEach(applyTemplate);
  }

  // Patch each boundary the moment its <template> streams in.
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      r.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches("template[for]"))
          queueMicrotask(function () { applyTemplate(node); });
        else scan(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Final sweep for anything already in place (idempotent).
  document.addEventListener("DOMContentLoaded", function () { scan(document); });
})();
`;
