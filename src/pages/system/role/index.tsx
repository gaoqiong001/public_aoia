import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import { Button, message, Popconfirm, Space } from 'antd';
import { useEffect, useRef, useState } from 'react';
import PermissionAssignDrawer from '../components/PermissionAssignDrawer';
import RoleForm from '../components/RoleForm';
import { deleteRole, getPermissionList, getRoleList } from '../service';

export default function RolePage() {
  const access = useAccess();
  const { initialState, setInitialState } = useModel('@@initialState');
  const refreshUser = async () => {
    const info = await initialState?.fetchUserInfo?.();
    setInitialState((s) => ({ ...s, currentUser: info }));
  };
  const actionRef = useRef<ActionType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [current, setCurrent] = useState<API.RoleItem>();
  const [permOpen, setPermOpen] = useState(false);
  const [permRole, setPermRole] = useState<API.RoleItem>();
  const [permList, setPermList] = useState<API.PermissionItem[]>([]);
  useEffect(() => {
    getPermissionList().then(setPermList);
  }, []);
  const permMap = new Map(permList.map((p) => [p.id, p.name]));

  const columns: ProColumns<API.RoleItem>[] = [
    { title: '角色名称', dataIndex: 'name' },
    { title: '编码', dataIndex: 'code' },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      title: '权限',
      dataIndex: 'permissionIds',
      render: (_, r) => {
        const names = r.permissionIds
          .map((id) => permMap.get(id))
          .filter(Boolean);
        if (names.length <= 3) return names.join('、');
        return `${names.slice(0, 2).join('、')} 等${names.length}项`;
      },
      ellipsis: true,
    },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      render: (_, r) => (
        <Space size="medium">
          <a
            key="perm"
            onClick={() => {
              setPermRole(r);
              setPermOpen(true);
            }}
          >
            分配权限
          </a>
          {access?.can('system:role:edit') && (
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
          {access?.can('system:role:delete') && (
            <Popconfirm
              key="del"
              title="确认删除?"
              onConfirm={async () => {
                await deleteRole(r.id);
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
      <ProTable<API.RoleItem>
        actionRef={actionRef}
        rowKey="id"
        search={false}
        request={async () => {
          const data = await getRoleList();
          return { data, success: true };
        }}
        columns={columns}
        toolBarRender={() =>
          access?.can('system:role:create')
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
                  新建角色
                </Button>,
              ]
            : []
        }
      />
      <RoleForm
        open={formOpen}
        onOpenChange={setFormOpen}
        record={current}
        onSuccess={() => {
          setFormOpen(false);
          actionRef.current?.reload();
          refreshUser();
        }}
      />
      <PermissionAssignDrawer
        open={permOpen}
        onClose={() => setPermOpen(false)}
        role={permRole}
        onSuccess={() => {
          actionRef.current?.reload();
          refreshUser();
        }}
      />
    </PageContainer>
  );
}
