# Spec: 流程详情页改造 + OA 请假审批示例（编辑器扩展 + mock 运行引擎）

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/oa-leave-workflow.md)

> Created: 2026-08-21
> Status: Approved (design)
> Depends on: `docs/compose/specs/2026-08-20-flow-management-design.md`（已交付的流程管理）、`/flow-editor` 编辑器（已交付）

## [S1] 目标与范围

两项工作：

1. **流程详情页改造**：`/flow/:id` 由"tabs + 可编辑 ProForm"改为**基础详情页风格**（单 Card、Descriptions 只读分区、Divider 分隔、无 tabs），对齐 `src/pages/profile/basic`。
2. **传统业务工作流示例——请假审批**：在流程编辑器基础上新增 `approval` 节点类型；预置"请假审批"流程图（mock 数据）；实现业务无关的 mock 运行引擎（按 graphJson 推进、条件分支、审批任务、终态判定）；新增独立业务页面 `/oa/hr/leave`（发起申请 / 我的申请 / 待我审批 / 已办）。

全 mock 实现，与项目 mock 体系一致（模块级内存 store）。

## [S2] 详情页改造（/flow/:id）

- 去掉 `PageContainer` tabs 与 `BasicInfo` 的可编辑 ProForm。
- 单页结构（对齐 `profile/basic`）：
  - `Card` + `Descriptions`（横排只读）：流程名称、描述、状态（Tag）、当前启用版本、创建时间、更新时间。
  - 卡片右上角"编辑"按钮 → 复用现有 `FlowForm` 弹窗（ModalForm）编辑。
  - `Divider size="large"` 分隔后接版本管理 `ProTable`（`VersionTable` 原样保留：查看→编辑器、启动/停用、删除、新建版本）。
- 改动文件：`src/pages/flow/detail/index.tsx`（重构）、`src/pages/flow/detail/components/BasicInfo.tsx`（ProForm → 只读 Descriptions 组件）；`VersionTable.tsx` 不动。

## [S3] 编辑器扩展：approval 节点

- 新目录 `src/pages/flow-editor/nodes/approval/`：
  - `index.tsx`：画布渲染（审批图标 + 标题）。
  - `form-meta.tsx`：表单字段——节点标题、审批人角色（select：直属主管 / 部门负责人 / 人事）、说明（textarea）、**退回节点 ID**（文本框，留空 = 退回发起人）。
- 注册进 `nodes/index.ts` 注册表与 `nodes/constants.ts`（沿用现有节点模式）。
- 节点**两个出端口 `pass` / `reject`**（复用 condition 节点的多端口/分支机制；plan 阶段核实其实现细节）。
- 节点数据模型：`{ title, approvalRole, remark, rejectTo? }`——`rejectTo` 为退回目标节点 ID（可选，缺省退回图内 start 节点，即"默认或配置"两种退回形式）。

## [S4] 业务与工作流关联机制

1. **业务编码关联**：`Flow` 模型新增 `code` 字段（唯一业务编码，如 `leave_approval`）。业务页面通过 `code` 找到流程定义 + 最新 active 版本；业务不硬编码流程内容。
2. **表单归业务页面**：`/oa/hr/leave` 发起表单为页面内固定设计的 ProForm——布局、字段、校验、字段间显隐控制全由页面代码掌控。提交后 formData 作为业务 payload 存入业务表。start 节点 outputs 仅作字段声明文档，**不驱动表单**。
3. **条件分支基于 payload**：condition 节点表达式求值规则限定——左值支持 `payload.<字段>` 引用实例表单数据，右值支持常量，操作符 `= != > >= < <=`；不引入通用表达式引擎。
4. **版本快照 + 引用保护**：实例提交时绑定 `versionId`；引擎每次推进按 versionId 取图执行，运行中实例不受版本切换影响。**被实例引用的版本禁止删除**（`deleteVersion` 增加引用校验）。新发起始终用最新 active 版本。
5. **闭环**：在编辑器中修改流程图 → 保存为新版本 → 启动 → 下一次发起按新图运行；驳回 → 退回发起人重提；走完 end → `approved`；撤回 → `withdrawn`。

