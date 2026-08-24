import { request } from '@umijs/max';

interface Res<T> {
  data: T;
  success: boolean;
}

export async function getLeaveFlow() {
  return (await request<Res<API.LeaveFlowRef>>('/api/oa/leave/flow')).data;
}

export async function createLeaveApplication(data: {
  applicant: string;
  formData: Record<string, any>;
}) {
  return (
    await request<Res<API.LeaveApplication>>('/api/oa/leave/application', {
      method: 'POST',
      data,
    })
  ).data;
}

export async function resubmitApplication(
  pid: string,
  formData: Record<string, any>,
) {
  return (
    await request<Res<API.LeaveApplication>>(
      `/api/oa/leave/application/${pid}/resubmit`,
      {
        method: 'POST',
        data: { formData },
      },
    )
  ).data;
}

export async function withdrawApplication(pid: string) {
  await request<Res<null>>(`/api/oa/leave/application/${pid}/withdraw`, {
    method: 'POST',
  });
}

export interface MyApplicationRow extends API.LeaveApplication {
  flowName: string;
  currentNodeId: string;
  versionId: string;
  nextHandler: string;
  nextNodeTitle: string;
}

export async function listMyApplications(applicant: string) {
  return (
    await request<Res<MyApplicationRow[]>>('/api/oa/leave/my-applications', {
      params: { applicant },
    })
  ).data;
}

export interface PendingTaskRow {
  processInstanceId: string;
  flowName: string;
  currentNodeId: string;
  nodeTitle: string;
  applicant: string;
  leaveType: string;
  days: number;
  startDate: string;
  endDate: string;
  reason: string;
  submittedAt: string;
  assignedTo: string;
  assignedRole: string;
}

export async function listMyPendingTasks(currentUser: string) {
  return (
    await request<Res<PendingTaskRow[]>>('/api/oa/leave/my-tasks', {
      params: { currentUser },
    })
  ).data;
}

export interface DoneRow {
  processInstanceId: string;
  applicant: string;
  leaveType: string;
  days: number;
  nodeTitle: string;
  action: 'approve' | 'reject';
  comment: string;
  time: string;
}

export async function listMyDone(currentUser: string) {
  return (
    await request<Res<DoneRow[]>>('/api/oa/leave/my-done', {
      params: { currentUser },
    })
  ).data;
}

export async function approveTask(
  pid: string,
  data: { action: 'approve' | 'reject'; comment: string; approver: string },
) {
  await request<Res<null>>(`/api/oa/leave/task/${pid}/approve`, {
    method: 'POST',
    data,
  });
}

export interface PendingTaskInfo {
  nodeId: string;
  nodeTitle: string;
  assignedTo: string;
  assignedRole: string;
}

export interface InstanceDetail {
  application: API.LeaveApplication;
  instance: API.LeaveInstance;
  history: API.LeaveHistory[];
  pendingTask: PendingTaskInfo | null;
}

export async function getInstanceDetail(pid: string) {
  return (await request<Res<InstanceDetail>>(`/api/oa/leave/instance/${pid}`))
    .data;
}
