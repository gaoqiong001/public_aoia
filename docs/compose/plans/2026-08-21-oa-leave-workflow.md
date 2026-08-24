# 流程详情页改造 + OA 请假审批 Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/oa-leave-workflow.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ①流程详情页改为基础详情页风格（单页 Descriptions + 版本表格 + 编辑弹窗）；②实现传统业务工作流示例——请假审批：编辑器新增 approval 节点、预置请假流程图、业务无关的 mock 运行引擎、`/oa/hr/leave` 业务页面（发起/我的申请/待我审批/已办，含退回重提与撤回）。

**Architecture:** 数据按三表分离（LeaveApplication 业务表仅存 `processInstanceId` + `processStatus` 冗余；ProcessInstance 流程实例表；ApprovalHistory 审批历史表经实例 ID 关联）。引擎 `engine.ts` 为纯函数模块（只消费 ProcessInstance + 图 JSON，业务无关，可单测）；mock 端点与前端 service 走项目标准模式（参照 `src/pages/flow/`）。流程图存于 flow 版本 graphJson，`reject` 端口连回 `start` 形成退回重提回路。

**Tech Stack:** Umi Max 4 · antd 6 / ProComponents 3 · @flowgram.ai（vendored flow-editor）· vitest（引擎单测）· mock（`src/pages/**/_mock.ts`）

## Global Constraints

- 全 mock，无真实后端；mock store 为模块级内存 Map（dev 单进程持久）
- `src/pages/flow/`、`src/pages/oa/` 受 Biome + tsc 约束（严格 TS，禁 `any`）；`src/pages/flow-editor/` 仍为 @ts-nocheck 且被 biome.json 排除——新增 approval 节点文件必须带 `// @ts-nocheck` 头
- Biome only；提交前 `npm run lint`（biome lint + tsc）+ `npx antd lint ./src` 通过；Conventional commits；`package-lock.json`（npm）
- 页面文案沿用 flow/system 页面的**中文字面量**惯例（非 useIntl）；仅菜单键走 i18n（8 语言）——spec S10 中"页面内文案用 useIntl"与项目实际惯例不符，以实际惯例为准
- 引擎只支持条件操作符 `= != > >= < <=`；左值仅 `payload.<字段>`（ref content `['payload', 字段名]`），右值常量
- 实例提交时绑定 versionId 快照；运行中实例不受版本切换影响；**被实例引用的版本禁止删除**（flow `deleteVersion` 校验）
- `Flow.code` 唯一业务编码，**仅新建时填写，编辑时锁定**
- 当前登录用户即所有审批角色（mock 简化）；待办 = 所有 `approving` 实例；已办 = 我的审批记录
- Spec：`docs/compose/specs/2026-08-21-oa-leave-workflow-design.md`（章节锚点 [S1]–[S12]）
- 参照实现：`src/pages/flow/`（list/detail/components/service/_mock.ts/data.d.ts）为 ProTable+mock 范式；`src/pages/profile/basic/index.tsx` 为基础详情页范式

## File Structure

**Create：**
- `src/pages/flow-editor/nodes/approval/index.ts` — approval 节点注册（@ts-nocheck）
- `src/pages/flow-editor/nodes/approval/form-meta.tsx` — 节点表单（@ts-nocheck）
- `src/pages/flow-editor/nodes/approval/styles.tsx` — 端口定位样式（@ts-nocheck）
- `src/pages/oa/hr/leave/engine.ts` — 工作流引擎（纯函数）
- `src/pages/oa/hr/leave/engine.test.ts` — 引擎 vitest 测试
- `src/pages/oa/hr/leave/store.ts` — 三 store + 示例实例 seed + `isVersionReferenced`
- `src/pages/oa/hr/leave/_mock.ts` — mock 端点（调 engine + flow/_mock 取图）
- `src/pages/oa/hr/leave/service.ts` — 前端 API
- `src/pages/oa/hr/leave/data.d.ts` — `API.LeaveApplication / LeaveInstance / LeaveHistory / LeaveStatus`
- `src/pages/oa/hr/leave/index.tsx` — 四 Tab 页面
- `src/pages/oa/hr/leave/components/ApplyForm.tsx` — 发起/重提表单（含病假显隐）
- `src/pages/oa/hr/leave/components/InstanceDrawer.tsx` — 实例详情（Descriptions + Timeline）
- `src/pages/oa/hr/leave/components/ApproveModal.tsx` — 通过/驳回意见弹窗

**Modify：**
- `src/pages/flow-editor/nodes/constants.ts` — 加 `Approval = 'approval'`
- `src/pages/flow-editor/nodes/index.ts` — 注册 ApprovalNodeRegistry
- `src/pages/flow/data.d.ts` — `FlowItem` 加 `code?: string`
- `src/pages/flow/_mock.ts` — FlowRecord 加 code；seed 示例流程 code；**预置请假流程 + active 版本（graphJson 含 approval/condition 节点）**；DELETE version 加引用保护
- `src/pages/flow/components/FlowForm.tsx` — 加 code 字段（编辑时 disabled）
- `src/pages/flow/detail/index.tsx` — 单页化（去 tabs）
- `src/pages/flow/detail/components/BasicInfo.tsx` — ProForm → 只读 Descriptions
- `config/routes.ts` — `/oa` 分组 + `/oa/hr/leave`
- `src/locales/{zh-CN,en-US,ja-JP,ko-KR,id-ID,pt-BR,vi-VN,zh-TW}/menu.ts` — `menu.oa / menu.oa.hr / menu.oa.hr.leave`

**Test：** 引擎单测（`engine.test.ts`，vitest）；页面无单测约定，验证以 `npm run tsc`/`lint`/`build` + dev e2e 为准。

---

### Task 1: Flow.code 数据模型 + FlowForm code 字段

**Covers:** [S4]

**Files:**
- Modify: `src/pages/flow/data.d.ts`、`src/pages/flow/_mock.ts`、`src/pages/flow/components/FlowForm.tsx`

**Interfaces:**
- Produces: `API.FlowItem.code?: string`；mock `POST/PUT /api/flow` 透传 `body.code`；`FlowForm` 新增 `code` 输入（`isEdit` 时 `disabled`）

- [ ] **Step 1: data.d.ts 加 code**

`src/pages/flow/data.d.ts` 的 `FlowItem` 接口加一行：

```ts
  interface FlowItem {
    id: string;
    name: string;
    description: string;
    code?: string;
    status: FlowStatus;
    activeVersionId: string | null;
    versionCount: number;
    createdAt: string;
    updatedAt: string;
  }
```

- [ ] **Step 2: _mock.ts 支持 code**

`src/pages/flow/_mock.ts`：
1. `interface FlowRecord` 加 `code: string;`
2. seed 示例流程（第 30-38 行对象）加 `code: '',`
3. `POST /api/flow` 的 rec 加 `code: body.code || '',`

- [ ] **Step 3: FlowForm 加 code 字段**

`src/pages/flow/components/FlowForm.tsx`：
1. `initialValues` 编辑分支加 `code: record.code,`
2. 在 `ProFormText name="name"` 之后插入：

```tsx
      <ProFormText
        name="code"
        label="业务编码"
        placeholder="如 leave_approval（业务页面按此编码绑定流程）"
        disabled={isEdit}
      />
```

- [ ] **Step 4: 验证**

Run: `npm.cmd run tsc`
Expected: 退出码 0。

- [ ] **Step 5: 提交**

```bash
git add src/pages/flow/data.d.ts src/pages/flow/_mock.ts src/pages/flow/components/FlowForm.tsx
git commit -m "feat(flow): add business code field to flow model"
```

---

### Task 2: 流程详情页单页化（基础详情页风格）

**Covers:** [S2]

**Files:**
- Modify: `src/pages/flow/detail/index.tsx`、`src/pages/flow/detail/components/BasicInfo.tsx`

**Interfaces:**
- Consumes: `API.FlowItem`（含 `code`）、`getFlowDetail`、`FlowForm`（编辑弹窗）、`VersionTable`
- Produces: `BasicInfo({ flow })` 只读 Descriptions 组件；`FlowDetail` 单页（Card 内 Descriptions + Divider + VersionTable + 编辑按钮）

- [ ] **Step 1: BasicInfo.tsx 改为只读 Descriptions**

`src/pages/flow/detail/components/BasicInfo.tsx` 整体替换为：

```tsx
import { Descriptions, Tag } from 'antd';

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  published: { text: '已发布', color: 'green' },
  archived: { text: '已归档', color: 'orange' },
};

export default function BasicInfo({ flow }: { flow?: API.FlowItem }) {
  if (!flow) return null;
  const status = statusMap[flow.status] ?? { text: flow.status, color: 'default' };
  return (
    <Descriptions
      title="流程基础信息"
      column={2}
      items={[
        { key: 'name', label: '流程名称', children: flow.name },
        { key: 'description', label: '描述', children: flow.description || '-' },
        { key: 'code', label: '业务编码', children: flow.code || '-' },
        { key: 'status', label: '状态', children: <Tag color={status.color}>{status.text}</Tag> },
        { key: 'activeVersion', label: '当前启用版本', children: flow.activeVersionId ? '是' : '无' },
        { key: 'createdAt', label: '创建时间', children: flow.createdAt },
        { key: 'updatedAt', label: '更新时间', children: flow.updatedAt },
      ]}
    />
  );
}
```

- [ ] **Step 2: detail/index.tsx 单页化**

`src/pages/flow/detail/index.tsx` 整体替换为：

```tsx
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Divider } from 'antd';
import { useParams } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { getFlowDetail } from '../service';
import BasicInfo from './components/BasicInfo';
import VersionTable from './components/VersionTable';
import FlowForm from '../components/FlowForm';

export default function FlowDetail() {
  const params = useParams<{ id: string }>();
  const [flow, setFlow] = useState<API.FlowItem>();
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(() => {
    if (!params.id) return;
    getFlowDetail(params.id).then(setFlow);
  }, [params.id]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer>
      <Card
        extra={
          <Button type="primary" onClick={() => setEditOpen(true)}>
            编辑
          </Button>
        }
      >
        <BasicInfo flow={flow} />
        <Divider size="large" />
        <VersionTable flowId={params.id ?? ''} />
      </Card>
      <FlowForm
        open={editOpen}
        onOpenChange={setEditOpen}
        record={flow}
        onSuccess={() => {
          setEditOpen(false);
          load();
        }}
      />
    </PageContainer>
  );
}
```

- [ ] **Step 3: 验证**

Run: `npm.cmd run tsc` 与 `npm.cmd run lint`
Expected: 均退出码 0（biome lint 输出 "No fixes applied"）。

- [ ] **Step 4: 提交**

```bash
git add src/pages/flow/detail/index.tsx src/pages/flow/detail/components/BasicInfo.tsx
git commit -m "feat(flow): restyle flow detail page as single-page descriptions layout"
```

---

### Task 3: 编辑器新增 approval 节点

**Covers:** [S3]

**Files:**
- Create: `src/pages/flow-editor/nodes/approval/index.ts`、`form-meta.tsx`、`styles.tsx`
- Modify: `src/pages/flow-editor/nodes/constants.ts`、`src/pages/flow-editor/nodes/index.ts`

**Interfaces:**
- Consumes: `FlowNodeRegistry`（`../../typings`）、`WorkflowNodeType`（`../constants`）、`FormHeader/FormContent/FormItem`（`../../form-components`）、`useNodeRenderContext`（`../../hooks`）
- Produces: `WorkflowNodeType.Approval = 'approval'`；`ApprovalNodeRegistry`；节点数据 `{ title, approvalRole, remark }`；出端口 `pass` / `reject`

- [ ] **Step 1: constants.ts 加枚举**

`src/pages/flow-editor/nodes/constants.ts` 的枚举中（`Break` 之后）加：

```ts
  Approval = 'approval',
```

- [ ] **Step 2: approval/index.ts 注册**

新建 `src/pages/flow-editor/nodes/approval/index.ts`：

