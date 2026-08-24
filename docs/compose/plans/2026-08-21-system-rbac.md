# 系统管理 RBAC 页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增系统管理 RBAC:用户/角色/权限/部门 四个管理页面(mock)+ access.ts 集成(菜单级路由权限 + 操作级按钮权限),路由业务命名归"系统管理"分组。

**Architecture:** 新建 `src/pages/system/`(user/role/permission/dept + components + service + _mock + data.d.ts),走 antd pro ProTable/ProForm/Tree/mock 标准模式(参照 `src/pages/flow/`)。改 `src/access.ts` 从 `currentUser.permissions` 派生权限对象 + `can()`;mock `GET /api/currentUser` 返回当前用户 permissions(由登录账号 admin/user 映射)。`config/routes.ts` 顶级路由加 `access` 字段 + 新增 `/system/*`。

**Tech Stack:** Umi Max 4 · antd 6 / ProComponents 3 · @umijs/max `useAccess`/`request` · mock(`src/pages/**/_mock.ts` + `mock/user.ts`)· antd Tree(checkable)

## Global Constraints

- 全 mock,无真实后端;mock store 模块级内存 Map(dev 单进程持久)
- 用户权限 = 其 roleIds 角色的 permissionIds 并集
- 路由/权限码业务命名(非 rbac 字面):`/system/{user,role,permission,dept}`;权限码 `<domain>:<action>`(如 `system:user`、`system:user:create`、`dashboard:view`)
- `src/pages/system/` 受 Biome + tsc 约束(未排除);`src/pages/flow-editor/` 仍排除(@ts-nocheck)
- Biome only;`npm run lint` + `npx antd lint ./src` 提交前过;Conventional commits;`package-lock.json`(npm)
- `useAccess` from `@umijs/max`(已确认);`useAccess().can(code)` 用于按钮级
- mock login 已支持 admin/user 双账号(`mock/user.ts` 设 `access` 变量);密码均 `ant.design`
- Spec:`docs/compose/specs/2026-08-21-system-rbac-design.md`
- 参照实现:`src/pages/flow/`(list/detail/components/service/_mock.ts/data.d.ts)为 ProTable+mock 范式

## File Structure

**Create** `src/pages/system/`:
- `data.d.ts` — `API.SystemUser/RoleItem/PermissionItem/DeptItem`
- `_mock.ts` — 四实体 CRUD + 关系(user-role, role-permission)+ `derivePermissions(access)` + seed
- `service.ts` — user/role/permission/dept + 关系 API
- `user/index.tsx` — 用户 ProTable(部门筛选 + 分配角色 + CRUD)
- `role/index.tsx` — 角色 ProTable(分配权限 + CRUD)
- `permission/index.tsx` — 权限 Tree/ProTable
- `dept/index.tsx` — 部门树 CRUD
- `components/RoleAssignDrawer.tsx`、`PermissionAssignDrawer.tsx`、`UserForm.tsx`、`RoleForm.tsx`、`DeptForm.tsx`

**Modify**:
- `src/access.ts` — 从 `currentUser.permissions` 派生 + `can()`
- `src/typings.d.ts` — 声明合并 `API.CurrentUser` 加 `permissions?: string[]`
- `mock/user.ts` — `/api/currentUser` 返回 `permissions`(由 `access` 映射,import `derivePermissions`)
- `config/routes.ts` — 顶级路由加 `access` + 新增 `/system/*`

**Test**: 项目页面无单测约定;验证以 `npm run tsc`/`lint`/`build` + dev e2e(admin/user 双账号)为准。

---

### Task 1: 数据模型 + mock + service + data.d.ts

**Covers:** [S3], [S6]

**Files:**
- Create: `src/pages/system/data.d.ts`、`src/pages/system/_mock.ts`、`src/pages/system/service.ts`

**Interfaces:**
- Produces: `API.SystemUser/RoleItem/PermissionItem/DeptItem`;mock 端点;`derivePermissions(access)` 导出(供 mock/user.ts);service 函数 `getUserList/createUser/updateUser/deleteUser/assignUserRoles`、`getRoleList/createRole/updateRole/deleteRole/assignRolePermissions`、`getPermissionList(+tree)`、`getDeptList(+tree)/createDept/updateDept/deleteDept`。

- [ ] **Step 1: data.d.ts**

`src/pages/system/data.d.ts`:

```ts
declare namespace API {
  interface SystemUser {
    id: string;
    username: string;
    name: string;
    avatar: string;
    email: string;
    deptId: string;
    status: 'active' | 'disabled';
    roleIds: string[];
    createdAt: string;
  }
  interface RoleItem {
    id: string;
    name: string;
    code: string;
    remark: string;
    permissionIds: string[];
    createdAt: string;
  }
  interface PermissionItem {
    id: string;
    name: string;
    code: string;
    type: 'menu' | 'operation';
    parentId: string | null;
    createdAt: string;
  }
  interface DeptItem {
    id: string;
    name: string;
    parentId: string | null;
    remark: string;
    createdAt: string;
  }
  interface DeptTreeNode extends DeptItem {
    children?: DeptTreeNode[];
  }
  interface PermissionTreeNode extends PermissionItem {
    children?: PermissionTreeNode[];
  }
}
```

- [ ] **Step 2: _mock.ts(seed + store + CRUD + derivePermissions)**

`src/pages/system/_mock.ts`(seed 权限码与 routes.ts 顶级 access 对齐):

