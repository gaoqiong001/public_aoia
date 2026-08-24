import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, message, Popconfirm, Space, Tabs, Tag } from 'antd';
import { useState } from 'react';
import ApproveModal from './components/ApproveModal';
import {
  type DoneRow,
  listMyApplications,
  listMyDone,
  listMyPendingTasks,
  type MyApplicationRow,
  type PendingTaskRow,
  withdrawApplication,
} from './service';

const statusMap: Record<string, { text: string; color: string }> = {
  approving: { text: '审批中', color: 'processing' },
  returned: { text: '已退回', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  withdrawn: { text: '已撤回', color: 'default' },
};

export default function LeaveApproval() {
  const { initialState } = useModel('@@initialState');
  const applicant = initialState?.currentUser?.name || 'admin';
  const [tab, setTab] = useState('apply');
  const [approve, setApprove] = useState<{
    pid: string;
    action: 'approve' | 'reject';
  }>();
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((k) => k + 1);

  const myAppColumns: ProColumns<MyApplicationRow>[] = [
    { title: '请假类型', dataIndex: 'leaveType' },
    {
      title: '起止日期',
      render: (_, r: MyApplicationRow) => `${r.startDate} ~ ${r.endDate}`,
    },
    { title: '天数', dataIndex: 'days', width: 70 },
    {
      title: '状态',
      dataIndex: 'processStatus',
      width: 90,
      render: (_, r: MyApplicationRow) => (
        <Tag color={statusMap[r.processStatus]?.color}>
          {statusMap[r.processStatus]?.text}
        </Tag>
      ),
    },
    { title: '提交时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      width: 200,
      render: (_, r: MyApplicationRow) => (
        <Space size="medium">
          <a
            onClick={() => history.push(`/oa/hr/leave/${r.processInstanceId}`)}
          >
            详情
          </a>
          {r.processStatus === 'approving' && (
            <Popconfirm
              title="确认撤回该申请?"
              onConfirm={async () => {
                await withdrawApplication(r.processInstanceId);
                message.success('已撤回');
                refresh();
              }}
            >
              <a style={{ color: '#faad14' }}>撤回</a>
            </Popconfirm>
          )}
          {(r.processStatus === 'returned' ||
            r.processStatus === 'withdrawn') && (
            <a
              onClick={() =>
                history.push(`/oa/hr/leave/edit?pid=${r.processInstanceId}`)
              }
            >
              编辑重提
            </a>
          )}
        </Space>
      ),
    },
  ];

  const taskColumns: ProColumns<PendingTaskRow>[] = [
    { title: '申请人', dataIndex: 'applicant', width: 100 },
    { title: '请假类型', dataIndex: 'leaveType', width: 100 },
    {
      title: '起止日期',
      render: (_, r: PendingTaskRow) => `${r.startDate} ~ ${r.endDate}`,
    },
    { title: '天数', dataIndex: 'days', width: 70 },
    { title: '事由', dataIndex: 'reason', ellipsis: true },
    { title: '提交时间', dataIndex: 'submittedAt' },
    {
      title: '操作',
      width: 180,
      render: (_, r: PendingTaskRow) => (
        <Space size="medium">
          <a
            onClick={() => history.push(`/oa/hr/leave/${r.processInstanceId}`)}
          >
            详情
          </a>
          <a
            onClick={() =>
              setApprove({ pid: r.processInstanceId, action: 'approve' })
            }
          >
            通过
          </a>
          <a
            style={{ color: '#ff4d4f' }}
            onClick={() =>
              setApprove({ pid: r.processInstanceId, action: 'reject' })
            }
          >
            驳回
          </a>
        </Space>
      ),
    },
  ];

  const doneColumns: ProColumns<DoneRow>[] = [
    { title: '申请人', dataIndex: 'applicant', width: 100 },
    { title: '请假类型', dataIndex: 'leaveType', width: 100 },
    { title: '天数', dataIndex: 'days', width: 70 },
    { title: '审批节点', dataIndex: 'nodeTitle' },
    {
      title: '动作',
      dataIndex: 'action',
      width: 80,
      render: (_, r: DoneRow) =>
        r.action === 'approve' ? (
          <Tag color="green">通过</Tag>
        ) : (
          <Tag color="red">驳回</Tag>
        ),
    },
    { title: '意见', dataIndex: 'comment', ellipsis: true },
    { title: '时间', dataIndex: 'time' },
  ];

  return (
    <PageContainer>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'apply',
            label: '发起申请',
            children: (
              <Button
                type="primary"
                onClick={() => history.push('/oa/hr/leave/edit')}
              >
                发起请假申请
              </Button>
            ),
          },
          {
            key: 'mine',
            label: '我的申请',
            children: (
              <ProTable<MyApplicationRow>
                rowKey="id"
                search={false}
                params={{ applicant, reloadKey }}
                request={async (p) => ({
                  data: await listMyApplications(p.applicant),
                  success: true,
                })}
                columns={myAppColumns}
              />
            ),
          },
          {
            key: 'todo',
            label: '待我审批',
            children: (
              <ProTable<PendingTaskRow>
                rowKey="processInstanceId"
                search={false}
                params={{ currentUser: applicant, reloadKey }}
                request={async (p) => ({
                  data: await listMyPendingTasks(p.currentUser || applicant),
                  success: true,
                })}
                columns={taskColumns}
              />
            ),
          },
          {
            key: 'done',
            label: '已办',
            children: (
              <ProTable<DoneRow>
                rowKey={(r) => `${r.processInstanceId}-${r.time}`}
                search={false}
                params={{ currentUser: applicant, reloadKey }}
                request={async (p) => ({
                  data: await listMyDone(p.currentUser || applicant),
                  success: true,
                })}
                columns={doneColumns}
              />
            ),
          },
        ]}
      />
      <ApproveModal
        open={!!approve}
        onOpenChange={(o) => !o && setApprove(undefined)}
        pid={approve?.pid ?? ''}
        action={approve?.action ?? 'approve'}
        approver={applicant}
        onSuccess={() => {
          setApprove(undefined);
          refresh();
        }}
      />
    </PageContainer>
  );
}