```ts
// @ts-nocheck
import { nanoid } from 'nanoid';

import { FlowNodeRegistry } from '../../typings';
import iconApproval from '../../assets/icon-condition.svg';
import { formMeta } from './form-meta';
import { WorkflowNodeType } from '../constants';

export const ApprovalNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Approval,
  info: {
    icon: iconApproval,
    description:
      'Human approval step. Pass / reject ports decide the next step.',
  },
  meta: {
    defaultPorts: [{ type: 'input' }],
    expandable: false,
    size: {
      width: 360,
      height: 190,
    },
  },
  formMeta,
  onAdd() {
    return {
      id: `approval_${nanoid(5)}`,
      type: 'approval',
      data: {
        title: '审批',
        approvalRole: 'direct_supervisor',
        remark: '',
      },
    };
  },
};
```

- [ ] **Step 3: approval/form-meta.tsx 表单 + 双端口**

新建 `src/pages/flow-editor/nodes/approval/form-meta.tsx`：

```tsx
// @ts-nocheck
import { useLayoutEffect } from 'react';

import { Field, FormRenderProps, FormMeta } from '@flowgram.ai/free-layout-editor';

import { FlowNodeJSON } from '../../typings';
import { FormHeader, FormContent, FormItem } from '../../form-components';
import { useNodeRenderContext } from '../../hooks';
import { ApprovalPort } from './styles';

const roleOptions = [
  { label: '直属主管', value: 'direct_supervisor' },
  { label: '部门负责人', value: 'dept_manager' },
  { label: '人事', value: 'hr' },
];

export const renderForm = ({ form }: FormRenderProps<FlowNodeJSON>) => {
  const { node, readonly } = useNodeRenderContext();
  useLayoutEffect(() => {
    window.requestAnimationFrame(() => {
      node.ports.updateDynamicPorts();
    });
  }, [node]);
  return (
    <>
      <FormHeader />
      <FormContent>
        <FormItem name="approvalRole" label="审批人角色">
          <Field name="approvalRole">
            {({ field }) => (
              <select
                style={{ width: '100%' }}
                value={field.value}
                disabled={readonly}
                onChange={(e) => field.onChange(e.target.value)}
              >
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </FormItem>
        <FormItem name="remark" label="说明">
          <Field name="remark">
            {({ field }) => (
              <textarea
                style={{ width: '100%' }}
                value={field.value || ''}
                disabled={readonly}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          </Field>
        </FormItem>
        <ApprovalPort data-port-id="pass" data-port-type="output" $top="34%">
          通过
        </ApprovalPort>
        <ApprovalPort data-port-id="reject" data-port-type="output" $top="66%">
          驳回
        </ApprovalPort>
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
};
```

新建 `src/pages/flow-editor/nodes/approval/styles.tsx`：

```tsx
// @ts-nocheck
import styled from 'styled-components';

export const ApprovalPort = styled.div<{ $top: string }>`
  position: absolute;
  right: -12px;
  top: ${(props) => props.$top};
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  cursor: crosshair;
  ::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid #1677ff;
    background: #fff;
  }
`;
```

> 说明：端口连线机制复用 condition 节点的 DOM 端口模式（`data-port-id` + `data-port-type` 属性 + `updateDynamicPorts()`，参照 `nodes/condition/condition-inputs/index.tsx:28-31,61`）。**备选方案（若双端口连线不生效）**：在 `meta.defaultPorts` 声明 `{ type: 'output', portID: 'pass' }` 与 `{ type: 'output', portID: 'reject' }` 并删除自定义端口 div，改用 `WorkflowPortRender`（`@flowgram.ai/free-lines-plugin` 导出）渲染。

- [ ] **Step 4: 注册表接入**

`src/pages/flow-editor/nodes/index.ts`：
1. import 区加 `import { ApprovalNodeRegistry } from './approval';`
2. `nodeRegistries` 数组末尾加 `ApprovalNodeRegistry,`

- [ ] **Step 5: 验证**

Run: `npm.cmd run tsc`
Expected: 退出码 0。

dev 手验：`npm.cmd start` 打开 `/flow-editor` → 节点面板出现"审批"节点 → 拖入画布 → 右侧表单出现角色/说明字段 → 节点右侧出现"通过/驳回"两个端口 → 从两个端口各拉一条连线到其他节点，边 JSON 中 `sourcePortID` 为 `pass`/`reject`。
若端口连线失败，改用备选方案（Step 3 备注）后重验。

- [ ] **Step 6: 提交**

```bash
git add src/pages/flow-editor/nodes/approval src/pages/flow-editor/nodes/constants.ts src/pages/flow-editor/nodes/index.ts
git commit -m "feat(flow-editor): add approval node with pass/reject ports"
```

---

### Task 4: 预置"请假审批"流程数据

**Covers:** [S8]

**Files:**
- Modify: `src/pages/flow/_mock.ts`

**Interfaces:**
- Consumes: 节点类型 `start` / `approval` / `condition` / `end`（graphJson 结构与 `src/pages/flow-editor/initial-data.ts` 一致：`{ nodes: [{id,type,meta:{position},data}], edges: [{sourceNodeID,targetNodeID,sourcePortID?}] }`）
- Produces: seed 流程 `leave-approval-flow`（`code: 'leave_approval'`、`status: 'published'`、`activeVersionId: 'ver-leave-1'`）+ 版本 `ver-leave-1`（graphJson 为请假审批图）

- [ ] **Step 1: seed 请假流程**

`src/pages/flow/_mock.ts` 中，在现有 seed（示例流程）之后追加：

```ts
// seed: leave approval flow (business workflow demo)
const fLeave = 'leave-approval-flow';
const vLeave = 'ver-leave-1';
flows.set(fLeave, {
  id: fLeave,
  name: '请假审批',
  description: '传统业务工作流示例：提交申请 → 主管审批 → 条件分支 → 人事归档',
  code: 'leave_approval',
  status: 'published',
  activeVersionId: vLeave,
  createdAt: now(),
  updatedAt: now(),
});
versions.set(vLeave, {
  id: vLeave,
  flowId: fLeave,
  version: 1,
  status: 'active',
  remark: '初始版本',
  graphJson: {
    nodes: [
      {
        id: 'leave_start',
        type: 'start',
        meta: { position: { x: 80, y: 200 } },
        data: {
          title: '请假申请',
          outputs: {
            type: 'object',
            properties: {
              applicant: { type: 'string' },
              leaveType: { type: 'string' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              days: { type: 'number' },
              reason: { type: 'string' },
            },
          },
        },
      },
      {
        id: 'approve_supervisor',
        type: 'approval',
        meta: { position: { x: 420, y: 160 } },
        data: { title: '直属主管审批', approvalRole: 'direct_supervisor', remark: '' },
      },
      {
        id: 'cond_days',
        type: 'condition',
        meta: { position: { x: 760, y: 200 } },
        data: {
          title: '天数判断',
          conditions: [
            {
              key: 'if_short',
              value: {
                left: { type: 'ref', content: ['payload', 'days'] },
                operator: '<=',
                right: { type: 'constant', content: 3 },
              },
            },
          ],
        },
      },
      {
        id: 'approve_dept',
        type: 'approval',
        meta: { position: { x: 1100, y: 60 } },
        data: { title: '部门负责人审批', approvalRole: 'dept_manager', remark: '' },
      },
      {
        id: 'approve_hr',
        type: 'approval',
        meta: { position: { x: 1100, y: 300 } },
        data: { title: '人事归档', approvalRole: 'hr', remark: '' },
      },
      {
        id: 'leave_end',
        type: 'end',
        meta: { position: { x: 1460, y: 200 } },
        data: { title: '结束' },
      },
    ],
    edges: [
      { sourceNodeID: 'leave_start', targetNodeID: 'approve_supervisor' },
      { sourceNodeID: 'approve_supervisor', targetNodeID: 'cond_days', sourcePortID: 'pass' },
      { sourceNodeID: 'approve_supervisor', targetNodeID: 'leave_start', sourcePortID: 'reject' },
      { sourceNodeID: 'cond_days', targetNodeID: 'approve_hr', sourcePortID: 'if_short' },
      { sourceNodeID: 'cond_days', targetNodeID: 'approve_dept', sourcePortID: 'else' },
      { sourceNodeID: 'approve_dept', targetNodeID: 'approve_hr', sourcePortID: 'pass' },
      { sourceNodeID: 'approve_dept', targetNodeID: 'leave_start', sourcePortID: 'reject' },
      { sourceNodeID: 'approve_hr', targetNodeID: 'leave_end', sourcePortID: 'pass' },
      { sourceNodeID: 'approve_hr', targetNodeID: 'leave_start', sourcePortID: 'reject' },
    ],
  },
  createdAt: now(),
});
```

> 图结构：`days <= 3` → 人事归档；否则 → 部门负责人审批 → 人事归档；任一审批驳回 → 退回 start（重提回路）。

- [ ] **Step 2: 验证**

Run: `npm.cmd run tsc`
Expected: 退出码 0。

dev 手验：`/flow` 列表出现"请假审批"→ 详情 → 版本管理 → "查看" → 编辑器加载出完整审批图（start/审批/条件/end 与 reject→start 回路）。

- [ ] **Step 3: 提交**

```bash
git add src/pages/flow/_mock.ts
git commit -m "feat(flow): seed leave approval workflow graph"
```

---

### Task 5: 工作流引擎 engine.ts（TDD）

**Covers:** [S4], [S5], [S6]

**Files:**
- Create: `src/pages/oa/hr/leave/engine.ts`、`src/pages/oa/hr/leave/engine.test.ts`

**Interfaces:**
- Produces（供 Task 6/7 使用，签名如下）：

```ts
export interface EngineNode { id: string; type: string; data?: Record<string, any> }
export interface EngineEdge { sourceNodeID: string; targetNodeID: string; sourcePortID?: string }
export interface EngineGraph { nodes: EngineNode[]; edges: EngineEdge[] }
export type InstanceStatus = 'approving' | 'returned' | 'approved' | 'withdrawn';
export interface ProcessInstance {
  id: string; flowId: string; flowName: string; versionId: string;
  status: InstanceStatus; currentNodeId: string; createdAt: string;
}
export interface ApprovalRecord {
  id: string; processInstanceId: string; nodeId: string; nodeTitle: string;
  action: 'submit' | 'approve' | 'reject' | 'resubmit' | 'withdraw';
  approver: string; comment: string; time: string;
}
export interface EngineStore {
  instances: Map<string, ProcessInstance>;
  history: ApprovalRecord[];
  getGraph: (versionId: string) => EngineGraph | undefined;
}
export function startInstance(store: EngineStore, input: {
  id: string; flowId: string; flowName: string; versionId: string;
  applicant: string; payload: Record<string, any>;
}): void;
export function approve(store: EngineStore, instanceId: string, input: {
  approver: string; comment: string; payload: Record<string, any>;
}): void;
export function reject(store: EngineStore, instanceId: string, input: {
  approver: string; comment: string;
}): void;
export function resubmit(store: EngineStore, instanceId: string, input: {
  applicant: string; payload: Record<string, any>;
}): void;
export function withdraw(store: EngineStore, instanceId: string, input: { approver: string }): void;
export function evaluateCondition(node: EngineNode, payload: Record<string, any>): boolean;
```

**语义：** `startInstance` 创建实例（status 初始 `approving`）+ submit 历史 → walk；`approve` 写历史 + 沿 `pass` 边 walk；`reject` 写历史 + 置 `returned`、`currentNodeId` 指向图内 `start` 节点（无 start 则置空串）→ 不 walk；`resubmit` 写历史 + 从 start 重新 walk；`withdraw` 仅 `approving`/`returned` 可执行 → 置 `withdrawn` + 写历史。walk 遇 `approval` 节点置 `approving` 暂停；遇 `end` 置 `approved`；遇 `condition` 按 `evaluateCondition` 选边（首个命中的 `if_*` 端口边，否则 `else` 边）；其余节点沿首条出边。walk 循环安全上限 100 次。`evaluateCondition`：`data.conditions[0].value` 形如 `{ left: {type:'ref'|'constant', content}, operator, right: {type:'constant', content} }`；left 为 ref 时 `content[0] === 'payload'` 则取 `payload[content[1]]`，否则抛错；操作符 `= != > >= < <=`。

- [ ] **Step 1: 写首个失败测试（提交/推进/通过/终态）**

`src/pages/oa/hr/leave/engine.test.ts`（先写第一批测试）：

