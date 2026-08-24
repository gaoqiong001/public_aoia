---
feature: flow-editor
status: delivered
specs:
  - docs/compose/specs/2026-08-20-flow-editor-design.md
plans:
  - docs/compose/plans/2026-08-20-flow-editor.md
branch: feature/flow-editor
commits: d673b735..4fb227c4
---

# 流程编辑器页面 — Final Report

## What Was Built

A new `/flow-editor` menu page integrating the official **Flowgram.ai free-layout** visual node-flow editor into the Ant Design Pro (aoia) project. The page delivers the complete Flowgram demo experience: a free-layout canvas with drag / connect / zoom, a node-add panel, sidebar, context menu, variable panel, test run, and shortcuts. Node and panel UI uses **Semi Design** (`@douyinfe/semi-ui`), vendored directly from Flowgram's `demo-free-layout` source — not rewritten to antd (a full antd rewrite of 13 node types + testrun was deemed too large). The engine (`@flowgram.ai/free-layout-editor` v1.0.13) and its plugins are installed from npm.

## Architecture

- **Page entry** `src/pages/flow-editor/index.tsx`: default export `FlowEditorPage`. Calls `unstableSetCreateRoot(createRoot)` from `@flowgram.ai/form-materials` (React 18/19 polyfill, ported from the demo `app.tsx`) before rendering. Wraps the demo `Editor` in a `PageContainer` + `position: relative; height: 100%` div so the demo's absolute-positioned `.demo-container` fills the ProLayout content area (`calc(100vh - 160px)`, matching the chatbot-page pattern).
- **Vendored demo** `src/pages/flow-editor/` (~217 files): copied from `github.com/bytedance/flowgram.ai/apps/demo-free-layout/src` — `editor.tsx`, `hooks/`, `nodes/` (13 node types), `components/`, `plugins/`, `shortcuts/`, `services/`, `form-components/`, `context/`, `utils/`, `typings/`, `assets/`, `styles/`, `initial-data.ts`. The demo's `app.tsx` (createRoot bootstrap) and `index.ts` (package re-export) were removed; Umi mounts the page itself.
- **Route** `config/routes.ts`: `{ path: '/flow-editor', name: 'flow-editor', icon: 'apartment', component: './flow-editor' }` — no `access` gate (visible to all logged-in users, like chatbot).
- **i18n** `src/locales/<locale>/menu.ts` (8 languages): `menu.flow-editor` key; values reused from each locale's existing `menu.editor.flow` translation.

### Design Decisions

- **Semi Design, not antd rewrite** — The demo's node/panel/form UI is built with Semi Design. Rewriting all 13 node types + testrun + variable panel in antd would be a massive effort; vendoring the demo as-is (Semi) delivers the full experience. Two design systems coexist, scoped to this page only.
- **Vendored code excluded from Biome + tsc** — `biome.json` adds `!**/src/pages/flow-editor` to `files.includes`; `tsconfig.json` adds `src/pages/flow-editor` to `exclude`. Rationale: third-party vendored code should not be held to the project's strict linter/typechecker; the demo was written for React 18 + non-strict + Rsbuild and carries ~390 Biome formatting diffs and ~35 strict-mode tsc errors (Inversify `@inject` properties without initializers; React-19 removed global `JSX` namespace). Excluding keeps `npm run lint` / `npm run tsc` green without churning vendored code.
- **`.lintstagedrc.cjs` (JS) replaces `.lintstagedrc` (JSON)** — filters `src/pages/flow-editor/` files out before invoking Biome in the pre-commit hook. Necessary because: (a) Biome's `--no-errors-on-unmatched` flag fixes the exit-code-1-on-ignored-files issue, but (b) lint-staged passing ~217 vendored paths to Biome overflows the Windows command-line length limit. The function returns `[]` (no command) when only vendored files are staged, so vendored commits skip Biome entirely.
- **`styled-components` v6** (not the demo's v5) — React 19 compatible; v5 peer-deps predate React 19.
- **reflect-metadata** — Inversify's `@injectable` / `@inject` require it. The `@flowgram.ai/free-layout-editor` engine self-imports `require("reflect-metadata")` at module load, so no explicit import was needed in the page entry.

## Usage

- Access: log in (mock `admin` / `ant.design` in dev), open the **流程编辑器** menu item → `/flow-editor`.
- The canvas loads with the demo's sample workflow (`initial-data.ts`); drag nodes, connect ports, zoom, and use the node panel / sidebar / test run.
- Dev: `npm start` (mock on). Production build: `npm run build` (emits `dist/flow-editor/index.html`).

## Verification

- `npm run tsc` → exit 0 (flow-editor excluded).
- `npm run build` → exit 0; log contains `event - Build flow-editor\index.html`.
- `npm run lint` (biome + tsc) → exit 0; 275 files checked.
- `npx antd lint ./src` → exit 0 (only pre-existing template warnings; none in flow-editor).
- Dev server: `utoo pack v1.5.2 ready`; `GET /flow-editor` → HTTP 200 (SPA shell).
- Runtime rendering + height: confirmed by the user — the editor renders and the canvas fills the ProLayout content area after the `PageContainer` height fix.

## Journey Log

> Brief notes that informed the final design. Not required reading.

- [lesson] Vendored code + strict project linter: excluding a directory from Biome alone is insufficient — lint-staged passes staged files explicitly to Biome, which then errors on "no files were processed" (exit 1) or overflows the Windows cmd-line length with many files. Fix: filter vendored files out in a JS lint-staged config (function command) + Biome `--no-errors-on-unmatched`.
- [pivot] Switched from "rewrite node UI in antd" to "vendor demo with Semi Design" after the user judged the antd rewrite too large for the full demo experience.
- [lesson] React 19 removed the global `JSX` namespace (`@types/react` no longer provides it); React-18-era vendored code referencing `JSX.Element` needs either a global shim or tsc exclusion (exclusion chosen here).
- [lesson] Full-height page in antd pro: wrap in `PageContainer` with `childrenContentStyle={{ height: 'calc(100vh - 160px)', overflow: 'hidden' }}` (the chatbot-page pattern); an absolute-positioned child needs a `position: relative; height: 100%` ancestor.
- [dead end] Headless browser verification blocked: `playwright-cli` daemon crashed (Node v24 libuv assertion) and browser binaries weren't installed; fell back to user visual confirmation for runtime rendering + height.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/specs/2026-08-20-flow-editor-design.md` | Initial design | See §Design Decisions for the vendored-code exclusion + lint-staged refinements made during execution |
| `docs/compose/plans/2026-08-20-flow-editor.md` | Implementation plan | Tasks 1–8 executed; pre-commit hook fix + height fix added during execution |
