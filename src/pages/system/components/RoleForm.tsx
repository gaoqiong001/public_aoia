import {
  ModalForm,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { createRole, updateRole } from '../service';

export interface RoleFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: API.RoleItem;
  onSuccess?: () => void;
}

export default function RoleForm(props: RoleFormProps) {
  const { open, onOpenChange, record, onSuccess } = props;
  const isEdit = !!record;
  return (
    <ModalForm<API.RoleItem>
      title={isEdit ? '编辑角色' : '新建角色'}
      open={open}
      onOpenChange={onOpenChange}
      initialValues={
        record
          ? { name: record.name, code: record.code, remark: record.remark }
          : {}
      }
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) await updateRole(record.id, values);
        else await createRole(values);
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText
        name="name"
        label="角色名称"
        rules={[{ required: true, message: '请输入名称' }]}
      />
      <ProFormText
        name="code"
        label="角色编码"
        rules={[{ required: true, message: '请输入编码' }]}
      />
      <ProFormTextArea name="remark" label="备注" />
    </ModalForm>
  );
}
