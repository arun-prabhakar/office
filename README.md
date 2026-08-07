# PrismOffice

An AI-native office suite for macOS and Windows: word processor, spreadsheet,
presentations, and PDF — five Electron apps sharing one engine layer, built
around AI editing as a first-class workflow rather than a bolted-on chat box.

[![Meet PrismOffice — the world's first full-featured open-source AI Office (video)](https://img.youtube.com/vi/B2pLdMX95v4/maxresdefault.jpg)](https://www.youtube.com/watch?v=B2pLdMX95v4)

[Watch the demo video on YouTube](https://www.youtube.com/watch?v=B2pLdMX95v4)

## Download

| Platform                        | Requirements                                | Download                                                                                                                             |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **macOS** (Apple Silicon)       | macOS 11+                                   | [PrismOffice-0.5.83-arm64.dmg](https://github.com/arun-prabhakar/office/releases/download/v0.5.83/PrismOffice-0.5.83-arm64.dmg)          |
| **Windows** (x64)               | Windows 10+                                 | [PrismOfficeSetup-v0.5.79.exe](https://github.com/arun-prabhakar/office/releases/download/v0.5.83/PrismOfficeSetup-v0.5.79.exe)          |
| **Linux** — Debian / Ubuntu     | x86_64, glibc 2.34+ (Ubuntu 22.04 or newer) | [prismoffice_0.5.149_amd64.deb](https://github.com/arun-prabhakar/office/releases/download/linux-v0.5.149/prismoffice_0.5.149_amd64.deb) |
| **Linux** — other distributions | x86_64, glibc 2.34+, FUSE 2                 | [PrismOffice-0.5.149.AppImage](https://github.com/arun-prabhakar/office/releases/download/linux-v0.5.149/PrismOffice-0.5.149.AppImage)   |

All builds come from `main`; the macOS and Windows installers are signed.
Older versions are on the [Releases](https://github.com/arun-prabhakar/office/releases) page.

### Installing on Linux

The deb installs with apt — it pulls in the dependencies and adds PrismOffice
to the applications menu:

```bash
sudo apt install ./prismoffice_0.5.149_amd64.deb
```

The AppImage instead runs in place: install the FUSE 2 runtime
(`sudo apt install libfuse2`; on Ubuntu 24.04 the package is `libfuse2t64`),
make the file executable, then run it:

```bash
chmod +x PrismOffice-0.5.149.AppImage
./PrismOffice-0.5.149.AppImage
```

## Apps

| App           | Product              | What it is                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/docs`   | **PrismOffice Docs**   | `.docx` word processor. Byte-preserving round trip: only dirty paragraphs are regenerated (paragraph patch), everything else in the original file is kept byte-for-byte, so opening and saving never breaks layout in Word. Paginated view whose line metrics reproduce the original document's layout, tracked changes, comments, styles, equations, ink.    |
| `apps/sheets` | **PrismOffice Sheets** | `.xlsx` spreadsheet. UI built on the open-source [Univer](https://github.com/dream-num/univer) core (Apache-2.0) with a large layer of in-house extensions; `.xlsx` import/export runs through an in-house Rust sidecar (calamine + IronCalc), charts are rendered in-house (Konva), plus pivot tables, slicers, conditional formatting, and formula tracing. |
| `apps/slides` | **PrismOffice Slides** | `.pptx` presentations. In-house `.pptx` parse/render/edit engine with masters, charts, cropping, ink, and text shaping (HarfBuzz metrics).                                                                                                                                                                                                                    |
| `apps/pdf`    | **PrismOffice PDF**    | `.pdf` viewer/editor on pdf.js + pdf-lib: annotations, forms, outlines, stamps, signatures, page operations, and printing support.                                                                                                                                                                                                                            |
| `apps/shell`  | **PrismOffice**        | The suite shell: home screen, tabbed hosting of the four editors, auto-update.                                                                                                                                                                                                                                                                                |

Every app embeds the same AI panel: block-granular AI editing with version
snapshots and diffs in docs, a tool-calling agent over workbook/slide/PDF
state in the others.

**AI providers.** The apps use the [Vercel AI SDK](https://sdk.vercel.ai) with
direct vendor API keys (Anthropic, OpenAI, Google, DeepSeek, or any
OpenAI-compatible endpoint). Keys are configured per-provider in settings; the
default is Anthropic. No intermediate proxy or account is required.

## Engine packages

All pure TypeScript, no Electron dependency, unit-tested (except the UI kit):

- `packages/docx-engine` — docx parsing → block tree (with `docxIndex`
  anchors and passthrough), OOXML fragment generation, byte-level paragraph
  patching.
- `packages/pptx-engine` / `packages/pptx-render` — pptx model and rendering.
- `packages/file-parse` — text extraction for AI attachments (office formats,
  text formats).
- `packages/agent-core` — the AI agent loop and skill composition shared by
  every app.
- `packages/ai-provider` — multi-provider LLM streaming via the Vercel AI SDK
  (Anthropic/OpenAI/Google/DeepSeek/custom), shared by every app and the web edition.
- `packages/ai-search` — web/image search tools (Serper + DuckDuckGo fallback).
- `packages/i18n`, `packages/ui`, `packages/project-store`,
  `packages/electron-utils` — shared i18n core, React UI kit, recent-files
  store, and Electron main-process helpers.

## Web edition

`apps/web` is a [Next.js](https://nextjs.org) webapp that runs PrismOffice
editors in the browser. AI model calls are proxied server-side (vendor keys
stay on the server); the agent loop runs client-side over HTTP/SSE.

| Route | What |
| --- | --- |
| `/docs` | Full Tiptap `.docx` editor with byte-preserving round-trip + AI panel |
| `/markdown` | Tiptap Markdown editor with `.md` load/save + AI panel |
| `/agent-demo` | Tool-calling agent demo (proof of the web transport) |

```bash
npm run dev -w @prismoffice/web     # dev server at localhost:3000
npm run build -w @prismoffice/web   # production build
```

Set `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`, `GOOGLE_API_KEY`,
`DEEPSEEK_API_KEY`) for live AI. Without a key the editors still load/save
files but AI features return an error.

## Development

```bash
npm install
npm run fixtures     # generate test .docx fixtures
npm test             # engine + app unit tests (docs/sheets/slides need no display)
npm run typecheck    # tsc --noEmit across every workspace
npm run dev          # all four editors + shell against Vite dev servers
npm run dev:docs     # a single app (same pattern works per workspace)
npm run dist:win     # package Windows nsis installer
```

The sheets app additionally needs a Rust toolchain for its xlsx sidecar
(`cargo` on PATH); `npm run build -w @prismoffice/sheets` compiles it
automatically.

### Web app

```bash
# Start the Next.js dev server (set a vendor key for live AI)
ANTHROPIC_API_KEY=sk-ant-… npm run dev -w @prismoffice/web
```

### Building from source

This is a development fork — prebuilt installers are not yet published here.
To build desktop installers from source:

```bash
npm run dist:mac     # macOS dmg (needs macOS + Xcode tools)
npm run dist:win     # Windows nsis (needs Windows + electron-builder)
npm run dist:linux   # Linux deb/AppImage
```

Local UI/e2e driver scripts (Playwright + Electron, for local acceptance, not
committed by default) live in [`scripts/drivers/`](scripts/drivers/README.md).

## Architecture notes (docx round trip)

```
open docx ─► archive original by hash (never touched)
          ─► docx-engine parses word/document.xml top-level elements (w:p / w:tbl / …)
          ─► Block tree, each block anchored by docxIndex + original XML slice
          ─► Tiptap streaming editor (manual + AI editing, dirty tracking)
save      ─► dirty blocks → OOXML fragments (referencing existing styles only)
          ─► splice into original document.xml (untouched blocks keep original bytes)
          ─► repack zip; all other entries copied byte-for-byte
```

The same philosophy holds in sheets and slides: the original file is the
source of truth, edits are applied as narrow patches, and everything the
editor didn't touch survives the round trip untouched.

## Security

See [SECURITY.md](SECURITY.md) for the process security posture (renderer
sandboxing, IPC validation, external-link gating) and the threat models for
AI-generated content.

## Third-party notices

`npm run notices` regenerates the bundled third-party license summary
(`tools/gen-third-party-notices.mjs`); all runtime dependencies are
MIT/Apache-2.0/OFL, and the bundled fonts (Liberation, Carlito, Caladea, Noto
CJK subsets) are OFL/Apache.

## License

PrismOffice is licensed under the [Apache License 2.0](LICENSE), with one
exception: the `ee/` directory is reserved for future enterprise modules and
is covered by the [PrismOffice Enterprise License](ee/LICENSE).

The PrismOffice name and logo are trademarks of their respective owners.
Forks should use their own branding (see the Apache-2.0 license, section 6).
