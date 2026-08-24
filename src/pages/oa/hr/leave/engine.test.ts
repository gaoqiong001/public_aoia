import { describe, expect, it } from 'vitest';
import {
  approve,
  type EngineGraph,
  type EngineNode,
  type EngineStore,
  evaluateCondition,
  reject,
  resubmit,
  startInstance,
  withdraw,
} from './engine';

// 与 flow/_mock 预置图同构的夹具图（缩小版：单审批 → end）
function fixtureGraph(): EngineGraph {
  return {
    nodes: [
      { id: 'start', type: 'start', data: { title: '开始' } },
      {
        id: 'app1',
        type: 'approval',
        data: { title: '直属主管审批', approvalRole: 'direct_supervisor' },
      },
      { id: 'end', type: 'end', data: { title: '结束' } },
    ],
    edges: [
      { sourceNodeID: 'start', targetNodeID: 'app1' },
      { sourceNodeID: 'app1', targetNodeID: 'end', sourcePortID: 'pass' },
    ],
  };
}

function makeStore(graph?: EngineGraph): EngineStore {
  return {
    instances: new Map(),
    history: [],
    getGraph: (versionId) =>
      versionId === 'v1' ? (graph ?? fixtureGraph()) : undefined,
  };
}

describe('workflow engine', () => {
  it('startInstance 走到首个审批节点并暂停', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: { days: 1 },
    });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('app1');
    expect(store.history[0].action).toBe('submit');
  });

  it('approve 沿 pass 边走到 end 后置 approved', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    approve(store, 'i1', { approver: '李四', comment: '同意', payload: {} });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approved');
    expect(inst.currentNodeId).toBe('end');
    expect(store.history.at(-1)).toMatchObject({
      action: 'approve',
      approver: '李四',
    });
  });

  it('reject 退回发起人（returned + 指向 start）', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    reject(store, 'i1', { approver: '李四', comment: '材料不全' });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('returned');
    expect(inst.currentNodeId).toBe('start');
  });

  it('resubmit 后重新走到审批节点', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    reject(store, 'i1', { approver: '李四', comment: '重填' });
    resubmit(store, 'i1', { applicant: '张三', payload: { days: 2 } });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('app1');
    expect(store.history.at(-1)!.action).toBe('resubmit');
  });

  it('withdraw 在 approving/returned 生效，终态 withdrawn', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    withdraw(store, 'i1', { approver: '张三' });
    expect(store.instances.get('i1')!.status).toBe('withdrawn');
  });
});

describe('condition branches', () => {
  const branchGraph: EngineGraph = {
    nodes: [
      { id: 'start', type: 'start', data: { title: '开始' } },
      { id: 'app1', type: 'approval', data: { title: '主管审批' } },
      {
        id: 'cond',
        type: 'condition',
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
      { id: 'hr', type: 'approval', data: { title: '人事归档' } },
      { id: 'dept', type: 'approval', data: { title: '部门负责人' } },
      { id: 'end', type: 'end', data: { title: '结束' } },
    ],
    edges: [
      { sourceNodeID: 'start', targetNodeID: 'app1' },
      { sourceNodeID: 'app1', targetNodeID: 'cond', sourcePortID: 'pass' },
      { sourceNodeID: 'cond', targetNodeID: 'hr', sourcePortID: 'if_short' },
      { sourceNodeID: 'cond', targetNodeID: 'dept', sourcePortID: 'else' },
      { sourceNodeID: 'hr', targetNodeID: 'end', sourcePortID: 'pass' },
      { sourceNodeID: 'dept', targetNodeID: 'hr', sourcePortID: 'pass' },
    ],
  };

  it('days<=3 走 if_short 分支到人事归档', () => {
    const store = makeStore(branchGraph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: { days: 2 },
    });
    approve(store, 'i1', {
      approver: '李四',
      comment: '同意',
      payload: { days: 2 },
    });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('hr');
  });

  it('days>3 走 else 分支到部门负责人', () => {
    const store = makeStore(branchGraph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: { days: 5 },
    });
    approve(store, 'i1', {
      approver: '李四',
      comment: '同意',
      payload: { days: 5 },
    });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('dept');
  });

  it('多级链路走完置 approved', () => {
    const store = makeStore(branchGraph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: { days: 5 },
    });
    approve(store, 'i1', {
      approver: '李四',
      comment: '',
      payload: { days: 5 },
    });
    approve(store, 'i1', {
      approver: '王五',
      comment: '',
      payload: { days: 5 },
    });
    approve(store, 'i1', {
      approver: '赵六',
      comment: '',
      payload: { days: 5 },
    });
    expect(store.instances.get('i1')!.status).toBe('approved');
  });

  it('操作符 = != > >= < <= 均正确求值', () => {
    const cases: Array<[string, number, number, boolean]> = [
      ['=', 3, 3, true],
      ['=', 3, 4, false],
      ['!=', 3, 4, true],
      ['>', 4, 3, true],
      ['>=', 3, 3, true],
      ['<', 2, 3, true],
      ['<=', 3, 3, true],
      ['<=', 4, 3, false],
    ];
    for (const [operator, left, right, expected] of cases) {
      const node: EngineNode = {
        id: 'cond',
        type: 'condition',
        data: {
          conditions: [
            {
              key: 'if_x',
              value: {
                left: { type: 'constant', content: left },
                operator,
                right: { type: 'constant', content: right },
              },
            },
          ],
        },
      };
      expect(evaluateCondition(node, {})).toBe(expected);
    }
  });
});

