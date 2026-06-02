/**
 * Public API: turn a JSX tree into a WHATWG stream (or a string).
 */

import { renderNode } from "./render.js";
import type { JSXNode } from "./types.js";

export { jsx, jsxs, Fragment } from "./jsx-runtime.js";
export type {
  Component,
  ElementType,
  JSXElement,
  JSXNode,
  Props,
} from "./types.js";
export { renderNode } from "./render.js";
export { Sasupensu } from "./suspense.js";
export type { SasupensuProps } from "./suspense.js";

/**
 * Render a JSX node into a WHATWG `ReadableStream` of UTF-8 bytes.
 *
 * Chunks are enqueued as the tree is walked, so the consumer starts receiving
 * the document before async components deeper in the tree have resolved.
 */
export function renderToStream(
  node: JSXNode,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = renderNode(node);

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        // Skip empty fragments instead of enqueuing zero-length chunks.
        if (value !== "") controller.enqueue(encoder.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      // Allow the generator to run its `finally` blocks.
      await iterator.return?.(undefined);
    },
  });
}

/**
 * Render a JSX node into a `ReadableStream<string>` of HTML fragments
 * (UTF-8 encoding skipped). Handy for piping into a `TextDecoderStream`-free
 * consumer or for tests.
 */
export function renderToTextStream(
  node: JSXNode,
): ReadableStream<string> {
  const iterator = renderNode(node);

  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        if (value !== "") controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });
}

/** Convenience: fully render a JSX node to an HTML string. */
export async function renderToString(node: JSXNode): Promise<string> {
  let html = "";
  for await (const chunk of renderNode(node)) {
    html += chunk;
  }
  return html;
}