```ts
import { describe, expect, it } from 'vitest';
import {
  approve,
  reject,
  resubmit,
  startInstance,
  withdraw,
  type EngineGraph,
  type EngineStore,
} from './engine';

// 与 flow/_mock 预置图同构的夹具图（缩小版：单审批 → end）
function fixtureGraph(): EngineGraph {
  return {
    nodes: [
      { id: 'start', type: 'start', data: { title: '开始' } },
      { id: 'app1', type: 'approval', data: { title: '直属主管审批', approvalRole: 'direct_supervisor' } },
      { id: 'end', type: 'end', data: { title: '结束' } },
    ],
    edges: [
      { sourceNodeID: 'start', targetNodeID: 'app1' },
      { sourceNodeID: 'app1', targetNodeID: 'end', sourcePortID: 'pass' },
      { sourceNodeID: 'app1', targetNodeID: 'start', sourcePortID: 'reject' },
    ],
  };
}

function makeStore(graph?: EngineGraph): EngineStore {
  return {
    instances: new Map(),
    history: [],
    getGraph: (versionId) => (versionId === 'v1' ? (graph ?? fixtureGraph()) : undefined),
  };
}

describe('workflow engine', () => {
  it('startInstance 走到首个审批节点并暂停', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1',
      applicant: '张三', payload: { days: 1 },
    });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('app1');
    expect(store.history[0].action).toBe('submit');
  });

  it('approve 沿 pass 边走到 end 后置 approved', () => {
    const store = makeStore();
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: {} });
    approve(store, 'i1', { approver: '李四', comment: '同意', payload: {} });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approved');
    expect(inst.currentNodeId).toBe('end');
    expect(store.history.at(-1)).toMatchObject({ action: 'approve', approver: '李四' });
  });

  it('reject 退回发起人（returned + 指向 start）', () => {
    const store = makeStore();
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: {} });
    reject(store, 'i1', { approver: '李四', comment: '材料不全' });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('returned');
    expect(inst.currentNodeId).toBe('start');
  });

  it('resubmit 后重新走到审批节点', () => {
    const store = makeStore();
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: {} });
    reject(store, 'i1', { approver: '李四', comment: '重填' });
    resubmit(store, 'i1', { applicant: '张三', payload: { days: 2 } });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('app1');
    expect(store.history.at(-1).action).toBe('resubmit');
  });

  it('withdraw 在 approving/returned 生效，终态 withdrawn', () => {
    const store = makeStore();
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: {} });
    withdraw(store, 'i1', { approver: '张三' });
    expect(store.instances.get('i1')!.status).toBe('withdrawn');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx.cmd vitest run src/pages/oa/hr/leave/engine.test.ts`
Expected: FAIL（模块不存在 / 函数未定义）。

- [ ] **Step 3: 实现 engine.ts（最小实现通过第一批测试）**

`src/pages/oa/hr/leave/engine.ts`：

```ts
export interface EngineNode {
  id: string;
  type: string;
  data?: Record<string, any>;
}
export interface EngineEdge {
  sourceNodeID: string;
  targetNodeID: string;
  sourcePortID?: string;
}
export interface EngineGraph {
  nodes: EngineNode[];
  edges: EngineEdge[];
}
export type InstanceStatus = 'approving' | 'returned' | 'approved' | 'withdrawn';
export interface ProcessInstance {
  id: string;
  flowId: string;
  flowName: string;
  versionId: string;
  status: InstanceStatus;
  currentNodeId: string;
  createdAt: string;
}
export interface ApprovalRecord {
  id: string;
  processInstanceId: string;
  nodeId: string;
  nodeTitle: string;
  action: 'submit' | 'approve' | 'reject' | 'resubmit' | 'withdraw';
  approver: string;
  comment: string;
  time: string;
}
export interface EngineStore {
  instances: Map<string, ProcessInstance>;
  history: ApprovalRecord[];
  getGraph: (versionId: string) => EngineGraph | undefined;
}

const now = () => new Date().toISOString();
const sid = () => Math.random().toString(36).slice(2, 10);

function findNode(graph: EngineGraph, id: string): EngineNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

function outgoingEdges(graph: EngineGraph, nodeId: string): EngineEdge[] {
  return graph.edges.filter((e) => e.sourceNodeID === nodeId);
}

function pushHistory(
  store: EngineStore,
  instanceId: string,
  nodeId: string,
  nodeTitle: string,
  action: ApprovalRecord['action'],
  approver: string,
  comment: string,
) {
  store.history.push({
    id: sid(),
    processInstanceId: instanceId,
    nodeId,
    nodeTitle,
    action,
    approver,
    comment,
    time: now(),
  });
}

export function evaluateCondition(
  node: EngineNode,
  payload: Record<string, any>,
): boolean {
  const cond = node.data?.conditions?.[0]?.value;
  if (!cond) return false;
  const { left, operator, right } = cond;
  let leftValue: unknown;
  if (left.type === 'ref') {
    if (left.content[0] !== 'payload') {
      throw new Error(`unsupported ref target: ${left.content[0]}`);
    }
    leftValue = payload[left.content[1]];
  } else {
    leftValue = left.content;
  }
  const rightValue = right?.type === 'constant' ? right.content : right?.content;
  switch (operator) {
    case '=':
      return leftValue == rightValue;
    case '!=':
      return leftValue != rightValue;
    case '>':
      return Number(leftValue) > Number(rightValue);
    case '>=':
      return Number(leftValue) >= Number(rightValue);
    case '<':
      return Number(leftValue) < Number(rightValue);
    case '<=':
      return Number(leftValue) <= Number(rightValue);
    default:
      throw new Error(`unsupported operator: ${operator}`);
  }
}

function walk(store: EngineStore, inst: ProcessInstance, payload: Record<string, any>) {
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  for (let i = 0; i < 100; i++) {
    const node = findNode(graph, inst.currentNodeId);
    if (!node) throw new Error(`node not found: ${inst.currentNodeId}`);
    if (node.type === 'end') {
      inst.status = 'approved';
      return;
    }
    if (node.type === 'approval') {
      inst.status = 'approving';
      return;
    }
    const edges = outgoingEdges(graph, node.id);
    if (node.type === 'condition') {
      const matched = evaluateCondition(node, payload);
      const edge = matched
        ? edges.find((e) => e.sourcePortID && e.sourcePortID.startsWith('if_'))
        : edges.find((e) => e.sourcePortID === 'else');
      if (!edge) throw new Error(`condition branch not found: ${node.id}`);
      inst.currentNodeId = edge.targetNodeID;
      continue;
    }
    if (edges.length === 0) throw new Error(`no outgoing edge: ${node.id}`);
    inst.currentNodeId = edges[0].targetNodeID;
  }
  throw new Error('walk exceeds safety limit');
}

export function startInstance(
  store: EngineStore,
  input: {
    id: string;
    flowId: string;
    flowName: string;
    versionId: string;
    applicant: string;
    payload: Record<string, any>;
  },
) {
  const inst: ProcessInstance = {
    id: input.id,
    flowId: input.flowId,
    flowName: input.flowName,
    versionId: input.versionId,
    status: 'approving',
    currentNodeId: '',
    createdAt: now(),
  };
  const graph = store.getGraph(input.versionId);
  if (!graph) throw new Error(`graph not found: ${input.versionId}`);
  const startNode = graph.nodes.find((n) => n.type === 'start');
  if (!startNode) throw new Error('no start node');
  inst.currentNodeId = startNode.id;
  store.instances.set(inst.id, inst);
  pushHistory(store, inst.id, startNode.id, startNode.data?.title ?? '开始', 'submit', input.applicant, '提交申请');
  walk(store, inst, input.payload);
}

export function approve(
  store: EngineStore,
  instanceId: string,
  input: { approver: string; comment: string; payload: Record<string, any> },
) {
  const inst = store.instances.get(instanceId);
  if (!inst || inst.status !== 'approving') throw new Error('instance not approvable');
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  const node = findNode(graph, inst.currentNodeId);
  const edge = outgoingEdges(graph, inst.currentNodeId).find((e) => e.sourcePortID === 'pass');
  if (!edge) throw new Error(`no pass edge: ${inst.currentNodeId}`);
  pushHistory(store, inst.id, inst.currentNodeId, node?.data?.title ?? '', 'approve', input.approver, input.comment);
  inst.currentNodeId = edge.targetNodeID;
  walk(store, inst, input.payload);
}

export function reject(
  store: EngineStore,
  instanceId: string,
  input: { approver: string; comment: string },
) {
  const inst = store.instances.get(instanceId);
  if (!inst || inst.status !== 'approving') throw new Error('instance not rejectable');
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  const node = findNode(graph, inst.currentNodeId);
  pushHistory(store, inst.id, inst.currentNodeId, node?.data?.title ?? '', 'reject', input.approver, input.comment);
  const startNode = graph.nodes.find((n) => n.type === 'start');
  inst.status = 'returned';
  inst.currentNodeId = startNode?.id ?? '';
}

export function resubmit(
  store: EngineStore,
  instanceId: string,
  input: { applicant: string; payload: Record<string, any> },
) {
  const inst = store.instances.get(instanceId);
  if (!inst || inst.status !== 'returned') throw new Error('instance not resubmittable');
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  const startNode = graph.nodes.find((n) => n.type === 'start');
  if (!startNode) throw new Error('no start node');
  pushHistory(store, inst.id, startNode.id, startNode.data?.title ?? '开始', 'resubmit', input.applicant, '重新提交');
  inst.status = 'approving';
  inst.currentNodeId = startNode.id;
  walk(store, inst, input.payload);
}

export function withdraw(
  store: EngineStore,
  instanceId: string,
  input: { approver: string },
) {
  const inst = store.instances.get(instanceId);
  if (!inst || (inst.status !== 'approving' && inst.status !== 'returned')) {
    throw new Error('instance not withdrawable');
  }
  pushHistory(store, inst.id, inst.currentNodeId, inst.currentNodeId, 'withdraw', input.approver, '撤回申请');
  inst.status = 'withdrawn';
}
```

- [ ] **Step 4: 运行确认通过（第一批）**