```ts
interface UserRecord {
  id: string; username: string; name: string; avatar: string; email: string;
  deptId: string; status: 'active' | 'disabled'; roleIds: string[]; password: string; createdAt: string;
}
interface RoleRecord { id: string; name: string; code: string; remark: string; permissionIds: string[]; createdAt: string; }
interface PermRecord { id: string; name: string; code: string; type: 'menu' | 'operation'; parentId: string | null; createdAt: string; }
interface DeptRecord { id: string; name: string; parentId: string | null; remark: string; createdAt: string; }

const users = new Map<string, UserRecord>();
const roles = new Map<string, RoleRecord>();
const perms = new Map<string, PermRecord>();
const depts = new Map<string, DeptRecord>();

const now = () => new Date().toISOString();
const sid = () => Math.random().toString(36).slice(2, 10);

// ---- seed permissions (codes align with routes.ts access fields) ----
const seedPerms: PermRecord[] = [
  { id: 'p-dashboard', name: '仪表盘', code: 'dashboard:view', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-form', name: '表单', code: 'form:view', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-list', name: '列表', code: 'list:view', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-profile', name: '详情', code: 'profile:view', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-result', name: '结果', code: 'result:view', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-exception', name: '异常', code: 'exception:view', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-account', name: '个人', code: 'account:view', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-chatbot', name: 'AI助手', code: 'chatbot:view', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-flow-edit', name: '流程编辑', code: 'flow:edit', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-flow-manage', name: '流程管理', code: 'flow:manage', type: 'menu', parentId: null, createdAt: now() },
  // system group (menu)
  { id: 'p-system', name: '系统管理', code: 'system:manage', type: 'menu', parentId: null, createdAt: now() },
  { id: 'p-sys-user', name: '用户管理', code: 'system:user', type: 'menu', parentId: 'p-system', createdAt: now() },
  { id: 'p-sys-role', name: '角色管理', code: 'system:role', type: 'menu', parentId: 'p-system', createdAt: now() },
  { id: 'p-sys-perm', name: '权限管理', code: 'system:permission', type: 'menu', parentId: 'p-system', createdAt: now() },
  { id: 'p-sys-dept', name: '部门架构', code: 'system:dept', type: 'menu', parentId: 'p-system', createdAt: now() },
  // operations
  { id: 'p-user-create', name: '用户新增', code: 'system:user:create', type: 'operation', parentId: 'p-sys-user', createdAt: now() },
  { id: 'p-user-edit', name: '用户编辑', code: 'system:user:edit', type: 'operation', parentId: 'p-sys-user', createdAt: now() },
  { id: 'p-user-delete', name: '用户删除', code: 'system:user:delete', type: 'operation', parentId: 'p-sys-user', createdAt: now() },
  { id: 'p-role-create', name: '角色新增', code: 'system:role:create', type: 'operation', parentId: 'p-sys-role', createdAt: now() },
  { id: 'p-role-edit', name: '角色编辑', code: 'system:role:edit', type: 'operation', parentId: 'p-sys-role', createdAt: now() },
  { id: 'p-role-delete', name: '角色删除', code: 'system:role:delete', type: 'operation', parentId: 'p-sys-role', createdAt: now() },
  { id: 'p-dept-create', name: '部门新增', code: 'system:dept:create', type: 'operation', parentId: 'p-sys-dept', createdAt: now() },
  { id: 'p-dept-edit', name: '部门编辑', code: 'system:dept:edit', type: 'operation', parentId: 'p-sys-dept', createdAt: now() },
  { id: 'p-dept-delete', name: '部门删除', code: 'system:dept:delete', type: 'operation', parentId: 'p-sys-dept', createdAt: now() },
];
seedPerms.forEach((p) => perms.set(p.id, p));

const allPermIds = Array.from(perms.keys());
const basicPermIds = ['p-dashboard', 'p-form', 'p-list', 'p-profile', 'p-result', 'p-exception', 'p-account', 'p-chatbot', 'p-flow-edit', 'p-flow-manage'].filter((id) => perms.has(id));

// ---- seed roles ----
roles.set('role-admin', { id: 'role-admin', name: '管理员', code: 'admin', remark: '全部权限', permissionIds: allPermIds, createdAt: now() });
roles.set('role-user', { id: 'role-user', name: '普通用户', code: 'user', remark: '基础权限(无系统管理)', permissionIds: basicPermIds, createdAt: now() });

// ---- seed depts ----
depts.set('d-root', { id: 'd-root', name: '总部', parentId: null, remark: '', createdAt: now() });
depts.set('d-tech', { id: 'd-tech', name: '技术部', parentId: 'd-root', remark: '', createdAt: now() });
depts.set('d-prod', { id: 'd-prod', name: '产品部', parentId: 'd-root', remark: '', createdAt: now() });
depts.set('d-fe', { id: 'd-fe', name: '前端组', parentId: 'd-tech', remark: '', createdAt: now() });

// ---- seed users ----
users.set('u-admin', { id: 'u-admin', username: 'admin', name: '管理员', avatar: '', email: 'admin@demo.com', deptId: 'd-tech', status: 'active', roleIds: ['role-admin'], password: 'ant.design', createdAt: now() });
users.set('u-user', { id: 'u-user', username: 'user', name: '普通用户', avatar: '', email: 'user@demo.com', deptId: 'd-prod', status: 'active', roleIds: ['role-user'], password: 'ant.design', createdAt: now() });

/** Derive permission codes for a logged-in account (access = 'admin' | 'user'). */
export function derivePermissions(access: string): string[] {
  const code = access === 'admin' ? 'admin' : 'user';
  const role = Array.from(roles.values()).find((r) => r.code === code);
  if (!role) return [];
  return role.permissionIds.map((pid) => perms.get(pid)?.code).filter(Boolean) as string[];
}

function buildTree<T extends { id: string; parentId: string | null }>(list: T[]): (T & { children?: T[] })[] {
  const map = new Map<string, T & { children?: T[] }>();
  list.forEach((i) => map.set(i.id, { ...i, children: [] }));
  const roots: (T & { children?: T[] })[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children!.push(node);
    else roots.push(node);
  });
  return roots;
}

export default {
  // ---- user ----
  'GET /api/system/user': (_req: any, res: any) => {
    const list = Array.from(users.values()).map((u) => ({ id: u.id, username: u.username, name: u.name, avatar: u.avatar, email: u.email, deptId: u.deptId, status: u.status, roleIds: u.roleIds, createdAt: u.createdAt }));
    res.json({ data: list, success: true });
  },
  'POST /api/system/user': (req: any, res: any) => {
    const id = sid();
    const rec: UserRecord = { id, username: req.body.username, name: req.body.name, avatar: '', email: req.body.email || '', deptId: req.body.deptId || '', status: req.body.status || 'active', roleIds: req.body.roleIds || [], password: req.body.password || 'ant.design', createdAt: now() };
    users.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/system/user/:id': (req: any, res: any) => {
    const u = users.get(req.params.id);
    if (!u) return res.json({ success: false, errorMessage: 'not found' });
    Object.assign(u, req.body);
    res.json({ data: u, success: true });
  },
  'DELETE /api/system/user/:id': (req: any, res: any) => { users.delete(req.params.id); res.json({ success: true }); },
  'PUT /api/system/user/:id/roles': (req: any, res: any) => {
    const u = users.get(req.params.id);
    if (!u) return res.json({ success: false, errorMessage: 'not found' });
    u.roleIds = req.body.roleIds || [];
    res.json({ success: true });
  },
  // ---- role ----
  'GET /api/system/role': (_req: any, res: any) => {
    res.json({ data: Array.from(roles.values()), success: true });
  },
  'POST /api/system/role': (req: any, res: any) => {
    const id = sid();
    const rec: RoleRecord = { id, name: req.body.name, code: req.body.code, remark: req.body.remark || '', permissionIds: req.body.permissionIds || [], createdAt: now() };
    roles.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/system/role/:id': (req: any, res: any) => {
    const r = roles.get(req.params.id);
    if (!r) return res.json({ success: false, errorMessage: 'not found' });
    Object.assign(r, req.body);
    res.json({ data: r, success: true });
  },
  'DELETE /api/system/role/:id': (req: any, res: any) => { roles.delete(req.params.id); res.json({ success: true }); },
  'PUT /api/system/role/:id/permissions': (req: any, res: any) => {
    const r = roles.get(req.params.id);
    if (!r) return res.json({ success: false, errorMessage: 'not found' });
    r.permissionIds = req.body.permissionIds || [];
    res.json({ success: true });
  },
  // ---- permission ----
  'GET /api/system/permission': (_req: any, res: any) => {
    res.json({ data: Array.from(perms.values()), success: true });
  },
  'GET /api/system/permission/tree': (_req: any, res: any) => {
    res.json({ data: buildTree(Array.from(perms.values())), success: true });
  },
  // ---- dept ----
  'GET /api/system/dept': (_req: any, res: any) => {
    res.json({ data: Array.from(depts.values()), success: true });
  },
  'GET /api/system/dept/tree': (_req: any, res: any) => {
    res.json({ data: buildTree(Array.from(depts.values())), success: true });
  },
  'POST /api/system/dept': (req: any, res: any) => {
    const id = sid();
    const rec: DeptRecord = { id, name: req.body.name, parentId: req.body.parentId || null, remark: req.body.remark || '', createdAt: now() };
    depts.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/system/dept/:id': (req: any, res: any) => {
    const d = depts.get(req.params.id);
    if (!d) return res.json({ success: false, errorMessage: 'not found' });
    Object.assign(d, req.body);
    res.json({ data: d, success: true });
  },
  'DELETE /api/system/dept/:id': (req: any, res: any) => { depts.delete(req.params.id); res.json({ success: true }); },
};
```

