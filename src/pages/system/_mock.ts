import {
  depts,
  derivePermissions,
  now,
  perms,
  roles,
  sid,
  users,
} from './rbac-store';

interface MenuRecord {
  id: string;
  parentId: string | null;
  name: string;
  icon: string;
  path: string;
  permissionCode: string;
  sort: number;
  visible: boolean;
  createdAt: string;
}

function buildTree<T extends { id: string; parentId: string | null }>(
  list: T[],
): (T & { children?: T[] })[] {
  const map = new Map<string, T & { children?: T[] }>();
  list.forEach((i) => {
    map.set(i.id, { ...i, children: [] });
  });
  const roots: (T & { children?: T[] })[] = [];
  map.forEach((node) => {
    const parent = node.parentId ? map.get(node.parentId) : undefined;
    if (parent?.children) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ---- seed menus (not in rbac-store, local to this mock) ----
const menus = new Map<string, MenuRecord>();
const seedMenus: MenuRecord[] = [
  {
    id: 'm-dashboard',
    parentId: null,
    name: '仪表盘',
    icon: 'dashboard',
    path: '/dashboard',
    permissionCode: 'dashboard:view',
    sort: 1,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-form',
    parentId: null,
    name: '表单页',
    icon: 'form',
    path: '/form',
    permissionCode: 'form:view',
    sort: 2,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-list',
    parentId: null,
    name: '列表页',
    icon: 'table',
    path: '/list',
    permissionCode: 'list:view',
    sort: 3,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-profile',
    parentId: null,
    name: '详情页',
    icon: 'profile',
    path: '/profile',
    permissionCode: 'profile:view',
    sort: 4,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-result',
    parentId: null,
    name: '结果页',
    icon: 'checkCircle',
    path: '/result',
    permissionCode: 'result:view',
    sort: 5,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-exception',
    parentId: null,
    name: '异常页',
    icon: 'warning',
    path: '/exception',
    permissionCode: 'exception:view',
    sort: 6,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-account',
    parentId: null,
    name: '个人页',
    icon: 'user',
    path: '/account',
    permissionCode: 'account:view',
    sort: 7,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-chatbot',
    parentId: null,
    name: 'AI 助手',
    icon: 'robot',
    path: '/chatbot',
    permissionCode: 'chatbot:view',
    sort: 8,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-flow-editor',
    parentId: null,
    name: '流程编辑器',
    icon: 'apartment',
    path: '/flow-editor',
    permissionCode: 'flow:edit',
    sort: 9,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-flow',
    parentId: null,
    name: '流程管理',
    icon: 'unorderedList',
    path: '/flow',
    permissionCode: 'flow:manage',
    sort: 10,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-system',
    parentId: null,
    name: '系统管理',
    icon: 'setting',
    path: '/system',
    permissionCode: 'system:manage',
    sort: 11,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-sys-user',
    parentId: 'm-system',
    name: '用户管理',
    icon: 'user',
    path: '/system/user',
    permissionCode: 'system:user',
    sort: 1,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-sys-role',
    parentId: 'm-system',
    name: '角色管理',
    icon: 'team',
    path: '/system/role',
    permissionCode: 'system:role',
    sort: 2,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-sys-perm',
    parentId: 'm-system',
    name: '权限管理',
    icon: 'safety',
    path: '/system/permission',
    permissionCode: 'system:permission',
    sort: 3,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-sys-dept',
    parentId: 'm-system',
    name: '部门架构',
    icon: 'apartment',
    path: '/system/dept',
    permissionCode: 'system:dept',
    sort: 4,
    visible: true,
    createdAt: now(),
  },
  {
    id: 'm-sys-menu',
    parentId: 'm-system',
    name: '菜单管理',
    icon: 'menu',
    path: '/system/menu',
    permissionCode: 'system:permission',
    sort: 5,
    visible: true,
    createdAt: now(),
  },
];
seedMenus.forEach((m) => {
  menus.set(m.id, m);
});

export default {
  // ---- user ----
  'GET /api/system/user': (_req: any, res: any) => {
    const list = Array.from(users.values()).map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      email: u.email,
      deptId: u.deptId,
      status: u.status,
      roleIds: u.roleIds,
      createdAt: u.createdAt,
    }));
    res.json({ data: list, success: true });
  },
  'POST /api/system/user': (req: any, res: any) => {
    const id = sid();
    const rec = {
      id,
      username: req.body.username,
      name: req.body.name,
      avatar: '',
      email: req.body.email || '',
      deptId: req.body.deptId || '',
      status: req.body.status || 'active',
      roleIds: req.body.roleIds || [],
      password: req.body.password || 'ant.design',
      createdAt: now(),
    };
    users.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/system/user/:id': (req: any, res: any) => {
    const u = users.get(req.params.id);
    if (!u) return res.json({ success: false, errorMessage: 'not found' });
    const { name, email, deptId, status } = req.body;
    Object.assign(u, { name, email, deptId, status });
    res.json({ data: u, success: true });
  },
  'DELETE /api/system/user/:id': (req: any, res: any) => {
    users.delete(req.params.id);
    res.json({ success: true });
  },
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
    const rec = {
      id,
      name: req.body.name,
      code: req.body.code,
      remark: req.body.remark || '',
      permissionIds: req.body.permissionIds || [],
      createdAt: now(),
    };
    roles.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/system/role/:id': (req: any, res: any) => {
    const r = roles.get(req.params.id);
    if (!r) return res.json({ success: false, errorMessage: 'not found' });
    const { name, code, remark } = req.body;
    Object.assign(r, { name, code, remark });
    res.json({ data: r, success: true });
  },
  'DELETE /api/system/role/:id': (req: any, res: any) => {
    const id = req.params.id;
    roles.delete(id);
    // cascade: remove role from all users
    users.forEach((u) => {
      u.roleIds = u.roleIds.filter((rid) => rid !== id);
    });
    res.json({ success: true });
  },
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
  'POST /api/system/permission': (req: any, res: any) => {
    const id = sid();
    const rec = {
      id,
      name: req.body.name,
      code: req.body.code,
      type: req.body.type || 'menu',
      parentId: req.body.parentId || null,
      createdAt: now(),
    };
    perms.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/system/permission/:id': (req: any, res: any) => {
    const p = perms.get(req.params.id);
    if (!p) return res.json({ success: false, errorMessage: 'not found' });
    const { name, code, type, parentId } = req.body;
    Object.assign(p, { name, code, type, parentId });
    res.json({ data: p, success: true });
  },
  'DELETE /api/system/permission/:id': (req: any, res: any) => {
    const id = req.params.id;
    perms.delete(id);
    // cascade: remove permission from all roles
    roles.forEach((r) => {
      r.permissionIds = r.permissionIds.filter((pid) => pid !== id);
    });
    res.json({ success: true });
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
    const rec = {
      id,
      name: req.body.name,
      parentId: req.body.parentId || null,
      remark: req.body.remark || '',
      createdAt: now(),
    };
    depts.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/system/dept/:id': (req: any, res: any) => {
    const d = depts.get(req.params.id);
    if (!d) return res.json({ success: false, errorMessage: 'not found' });
    const { name, parentId, remark } = req.body;
    Object.assign(d, { name, parentId, remark });
    res.json({ data: d, success: true });
  },
  'DELETE /api/system/dept/:id': (req: any, res: any) => {
    const id = req.params.id;
    depts.delete(id);
    // cascade: clear deptId for users in this dept
    users.forEach((u) => {
      if (u.deptId === id) u.deptId = '';
    });
    res.json({ success: true });
  },
  // ---- menu ----
  'GET /api/system/menu': (_req: any, res: any) => {
    res.json({ data: Array.from(menus.values()), success: true });
  },
  'GET /api/system/menu/tree': (_req: any, res: any) => {
    res.json({ data: buildTree(Array.from(menus.values())), success: true });
  },
  'POST /api/system/menu': (req: any, res: any) => {
    const id = sid();
    const rec: MenuRecord = {
      id,
      parentId: req.body.parentId || null,
      name: req.body.name,
      icon: req.body.icon || '',
      path: req.body.path || '',
      permissionCode: req.body.permissionCode || '',
      sort: req.body.sort || 0,
      visible: req.body.visible ?? true,
      createdAt: now(),
    };
    menus.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/system/menu/:id': (req: any, res: any) => {
    const m = menus.get(req.params.id);
    if (!m) return res.json({ success: false, errorMessage: 'not found' });
    const { name, parentId, icon, path, permissionCode, sort, visible } =
      req.body;
    Object.assign(m, {
      name,
      parentId,
      icon,
      path,
      permissionCode,
      sort,
      visible,
    });
    res.json({ data: m, success: true });
  },
  'DELETE /api/system/menu/:id': (req: any, res: any) => {
    menus.delete(req.params.id);
    res.json({ success: true });
  },
};