Run: `npx.cmd vitest run src/pages/oa/hr/leave/engine.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 追加条件分支测试（含天数分支）**

`engine.test.ts` 追加：

```ts
describe('condition branches', () => {
  const branchGraph: EngineGraph = {
    nodes: [
      { id: 'start', type: 'start', data: { title: '开始' } },
      { id: 'app1', type: 'approval', data: { title: '主管审批' } },
      { id: 'cond', type: 'condition', data: {
          title: '天数判断',
          conditions: [
            {
              key: 'if_short',
              value: {
                left: { type: 'ref', content: ['payload', 'days'] },
                operator: '<=',
                right: { type: 'constant', content: 3 },
              },
            },
          ],
        } },
      { id: 'hr', type: 'approval', data: { title: '人事归档' } },
      { id: 'dept', type: 'approval', data: { title: '部门负责人' } },
      { id: 'end', type: 'end', data: { title: '结束' } },
    ],
    edges: [
      { sourceNodeID: 'start', targetNodeID: 'app1' },
      { sourceNodeID: 'app1', targetNodeID: 'cond', sourcePortID: 'pass' },
      { sourceNodeID: 'app1', targetNodeID: 'start', sourcePortID: 'reject' },
      { sourceNodeID: 'cond', targetNodeID: 'hr', sourcePortID: 'if_short' },
      { sourceNodeID: 'cond', targetNodeID: 'dept', sourcePortID: 'else' },
      { sourceNodeID: 'hr', targetNodeID: 'end', sourcePortID: 'pass' },
      { sourceNodeID: 'dept', targetNodeID: 'hr', sourcePortID: 'pass' },
    ],
  };

  it('days<=3 走 if_short 分支到人事归档', () => {
    const store = makeStore(branchGraph);
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: { days: 2 } });
    approve(store, 'i1', { approver: '李四', comment: '同意', payload: { days: 2 } });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('hr');
  });

  it('days>3 走 else 分支到部门负责人', () => {
    const store = makeStore(branchGraph);
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: { days: 5 } });
    approve(store, 'i1', { approver: '李四', comment: '同意', payload: { days: 5 } });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('dept');
  });

  it('多级链路走完置 approved', () => {
    const store = makeStore(branchGraph);
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: { days: 5 } });
    approve(store, 'i1', { approver: '李四', comment: '', payload: { days: 5 } });
    approve(store, 'i1', { approver: '王五', comment: '', payload: { days: 5 } });
    approve(store, 'i1', { approver: '赵六', comment: '', payload: { days: 5 } });
    expect(store.instances.get('i1')!.status).toBe('approved');
  });

  it('操作符 = != > >= < <= 均正确求值', () => {
    const cases: Array<[string, number, number, boolean]> = [
      ['=', 3, 3, true],
      ['=', 3, 4, false],
      ['!=', 3, 4, true],
      ['>', 4, 3, true],
      ['>=', 3, 3, true],
      ['<', 2, 3, true],
      ['<=', 3, 3, true],
      ['<=', 4, 3, false],
    ];
    for (const [operator, left, right, expected] of cases) {
      const node: EngineNode = {
        id: 'cond',
        type: 'condition',
        data: {
          conditions: [
            {
              key: 'if_x',
              value: {
                left: { type: 'constant', content: left },
                operator,
                right: { type: 'constant', content: right },
              },
            },
          ],
        },
      };
      expect(evaluateCondition(node, {})).toBe(expected);
    }
  });
});
```

> 需要把 `evaluateCondition` 与 `EngineNode` 加入 `engine.test.ts` 的 import。

- [ ] **Step 6: 运行确认通过（全部）**

Run: `npx.cmd vitest run src/pages/oa/hr/leave/engine.test.ts`
Expected: PASS（9 个用例）。同时 `npm.cmd run tsc` 退出码 0。

- [ ] **Step 7: 提交**

```bash
git add src/pages/oa/hr/leave/engine.ts src/pages/oa/hr/leave/engine.test.ts
git commit -m "feat(oa): add business-agnostic workflow engine with tests"
```

---

### Task 6: 三 store + mock 端点 + service + 版本引用保护

**Covers:** [S5], [S8]

**Files:**
- Create: `src/pages/oa/hr/leave/store.ts`、`src/pages/oa/hr/leave/_mock.ts`、`src/pages/oa/hr/leave/service.ts`、`src/pages/oa/hr/leave/data.d.ts`
- Modify: `src/pages/flow/_mock.ts`（DELETE version 引用保护）

**Interfaces:**
- Consumes: `engine.ts` 全部导出；`flow/_mock.ts` 的 `getVersionGraphById`（新增导出）；`flow/service.ts` 的 `getVersionGraph` 不在 mock 内使用（mock 端点直接读 Map）
- Produces: `store.ts` 导出 `leaveStore / instanceStore / historyStore`（Map）+ `isVersionReferenced(versionId): boolean` + seed 实例；mock 端点（见下）；service 函数 `getLeaveFlow / createLeaveApplication / resubmitApplication / withdrawApplication / listMyApplications / listMyPendingTasks / listMyDone / approveTask / getInstanceDetail`；`API.LeaveApplication / LeaveInstance / LeaveHistory / LeaveStatus`

- [ ] **Step 1: data.d.ts**

`src/pages/oa/hr/leave/data.d.ts`：

```ts
declare namespace API {
  type LeaveStatus = 'approving' | 'returned' | 'approved' | 'withdrawn';

  interface LeaveApplication {
    id: string;
    applicant: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    diagnosisNote?: string;
    processInstanceId: string;
    processStatus: LeaveStatus;
    createdAt: string;
  }

  interface LeaveInstance {
    id: string;
    flowId: string;
    flowName: string;
    versionId: string;
    status: LeaveStatus;
    currentNodeId: string;
    createdAt: string;
  }

  interface LeaveHistory {
    id: string;
    processInstanceId: string;
    nodeId: string;
    nodeTitle: string;
    action: 'submit' | 'approve' | 'reject' | 'resubmit' | 'withdraw';
    approver: string;
    comment: string;
    time: string;
  }

  interface LeaveFlowRef {
    flowId: string;
    flowName: string;
    versionId: string;
  }
}
```

- [ ] **Step 2: store.ts（三 store + seed + 引用保护）**

`src/pages/oa/hr/leave/store.ts`：

```ts
import type {
  LeaveApplication,
  LeaveHistory,
  LeaveInstance,
  LeaveStatus,
} from './data.d';
import type { ProcessInstance, ApprovalRecord } from './engine';

export const leaveStore = new Map<string, LeaveApplication>();
export const instanceStore = new Map<string, LeaveInstance>();
export const historyStore = new Map<string, LeaveHistory[]>();

const now = () => new Date().toISOString();

export function isVersionReferenced(versionId: string): boolean {
  for (const inst of instanceStore.values()) {
    if (inst.versionId === versionId) return true;
  }
  return false;
}

// ---- seed: 覆盖四种状态的示例实例 ----
function seedInstance(seed: {
  id: string;
  applicant: string;
  formData: Omit<LeaveApplication, 'id' | 'applicant' | 'processInstanceId' | 'processStatus' | 'createdAt'>;
  instance: { flowId: string; flowName: string; versionId: string; status: LeaveStatus; currentNodeId: string };
  history: Array<Omit<LeaveHistory, 'id' | 'processInstanceId' | 'time'>>;
}) {
  const pid = `inst-${seed.id}`;
  const app: LeaveApplication = {
    id: `app-${seed.id}`,
    applicant: seed.applicant,
    ...seed.formData,
    processInstanceId: pid,
    processStatus: seed.instance.status,
    createdAt: now(),
  };
  const inst: LeaveInstance = {
    id: pid,
    ...seed.instance,
    createdAt: now(),
  };
  leaveStore.set(app.id, app);
  instanceStore.set(pid, inst);
  historyStore.set(
    pid,
    seed.history.map((h) => ({ ...h, id: `hist-${seed.id}-${h.action}`, processInstanceId: pid, time: now() })),
  );
}

seedInstance({
  id: 'approving-1',
  applicant: '张三',
  formData: { leaveType: '年假', startDate: '2026-08-24', endDate: '2026-08-25', days: 2, reason: '家庭出游' },
  instance: { flowId: 'leave-approval-flow', flowName: '请假审批', versionId: 'ver-leave-1', status: 'approving', currentNodeId: 'approve_supervisor' },
  history: [
    { nodeId: 'leave_start', nodeTitle: '请假申请', action: 'submit', approver: '张三', comment: '提交申请' },
  ],
});
seedInstance({
  id: 'returned-1',
  applicant: '张三',
  formData: { leaveType: '事假', startDate: '2026-08-27', endDate: '2026-08-29', days: 3, reason: '家事' },
  instance: { flowId: 'leave-approval-flow', flowName: '请假审批', versionId: 'ver-leave-1', status: 'returned', currentNodeId: 'leave_start' },
  history: [
    { nodeId: 'leave_start', nodeTitle: '请假申请', action: 'submit', approver: '张三', comment: '提交申请' },
    { nodeId: 'approve_supervisor', nodeTitle: '直属主管审批', action: 'reject', approver: '李四', comment: '事由不明确，请补充' },
  ],
});
seedInstance({
  id: 'approved-1',
  applicant: '张三',
  formData: { leaveType: '病假', startDate: '2026-08-18', endDate: '2026-08-19', days: 2, reason: '感冒就医', diagnosisNote: '附诊断书' },
  instance: { flowId: 'leave-approval-flow', flowName: '请假审批', versionId: 'ver-leave-1', status: 'approved', currentNodeId: 'leave_end' },
  history: [
    { nodeId: 'leave_start', nodeTitle: '请假申请', action: 'submit', approver: '张三', comment: '提交申请' },
    { nodeId: 'approve_supervisor', nodeTitle: '直属主管审批', action: 'approve', approver: '李四', comment: '同意' },
    { nodeId: 'approve_hr', nodeTitle: '人事归档', action: 'approve', approver: '赵六', comment: '归档' },
  ],
});
seedInstance({
  id: 'withdrawn-1',
  applicant: '张三',
  formData: { leaveType: '调休', startDate: '2026-08-21', endDate: '2026-08-21', days: 1, reason: '临时取消' },
  instance: { flowId: 'leave-approval-flow', flowName: '请假审批', versionId: 'ver-leave-1', status: 'withdrawn', currentNodeId: 'approve_supervisor' },
  history: [
    { nodeId: 'leave_start', nodeTitle: '请假申请', action: 'submit', approver: '张三', comment: '提交申请' },
    { nodeId: 'leave_start', nodeTitle: '请假申请', action: 'withdraw', approver: '张三', comment: '撤回申请' },
  ],
});
```

> 注：`LeaveInstance` 与 engine 的 `ProcessInstance` 字段一致（引擎操作时用 `instanceStore` 直接转型）；`historyStore` 按 `processInstanceId` 分组存储。

- [ ] **Step 3: flow/_mock.ts 加 getVersionGraphById + DELETE 引用保护**

`src/pages/flow/_mock.ts`：
1. 顶部加：`import { isVersionReferenced } from '../oa/hr/leave/store';`
2. 导出工具（供 oa mock 取图 + 按业务编码解析流程）：注意导入路径应为 `../../../flow/_mock`（从 `src/pages/oa/hr/leave/` 到 `src/pages/flow/`）。

```ts
export function getVersionGraphById(vid: string): Record<string, any> | undefined {
  return versions.get(vid)?.graphJson;
}

// 业务编码 → 流程引用（当前 active 版本）；spec [S4]：业务页面按 code 绑定流程
export function getFlowByCode(code: string): { flowId: string; flowName: string; versionId: string | null } | undefined {
  for (const f of flows.values()) {
    if (f.code === code) {
      return { flowId: f.id, flowName: f.name, versionId: f.activeVersionId };
    }
  }
  return undefined;
}
```

3. `DELETE /api/flow/:id/version/:vid` handler 开头（`versions.delete` 之前）加：

```ts
    if (isVersionReferenced(req.params.vid)) {
      return res.json({ success: false, errorMessage: '该版本已被运行中的流程实例引用，无法删除' });
    }
```

- [ ] **Step 4: _mock.ts 端点**

`src/pages/oa/hr/leave/_mock.ts`：

```ts
import {
  approve,
  reject,
  resubmit,
  startInstance,
  type ApprovalRecord,
  type ProcessInstance,
} from './engine';
import { historyStore, instanceStore, leaveStore } from './store';
import { getVersionGraphById } from '../../flow/_mock';

const now = () => new Date().toISOString();
const sid = () => Math.random().toString(36).slice(2, 10);

const statusMap: Record<string, API.LeaveStatus> = {
  approving: 'approving',
  returned: 'returned',
  approved: 'approved',
  withdrawn: 'withdrawn',
};

function joinApp(inst: ProcessInstance): API.LeaveApplication | undefined {
  for (const app of leaveStore.values()) {
    if (app.processInstanceId === inst.id) return app;
  }
  return undefined;
}

function engineStore() {
  return {
    instances: instanceStore as unknown as Map<string, ProcessInstance>,
    history: [] as ApprovalRecord[],
    getGraph: (versionId: string) => getVersionGraphById(versionId) as any,
  };
}

function flushHistory(store: ReturnType<typeof engineStore>, pid: string) {
  // engine 将历史写入 store.history（每次调用新建的临时数组），取出后追加进 historyStore
  const pending = (store.history as ApprovalRecord[]).splice(0);
  if (pending.length === 0) return;
  const list = historyStore.get(pid) ?? [];
  list.push(...pending);
  historyStore.set(pid, list);
}

