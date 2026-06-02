/**
 * Streaming renderer.
 *
 * The tree is walked by an async generator that yields HTML fragments as soon
 * as they are produced. Because the walk is `async`, sync *and* async function
 * components are handled by the same code path: `await` on a non-promise value
 * simply returns it. This means earlier parts of the document can be flushed to
 * the client while a slow async component further down the tree is still
 * pending.
 *
 * `<Sasupensu>` boundaries take this one step further: rather than blocking the
 * stream on their (possibly async) children, they flush a fallback inline and
 * defer the real content to a `<template for>` near the bottom of the document,
 * using the platform's Declarative Partial Updates feature. See `suspense.ts`.
 */

import { escapeHtml } from "./escape.js";
import { Sasupensu, type SasupensuProps } from "./suspense.js";
import {
  isJSXElement,
  type Component,
  type JSXNode,
  type Props,
} from "./types.js";

/** Elements that have no closing tag and no children. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Props that are never rendered as HTML attributes. */
const RESERVED_PROPS = new Set(["children", "key", "ref"]);

/**
 * A pending `<Sasupensu>` boundary: a unique `name` shared by its inline range
 * marker and its later `<template for>`, plus a task that renders the deferred
 * children. The task resolves with the buffered HTML *and* any boundaries
 * nested within it (which only become valid targets once this one is flushed).
 */
interface Boundary {
  readonly name: string;
  readonly task: Promise<{ html: string; children: Boundary[] }>;
}

/**
 * Per-render walk state. Boundaries discovered during a walk are collected into
 * `pending`; the unique-name counter is shared across nested contexts so every
 * marker in a single render gets a distinct name.
 */
interface RenderContext {
  readonly nextName: () => string;
  readonly pending: Boundary[];
}

function createRenderContext(parent?: RenderContext): RenderContext {
  // Nested contexts (a boundary's deferred subtree) keep their own `pending`
  // list but reuse the parent's counter so names never collide.
  const nextName =
    parent?.nextName ??
    (() => {
      let n = 0;
      return () => `S:${n++}`;
    })();
  return { nextName, pending: [] };
}

/**
 * Walk a node, yielding HTML fragments in document order, then flush any
 * `<Sasupensu>` templates that became ready.
 */
export async function* renderNode(node: JSXNode): AsyncGenerator<string> {
  const ctx = createRenderContext();
  yield* walk(node, ctx);
  yield* drainBoundaries(ctx.pending);
}

/** The recursive walk; threads the render context so boundaries can register. */
async function* walk(
  node: JSXNode,
  ctx: RenderContext,
): AsyncGenerator<string> {
  // Nullish and booleans render to nothing (so `cond && <X/>` works).
  if (node == null || node === true || node === false) return;

  if (typeof node === "string") {
    yield escapeHtml(node);
    return;
  }

  if (typeof node === "number" || typeof node === "bigint") {
    yield String(node);
    return;
  }

  if (isJSXElement(node)) {
    const { type, props } = node;

    // Suspense-like boundary: flush a fallback now, defer the children.
    if (type === Sasupensu) {
      yield* renderSuspense(props as SasupensuProps, ctx);
      return;
    }

    // Function component (sync or async). Awaiting a sync return is a no-op.
    if (typeof type === "function") {
      const rendered = await (type as Component)(props);
      yield* walk(rendered, ctx);
      return;
    }

    // Intrinsic element (tag name string).
    yield* renderElement(type, props, ctx);
    return;
  }

  // Anything else iterable (arrays, generators, …) is rendered in order.
  if (typeof (node as Iterable<JSXNode>)[Symbol.iterator] === "function") {
    for (const child of node as Iterable<JSXNode>) {
      yield* walk(child, ctx);
    }
    return;
  }

  // Unknown leaf: coerce to string defensively.
  yield escapeHtml(String(node));
}

