import { Button, Checkbox, Drawer, message } from 'antd';
import { useEffect, useState } from 'react';
import { assignUserRoles, getRoleList } from '../service';

export interface RoleAssignDrawerProps {
  open: boolean;
  onClose: () => void;
  user?: API.SystemUser;
  onSuccess?: () => void;
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
    <Drawer
      title={`分配角色 - ${user?.name ?? ''}`}
      open={open}
      onClose={onClose}
      width={420}
      extra={
        <Button
          type="primary"
          onClick={async () => {
            if (user) {
              await assignUserRoles(user.id, checked);
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
      <Checkbox.Group
        value={checked}
        onChange={(v) => setChecked(v as string[])}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roles.map((r) => (
            <Checkbox key={r.id} value={r.id}>
              {r.name}({r.code})
            </Checkbox>
          ))}
        </div>
      </Checkbox.Group>
    </Drawer>
  );
}
