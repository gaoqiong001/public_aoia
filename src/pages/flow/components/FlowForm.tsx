import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { createFlow, updateFlow } from '../service';

export interface FlowFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: API.FlowItem;
  onSuccess?: () => void;
}

export default function FlowForm(props: FlowFormProps) {
  const { open, onOpenChange, record, onSuccess } = props;
  const isEdit = !!record;
  return (
    <ModalForm<API.FlowItem>
      title={isEdit ? '编辑流程' : '新建流程'}
      open={open}
      onOpenChange={onOpenChange}
      initialValues={
        record
          ? {
              name: record.name,
              description: record.description,
              code: record.code,
              status: record.status,
            }
          : { status: 'draft' }
      }
      modalProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        if (isEdit && record) {
          await updateFlow(record.id, values);
        } else {
          await createFlow(values);
        }
        onSuccess?.();
        return true;
      }}
    >
      <ProFormText
        name="name"
        label="流程名称"
        rules={[{ required: true, message: '请输入名称' }]}
      />
      <ProFormText
        name="code"
        label="业务编码"
        placeholder="如 leave_approval（业务页面按此编码绑定流程）"
        disabled={isEdit}
      />
      <ProFormTextArea name="description" label="描述" />
      <ProFormSelect
        name="status"
        label="状态"
        options={[
          { label: '草稿', value: 'draft' },
          { label: '已发布', value: 'published' },
          { label: '已归档', value: 'archived' },
        ]}
      />
    </ModalForm>
  );
}
