# 流程管理页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 /flow-editor 新增流程管理:流程列表(`/flow`)+ 流程详情子页(基础信息 + 版本管理 tabs,版本 status 控制启动)+ /flow-editor 打通(按 flow+version 加载图、保存为新版本),全 mock。

**Architecture:** 新建 `src/pages/flow/`(list + detail + components + service + _mock + data.d.ts),走 antd pro ProTable/ProForm/mock 标准模式。`/flow-editor` 的 `editor.tsx`(vendored)最小改动:接受可选 `initialData` 与 `onSave` 两个 prop;`index.tsx` 读路由 query 决定加载版本图或用 demo initial-data,并提供 onSave 回调(序列化 `ctx.document.toJSON()` → POST → 跳回详情)。

**Tech Stack:** Umi Max 4 · antd 6 / ProComponents 3 · @umijs/max request · mock(`src/pages/**/_mock.ts`)· Flowgram `useClientContext()`+`ctx.document.toJSON()`

## Global Constraints

- 全 mock 实现,无真实后端;mock 在 `src/pages/**/_mock.ts`(`config/config.ts` 已 `mock.include`),Express 风格 handler,模块级内存 store 跨请求持久(dev 单进程)
- 版本 `status: 'active'|'inactive'`,**同一 flow 至多一个 active**;设 active 时同步置其他 inactive + 更新 `flow.activeVersionId`
- 手动快照:版本不可变;"保存为新版本"才产生新版本;编辑器不 auto-save 到版本
- `src/pages/flow/` **受 Biome + tsc 约束**(未排除);`src/pages/flow-editor/` 仍排除
- Biome only;`npm run lint` + `npx antd lint ./src` 提交前过;Conventional commits;`package-lock.json`(npm)
- 序列化 API(已核实):`useClientContext()`(from `@flowgram.ai/free-layout-editor`)取 `FreeLayoutPluginContext`;`ctx.document.toJSON()` 返回 `FlowDocumentJSON`(demo `useEditorProps` line 235 即用此)

## File Structure

**Create** `src/pages/flow/`:
- `data.d.ts` — `API.FlowItem`、`API.FlowVersionItem` 类型
- `_mock.ts` — 流程 + 版本 CRUD handlers + 模块级 store + 示例数据
- `service.ts` — `request` 封装(list/get/create/update/delete flow;list/create/delete/activate version;get version graph)
- `list/index.tsx` — ProTable 流程列表 + FlowForm(ModalForm 新建/编辑)+ 删除
- `components/FlowForm.tsx` — 基础信息表单(name/desc/status)
- `detail/index.tsx` — PageContainer + tabs 容器(基础信息 | 版本管理)
- `detail/components/BasicInfo.tsx` — Tab1 基础信息 ProForm
- `detail/components/VersionTable.tsx` — Tab2 版本 ProTable + 启动/停用/查看/删除/新建入口

**Modify**:
- `config/routes.ts` — 加 `/flow` 与 `/flow/:id` 路由
- `src/locales/<8>/menu.ts` — 加 `menu.flow`
- `src/pages/flow-editor/editor.tsx` — 接受 `initialData?` 与 `onSave?` prop(vendored 最小改动)
- `src/pages/flow-editor/index.tsx` — 读 query、fetch 版本图、传 `initialData` 与 `onSave`

**Test**: 项目页面无单测约定;验证以 `npm run tsc`/`lint`/`build` + dev 端到端为准。

---

### Task 1: 数据模型 + mock + service + data.d.ts

**Covers:** [S3], [S5]

**Files:**
- Create: `src/pages/flow/data.d.ts`
- Create: `src/pages/flow/_mock.ts`
- Create: `src/pages/flow/service.ts`

**Interfaces:**
- Produces: `API.FlowItem`、`API.FlowVersionItem` 类型;mock 端点;`service.ts` 函数 `getFlowList/createFlow/updateFlow/deleteFlow/getFlowDetail/getVersionList/createVersion/deleteVersion/activateVersion/getVersionGraph`。

- [ ] **Step 1: data.d.ts**

`src/pages/flow/data.d.ts`:

