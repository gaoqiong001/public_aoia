# Spec: 新增「流程编辑器」菜单页面(集成 Flowgram + Semi Design)

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/flow-editor.md)

> Created: 2026-08-20
> Status: Approved (design)
> Source reference: https://flowgram.ai/examples/free-layout/free-feature-overview.md
> Demo source: https://github.com/bytedance/flowgram.ai/tree/main/apps/demo-free-layout

## [S1] 目标与背景

在 Ant Design Pro (aoia) 项目中新增一个菜单页面,集成 Flowgram.ai 官方 `free-layout` 可视化节点流程编辑器,提供**完整 demo 体验**:拖拽节点、连线、缩放、缩略图、节点添加面板、侧边栏、右键菜单、变量面板、测试运行、快捷键等。

节点/面板/表单 UI 使用 **Semi Design**(@douyinfe/semi-ui),即直接拷贝官方 demo 源码,不重写为 antd。理由:完整 antd 重写工作量过大(13 种节点 + testrun + 变量面板 + 侧边栏等几十个组件),用户确认先用 Semi Design 跑通完整体验。

## [S2] 方案概览

1. 安装 Flowgram 引擎包(`^1.0.13`)+ Semi Design(`^2.102`)+ styled-components(`^6.5`,React 19 兼容)等依赖
2. 拷贝 Flowgram `apps/demo-free-layout/src` → `src/pages/flow-editor/`
3. 适配入口:demo 的 `editor.tsx` 作为页面组件;demo `app.tsx` 的 `unstableSetCreateRoot(createRoot)` polyfill 移入页面初始化(React 18/19 兼容)
4. `config/routes.ts` 增加路由 `/flow-editor`,菜单名 `flow-editor`,icon `apartment`
5. i18n 增加 `menu.flow-editor` 文案(各语言)
6. 处理构建兼容(decorator/CSS/Less),通过 Biome + tsc + antd lint 验证

入口组件(demo `editor.tsx`)结构:

```tsx
import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import { EditorRenderer, FreeLayoutEditorProvider } from '@flowgram.ai/free-layout-editor';
import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import { nodeRegistries } from './nodes';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';

export const Editor = () => {
  const editorProps = useEditorProps(initialData, nodeRegistries);
  return (
    <div className="doc-free-feature-overview">
      <FreeLayoutEditorProvider {...editorProps}>
        <div className="demo-container">
          <DockedPanelLayer>
            <EditorRenderer className="demo-editor" />
          </DockedPanelLayer>
        </div>
      </FreeLayoutEditorProvider>
    </div>
  );
};
```

React 18/19 polyfill(demo `app.tsx`):

```tsx
import { createRoot } from 'react-dom/client';
import { unstableSetCreateRoot } from '@flowgram.ai/form-materials';
unstableSetCreateRoot(createRoot); // 移入 flow-editor 页面初始化
```

## [S3] 新增依赖

`package.json` → `dependencies` 新增:

**Flowgram 引擎(均 `^1.0.13`,peer `react >= 16.8` 兼容 React 19):**
- `@flowgram.ai/free-layout-editor`
- `@flowgram.ai/free-snap-plugin`
- `@flowgram.ai/free-lines-plugin`
- `@flowgram.ai/free-node-panel-plugin`
- `@flowgram.ai/minimap-plugin`
- `@flowgram.ai/free-container-plugin`
- `@flowgram.ai/free-group-plugin`
- `@flowgram.ai/panel-manager-plugin`
- `@flowgram.ai/free-stack-plugin`
- `@flowgram.ai/runtime-interface`
- `@flowgram.ai/runtime-js`
- `@flowgram.ai/form-materials`
- `@flowgram.ai/export-plugin`

**Semi Design(节点 UI):**
- `@douyinfe/semi-ui`(`^2.102`,peer `react >= 16.0.0`)
- `@douyinfe/semi-icons`

**其他:**
- `styled-components`(`^6.5`;demo 原用 v5,改 v6 以兼容 React 19)
- `lodash-es`
- `nanoid`
- `classnames`(demo 用 classnames;项目现有 `clsx`,但保持 demo 原样)

## [S4] 路由与菜单

`config/routes.ts` 新增顶级路由(参照 chatbot 页面风格,放在 chatbot 之前或之后):

```ts
{
  path: '/flow-editor',
  name: 'flow-editor',
  icon: 'apartment',
  component: './flow-editor',
},
```

- 不加 `access` 字段 → 所有登录用户可见(与 chatbot 页面一致)
- 路由 `name: 'flow-editor'` → 映射 i18n key `menu.flow-editor`

## [S5] 页面结构与文件

`src/pages/flow-editor/` 下拷贝 demo 全部源码(来源 `apps/demo-free-layout/src`):

