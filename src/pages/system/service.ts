import { request } from '@umijs/max';

interface Res<T> {
  data: T;
  success: boolean;
}
const unwrap = async <T>(p: Promise<Res<T>>) => (await p).data;

// user
export const getUserList = () =>
  unwrap(request<Res<API.SystemUser[]>>('/api/system/user'));
export const createUser = (
  data: Partial<API.SystemUser> & { password?: string },
) =>
  unwrap(
    request<Res<API.SystemUser>>('/api/system/user', { method: 'POST', data }),
  );
export const updateUser = (id: string, data: Partial<API.SystemUser>) =>
  unwrap(
    request<Res<API.SystemUser>>(`/api/system/user/${id}`, {
      method: 'PUT',
      data,
    }),
  );
export const deleteUser = (id: string) =>
  request(`/api/system/user/${id}`, { method: 'DELETE' });
export const assignUserRoles = (id: string, roleIds: string[]) =>
  request(`/api/system/user/${id}/roles`, {
    method: 'PUT',
    data: { roleIds },
  });

// role
export const getRoleList = () =>
  unwrap(request<Res<API.RoleItem[]>>('/api/system/role'));
export const createRole = (data: Partial<API.RoleItem>) =>
  unwrap(
    request<Res<API.RoleItem>>('/api/system/role', { method: 'POST', data }),
  );
export const updateRole = (id: string, data: Partial<API.RoleItem>) =>
  unwrap(
    request<Res<API.RoleItem>>(`/api/system/role/${id}`, {
      method: 'PUT',
      data,
    }),
  );
export const deleteRole = (id: string) =>
  request(`/api/system/role/${id}`, { method: 'DELETE' });
export const assignRolePermissions = (id: string, permissionIds: string[]) =>
  request(`/api/system/role/${id}/permissions`, {
    method: 'PUT',
    data: { permissionIds },
  });

// permission
export const getPermissionList = () =>
  unwrap(request<Res<API.PermissionItem[]>>('/api/system/permission'));
export const getPermissionTree = () =>
  unwrap(request<Res<API.PermissionTreeNode[]>>('/api/system/permission/tree'));
export const createPermission = (data: Partial<API.PermissionItem>) =>
  unwrap(
    request<Res<API.PermissionItem>>('/api/system/permission', {
      method: 'POST',
      data,
    }),
  );
export const updatePermission = (
  id: string,
  data: Partial<API.PermissionItem>,
) =>
  unwrap(
    request<Res<API.PermissionItem>>(`/api/system/permission/${id}`, {
      method: 'PUT',
      data,
    }),
  );
export const deletePermission = (id: string) =>
  request(`/api/system/permission/${id}`, { method: 'DELETE' });

// menu
export const getMenuList = () =>
  unwrap(request<Res<API.MenuItem[]>>('/api/system/menu'));
export const getMenuTree = () =>
  unwrap(request<Res<API.MenuTreeNode[]>>('/api/system/menu/tree'));
export const createMenu = (data: Partial<API.MenuItem>) =>
  unwrap(
    request<Res<API.MenuItem>>('/api/system/menu', { method: 'POST', data }),
  );
export const updateMenu = (id: string, data: Partial<API.MenuItem>) =>
  unwrap(
    request<Res<API.MenuItem>>(`/api/system/menu/${id}`, {
      method: 'PUT',
      data,
    }),
  );
export const deleteMenu = (id: string) =>
  request(`/api/system/menu/${id}`, { method: 'DELETE' });

// dept
export const getDeptList = () =>
  unwrap(request<Res<API.DeptItem[]>>('/api/system/dept'));
export const getDeptTree = () =>
  unwrap(request<Res<API.DeptTreeNode[]>>('/api/system/dept/tree'));
export const createDept = (data: Partial<API.DeptItem>) =>
  unwrap(
    request<Res<API.DeptItem>>('/api/system/dept', { method: 'POST', data }),
  );
export const updateDept = (id: string, data: Partial<API.DeptItem>) =>
  unwrap(
    request<Res<API.DeptItem>>(`/api/system/dept/${id}`, {
      method: 'PUT',
      data,
    }),
  );
export const deleteDept = (id: string) =>
  request(`/api/system/dept/${id}`, { method: 'DELETE' });
