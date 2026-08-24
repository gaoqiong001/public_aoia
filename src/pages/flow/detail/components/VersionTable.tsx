import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import { useRef } from 'react';
import { activateVersion, deleteVersion, getVersionList } from '../../service';

export default function VersionTable({ flowId }: { flowId: string }) {
  const actionRef = useRef<any>(null);

  const columns: ProColumns<API.FlowVersionItem>[] = [
    {
      title: '版本号',
      dataIndex: 'version',
      render: (_, r) => `v${r.version}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, r) =>
        r.status === 'active' ? (
          <Tag color="success">启动</Tag>
        ) : (
          <Tag>未启动</Tag>
        ),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="medium">
          <a
            key="view"
            onClick={() =>
              history.push(`/flow-editor?flowId=${flowId}&versionId=${r.id}`)
            }
          >
            查看
          </a>
          {r.status === 'active' ? (
            <span key="active" style={{ color: '#999' }}>
              已启动
            </span>
          ) : (
            <Popconfirm
              key="act"
              title="设为启动版本?"
              onConfirm={async () => {
                await activateVersion(flowId, r.id);
                message.success('已设为启动');
                actionRef.current?.reload();
              }}
            >
              <a>启动</a>
            </Popconfirm>
          )}
          <Popconfirm
            key="del"
            title="确认删除该版本?"
            onConfirm={async () => {
              await deleteVersion(flowId, r.id);
              message.success('已删除');
              actionRef.current?.reload();
            }}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProTable<API.FlowVersionItem>
      actionRef={actionRef}
      rowKey="id"
      search={false}
      toolBarRender={() => [
        <Button
          key="new"
          type="primary"
          onClick={() => history.push(`/flow-editor?flowId=${flowId}`)}
        >
          新建版本
        </Button>,
      ]}
      request={async () => {
        const data = await getVersionList(flowId);
        return { data, success: true };
      }}
      columns={columns}
    />
  );
}
