// 三表分离的内存 store（模块级 Map，dev 进程内跨请求持久）
// 业务表仅存 processInstanceId + processStatus 冗余；实例表与历史表经 processInstanceId 关联。
export const leaveStore = new Map<string, API.LeaveApplication>();
export const instanceStore = new Map<string, API.LeaveInstance>();
export const historyStore = new Map<string, API.LeaveHistory[]>();

const now = () => new Date().toISOString();

// 版本引用保护：被运行中的流程实例引用的版本不可删除
export function isVersionReferenced(versionId: string): boolean {
  for (const inst of instanceStore.values()) {
    if (inst.versionId === versionId) return true;
  }
  return false;
}

// ---- seed: 覆盖四种状态的示例实例 ----
function seedInstance(seed: {
  id: string;
  applicant: string;
  formData: Omit<
    API.LeaveApplication,
    'id' | 'applicant' | 'processInstanceId' | 'processStatus' | 'createdAt'
  >;
  instance: {
    flowId: string;
    flowName: string;
    versionId: string;
    status: API.LeaveStatus;
    currentNodeId: string;
  };
  history: Array<Omit<API.LeaveHistory, 'id' | 'processInstanceId' | 'time'>>;
}) {
  const pid = `inst-${seed.id}`;
  const app: API.LeaveApplication = {
    id: `app-${seed.id}`,
    applicant: seed.applicant,
    ...seed.formData,
    processInstanceId: pid,
    processStatus: seed.instance.status,
    createdAt: now(),
  };
  const inst: API.LeaveInstance = {
    id: pid,
    ...seed.instance,
    createdAt: now(),
  };
  leaveStore.set(app.id, app);
  instanceStore.set(pid, inst);
  historyStore.set(
    pid,
    seed.history.map((h, i) => ({
      ...h,
      id: `hist-${seed.id}-${h.action}-${i}`,
      processInstanceId: pid,
      time: now(),
    })),
  );
}

seedInstance({
  id: 'approving-1',
  applicant: '管理员',
  formData: {
    leaveType: '年假',
    startDate: '2026-08-24',
    endDate: '2026-08-25',
    days: 2,
    reason: '家庭出游',
  },
  instance: {
    flowId: 'leave-approval-flow',
    flowName: '请假审批',
    versionId: 'ver-leave-1',
    status: 'approving',
    currentNodeId: 'approve_supervisor',
  },
  history: [
    {
      nodeId: 'leave_start',
      nodeTitle: '请假申请',
      action: 'submit',
      approver: '管理员',
      comment: '提交申请',
    },
    {
      nodeId: 'approve_supervisor',
      nodeTitle: '直属主管审批',
      action: 'pending',
      approver: '李四',
      comment: '待直属主管审批',
    },
  ],
});
seedInstance({
  id: 'returned-1',
  applicant: '管理员',
  formData: {
    leaveType: '事假',
    startDate: '2026-08-27',
    endDate: '2026-08-29',
    days: 3,
    reason: '家事',
  },
  instance: {
    flowId: 'leave-approval-flow',
    flowName: '请假审批',
    versionId: 'ver-leave-1',
    status: 'returned',
    currentNodeId: 'leave_start',
  },
  history: [
    {
      nodeId: 'leave_start',
      nodeTitle: '请假申请',
      action: 'submit',
      approver: '管理员',
      comment: '提交申请',
    },
    {
      nodeId: 'approve_supervisor',
      nodeTitle: '直属主管审批',
      action: 'reject',
      approver: '李四',
      comment: '事由不明确，请补充',
    },
  ],
});
seedInstance({
  id: 'approved-1',
  applicant: '管理员',
  formData: {
    leaveType: '病假',
    startDate: '2026-08-18',
    endDate: '2026-08-19',
    days: 2,
    reason: '感冒就医',
    diagnosisNote: '附诊断书',
  },
  instance: {
    flowId: 'leave-approval-flow',
    flowName: '请假审批',
    versionId: 'ver-leave-1',
    status: 'approved',
    currentNodeId: 'leave_end',
  },
  history: [
    {
      nodeId: 'leave_start',
      nodeTitle: '请假申请',
      action: 'submit',
      approver: '管理员',
      comment: '提交申请',
    },
    {
      nodeId: 'approve_supervisor',
      nodeTitle: '直属主管审批',
      action: 'approve',
      approver: '李四',
      comment: '同意',
    },
    {
      nodeId: 'approve_hr',
      nodeTitle: '人事归档',
      action: 'approve',
      approver: '赵六',
      comment: '归档',
    },
  ],
});
seedInstance({
  id: 'withdrawn-1',
  applicant: '管理员',
  formData: {
    leaveType: '调休',
    startDate: '2026-08-21',
    endDate: '2026-08-21',
    days: 1,
    reason: '临时取消',
  },
  instance: {
    flowId: 'leave-approval-flow',
    flowName: '请假审批',
    versionId: 'ver-leave-1',
    status: 'withdrawn',
    currentNodeId: 'approve_supervisor',
  },
  history: [
    {
      nodeId: 'leave_start',
      nodeTitle: '请假申请',
      action: 'submit',
      approver: '管理员',
      comment: '提交申请',
    },
    {
      nodeId: 'approve_supervisor',
      nodeTitle: '直属主管审批',
      action: 'withdraw',
      approver: '管理员',
      comment: '撤回申请',
    },
  ],
});
