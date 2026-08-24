import { Descriptions, Tag } from 'antd';

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  published: { text: '已发布', color: 'green' },
  archived: { text: '已归档', color: 'orange' },
};

export default function BasicInfo({ flow }: { flow?: API.FlowItem }) {
  if (!flow) return null;
  const status = statusMap[flow.status] ?? {
    text: flow.status,
    color: 'default',
  };
  return (
    <Descriptions
      title="流程基础信息"
      column={2}
      items={[
        { key: 'name', label: '流程名称', children: flow.name },
        {
          key: 'description',
          label: '描述',
          children: flow.description || '-',
        },
        { key: 'code', label: '业务编码', children: flow.code || '-' },
        {
          key: 'status',
          label: '状态',
          children: <Tag color={status.color}>{status.text}</Tag>,
        },
        {
          key: 'activeVersion',
          label: '当前启用版本',
          children: flow.activeVersionId ? '是' : '无',
        },
        { key: 'createdAt', label: '创建时间', children: flow.createdAt },
        { key: 'updatedAt', label: '更新时间', children: flow.updatedAt },
      ]}
    />
  );
}