- [ ] **Step 3: service.ts(解包 mock 响应,参照 flow/service.ts)**

`src/pages/system/service.ts`:

```ts
import { request } from '@umijs/max';

interface Res<T> { data: T; success: boolean; }
const unwrap = async <T>(p: Promise<Res<T>>) => (await p).data;

// user
export const getUserList = () => unwrap(request<Res<API.SystemUser[]>>('/api/system/user'));
export const createUser = (data: Partial<API.SystemUser> & { password?: string }) => unwrap(request<Res<API.SystemUser>>('/api/system/user', { method: 'POST', data }));
export const updateUser = (id: string, data: Partial<API.SystemUser>) => unwrap(request<Res<API.SystemUser>>(`/api/system/user/${id}`, { method: 'PUT', data }));
export const deleteUser = (id: string) => request('/api/system/user/' + id, { method: 'DELETE' });
export const assignUserRoles = (id: string, roleIds: string[]) => request(`/api/system/user/${id}/roles`, { method: 'PUT', data: { roleIds } });
// role
export const getRoleList = () => unwrap(request<Res<API.RoleItem[]>>('/api/system/role'));
export const createRole = (data: Partial<API.RoleItem>) => unwrap(request<Res<API.RoleItem>>('/api/system/role', { method: 'POST', data }));
export const updateRole = (id: string, data: Partial<API.RoleItem>) => unwrap(request<Res<API.RoleItem>>(`/api/system/role/${id}`, { method: 'PUT', data }));
export const deleteRole = (id: string) => request('/api/system/role/' + id, { method: 'DELETE' });
export const assignRolePermissions = (id: string, permissionIds: string[]) => request(`/api/system/role/${id}/permissions`, { method: 'PUT', data: { permissionIds } });
// permission
export const getPermissionList = () => unwrap(request<Res<API.PermissionItem[]>>('/api/system/permission'));
export const getPermissionTree = () => unwrap(request<Res<API.PermissionTreeNode[]>>('/api/system/permission/tree'));
// dept
export const getDeptList = () => unwrap(request<Res<API.DeptItem[]>>('/api/system/dept'));
export const getDeptTree = () => unwrap(request<Res<API.DeptTreeNode[]>>('/api/system/dept/tree'));
export const createDept = (data: Partial<API.DeptItem>) => unwrap(request<Res<API.DeptItem>>('/api/system/dept', { method: 'POST', data }));
export const updateDept = (id: string, data: Partial<API.DeptItem>) => unwrap(request<Res<API.DeptItem>>(`/api/system/dept/${id}`, { method: 'PUT', data }));
export const deleteDept = (id: string) => request('/api/system/dept/' + id, { method: 'DELETE' });
```