## [S5] 数据模型（三表分离）

业务数据与流程数据分离，业务表仅存实例标识与状态冗余，历史表经实例 ID 关联：

```
LeaveApplication（业务表，leaveStore）
  id, applicant, leaveType, startDate, endDate, days, reason, diagnosisNote?
  processInstanceId: string      ← 工作流实例唯一标识
  processStatus: 'approving'|'returned'|'approved'|'withdrawn'   ← 状态冗余，便于列表过滤

ProcessInstance（流程实例表，instanceStore — 引擎只操作这张表 + 图）
  id, flowId, flowName, versionId, status, currentNodeId, createdAt

ApprovalHistory（审批历史表，historyStore — 经 processInstanceId 关联）
  id, processInstanceId, nodeId, nodeTitle,
  action(submit|approve|reject|resubmit|withdraw), approver, comment, time
```

- 状态机：`submit` → walk → `approving`（首个审批节点）；审批 `approve` → 沿 pass 边继续，走完 end → `approved`；审批 `reject` → 退回 → `returned`（可编辑重提）；`resubmit` → 重新从 start walk（**`returned` 或 `withdrawn` 状态均可重提**）；`withdraw`（approving 或 returned 时发起人主动撤销）→ `withdrawn`（撤回后仍可编辑重提）。
- 发起：创建 LeaveApplication + ProcessInstance（绑定 versionId）+ submit 历史 → 引擎 walk。
- 审批：写 history（approve/reject）→ approve 按 pass 端口选边继续 walk；reject 置 `returned`（不沿边）。
- 待办/已办查询：按 `processInstanceId` join 业务表展示申请信息。
- 引擎保持**业务无关**：只消费 ProcessInstance + graphJson，不感知请假字段。

## [S6] mock 运行引擎

引擎为 mock handler 内的纯函数：

- `submit(flowCode, formData)`：按 code 找流程 → 最新 active 版本 → 创建实例 → 从 start 开始推进。
- `walk(instance)`：循环执行当前节点——
  - start → 沿出边前进；
  - condition → 按 `payload.<字段> 操作符 常量` 求值选分支边；
  - approval → 生成待办（实例置 `approving`、记录 currentNodeId）→ 暂停；
  - end → 终止，状态 `approved`。
- **退回与撤回**：
  - `reject(instanceId, comment)`：写 history → 实例置 `returned`、`currentNodeId` 指向**退回目标**（当前 approval 节点的 `data.rejectTo`，缺省为图内 start 节点；不沿边，等待发起人重提）。图上**不画** reject 连线（连线只表达前进方向，退回走默认/配置）。
  - `resubmit(processInstanceId, formData)`：更新业务表单 → 写 history(resubmit) → 从 start 重新 walk（**仅 `returned`/`withdrawn` 状态可重提**；history 保留完整记录，新提交追加一轮）。
  - `withdraw(processInstanceId)`：仅 `approving`/`returned` 状态可撤回 → 写 history → `withdrawn`（撤回后仍可重提）。
- 审批动作 `approve(instanceId, comment)`：写 history → 按 pass 端口选边 → 继续 walk。
- **审批人简化**：mock 中当前登录用户即所有角色；待办 = 所有 `approving` 实例；已办 = 我 history 中的审批记录。

## [S7] /oa/hr/leave 业务页面（列表 + 查看页 + 编辑页）

**列表页**四个 Tab（参考高级详情页的头部信息与操作风格联动）：

- **发起申请**：入口按钮 → 跳转**编辑页**（无 pid = 新建）。
- **我的申请**：ProTable（请假类型、起止日期、天数、状态 Tag、提交时间）+ 行操作：`approving` → **撤回**（Popconfirm）；`returned` / `withdrawn` → **编辑重提**（跳转编辑页带 pid）；任意状态 → **详情**（跳转查看页）。
- **待我审批**：ProTable（申请人、类型、日期、天数、事由、提交时间）+ 通过/驳回（Modal 填审批意见）→ 调引擎。
- **已办**：我审批过的记录（动作、意见、时间）。