```
src/pages/flow-editor/
├── index.tsx              # 页面入口:导出 Editor + unstableSetCreateRoot polyfill
├── editor.tsx             # 编辑器主组件(FreeLayoutEditorProvider + EditorRenderer)
├── initial-data.ts         # 初始示例工作流(保留 demo 样例,非空画布)
├── hooks/                  # useEditorProps 等
├── nodes/                  # 13 种节点注册(start/end/llm/http/code/variable/condition/loop/block-start/block-end/comment/continue/break)
├── components/             # base-node/node-panel/sidebar/testrun/... (Semi 实现)
├── plugins/                # context-menu/runtime/variable-panel 插件
├── shortcuts/              # 快捷键系统
├── services/               # 自定义服务(Inversify bind)
├── form-components/        # 表单组件(form-content/header/inputs/item/feedback)
├── context/                # React Context
├── utils/
├── typings/
├── assets/
└── styles/                 # index.css 等
```

拷贝时需将 `workspace:*` 依赖引用改为已发布的 `^1.0.13`。demo 自带的 `rsbuild.config.ts`、`tsconfig.json`、`eslint.config.js` 不拷贝(适配 Umi/utoopack 与 Biome)。

## [S6] 构建适配

- **decorator**:tsconfig 已有 `experimentalDecorators: true`(tsc 层 OK)。demo 原 Rsbuild 配 `decorators: { version: 'legacy' }`(SWC/Babel legacy transform)。需验证 utoopack 对 demo app 内 `@injectable`/`@inject` 装饰器的运行时转换。**最高风险点**:若转换缺失,自定义服务(services/custom-service)运行时报错 → 处置:改用 Inversify `bind(X).to(...)` API 避免装饰器,或在 utoopack 配置中启用 legacy decorator 转换。
- **CSS**:flowgram 包自带 `index.css`(node_modules 内)、demo `styles/index.css` 拷贝;utoopack 需能解析 node_modules 内 CSS 导入(Less 已支持,CSS 默认支持)。
- **Less**:demo 用 Less + styled-components + CSS 变量;Umi/utoopack 支持 Less。
- **Biome**:`biome.json` 仅忽略 `src/services`(自动生成)等,`src/pages/flow-editor` 会被 lint。demo 为 eslint 风格,可能触发 Biome `recommended` 规则(如 import 顺序、any 等;`noExplicitAny` 已 off)。需少量调整以通过 `npm run lint`;若 demo 风格冲突过大,评估是否对 flow-editor 子目录放宽特定规则(但 CLAUDE.md 要求 lint 通过,优先调整代码)。

## [S7] i18n

各语言的 `<locale>/menu.ts` 文件(已确认存在,格式为 `'menu.xxx': '值',`,如 `'menu.chatbot': 'AI 助手'`)新增 `menu.flow-editor` 键:

| 文件 | 键 | 值 |
|---|---|---|
| `zh-CN/menu.ts` | `menu.flow-editor` | `'流程编辑器'` |
| `en-US/menu.ts` | `menu.flow-editor` | `'Flow Editor'` |
| `zh-TW/menu.ts` | `menu.flow-editor` | `'流程編輯器'` |
| `ja-JP/menu.ts` | `menu.flow-editor` | `'フローエディター'` |
| `pt-BR/menu.ts` | `menu.flow-editor` | `'Editor de Fluxo'` |
| `fa-IR/menu.ts` | `menu.flow-editor` | `'ویرایشگر جریان'` |
| `id-ID/menu.ts` | `menu.flow-editor` | `'Editor Alur'` |
| `bn-BD/menu.ts` | `menu.flow-editor` | `'ফ্লো এডিটর'` |

## [S8] 风险与验证

| 风险 | 等级 | 处置 | 验证 |
|---|---|---|---|
| utoopack 不转换 demo app 内装饰器 | 高 | bind API 替代 / 启用 legacy decorator | `npm start` 打开 `/flow-editor` 无运行时报错,节点/面板可交互 |
| Semi Design 与 antd 样式冲突 | 中 | 检查 antd 全局 CSS 是否覆盖 Semi;必要时加作用域隔离 | Semi 组件样式渲染正常 |
| Biome lint demo 代码报错 | 中 | 少量调整 demo 代码风格 | `npm run lint` 通过 |
| styled-components v5→v6 API 差异 | 低 | v6 对 v5 多为兼容;遇 deprecated API 适配 | 页面渲染正常 |
| `@/*` 路径别名与 demo 相对导入 | 低 | 拷贝后保持相对导入,不改 `@/` | tsc 通过 |

**验证命令:**
1. `npm run tsc` — 类型检查通过
2. `npm run lint` — Biome + tsc 通过
3. `npm start` — dev server 启动,访问 `/flow-editor`:
   - 画布渲染初始示例工作流
   - 可拖拽节点、连线、缩放
   - 缩略图、节点面板、侧边栏可用
   - 无控制台报错

## [S9] 实现任务划分(供 compose:plan 展开)

1. 安装依赖(package.json + npm install)
2. 拷贝 demo 源码到 `src/pages/flow-editor/`,修正 `workspace:*` → `^1.0.13`
3. 适配入口:index.tsx(editor + polyfill),移除 demo rsbuild/tsconfig/eslint 配置
4. 增加路由 `config/routes.ts`
5. 增加 i18n `menu.flow-editor`(8 语言)
6. 构建兼容验证:decorator/CSS/Less,修复运行时问题
7. Biome lint 修复
8. 全量验证:tsc + lint + dev 打开页面
