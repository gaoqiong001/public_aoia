import {
  ModalForm,
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTreeSelect,
} from '@ant-design/pro-components';
import { useEffect, useState } from 'react';
import { createMenu, getMenuTree, updateMenu } from '../service';

export interface MenuFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: API.MenuItem;
  presetParentId?: string;
  onSuccess?: () => void;
}

function toTreeData(nodes?: API.MenuTreeNode[]): any[] {
  return (nodes ?? []).map((n) => ({
    title: n.name,
    value: n.id,
    children: toTreeData(n.children),
  }));
}

export default function MenuForm(props: MenuFormProps) {
  const { open, onOpenChange, record, presetParentId, onSuccess } = props;
  const isEdit = !!record;
  const [tree, setTree] = useState<API.MenuTreeNode[]>([]);
  useEffect(() => {
    if (open) getMenuTree().then(setTree);
  }, [open]);
  return (
    <ModalForm<API.MenuItem>
      title={isEdit ? '编辑菜单' : '新建菜单'}
      open={open}
      onOpenChange={onOpenChange}
      initialValues={
        record
          ? {
              name: record.name,
              icon: record.icon,
              path: record.path,
              permissionCode: record.permissionCode,
              parentId: record.parentId,
              sort: record.sort,
              visible: record.visible,
            }
          : { sort: 0, visible: true, parentId: presetParentId }
      }
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) await updateMenu(record.id, values);
        else await createMenu(values);
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText name="name" label="菜单名称" rules={[{ required: true }]} />
      <ProFormText name="icon" label="图标" />
      <ProFormText name="path" label="路由路径" />
      <ProFormText name="permissionCode" label="权限编码" />
      <ProFormTreeSelect
        name="parentId"
        label="上级菜单"
        allowClear
        fieldProps={{ treeData: toTreeData(tree), treeDefaultExpandAll: true }}
      />
      <ProFormDigit
        name="sort"
        label="排序"
        min={0}
        fieldProps={{ precision: 0 }}
      />
      <ProFormSwitch name="visible" label="是否显示" />
    </ModalForm>
  );
}
