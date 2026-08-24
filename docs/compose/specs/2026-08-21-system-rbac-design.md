# Spec: 系统管理 RBAC 页面(用户/角色/权限/部门 + access 集成)

> Created: 2026-08-21
> Status: Approved (design)

## [S1] 目标

完整 RBAC:用户管理、角色管理、权限管理、部门架构 四个管理页面(mock)+ `access.ts` 集成(路由/菜单按角色权限控制,菜单级)+ 按钮级操作权限。mock 全打通,与现有体系一致。路由按业务命名归"系统管理"分组(不用 rbac 字面)。

## [S2] 方案概览

1. 新路由 `/system/user`、`/system/role`、`/system/permission`、`/system/dept`,菜单分组"系统管理"
2. 数据模型(mock):User{roleIds[],deptId}、Role{permissionIds[]}、Permission{type,code,parentId}、Department{parentId}(树)
3. `access.ts`:从 `currentUser.permissions`(角色权限并集)派生 `{ [permCode]: true }` + `can(code)` helper;mock `/api/currentUser` 返回当前用户 permissions
4. 菜单级:`routes.ts` 顶级路由加 `access: '<permCode>'`;无权限则菜单隐藏+路由阻断
5. 操作级:系统管理页面按钮(create/edit/delete)用 `can('system:user:create')` 等控可见性
6. mock 多账号:admin(全部权限)+ user(子集),可切换登录看菜单/按钮差异

## [S3] 数据模型(mock)

```ts
User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  email: string;
  deptId: string;                 // 归属部门
  status: 'active' | 'disabled';
  roleIds: string[];              // 多角色
  password: string;               // mock 明文(仅 demo)
  createdAt: string;
}
Role {
  id: string;
  name: string;
  code: string;                   // 如 admin / user
  remark: string;
  permissionIds: string[];
  createdAt: string;
}
Permission {
  id: string;
  name: string;
  code: string;                   // 如 system:user / system:user:create
  type: 'menu' | 'operation';
  parentId?: string;              // 权限树(menu 可有父子)
  createdAt: string;
}
Department {
  id: string;
  name: string;
  parentId: string | null;        // null=根部门
  remark: string;
  createdAt: string;
}
```

**约束**:用户权限 = 其 roleIds 对应角色的 permissionIds 并集。

**seed**:
- 部门:总部(parentId null)→ 技术部 / 产品部(父=总部)→ 前端组(父=技术部)
- 权限:菜单级(`dashboard:view`、`form:view`、`list:view`、`flow:manage`、`system:user`、`system:role`、`system:permission`、`system:dept` 等)+ 操作级(`system:user:create/edit/delete`、`system:role:*`、`system:dept:*`)
- 角色:`admin`(全部权限)、`user`(`dashboard:view`、`flow:manage` 等基础,无 system:*)
- 用户:`admin`(admin 角色,dept=技术部)、`user`(user 角色,dept=产品部);密码均为 `ant.design`

## [S4] access.ts 集成

- `getInitialState()` → `GET /api/currentUser` → `{ ..., permissions: string[] }`(由该用户角色权限并集派生)
- `access.ts`:
```ts
export default function access(initialState) {
  const perms = new Set(initialState?.currentUser?.permissions ?? []);
  const state: Record<string, any> = {};
  perms.forEach((p) => (state[p] = true));
  state.canAdmin = perms.has('admin');
  state.can = (code: string) => perms.has(code);
  return state;
}
```
- 菜单级:routes 顶级 `access: 'menu:xxx'` 或 `'<domain>:view'`;无权限→`state[code]` undefined→路由阻断+菜单隐藏
- 操作级:`const a = useAccess(); a?.can('system:user:create')` 控按钮

## [S5] 路由与菜单

新增(`config/routes.ts`):

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

顶级路由加 access 字段(菜单级,业务命名):dashboard→`dashboard:view`、form→`form:view`、list→`list:view`、profile→`profile:view`、result→`result:view`、exception→`exception:view`、account→`account:view`、chatbot→`chatbot:view`、flow-editor→`flow:edit`、flow→`flow:manage`。`/admin` 保留 `canAdmin`。`/welcome`/`/` 不加(基础可见)。

