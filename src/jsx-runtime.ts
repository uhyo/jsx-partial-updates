/**
 * The "automatic" JSX runtime entry point.
 *
 * A TypeScript/Babel/esbuild toolchain configured with
 * `jsxImportSource: "jsx-partial-updates"` compiles JSX into calls to the
 * `jsx`/`jsxs` factories exported here, plus `Fragment` for `<>...</>`.
 */

import {
  ELEMENT_MARKER,
  type Component,
  type ElementType,
  type JSXElement,
  type JSXNode,
  type Props,
} from "./types.js";

/** Marker type for fragments (`<>...</>`). */
export const Fragment = Symbol.for("jsx-partial-updates.fragment");

/**
 * Element factory. `jsx` is used for elements with zero or one child;
 * `jsxs` for elements whose children were authored as a static array. The
 * runtime treats them identically.
 */
export function jsx(
  type: ElementType | typeof Fragment,
  props: Props,
  key?: string,
): JSXElement {
  return {
    $$typeof: ELEMENT_MARKER,
    // `Fragment` is modelled as a component that returns its children.
    type: (type === Fragment ? fragmentComponent : type) as ElementType,
    props: props ?? {},
    key: key ?? null,
  };
}

export { jsx as jsxs, jsx as jsxDEV };

function fragmentComponent(props: Props): JSXNode {
  return props.children;
}

/* -------------------------------------------------------------------------- */
/* JSX type namespace                                                         */
/* -------------------------------------------------------------------------- */

type StyleValue = string | number | null | undefined;

/** Loosely-typed props for intrinsic (lowercase) elements. */
interface IntrinsicProps {
  children?: JSXNode;
  class?: string;
  className?: string;
  id?: string;
  style?: string | Record<string, StyleValue>;
  dangerouslySetInnerHTML?: { __html: string };
  [attribute: string]: unknown;
}

export namespace JSX {
  export type Element = JSXElement;

  export interface ElementChildrenAttribute {
    children: object;
  }

  export interface IntrinsicElements {
    [tagName: string]: IntrinsicProps;
  }

  /** Allow components that return promises to be used as JSX. */
  export type ElementType = string | Component<any>;
}
