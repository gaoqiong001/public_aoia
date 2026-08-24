import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTreeSelect,
} from '@ant-design/pro-components';
import { useEffect, useState } from 'react';
import { createUser, getDeptTree, getRoleList, updateUser } from '../service';

export interface UserFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: API.SystemUser;
  onSuccess?: () => void;
}

function toTreeData(nodes?: API.DeptTreeNode[]): any[] {
  return (nodes ?? []).map((n) => ({
    title: n.name,
    value: n.id,
    children: toTreeData(n.children),
  }));
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
      open={open}
      onOpenChange={onOpenChange}
      initialValues={
        record
          ? {
              username: record.username,
              name: record.name,
              email: record.email,
              deptId: record.deptId,
              roleIds: record.roleIds,
              status: record.status,
            }
          : { status: 'active' }
      }
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) await updateUser(record.id, values);
        else await createUser(values);
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText
        name="username"
        label="用户名"
        rules={[{ required: true, message: '请输入用户名' }]}
        disabled={isEdit}
      />
      <ProFormText
        name="name"
        label="姓名"
        rules={[{ required: true, message: '请输入姓名' }]}
      />
      <ProFormText name="email" label="邮箱" />
      <ProFormTreeSelect
        name="deptId"
        label="部门"
        fieldProps={{
          treeData: toTreeData(deptTree),
          treeDefaultExpandAll: true,
        }}
      />
      <ProFormSelect
        name="roleIds"
        label="角色"
        mode="multiple"
        options={roles.map((r) => ({ label: r.name, value: r.id }))}
      />
      <ProFormSelect
        name="status"
        label="状态"
        options={[
          { label: '启用', value: 'active' },
          { label: '禁用', value: 'disabled' },
        ]}
      />
    </ModalForm>
  );
}
