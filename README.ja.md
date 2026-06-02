# jsx-partial-updates — 宣言的部分更新（Declarative Partial Updates）デモ

> 🇬🇧 English README is here: [README.md](./README.md)

このページは **[宣言的部分更新（Declarative Partial Updates）](https://developer.chrome.com/blog/declarative-partial-updates)
のデモを見に来た方向け**のガイドです。デモサーバーをローカルで起動し、ブラウザ
（Google Chrome）でこの機能を有効化して、**JavaScript なしで** ストリーミング配信
された HTML の差し替えが起こる様子を実際に体験する手順を説明します。

## デモの概要

`jsx-partial-updates` は、JSX を WHATWG の `ReadableStream` へとレンダリングする
小さな JSX ランタイムです。デモサーバーは 1 本の HTTP レスポンスとして 1 ページを
ストリーミングします。

- ページの骨組み（ヘッダー・フッター）と、各 `<Sasupensu>`（＝ Suspense の日本語）
  の **フォールバック（ローディング表示）が真っ先に届きます**。
- 時間のかかる非同期コンポーネントは、それぞれ独立して解決され、解決した順
  （＝速いものから先に）に `<template for="...">` 要素としてストリーミングされます。
- **宣言的部分更新に対応したブラウザ**では、この `<template>` がフォールバックの
  位置に **JavaScript を一切使わずに** 差し替えられます。

つまり「速いカードから順番にポップインしてくる」様子を、クライアント JS なしで
確認できる、というのがこのデモの見どころです。

## 必要なもの

- [Node.js](https://nodejs.org/)（最近の LTS 版を推奨）
- [pnpm](https://pnpm.io/)（`package.json` では `pnpm@10.33.0` を使用）
- 宣言的部分更新を有効化した **Google Chrome 148 以降**（後述）

## デモサーバーをローカルで起動する

リポジトリのルートで次を実行します。

```bash
# 1. 依存関係をインストール
pnpm install

# 2. パッケージをビルド（example は dist/ から import するため必須）
pnpm build

# 3. デモサーバーを起動
pnpm example:server
```

> [!NOTE]
> examples はパッケージを `dist/` から読み込みます。`pnpm example:server` の前に
> 一度 `pnpm build` を実行しておく必要があります。

起動するとターミナルに次のような URL が表示されます。

```
  jsx-partial-updates demo server

  ➜  http://localhost:3000
  ➜  with polyfill:   http://localhost:3000/?polyfill
  ➜  streaming view:  curl -N http://localhost:3000
```

`http://localhost:3000` を Chrome で開いてください。
ポートを変えたいときは `PORT` 環境変数を指定します（例: `PORT=8080 pnpm example:server`）。

### 2 つの確認方法

| URL | 動作 |
| --- | --- |
| `http://localhost:3000` | クライアント JS なし。**ブラウザ標準の宣言的部分更新**で差し替えが起こります（Chrome でフラグ有効化が必要）。 |
| `http://localhost:3000/?polyfill` | 小さなクライアント側ポリフィルを読み込みます。フラグなし・どのブラウザでも差し替えが見えます（動作確認・比較用）。 |

ストリーミングの様子はターミナルからも観察できます。

```bash
curl -N http://localhost:3000
```

`-N` は curl 側のバッファリングを無効にするオプションです。骨組みとスピナーが
先に届き、その後に各 `<template>` がデータの解決に合わせて少しずつ流れてくるのが
分かります。

## Google Chrome で宣言的部分更新を有効化する

`http://localhost:3000`（`?polyfill` なし）で **JavaScript を使わない** 差し替えを
見るには、Chrome 側でこの実験的機能を有効化する必要があります。宣言的部分更新は
Chrome 148 以降でフラグの背後に実装されています。

1. アドレスバーに次を入力して開きます。

   ```
   chrome://flags/#enable-experimental-web-platform-features
   ```

2. **Experimental Web Platform features**（実験的ウェブプラットフォームの機能）を
   **Enabled** に変更します。
3. 右下に表示される **Relaunch（再起動）** ボタンを押して Chrome を再起動します。
4. 再起動後、`http://localhost:3000` を開きます。`?polyfill` を付けていなくても、
   フォールバックのスピナーが実際のコンテンツへ差し替われば成功です。

> [!TIP]
> うまく差し替わらないときは、まず `http://localhost:3000/?polyfill` を開いてみて
> ください。ポリフィルありで動けば、サーバーは正常です。あとは Chrome のバージョン
> （148 以降か）とフラグの設定を確認しましょう。

> [!NOTE]
> 宣言的部分更新は実験的なプラットフォーム機能です。仕様や挙動、対応状況は変更され
> る可能性があります。最新情報は
> [Chrome の発表記事](https://developer.chrome.com/blog/declarative-partial-updates)
> を参照してください。

## 仕組み（補足）

サーバーはレンジマーカーを処理命令（processing instruction）として出力し、HTML
パーサーがこれをコメントノードに変換します。

```html
<main>
  <h1>Shop</h1>
  <?start name="S:0"><p>Loading recommendations…</p><?end>
  <footer>Streams immediately — it never waits for the list.</footer>
</main>
<template for="S:0"><ul><li>…</li></ul></template>
```

宣言的部分更新に対応したブラウザは、`<template for="S:0">` を `S:0` のマーカー範囲
（フォールバック）に差し込み、マーカーを消費します。各境界には一意の名前
（`S:0`, `S:1`, …）が割り当てられ、複数あっても・入れ子になっていても正しい場所へ
差し替えられます。

ライブラリ本体の API や使い方の詳細は [README.md](./README.md) を参照してください。

## ライセンス

MIT
