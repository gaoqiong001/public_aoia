# 流程编辑器页面 Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/flow-editor.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Ant Design Pro (aoia) 中新增 `/flow-editor` 菜单页面,集成 Flowgram.ai 官方 free-layout 编辑器,提供完整可视化节点流程编辑体验(节点 UI 用 Semi Design,拷贝官方 demo 源码)。

**Architecture:** 拷贝 Flowgram `demo-free-layout/src` 到 `src/pages/flow-editor/`,安装 Flowgram 引擎包(1.0.13)+ Semi Design(2.102)+ styled-components(v6)。页面入口 `index.tsx` 渲染 demo 的 `Editor` 组件并注入 React 18/19 的 `unstableSetCreateRoot` polyfill。路由与 i18n 接入 Umi Max 既有体系,经 tsc + Biome lint + dev server 验证。

**Tech Stack:** React 19 · Umi Max 4 / utoopack · antd 6 · Flowgram `@flowgram.ai/*` 1.0.13 · Semi Design `@douyinfe/semi-ui` 2.102 · styled-components 6 · TypeScript strict · Biome · Vitest

## Global Constraints

- React 19,Node ≥ 22,TypeScript strict(`tsconfig.json` 已有 `experimentalDecorators: true`)
- **Biome only**(无 ESLint/Prettier);`npm run lint`(Biome + tsc)与 `npx antd lint ./src` 提交前均须通过
- Conventional commits(commitlint 强制)
- 用 `package-lock.json`(npm,非 yarn/pnpm)
- Flowgram 包固定 `^1.0.13`;Semi `^2.102`;styled-components `^6.5`(React 19 兼容,替代 demo 的 v5)
- 不编辑 `src/services/ant-design-pro/`(自动生成,与本功能无关)
- 参考源:`https://github.com/bytedance/flowgram.ai/tree/main/apps/demo-free-layout`
- Spec:`docs/compose/specs/2026-08-20-flow-editor-design.md`

## File Structure

**Create:**
- `src/pages/flow-editor/` — 拷贝自 demo-free-layout/src(nodes/、components/、plugins/、shortcuts/、services/、form-components/、context/、hooks/、utils/、typings/、assets/、styles/、editor.tsx、initial-data.ts 等)。demo 的 `app.tsx`(createRoot 启动)删除,改由 Umi 挂载。
- `src/pages/flow-editor/index.tsx` — 页面入口:default export 渲染 `Editor`,并执行 `unstableSetCreateRoot(createRoot)` polyfill。
- `docs/compose/plans/2026-08-20-flow-editor.md` — 本文件。

**Modify:**
- `package.json` — 新增 dependencies。
- `config/routes.ts` — 新增 `/flow-editor` 路由。
- `src/locales/{zh-CN,en-US,zh-TW,ja-JP,pt-BR,fa-IR,id-ID,bn-BD}/menu.ts` — 各加 `menu.flow-editor`。

**Test:** 本项目页面无单元测试约定(参见既有页面 chatbot/dashboard 等均无 *.test.tsx);验证以 `npm run tsc` + `npm run lint` + `npm start` 打开 `/flow-editor` 实测为准(见 Spec [S8])。

---

### Task 1: 安装依赖

**Covers:** [S3]

**Files:**
- Modify: `package.json` → `dependencies`

**Interfaces:**
- Produces: node_modules 内 `@flowgram.ai/*` 1.0.13、`@douyinfe/semi-ui` 2.102、`styled-components` 6.5 可用,供后续任务导入。

- [ ] **Step 1: 在 `package.json` 的 `dependencies` 中新增依赖**

在 `"dependencies"` 对象内(按字母序插入,保持现有条目不动)加入:

```json
"@douyinfe/semi-icons": "^2.102.0",
"@douyinfe/semi-ui": "^2.102.0",
"@flowgram.ai/export-plugin": "^1.0.13",
"@flowgram.ai/free-container-plugin": "^1.0.13",
"@flowgram.ai/free-group-plugin": "^1.0.13",
"@flowgram.ai/free-layout-editor": "^1.0.13",
"@flowgram.ai/free-lines-plugin": "^1.0.13",
"@flowgram.ai/free-node-panel-plugin": "^1.0.13",
"@flowgram.ai/free-snap-plugin": "^1.0.13",
"@flowgram.ai/free-stack-plugin": "^1.0.13",
"@flowgram.ai/form-materials": "^1.0.13",
"@flowgram.ai/minimap-plugin": "^1.0.13",
"@flowgram.ai/panel-manager-plugin": "^1.0.13",
"@flowgram.ai/runtime-interface": "^1.0.13",
"@flowgram.ai/runtime-js": "^1.0.13",
"classnames": "^2.5.1",
"lodash-es": "^4.17.21",
"nanoid": "^5.0.9",
"styled-components": "^6.5.3"
```

