import {
  ModalForm,
  ProFormText,
  ProFormTreeSelect,
} from '@ant-design/pro-components';
import { useEffect, useState } from 'react';
import { createDept, getDeptTree, updateDept } from '../service';

export interface DeptFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** 编辑的部门;为 undefined 表示新建。 */
  record?: API.DeptItem;
  /** 新建时预设的上级部门 id。 */
  presetParentId?: string;
  onSuccess?: () => void;
}

function toTreeData(nodes?: API.DeptTreeNode[]): any[] {
  return (nodes ?? []).map((n) => ({
    title: n.name,
    value: n.id,
    children: toTreeData(n.children),
  }));
}

export default function DeptForm(props: DeptFormProps) {
  const { open, onOpenChange, record, presetParentId, onSuccess } = props;
  const isEdit = !!record;
  const [tree, setTree] = useState<API.DeptTreeNode[]>([]);
  useEffect(() => {
    if (open) getDeptTree().then(setTree);
  }, [open]);
  return (
    <ModalForm<API.DeptItem>
      title={isEdit ? '编辑部门' : '新建部门'}
      open={open}
      onOpenChange={onOpenChange}
      initialValues={
        record
          ? {
              name: record.name,
              parentId: record.parentId,
              remark: record.remark,
            }
          : { parentId: presetParentId }
      }
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) await updateDept(record.id, values);
        else await createDept(values);
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText
        name="name"
        label="部门名称"
        rules={[{ required: true, message: '请输入名称' }]}
      />
      <ProFormTreeSelect
        name="parentId"
        label="上级部门"
        allowClear
        fieldProps={{ treeData: toTreeData(tree), treeDefaultExpandAll: true }}
      />
      <ProFormText name="remark" label="备注" />
    </ModalForm>
  );
}
