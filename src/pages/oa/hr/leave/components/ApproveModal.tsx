import { ModalForm, ProFormTextArea } from '@ant-design/pro-components';
import { message } from 'antd';
import { approveTask } from '../service';

export interface ApproveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pid: string;
  action: 'approve' | 'reject';
  approver: string;
  onSuccess?: () => void;
}

export default function ApproveModal(props: ApproveModalProps) {
  const { open, onOpenChange, pid, action, approver, onSuccess } = props;
  return (
    <ModalForm
      title={action === 'approve' ? '通过申请' : '驳回申请'}
      open={open}
      onOpenChange={onOpenChange}
      modalProps={{ destroyOnHidden: true }}
      onFinish={async (values) => {
        await approveTask(pid, {
          action,
          comment: values.comment ?? '',
          approver,
        });
        message.success(
          action === 'approve' ? '已通过' : '已驳回（退回申请人）',
        );
        onSuccess?.();
        return true;
      }}
    >
      <ProFormTextArea
        name="comment"
        label="审批意见"
        rules={
          action === 'reject'
            ? [{ required: true, message: '驳回请填写意见' }]
            : undefined
        }
      />
    </ModalForm>
  );
}