注意:`styled-components` 用 `^6.5.3`(React 19 兼容),非 demo 的 v5。`clsx` 已在项目,demo 用 `classnames` 故另加。

- [ ] **Step 2: 安装**

Run: `npm install`
Expected: 安装完成,无 peer 依赖致命错误(flowgram peer `react>=16.8`、Semi peer `react>=16.0.0`,均满足 React 19)。若有 peer 警告可忽略。

- [ ] **Step 3: 验证关键包版本**

Run: `npm.cmd ls "@flowgram.ai/free-layout-editor" "@douyinfe/semi-ui" "styled-components"`
Expected: 三者分别显示 1.0.13、2.102.x、6.5.x。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(flow-editor): add flowgram + semi design dependencies"
```

---

### Task 2: 拷贝 demo 源码到 src/pages/flow-editor/

**Covers:** [S2], [S5]

**Files:**
- Create: `src/pages/flow-editor/`(整树拷贝)

**Interfaces:**
- Produces: `src/pages/flow-editor/editor.tsx`(`Editor` 组件)、`initial-data.ts`、`hooks/`、`nodes/`、`components/`、`plugins/`、`shortcuts/`、`services/`、`form-components/`、`context/`、`utils/`、`typings/`、`assets/`、`styles/`,供 Task 3 入口与 Task 6 构建修复引用。

- [ ] **Step 1: 浅克隆 + sparse-checkout 取 demo 源码到临时目录**

Run(PowerShell):
```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/bytedance/flowgram.ai.git "$env:TEMP/flowgram-ref"
git -C "$env:TEMP/flowgram-ref" sparse-checkout set apps/demo-free-layout/src
```
Expected: `apps/demo-free-layout/src` 目录树下载完成。

- [ ] **Step 2: 拷贝 src 到项目页面目录**

Run:
```bash
New-Item -ItemType Directory -Force D:/project/aoia/src/pages/flow-editor | Out-Null
Copy-Item -Recurse "$env:TEMP/flowgram-ref/apps/demo-free-layout/src/*" D:/project/aoia/src/pages/flow-editor/
```
Expected: `src/pages/flow-editor/` 下出现 `editor.tsx`、`app.tsx`、`hooks/`、`nodes/` 等全部文件。

- [ ] **Step 3: 删除不适用的 demo 配置/入口文件**

demo 的 `app.tsx` 是 `createRoot` 启动入口,Umi 自行挂载页面,不再需要(改由 Task 3 的 `index.tsx` 替代其 polyfill 职责)。保留 `editor.tsx`。

Run:
```bash
Remove-Item D:/project/aoia/src/pages/flow-editor/app.tsx
```
Expected: `app.tsx` 删除;`editor.tsx` 保留。

- [ ] **Step 4: 检查 demo 内 `workspace:*` 引用并确认无残留**

demo 源码本身不应含 `workspace:`(那是 demo 的 package.json,未拷贝);但若任何 `.ts` 内有字面 `workspace:` 引用则修正。本步为确认性检查。

Run(grep 工具):
- pattern: `workspace:`
- path: `D:/project/aoia/src/pages/flow-editor`
Expected: 无匹配(若有,逐个改为对应 `^1.0.13` 包名导入;正常情况下不会有)。

- [ ] **Step 5: 清理临时克隆**

Run: `Remove-Item -Recurse -Force "$env:TEMP/flowgram-ref"`
Expected: 临时目录删除。

- [ ] **Step 6: Commit**

```bash
git add src/pages/flow-editor/
git commit -m "feat(flow-editor): vendor flowgram demo-free-layout source"
```

---

### Task 3: 适配页面入口 index.tsx(含 React 18/19 polyfill)

**Covers:** [S2], [S5]

**Files:**
- Create: `src/pages/flow-editor/index.tsx`

**Interfaces:**
- Consumes: `src/pages/flow-editor/editor.tsx` 导出的 `Editor` 组件。
- Produces: `src/pages/flow-editor/index.tsx` default export,被 `config/routes.ts` 的 `component: './flow-editor'` 解析为页面组件。

- [ ] **Step 1: 创建入口文件**

`src/pages/flow-editor/index.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import { unstableSetCreateRoot } from '@flowgram.ai/form-materials';

import { Editor } from './editor';

// React 18/19 polyfill for form-materials (from demo app.tsx)
unstableSetCreateRoot(createRoot);

