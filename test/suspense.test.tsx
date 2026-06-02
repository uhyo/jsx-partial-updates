import { describe, expect, it } from "vitest";
import {
  renderToStream,
  renderToString,
  Sasupensu,
} from "jsx-partial-updates";
import type { JSXNode } from "jsx-partial-updates";

/** Read a byte stream into an ordered list of decoded chunks. */
async function readChunks(
  stream: ReadableStream<Uint8Array>,
): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  const tail = decoder.decode();
  if (tail) chunks.push(tail);
  return chunks;
}

describe("Sasupensu boundary", () => {
  it("emits a range marker with the fallback, then a matching template", async () => {
    async function Slow() {
      await Promise.resolve();
      return <p>resolved</p>;
    }

    const html = await renderToString(
      <div>
        <Sasupensu fallback={<span>Loading…</span>}>
          <Slow />
        </Sasupensu>
      </div>,
    );

    expect(html).toBe(
      '<div><?start name="S:0"><span>Loading…</span><?end></div>' +
        '<template for="S:0"><p>resolved</p></template>',
    );
  });

  it("flushes the fallback before the children resolve", async () => {
    let resolved = false;
    async function Slow() {
      await new Promise((r) => setTimeout(r, 20));
      resolved = true;
      return <p>done</p>;
    }

    const stream = renderToStream(
      <main>
        <Sasupensu fallback={<i>spinner</i>}>
          <Slow />
        </Sasupensu>
        <footer>after</footer>
      </main>,
    );

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let received = "";

    // The fallback *and* the sibling <footer> must arrive while <Slow/> is
    // still pending — proving the boundary does not block the stream.
    while (!received.includes("<footer>after</footer>")) {
      const { value, done } = await reader.read();
      expect(done).toBe(false);
      received += decoder.decode(value, { stream: true });
    }
    expect(received).toContain('<?start name="S:0"><i>spinner</i><?end>');
    expect(received).not.toContain("<template");
    expect(resolved).toBe(false);

    // Drain the rest: the template arrives after the document body.
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
    }
    expect(resolved).toBe(true);
    expect(received).toContain('<template for="S:0"><p>done</p></template>');
    // The template comes after the sibling content.
    expect(received.indexOf("<footer>")).toBeLessThan(
      received.indexOf("<template"),
    );
  });

  it("streams the fastest boundary's template first (out of order)", async () => {
    function Delayed({ ms, label }: { ms: number; label: string }) {
      return (async () => {
        await new Promise((r) => setTimeout(r, ms));
        return <p>{label}</p>;
      })() as unknown as JSXNode;
    }

    const chunks = await readChunks(
      renderToStream(
        <div>
          <Sasupensu fallback={<i>a…</i>}>
            <Delayed ms={40} label="slow" />
          </Sasupensu>
          <Sasupensu fallback={<i>b…</i>}>
            <Delayed ms={5} label="fast" />
          </Sasupensu>
        </div>,
      ),
    );

    const html = chunks.join("");
    // S:0 (slow) and S:1 (fast) both have markers in document order…
    expect(html.indexOf('name="S:0"')).toBeLessThan(html.indexOf('name="S:1"'));
    // …but the fast boundary's template is flushed before the slow one's.
    expect(html.indexOf('for="S:1"')).toBeLessThan(html.indexOf('for="S:0"'));
  });

  it("never flushes a nested template before its parent", async () => {
    async function Outer({ children }: { children?: JSXNode }) {
      await new Promise((r) => setTimeout(r, 20));
      return <section>{children}</section>;
    }
    async function Inner() {
      // Resolves quickly, but its marker only exists once Outer is applied.
      await new Promise((r) => setTimeout(r, 1));
      return <p>inner</p>;
    }

    const html = await renderToString(
      <div>
        <Sasupensu fallback={<i>outer…</i>}>
          <Outer>
            <Sasupensu fallback={<i>inner…</i>}>
              <Inner />
            </Sasupensu>
          </Outer>
        </Sasupensu>
      </div>,
    );

    // Parent boundary is S:0, nested is S:1.
    expect(html).toContain('<?start name="S:0"><i>outer…</i><?end>');
    // The parent template carries the nested range marker as its payload.
    expect(html).toContain(
      '<template for="S:0"><section>' +
        '<?start name="S:1"><i>inner…</i><?end>' +
        "</section></template>",
    );
    // Nested template comes strictly after the parent's.
    expect(html.indexOf('for="S:0"')).toBeLessThan(html.indexOf('for="S:1"'));
    expect(html).toContain('<template for="S:1"><p>inner</p></template>');
  });

  it("renders the real children when used without streaming markers", () => {
    // Calling the component directly (non-streaming) yields the children.
    expect(Sasupensu({ fallback: "x", children: "real" })).toBe("real");
  });
});
