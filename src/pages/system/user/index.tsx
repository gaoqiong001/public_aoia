import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, useAccess, useModel } from '@umijs/max';
import { Button, message, Popconfirm, Space, Tag, Tree } from 'antd';
import { useEffect, useRef, useState } from 'react';
import RoleAssignDrawer from '../components/RoleAssignDrawer';
import UserForm from '../components/UserForm';
import { deleteUser, getDeptTree, getRoleList, getUserList } from '../service';

export default function UserPage() {
  const access = useAccess();
  const { initialState, setInitialState } = useModel('@@initialState');
  const refreshUser = async () => {
    const info = await initialState?.fetchUserInfo?.();
    setInitialState((s) => ({ ...s, currentUser: info }));
  };
  const actionRef = useRef<ActionType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.SystemUser>();
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<API.SystemUser>();
  const [deptTree, setDeptTree] = useState<API.DeptTreeNode[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>();
  const [roles, setRoles] = useState<API.RoleItem[]>([]);
  useEffect(() => {
    getDeptTree().then(setDeptTree);
    getRoleList().then(setRoles);
  }, []);
  const roleMap = new Map(roles.map((r) => [r.id, r.name]));
  const deptMap = new Map<string, string>();
  const buildDeptMap = (nodes: API.DeptTreeNode[]) => {
    nodes.forEach((n) => {
      deptMap.set(n.id, n.name);
      if (n.children) buildDeptMap(n.children);
    });
  };
  buildDeptMap(deptTree);

  const toDeptTreeData = (nodes?: API.DeptTreeNode[]): any[] =>
    (nodes ?? []).map((n) => ({
      title: n.name,
      key: n.id,
      children: toDeptTreeData(n.children),
    }));

  const columns: ProColumns<API.SystemUser>[] = [
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'name' },
    { title: '邮箱', dataIndex: 'email' },
    {
      title: '部门',
      dataIndex: 'deptId',
      render: (_, r) => deptMap.get(r.deptId) || r.deptId || '-',
    },
    {
      title: '角色',
      dataIndex: 'roleIds',
      render: (_, r) =>
        r.roleIds.map((id) => {
          const name = roleMap.get(id) ?? id;
          return (
            <Tag
              key={id}
              color="blue"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                // find role and open permission view (navigate to role page)
                history.push('/system/role');
              }}
            >
              {name}
            </Tag>
          );
        }),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, r) => (r.status === 'active' ? '启用' : '禁用'),
    },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="medium">
          <a
            key="role"
            onClick={() => {
              setRoleUser(r);
              setRoleOpen(true);
            }}
          >
            分配角色
          </a>
          {access?.can('system:user:edit') && (
            <a
              key="edit"
              onClick={() => {
                setCurrent(r);
                setFormOpen(true);
              }}
            >
              编辑
            </a>
          )}
          {access?.can('system:user:delete') && (
            <Popconfirm
              key="del"
              title="确认删除?"
              onConfirm={async () => {
                await deleteUser(r.id);
                message.success('已删除');
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
        <div style={{ width: 240, flexShrink: 0 }}>
          <Tree
            treeData={[
              { title: '全部部门', key: '' },
              ...toDeptTreeData(deptTree),
            ]}
            defaultExpandAll
            onSelect={(keys) => setDeptFilter((keys[0] as string) || undefined)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <ProTable<API.SystemUser>
            actionRef={actionRef}
            rowKey="id"
            search={false}
            params={{ deptId: deptFilter }}
            request={async (p) => {
              let data = await getUserList();
              if (p.deptId) data = data.filter((u) => u.deptId === p.deptId);
              return { data, success: true };
            }}
            columns={columns}
            toolBarRender={() =>
              access?.can('system:user:create')
                ? [
                    <Button
                      key="new"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setCurrent(undefined);
                        setFormOpen(true);
                      }}
                    >
                      新建用户
                    </Button>,
                  ]
                : []
            }
          />
        </div>
      </div>
      <UserForm
        open={formOpen}
        onOpenChange={setFormOpen}
        record={current}
        onSuccess={() => {
          setFormOpen(false);
          actionRef.current?.reload();
          refreshUser();
        }}
      />
      <RoleAssignDrawer
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        user={roleUser}
        onSuccess={() => {
          actionRef.current?.reload();
          refreshUser();
        }}
      />
    </PageContainer>
  );
}
