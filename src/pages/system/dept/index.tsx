import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Button, message, Popconfirm, Space, Tree } from 'antd';
import { useEffect, useRef, useState } from 'react';
import DeptForm from '../components/DeptForm';
import { deleteDept, getDeptTree, getUserList } from '../service';

export default function DeptPage() {
  const access = useAccess();
  const [tree, setTree] = useState<API.DeptTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.DeptItem>();
  const [presetParent, setPresetParent] = useState<string>();
  const actionRef = useRef<ActionType | null>(null);
  const [userCountMap, setUserCountMap] = useState<Map<string, number>>(
    new Map(),
  );
  const reload = () => getDeptTree().then(setTree);
  useEffect(() => {
    reload();
    getUserList().then((users) => {
      const map = new Map<string, number>();
      users.forEach((u) => {
        map.set(u.deptId, (map.get(u.deptId) || 0) + 1);
      });
      setUserCountMap(map);
    });
  }, []);

  // flatten tree to a map for finding children of selected node
  const flatMap = new Map<string, API.DeptTreeNode>();
  const flatten = (nodes: API.DeptTreeNode[]) => {
    nodes.forEach((n) => {
      flatMap.set(n.id, n);
      if (n.children) flatten(n.children);
    });
  };
  flatten(tree);

  // children of selected node (or roots if none selected)
  const childList: API.DeptItem[] = selectedId
    ? (flatMap.get(selectedId)?.children ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        remark: c.remark,
        createdAt: c.createdAt,
      }))
    : tree.map((n) => ({
        id: n.id,
        name: n.name,
        parentId: n.parentId,
        remark: n.remark,
        createdAt: n.createdAt,
      }));

  const openCreate = (parentId?: string) => {
    setCurrent(undefined);
    setPresetParent(parentId);
    setFormOpen(true);
  };
  const openEdit = (node: API.DeptItem) => {
    setCurrent(node);
    setPresetParent(undefined);
    setFormOpen(true);
  };

  const toTreeData = (nodes: API.DeptTreeNode[]): any[] =>
    nodes.map((n) => ({
      title: n.name,
      key: n.id,
      children: n.children ? toTreeData(n.children) : undefined,
    }));

  const columns: ProColumns<API.DeptItem>[] = [
    { title: '部门名称', dataIndex: 'name' },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '用户数',
      dataIndex: 'id',
      render: (_, r) => userCountMap.get(r.id) || 0,
      width: 80,
    },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="medium">
          {access?.can('system:dept:create') && (
            <a onClick={() => openCreate(r.id)}>新增子级</a>
          )}
          {access?.can('system:dept:edit') && (
            <a onClick={() => openEdit(r)}>编辑</a>
          )}
          {access?.can('system:dept:delete') && (
            <Popconfirm
              title="确认删除?"
              onConfirm={async () => {
                await deleteDept(r.id);
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
        <div style={{ width: 260, flexShrink: 0 }}>
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
          <ProTable<API.DeptItem>
            actionRef={actionRef}
            rowKey="id"
            search={false}
            dataSource={childList}
            columns={columns}
            toolBarRender={() =>
              access?.can('system:dept:create')
                ? [
                    <Button
                      key="new"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openCreate(selectedId)}
                    >
                      新建部门
                    </Button>,
                  ]
                : []
            }
          />
        </div>
      </div>
      <DeptForm
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
