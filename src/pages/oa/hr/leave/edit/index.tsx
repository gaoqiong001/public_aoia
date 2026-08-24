import {
  FooterToolbar,
  PageContainer,
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { history, useSearchParams } from '@umijs/max';
import { Alert, Button, Card, Form, message, Space } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
  createLeaveApplication,
  getInstanceDetail,
  resubmitApplication,
} from '../service';

export default function LeaveEdit() {
  const [searchParams] = useSearchParams();
  const pid = searchParams.get('pid') ?? undefined;
  const [form] = Form.useForm();
  const leaveType = Form.useWatch('leaveType', form);
  const startDate = Form.useWatch('startDate', form);
  const endDate = Form.useWatch('endDate', form);
  const [rejectComment, setRejectComment] = useState<string>();
  const [applicant, setApplicant] = useState('admin');

  // 重提模式：预填原数据 + 最近驳回意见
  useEffect(() => {
    if (!pid) return;
    getInstanceDetail(pid)
      .then((d) => {
        const a = d.application;
        setApplicant(a.applicant);
        form.setFieldsValue({
          leaveType: a.leaveType,
          startDate: dayjs(a.startDate),
          endDate: dayjs(a.endDate),
          days: a.days,
          reason: a.reason,
          diagnosisNote: a.diagnosisNote,
        });
        const last = [...d.history]
          .reverse()
          .find((h) => h.action === 'reject');
        setRejectComment(last?.comment);
      })
      .catch(() => setRejectComment(undefined));
  }, [pid, form]);

  // 天数自动计算
  useEffect(() => {
    const start = startDate as dayjs.Dayjs | string | undefined;
    const end = endDate as dayjs.Dayjs | string | undefined;
    if (!start || !end) {
      form.setFieldValue('days', undefined);
      return;
    }
    const s = dayjs.isDayjs(start) ? start : dayjs(start);
    const e = dayjs.isDayjs(end) ? end : dayjs(end);
    if (!s.isValid() || !e.isValid() || e.isBefore(s)) {
      form.setFieldValue('days', undefined);
      return;
    }
    form.setFieldValue('days', e.diff(s, 'day') + 1);
  }, [startDate, endDate, form]);

  return (
    <PageContainer title={pid ? '重新提交申请' : '发起请假申请'}>
      <Card>
        <ProForm<Record<string, any>>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const payload = {
              ...values,
              startDate:
                values.startDate?.format?.('YYYY-MM-DD') ?? values.startDate,
              endDate: values.endDate?.format?.('YYYY-MM-DD') ?? values.endDate,
            };
            if (pid) {
              await resubmitApplication(pid, payload);
              message.success('已重新提交');
            } else {
              await createLeaveApplication({ applicant, formData: payload });
              message.success('已提交，等待审批');
            }
            history.push('/oa/hr/leave');
          }}
          submitter={false}
        >
          {pid && rejectComment && (
            <Alert
              type="warning"
              showIcon
              title="驳回意见"
              description={rejectComment}
              style={{ marginBottom: 16 }}
            />
          )}
          <ProFormText
            name="applicant"
            label="姓名"
            initialValue={applicant}
            disabled
          />
          <ProFormSelect
            name="leaveType"
            label="请假类型"
            options={[
              { label: '年假', value: '年假' },
              { label: '事假', value: '事假' },
              { label: '病假', value: '病假' },
              { label: '调休', value: '调休' },
            ]}
            rules={[{ required: true, message: '请选择请假类型' }]}
          />
          <ProFormDatePicker
            name="startDate"
            label="开始日期"
            rules={[{ required: true, message: '请选择开始日期' }]}
          />
          <ProFormDatePicker
            name="endDate"
            label="结束日期"
            rules={[{ required: true, message: '请选择结束日期' }]}
          />
          <ProFormDigit
            name="days"
            label="请假天数"
            min={0.5}
            disabled
            rules={[{ required: true, message: '请输入天数' }]}
          />
          <ProFormTextArea
            name="reason"
            label="事由"
            rules={[{ required: true, message: '请填写事由' }]}
          />
          {leaveType === '病假' && (
            <ProFormText
              name="diagnosisNote"
              label="诊断说明"
              rules={[{ required: true, message: '病假需填写诊断说明' }]}
            />
          )}
        </ProForm>
      </Card>
      <FooterToolbar>
        <Space>
          <Button onClick={() => history.push('/oa/hr/leave')}>取消</Button>
          <Button type="primary" onClick={() => form.submit()}>
            {pid ? '重新提交' : '提交申请'}
          </Button>
        </Space>
      </FooterToolbar>
    </PageContainer>
  );
}