export default {
  'GET /api/oa/leave/flow': (_req: any, res: any) => {
    const ref = getFlowByCode('leave_approval');
    if (!ref || !ref.versionId) return res.json({ success: false, errorMessage: 'leave flow not found' });
    res.json({ data: ref, success: true });
  },
  'POST /api/oa/leave/application': (req: any, res: any) => {
    const { applicant, formData } = req.body;
    // 新发起始终绑定流程当前 active 版本（spec [S4]）
    const ref = getFlowByCode('leave_approval');
    if (!ref || !ref.versionId) return res.json({ success: false, errorMessage: 'leave flow not found' });
    const appId = sid();
    const pid = sid();
    const app: API.LeaveApplication = {
      id: appId,
      applicant,
      ...formData,
      processInstanceId: pid,
      processStatus: 'approving',
      createdAt: now(),
    };
    leaveStore.set(appId, app);
    const store = engineStore();
    startInstance(store, {
      id: pid,
      flowId: ref.flowId,
      flowName: ref.flowName,
      versionId: ref.versionId,
      applicant,
      payload: formData,
    });
    flushHistory(store, pid);
    res.json({ data: app, success: true });
  },
  'POST /api/oa/leave/application/:pid/resubmit': (req: any, res: any) => {
    const pid = req.params.pid;
    const app = [...leaveStore.values()].find((a) => a.processInstanceId === pid);
    if (!app) return res.json({ success: false, errorMessage: 'application not found' });
    Object.assign(app, req.body.formData, { processStatus: 'approving' });
    const store = engineStore();
    resubmit(store, pid, { applicant: app.applicant, payload: req.body.formData });
    flushHistory(store, pid);
    res.json({ data: app, success: true });
  },
  'POST /api/oa/leave/application/:pid/withdraw': (req: any, res: any) => {
    const pid = req.params.pid;
    const app = [...leaveStore.values()].find((a) => a.processInstanceId === pid);
    if (!app) return res.json({ success: false, errorMessage: 'application not found' });
    const store = engineStore();
    withdraw(store, pid, { approver: app.applicant });
    flushHistory(store, pid);
    app.processStatus = 'withdrawn';
    res.json({ success: true });
  },
  'GET /api/oa/leave/my-applications': (req: any, res: any) => {
    const list = [...leaveStore.values()]
      .filter((a) => a.applicant === req.query.applicant)
      .map((a) => {
        const inst = instanceStore.get(a.processInstanceId);
        return {
          ...a,
          flowName: inst?.flowName ?? '',
          currentNodeId: inst?.currentNodeId ?? '',
          versionId: inst?.versionId ?? '',
        };
      })
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    res.json({ data: list, success: true });
  },
  'GET /api/oa/leave/my-tasks': (_req: any, res: any) => {
    const list = [...instanceStore.values()]
      .filter((i) => i.status === 'approving')
      .map((i) => {
        const app = joinApp(i);
        return {
          processInstanceId: i.id,
          flowName: i.flowName,
          currentNodeId: i.currentNodeId,
          applicant: app?.applicant ?? '',
          leaveType: app?.leaveType ?? '',
          days: app?.days ?? 0,
          startDate: app?.startDate ?? '',
          endDate: app?.endDate ?? '',
          reason: app?.reason ?? '',
          submittedAt: app?.createdAt ?? '',
        };
      })
      .sort((x, y) => y.submittedAt.localeCompare(x.submittedAt));
    res.json({ data: list, success: true });
  },
  'GET /api/oa/leave/my-done': (_req: any, res: any) => {
    const list: any[] = [];
    for (const [pid, history] of historyStore) {
      for (const h of history) {
        if (h.action !== 'approve' && h.action !== 'reject') continue;
        const app = [...leaveStore.values()].find((a) => a.processInstanceId === pid);
        list.push({
          processInstanceId: pid,
          applicant: app?.applicant ?? '',
          leaveType: app?.leaveType ?? '',
          days: app?.days ?? 0,
          nodeTitle: h.nodeTitle,
          action: h.action,
          comment: h.comment,
          time: h.time,
        });
      }
    }
    list.sort((x, y) => y.time.localeCompare(x.time));
    res.json({ data: list, success: true });
  },
  'POST /api/oa/leave/task/:pid/approve': (req: any, res: any) => {
    const pid = req.params.pid;
    const { action, comment, approver } = req.body;
    const app = [...leaveStore.values()].find((a) => a.processInstanceId === pid);
    if (!app) return res.json({ success: false, errorMessage: 'application not found' });
    const store = engineStore();
    if (action === 'approve') {
      approve(store, pid, { approver, comment, payload: app as unknown as Record<string, any> });
      app.processStatus = statusMap[instanceStore.get(pid)?.status ?? 'approving'];
    } else {
      reject(store, pid, { approver, comment });
      app.processStatus = 'returned';
    }
    flushHistory(store, pid);
    res.json({ success: true });
  },
  'GET /api/oa/leave/instance/:pid': (req: any, res: any) => {
    const pid = req.params.pid;
    const inst = instanceStore.get(pid);
    const app = [...leaveStore.values()].find((a) => a.processInstanceId === pid);
    if (!inst || !app) return res.json({ success: false, errorMessage: 'instance not found' });
    res.json({
      data: { application: app, instance: inst, history: historyStore.get(pid) ?? [] },
      success: true,
    });
  },
};
```

> 说明：`engineStore()` 每次调用新建 `history` 临时数组，engine 的 pushHistory 写入其中；`flushHistory` 取出追加进 `historyStore`（按 processInstanceId 分组）。若实现中发现更简洁方案（如 history 数组按 pid 分组），允许调整，但必须保证：①提交/审批/驳回/重提/撤回后 historyStore 与实例状态一致；②`my-done` 返回的审批记录包含 seed 数据。

- [ ] **Step 5: service.ts**

`src/pages/oa/hr/leave/service.ts`：

```ts
import { request } from '@umijs/max';

interface Res<T> {
  data: T;
  success: boolean;
}

export async function getLeaveFlow() {
  return (await request<Res<API.LeaveFlowRef>>('/api/oa/leave/flow')).data;
}

export async function createLeaveApplication(data: {
  applicant: string;
  formData: Record<string, any>;
}) {
  return (
    await request<Res<API.LeaveApplication>>('/api/oa/leave/application', {
      method: 'POST',
      data,
    })
  ).data;
}

export async function resubmitApplication(pid: string, formData: Record<string, any>) {
  return (
    await request<Res<API.LeaveApplication>>(`/api/oa/leave/application/${pid}/resubmit`, {
      method: 'POST',
      data: { formData },
    })
  ).data;
}

export async function withdrawApplication(pid: string) {
  await request<Res<null>>(`/api/oa/leave/application/${pid}/withdraw`, {
    method: 'POST',
  });
}

export interface MyApplicationRow extends API.LeaveApplication {
  flowName: string;
  currentNodeId: string;
  versionId: string;
}

export async function listMyApplications(applicant: string) {
  return (
    await request<Res<MyApplicationRow[]>>('/api/oa/leave/my-applications', {
      params: { applicant },
    })
  ).data;
}

export interface PendingTaskRow {
  processInstanceId: string;
  flowName: string;
  currentNodeId: string;
  applicant: string;
  leaveType: string;
  days: number;
  startDate: string;
  endDate: string;
  reason: string;
  submittedAt: string;
}

export async function listMyPendingTasks() {
  return (await request<Res<PendingTaskRow[]>>('/api/oa/leave/my-tasks')).data;
}

export interface DoneRow {
  processInstanceId: string;
  applicant: string;
  leaveType: string;
  days: number;
  nodeTitle: string;
  action: 'approve' | 'reject';
  comment: string;
  time: string;
}

export async function listMyDone() {
  return (await request<Res<DoneRow[]>>('/api/oa/leave/my-done')).data;
}

export async function approveTask(
  pid: string,
  data: { action: 'approve' | 'reject'; comment: string; approver: string },
) {
  await request<Res<null>>(`/api/oa/leave/task/${pid}/approve`, {
    method: 'POST',
    data,
  });
}

export interface InstanceDetail {
  application: API.LeaveApplication;
  instance: API.LeaveInstance;
  history: API.LeaveHistory[];
}

export async function getInstanceDetail(pid: string) {
  return (
    await request<Res<InstanceDetail>>(`/api/oa/leave/instance/${pid}`)
  ).data;
}
```

- [ ] **Step 6: 验证**

Run: `npm.cmd run tsc` 与 `npx.cmd vitest run src/pages/oa/hr/leave/engine.test.ts`
Expected: tsc 退出码 0；engine 测试 9/9 PASS。

- [ ] **Step 7: 提交**

```bash
git add src/pages/oa/hr/leave/store.ts src/pages/oa/hr/leave/_mock.ts src/pages/oa/hr/leave/service.ts src/pages/oa/hr/leave/data.d.ts src/pages/flow/_mock.ts
git commit -m "feat(oa): leave approval mock stores, endpoints and version reference guard"
```

---

### Task 7: /oa/hr/leave 页面（四 Tab）

**Covers:** [S7]

**Files:**
- Create: `src/pages/oa/hr/leave/index.tsx`、`components/ApplyForm.tsx`、`components/InstanceDrawer.tsx`、`components/ApproveModal.tsx`

**Interfaces:**
- Consumes: `service.ts` 全部导出；`useModel('@@initialState')` 取 `currentUser.name`（无则 `'admin'`）
- Produces: 页面四 Tab（发起申请 / 我的申请 / 待我审批 / 已办）+ 详情 Drawer + 撤回/重提/审批弹窗

- [ ] **Step 1: ApplyForm.tsx（发起/重提表单，含病假显隐）**

`src/pages/oa/hr/leave/components/ApplyForm.tsx`：

```tsx
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Form, message } from 'antd';
import { createLeaveApplication, resubmitApplication } from '../service';

export interface ApplyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicant: string;
  pid?: string; // 重提时传入 processInstanceId
  initialValues?: Partial<Record<string, any>>;
  onSuccess?: () => void;
}

export default function ApplyForm(props: ApplyFormProps) {
  const { open, onOpenChange, applicant, pid, initialValues, onSuccess } = props;
  const [form] = Form.useForm();
  const leaveType = Form.useWatch('leaveType', form);
  const startDate = Form.useWatch('startDate', form);
  const endDate = Form.useWatch('endDate', form);
  const [rejectComment, setRejectComment] = useState<string>();

  // 天数自动计算：起止日期差 + 1（含首尾）
  useEffect(() => {
    const start = startDate as dayjs.Dayjs | string | undefined;
    const end = endDate as dayjs.Dayjs | string | undefined;
    if (!start || !end) return;
    const s = dayjs.isDayjs(start) ? start : dayjs(start);
    const e = dayjs.isDayjs(end) ? end : dayjs(end);
    if (!s.isValid() || !e.isValid() || e.isBefore(s)) return;
    form.setFieldValue('days', e.diff(s, 'day') + 1);
  }, [startDate, endDate, form]);

  // 重提模式：展示最近一次驳回意见
  useEffect(() => {
    if (!pid) return;
    getInstanceDetail(pid).then((d) => {
      const last = [...d.history].reverse().find((h) => h.action === 'reject');
      setRejectComment(last?.comment);
    });
  }, [pid]);

  return (
    <ModalForm<Record<string, any>>
      title={pid ? '重新提交申请' : '发起请假申请'}
      open={open}
      onOpenChange={onOpenChange}
      initialValues={initialValues}
      form={form}
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (pid) {
          await resubmitApplication(pid, values);
          message.success('已重新提交');
        } else {
          await createLeaveApplication({ applicant, formData: values });
          message.success('已提交，等待审批');
        }
        onSuccess?.();
        return true;
      }}
    >
      {pid && rejectComment && (
        <Alert
          type="warning"
          showIcon
          message="驳回意见"
          description={rejectComment}
          style={{ marginBottom: 16 }}
        />
      )}
      <ProFormText name="applicant" label="姓名" initialValue={applicant} disabled />
      <ProFormSelect
        name="leaveType"
        label="请假类型"
        options={[
          { label: '年假', value: '年假' },
          { label: '事假', value: '事假' },
          { label: '病假', value: '病假' },
          { label: '调休', value: '调休' },
        ]}
        rules={[{ required: true, message: '请选择请假类型' }]}
      />
      <ProFormDatePicker name="startDate" label="开始日期" rules={[{ required: true, message: '请选择开始日期' }]} />
      <ProFormDatePicker name="endDate" label="结束日期" rules={[{ required: true, message: '请选择结束日期' }]} />
      <ProFormDigit name="days" label="请假天数" min={0.5} disabled rules={[{ required: true, message: '请输入天数' }]} />
      <ProFormTextArea name="reason" label="事由" rules={[{ required: true, message: '请填写事由' }]} />
      {leaveType === '病假' && (
        <ProFormText name="diagnosisNote" label="诊断说明" rules={[{ required: true, message: '病假需填写诊断说明' }]} />
      )}
    </ModalForm>
  );
}
```

> 天数由起止日期自动计算（只读展示，spec [S7]\"天数（自动计算）\"）；重提模式经 `getInstanceDetail(pid)` 取最近驳回意见并用 Alert 展示。import 需补充：`useEffect, useState`（react）、`Alert`（antd）、`dayjs`、`getInstanceDetail`（../service）。`Form.useFormInstance` 改为组件内 `const [form] = Form.useForm()` + `form={form}` 传入 ModalForm（以 tsc 通过为准）。

- [ ] **Step 2: ApproveModal.tsx**

`src/pages/oa/hr/leave/components/ApproveModal.tsx`：

```tsx
import { ModalForm, ProFormTextArea } from '@ant-design/pro-components';
import { message } from 'antd';
import { approveTask } from '../service';