**查看页** `/oa/hr/leave/:pid`（隐藏路由，参考 `profile/advanced` 高级详情页结构）：

- PageContainer 头部：title = 请假单号；`content` = Descriptions（申请人/请假类型/起止日期/天数/事由/诊断说明）；`extraContent` = 状态 Statistic；`extra` = 上下文操作（`approving` → 撤回；`returned`/`withdrawn` → 编辑重提）。
- 主体 Cards：**流程进度**（Steps，按流转历史渲染：提交→各审批节点→结束/退回/撤回）；**申请信息**（Descriptions 分组）；**审批记录**（Timeline 完整历史：节点/动作/审批人/意见/时间）。

**编辑页** `/oa/hr/leave/edit`（隐藏路由，query `pid` 存在 = 重提，缺省 = 新建）：

- PageContainer + Card + ProForm（固定设计：姓名、请假类型、开始/结束日期、**天数自动计算**（只读）、事由；病假显隐"诊断说明"必填；重提时预填原数据 + **Alert 展示最近驳回意见**）+ FooterToolbar（提交/取消，参考高级表单页操作栏）。

- 目录：`src/pages/oa/hr/leave/`（列表 + `detail/` 查看页 + `edit/` 编辑页，业务域分组）。

## [S8] 预置数据与 service API

- mock 三 store：`leaveStore` / `instanceStore` / `historyStore`（模块级 Map）。
- 预置：请假流程（`code: 'leave_approval'`、`status: 'published'`、active 版本含审批图）+ 覆盖四种状态的示例实例（approving / returned / approved / withdrawn）。
- 预置请假流程图（graphJson）：
  - start（字段声明：姓名/请假类型/开始/结束日期/天数/事由）
  - → 直属主管审批（approval）
  - → condition：`payload.days <= 3` →（pass）人事归档（approval）→ end；
  - 天数 > 3 →（pass）部门负责人审批（approval）→ 人事归档 → end；
  - **连线只表达前进方向**（6 条边，无 reject 连线）；任一 approval 驳回时引擎按 `data.rejectTo` ?? start 退回（终态判定：走完 end → `approved`，退回中 → `returned`，撤回 → `withdrawn`）。
- `service.ts` API：
  - `getFlowByCode(code)` → 流程 + 最新 active 版本（引擎用）
  - `createLeaveApplication(formData)` → 建三表记录并推进
  - `resubmitApplication(processInstanceId, formData)` → 退回后重提
  - `withdrawApplication(processInstanceId)` → 撤回
  - `listMyApplications(applicant)` / `listMyPendingTasks()` / `listMyDone()`（均 join 业务表）
  - `approveTask(processInstanceId, action, comment)` → 通过或驳回（驳回即退回）
  - `getInstanceDetail(processInstanceId)` → 实例 + 历史
- 配套改动：`FlowForm` 增加 `code` 字段（业务编码，**仅新建时填写，编辑时锁定不可修改**——防止业务关联断裂）；`deleteVersion` 增加"被实例引用则拒绝删除"校验。

## [S9] 路由与菜单架构

按业务域分组，可扩展：

```
/oa                        办公应用（菜单组，无页面）
├── /oa/hr                 人事管理（菜单组）
│   ├── /oa/hr/leave       请假审批  ← 本次实现
│   ├── /oa/hr/leave/:pid  请假详情（hideInMenu，查看页）
│   ├── /oa/hr/leave/edit  请假编辑（hideInMenu，新建/重提）
│   └── …（未来：加班审批、调岗申请…）
└── /oa/finance            财务管理（占位页）
    └── …（未来：报销审批、采购审批…）
```

- `config/routes.ts`：`/oa`、`/oa/hr` 为无 component 的菜单组节点；`/oa/hr/leave` 指向 `./oa/hr/leave`；`/oa/hr/leave/:pid` 与 `/oa/hr/leave/edit` 为 hideInMenu 子页；`/oa/finance` 指向占位页。
- 本次只实现 `/oa/hr/leave` 及其子页，分组骨架为后续人事/财务业务预留。

