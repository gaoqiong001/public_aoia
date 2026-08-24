import { getFlowByCode, getVersionGraphById } from '../../../flow/_mock';
import {
  type ApprovalRecord,
  approve,
  type ProcessInstance,
  reject,
  resubmit,
  startInstance,
  withdraw,
} from './engine';
import { historyStore, instanceStore, leaveStore } from './store';

const now = () => new Date().toISOString();
const sid = () => Math.random().toString(36).slice(2, 10);

const statusMap: Record<string, API.LeaveStatus> = {
  approving: 'approving',
  returned: 'returned',
  approved: 'approved',
  withdrawn: 'withdrawn',
};

// 角色到处理人的映射（mock 简化）
const roleHandlerMap: Record<string, string> = {
  direct_supervisor: '李四',
  dept_manager: '王五',
  hr: '赵六',
};

function joinApp(inst: ProcessInstance): API.LeaveApplication | undefined {
  for (const app of leaveStore.values()) {
    if (app.processInstanceId === inst.id) return app;
  }
  return undefined;
}

function engineStore() {
  return {
    instances: instanceStore as unknown as Map<string, ProcessInstance>,
    history: [] as ApprovalRecord[],
    getGraph: (versionId: string) => getVersionGraphById(versionId) as any,
  };
}

function flushHistory(store: ReturnType<typeof engineStore>, pid: string) {
  const pending = (store.history as ApprovalRecord[]).splice(0);
  if (pending.length === 0) return;
  const list = historyStore.get(pid) ?? [];
  list.push(...pending);
  historyStore.set(pid, list);
}

// 当流程推进到下一步时，添加 pending 记录
function addPendingRecord(pid: string, graph: any, currentNodeId: string) {
  if (!graph?.nodes) return;
  const node = graph.nodes.find((n: any) => n.id === currentNodeId);
  if (!node || node.type !== 'approval') return;

  const role = node.data?.approvalRole;
  const handler = role ? roleHandlerMap[role] : undefined;
  if (!handler) return;

  const list = historyStore.get(pid) ?? [];
  // 先清除旧的 pending 记录（同一节点的）
  const filtered = list.filter(
    (h) => !(h.action === 'pending' && h.nodeId === currentNodeId),
  );
  filtered.push({
    id: sid(),
    processInstanceId: pid,
    nodeId: currentNodeId,
    nodeTitle: node.data?.title || '',
    action: 'pending',
    approver: handler,
    comment: `待${node.data?.title || '审批'}`,
    time: now(),
    assignedRole: role,
  });
  historyStore.set(pid, filtered);
}

// 清除 pending 记录（流程结束或退回时）
function clearPendingRecord(pid: string) {
  const list = historyStore.get(pid) ?? [];
  const filtered = list.filter((h) => h.action !== 'pending');
  historyStore.set(pid, filtered);
}

