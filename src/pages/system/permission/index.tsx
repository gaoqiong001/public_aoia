import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Button, message, Popconfirm, Space, Tag, Tree } from 'antd';
import { useEffect, useRef, useState } from 'react';
import PermissionForm from '../components/PermissionForm';
import { deletePermission, getPermissionTree } from '../service';

export default function PermissionPage() {
  const access = useAccess();
  const [tree, setTree] = useState<API.PermissionTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.PermissionItem>();
  const [presetParent, setPresetParent] = useState<string>();
  const actionRef = useRef<ActionType | null>(null);
  const reload = () => getPermissionTree().then(setTree);
  useEffect(() => {
    reload();
  }, []);

  const flatMap = new Map<string, API.PermissionTreeNode>();
  const flatten = (nodes: API.PermissionTreeNode[]) => {
    nodes.forEach((n) => {
      flatMap.set(n.id, n);
      if (n.children) flatten(n.children);
    });
  };
  flatten(tree);

  const childList: API.PermissionItem[] = selectedId
    ? (flatMap.get(selectedId)?.children ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        type: c.type,
        parentId: c.parentId,
        createdAt: c.createdAt,
      }))
    : tree.map((n) => ({
        id: n.id,
        name: n.name,
        code: n.code,
        type: n.type,
        parentId: n.parentId,
        createdAt: n.createdAt,
      }));

  const openCreate = (parentId?: string) => {
    setCurrent(undefined);
    setPresetParent(parentId);
    setFormOpen(true);
  };
  const openEdit = (node: API.PermissionItem) => {
    setCurrent(node);
    setPresetParent(undefined);
    setFormOpen(true);
  };

  const toTreeData = (nodes: API.PermissionTreeNode[]): any[] =>
    nodes.map((n) => ({
      title: (
        <span>
          {n.name}{' '}
          <Tag color={n.type === 'menu' ? 'blue' : 'green'}>{n.code}</Tag>
        </span>
      ),
      key: n.id,
      children: n.children ? toTreeData(n.children) : undefined,
    }));

  const columns: ProColumns<API.PermissionItem>[] = [
    { title: '名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code' },
    {
      title: '类型',
      dataIndex: 'type',
      render: (_, r) => (
        <Tag color={r.type === 'menu' ? 'blue' : 'green'}>
          {r.type === 'menu' ? '菜单' : '操作'}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="medium">
          {access?.can('system:permission') && (
            <a onClick={() => openCreate(r.id)}>新增子级</a>
          )}
          {access?.can('system:permission') && (
            <a onClick={() => openEdit(r)}>编辑</a>
          )}
          {access?.can('system:permission') && (
            <Popconfirm
              title="确认删除?"
              onConfirm={async () => {
                await deletePermission(r.id);
                message.success('已删除');
                reload();
                actionRef.current?.reload();
              }}
            >
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: 16 }}>
        <div
          style={{
            width: 320,
            flexShrink: 0,
            overflow: 'auto',
            maxHeight: 'calc(100vh - 200px)',
          }}
        >
          <div style={{ marginBottom: 8 }}>
            {access?.can('system:permission') && (
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openCreate()}
              >
                新建权限
              </Button>
            )}
          </div>
          <Tree
            treeData={toTreeData(tree)}
            defaultExpandAll
            selectedKeys={selectedId ? [selectedId] : []}
            onSelect={(keys) => {
              setSelectedId((keys[0] as string) || undefined);
              actionRef.current?.reload();
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <ProTable<API.PermissionItem>
            actionRef={actionRef}
            rowKey="id"
            search={false}
            dataSource={childList}
            columns={columns}
          />
        </div>
      </div>
      <PermissionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        record={current}
        presetParentId={presetParent}
        onSuccess={() => {
          setFormOpen(false);
          reload();
          actionRef.current?.reload();
        }}
      />
    </PageContainer>
  );
}