```ts
declare namespace API {
  type FlowStatus = 'draft' | 'published' | 'archived';
  type VersionStatus = 'active' | 'inactive';

  interface FlowItem {
    id: string;
    name: string;
    description: string;
    status: FlowStatus;
    activeVersionId: string | null;
    versionCount: number;
    createdAt: string;
    updatedAt: string;
  }

  interface FlowVersionItem {
    id: string;
    flowId: string;
    version: number;
    status: VersionStatus;
    remark: string;
    createdAt: string;
  }

  interface FlowVersionGraph {
    id: string;
    flowId: string;
    version: number;
    status: VersionStatus;
    remark: string;
    createdAt: string;
    graphJson: Record<string, any>;
  }
}
```

- [ ] **Step 2: _mock.ts(模块级 store + handlers + 示例数据)**

`src/pages/flow/_mock.ts`:

```ts
import type { FlowDocumentJSON } from '@/pages/flow-editor/typings';

interface FlowRecord {
  id: string;
  name: string;
  description: string;
  status: API.FlowStatus;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}
interface VersionRecord {
  id: string;
  flowId: string;
  version: number;
  status: API.VersionStatus;
  remark: string;
  graphJson: Record<string, any>;
  createdAt: string;
}

// module-level in-memory store (persists across requests within one dev process)
const flows = new Map<string, FlowRecord>();
const versions = new Map<string, VersionRecord>();

// seed: one sample flow with one active version (reuse demo initial-data)
let seedData: FlowDocumentJSON;
try {
  // lazy require to avoid breaking if typings path differs
  seedData = require('@/pages/flow-editor/initial-data').initialData;
} catch {
  seedData = { nodes: [] } as any;
}
const now = () => new Date().toISOString();
const sid = () => Math.random().toString(36).slice(2, 10);

const f1 = 'flow-seed-1';
const v1 = 'ver-seed-1';
flows.set(f1, {
  id: f1,
  name: '示例流程',
  description: '由 Flowgram demo 初始数据生成的示例流程',
  status: 'published',
  activeVersionId: v1,
  createdAt: now(),
  updatedAt: now(),
});
versions.set(v1, {
  id: v1,
  flowId: f1,
  version: 1,
  status: 'active',
  remark: '初始版本',
  graphJson: seedData as any,
  createdAt: now(),
});

function nextVersion(flowId: string): number {
  let max = 0;
  for (const v of versions.values()) {
    if (v.flowId === flowId && v.version > max) max = v.version;
  }
  return max + 1;
}

export default {
  // ---- flow CRUD ----
  'GET /api/flow': (req: any, res: any) => {
    const list = Array.from(flows.values()).map((f) => ({
      ...f,
      versionCount: Array.from(versions.values()).filter((v) => v.flowId === f.id).length,
    }));
    res.json({ data: list, success: true });
  },
  'GET /api/flow/:id': (req: any, res: any) => {
    const f = flows.get(req.params.id);
    if (!f) return res.json({ success: false, errorMessage: 'flow not found' });
    res.json({ data: { ...f, versionCount: 0 }, success: true });
  },
  'POST /api/flow': (req: any, res: any) => {
    const { body } = req;
    const id = sid();
    const rec: FlowRecord = {
      id,
      name: body.name,
      description: body.description || '',
      status: body.status || 'draft',
      activeVersionId: null,
      createdAt: now(),
      updatedAt: now(),
    };
    flows.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/flow/:id': (req: any, res: any) => {
    const f = flows.get(req.params.id);
    if (!f) return res.json({ success: false, errorMessage: 'flow not found' });
    const { body } = req;
    Object.assign(f, body, { updatedAt: now() });
    res.json({ data: f, success: true });
  },
  'DELETE /api/flow/:id': (req: any, res: any) => {
    const id = req.params.id;
    flows.delete(id);
    for (const [vid, v] of versions) {
      if (v.flowId === id) versions.delete(vid);
    }
    res.json({ success: true });
  },
  // ---- version ----
  'GET /api/flow/:id/version': (req: any, res: any) => {
    const list = Array.from(versions.values())
      .filter((v) => v.flowId === req.params.id)
      .map((v) => ({ id: v.id, flowId: v.flowId, version: v.version, status: v.status, remark: v.remark, createdAt: v.createdAt }))
      .sort((a, b) => b.version - a.version);
    res.json({ data: list, success: true });
  },
  'GET /api/flow/:id/version/:vid': (req: any, res: any) => {
    const v = versions.get(req.params.vid);
    if (!v) return res.json({ success: false, errorMessage: 'version not found' });
    res.json({ data: { ...v }, success: true });
  },
  'POST /api/flow/:id/version': (req: any, res: any) => {
    const fid = req.params.id;
    const f = flows.get(fid);
    if (!f) return res.json({ success: false, errorMessage: 'flow not found' });
    const { body } = req;
    const id = sid();
    const ver = nextVersion(fid);
    const rec: VersionRecord = {
      id,
      flowId: fid,
      version: ver,
      status: 'inactive',
      remark: body.remark || `v${ver}`,
      graphJson: body.graphJson || { nodes: [] },
      createdAt: now(),
    };
    versions.set(id, rec);
    f.updatedAt = now();
    res.json({ data: { id, flowId: fid, version: ver, status: 'inactive', remark: rec.remark, createdAt: rec.createdAt }, success: true });
  },
  'DELETE /api/flow/:id/version/:vid': (req: any, res: any) => {
    const v = versions.get(req.params.vid);
    if (!v) return res.json({ success: false, errorMessage: 'version not found' });
    versions.delete(req.params.vid);
    const f = flows.get(req.params.id);
    if (f && f.activeVersionId === req.params.vid) f.activeVersionId = null;
    res.json({ success: true });
  },
  'POST /api/flow/:id/version/:vid/activate': (req: any, res: any) => {
    const fid = req.params.id;
    const f = flows.get(fid);
    if (!f) return res.json({ success: false, errorMessage: 'flow not found' });
    for (const v of versions.values()) {
      if (v.flowId === fid) v.status = v.id === req.params.vid ? 'active' : 'inactive';
    }
    f.activeVersionId = req.params.vid;
    f.updatedAt = now();
    res.json({ success: true });
  },
};
```