- [ ] **Step 4: 验证 tsc**

Run: `npm.cmd run tsc` → exit 0。

- [ ] **Step 5: Commit**

```bash
git add src/pages/system/data.d.ts src/pages/system/_mock.ts src/pages/system/service.ts
git commit -m "feat(system): add user/role/permission/dept data model, mock, service"
```

---

### Task 2: access.ts 改造 + currentUser permissions + typings 扩展

**Covers:** [S4]

**Files:**
- Modify: `src/typings.d.ts`(声明合并 `API.CurrentUser` 加 `permissions?: string[]`)
- Modify: `src/access.ts`(从 permissions 派生 + `can()`)
- Modify: `mock/user.ts`(`/api/currentUser` 返回 permissions,import `derivePermissions`)

**Interfaces:**
- Consumes: Task1 `derivePermissions(access)` from `src/pages/system/_mock.ts`。
- Produces: `currentUser.permissions: string[]`;`access()` 返回 `{ [code]: true, canAdmin, can }`;路由 `access: '<code>'` 生效。

- [ ] **Step 1: typings.d.ts 声明合并**

在 `src/typings.d.ts` 末尾追加(不删现有内容):

```ts
declare namespace API {
  // 扩展自动生成的 CurrentUser,增加 RBAC 权限码列表
  interface CurrentUser {
    permissions?: string[];
  }
}
```

- [ ] **Step 2: access.ts 改造**

`src/access.ts` 全文替换为:

```ts
import type { AccessState } from '@umijs/max';

export default function access(
  initialState: { currentUser?: API.CurrentUser } | undefined,
): AccessState {
  const perms = new Set(initialState?.currentUser?.permissions ?? []);
  const state: Record<string, any> = {};
  perms.forEach((p) => {
    state[p] = true;
  });
  // 兼容现有 /admin(canAdmin)
  state.canAdmin = perms.has('admin') || perms.has('system:manage');
  // 按钮级权限 helper
  state.can = (code: string) => perms.has(code);
  return state;
}
```

- [ ] **Step 3: mock/user.ts 返回 permissions**

在 `mock/user.ts` 顶部 import 后加:

```ts
import { derivePermissions } from '../src/pages/system/_mock';
```

把 `'GET /api/currentUser'` 的 `res.send({ success: true, data: { ...defaultUser, access: getAccess() } })` 改为:

```ts
    res.send({
      success: true,
      data: {
        ...defaultUser,
        access: getAccess(),
        permissions: derivePermissions(getAccess()),
      },
    });
```

- [ ] **Step 4: 验证 tsc + build**

Run: `npm.cmd run tsc` → exit 0。
Run: `npm.cmd run build` → exit 0。

- [ ] **Step 5: Commit**

```bash
git add src/typings.d.ts src/access.ts mock/user.ts
git commit -m "feat(system): access.ts derives from currentUser.permissions; mock currentUser returns permissions"
```

---

### Task 3: 路由 + i18n

**Covers:** [S5], [S7]

