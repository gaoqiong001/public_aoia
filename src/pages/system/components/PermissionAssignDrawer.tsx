import { Button, Drawer, message, Tree } from 'antd';
import { useEffect, useState } from 'react';
import { assignRolePermissions, getPermissionTree } from '../service';

export interface PermissionAssignDrawerProps {
  open: boolean;
  onClose: () => void;
  role?: API.RoleItem;
  onSuccess?: () => void;
}

export default function PermissionAssignDrawer(
  props: PermissionAssignDrawerProps,
) {
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
    nodes.map((n) => ({
      title: `${n.name} (${n.code})`,
      key: n.id,
      children: n.children ? toTreeData(n.children) : undefined,
    }));

  return (
    <Drawer
      title={`分配权限 - ${role?.name ?? ''}`}
      open={open}
      onClose={onClose}
      width={480}
      extra={
        <Button
          type="primary"
          onClick={async () => {
            if (role) {
              await assignRolePermissions(role.id, checkedKeys);
              message.success('已保存');
              onSuccess?.();
              onClose();
            }
          }}
        >
          保存
        </Button>
      }
    >
      <Tree
        checkable
        defaultExpandAll
        treeData={toTreeData(tree)}
        checkedKeys={checkedKeys}
        onCheck={(keys) =>
          setCheckedKeys((keys as any).checked ?? (keys as string[]))
        }
      />
    </Drawer>
  );
}
