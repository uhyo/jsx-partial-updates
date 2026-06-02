import { describe, expect, it } from "vitest";
import { renderToStream, renderToString } from "jsx-partial-updates";
import type { JSXNode } from "jsx-partial-updates";

/** Collect a byte stream back into a string. */
async function streamToString(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

describe("intrinsic elements", () => {
  it("renders a simple element tree", async () => {
    const html = await renderToString(
      <div id="app">
        <h1>Hello</h1>
        <p>World</p>
      </div>,
    );
    expect(html).toBe('<div id="app"><h1>Hello</h1><p>World</p></div>');
  });

  it("escapes text content", async () => {
    const html = await renderToString(<p>{`<script>"&"</script>`}</p>);
    expect(html).toBe("<p>&lt;script&gt;&quot;&amp;&quot;&lt;/script&gt;</p>");
  });

  it("renders void elements without a closing tag", async () => {
    const html = await renderToString(
      <div>
        <br />
        <img src="a.png" alt="x" />
      </div>,
    );
    expect(html).toBe('<div><br><img src="a.png" alt="x"></div>');
  });

  it("normalizes className/htmlFor and handles boolean attrs", async () => {
    const html = await renderToString(
      <label className="lbl" htmlFor="field">
        <input disabled required={false} />
      </label>,
    );
    expect(html).toBe('<label class="lbl" for="field"><input disabled></label>');
  });

  it("serializes a style object", async () => {
    const html = await renderToString(
      <div style={{ backgroundColor: "red", marginTop: 4 }} />,
    );
    expect(html).toBe('<div style="background-color:red;margin-top:4;"></div>');
  });

  it("renders arrays and skips false/null children", async () => {
    const items = ["a", "b"];
    const html = await renderToString(
      <ul>
        {items.map((i) => (
          <li>{i}</li>
        ))}
        {false}
        {null}
      </ul>,
    );
    expect(html).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("supports dangerouslySetInnerHTML", async () => {
    const html = await renderToString(
      <div dangerouslySetInnerHTML={{ __html: "<b>raw</b>" }} />,
    );
    expect(html).toBe("<div><b>raw</b></div>");
  });
});

describe("function components", () => {
  it("renders a sync function component", async () => {
    function Greeting({ name }: { name: string }) {
      return <span>Hi {name}</span>;
    }
    const html = await renderToString(<Greeting name="Ada" />);
    expect(html).toBe("<span>Hi Ada</span>");
  });

  it("renders an async function component", async () => {
    async function AsyncData() {
      await new Promise((r) => setTimeout(r, 5));
      return <em>loaded</em>;
    }
    const html = await renderToString(<AsyncData />);
    expect(html).toBe("<em>loaded</em>");
  });

  it("renders fragments", async () => {
    const html = await renderToString(
      <>
        <i>a</i>
        <i>b</i>
      </>,
    );
    expect(html).toBe("<i>a</i><i>b</i>");
  });

  it("composes nested sync and async components", async () => {
    async function Child({ children }: { children?: JSXNode }) {
      await Promise.resolve();
      return <li>{children}</li>;
    }
    function List() {
      return (
        <ul>
          <Child>one</Child>
          <Child>two</Child>
        </ul>
      );
    }
    const html = await renderToString(<List />);
    expect(html).toBe("<ul><li>one</li><li>two</li></ul>");
  });
});

describe("renderToStream", () => {
  it("produces the same bytes as renderToString", async () => {
    const tree = (
      <main>
        <h1>Title</h1>
      </main>
    );
    const fromStream = await streamToString(renderToStream(tree));
    const fromString = await renderToString(tree);
    expect(fromStream).toBe(fromString);
    expect(fromStream).toBe("<main><h1>Title</h1></main>");
  });

  it("streams earlier chunks before a slow component resolves", async () => {
    let resolved = false;
    async function Slow() {
      await new Promise((r) => setTimeout(r, 20));
      resolved = true;
      return <p>done</p>;
    }

    const stream = renderToStream(
      <div>
        <header>fast</header>
        <Slow />
      </div>,
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    // Read chunks until the header has been fully flushed. This must happen
    // while <Slow/> is still pending — proving output is not buffered to the
    // end.
    let received = "";
    while (!received.includes("<header>fast</header>")) {
      const { value, done } = await reader.read();
      expect(done).toBe(false);
      received += decoder.decode(value, { stream: true });
    }
    expect(resolved).toBe(false);

    // Drain the rest.
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
    }
    expect(resolved).toBe(true);
    expect(received).toContain("<p>done</p>");
  });

  it("propagates errors thrown by components", async () => {
    function Boom(): never {
      throw new Error("kaboom");
    }
    await expect(renderToString(<Boom />)).rejects.toThrow("kaboom");
  });
});