**Files:**
- Modify: `config/routes.ts`(顶级路由加 access + 新增 /system/*)
- Modify: 8 个 `src/locales/<locale>/menu.ts`

- [ ] **Step 1: routes.ts 顶级路由加 access + /system**

给现有顶级路由块加 `access` 字段(业务命名权限码),并在 `/flow/:id` 后加 `/system` 块。示例(每块加一行 access):

- `/welcome` → 不加(基础可见)
- `/admin` → 保留 `access: 'canAdmin'`
- `/dashboard` → 加 `access: 'dashboard:view'`
- `/form` → `access: 'form:view'`
- `/list` → `access: 'list:view'`
- `/profile` → `access: 'profile:view'`
- `/result` → `access: 'result:view'`
- `/exception` → `access: 'exception:view'`
- `/account` → `access: 'account:view'`
- `/chatbot` → `access: 'chatbot:view'`
- `/flow-editor` → `access: 'flow:edit'`
- `/flow` → `access: 'flow:manage'`

在 `/flow/:id` 块之后插入:

```ts
  {
    path: '/system',
    name: 'system',
    icon: 'setting',
    access: 'system:manage',
    routes: [
      { path: '/system', redirect: '/system/user' },
      { path: '/system/user', name: 'system-user', component: './system/user', access: 'system:user' },
      { path: '/system/role', name: 'system-role', component: './system/role', access: 'system:role' },
      { path: '/system/permission', name: 'system-permission', component: './system/permission', access: 'system:permission' },
      { path: '/system/dept', name: 'system-dept', component: './system/dept', access: 'system:dept' },
    ],
  },
```

- [ ] **Step 2: i18n menu.system.*(8 语言)**

各 `src/locales/<locale>/menu.ts` 在 `menu.flow` 行后追加(示例 zh-CN):

```ts
  'menu.system': '系统管理',
  'menu.system-user': '用户管理',
  'menu.system-role': '角色管理',
  'menu.system-permission': '权限管理',
  'menu.system-dept': '部门架构',
```

8 语言值:

| locale | system | user | role | permission | dept |
|---|---|---|---|---|---|
| zh-CN | 系统管理 | 用户管理 | 角色管理 | 权限管理 | 部门架构 |
| en-US | System | Users | Roles | Permissions | Departments |
| zh-TW | 系統管理 | 用戶管理 | 角色管理 | 權限管理 | 部門架構 |
| ja-JP | システム管理 | ユーザー管理 | ロール管理 | 権限管理 | 部門構成 |
| pt-BR | Sistema | Usuários | Funções | Permissões | Departamentos |
| fa-IR | سیستم | کاربران | نقش‌ها | مجوزها | دپارتمان‌ها |
| id-ID | Sistem | Pengguna | Peran | Izin | Departemen |
| bn-BD | সিস্টেম | ব্যবহারকারী | ভূমিকা | অনুমতি | বিভাগ |

- [ ] **Step 3: 验证**

Run(grep): `menu\.system'` in `src/locales` → ≥8 命中。
Run: `npm.cmd run tsc` → exit 0。

- [ ] **Step 4: Commit**

```bash
git add config/routes.ts src/locales
git commit -m "feat(system): add /system routes, top-level access fields, i18n menu.system.*"
```

---

### Task 4: 部门管理 dept/index.tsx

**Covers:** [S2], [S6]

**Files:**
- Create: `src/pages/system/dept/index.tsx`
- Create: `src/pages/system/components/DeptForm.tsx`

**Interfaces:**
- Consumes: Task1 service(`getDeptTree/createDept/updateDept/deleteDept`)。
- Produces: `/system/dept` 页面(部门树 + 增删改)。

- [ ] **Step 1: DeptForm.tsx(ModalForm,name/parent/remark)**

`src/pages/system/components/DeptForm.tsx`:

```tsx
import { ModalForm, ProFormText, ProFormTreeSelect } from '@ant-design/pro-components';
import { createDept, getDeptTree, updateDept } from '../service';
import { useEffect, useState } from 'react';

export interface DeptFormProps {
  open: boolean; onOpenChange: (o: boolean) => void;
  record?: API.DeptItem; parentCandidates?: API.DeptTreeNode[]; onSuccess?: () => void;
}

function toTreeData(nodes?: API.DeptTreeNode[]): any[] {
  return (nodes ?? []).map((n) => ({ title: n.name, value: n.id, children: toTreeData(n.children) }));
}

export default function DeptForm(props: DeptFormProps) {
  const { open, onOpenChange, record, onSuccess } = props;
  const isEdit = !!record;
  const [tree, setTree] = useState<API.DeptTreeNode[]>([]);
  useEffect(() => { if (open) getDeptTree().then(setTree); }, [open]);
  return (
    <ModalForm<API.DeptItem>
      title={isEdit ? '编辑部门' : '新建部门'}
      open={open} onOpenChange={onOpenChange}
      initialValues={record ? { name: record.name, parentId: record.parentId, remark: record.remark } : {}}
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) await updateDept(record.id, values);
        else await createDept(values);
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText name="name" label="部门名称" rules={[{ required: true, message: '请输入名称' }]} />
      <ProFormTreeSelect
        name="parentId" label="上级部门" allowClear
        fieldProps={{ treeData: toTreeData(tree), treeDefaultExpandAll: true }}
      />
      <ProFormText name="remark" label="备注" />
    </ModalForm>
  );
}
```

- [ ] **Step 2: dept/index.tsx(Tree + 增删改)**

`src/pages/system/dept/index.tsx`:

```tsx
import { PageContainer } from '@ant-design/pro-components';
import { Button, Tree, Popconfirm, message, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useAccess } from '@umijs/max';
import { deleteDept, getDeptTree } from '../service';
import DeptForm from '../components/DeptForm';

export default function DeptPage() {
  const access = useAccess();
  const [tree, setTree] = useState<API.DeptTreeNode[]>([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<API.DeptItem>();
  const reload = () => getDeptTree().then(setTree);
  useEffect(() => { reload(); }, []);

  const renderNode = (nodes: API.DeptTreeNode[]) =>
    nodes.map((n) => ({
      title: (
        <Space>
          <span>{n.name}</span>
          {access?.can('system:dept:create') && <a onClick={() => { setCurrent(undefined); setOpen(true); }}>新增子级</a>}
          {access?.can('system:dept:edit') && <a onClick={() => { setCurrent(n); setOpen(true); }}>编辑</a>}
          {access?.can('system:dept:delete') && (
            <Popconfirm title="确认删除?" onConfirm={async () => { await deleteDept(n.id); message.success('已删除'); reload(); }}>
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
      key: n.id,
      children: n.children ? renderNode(n.children) : undefined,
    }));

  return (
    <PageContainer>
      <div style={{ marginBottom: 12 }}>
        {access?.can('system:dept:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCurrent(undefined); setOpen(true); }}>新建部门</Button>
        )}
      </div>
      <Tree treeData={renderNode(tree)} defaultExpandAll blockNode />
      <DeptForm open={open} onOpenChange={setOpen} record={current} onSuccess={() => { setOpen(false); reload(); }} />
    </PageContainer>
  );
}
```

- [ ] **Step 3: 验证 tsc**

Run: `npm.cmd run tsc` → exit 0。

- [ ] **Step 4: Commit**

```bash
git add src/pages/system/dept src/pages/system/components/DeptForm.tsx
git commit -m "feat(system): add department tree page with CRUD"
```

---

### Task 5: 权限管理 permission/index.tsx

**Covers:** [S2], [S6]

**Files:**
- Create: `src/pages/system/permission/index.tsx`

**Interfaces:**
- Consumes: Task1 service(`getPermissionTree`)。
- Produces: `/system/permission` 页面(权限树展示 menu+operation)。

- [ ] **Step 1: permission/index.tsx(Tree 展示)**

`src/pages/system/permission/index.tsx`:

```tsx
import { PageContainer } from '@ant-design/pro-components';
import { Tree, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { getPermissionTree } from '../service';

export default function PermissionPage() {
  const [tree, setTree] = useState<API.PermissionTreeNode[]>([]);
  useEffect(() => { getPermissionTree().then(setTree); }, []);

  const renderNode = (nodes: API.PermissionTreeNode[]): any[] =>
    nodes.map((n) => ({
      title: (
        <span>
          {n.name} <Tag color={n.type === 'menu' ? 'blue' : 'green'}>{n.code}</Tag>
        </span>
      ),
      key: n.id,
      children: n.children ? renderNode(n.children) : undefined,
    }));

  return (
    <PageContainer>
      <Tree treeData={renderNode(tree)} defaultExpandAll blockNode />
    </PageContainer>
  );
}
```

- [ ] **Step 2: 验证 tsc + Commit**

Run: `npm.cmd run tsc` → exit 0。
```bash
git add src/pages/system/permission
git commit -m "feat(system): add permission tree page"
```

---

### Task 6: 角色管理 role/index.tsx + PermissionAssignDrawer

**Covers:** [S2], [S6]

**Files:**
- Create: `src/pages/system/components/RoleForm.tsx`
- Create: `src/pages/system/components/PermissionAssignDrawer.tsx`
- Create: `src/pages/system/role/index.tsx`

**Interfaces:**
- Consumes: Task1 service(`getRoleList/createRole/updateRole/deleteRole/assignRolePermissions`、`getPermissionTree`)。
- Produces: `/system/role` 页面(ProTable + 分配权限 drawer + CRUD)。

- [ ] **Step 1: RoleForm.tsx(ModalForm,name/code/remark)**

`src/pages/system/components/RoleForm.tsx`:

```tsx
import { ModalForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { createRole, updateRole } from '../service';

export interface RoleFormProps {
  open: boolean; onOpenChange: (o: boolean) => void;
  record?: API.RoleItem; onSuccess?: () => void;
}

export default function RoleForm(props: RoleFormProps) {
  const { open, onOpenChange, record, onSuccess } = props;
  const isEdit = !!record;
  return (
    <ModalForm<API.RoleItem>
      title={isEdit ? '编辑角色' : '新建角色'}
      open={open} onOpenChange={onOpenChange}
      initialValues={record ? { name: record.name, code: record.code, remark: record.remark } : {}}
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) await updateRole(record.id, values);
        else await createRole(values);
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText name="name" label="角色名称" rules={[{ required: true }]} />
      <ProFormText name="code" label="角色编码" rules={[{ required: true }]} />
      <ProFormTextArea name="remark" label="备注" />
    </ModalForm>
  );
}
```

- [ ] **Step 2: PermissionAssignDrawer.tsx(Tree 勾选)**

`src/pages/system/components/PermissionAssignDrawer.tsx`:

```tsx
import { Drawer, Tree, Button, message } from 'antd';
import { useEffect, useState } from 'react';
import { assignRolePermissions, getPermissionTree } from '../service';

export interface PermissionAssignDrawerProps {
  open: boolean; onClose: () => void; role?: API.RoleItem; onSuccess?: () => void;
}

export default function PermissionAssignDrawer(props: PermissionAssignDrawerProps) {
  const { open, onClose, role, onSuccess } = props;
  const [tree, setTree] = useState<API.PermissionTreeNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  useEffect(() => {
    if (open) {
      getPermissionTree().then(setTree);
      setCheckedKeys(role?.permissionIds ?? []);
    }
  }, [open, role]);

  const toTreeData = (nodes: API.PermissionTreeNode[]): any[] =>
    nodes.map((n) => ({ title: `${n.name} (${n.code})`, key: n.id, children: n.children ? toTreeData(n.children) : undefined }));

  return (
    <Drawer title={`分配权限 - ${role?.name ?? ''}`} open={open} onClose={onClose} width={480}
      extra={<Button type="primary" onClick={async () => { if (role) { await assignRolePermissions(role.id, checkedKeys); message.success('已保存'); onSuccess?.(); onClose(); } }}>保存</Button>}>
      <Tree
        checkable
        defaultExpandAll
        treeData={toTreeData(tree)}
        checkedKeys={checkedKeys}
        onCheck={(keys) => setCheckedKeys((keys as any).checked ?? (keys as string[]))}
      />
    </Drawer>
  );
}
```

- [ ] **Step 3: role/index.tsx(ProTable + 分配权限 + CRUD + 按钮权限)**

`src/pages/system/role/index.tsx`:

```tsx
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Popconfirm, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { useAccess } from '@umijs/max';
import { deleteRole, getRoleList } from '../service';
import RoleForm from '../components/RoleForm';
import PermissionAssignDrawer from '../components/PermissionAssignDrawer';

export default function RolePage() {
  const access = useAccess();
  const actionRef = useRef<ActionType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.RoleItem>();
  const [permOpen, setPermOpen] = useState(false);
  const [permRole, setPermRole] = useState<API.RoleItem>();

  const columns: ProColumns<API.RoleItem>[] = [
    { title: '角色名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code' },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    { title: '权限数', dataIndex: 'permissionIds', render: (_, r) => r.permissionIds.length },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      render: (_, r) => [
        <a key="perm" onClick={() => { setPermRole(r); setPermOpen(true); }}>分配权限</a>,
        access?.can('system:role:edit') && <a key="edit" onClick={() => { setCurrent(r); setFormOpen(true); }}>编辑</a>,
        access?.can('system:role:delete') && (
          <Popconfirm key="del" title="确认删除?" onConfirm={async () => { await deleteRole(r.id); message.success('已删除'); actionRef.current?.reload(); }}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        ),
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.RoleItem>
        actionRef={actionRef} rowKey="id" search={false}
        request={async () => { const data = await getRoleList(); return { data, success: true }; }}
        columns={columns}
        toolBarRender={() =>
          access?.can('system:role:create')
            ? [<Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => { setCurrent(undefined); setFormOpen(true); }}>新建角色</Button>]
            : []
        }
      />
      <RoleForm open={formOpen} onOpenChange={setFormOpen} record={current} onSuccess={() => { setFormOpen(false); actionRef.current?.reload(); }} />
      <PermissionAssignDrawer open={permOpen} onClose={() => setPermOpen(false)} role={permRole} onSuccess={() => actionRef.current?.reload()} />
    </PageContainer>
  );
}
```

- [ ] **Step 4: 验证 tsc + Commit**

Run: `npm.cmd run tsc` → exit 0。
```bash
git add src/pages/system/role src/pages/system/components/RoleForm.tsx src/pages/system/components/PermissionAssignDrawer.tsx
git commit -m "feat(system): add role page with permission assignment drawer"
```

---

### Task 7: 用户管理 user/index.tsx + RoleAssignDrawer + UserForm

**Covers:** [S2], [S6]

**Files:**
- Create: `src/pages/system/components/UserForm.tsx`
- Create: `src/pages/system/components/RoleAssignDrawer.tsx`
- Create: `src/pages/system/user/index.tsx`

**Interfaces:**
- Consumes: Task1 service(`getUserList/createUser/updateUser/deleteUser/assignUserRoles`、`getRoleList`、`getDeptTree`)。
- Produces: `/system/user` 页面(ProTable + 部门筛选 + 分配角色 + CRUD)。

- [ ] **Step 1: UserForm.tsx(name/email/dept/roles/status)**

`src/pages/system/components/UserForm.tsx`:

```tsx
import { ModalForm, ProFormText, ProFormSelect, ProFormTreeSelect } from '@ant-design/pro-components';
import { useEffect, useState } from 'react';
import { createDept, getDeptTree, getRoleList, createUser, updateUser } from '../service';

export interface UserFormProps {
  open: boolean; onOpenChange: (o: boolean) => void;
  record?: API.SystemUser; onSuccess?: () => void;
}

function toTreeData(nodes?: API.DeptTreeNode[]): any[] {
  return (nodes ?? []).map((n) => ({ title: n.name, value: n.id, children: toTreeData(n.children) }));
}

export default function UserForm(props: UserFormProps) {
  const { open, onOpenChange, record, onSuccess } = props;
  const isEdit = !!record;
  const [deptTree, setDeptTree] = useState<API.DeptTreeNode[]>([]);
  const [roles, setRoles] = useState<API.RoleItem[]>([]);
  useEffect(() => {
    if (open) {
      getDeptTree().then(setDeptTree);
      getRoleList().then(setRoles);
    }
  }, [open]);
  return (
    <ModalForm<API.SystemUser>
      title={isEdit ? '编辑用户' : '新建用户'}
      open={open} onOpenChange={onOpenChange}
      initialValues={record ? { username: record.username, name: record.name, email: record.email, deptId: record.deptId, roleIds: record.roleIds, status: record.status } : { status: 'active' }}
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) await updateUser(record.id, values);
        else await createUser(values);
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText name="username" label="用户名" rules={[{ required: true }]} disabled={isEdit} />
      <ProFormText name="name" label="姓名" rules={[{ required: true }]} />
      <ProFormText name="email" label="邮箱" />
      <ProFormTreeSelect name="deptId" label="部门" fieldProps={{ treeData: toTreeData(deptTree), treeDefaultExpandAll: true }} />
      <ProFormSelect name="roleIds" label="角色" mode="multiple" options={roles.map((r) => ({ label: r.name, value: r.id }))} />
      <ProFormSelect name="status" label="状态" options={[{ label: '启用', value: 'active' }, { label: '禁用', value: 'disabled' }]} />
    </ModalForm>
  );
}
```

- [ ] **Step 2: RoleAssignDrawer.tsx(给用户分配角色,checkbox)**

`src/pages/system/components/RoleAssignDrawer.tsx`:

```tsx
import { Drawer, Checkbox, Button, message } from 'antd';
import { useEffect, useState } from 'react';
import { assignUserRoles, getRoleList } from '../service';

export interface RoleAssignDrawerProps {
  open: boolean; onClose: () => void; user?: API.SystemUser; onSuccess?: () => void;
}

export default function RoleAssignDrawer(props: RoleAssignDrawerProps) {
  const { open, onClose, user, onSuccess } = props;
  const [roles, setRoles] = useState<API.RoleItem[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => {
    if (open) {
      getRoleList().then(setRoles);
      setChecked(user?.roleIds ?? []);
    }
  }, [open, user]);

  return (
    <Drawer title={`分配角色 - ${user?.name ?? ''}`} open={open} onClose={onClose} width={420}
      extra={<Button type="primary" onClick={async () => { if (user) { await assignUserRoles(user.id, checked); message.success('已保存'); onSuccess?.(); onClose(); } }}>保存</Button>}>
      <Checkbox.Group value={checked} onChange={(v) => setChecked(v as string[])}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roles.map((r) => <Checkbox key={r.id} value={r.id}>{r.name}({r.code})</Checkbox>)}
        </div>
      </Checkbox.Group>
    </Drawer>
  );
}
```

- [ ] **Step 3: user/index.tsx(ProTable + 部门树筛选 + 分配角色 + CRUD + 按钮权限)**

`src/pages/system/user/index.tsx`:

```tsx
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Popconfirm, message, Tree } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { useAccess } from '@umijs/max';
import { deleteUser, getDeptTree, getRoleList, getUserList } from '../service';
import UserForm from '../components/UserForm';
import RoleAssignDrawer from '../components/RoleAssignDrawer';

export default function UserPage() {
  const access = useAccess();
  const actionRef = useRef<ActionType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.SystemUser>();
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<API.SystemUser>();
  const [deptTree, setDeptTree] = useState<API.DeptTreeNode[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>();
  const [roles, setRoles] = useState<API.RoleItem[]>([]);
  useEffect(() => { getDeptTree().then(setDeptTree); getRoleList().then(setRoles); }, []);
  const roleMap = new Map(roles.map((r) => [r.id, r.name]));

  const columns: ProColumns<API.SystemUser>[] = [
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'name' },
    { title: '邮箱', dataIndex: 'email' },
    { title: '角色', dataIndex: 'roleIds', render: (_, r) => r.roleIds.map((id) => roleMap.get(id) ?? id).join(', ') },
    { title: '状态', dataIndex: 'status', render: (_, r) => (r.status === 'active' ? '启用' : '禁用') },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      render: (_, r) => [
        <a key="role" onClick={() => { setRoleUser(r); setRoleOpen(true); }}>分配角色</a>,
        access?.can('system:user:edit') && <a key="edit" onClick={() => { setCurrent(r); setFormOpen(true); }}>编辑</a>,
        access?.can('system:user:delete') && (
          <Popconfirm key="del" title="确认删除?" onConfirm={async () => { await deleteUser(r.id); message.success('已删除'); actionRef.current?.reload(); }}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        ),
      ],
    },
  ];

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 240, flexShrink: 0 }}>
          <Tree
            treeData={[{ title: '全部部门', key: '' }, ...deptTree.map((n) => ({ title: n.name, key: n.id, children: (function f(c?: API.DeptTreeNode[]) { return (c ?? []).map((x) => ({ title: x.name, key: x.id, children: f(x.children) })); })(n.children) }))]}
            defaultExpandAll
            onSelect={(keys) => setDeptFilter((keys[0] as string) || undefined)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <ProTable<API.SystemUser>
            actionRef={actionRef} rowKey="id" search={false}
            params={{ deptId: deptFilter }}
            request={async (p) => {
              let data = await getUserList();
              if (p.deptId) data = data.filter((u) => u.deptId === p.deptId);
              return { data, success: true };
            }}
            columns={columns}
            toolBarRender={() =>
              access?.can('system:user:create')
                ? [<Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => { setCurrent(undefined); setFormOpen(true); }}>新建用户</Button>]
                : []
            }
          />
        </div>
      </div>
      <UserForm open={formOpen} onOpenChange={setFormOpen} record={current} onSuccess={() => { setFormOpen(false); actionRef.current?.reload(); }} />
      <RoleAssignDrawer open={roleOpen} onClose={() => setRoleOpen(false)} user={roleUser} onSuccess={() => actionRef.current?.reload()} />
    </PageContainer>
  );
}
```

- [ ] **Step 4: 验证 tsc + lint + Commit**

Run: `npm.cmd run tsc` → exit 0。
Run: `npm.cmd run lint` → exit 0。
```bash
git add src/pages/system/user src/pages/system/components/UserForm.tsx src/pages/system/components/RoleAssignDrawer.tsx
git commit -m "feat(system): add user page with dept filter and role assignment"
```

---

### Task 8: 全量验证

**Covers:** [S8]

- [ ] **Step 1: tsc + lint + antd lint**

Run: `npm.cmd run tsc` → exit 0。
Run: `npm.cmd run lint` → exit 0。
Run: `npx.cmd antd lint ./src` → exit 0。

- [ ] **Step 2: build**

Run: `npm.cmd run build` → exit 0(含 system/* 产物)。

- [ ] **Step 3: dev e2e(双账号)**

Run: `npm.cmd start`,访问(登录):
1. **admin 登录**(admin/ant.design):
   - 见"系统管理"分组 + 全部菜单
   - `/system/user`:用户列表(2 seed 用户),部门树筛选生效,新建/编辑/删除/分配角色 按钮可见可用
   - `/system/role`:角色列表,分配权限 drawer Tree 勾选保存
   - `/system/permission`:权限树展示
   - `/system/dept`:部门树 CRUD
2. **user 登录**(user/ant.design):
   - **无"系统管理"分组**(菜单级 RBAC 生效)
   - 仅基础菜单(dashboard/form/list/.../flow),无 system
   - 直接访问 `/system/user` → 被阻断(403/重定向)

- [ ] **Step 4: clean**

Run: `git status` → clean 或预期改动;有问题回相应 Task 修。

---

## Self-Review 记录

- **Spec 覆盖:** [S1]→前言;[S2]→Task4/5/6/7;[S3]→Task1;[S4]→Task2;[S5]→Task3;[S6]→Task1/4/5/6/7;[S7]→Task3;[S8]→Task8。全覆盖。
- **占位符:** 无;access.ts/mock/routes 代码完整;`useAccess`/`derivePermissions` 已核实存在。
- **类型一致:** `API.SystemUser/RoleItem/PermissionItem/DeptItem/DeptTreeNode/PermissionTreeNode` 在 Task1 定义,Task4-7 复用一致;service 函数名跨任务一致;权限码与 routes access 字段、seed 一致(`dashboard:view`/`system:user` 等)。
- **分支:** 在 `feature/system-rbac`(从 `origin/master` = `72c9b5e0` 切出)上实现。