- [ ] **Step 3: service.ts**

`src/pages/flow/service.ts`:

```ts
import { request } from '@umijs/max';

export async function getFlowList() {
  return request<API.FlowItem[]>('/api/flow');
}
export async function getFlowDetail(id: string) {
  return request<API.FlowItem>(`/api/flow/${id}`);
}
export async function createFlow(data: Partial<API.FlowItem>) {
  return request<API.FlowItem>('/api/flow', { method: 'POST', data });
}
export async function updateFlow(id: string, data: Partial<API.FlowItem>) {
  return request<API.FlowItem>(`/api/flow/${id}`, { method: 'PUT', data });
}
export async function deleteFlow(id: string) {
  return request(`/api/flow/${id}`, { method: 'DELETE' });
}

export async function getVersionList(flowId: string) {
  return request<API.FlowVersionItem[]>(`/api/flow/${flowId}/version`);
}
export async function getVersionGraph(flowId: string, vid: string) {
  return request<API.FlowVersionGraph>(`/api/flow/${flowId}/version/${vid}`);
}
export async function createVersion(flowId: string, data: { graphJson: any; remark?: string }) {
  return request<API.FlowVersionItem>(`/api/flow/${flowId}/version`, { method: 'POST', data });
}
export async function deleteVersion(flowId: string, vid: string) {
  return request(`/api/flow/${flowId}/version/${vid}`, { method: 'DELETE' });
}
export async function activateVersion(flowId: string, vid: string) {
  return request(`/api/flow/${flowId}/version/${vid}/activate`, { method: 'POST' });
}
```

- [ ] **Step 4: 验证 tsc 通过(类型)**

Run: `npm.cmd run tsc`
Expected: exit 0(data.d.ts / service 引用类型正确)。

- [ ] **Step 5: Commit**

```bash
git add src/pages/flow/data.d.ts src/pages/flow/_mock.ts src/pages/flow/service.ts
git commit -m "feat(flow-mgmt): add flow/version data model, mock handlers, service"
```

