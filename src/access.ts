/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState: { currentUser?: API.CurrentUser } | undefined,
) {
  // permissions 由 mock /api/currentUser 返回(见 mock/user.ts);
  // permissions 由 mock /api/currentUser 返回(见 mock/user.ts → rbac-store.ts)。
  // API.CurrentUser 是 type 别名(非 interface),无法通过 declare namespace 合并,
  // 故用 as any 读取。真实后端集成时应在 OpenAPI schema 中定义 permissions 字段。
  const perms: Set<string> = new Set(
    (initialState?.currentUser as any)?.permissions ?? [],
  );
  const state: Record<string, any> = {};
  perms.forEach((p) => {
    state[p] = true;
  });
  // 兼容现有 /admin(canAdmin)
  state.canAdmin = perms.has('admin') || perms.has('system:manage');
  // 按钮级权限 helper
  state.can = (code: string) => perms.has(code);
  return state;
}