export interface ApproveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pid: string;
  action: 'approve' | 'reject';
  approver: string;
  onSuccess?: () => void;
}

export default function ApproveModal(props: ApproveModalProps) {
  const { open, onOpenChange, pid, action, approver, onSuccess } = props;
  return (
    <ModalForm
      title={action === 'approve' ? '通过申请' : '驳回申请'}
      open={open}
      onOpenChange={onOpenChange}
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        await approveTask(pid, { action, comment: values.comment ?? '', approver });
        message.success(action === 'approve' ? '已通过' : '已驳回（退回申请人）');
        onSuccess?.();
        return true;
      }}
    >
      <ProFormTextArea
        name="comment"
        label="审批意见"
        rules={action === 'reject' ? [{ required: true, message: '驳回请填写意见' }] : undefined}
      />
    </ModalForm>
  );
}
```

- [ ] **Step 3: InstanceDrawer.tsx（详情：Descriptions + Timeline）**

`src/pages/oa/hr/leave/components/InstanceDrawer.tsx`：

```tsx
import { Drawer, Descriptions, Tag, Timeline } from 'antd';
import { useEffect, useState } from 'react';
import { getInstanceDetail, type InstanceDetail } from '../service';

const statusMap: Record<string, { text: string; color: string }> = {
  approving: { text: '审批中', color: 'processing' },
  returned: { text: '已退回', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  withdrawn: { text: '已撤回', color: 'default' },
};
const actionMap: Record<string, string> = {
  submit: '提交申请',
  approve: '通过',
  reject: '驳回',
  resubmit: '重新提交',
  withdraw: '撤回申请',
};

export default function InstanceDrawer({
  pid,
  open,
  onClose,
}: {
  pid: string;
  open: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<InstanceDetail>();
  useEffect(() => {
    if (!pid || !open) return;
    getInstanceDetail(pid).then(setDetail);
  }, [pid, open]);
  const app = detail?.application;
  const status = statusMap[detail?.instance.status ?? 'approving'] ?? { text: '-', color: 'default' };
  return (
    <Drawer title="申请详情" width={560} open={open} onClose={onClose}>
      {app && (
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'applicant', label: '申请人', children: app.applicant },
            { key: 'leaveType', label: '请假类型', children: app.leaveType },
            { key: 'range', label: '起止日期', children: `${app.startDate} ~ ${app.endDate}` },
            { key: 'days', label: '天数', children: app.days },
            { key: 'reason', label: '事由', children: app.reason },
            ...(app.diagnosisNote ? [{ key: 'diagnosis', label: '诊断说明', children: app.diagnosisNote }] : []),
            { key: 'status', label: '状态', children: <Tag color={status.color}>{status.text}</Tag> },
          ]}
        />
      )}
      <h4 style={{ marginTop: 24 }}>流转历史</h4>
      <Timeline
        items={(detail?.history ?? []).map((h) => ({
          color: h.action === 'reject' ? 'red' : h.action === 'approve' ? 'green' : 'blue',
          children: (
            <div>
              <div>
                {h.nodeTitle} · {actionMap[h.action] ?? h.action} · {h.approver}
              </div>
              <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                {h.comment || '无意见'} · {h.time}
              </div>
            </div>
          ),
        }))}
      />
    </Drawer>
  );
}
```

- [ ] **Step 4: index.tsx（四 Tab 页面）**

`src/pages/oa/hr/leave/index.tsx`：

```tsx
import { PageContainer } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Popconfirm, Space, Tabs, Tag, message } from 'antd';
import { useModel } from '@umijs/max';
import { useEffect, useState } from 'react';
import {
  listMyApplications,
  listMyDone,
  listMyPendingTasks,
  withdrawApplication,
  type DoneRow,
  type MyApplicationRow,
  type PendingTaskRow,
} from './service';
import ApplyForm from './components/ApplyForm';
import ApproveModal from './components/ApproveModal';
import InstanceDrawer from './components/InstanceDrawer';

const statusMap: Record<string, { text: string; color: string }> = {
  approving: { text: '审批中', color: 'processing' },
  returned: { text: '已退回', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  withdrawn: { text: '已撤回', color: 'default' },
};

export default function LeaveApproval() {
  const { initialState } = useModel('@@initialState');
  const applicant = initialState?.currentUser?.name || 'admin';
  const [tab, setTab] = useState('apply');
  const [applyOpen, setApplyOpen] = useState(false);
  const [resubmit, setResubmit] = useState<{ pid: string; values: Record<string, any> }>();
  const [detailPid, setDetailPid] = useState<string>();
  const [approve, setApprove] = useState<{ pid: string; action: 'approve' | 'reject' }>();
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((k) => k + 1);

  const myAppColumns = [
    { title: '请假类型', dataIndex: 'leaveType' },
    { title: '起止日期', render: (_, r: MyApplicationRow) => `${r.startDate} ~ ${r.endDate}` },
    { title: '天数', dataIndex: 'days', width: 70 },
    { title: '状态', dataIndex: 'processStatus', width: 90, render: (_, r: MyApplicationRow) => <Tag color={statusMap[r.processStatus]?.color}>{statusMap[r.processStatus]?.text}</Tag> },
    { title: '提交时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      width: 200,
      render: (_, r: MyApplicationRow) => (
        <Space size="medium">
          <a onClick={() => setDetailPid(r.processInstanceId)}>详情</a>
          {r.processStatus === 'approving' && (
            <Popconfirm title="确认撤回该申请?" onConfirm={async () => { await withdrawApplication(r.processInstanceId); message.success('已撤回'); refresh(); }}>
              <a style={{ color: '#faad14' }}>撤回</a>
            </Popconfirm>
          )}
          {r.processStatus === 'returned' && (
            <a onClick={() => setResubmit({ pid: r.processInstanceId, values: { ...r } })}>编辑重提</a>
          )}
        </Space>
      ),
    },
  ];

  const taskColumns = [
    { title: '申请人', dataIndex: 'applicant', width: 100 },
    { title: '请假类型', dataIndex: 'leaveType', width: 100 },
    { title: '起止日期', render: (_, r: PendingTaskRow) => `${r.startDate} ~ ${r.endDate}` },
    { title: '天数', dataIndex: 'days', width: 70 },
    { title: '事由', dataIndex: 'reason', ellipsis: true },
    { title: '提交时间', dataIndex: 'submittedAt' },
    {
      title: '操作',
      width: 180,
      render: (_, r: PendingTaskRow) => (
        <Space size="medium">
          <a onClick={() => setDetailPid(r.processInstanceId)}>详情</a>
          <a onClick={() => setApprove({ pid: r.processInstanceId, action: 'approve' })}>通过</a>
          <a style={{ color: '#ff4d4f' }} onClick={() => setApprove({ pid: r.processInstanceId, action: 'reject' })}>
            驳回
          </a>
        </Space>
      ),
    },
  ];

  const doneColumns = [
    { title: '申请人', dataIndex: 'applicant', width: 100 },
    { title: '请假类型', dataIndex: 'leaveType', width: 100 },
    { title: '天数', dataIndex: 'days', width: 70 },
    { title: '审批节点', dataIndex: 'nodeTitle' },
    { title: '动作', dataIndex: 'action', width: 80, render: (_, r: DoneRow) => (r.action === 'approve' ? <Tag color="green">通过</Tag> : <Tag color="red">驳回</Tag>) },
    { title: '意见', dataIndex: 'comment', ellipsis: true },
    { title: '时间', dataIndex: 'time' },
  ];

  return (
    <PageContainer>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'apply',
            label: '发起申请',
            children: (
              <Button type="primary" onClick={() => setApplyOpen(true)}>
                发起请假申请
              </Button>
            ),
          },
          {
            key: 'mine',
            label: '我的申请',
            children: (
              <ProTable<MyApplicationRow>
                rowKey="id"
                search={false}
                params={{ applicant, reloadKey }}
                request={async (p) => ({ data: await listMyApplications(p.applicant), success: true })}
                columns={myAppColumns}
              />
            ),
          },
          {
            key: 'todo',
            label: '待我审批',
            children: (
              <ProTable<PendingTaskRow>
                rowKey="processInstanceId"
                search={false}
                params={{ reloadKey }}
                request={async () => ({ data: await listMyPendingTasks(), success: true })}
                columns={taskColumns}
              />
            ),
          },
          {
            key: 'done',
            label: '已办',
            children: (
              <ProTable<DoneRow>
                rowKey={(r) => `${r.processInstanceId}-${r.time}`}
                search={false}
                params={{ reloadKey }}
                request={async () => ({ data: await listMyDone(), success: true })}
                columns={doneColumns}
              />
            ),
          },
        ]}
      />
      <ApplyForm
        open={applyOpen}
        onOpenChange={setApplyOpen}
        applicant={applicant}
        onSuccess={() => { setApplyOpen(false); setTab('mine'); refresh(); }}
      />
      <ApplyForm
        open={!!resubmit}
        onOpenChange={(o) => !o && setResubmit(undefined)}
        applicant={applicant}
        pid={resubmit?.pid}
        initialValues={resubmit?.values}
        onSuccess={() => { setResubmit(undefined); refresh(); }}
      />
      <ApproveModal
        open={!!approve}
        onOpenChange={(o) => !o && setApprove(undefined)}
        pid={approve?.pid ?? ''}
        action={approve?.action ?? 'approve'}
        approver={applicant}
        onSuccess={() => { setApprove(undefined); refresh(); }}
      />
      <InstanceDrawer pid={detailPid ?? ''} open={!!detailPid} onClose={() => setDetailPid(undefined)} />
    </PageContainer>
  );
}
```

> 说明：`我的申请` 的"编辑重提"直接把整行作为 initialValues（含 applicant/processStatus 等冗余字段，ProForm 只取同名字段）。重提成功后当前实例状态由 mock 更新，列表 `reloadKey` 触发刷新。

- [ ] **Step 5: 验证**

Run: `npm.cmd run tsc`、`npm.cmd run lint`、`npx.cmd antd lint ./src`
Expected: 均退出码 0（antd lint 仅既有 30 条 message 警告）。

- [ ] **Step 6: 提交**

```bash
git add src/pages/oa/hr/leave/index.tsx src/pages/oa/hr/leave/components
git commit -m "feat(oa): leave approval page with apply/mine/todo/done tabs"
```

---

### Task 8: 路由 + 菜单 + i18n + 全量验证

**Covers:** [S9], [S10], [S11]

**Files:**
- Modify: `config/routes.ts`、`src/locales/{zh-CN,en-US,ja-JP,ko-KR,id-ID,pt-BR,vi-VN,zh-TW}/menu.ts`

- [ ] **Step 1: routes.ts 加 /oa 分组**

`config/routes.ts` 中 `/flow/:id` 之后插入：

```ts
  {
    path: '/oa',
    name: 'oa',
    icon: 'appstore',
    routes: [
      {
        path: '/oa/hr',
        name: 'oa-hr',
        routes: [
          {
            path: '/oa/hr/leave',
            name: 'oa-hr-leave',
            component: './oa/hr/leave',
          },
        ],
      },
      {
        path: '/oa/finance',
        name: 'oa-finance',
      },
    ],
  },