describe('guards and edge cases', () => {
  it('非 approving 状态 approve 抛错', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    reject(store, 'i1', { approver: '李四', comment: '退回' });
    expect(() =>
      approve(store, 'i1', { approver: '李四', comment: '', payload: {} }),
    ).toThrow('instance not approvable');
  });

  it('非 returned 状态 resubmit 抛错', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    expect(() =>
      resubmit(store, 'i1', { applicant: '张三', payload: {} }),
    ).toThrow('instance not resubmittable');
  });

  it('终态（approved）不可 withdraw', () => {
    const store = makeStore();
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    approve(store, 'i1', { approver: '李四', comment: '', payload: {} });
    expect(() => withdraw(store, 'i1', { approver: '张三' })).toThrow(
      'instance not withdrawable',
    );
  });

  it('不存在的实例操作抛错', () => {
    const store = makeStore();
    expect(() => withdraw(store, 'nope', { approver: '张三' })).toThrow(
      'instance not withdrawable',
    );
  });

  it('版本快照：按实例绑定版本取图（v1 有图、v2 无图时 startInstance 抛错）', () => {
    const store: EngineStore = {
      instances: new Map(),
      history: [],
      getGraph: (versionId) =>
        versionId === 'v1' ? fixtureGraph() : undefined,
    };
    expect(() =>
      startInstance(store, {
        id: 'i1',
        flowId: 'f1',
        flowName: '请假审批',
        versionId: 'v2',
        applicant: '张三',
        payload: {},
      }),
    ).toThrow('graph not found: v2');
  });

  it('非法操作符抛错', () => {
    const node: EngineNode = {
      id: 'cond',
      type: 'condition',
      data: {
        conditions: [
          {
            key: 'if_x',
            value: {
              left: { type: 'constant', content: 1 },
              operator: '~~',
              right: { type: 'constant', content: 2 },
            },
          },
        ],
      },
    };
    expect(() => evaluateCondition(node, {})).toThrow('unsupported operator');
  });
});