---

### Task 2: 路由 + i18n menu.flow

**Covers:** [S4], [S7]

**Files:**
- Modify: `config/routes.ts`(在 `/flow-editor` 后加 `/flow` 与 `/flow/:id`)
- Modify: 8 个 `src/locales/<locale>/menu.ts`

- [ ] **Step 1: routes.ts**

在 `config/routes.ts` 的 `/flow-editor` 路由块之后插入:

```ts
  {
    path: '/flow',
    name: 'flow',
    icon: 'unorderedList',
    component: './flow/list',
  },
  {
    path: '/flow/:id',
    name: 'flow-detail',
    component: './flow/detail',
    hideInMenu: true,
  },
```

- [ ] **Step 2: i18n menu.flow(8 语言)**

各 `src/locales/<locale>/menu.ts` 在 `menu.flow-editor` 行后加 `menu.flow`:

| 文件 | 追加 |
|---|---|
| `zh-CN/menu.ts` | `'menu.flow': '流程管理',` |
| `en-US/menu.ts` | `'menu.flow': 'Flow Management',` |
| `zh-TW/menu.ts` | `'menu.flow': '流程管理',` |
| `ja-JP/menu.ts` | `'menu.flow': 'フロー管理',` |
| `pt-BR/menu.ts` | `'menu.flow': 'Gerenciamento de Fluxo',` |
| `fa-IR/menu.ts` | `'menu.flow': 'مدیریت جریان',` |
| `id-ID/menu.ts` | `'menu.flow': 'Manajemen Alur',` |
| `bn-BD/menu.ts` | `'menu.flow': 'ফ্লো ম্যানেজমেন্ট',` |

- [ ] **Step 3: 验证**

Run(grep): pattern `menu\.flow` path `src/locales` → 8 命中。
Run: `npm.cmd run tsc` → exit 0。

- [ ] **Step 4: Commit**

```bash
git add config/routes.ts src/locales
git commit -m "feat(flow-mgmt): add /flow routes and i18n menu.flow"
```

---

### Task 3: 列表页 list/index.tsx + FlowForm

**Covers:** [S2], [S5]

**Files:**
- Create: `src/pages/flow/components/FlowForm.tsx`
- Create: `src/pages/flow/list/index.tsx`

**Interfaces:**
- Consumes: Task1 service(`getFlowList/createFlow/updateFlow/deleteFlow`)。
- Produces: `/flow` 页面(ProTable + 新建/编辑/删除);行"详情"按钮跳 `/flow/:id`。

- [ ] **Step 1: FlowForm.tsx(ModalForm 新建/编辑)**

`src/pages/flow/components/FlowForm.tsx`:

```tsx
import { ModalForm, ProFormText, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { createFlow, updateFlow } from '../service';

export interface FlowFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: API.FlowItem;
  onSuccess?: () => void;
}

export default function FlowForm(props: FlowFormProps) {
  const { open, onOpenChange, record, onSuccess } = props;
  const isEdit = !!record;
  return (
    <ModalForm<API.FlowItem>
      title={isEdit ? '编辑流程' : '新建流程'}
      open={open}
      onOpenChange={onOpenChange}
      initialValues={record ? { name: record.name, description: record.description, status: record.status } : { status: 'draft' }}
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) {
          await updateFlow(record.id, values);
        } else {
          await createFlow(values);
        }
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText name="name" label="流程名称" rules={[{ required: true, message: '请输入名称' }]} />
      <ProFormTextArea name="description" label="描述" />
      <ProFormSelect
        name="status"
        label="状态"
        options={[
          { label: '草稿', value: 'draft' },
          { label: '已发布', value: 'published' },
          { label: '已归档', value: 'archived' },
        ]}
      />
    </ModalForm>
  );
}
```

- [ ] **Step 2: list/index.tsx(ProTable)**

`src/pages/flow/list/index.tsx`:

