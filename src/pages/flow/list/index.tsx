import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, message, Popconfirm, Space } from 'antd';
import { useRef, useState } from 'react';
import FlowForm from '../components/FlowForm';
import { deleteFlow, getFlowList } from '../service';

const statusMap: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

export default function FlowList() {
  const actionRef = useRef<ActionType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.FlowItem>();

  const columns: ProColumns<API.FlowItem>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (_, r) => (
        <a onClick={() => history.push(`/flow/${r.id}`)}>{r.name}</a>
      ),
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, r) => statusMap[r.status] || r.status,
    },
    { title: '版本数', dataIndex: 'versionCount' },
    { title: '更新时间', dataIndex: 'updatedAt' },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="medium">
          <a key="detail" onClick={() => history.push(`/flow/${r.id}`)}>
            详情
          </a>
          <a
            key="edit"
            onClick={() => {
              setCurrent(r);
              setFormOpen(true);
            }}
          >
            编辑
          </a>
          <Popconfirm
            key="del"
            title="确认删除?"
            onConfirm={async () => {
              await deleteFlow(r.id);
              message.success('已删除');
              actionRef.current?.reload();
            }}
          >
            <a>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.FlowItem>
        actionRef={actionRef}
        rowKey="id"
        search={false}
        request={async () => {
          const data = await getFlowList();
          return { data, success: true };
        }}
        columns={columns}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCurrent(undefined);
              setFormOpen(true);
            }}
          >
            新建流程
          </Button>,
        ]}
      />
      <FlowForm
        open={formOpen}
        onOpenChange={setFormOpen}
        record={current}
        onSuccess={() => {
          setFormOpen(false);
          actionRef.current?.reload();
        }}
      />
    </PageContainer>
  );
}