## [S10] i18n

`src/locales/<locale>/menu.ts` 新增 8 语言：

| 键 | zh-CN | en-US |
|---|---|---|
| `menu.oa` | 办公应用 | Office Apps |
| `menu.oa.hr` | 人事管理 | HR Management |
| `menu.oa.hr.leave` | 请假审批 | Leave Approval |

页面内文案用 `useIntl().formatMessage`（沿用项目 i18n 惯例）。

## [S11] 风险与验证

| 风险 | 处置 | 验证 |
|---|---|---|
| approval 节点多端口实现细节未知（复用 condition 的分支机制） | plan 阶段读 `nodes/condition` 与 `condition-inputs` 的端口/边实现 | 图上 approval 节点出现 pass/reject 两个出端口 |
| 条件表达式求值规则（payload 引用） | 引擎内实现精简求值：左值 `payload.<字段>` / 右值常量 / 6 种操作符 | ≤3 天与 >3 天两条分支均可达 |
| 版本引用保护与现有删除流程冲突 | `deleteVersion` 加引用检查，被引用返回明确错误 | 有实例引用的版本删除被拒 |
| 引擎 walk 与编辑器的图结构字段不一致 | plan 阶段核实 graphJson 的 nodes/edges/ports 字段（已有 initial-data 示例） | 预置图可被引擎完整走通 |

**验证命令**：`npm run tsc`、`npm run lint`、`npm run test`、`npm run build`。
**dev 端到端**：发起 ≤3 天申请（编辑页）→ 待办出现（直属主管）→ 通过 → 人事归档待办 → 通过 → approved；发起 >3 天 → 多级链路；驳回 → returned → 查看页/列表编辑重提（展示驳回意见）→ 重新审批；approving 中撤回 → withdrawn → **撤回后编辑重提 → 重新审批**；删除被引用版本被拒；编辑器打开请假流程（**无 reject 连线的简洁图**）→ 改图保存为新版本 → 启动 → 新发起按新图运行；查看页展示流程进度 Steps 与审批记录 Timeline。

## [S12] 实现任务划分（供 compose:plan 展开）

第一阶段（已交付）：

1. 详情页改造：detail/index.tsx 单页化 + BasicInfo 改只读 Descriptions
2. 编辑器：approval 节点（constants/注册表/form-meta/画布渲染/双端口）
3. Flow 模型加 code 字段 + FlowForm 加 code 输入 + 预置请假流程数据
4. 引擎：submit/walk/approve/reject(退回)/resubmit/withdraw/条件求值/终态（mock handler 内纯函数）
5. 数据与 API：三 store + service.ts + 预置示例实例 + deleteVersion 引用保护
6. 页面：/oa/hr/leave 四 Tab（发起/我的申请(撤回+重提)/待我审批/已办）+ 详情 Drawer
7. 路由 + 菜单架构 + i18n（8 语言）
8. 全量验证（tsc/lint/test/build + dev 端到端）

第二阶段（三项改造）：

9. 引擎：reject 退回目标 `data.rejectTo` ?? start；resubmit 守卫放宽为 returned|withdrawn；测试更新（去 reject 边夹具、默认/配置退回、撤回后重提）
10. 编辑器：approval 表单加"退回节点 ID"字段（rejectTo）；预置图删除 3 条 reject→start 边（9→6 边）
11. 页面：查看页 `/oa/hr/leave/:pid`（高级详情页结构：头部 Descriptions+Statistic+上下文操作、流程进度 Steps、申请信息、审批记录 Timeline）+ 编辑页 `/oa/hr/leave/edit`（ProForm + FooterToolbar + 驳回意见 Alert）；列表页联动（详情/编辑重提跳转、发起跳转）；删除 InstanceDrawer/ApplyForm 弹窗
12. 路由：/oa/hr/leave/:pid 与 /oa/hr/leave/edit（hideInMenu）+ 全量验证