```tsx
import { PageContainer } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import ProTable from '@ant-design/pro-components';
import { Button, Popconfirm, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { history } from '@umijs/max';
import { deleteFlow, getFlowList } from '../service';
import FlowForm from '../components/FlowForm';

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  published: { text: '已发布', color: 'success' },
  archived: { text: '已归档', color: 'warning' },
};

export default function FlowList() {
  const actionRef = useRef<ActionType>();
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.FlowItem>();

  const columns: ProColumns<API.FlowItem>[] = [
    { title: '名称', dataIndex: 'name', render: (_, r) => <a onClick={() => history.push(`/flow/${r.id}`)}>{r.name}</a> },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '状态', dataIndex: 'status', render: (_, r) => <span>{statusMap[r.status]?.text || r.status}</span> },
    { title: '版本数', dataIndex: 'versionCount' },
    { title: '更新时间', dataIndex: 'updatedAt' },
    {
      title: '操作',
      render: (_, r) => [
        <a key="detail" onClick={() => history.push(`/flow/${r.id}`)}>详情</a>,
        <a key="edit" onClick={() => { setCurrent(r); setFormOpen(true); }}>编辑</a>,
        <Popconfirm key="del" title="确认删除?" onConfirm={async () => { await deleteFlow(r.id); message.success('已删除'); actionRef.current?.reload(); }}>
          <a>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.FlowItem>
        actionRef={actionRef}
        rowKey="id"
        search={false}
        request={async () => { const data = await getFlowList(); return { data, success: true }; }}
        columns={columns}
        toolBarRender={() => [
          <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => { setCurrent(undefined); setFormOpen(true); }}>新建流程</Button>,
        ]}
      />
      <FlowForm open={formOpen} onOpenChange={setFormOpen} record={current} onSuccess={() => { setFormOpen(false); actionRef.current?.reload(); }} />
    </PageContainer>
  );
}
```

- [ ] **Step 3: 验证 tsc**

Run: `npm.cmd run tsc` → exit 0。

- [ ] **Step 4: Commit**

```bash
git add src/pages/flow/list src/pages/flow/components/FlowForm.tsx
git commit -m "feat(flow-mgmt): add flow list page with create/edit/delete"
```

---

### Task 4: 详情页 detail/index.tsx(tabs)+ BasicInfo.tsx

**Covers:** [S2], [S5]

**Files:**
- Create: `src/pages/flow/detail/index.tsx`
- Create: `src/pages/flow/detail/components/BasicInfo.tsx`

**Interfaces:**
- Consumes: Task1 service(`getFlowDetail/updateFlow`)。
- Produces: `/flow/:id` 页面(PageContainer + tabs);Tab1 BasicInfo。

- [ ] **Step 1: BasicInfo.tsx(ProForm 基础信息编辑)**

`src/pages/flow/detail/components/BasicInfo.tsx`:

```tsx
import { ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { Card, message } from 'antd';
import { updateFlow } from '../../service';

export default function BasicInfo({ flow }: { flow?: API.FlowItem }) {
  if (!flow) return null;
  return (
    <Card>
      <ProForm<API.FlowItem>
        initialValues={flow}
        onFinish={async (values) => { await updateFlow(flow.id, values); message.success('已保存'); return true; }}
        submitter={{ searchConfig: { submitText: '保存' } }}
      >
        <ProFormText name="name" label="流程名称" rules={[{ required: true }]} />
        <ProFormTextArea name="description" label="描述" />
        <ProFormSelect name="status" label="状态" options={[{ label: '草稿', value: 'draft' }, { label: '已发布', value: 'published' }, { label: '已归档', value: 'archived' }]} />
      </ProForm>
    </Card>
  );
}
```

- [ ] **Step 2: detail/index.tsx(tabs 容器)**

`src/pages/flow/detail/index.tsx`:

