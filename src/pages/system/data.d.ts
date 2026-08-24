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
  interface MenuItem {
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
  interface MenuTreeNode extends MenuItem {
    children?: MenuTreeNode[];
  }
}
