import { request } from '@umijs/max';

// Mock responses are wrapped as `{ data, success }`; request returns the body,
// so we unwrap `.data` here (errorThrower handles !success).
interface Res<T> {
  data: T;
  success: boolean;
}

export async function getFlowList() {
  return (await request<Res<API.FlowItem[]>>('/api/flow')).data;
}

export async function getFlowDetail(id: string) {
  return (await request<Res<API.FlowItem>>(`/api/flow/${id}`)).data;
}

export async function createFlow(data: Partial<API.FlowItem>) {
  return (
    await request<Res<API.FlowItem>>('/api/flow', {
      method: 'POST',
      data,
    })
  ).data;
}

export async function updateFlow(id: string, data: Partial<API.FlowItem>) {
  return (
    await request<Res<API.FlowItem>>(`/api/flow/${id}`, {
      method: 'PUT',
      data,
    })
  ).data;
}

export async function deleteFlow(id: string) {
  await request<Res<null>>(`/api/flow/${id}`, { method: 'DELETE' });
}

export async function getVersionList(flowId: string) {
  return (
    await request<Res<API.FlowVersionItem[]>>(`/api/flow/${flowId}/version`)
  ).data;
}

export async function getVersionGraph(flowId: string, vid: string) {
  return (
    await request<Res<API.FlowVersionGraph>>(
      `/api/flow/${flowId}/version/${vid}`,
    )
  ).data;
}

export async function createVersion(
  flowId: string,
  data: { graphJson: any; remark?: string },
) {
  return (
    await request<Res<API.FlowVersionItem>>(`/api/flow/${flowId}/version`, {
      method: 'POST',
      data,
    })
  ).data;
}

export async function updateVersion(
  flowId: string,
  vid: string,
  data: { graphJson?: any; remark?: string },
) {
  return (
    await request<Res<API.FlowVersionItem>>(
      `/api/flow/${flowId}/version/${vid}`,
      { method: 'PUT', data },
    )
  ).data;
}

export async function deleteVersion(flowId: string, vid: string) {
  await request<Res<null>>(`/api/flow/${flowId}/version/${vid}`, {
    method: 'DELETE',
  });
}

export async function activateVersion(flowId: string, vid: string) {
  await request<Res<null>>(`/api/flow/${flowId}/version/${vid}/activate`, {
    method: 'POST',
  });
}