```tsx
import { PageContainer } from '@ant-design/pro-components';
import { useEffect, useState } from 'react';
import { useParams } from '@umijs/max';
import { getFlowDetail } from '../service';
import BasicInfo from './components/BasicInfo';
import VersionTable from './components/VersionTable';

export default function FlowDetail() {
  const params = useParams<{ id: string }>();
  const [flow, setFlow] = useState<API.FlowItem>();
  const [tab, setTab] = useState('basic');

  useEffect(() => {
    if (!params.id) return;
    getFlowDetail(params.id).then(setFlow);
  }, [params.id]);

  return (
    <PageContainer
      onTabChange={(key) => setTab(key as string)}
      tabList={[
        { tab: '流程基础信息', key: 'basic' },
        { tab: '版本管理', key: 'version' },
      ]}
    >
      {tab === 'basic' ? <BasicInfo flow={flow} /> : <VersionTable flowId={params.id!} />}
    </PageContainer>
  );
}
```

- [ ] **Step 3: 验证 tsc**

Run: `npm.cmd run tsc` → 可能因 VersionTable 未建而报错(下一 Task 建)。本步 tsc 暂可跳过,Task5 后统一验证。

- [ ] **Step 4: Commit**

```bash
git add src/pages/flow/detail/index.tsx src/pages/flow/detail/components/BasicInfo.tsx
git commit -m "feat(flow-mgmt): add flow detail page with tabs and basic info"
```

---

### Task 5: 版本管理 VersionTable.tsx

**Covers:** [S2], [S3], [S5]

**Files:**
- Create: `src/pages/flow/detail/components/VersionTable.tsx`

**Interfaces:**
- Consumes: Task1 service(`getVersionList/deleteVersion/activateVersion`)。
- Produces: Tab2 版本 ProTable(启动/停用/查看/删除/新建入口)。"查看"跳 `/flow-editor?flowId=&versionId=`;"新建版本"跳 `/flow-editor?flowId=`。

- [ ] **Step 1: VersionTable.tsx**

`src/pages/flow/detail/components/VersionTable.tsx`:

```tsx
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Popconfirm, Tag, message } from 'antd';
import { useRef } from 'react';
import { history } from '@umijs/max';
import { activateVersion, deleteVersion, getVersionList } from '../../service';

export default function VersionTable({ flowId }: { flowId: string }) {
  const actionRef = useRef<any>();

  const columns: ProColumns<API.FlowVersionItem>[] = [
    { title: '版本号', dataIndex: 'version', render: (_, r) => `v${r.version}` },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, r) => (r.status === 'active' ? <Tag color="success">启动</Tag> : <Tag>未启动</Tag>),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      render: (_, r) => [
        <a key="view" onClick={() => history.push(`/flow-editor?flowId=${flowId}&versionId=${r.id}`)}>查看</a>,
        r.status === 'active' ? (
          <span key="active" style={{ color: '#999' }}>已启动</span>
        ) : (
          <Popconfirm key="act" title="设为启动版本?" onConfirm={async () => { await activateVersion(flowId, r.id); message.success('已设为启动'); actionRef.current?.reload(); }}>
            <a>启动</a>
          </Popconfirm>
        ),
        <Popconfirm key="del" title="确认删除该版本?" onConfirm={async () => { await deleteVersion(flowId, r.id); message.success('已删除'); actionRef.current?.reload(); }}>
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<API.FlowVersionItem>
      actionRef={actionRef}
      rowKey="id"
      search={false}
      toolBarRender={() => [
        <Button key="new" type="primary" onClick={() => history.push(`/flow-editor?flowId=${flowId}`)}>新建版本</Button>,
      ]}
      request={async () => { const data = await getVersionList(flowId); return { data, success: true }; }}
      columns={columns}
    />
  );
}
```

- [ ] **Step 2: 验证 tsc + lint**

Run: `npm.cmd run tsc` → exit 0。
Run: `npm.cmd run lint` → exit 0。

- [ ] **Step 3: Commit**

```bash
git add src/pages/flow/detail/components/VersionTable.tsx
git commit -m "feat(flow-mgmt): add version table with activate/view/delete"
```

---

### Task 6: /flow-editor 加载版本图

**Covers:** [S6]

**Files:**
- Modify: `src/pages/flow-editor/editor.tsx`(接受 `initialData?` prop)
- Modify: `src/pages/flow-editor/index.tsx`(读 query、fetch 版本图、传 initialData)

**Interfaces:**
- Consumes: Task1 service(`getVersionGraph`)。
- Produces: `/flow-editor?flowId=&versionId=` 加载该版本 graphJson;无 query 时行为不变。