export default function FlowEditorPage() {
  return <Editor />;
}
```

- [ ] **Step 2: 确认 editor.tsx 导出名为 `Editor`**

用 grep 工具检查 `src/pages/flow-editor/editor.tsx` 存在 `export const Editor`。
Expected: 命中(demo editor.tsx 即 `export const Editor = () => {...}`)。

- [ ] **Step 3: Commit**

```bash
git add src/pages/flow-editor/index.tsx
git commit -m "feat(flow-editor): add page entry with react 18/19 polyfill"
```

---

### Task 4: 增加路由 /flow-editor

**Covers:** [S4]

**Files:**
- Modify: `config/routes.ts`

**Interfaces:**
- Consumes: `src/pages/flow-editor/index.tsx`(default export)。
- Produces: 顶级路由 `/flow-editor`,菜单名 `flow-editor`(映射 i18n `menu.flow-editor`),icon `apartment`。

- [ ] **Step 1: 在 routes 数组中加入新路由**

在 `config/routes.ts` 的 `chatbot` 路由之后(数组内,`path: '/'` redirect 之前)插入:

```ts
  {
    path: '/flow-editor',
    name: 'flow-editor',
    icon: 'apartment',
    component: './flow-editor',
  },
```

不加 `access` 字段(所有登录用户可见,与 chatbot 页面一致)。

- [ ] **Step 2: Commit**

```bash
git add config/routes.ts
git commit -m "feat(flow-editor): add /flow-editor route"
```

---

### Task 5: 增加 i18n menu.flow-editor(8 语言)

**Covers:** [S7]

**Files:**
- Modify: `src/locales/zh-CN/menu.ts`
- Modify: `src/locales/en-US/menu.ts`
- Modify: `src/locales/zh-TW/menu.ts`
- Modify: `src/locales/ja-JP/menu.ts`
- Modify: `src/locales/pt-BR/menu.ts`
- Modify: `src/locales/fa-IR/menu.ts`
- Modify: `src/locales/id-ID/menu.ts`
- Modify: `src/locales/bn-BD/menu.ts`

**Interfaces:**
- Produces: 各语言 `menu.flow-editor` 键,供 ProLayout 菜单渲染标题。

- [ ] **Step 1: 在每个 menu.ts 末尾加键**

各文件追加对应行(格式与既有 `'menu.chatbot': '...'` 一致,单引号、尾逗号):

| 文件 | 追加行 |
|---|---|
| `src/locales/zh-CN/menu.ts` | `'menu.flow-editor': '流程编辑器',` |
| `src/locales/en-US/menu.ts` | `'menu.flow-editor': 'Flow Editor',` |
| `src/locales/zh-TW/menu.ts` | `'menu.flow-editor': '流程編輯器',` |
| `src/locales/ja-JP/menu.ts` | `'menu.flow-editor': 'フローエディター',` |
| `src/locales/pt-BR/menu.ts` | `'menu.flow-editor': 'Editor de Fluxo',` |
| `src/locales/fa-IR/menu.ts` | `'menu.flow-editor': 'ویرایشگر جریان',` |
| `src/locales/id-ID/menu.ts` | `'menu.flow-editor': 'Editor Alur',` |
| `src/locales/bn-BD/menu.ts` | `'menu.flow-editor': 'ফ্লো এডিটর',` |

- [ ] **Step 2: 验证键存在**

Run(grep 工具):
- pattern: `menu\.flow-editor`
- path: `D:/project/aoia/src/locales`
Expected: 8 个文件各 1 处命中。

- [ ] **Step 3: Commit**

```bash
git add src/locales/
git commit -m "feat(flow-editor): add i18n menu.flow-editor for 8 locales"
```

---

### Task 6: 构建兼容修复(tsc + 运行时)

**Covers:** [S6], [S8]

**Files:**
- Modify: 按报错定位的 `src/pages/flow-editor/**` 文件;必要时 `config/config.ts`(utoopack 装饰器/CSS)。

**Interfaces:**
- Consumes: Task 1-5 产物。
- Produces: `npm run tsc` 通过、`npm start` 能加载 `/flow-editor` 无运行时报错。

**说明:** 本任务为迭代式修复,无法预写全部代码。以下为修复方向与验证标准,按实际报错逐项处置。

- [ ] **Step 1: 类型检查**

Run: `npm run tsc`
Expected: 初始大概率有错(demo main 与发布版 1.0.13 API 漂移、缺类型)。逐条修复:
- 若某 API 在 1.0.13 不存在/改名 → 按发布版类型修正调用(优先查 `node_modules/@flowgram.ai/<pkg>/dist/*.d.ts`)。
- 若 `@types/lodash-es`/`@types/styled-components` 缺失 → `npm i -D @types/lodash-es @types/styled-components`(React 19 用 styled-components v6 自带类型,v5 才需 @types;v6 通常不需)。
- 重复直至 `npm run tsc` 通过。

- [ ] **Step 2: dev server 运行时验证(最高风险:装饰器)**

Run: `npm start`(另开终端或后台),浏览器访问 `http://localhost:8000/flow-editor`(用 mock 账号 `admin`/`ant.design` 登录后)。
Expected 初始可能报错。重点排查:
- **装饰器**:demo `services/custom-service.ts` 若用 `@injectable()` 而 utoopack 未做 legacy decorator 转换 → 运行时 `reflect-metadata`/装饰器失效。处置二选一:
  - 方案A(优先):改写 custom-service 用 Inversify `bind(CustomService).to(CustomServiceImpl)` API,移除 `@injectable`/`@inject` 装饰器(参考 `node_modules/inversify` 用法)。
  - 方案B:在 `config/config.ts` 的 `utoopack.module.rules` 或通过 Umi 的 babel/swc 配置启用 legacy decorator(`decorators` legacy)。若 Umi Max 不便支持,回退方案A。
- **CSS 解析**:`@flowgram.ai/free-layout-editor/index.css` 与 `./styles/index.css` 须能被 utoopack 解析;若报 CSS 模块解析错,确认 `config/config.ts` 未禁用 CSS 处理。
- **styled-components v6**:若 demo 代码用了 v5 已废弃 API(如 `StyleSheetManager` prop 变更),按 v6 适配。
- 重复直至页面渲染出初始示例工作流、可拖拽/连线/缩放,无控制台报错。

- [ ] **Step 3: 验证通过标准**

- `npm run tsc` 通过(无输出/exit 0)
- `npm start` 下 `/flow-editor` 画布渲染初始节点、可拖拽、可连线、可缩放,控制台无 error

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(flow-editor): resolve tsc + runtime compat issues"
```

---

### Task 7: Lint 通过(Biome + antd lint)

**Covers:** [S6], [S8]

**Files:**
- Modify: `src/pages/flow-editor/**` 被 Biome 报错的文件。

**Interfaces:**
- Produces: `npm run lint` 与 `npx antd lint ./src` 均通过。

- [ ] **Step 1: Biome 检查**

Run: `npm run lint`(= `biome lint` + `tsc`)
Expected: Biome 对 demo(eslint 风格)代码可能报 import 顺序/未用变量/格式等。逐条修复;对纯格式问题可 `npm run biome`(auto-fix)后人工复核(注意 auto-fix 不要改坏 demo 逻辑)。
- `noExplicitAny` 已 off,any 不报。
- 若某规则在 demo 大面积冲突且非业务逻辑(如 import 排序),优先按 Biome 建议调整,而非放宽规则(保持 CLAUDE.md "lint 通过"要求)。

- [ ] **Step 2: antd lint**

Run: `npx antd lint ./src`
Expected: flow-editor 用 Semi Design 不触发 antd 专属规则;应通过。若误报,检查是否 demo 引入了 antd 组件(应无)。

- [ ] **Step 3: 验证通过标准**

- `npm run lint` exit 0
- `npx antd lint ./src` 无 error

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style(flow-editor): pass biome + antd lint"
```

---

### Task 8: 最终验证

**Covers:** [S8]

**Files:** (无,纯验证)

- [ ] **Step 1: 类型 + lint 全量**

Run: `npm run tsc` 后 `npm run lint`
Expected: 均通过。

- [ ] **Step 2: dev 实测**

Run: `npm start`,登录后访问 `/flow-editor`。
Expected:
- 菜单出现「流程编辑器」(当前语言标题)
- 画布渲染 initial-data 示例工作流
- 可拖拽节点、连线、缩放;缩略图、节点面板、侧边栏可用
- 控制台无 error

- [ ] **Step 3: (可选)切语言验证标题**

在 SettingDrawer 切到 en-US,菜单标题变「Flow Editor」。
Expected: 标题随语言切换。

- [ ] **Step 4: 无未提交改动**

Run: `git status`
Expected: clean(或仅预期改动)。如 Step 2 发现问题回到 Task 6/7 修复。

---

## Self-Review 记录

- **Spec 覆盖:** [S1]目标→前言;[S2]方案→Task2/3;[S3]依赖→Task1;[S4]路由→Task4;[S5]结构→Task2/3;[S6]构建→Task6;[S7]i18n→Task5;[S8]风险验证→Task6/7/8。全覆盖。
- **占位符:** Task6/7 为迭代修复,已给出方向、API 名称、验证标准;非占位,为调试型任务诚实表述。
- **类型一致:** `Editor` 导出名在 Task2/3 一致;路由 `component: './flow-editor'` 解析 `index.tsx` default export 一致。
