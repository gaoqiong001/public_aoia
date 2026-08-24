import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTreeSelect,
} from '@ant-design/pro-components';
import { useEffect, useState } from 'react';
import {
  createPermission,
  getPermissionTree,
  updatePermission,
} from '../service';

export interface PermissionFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: API.PermissionItem;
  presetParentId?: string;
  onSuccess?: () => void;
}

function toTreeData(nodes?: API.PermissionTreeNode[]): any[] {
  return (nodes ?? []).map((n) => ({
    title: `${n.name} (${n.code})`,
    value: n.id,
    children: toTreeData(n.children),
  }));
}

export default function PermissionForm(props: PermissionFormProps) {
  const { open, onOpenChange, record, presetParentId, onSuccess } = props;
  const isEdit = !!record;
  const [tree, setTree] = useState<API.PermissionTreeNode[]>([]);
  useEffect(() => {
    if (open) getPermissionTree().then(setTree);
  }, [open]);
  return (
    <ModalForm<API.PermissionItem>
      title={isEdit ? '编辑权限' : '新建权限'}
      open={open}
      onOpenChange={onOpenChange}
      initialValues={
        record
          ? {
              name: record.name,
              code: record.code,
              type: record.type,
              parentId: record.parentId,
            }
          : { type: 'menu', parentId: presetParentId }
      }
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) await updatePermission(record.id, values);
        else await createPermission(values);
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText name="name" label="权限名称" rules={[{ required: true }]} />
      <ProFormText name="code" label="权限编码" rules={[{ required: true }]} />
      <ProFormSelect
        name="type"
        label="类型"
        rules={[{ required: true }]}
        options={[
          { label: '菜单权限', value: 'menu' },
          { label: '操作权限', value: 'operation' },
        ]}
      />
      <ProFormTreeSelect
        name="parentId"
        label="上级权限"
        allowClear
        fieldProps={{ treeData: toTreeData(tree), treeDefaultExpandAll: true }}
      />
    </ModalForm>
  );
}
