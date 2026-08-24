import { isVersionReferenced } from '../oa/hr/leave/store';

interface FlowRecord {
  id: string;
  name: string;
  description: string;
  code: string;
  status: API.FlowStatus;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}
interface VersionRecord {
  id: string;
  flowId: string;
  version: number;
  status: API.VersionStatus;
  remark: string;
  graphJson: Record<string, any>;
  createdAt: string;
}

// module-level in-memory store (persists across requests within one dev process)
const flows = new Map<string, FlowRecord>();
const versions = new Map<string, VersionRecord>();

const now = () => new Date().toISOString();
const sid = () => Math.random().toString(36).slice(2, 10);

// seed: one sample flow with one active version (reuse demo initial-data)
const f1 = 'flow-seed-1';
const v1 = 'ver-seed-1';
flows.set(f1, {
  id: f1,
  name: '示例流程',
  description: '由 Flowgram demo 初始数据生成的示例流程',
  code: '',
  status: 'published',
  activeVersionId: v1,
  createdAt: now(),
  updatedAt: now(),
});
versions.set(v1, {
  id: v1,
  flowId: f1,
  version: 1,
  status: 'active',
  remark: '初始版本',
  graphJson: { nodes: [] },
  createdAt: now(),
});

// seed: leave approval flow (business workflow demo)
const fLeave = 'leave-approval-flow';
const vLeave = 'ver-leave-1';
flows.set(fLeave, {
  id: fLeave,
  name: '请假审批',
  description: '传统业务工作流示例：提交申请 → 主管审批 → 条件分支 → 人事归档',
  code: 'leave_approval',
  status: 'published',
  activeVersionId: vLeave,
  createdAt: now(),
  updatedAt: now(),
});
versions.set(vLeave, {
  id: vLeave,
  flowId: fLeave,
  version: 1,
  status: 'active',
  remark: '初始版本',
  graphJson: {
    nodes: [
      {
        id: 'leave_start',
        type: 'start',
        meta: { position: { x: 80, y: 200 } },
        data: {
          title: '请假申请',
          outputs: {
            type: 'object',
            properties: {
              applicant: { type: 'string' },
              leaveType: { type: 'string' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              days: { type: 'number' },
              reason: { type: 'string' },
            },
          },
        },
      },
      {
        id: 'approve_supervisor',
        type: 'approval',
        meta: { position: { x: 420, y: 160 } },
        data: {
          title: '直属主管审批',
          approvalRole: 'direct_supervisor',
          remark: '',
        },
      },
      {
        id: 'cond_days',
        type: 'condition',
        meta: { position: { x: 760, y: 200 } },
        data: {
          title: '天数判断',
          conditions: [
            {
              key: 'if_short',
              value: {
                left: { type: 'ref', content: ['payload', 'days'] },
                operator: '<=',
                right: { type: 'constant', content: 3 },
              },
            },
          ],
        },
      },
      {
        id: 'approve_dept',
        type: 'approval',
        meta: { position: { x: 1100, y: 60 } },
        data: {
          title: '部门负责人审批',
          approvalRole: 'dept_manager',
          remark: '',
        },
      },
      {
        id: 'approve_hr',
        type: 'approval',
        meta: { position: { x: 1100, y: 300 } },
        data: { title: '人事归档', approvalRole: 'hr', remark: '' },
      },
      {
        id: 'leave_end',
        type: 'end',
        meta: { position: { x: 1460, y: 200 } },
        data: { title: '结束' },
      },
    ],
    edges: [
      { sourceNodeID: 'leave_start', targetNodeID: 'approve_supervisor' },
      {
        sourceNodeID: 'approve_supervisor',
        targetNodeID: 'cond_days',
        sourcePortID: 'pass',
      },
      {
        sourceNodeID: 'cond_days',
        targetNodeID: 'approve_hr',
        sourcePortID: 'if_short',
      },
      {
        sourceNodeID: 'cond_days',
        targetNodeID: 'approve_dept',
        sourcePortID: 'else',
      },
      {
        sourceNodeID: 'approve_dept',
        targetNodeID: 'approve_hr',
        sourcePortID: 'pass',
      },
      {
        sourceNodeID: 'approve_hr',
        targetNodeID: 'leave_end',
        sourcePortID: 'pass',
      },
    ],
  },
  createdAt: now(),
});

function nextVersion(flowId: string): number {
  let max = 0;
  for (const v of versions.values()) {
    if (v.flowId === flowId && v.version > max) max = v.version;
  }
  return max + 1;
}

// 供 oa mock 端点取图（引擎通过 getGraph(versionId) 消费）
export function getVersionGraphById(
  vid: string,
): Record<string, any> | undefined {
  return versions.get(vid)?.graphJson;
}

// 业务编码 → 流程引用（当前 active 版本）；spec [S4]：业务页面按 code 绑定流程
export function getFlowByCode(
  code: string,
): { flowId: string; flowName: string; versionId: string | null } | undefined {
  for (const f of flows.values()) {
    if (f.code === code) {
      return { flowId: f.id, flowName: f.name, versionId: f.activeVersionId };
    }
  }
  return undefined;
}

export default {
  // ---- flow CRUD ----
  'GET /api/flow': (_req: any, res: any) => {
    const list = Array.from(flows.values()).map((f) => ({
      ...f,
      versionCount: Array.from(versions.values()).filter(
        (v) => v.flowId === f.id,
      ).length,
    }));
    res.json({ data: list, success: true });
  },
  'GET /api/flow/:id': (req: any, res: any) => {
    const f = flows.get(req.params.id);
    if (!f) return res.json({ success: false, errorMessage: 'flow not found' });
    res.json({ data: { ...f }, success: true });
  },
  'POST /api/flow': (req: any, res: any) => {
    const { body } = req;
    // 业务编码唯一性校验（spec [S4]）
    if (body.code) {
      for (const f of flows.values()) {
        if (f.code === body.code) {
          return res.json({ success: false, errorMessage: '业务编码已存在' });
        }
      }
    }
    const id = sid();
    const rec: FlowRecord = {
      id,
      name: body.name,
      description: body.description || '',
      code: body.code || '',
      status: body.status || 'draft',
      activeVersionId: null,
      createdAt: now(),
      updatedAt: now(),
    };
    flows.set(id, rec);
    res.json({ data: rec, success: true });
  },
  'PUT /api/flow/:id': (req: any, res: any) => {
    const f = flows.get(req.params.id);
    if (!f) return res.json({ success: false, errorMessage: 'flow not found' });
    Object.assign(f, req.body, { updatedAt: now() });
    res.json({ data: f, success: true });
  },
  'DELETE /api/flow/:id': (req: any, res: any) => {
    const id = req.params.id;
    flows.delete(id);
    for (const [vid, v] of versions) {
      if (v.flowId === id) versions.delete(vid);
    }
    res.json({ success: true });
  },
  // ---- version ----
  'GET /api/flow/:id/version': (req: any, res: any) => {
    const list = Array.from(versions.values())
      .filter((v) => v.flowId === req.params.id)
      .map((v) => ({
        id: v.id,
        flowId: v.flowId,
        version: v.version,
        status: v.status,
        remark: v.remark,
        createdAt: v.createdAt,
      }))
      .sort((a, b) => b.version - a.version);
    res.json({ data: list, success: true });
  },
  'GET /api/flow/:id/version/:vid': (req: any, res: any) => {
    const v = versions.get(req.params.vid);
    if (!v)
      return res.json({ success: false, errorMessage: 'version not found' });
    res.json({ data: { ...v }, success: true });
  },
  'POST /api/flow/:id/version': (req: any, res: any) => {
    const fid = req.params.id;
    const f = flows.get(fid);
    if (!f) return res.json({ success: false, errorMessage: 'flow not found' });
    const ver = nextVersion(fid);
    const id = sid();
    const rec: VersionRecord = {
      id,
      flowId: fid,
      version: ver,
      status: 'inactive',
      remark: req.body?.remark || `v${ver}`,
      graphJson: req.body?.graphJson || { nodes: [] },
      createdAt: now(),
    };
    versions.set(id, rec);
    f.updatedAt = now();
    res.json({
      data: {
        id,
        flowId: fid,
        version: ver,
        status: 'inactive',
        remark: rec.remark,
        createdAt: rec.createdAt,
      },
      success: true,
    });
  },
  'PUT /api/flow/:id/version/:vid': (req: any, res: any) => {
    const v = versions.get(req.params.vid);
    if (!v)
      return res.json({ success: false, errorMessage: 'version not found' });
    if (req.body?.graphJson) v.graphJson = req.body.graphJson;
    if (req.body?.remark !== undefined) v.remark = req.body.remark;
    const f = flows.get(req.params.id);
    if (f) f.updatedAt = now();
    res.json({ data: { ...v }, success: true });
  },
  'DELETE /api/flow/:id/version/:vid': (req: any, res: any) => {
    // 版本引用保护：被运行中的流程实例引用的版本拒绝删除
    if (isVersionReferenced(req.params.vid)) {
      return res.json({
        success: false,
        errorMessage: '该版本已被运行中的流程实例引用，无法删除',
      });
    }
    const v = versions.get(req.params.vid);
    if (!v)
      return res.json({ success: false, errorMessage: 'version not found' });
    versions.delete(req.params.vid);
    const f = flows.get(req.params.id);
    if (f && f.activeVersionId === req.params.vid) f.activeVersionId = null;
    res.json({ success: true });
  },
  'POST /api/flow/:id/version/:vid/activate': (req: any, res: any) => {
    const fid = req.params.id;
    const f = flows.get(fid);
    if (!f) return res.json({ success: false, errorMessage: 'flow not found' });
    for (const v of versions.values()) {
      if (v.flowId === fid)
        v.status = v.id === req.params.vid ? 'active' : 'inactive';
    }
    f.activeVersionId = req.params.vid;
    f.updatedAt = now();
    res.json({ success: true });
  },
};
