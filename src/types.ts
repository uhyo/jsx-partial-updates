/**
 * Core type definitions for the JSX runtime.
 */

/** A component is just a function of props returning a node (sync or async). */
export type Component<P = Props> = (
  props: P,
) => JSXNode | Promise<JSXNode>;

/** The `type` of an element: an intrinsic tag name or a component function. */
export type ElementType = string | Component<any>;

export interface Props {
  [key: string]: unknown;
  children?: JSXNode;
}

/** The object produced by the `jsx`/`jsxs` factory functions. */
export interface JSXElement<T extends ElementType = ElementType> {
  readonly $$typeof: typeof ELEMENT_MARKER;
  readonly type: T;
  readonly props: Props;
  readonly key: string | null;
}

/** Anything that can be rendered. */
export type JSXNode =
  | JSXElement
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Iterable<JSXNode>;

/** Brand used to recognize elements created by this runtime. */
export const ELEMENT_MARKER: unique symbol = Symbol.for(
  "jsx-partial-updates.element",
);

export function isJSXElement(value: unknown): value is JSXElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { $$typeof?: unknown }).$$typeof === ELEMENT_MARKER
  );
}
