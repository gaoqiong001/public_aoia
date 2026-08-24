import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Button, message, Popconfirm, Space, Tag, Tree } from 'antd';
import { useEffect, useRef, useState } from 'react';
import MenuForm from '../components/MenuForm';
import { deleteMenu, getMenuTree } from '../service';

export default function MenuMgmtPage() {
  const access = useAccess();
  const [tree, setTree] = useState<API.MenuTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.MenuItem>();
  const [presetParent, setPresetParent] = useState<string>();
  const actionRef = useRef<ActionType | null>(null);
  const reload = () => getMenuTree().then(setTree);
  useEffect(() => {
    reload();
  }, []);

  const flatMap = new Map<string, API.MenuTreeNode>();
  const flatten = (nodes: API.MenuTreeNode[]) => {
    nodes.forEach((n) => {
      flatMap.set(n.id, n);
      if (n.children) flatten(n.children);
    });
  };
  flatten(tree);

  const childList: API.MenuItem[] = selectedId
    ? (flatMap.get(selectedId)?.children ?? []).map((c) => ({
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        icon: c.icon,
        path: c.path,
        permissionCode: c.permissionCode,
        sort: c.sort,
        visible: c.visible,
        createdAt: c.createdAt,
      }))
    : tree.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        name: n.name,
        icon: n.icon,
        path: n.path,
        permissionCode: n.permissionCode,
        sort: n.sort,
        visible: n.visible,
        createdAt: n.createdAt,
      }));

  const openCreate = (parentId?: string) => {
    setCurrent(undefined);
    setPresetParent(parentId);
    setFormOpen(true);
  };
  const openEdit = (node: API.MenuItem) => {
    setCurrent(node);
    setPresetParent(undefined);
    setFormOpen(true);
  };

  const toTreeData = (nodes: API.MenuTreeNode[]): any[] =>
    nodes.map((n) => ({
      title: (
        <span>
          {n.name} <Tag>{n.icon}</Tag>
        </span>
      ),
      key: n.id,
      children: n.children ? toTreeData(n.children) : undefined,
    }));

  const columns: ProColumns<API.MenuItem>[] = [
    { title: '名称', dataIndex: 'name' },
    { title: '图标', dataIndex: 'icon', width: 80 },
    { title: '路径', dataIndex: 'path' },
    { title: '权限编码', dataIndex: 'permissionCode' },
    { title: '排序', dataIndex: 'sort', width: 60 },
    {
      title: '可见',
      dataIndex: 'visible',
      render: (_, r) =>
        r.visible ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>,
      width: 60,
    },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="medium">
          {access?.can('system:permission') && (
            <a onClick={() => openCreate(r.id)}>新增子菜单</a>
          )}
          {access?.can('system:permission') && (
            <a onClick={() => openEdit(r)}>编辑</a>
          )}
          {access?.can('system:permission') && (
            <Popconfirm
              title="确认删除?"
              onConfirm={async () => {
                await deleteMenu(r.id);
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
            width: 280,
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
                新建菜单
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
          <ProTable<API.MenuItem>
            actionRef={actionRef}
            rowKey="id"
            search={false}
            dataSource={childList}
            columns={columns}
            toolBarRender={() =>
              access?.can('system:permission')
                ? [
                    <Button
                      key="new"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openCreate(selectedId)}
                    >
                      新建菜单
                    </Button>,
                  ]
                : []
            }
          />
        </div>
      </div>
      <MenuForm
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