export default {
  'GET /api/oa/leave/flow': (_req: any, res: any) => {
    const ref = getFlowByCode('leave_approval');
    if (!ref || !ref.versionId)
      return res.json({ success: false, errorMessage: 'leave flow not found' });
    res.json({ data: ref, success: true });
  },
  'POST /api/oa/leave/application': (req: any, res: any) => {
    const { applicant, formData } = req.body;
    const ref = getFlowByCode('leave_approval');
    if (!ref || !ref.versionId)
      return res.json({ success: false, errorMessage: 'leave flow not found' });
    const appId = sid();
    const pid = sid();
    const app: API.LeaveApplication = {
      id: appId,
      applicant,
      ...formData,
      processInstanceId: pid,
      processStatus: 'approving',
      createdAt: now(),
    };
    leaveStore.set(appId, app);
    const store = engineStore();
    startInstance(store, {
      id: pid,
      flowId: ref.flowId,
      flowName: ref.flowName,
      versionId: ref.versionId,
      applicant,
      payload: formData,
    });
    flushHistory(store, pid);

    // 添加下一步处理人的 pending 记录
    const inst = instanceStore.get(pid);
    if (inst) {
      const graph = getVersionGraphById(inst.versionId) as any;
      addPendingRecord(pid, graph, inst.currentNodeId);
    }

    res.json({ data: app, success: true });
  },
  'POST /api/oa/leave/application/:pid/resubmit': (req: any, res: any) => {
    const pid = req.params.pid;
    const app = [...leaveStore.values()].find(
      (a) => a.processInstanceId === pid,
    );
    if (!app)
      return res.json({
        success: false,
        errorMessage: 'application not found',
      });
    Object.assign(app, req.body.formData, { processStatus: 'approving' });
    const store = engineStore();
    resubmit(store, pid, {
      applicant: app.applicant,
      payload: req.body.formData,
    });
    flushHistory(store, pid);

    // 添加下一步处理人的 pending 记录
    const inst = instanceStore.get(pid);
    if (inst) {
      const graph = getVersionGraphById(inst.versionId) as any;
      addPendingRecord(pid, graph, inst.currentNodeId);
    }

    res.json({ data: app, success: true });
  },
  'POST /api/oa/leave/application/:pid/withdraw': (req: any, res: any) => {
    const pid = req.params.pid;
    const app = [...leaveStore.values()].find(
      (a) => a.processInstanceId === pid,
    );
    if (!app)
      return res.json({
        success: false,
        errorMessage: 'application not found',
      });
    const store = engineStore();
    withdraw(store, pid, { approver: app.applicant });
    flushHistory(store, pid);
    app.processStatus = 'withdrawn';

    // 撤回时清除 pending 记录
    clearPendingRecord(pid);

    res.json({ success: true });
  },
  'GET /api/oa/leave/my-applications': (req: any, res: any) => {
    const list = [...leaveStore.values()]
      .filter((a) => a.applicant === req.query.applicant)
      .map((a) => {
        const inst = instanceStore.get(a.processInstanceId);
        // 查找当前的 pending 记录
        const history = historyStore.get(a.processInstanceId) ?? [];
        const pendingRecord = history.find((h) => h.action === 'pending');
        return {
          ...a,
          flowName: inst?.flowName ?? '',
          currentNodeId: inst?.currentNodeId ?? '',
          versionId: inst?.versionId ?? '',
          // 下一步处理人信息
          nextHandler: pendingRecord?.approver ?? '',
          nextNodeTitle: pendingRecord?.nodeTitle ?? '',
        };
      })
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    res.json({ data: list, success: true });
  },
  'GET /api/oa/leave/my-tasks': (req: any, res: any) => {
    // 按当前用户过滤待办任务
    const currentUser = req.query.currentUser || '李四';
    const list: any[] = [];

    for (const [pid, history] of historyStore) {
      // 找到当前的 pending 记录
      const pendingRecord = history.find(
        (h) => h.action === 'pending' && h.approver === currentUser,
      );
      if (!pendingRecord) continue;

      // 检查是否已经被处理（有后续的 approve/reject）
      const hasProcessed = history.some(
        (h) =>
          h.nodeId === pendingRecord.nodeId &&
          (h.action === 'approve' || h.action === 'reject') &&
          h.time > pendingRecord.time,
      );
      if (hasProcessed) continue;

      const inst = instanceStore.get(pid);
      const app = inst ? joinApp(inst) : undefined;
      list.push({
        processInstanceId: pid,
        flowName: inst?.flowName ?? '',
        currentNodeId: pendingRecord.nodeId,
        nodeTitle: pendingRecord.nodeTitle,
        applicant: app?.applicant ?? '',
        leaveType: app?.leaveType ?? '',
        days: app?.days ?? 0,
        startDate: app?.startDate ?? '',
        endDate: app?.endDate ?? '',
        reason: app?.reason ?? '',
        submittedAt: app?.createdAt ?? '',
        assignedTo: pendingRecord.approver,
        assignedRole: pendingRecord.assignedRole ?? '',
      });
    }

    list.sort((x, y) => y.submittedAt.localeCompare(x.submittedAt));
    res.json({ data: list, success: true });
  },
  'GET /api/oa/leave/my-done': (req: any, res: any) => {
    const currentUser = req.query.currentUser;
    const list: any[] = [];
    for (const [pid, history] of historyStore) {
      for (const h of history) {
        if (h.action !== 'approve' && h.action !== 'reject') continue;
        // I1: 按当前用户过滤已办记录
        if (currentUser && h.approver !== currentUser) continue;
        const app = [...leaveStore.values()].find(
          (a) => a.processInstanceId === pid,
        );
        list.push({
          processInstanceId: pid,
          applicant: app?.applicant ?? '',
          leaveType: app?.leaveType ?? '',
          days: app?.days ?? 0,
          nodeTitle: h.nodeTitle,
          action: h.action,
          comment: h.comment,
          time: h.time,
        });
      }
    }
    list.sort((x, y) => y.time.localeCompare(x.time));
    res.json({ data: list, success: true });
  },
  'POST /api/oa/leave/task/:pid/approve': (req: any, res: any) => {
    const pid = req.params.pid;
    const { action, comment, approver } = req.body;
    const app = [...leaveStore.values()].find(
      (a) => a.processInstanceId === pid,
    );
    if (!app)
      return res.json({
        success: false,
        errorMessage: 'application not found',
      });

    // C1: 防止自己审批自己
    if (approver === app.applicant) {
      return res.json({
        success: false,
        errorMessage: '不能审批自己提交的申请',
      });
    }

    // C2: 授权校验 - 验证审批人是否是当前节点的待办处理人
    const inst = instanceStore.get(pid);
    if (!inst)
      return res.json({
        success: false,
        errorMessage: 'instance not found',
      });
    const pendingRecord = (historyStore.get(pid) ?? []).find(
      (h) => h.action === 'pending' && h.nodeId === inst.currentNodeId,
    );
    if (!pendingRecord || pendingRecord.approver !== approver) {
      return res.json({
        success: false,
        errorMessage: '无权审批此任务',
      });
    }

    const store = engineStore();
    if (action === 'approve') {
      approve(store, pid, {
        approver,
        comment,
        payload: app as unknown as Record<string, any>,
      });
      app.processStatus =
        statusMap[instanceStore.get(pid)?.status ?? 'approving'];

      // 审批通过后，添加下一步的 pending 记录
      const inst = instanceStore.get(pid);
      if (inst && inst.status === 'approving') {
        const graph = getVersionGraphById(inst.versionId) as any;
        // 清除当前节点的 pending 记录
        clearPendingRecord(pid);
        // 添加新节点的 pending 记录
        addPendingRecord(pid, graph, inst.currentNodeId);
      } else {
        // 流程结束，清除所有 pending
        clearPendingRecord(pid);
      }
    } else {
      reject(store, pid, { approver, comment });
      app.processStatus = 'returned';

      // 驳回时清除 pending 记录
      clearPendingRecord(pid);
    }
    flushHistory(store, pid);
    res.json({ success: true });
  },
  'GET /api/oa/leave/instance/:pid': (req: any, res: any) => {
    const pid = req.params.pid;
    const inst = instanceStore.get(pid);
    const app = [...leaveStore.values()].find(
      (a) => a.processInstanceId === pid,
    );
    const history = historyStore.get(pid) ?? [];
    const pendingRecord = history.find((h) => h.action === 'pending');
    if (!inst || !app)
      return res.json({ success: false, errorMessage: 'instance not found' });
    res.json({
      data: {
        application: app,
        instance: inst,
        history,
        pendingTask: pendingRecord
          ? {
              nodeId: pendingRecord.nodeId,
              nodeTitle: pendingRecord.nodeTitle,
              assignedTo: pendingRecord.approver,
              assignedRole: pendingRecord.assignedRole,
            }
          : null,
      },
      success: true,
    });
  },
};