- [ ] **Step 1: editor.tsx 接受 initialData prop**

`src/pages/flow-editor/editor.tsx` 改为:

```tsx
import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import { EditorRenderer, FreeLayoutEditorProvider } from '@flowgram.ai/free-layout-editor';

import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import { nodeRegistries } from './nodes';
import { initialData as defaultInitialData } from './initial-data';
import { useEditorProps } from './hooks';
import type { FlowDocumentJSON } from './typings';

export interface EditorProps {
  initialData?: FlowDocumentJSON;
  onSave?: (graphJson: FlowDocumentJSON) => void;
}

export const Editor = ({ initialData, onSave }: EditorProps) => {
  const editorProps = useEditorProps(initialData ?? defaultInitialData, nodeRegistries);
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

- [ ] **Step 2: index.tsx 读 query + fetch 版本图**

`src/pages/flow-editor/index.tsx` 改为:

```tsx
import { createRoot } from 'react-dom/client';
import { PageContainer } from '@ant-design/pro-components';
import { unstableSetCreateRoot } from '@flowgram.ai/form-materials';
import { useSearchParams } from '@umijs/max';
import { useEffect, useState } from 'react';

import { getVersionGraph } from '@/pages/flow/service';
import { Editor } from './editor';
import type { FlowDocumentJSON } from './typings';

unstableSetCreateRoot(createRoot);

export default function FlowEditorPage() {
  const [search] = useSearchParams();
  const flowId = search.get('flowId') || undefined;
  const versionId = search.get('versionId') || undefined;
  const [initialData, setInitialData] = useState<FlowDocumentJSON | undefined>();

  useEffect(() => {
    if (!flowId || !versionId) return;
    getVersionGraph(flowId, versionId).then((g) => setInitialData(g.graphJson as FlowDocumentJSON));
  }, [flowId, versionId]);

  // wait for graph when a version is requested
  if (flowId && versionId && !initialData) return <PageContainer>加载版本图中…</PageContainer>;

  return (
    <PageContainer
      ghost
      childrenContentStyle={{ height: 'calc(100vh - 160px)', padding: 0, overflow: 'hidden' }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Editor initialData={initialData} />
      </div>
    </PageContainer>
  );
}
```

- [ ] **Step 3: 验证 build**

Run: `npm.cmd run build` → exit 0(含 flow-editor 与 flow 产物)。

- [ ] **Step 4: Commit**

```bash
git add src/pages/flow-editor/editor.tsx src/pages/flow-editor/index.tsx
git commit -m "feat(flow-mgmt): load flow version graph into /flow-editor by query"
```

---

### Task 7: /flow-editor "保存为新版本"按钮

**Covers:** [S6]

**Files:**
- Modify: `src/pages/flow-editor/editor.tsx`(加 onSave 按钮,用 `useClientContext().document.toJSON()`)
- Modify: `src/pages/flow-editor/index.tsx`(传 onSave:序列化 → POST → 跳回详情)

**Interfaces:**
- Consumes: Task1 service(`createVersion`)。
- Produces: 编辑器工具栏"保存为新版本"按钮 → 序列化 → POST → 跳 `/flow/:flowId`。

- [ ] **Step 1: editor.tsx 加 SaveBar 组件(用 useClientContext)**

在 `src/pages/flow-editor/editor.tsx` 顶部加 import 与 SaveBar,并在 `FreeLayoutEditorProvider` 内渲染:

```tsx
import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import { EditorRenderer, FreeLayoutEditorProvider, useClientContext } from '@flowgram.ai/free-layout-editor';
import { Button, Input, Modal, message } from 'antd';
import { useState } from 'react';

import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import { nodeRegistries } from './nodes';
import { initialData as defaultInitialData } from './initial-data';
import { useEditorProps } from './hooks';
import type { FlowDocumentJSON } from './typings';

export interface EditorProps {
  initialData?: FlowDocumentJSON;
  onSave?: (graphJson: FlowDocumentJSON) => void;
}

function SaveBar({ onSave }: { onSave?: (graphJson: FlowDocumentJSON) => void }) {
  const ctx = useClientContext();
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState('');
  if (!onSave) return null;
  const handleSave = () => {
    if (ctx.document.disposed) return;
    onSave(ctx.document.toJSON());
    setOpen(false);
    setRemark('');
  };
  return (
    <>
      <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 50 }}>
        <Button type="primary" onClick={() => setOpen(true)}>保存为新版本</Button>
      </div>
      <Modal title="保存为新版本" open={open} onOk={handleSave} onCancel={() => setOpen(false)}>
        <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="版本备注(可选)" />
      </Modal>
    </>
  );
}

