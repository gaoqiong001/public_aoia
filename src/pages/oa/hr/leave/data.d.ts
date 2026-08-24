declare namespace API {
  type LeaveStatus = 'approving' | 'returned' | 'approved' | 'withdrawn';

  interface LeaveApplication {
    id: string;
    applicant: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    diagnosisNote?: string;
    processInstanceId: string;
    processStatus: LeaveStatus;
    createdAt: string;
  }

  interface LeaveInstance {
    id: string;
    flowId: string;
    flowName: string;
    versionId: string;
    status: LeaveStatus;
    currentNodeId: string;
    createdAt: string;
  }

  interface LeaveHistory {
    id: string;
    processInstanceId: string;
    nodeId: string;
    nodeTitle: string;
    action:
      | 'submit'
      | 'approve'
      | 'reject'
      | 'resubmit'
      | 'withdraw'
      | 'pending';
    approver: string;
    comment: string;
    time: string;
    // pending 记录专用：处理角色
    assignedRole?: string;
  }

  interface LeaveFlowRef {
    flowId: string;
    flowName: string;
    versionId: string;
  }
}
