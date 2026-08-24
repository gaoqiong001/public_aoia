# Spec: 流程管理页面(流程详情 + 多版本管理 + /flow-editor 打通)

> Created: 2026-08-20
> Status: Approved (design)
> Depends on: `docs/compose/specs/2026-08-20-flow-editor-design.md`(已交付的 /flow-editor 页面)

## [S1] 目标

为已交付的流程编辑器(`/flow-editor`)新增**管理页面**:流程列表(基础信息)+ 流程详情子页(基础信息 + 版本管理 tabs)+ 与 `/flow-editor` 打通(按 flow+version 加载图、"保存为新版本")。全 mock 实现,与项目 mock 体系一致。

## [S2] 方案概览

1. 新路由 `/flow`(流程列表)+ `/flow/:id`(流程详情,基础信息 + 版本管理 tabs)
2. 列表 ProTable(name/desc/status/active 版本/版本数/更新时间);行操作:详情、编辑信息、删除;工具栏:新建流程
3. 详情 Tab1 基础信息(ProForm 编辑 name/desc/flow status);Tab2 版本管理(ProTable 版本列表)
4. 版本 `status` 字段(`active`/`inactive`)控制"启动":每流程至多一个 active;设某版本 active 时,该流程其他版本自动 inactive
5. 版本操作:查看(→ `/flow-editor?flowId=&versionId=` 加载该版本图)、启动/停用(切 status)、删除、新建版本(→ `/flow-editor?flowId=` 编辑后保存为新版本)
6. `/flow-editor` 扩展:读路由 query;有 flowId+versionId → fetch 版本 graphJson 作 `initialData`;无则用 demo `initial-data`(向后兼容)。工具栏加"保存为新版本":序列化 document → POST → 返回 /flow
7. mock:`_mock.ts` 提供流程 + 版本 CRUD,模块级内存 store

## [S3] 数据模型(mock)

```ts
Flow {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'archived';   // 流程生命周期
  activeVersionId: string | null;                // 冗余:当前 active 版本 id
  createdAt: string;
  updatedAt: string;
}

FlowVersion {
  id: string;
  flowId: string;
  version: number;                                // 自增版本号(每 flow 独立)
  status: 'active' | 'inactive';                 // active = 启动
  graphJson: object;                              // Flowgram FlowDocumentJSON
  remark: string;
  createdAt: string;
}
```

**约束**:同一 `flowId` 下至多一个 `status='active'` 的版本。设某版本 active → 该 flow 其他版本 inactive + 更新 `flow.activeVersionId`。

**mock store**:模块级内存 Map(`flowStore`, `versionStore`),预置 1 个示例流程(含 1 个 active 版本,graphJson 复用 demo `initial-data`)。

## [S4] 路由与菜单

`config/routes.ts` 新增:

```ts
{ path: '/flow', name: 'flow', icon: 'unorderedList', component: './flow/list' },
{ path: '/flow/:id', name: 'flow-detail', component: './flow/detail', hideInMenu: true },
```

- `/flow` 无 access(所有登录用户);`/flow/:id` `hideInMenu`(子页不在侧栏)
- `/flow-editor` 保留并扩展(读 query 参数,不改路由)
- 菜单文案:`menu.flow`(中"流程管理"/ 英"Flow Management")

## [S5] 页面结构(`src/pages/flow/`)

```
src/pages/flow/
├── list/
│   └── index.tsx              # ProTable 流程列表 + 新建/编辑/删除
├── detail/
│   ├── index.tsx              # PageContainer + tabs(基础信息 | 版本管理)
│   └── components/
│       ├── BasicInfo.tsx      # Tab1:基础信息 ProForm
│       └── VersionTable.tsx   # Tab2:版本 ProTable + 启动/停用/查看/删除/新建
├── components/
│   └── FlowForm.tsx           # 新建/编辑流程基础信息(ModalForm)
├── service.ts                 # mock API 调用(request)
├── _mock.ts                   # 流程 + 版本 CRUD handlers
└── data.d.ts                  # API.FlowItem / API.FlowVersionItem
```

## [S6] /flow-editor 打通

### 加载版本图
- `src/pages/flow-editor/index.tsx`:读 `useSearchParams` 的 `flowId` + `versionId`
  - 有 → `GET /api/flow/{flowId}/version/{versionId}` 取 graphJson,作为 `<Editor initialData={graphJson} />`
  - 无 → 保持现状(用 demo `initial-data`)
- `src/pages/flow-editor/editor.tsx`(vendored,最小改动):接受可选 `initialData` prop;未传则回退到 demo `initial-data`

### 保存为新版本
- 编辑器工具栏加"保存为新版本"按钮(ProForm ModalForm 输入 remark)
- 序列化当前 document:用 `@flowgram.ai/export-plugin` 或 `ctx.document.toJSON()`(具体 API 在 plan 阶段核实)
- `POST /api/flow/{flowId}/version`(body: { graphJson, remark })→ 服务端自增 version、置 inactive、返回新版本
- 成功后 `history.push('/flow/' + flowId)` 回详情页

## [S7] i18n

`src/locales/<locale>/menu.ts` 加 `menu.flow`(8 语言,复用 `menu.editor.flow` 译文风格);列表/表单/抽屉文案用 `useIntl().formatMessage`。

| 文件 | 键 | 值(zh-CN) |
|---|---|---|
| `zh-CN/menu.ts` | `menu.flow` | `'流程管理'` |
| `en-US/menu.ts` | `menu.flow` | `'Flow Management'` |
| (其余 6 语言) | `menu.flow` | 对应译文 |

## [S8] 风险与验证

| 风险 | 处置 | 验证 |
|---|---|---|
| Flowgram document 序列化 API 不确定(export-plugin / toJSON) | plan 阶段读 `node_modules/@flowgram.ai/export-plugin` + `useEditorProps` 的 ctx API 核实 | "保存为新版本"能取到 graphJson 并 reload 后还原 |
| editor.tsx 接受 initialData prop 的最小改动 | 改 `editor.tsx` 签名,默认回退 demo initial-data | 无 flowId 时 /flow-editor 行为不变 |
| mock 内存 store 跨请求持久 | 模块级 Map(dev server 单进程内持久) | 列表 CRUD 后刷新仍可见 |
| 版本 active 唯一约束 | mock handler 在设 active 时同步置其他 inactive | 同 flow 不会出现两个 active |

**验证命令**: `npm run tsc`、`npm run lint`、`npm run build`;dev 端到端:新建流程 → 进详情 → 版本管理 → 查看版本(编辑器加载)→ 编辑 → 保存为新版本 → 启动该版本 → 列表可见 active 版本切换。

## [S9] 实现任务划分(供 compose:plan 展开)

1. 数据模型 + mock(_mock.ts + service.ts + data.d.ts,含示例数据)
2. 路由 + i18n menu.flow
3. 列表页 list/index.tsx(ProTable + 新建/编辑/删除 FlowForm)
4. 详情页 detail/index.tsx(tabs 容器)+ BasicInfo.tsx
5. 版本管理 VersionTable.tsx(列表 + 启动/停用/查看/删除/新建入口)
6. /flow-editor 加载版本图(editor.tsx 接受 initialData prop + index.tsx 读 query fetch)
7. /flow-editor "保存为新版本"按钮(序列化 + POST + 跳回)
8. 全量验证(tsc/lint/build/dev 端到端)