```

> 说明：`/oa/finance` 暂无 component，仅作为菜单组骨架（无子项时 antd pro 菜单组可能不显示子菜单——若 `/oa/finance` 空节点导致菜单异常，则删除该节点，仅保留 `/oa/hr` 分组，后续业务再加回）。以 dev 手验结果为准。

- [ ] **Step 2: 8 语言 menu.ts**

每个 `src/locales/<locale>/menu.ts` 末尾追加：

| 键 | zh-CN | en-US | ja-JP | ko-KR | id-ID | pt-BR | vi-VN | zh-TW |
|---|---|---|---|---|---|---|---|---|
| `menu.oa` | 办公应用 | Office Apps | オフィスアプリ | 오피스 앱 | Aplikasi Kantor | Aplicativos de Escritório | Ứng dụng văn phòng | 辦公應用 |
| `menu.oa.hr` | 人事管理 | HR Management | 人事管理 | 인사 관리 | Manajemen SDM | Gestão de RH | Quản lý nhân sự | 人事管理 |
| `menu.oa.hr.leave` | 请假审批 | Leave Approval | 休暇申請 | 휴가 승인 | Persetujuan Cuti | Aprovação de Licença | Phê duyệt nghỉ phép | 請假審批 |

键名注意：routes 中 `name: 'oa-hr-leave'` 会映射 `menu.oa-hr-leave`——**键名必须与路由 name 一致**（`menu.oa`、`menu.oa-hr`、`menu.oa-hr-leave`），而非 spec 表格中的点号形式；以 umi 路由 name → `menu.<name>` 约定为准（参照现有 `menu.flow-editor`、`menu.system.system-user` 的连字符/点号两种既有形式，**以路由 name 实际值决定**：本计划路由 name 用连字符，故键为 `menu.oa-hr-leave`）。

- [ ] **Step 3: 全量验证**

Run:
```powershell
npm.cmd run tsc
npm.cmd run lint
npx.cmd vitest run
npm.cmd run build
```
Expected: 全部退出码 0；vitest 全量通过（含 9 个引擎用例）。

- [ ] **Step 4: dev 端到端手验**

`npm.cmd start`，按 spec [S11] 场景验证：
1. 侧栏出现"办公应用 > 人事管理 > 请假审批"菜单，进入 `/oa/hr/leave`
2. 发起申请：填 ≤3 天（非病假）→ 提交 → 跳到"我的申请"显示"审批中"
3. 待我审批出现该申请 → 通过 → 推进到"人事归档"（天数 ≤3 分支）
4. 再通过 → 我的申请显示"已通过"
5. 发起 >3 天申请 → 待办"直属主管审批"通过 → 出现"部门负责人审批"待办（多级链路）
6. 驳回某申请（填意见）→ 我的申请显示"已退回" → 编辑重提 → 重新进入待办
7. 审批中撤回 → 显示"已撤回"
8. 详情 Drawer：Descriptions + Timeline 完整（含 seed 数据四条实例）
9. 流程管理删除"请假审批"的 v1 版本 → 提示"已被实例引用，无法删除"
10. `/flow-editor?flowId=leave-approval-flow&versionId=ver-leave-1` 打开请假审批图 → 改图保存为新版本 → 启动 → 新发起仍按新图运行

- [ ] **Step 5: 提交**

```bash
git add config/routes.ts src/locales
git commit -m "feat(oa): add office apps routes, menu and i18n"
```

---

## Self-Review 记录

- **Spec 覆盖**：[S2]→Task2；[S3]→Task3；[S4]→Task1,5；[S5]→Task5,6；[S6]→Task5；[S7]→Task7；[S8]→Task4,6；[S9],[S10]→Task8；[S11]→Task8 验证。无遗漏。
- **已知偏差**：spec S10 要求页面文案 useIntl——实际项目惯例（flow/system 页面）为中文字面量，计划按实际惯例执行（已在本文件 Global Constraints 注明）。
- **类型一致性**：引擎 `ProcessInstance`/`ApprovalRecord` 与 `API.LeaveInstance`/`API.LeaveHistory` 字段一致（`_mock.ts` 用 `as unknown as` 桥接）；`evaluateCondition` 签名与测试一致；`approveTask` action 枚举一致。

---

# 第二阶段：三项改造（spec 已更新批准）

> 改造内容（spec [S3]/[S5]/[S6]/[S7]/[S8]/[S9]/[S12]）：①查看/编辑升级为独立页面（参考高级详情页 profile/advanced）；②流程图只连前进方向，退回走 `data.rejectTo` ?? start（默认或配置）；③撤回（withdrawn）后也可编辑重提。

### Task 9: 引擎改造（reject 退回目标 + resubmit 放宽，TDD）

**Covers:** [S5], [S6]

**Files:**
- Modify: `src/pages/oa/hr/leave/engine.ts`、`src/pages/oa/hr/leave/engine.test.ts`

**Interfaces:**
- 保持全部现有导出签名不变；行为变化：`reject` 的退回目标 = 当前 approval 节点 `data.rejectTo` ?? 图内 start 节点；`resubmit` 守卫从 `returned` 放宽为 `returned | withdrawn`。

- [ ] **Step 1: 先写失败测试**（`engine.test.ts` 追加 `describe('reject target and resubmit after withdraw')`）：

```ts
describe('reject target and resubmit after withdraw', () => {
  // 无 reject 边的夹具图（只连前进方向）
  const forwardGraph: EngineGraph = {
    nodes: [
      { id: 'start', type: 'start', data: { title: '开始' } },
      { id: 'app1', type: 'approval', data: { title: '直属主管审批', approvalRole: 'direct_supervisor' } },
      { id: 'end', type: 'end', data: { title: '结束' } },
    ],
    edges: [
      { sourceNodeID: 'start', targetNodeID: 'app1' },
      { sourceNodeID: 'app1', targetNodeID: 'end', sourcePortID: 'pass' },
    ],
  };

  it('默认退回：reject 后 currentNodeId 指向 start（无 reject 边）', () => {
    const store = makeStore(forwardGraph);
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: {} });
    reject(store, 'i1', { approver: '李四', comment: '退回' });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('returned');
    expect(inst.currentNodeId).toBe('start');
  });

  it('配置退回：approval 节点 data.rejectTo 指定退回目标', () => {
    const graph: EngineGraph = {
      nodes: [
        { id: 'start', type: 'start', data: { title: '开始' } },
        { id: 'app1', type: 'approval', data: { title: '主管审批', rejectTo: 'start' } },
        { id: 'app2', type: 'approval', data: { title: '部门负责人' } },
        { id: 'end', type: 'end', data: { title: '结束' } },
      ],
      edges: [
        { sourceNodeID: 'start', targetNodeID: 'app1' },
        { sourceNodeID: 'app1', targetNodeID: 'app2', sourcePortID: 'pass' },
        { sourceNodeID: 'app2', targetNodeID: 'end', sourcePortID: 'pass' },
      ],
    };
    const store = makeStore(graph);
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: {} });
    approve(store, 'i1', { approver: '李四', comment: '', payload: {} }); // 到 app2
    expect(store.instances.get('i1')!.currentNodeId).toBe('app2');
    // app2 未配置 rejectTo → 默认退回 start
    reject(store, 'i1', { approver: '王五', comment: '' });
    expect(store.instances.get('i1')!.currentNodeId).toBe('start');
  });

  it('撤回后（withdrawn）可 resubmit 重新走流程', () => {
    const store = makeStore(forwardGraph);
    startInstance(store, { id: 'i1', flowId: 'f1', flowName: '请假审批', versionId: 'v1', applicant: '张三', payload: {} });
    withdraw(store, 'i1', { approver: '张三' });
    expect(store.instances.get('i1')!.status).toBe('withdrawn');
    resubmit(store, 'i1', { applicant: '张三', payload: { days: 2 } });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('app1');
    expect(store.history.at(-1)!.action).toBe('resubmit');
  });
});
```

- [ ] **Step 2: 运行确认失败**（`reject` 仍要求返回旧行为或 `resubmit` 拒绝 withdrawn）：

Run: `npx.cmd vitest run src/pages/oa/hr/leave/engine.test.ts`
Expected: 新用例 FAIL（3 个中至少 2 个失败）。

- [ ] **Step 3: 修改 engine.ts**

1. `reject` 函数中，退回目标从固定 start 改为：

```ts
  const node = findNode(graph, inst.currentNodeId);
  pushHistory(store, inst.id, inst.currentNodeId, node?.data?.title ?? '', 'reject', input.approver, input.comment);
  const rejectTo = node?.data?.rejectTo as string | undefined;
  const startNode = graph.nodes.find((n) => n.type === 'start');
  inst.status = 'returned';
  inst.currentNodeId = rejectTo ?? startNode?.id ?? '';