describe('reject target and resubmit after withdraw', () => {
  // 无 reject 边的夹具图（只连前进方向）
  const forwardGraph: EngineGraph = {
    nodes: [
      { id: 'start', type: 'start', data: { title: '开始' } },
      {
        id: 'app1',
        type: 'approval',
        data: { title: '直属主管审批', approvalRole: 'direct_supervisor' },
      },
      { id: 'end', type: 'end', data: { title: '结束' } },
    ],
    edges: [
      { sourceNodeID: 'start', targetNodeID: 'app1' },
      { sourceNodeID: 'app1', targetNodeID: 'end', sourcePortID: 'pass' },
    ],
  };

  it('默认退回：reject 后 currentNodeId 指向 start（无 reject 边）', () => {
    const store = makeStore(forwardGraph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    reject(store, 'i1', { approver: '李四', comment: '退回' });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('returned');
    expect(inst.currentNodeId).toBe('start');
  });

  it('配置退回：approval 节点 data.rejectTo 指定退回目标', () => {
    const graph: EngineGraph = {
      nodes: [
        { id: 'start', type: 'start', data: { title: '开始' } },
        {
          id: 'app1',
          type: 'approval',
          data: { title: '主管审批', rejectTo: 'start' },
        },
        { id: 'app2', type: 'approval', data: { title: '部门负责人' } },
        { id: 'end', type: 'end', data: { title: '结束' } },
      ],
      edges: [
        { sourceNodeID: 'start', targetNodeID: 'app1' },
        { sourceNodeID: 'app1', targetNodeID: 'app2', sourcePortID: 'pass' },
        { sourceNodeID: 'app2', targetNodeID: 'end', sourcePortID: 'pass' },
      ],
    };
    const store = makeStore(graph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    approve(store, 'i1', { approver: '李四', comment: '', payload: {} }); // 到 app2
    expect(store.instances.get('i1')!.currentNodeId).toBe('app2');
    // app2 未配置 rejectTo → 默认退回 start
    reject(store, 'i1', { approver: '王五', comment: '' });
    expect(store.instances.get('i1')!.currentNodeId).toBe('start');
  });

  it('配置 rejectTo 指向非 start 节点时退回该节点', () => {
    const graph: EngineGraph = {
      nodes: [
        { id: 'start', type: 'start', data: { title: '开始' } },
        { id: 'app1', type: 'approval', data: { title: '主管审批' } },
        {
          id: 'app2',
          type: 'approval',
          data: { title: '部门负责人', rejectTo: 'app1' },
        },
        { id: 'end', type: 'end', data: { title: '结束' } },
      ],
      edges: [
        { sourceNodeID: 'start', targetNodeID: 'app1' },
        { sourceNodeID: 'app1', targetNodeID: 'app2', sourcePortID: 'pass' },
        { sourceNodeID: 'app2', targetNodeID: 'end', sourcePortID: 'pass' },
      ],
    };
    const store = makeStore(graph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    approve(store, 'i1', { approver: '李四', comment: '', payload: {} }); // 到 app2
    reject(store, 'i1', { approver: '王五', comment: '' });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('returned');
    expect(inst.currentNodeId).toBe('app1'); // 配置的退回目标
  });

  it('撤回后（withdrawn）可 resubmit 重新走流程', () => {
    const store = makeStore(forwardGraph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    withdraw(store, 'i1', { approver: '张三' });
    expect(store.instances.get('i1')!.status).toBe('withdrawn');
    resubmit(store, 'i1', { applicant: '张三', payload: { days: 2 } });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('approving');
    expect(inst.currentNodeId).toBe('app1');
    expect(store.history.at(-1)!.action).toBe('resubmit');
  });

  it('rejectTo 指向不存在的节点时抛错', () => {
    const graph: EngineGraph = {
      nodes: [
        { id: 'start', type: 'start', data: { title: '开始' } },
        {
          id: 'app1',
          type: 'approval',
          data: { title: '主管审批', rejectTo: 'ghost' },
        },
        { id: 'end', type: 'end', data: { title: '结束' } },
      ],
      edges: [
        { sourceNodeID: 'start', targetNodeID: 'app1' },
        { sourceNodeID: 'app1', targetNodeID: 'end', sourcePortID: 'pass' },
      ],
    };
    const store = makeStore(graph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    expect(() =>
      reject(store, 'i1', { approver: '李四', comment: '' }),
    ).toThrow('rejectTo not found: ghost');
    expect(store.history.filter((h) => h.action === 'reject')).toHaveLength(0);
    expect(store.instances.get('i1')!.status).toBe('approving');
  });

  it('rejectTo 为空串时退回 start（编辑器默认值场景）', () => {
    const graph: EngineGraph = {
      nodes: [
        { id: 'start', type: 'start', data: { title: '开始' } },
        {
          id: 'app1',
          type: 'approval',
          data: { title: '主管审批', rejectTo: '' },
        },
        { id: 'end', type: 'end', data: { title: '结束' } },
      ],
      edges: [
        { sourceNodeID: 'start', targetNodeID: 'app1' },
        { sourceNodeID: 'app1', targetNodeID: 'end', sourcePortID: 'pass' },
      ],
    };
    const store = makeStore(graph);
    startInstance(store, {
      id: 'i1',
      flowId: 'f1',
      flowName: '请假审批',
      versionId: 'v1',
      applicant: '张三',
      payload: {},
    });
    reject(store, 'i1', { approver: '李四', comment: '' });
    const inst = store.instances.get('i1')!;
    expect(inst.status).toBe('returned');
    expect(inst.currentNodeId).toBe('start');
  });
});