/**
 * Render a `<Sasupensu>` boundary. The fallback is emitted inline inside a
 * range-marker processing instruction; the children are rendered concurrently
 * (into their own context, so nested boundaries are captured) and registered to
 * be flushed as a `<template for>` once they settle.
 */
async function* renderSuspense(
  props: SasupensuProps,
  ctx: RenderContext,
): AsyncGenerator<string> {
  const name = ctx.nextName();

  // Kick off the deferred children now so their async work runs in parallel
  // with the rest of the document. Nested boundaries land in `childCtx.pending`
  // and are only promoted once this boundary's template is flushed.
  const childCtx = createRenderContext(ctx);
  const task = (async () => {
    let html = "";
    for await (const chunk of walk(props.children, childCtx)) html += chunk;
    return { html, children: childCtx.pending };
  })();
  ctx.pending.push({ name, task });

  // Flush the fallback immediately, wrapped in a range marker the template will
  // later replace. Escaping the name is unnecessary (we control it) but cheap.
  yield `<?start name="${name}">`;
  yield* walk(props.fallback, ctx);
  yield `<?end>`;
}

/**
 * Flush boundary templates as they settle. Whichever boundary resolves first is
 * streamed first (true out-of-order delivery), except that a nested boundary is
 * never flushed before its parent — its marker only exists once the parent's
 * template has been applied.
 */
async function* drainBoundaries(
  boundaries: Boundary[],
): AsyncGenerator<string> {
  const active = [...boundaries];
  while (active.length > 0) {
    const winner = await Promise.race(
      active.map(async (b) => ({ b, result: await b.task })),
    );
    active.splice(active.indexOf(winner.b), 1);

    yield `<template for="${winner.b.name}">`;
    yield winner.result.html;
    yield `</template>`;

    // The parent's content (and thus its nested markers) is now live; the
    // children become valid targets and join the race.
    active.push(...winner.result.children);
  }
}

async function* renderElement(
  tag: string,
  props: Props,
  ctx: RenderContext,
): AsyncGenerator<string> {
  const attrs = renderAttributes(props);

  if (VOID_ELEMENTS.has(tag)) {
    yield `<${tag}${attrs}>`;
    return;
  }

  yield `<${tag}${attrs}>`;

  const innerHtml = props.dangerouslySetInnerHTML as
    | { __html?: unknown }
    | undefined;
  if (innerHtml && typeof innerHtml.__html === "string") {
    // Raw, intentionally-unescaped HTML.
    yield innerHtml.__html;
  } else {
    yield* walk(props.children, ctx);
  }

  yield `</${tag}>`;
}

function renderAttributes(props: Props): string {
  let out = "";
  for (const name in props) {
    if (RESERVED_PROPS.has(name) || name === "dangerouslySetInnerHTML") {
      continue;
    }
    const value = props[name];
    const rendered = renderAttribute(name, value);
    if (rendered !== "") out += ` ${rendered}`;
  }
  return out;
}

function renderAttribute(name: string, value: unknown): string {
  // Drop event handlers and other functions — there is no client to bind them.
  if (typeof value === "function") return "";
  // Skip nullish and `false` (e.g. `disabled={false}`).
  if (value == null || value === false) return "";

  const attrName = normalizeAttributeName(name);

  // Boolean attributes: `disabled`, `checked`, … render bare when `true`.
  if (value === true) return attrName;

  const serialized =
    attrName === "style" ? serializeStyle(value) : String(value);

  return `${attrName}="${escapeHtml(serialized)}"`;
}

function normalizeAttributeName(name: string): string {
  switch (name) {
    case "className":
      return "class";
    case "htmlFor":
      return "for";
    default:
      return name;
  }
}

function serializeStyle(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return "";

  let css = "";
  for (const [prop, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw == null || raw === false) continue;
    const property = prop
      .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      .replace(/^ms-/, "-ms-");
    css += `${property}:${String(raw)};`;
  }
  return css;
}
