/**
 * `<Sasupensu>` — a Suspense-like boundary built on the web platform's
 * **Declarative Partial Updates** feature.
 *
 * Instead of blocking the stream until its children resolve, the boundary
 * flushes its `fallback` immediately wrapped in a *range marker* processing
 * instruction:
 *
 * ```html
 * <?start name="S:0">
 *   <!-- fallback -->
 * <?end>
 * ```
 *
 * The children are rendered concurrently while the rest of the document keeps
 * streaming. Once they resolve, the renderer streams a matching template near
 * the bottom of the document:
 *
 * ```html
 * <template for="S:0"><!-- resolved children --></template>
 * ```
 *
 * A conforming browser swaps the marked range for the template's content with
 * no JavaScript. See
 * https://developer.chrome.com/blog/declarative-partial-updates.
 */

import type { JSXNode } from "./types.js";

export interface SasupensuProps {
  /** Shown in place of the children until they resolve. */
  fallback?: JSXNode;
  /** The (possibly async) content this boundary is waiting on. */
  children?: JSXNode;
}

/**
 * Identity-checked marker component. The streaming renderer special-cases this
 * function (by reference) to emit the partial-update markers. Invoking it
 * directly simply returns its children, so a non-streaming consumer still gets
 * the real content — just without the out-of-order fallback behaviour.
 */
export function Sasupensu(props: SasupensuProps): JSXNode {
  return props.children;
}