export const Editor = ({ initialData, onSave }: EditorProps) => {
  const editorProps = useEditorProps(initialData ?? defaultInitialData, nodeRegistries);
  return (
    <div className="doc-free-feature-overview">
      <FreeLayoutEditorProvider {...editorProps}>
        <div className="demo-container">
          <DockedPanelLayer>
            <EditorRenderer className="demo-editor" />
          </DockedPanelLayer>
        </div>
        <SaveBar onSave={onSave} />
      </FreeLayoutEditorProvider>
    </div>
  );
};
```

- [ ] **Step 2: index.tsx 传 onSave(POST + 跳回)**

`src/pages/flow-editor/index.tsx` 的 `FlowEditorPage` 内,`<Editor initialData={initialData} onSave={...} />`:

```tsx
import { createVersion } from '@/pages/flow/service';
import { history } from '@umijs/max';
// ...在 return 的 Editor 上加:
      <Editor
        initialData={initialData}
        onSave={async (graphJson) => {
          if (!flowId) return;
          await createVersion(flowId, { graphJson, remark: '' });
          message.success('已保存为新版本');
          history.push(`/flow/${flowId}`);
        }}
      />
```

(顶部相应加 `message` from antd;`flowId` 已在本页用 `useSearchParams` 取得。)无 flowId 时不传 onSave(按钮不显示)。

- [ ] **Step 3: 验证 build**

Run: `npm.cmd run build` → exit 0。

- [ ] **Step 4: Commit**

```bash
git add src/pages/flow-editor/editor.tsx src/pages/flow-editor/index.tsx
git commit -m "feat(flow-mgmt): save-as-new-version button in /flow-editor"
```

---

### Task 8: 全量验证

**Covers:** [S8]

- [ ] **Step 1: tsc + lint + antd lint**

Run: `npm.cmd run tsc` → exit 0。
Run: `npm.cmd run lint` → exit 0。
Run: `npx.cmd antd lint ./src` → exit 0。

- [ ] **Step 2: dev 端到端**

Run: `npm.cmd start`(后台),访问(登录 admin/ant.design):
1. `/flow` → 见列表(含示例流程)
2. 新建流程 → 列表出现 → 进详情
3. 详情 Tab2 版本管理 → 示例流程有 v1(active)
4. 点"新建版本" → 跳 `/flow-editor?flowId=` → 编辑器加载(空白/示例)→ 拖几个节点 → 点"保存为新版本" → 跳回详情 → 版本列表多一个 v2(inactive)
5. 对 v2 点"启动" → v2 active、v1 inactive
6. 点 v2"查看" → `/flow-editor?flowId=&versionId=` → 编辑器加载 v2 图

- [ ] **Step 3: 提交剩余(若有) + clean**

Run: `git status` → clean 或预期改动;有问题回相应 Task 修。

---

## Self-Review 记录

- **Spec 覆盖:** [S1]→前言;[S2]→Task3/4/5;[S3]→Task1;[S4]→Task2;[S5]→Task3/4/5;[S6]→Task6/7;[S7]→Task2;[S8]→Task8。全覆盖。
- **占位符:** 无;序列化 API 已核实(`useClientContext`+`ctx.document.toJSON`,demo line 235 实证)。
- **类型一致:** `API.FlowItem`/`FlowVersionItem`/`FlowVersionGraph` 在 Task1 定义,Task3/4/5/6/7 复用一致;`EditorProps.initialData/onSave` 在 Task6/7 一致;service 函数名跨任务一致。