## [S6] 页面结构(`src/pages/system/`)

```
src/pages/system/
├── user/index.tsx              # 用户 ProTable(部门筛选 + 分配角色 drawer + CRUD)
├── role/index.tsx              # 角色 ProTable(分配权限 drawer + CRUD)
├── permission/index.tsx        # 权限 Tree/ProTable(menu+operation,父子)
├── dept/index.tsx              # 部门树(Tree + 增删改)
├── components/
│   ├── RoleAssignDrawer.tsx    # 给用户分配角色(checkbox)
│   ├── PermissionAssignDrawer.tsx  # 给角色分配权限(Tree 勾选)
│   ├── UserForm.tsx            # 用户表单(name/email/dept/roles/status)
│   ├── RoleForm.tsx            # 角色表单(name/code/remark)
│   └── DeptForm.tsx            # 部门表单(name/parent/remark)
├── service.ts                  # user/role/permission/dept + 关系 API
├── _mock.ts                    # 四实体 CRUD + 关系 + currentUser 派生
└── data.d.ts                   # API.UserItem/RoleItem/PermissionItem/DeptItem
```

## [S7] i18n

`src/locales/<locale>/menu.ts` 加:
- `menu.system`、`menu.system-user`、`menu.system-role`、`menu.system-permission`、`menu.system-dept`(8 语言)
- 页面文案用 `useIntl().formatMessage`(或直接中文,与 flow-management 一致)

| 文件 | 键 | 值(zh-CN) |
|---|---|---|
| `zh-CN/menu.ts` | `menu.system` | `'系统管理'` |
| | `menu.system-user` | `'用户管理'` |
| | `menu.system-role` | `'角色管理'` |
| | `menu.system-permission` | `'权限管理'` |
| | `menu.system-dept` | `'部门架构'` |
| (其余 7 语言) | 同上 | 对应译文 |

## [S8] 风险与验证

| 风险 | 处置 | 验证 |
|---|---|---|
| access.ts 改动影响全站路由(顶级加 access) | 仅顶级路由加;无权限→菜单隐藏(Umi 行为);保留 canAdmin 兼容 /admin | admin 登录全菜单可见;user 登录仅基础菜单 |
| currentUser.permissions 派生与 mock login 一致 | mock /api/currentUser 由 user→roles→perms 并集派生;login 返回当前用户 | 切账号登录菜单/按钮变化 |
| 权限 Tree 勾选(父子联动) | PermissionAssignDrawer 用 antd Tree checkable + checkStrictly=false | 分配权限后角色权限更新 |
| 部门树 + 用户按部门筛选 | dept 页 Tree CRUD;user 页 ProTable 顶部部门树筛选 | 部门增删改 + 用户按部门过滤 |
| mock store 跨请求持久 | 模块级 Map(dev 单进程) | CRUD 后刷新仍可见 |

**验证命令**:`npm run tsc`、`npm run lint`、`npm run build`;dev e2e:
1. admin 登录 → 见"系统管理"分组 + 全菜单 → 用户/角色/权限/部门 CRUD + 分配
2. user 登录 → 无"系统管理"分组 + 仅基础菜单 → 验证菜单级 RBAC
3. RBAC 页面按钮按 `can('system:user:create')` 显隐(操作级)

## [S9] 实现任务划分(供 compose:plan 展开)

1. 数据模型 + mock + service + data.d.ts(user/role/permission/dept + 关系 + currentUser 派生 + seed)
2. access.ts 改造(从 currentUser.permissions 派生 + can)+ mock /api/currentUser 返回 permissions
3. 路由 + i18n(/system/* + 顶级 access 字段 + menu.system.*)
4. 部门管理 dept/index.tsx(树 CRUD)
5. 权限管理 permission/index.tsx(Tree/ProTable)
6. 角色管理 role/index.tsx(ProTable + PermissionAssignDrawer)
7. 用户管理 user/index.tsx(ProTable + 部门筛选 + RoleAssignDrawer + UserForm)
8. 全量验证(tsc/lint/build/dev e2e:admin/user 双账号)
