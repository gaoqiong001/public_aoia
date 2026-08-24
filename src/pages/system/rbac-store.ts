/**
 * Shared RBAC in-memory store. Imported by both mock/user.ts and
 * system/_mock.ts so they operate on the same Maps.
 */

interface RoleRecord {
  id: string;
  name: string;
  code: string;
  remark: string;
  permissionIds: string[];
  createdAt: string;
}
interface PermRecord {
  id: string;
  name: string;
  code: string;
  type: 'menu' | 'operation';
  parentId: string | null;
  createdAt: string;
}
interface UserRecord {
  id: string;
  username: string;
  name: string;
  avatar: string;
  email: string;
  deptId: string;
  status: 'active' | 'disabled';
  roleIds: string[];
  password: string;
  createdAt: string;
}
interface DeptRecord {
  id: string;
  name: string;
  parentId: string | null;
  remark: string;
  createdAt: string;
}

export const now = () => new Date().toISOString();
export const sid = () => Math.random().toString(36).slice(2, 10);

// ---- Stores (shared singleton across all importers) ----
export const users = new Map<string, UserRecord>();
export const roles = new Map<string, RoleRecord>();
export const perms = new Map<string, PermRecord>();
export const depts = new Map<string, DeptRecord>();

// ---- seed permissions (codes align with routes.ts access fields) ----
const seedPerms: PermRecord[] = [
  {
    id: 'p-dashboard',
    name: '仪表盘',
    code: 'dashboard:view',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-form',
    name: '表单',
    code: 'form:view',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-list',
    name: '列表',
    code: 'list:view',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-profile',
    name: '详情',
    code: 'profile:view',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-result',
    name: '结果',
    code: 'result:view',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-exception',
    name: '异常',
    code: 'exception:view',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-account',
    name: '个人',
    code: 'account:view',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-chatbot',
    name: 'AI助手',
    code: 'chatbot:view',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-flow-edit',
    name: '流程编辑',
    code: 'flow:edit',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-flow-manage',
    name: '流程管理',
    code: 'flow:manage',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-system',
    name: '系统管理',
    code: 'system:manage',
    type: 'menu',
    parentId: null,
    createdAt: now(),
  },
  {
    id: 'p-sys-user',
    name: '用户管理',
    code: 'system:user',
    type: 'menu',
    parentId: 'p-system',
    createdAt: now(),
  },
  {
    id: 'p-sys-role',
    name: '角色管理',
    code: 'system:role',
    type: 'menu',
    parentId: 'p-system',
    createdAt: now(),
  },
  {
    id: 'p-sys-perm',
    name: '权限管理',
    code: 'system:permission',
    type: 'menu',
    parentId: 'p-system',
    createdAt: now(),
  },
  {
    id: 'p-sys-dept',
    name: '部门架构',
    code: 'system:dept',
    type: 'menu',
    parentId: 'p-system',
    createdAt: now(),
  },
  {
    id: 'p-user-create',
    name: '用户新增',
    code: 'system:user:create',
    type: 'operation',
    parentId: 'p-sys-user',
    createdAt: now(),
  },
  {
    id: 'p-user-edit',
    name: '用户编辑',
    code: 'system:user:edit',
    type: 'operation',
    parentId: 'p-sys-user',
    createdAt: now(),
  },
  {
    id: 'p-user-delete',
    name: '用户删除',
    code: 'system:user:delete',
    type: 'operation',
    parentId: 'p-sys-user',
    createdAt: now(),
  },
  {
    id: 'p-role-create',
    name: '角色新增',
    code: 'system:role:create',
    type: 'operation',
    parentId: 'p-sys-role',
    createdAt: now(),
  },
  {
    id: 'p-role-edit',
    name: '角色编辑',
    code: 'system:role:edit',
    type: 'operation',
    parentId: 'p-sys-role',
    createdAt: now(),
  },
  {
    id: 'p-role-delete',
    name: '角色删除',
    code: 'system:role:delete',
    type: 'operation',
    parentId: 'p-sys-role',
    createdAt: now(),
  },
  {
    id: 'p-dept-create',
    name: '部门新增',
    code: 'system:dept:create',
    type: 'operation',
    parentId: 'p-sys-dept',
    createdAt: now(),
  },
  {
    id: 'p-dept-edit',
    name: '部门编辑',
    code: 'system:dept:edit',
    type: 'operation',
    parentId: 'p-sys-dept',
    createdAt: now(),
  },
  {
    id: 'p-dept-delete',
    name: '部门删除',
    code: 'system:dept:delete',
    type: 'operation',
    parentId: 'p-sys-dept',
    createdAt: now(),
  },
];
seedPerms.forEach((p) => {
  perms.set(p.id, p);
});

const allPermIds = Array.from(perms.keys());
const basicPermIds = [
  'p-dashboard',
  'p-form',
  'p-list',
  'p-profile',
  'p-result',
  'p-exception',
  'p-account',
  'p-chatbot',
  'p-flow-edit',
  'p-flow-manage',
].filter((id) => perms.has(id));

// ---- seed roles ----
roles.set('role-admin', {
  id: 'role-admin',
  name: '管理员',
  code: 'admin',
  remark: '全部权限',
  permissionIds: allPermIds,
  createdAt: now(),
});
roles.set('role-user', {
  id: 'role-user',
  name: '普通用户',
  code: 'user',
  remark: '基础权限(无系统管理)',
  permissionIds: basicPermIds,
  createdAt: now(),
});

// ---- seed depts ----
depts.set('d-root', {
  id: 'd-root',
  name: '总部',
  parentId: null,
  remark: '',
  createdAt: now(),
});
depts.set('d-tech', {
  id: 'd-tech',
  name: '技术部',
  parentId: 'd-root',
  remark: '',
  createdAt: now(),
});
depts.set('d-prod', {
  id: 'd-prod',
  name: '产品部',
  parentId: 'd-root',
  remark: '',
  createdAt: now(),
});
depts.set('d-fe', {
  id: 'd-fe',
  name: '前端组',
  parentId: 'd-tech',
  remark: '',
  createdAt: now(),
});

// ---- seed users ----
users.set('u-admin', {
  id: 'u-admin',
  username: 'admin',
  name: '管理员',
  avatar: '',
  email: 'admin@demo.com',
  deptId: 'd-tech',
  status: 'active',
  roleIds: ['role-admin'],
  password: 'ant.design',
  createdAt: now(),
});
users.set('u-user', {
  id: 'u-user',
  username: 'user',
  name: '普通用户',
  avatar: '',
  email: 'user@demo.com',
  deptId: 'd-prod',
  status: 'active',
  roleIds: ['role-user'],
  password: 'ant.design',
  createdAt: now(),
});

/**
 * Derive permission codes for a logged-in account (access = 'admin' | 'user').
 * Looks up the role with the matching code, then maps permissionIds → permission codes.
 */
export function derivePermissions(access: string): string[] {
  const code = access === 'admin' ? 'admin' : 'user';
  const role = Array.from(roles.values()).find((r) => r.code === code);
  if (!role) return [];
  return role.permissionIds
    .map((pid) => perms.get(pid)?.code)
    .filter(Boolean) as string[];
}