```

2. `resubmit` 守卫从 `if (!inst || inst.status !== 'returned')` 改为 `if (!inst || (inst.status !== 'returned' && inst.status !== 'withdrawn'))`。

- [ ] **Step 4: 运行确认通过**

Run: `npx.cmd vitest run src/pages/oa/hr/leave/engine.test.ts` 与 `npm.cmd run tsc`
Expected: 全部用例 PASS（原 15 + 新 3 = 18）、tsc 退出码 0。

- [ ] **Step 5: 提交**

```bash
git add src/pages/oa/hr/leave/engine.ts src/pages/oa/hr/leave/engine.test.ts
git commit -m "feat(oa): support configured reject target and resubmit after withdraw"
```

### Task 10: approval 节点表单加 rejectTo 字段 + 预置图删除 reject 边

**Covers:** [S3], [S8]

**Files:**
- Modify: `src/pages/flow-editor/nodes/approval/form-meta.tsx`、`src/pages/flow-editor/nodes/approval/index.ts`、`src/pages/flow/_mock.ts`

**Interfaces:**
- 节点数据 `{ title, approvalRole, remark, rejectTo? }`；预置图 9 边 → 6 边（删除 3 条 `sourcePortID: 'reject'` 边）。

- [ ] **Step 1: form-meta.tsx 加"退回节点 ID"字段**

在 `remark` 的 FormItem 之后追加：

```tsx
        <FormItem name="rejectTo" label="退回节点 ID">
          <Field name="rejectTo">
            {({ field }) => (
              <input
                style={{ width: '100%' }}
                value={field.value || ''}
                disabled={readonly}
                placeholder="留空 = 退回发起人（start）"
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          </Field>
        </FormItem>
```

（与 remark 的 Field 模式一致；`readonly` 从 `useNodeRenderContext` 已解构。）

- [ ] **Step 2: index.ts onAdd 默认数据加 rejectTo**

`onAdd()` 返回的 data 加 `rejectTo: '',`（`remark: ''` 之后）。

- [ ] **Step 3: 预置图删除 reject 边**

`src/pages/flow/_mock.ts` 预置请假流程图的 `edges` 删除 3 条 `sourcePortID: 'reject'` 的边（approve_supervisor→leave_start、approve_dept→leave_start、approve_hr→leave_start），保留其余 6 条前进边。

- [ ] **Step 4: 验证**

Run: `npm.cmd run tsc`
Expected: 退出码 0。dev 手验（可选）：编辑器打开请假审批图 → 图上只有前进连线；审批节点表单出现"退回节点 ID"输入框。

- [ ] **Step 5: 提交**

```bash
git add src/pages/flow-editor/nodes/approval/form-meta.tsx src/pages/flow-editor/nodes/approval/index.ts src/pages/flow/_mock.ts
git commit -m "feat(flow-editor): add reject target field and simplify leave graph edges"
```

### Task 11: 查看页 + 编辑页 + 列表联动（参考高级详情页）

**Covers:** [S7]

**Files:**
- Create: `src/pages/oa/hr/leave/detail/index.tsx`（查看页）、`src/pages/oa/hr/leave/edit/index.tsx`（编辑页）
- Modify: `src/pages/oa/hr/leave/index.tsx`（列表联动）
- Delete: `src/pages/oa/hr/leave/components/ApplyForm.tsx`、`src/pages/oa/hr/leave/components/InstanceDrawer.tsx`

**Interfaces:**
- Consumes: `service.ts` 的 `getInstanceDetail / createLeaveApplication / resubmitApplication / withdrawApplication`（已存在）；`history`（router，`@umijs/max`）
- Produces: 查看页 `/oa/hr/leave/:pid`；编辑页 `/oa/hr/leave/edit?pid=`（无 pid = 新建）

- [ ] **Step 1: 查看页 detail/index.tsx**

结构（参考 `src/pages/profile/advanced/index.tsx`）：

```tsx
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Descriptions, Popconfirm, Space, Statistic, Steps, Tag, Timeline, message } from 'antd';
import { history, useParams } from '@umijs/max';
import { useEffect, useState } from 'react';
import { getInstanceDetail, withdrawApplication, type InstanceDetail } from '../service';

const statusMap: Record<string, { text: string; color: string }> = {
  approving: { text: '审批中', color: 'processing' },
  returned: { text: '已退回', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  withdrawn: { text: '已撤回', color: 'default' },
};
const actionMap: Record<string, string> = {
  submit: '提交申请', approve: '通过', reject: '驳回', resubmit: '重新提交', withdraw: '撤回申请',
};

export default function LeaveDetail() {
  const params = useParams<{ pid: string }>();
  const [detail, setDetail] = useState<InstanceDetail>();
  const load = () => {
    if (!params.pid) return;
    getInstanceDetail(params.pid)
      .then(setDetail)
      .catch(() => setDetail(undefined));
  };
  useEffect(load, [params.pid]);

  const app = detail?.application;
  const inst = detail?.instance;
  const status = statusMap[inst?.status ?? ''] ?? { text: '-', color: 'default' };
  // Steps：submit → 各审批/驳回/撤回节点 → 终态（按 history 的 nodeTitle 序列去重渲染）
  const stepItems = (detail?.history ?? [])
    .map((h) => ({ title: h.nodeTitle, description: `${actionMap[h.action] ?? h.action} · ${h.approver} · ${h.comment || '无意见'}` }));

  return (
    <PageContainer
      title={app ? `请假单号：${app.id}` : '请假详情'}
      content={
        app && (
          <Descriptions
            size="small"
            column={2}
            items={[
              { key: 'applicant', label: '申请人', children: app.applicant },
              { key: 'leaveType', label: '请假类型', children: app.leaveType },
              { key: 'range', label: '起止日期', children: `${app.startDate} ~ ${app.endDate}` },
              { key: 'days', label: '天数', children: app.days },
              { key: 'reason', label: '事由', children: app.reason },
              ...(app.diagnosisNote ? [{ key: 'diagnosis', label: '诊断说明', children: app.diagnosisNote }] : []),
            ]}
          />
        )
      }
      extraContent={
        inst && <Statistic title="状态" value={status.text} valueStyle={{ color: status.color === 'success' ? '#52c41a' : undefined }} />
      }
      extra={
        inst && (
          <Space size="medium">
            <Button onClick={() => history.push('/oa/hr/leave')}>返回列表</Button>
            {inst.status === 'approving' && (
              <Popconfirm
                title="确认撤回该申请?"
                onConfirm={async () => {
                  await withdrawApplication(inst.id);
                  message.success('已撤回');
                  load();
                }}
              >
                <Button danger>撤回</Button>
              </Popconfirm>
            )}
            {(inst.status === 'returned' || inst.status === 'withdrawn') && (
              <Button type="primary" onClick={() => history.push(`/oa/hr/leave/edit?pid=${inst.id}`)}>
                编辑重提
              </Button>
            )}
          </Space>
        )
      }
    >
      <Card title="流程进度" style={{ marginBottom: 24 }}>
        <Steps direction="vertical" current={stepItems.length - 1} items={stepItems} />
      </Card>
      <Card title="申请信息" style={{ marginBottom: 24 }}>
        {app && (
          <Descriptions
            column={2}
            items={[
              { key: 'id', label: '单号', children: app.id },
              { key: 'status', label: '状态', children: <Tag color={status.color}>{status.text}</Tag> },
              { key: 'applicant', label: '申请人', children: app.applicant },
              { key: 'leaveType', label: '请假类型', children: app.leaveType },
              { key: 'range', label: '起止日期', children: `${app.startDate} ~ ${app.endDate}` },
              { key: 'days', label: '天数', children: app.days },
              { key: 'reason', label: '事由', children: app.reason },
              ...(app.diagnosisNote ? [{ key: 'diagnosis', label: '诊断说明', children: app.diagnosisNote }] : []),
              { key: 'createdAt', label: '提交时间', children: app.createdAt },
            ]}
          />
        )}
      </Card>
      <Card title="审批记录">
        <Timeline
          items={(detail?.history ?? []).map((h) => ({
            color: h.action === 'reject' ? 'red' : h.action === 'approve' ? 'green' : 'blue',
            children: (
              <div>
                <div>{h.nodeTitle} · {actionMap[h.action] ?? h.action} · {h.approver}</div>
                <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{h.comment || '无意见'} · {h.time}</div>
              </div>
            ),
          }))}
        />
      </Card>
    </PageContainer>
  );
}
```

- [ ] **Step 2: 编辑页 edit/index.tsx**

结构（PageContainer + Card + ProForm + FooterToolbar；字段与旧 ApplyForm 一致；重提模式预填 + 驳回意见 Alert）：

```tsx
import { FooterToolbar, PageContainer } from '@ant-design/pro-components';
import {
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, Button, Card, Form, message } from 'antd';
import { history, useSearchParams } from '@umijs/max';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { createLeaveApplication, getInstanceDetail, resubmitApplication } from '../service';

export default function LeaveEdit() {
  const [searchParams] = useSearchParams();
  const pid = searchParams.get('pid') ?? undefined;
  const [form] = Form.useForm();
  const leaveType = Form.useWatch('leaveType', form);
  const startDate = Form.useWatch('startDate', form);
  const endDate = Form.useWatch('endDate', form);
  const [rejectComment, setRejectComment] = useState<string>();
  const [applicant, setApplicant] = useState('Serati Ma');

  // 重提模式：预填原数据 + 最近驳回意见
  useEffect(() => {
    if (!pid) return;
    getInstanceDetail(pid)
      .then((d) => {
        const a = d.application;
        setApplicant(a.applicant);
        form.setFieldsValue({
          leaveType: a.leaveType,
          startDate: dayjs(a.startDate),
          endDate: dayjs(a.endDate),
          days: a.days,
          reason: a.reason,
          diagnosisNote: a.diagnosisNote,
        });
        const last = [...d.history].reverse().find((h) => h.action === 'reject');
        setRejectComment(last?.comment);
      })
      .catch(() => setRejectComment(undefined));
  }, [pid, form]);

  // 天数自动计算（与旧 ApplyForm 一致）
  useEffect(() => {
    const start = startDate as dayjs.Dayjs | string | undefined;
    const end = endDate as dayjs.Dayjs | string | undefined;
    if (!start || !end) {
      form.setFieldValue('days', undefined);
      return;
    }
    const s = dayjs.isDayjs(start) ? start : dayjs(start);
    const e = dayjs.isDayjs(end) ? end : dayjs(end);
    if (!s.isValid() || !e.isValid() || e.isBefore(s)) {
      form.setFieldValue('days', undefined);
      return;
    }
    form.setFieldValue('days', e.diff(s, 'day') + 1);
  }, [startDate, endDate, form]);

  return (
    <PageContainer title={pid ? '重新提交申请' : '发起请假申请'}>
      <Card>
        <ProForm<Record<string, any>>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const payload = {
              ...values,
              startDate: values.startDate?.format?.('YYYY-MM-DD') ?? values.startDate,
              endDate: values.endDate?.format?.('YYYY-MM-DD') ?? values.endDate,
            };
            if (pid) {
              await resubmitApplication(pid, payload);
              message.success('已重新提交');
            } else {
              await createLeaveApplication({ applicant, formData: payload });
              message.success('已提交，等待审批');
            }
            history.push('/oa/hr/leave');
          }}
          submitter={false}
        >
          {pid && rejectComment && (
            <Alert type="warning" showIcon title="驳回意见" description={rejectComment} style={{ marginBottom: 16 }} />
          )}
          <ProFormText name="applicant" label="姓名" initialValue={applicant} disabled />
          <ProFormSelect
            name="leaveType"
            label="请假类型"
            options={[
              { label: '年假', value: '年假' },
              { label: '事假', value: '事假' },
              { label: '病假', value: '病假' },
              { label: '调休', value: '调休' },
            ]}
            rules={[{ required: true, message: '请选择请假类型' }]}
          />
          <ProFormDatePicker name="startDate" label="开始日期" rules={[{ required: true, message: '请选择开始日期' }]} />
          <ProFormDatePicker name="endDate" label="结束日期" rules={[{ required: true, message: '请选择结束日期' }]} />
          <ProFormDigit name="days" label="请假天数" min={0.5} disabled rules={[{ required: true, message: '请输入天数' }]} />
          <ProFormTextArea name="reason" label="事由" rules={[{ required: true, message: '请填写事由' }]} />
          {leaveType === '病假' && (
            <ProFormText name="diagnosisNote" label="诊断说明" rules={[{ required: true, message: '病假需填写诊断说明' }]} />
          )}
        </ProForm>
      </Card>
      <FooterToolbar>
        <Space>
          <Button onClick={() => history.push('/oa/hr/leave')}>取消</Button>
          <Button type="primary" onClick={() => form.submit()}>
            {pid ? '重新提交' : '提交申请'}
          </Button>
        </Space>
      </FooterToolbar>
    </PageContainer>
  );
}
```

（`Space` 从 antd 导入；若 applicant 需动态取自 currentUser，用 `useModel('@@initialState')`——与列表页一致，新建模式才需要。）

- [ ] **Step 3: 列表页联动 index.tsx**

1. import 移除 `ApplyForm`/`ApproveModal`/`InstanceDrawer` 与相关 state（`applyOpen`/`resubmit`/`detailPid`）；`approve` state 保留（待我审批的通过/驳回 Modal 保留 ApproveModal 组件——**ApproveModal 保留**，仅删除 ApplyForm 与 InstanceDrawer）。
2. 行操作改为路由跳转：
   - 详情：`<a onClick={() => history.push(`/oa/hr/leave/${r.processInstanceId}`)}>详情</a>`
   - 编辑重提（returned 或 withdrawn）：`<a onClick={() => history.push(`/oa/hr/leave/edit?pid=${r.processInstanceId}`)}>编辑重提</a>`
   - 撤回（approving）保留 Popconfirm。
3. 发起申请 Tab 的按钮改为：`onClick={() => history.push('/oa/hr/leave/edit')}`。
4. 删除页面底部挂载的 `<ApplyForm .../>` 与 `<InstanceDrawer .../>`；保留 `<ApproveModal .../>`。
5. `import { history } from '@umijs/max'`。

- [ ] **Step 4: 删除旧弹窗组件**

删除 `src/pages/oa/hr/leave/components/ApplyForm.tsx` 与 `src/pages/oa/hr/leave/components/InstanceDrawer.tsx`（确认无其他引用后，`git rm`）。

- [ ] **Step 5: 验证**

Run: `npm.cmd run tsc`、`npm.cmd run lint`、`npx.cmd antd lint ./src`
Expected: 均退出码 0。

- [ ] **Step 6: 提交**

```bash
git add -A src/pages/oa/hr/leave
git commit -m "feat(oa): upgrade leave detail and edit to full pages"
```

### Task 12: 路由子页 + 全量验证

**Covers:** [S9], [S11]

**Files:**
- Modify: `config/routes.ts`

- [ ] **Step 1: routes.ts 加子页**

`/oa/hr/leave` 节点改为：

```ts
          {
            path: '/oa/hr/leave',
            name: 'oa-hr-leave',
            component: './oa/hr/leave',
          },
          {
            path: '/oa/hr/leave/:pid',
            name: 'oa-hr-leave-detail',
            component: './oa/hr/leave/detail',
            hideInMenu: true,
          },
          {
            path: '/oa/hr/leave/edit',
            name: 'oa-hr-leave-edit',
            component: './oa/hr/leave/edit',
            hideInMenu: true,
          },
```

- [ ] **Step 2: 全量验证**

Run:
```powershell
npm.cmd run tsc
npm.cmd run lint
npx.cmd vitest run
npm.cmd run build
```
Expected: 全部退出码 0（vitest 18 engine + 2 store + 既有 55 = 75）。

- [ ] **Step 3: dev 端点级 e2e（流程同前，重点验证三项改造）**

后台启动 `npm.cmd start`（Start-Process + 重定向日志，**不要前台运行**），轮询就绪后验证：
1. `POST /api/oa/leave/application`（days=3）→ 待办 → approve → approve → approved（前进边链路，图已无 reject 边）
2. `POST /api/oa/leave/application`（days=6）→ approve → reject（驳回）→ `GET instance` → status=returned、currentNodeId=leave_start（默认退回）
3. 同一实例 `POST resubmit` → status=approving、currentNodeId=approve_supervisor
4. 另一实例 withdraw → `POST resubmit` → status=approving（撤回后可重提）
5. 完成后按 PID 级联清理 dev 进程树与日志（参考第二阶段前会话的做法）。

- [ ] **Step 4: 提交**

```bash
git add config/routes.ts
git commit -m "feat(oa): add leave detail and edit routes"
```
