/**
 * Streaming renderer.
 *
 * The tree is walked by an async generator that yields HTML fragments as soon
 * as they are produced. Because the walk is `async`, sync *and* async function
 * components are handled by the same code path: `await` on a non-promise value
 * simply returns it. This means earlier parts of the document can be flushed to
 * the client while a slow async component further down the tree is still
 * pending.
 */

import { escapeHtml } from "./escape.js";
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

/** Walk a node, yielding HTML fragments in document order. */
export async function* renderNode(node: JSXNode): AsyncGenerator<string> {
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

    // Function component (sync or async). Awaiting a sync return is a no-op.
    if (typeof type === "function") {
      const rendered = await (type as Component)(props);
      yield* renderNode(rendered);
      return;
    }

    // Intrinsic element (tag name string).
    yield* renderElement(type, props);
    return;
  }

  // Anything else iterable (arrays, generators, …) is rendered in order.
  if (typeof (node as Iterable<JSXNode>)[Symbol.iterator] === "function") {
    for (const child of node as Iterable<JSXNode>) {
      yield* renderNode(child);
    }
    return;
  }

  // Unknown leaf: coerce to string defensively.
  yield escapeHtml(String(node));
}

async function* renderElement(
  tag: string,
  props: Props,
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
    yield* renderNode(props.children);
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
