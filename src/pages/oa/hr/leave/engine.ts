export interface EngineNode {
  id: string;
  type: string;
  data?: Record<string, any>;
}
export interface EngineEdge {
  sourceNodeID: string;
  targetNodeID: string;
  sourcePortID?: string;
}
export interface EngineGraph {
  nodes: EngineNode[];
  edges: EngineEdge[];
}
export type InstanceStatus =
  | 'approving'
  | 'returned'
  | 'approved'
  | 'withdrawn';
export interface ProcessInstance {
  id: string;
  flowId: string;
  flowName: string;
  versionId: string;
  status: InstanceStatus;
  currentNodeId: string;
  createdAt: string;
}
export interface ApprovalRecord {
  id: string;
  processInstanceId: string;
  nodeId: string;
  nodeTitle: string;
  action: 'submit' | 'approve' | 'reject' | 'resubmit' | 'withdraw' | 'pending';
  approver: string;
  comment: string;
  time: string;
  assignedRole?: string;
}
export interface EngineStore {
  instances: Map<string, ProcessInstance>;
  history: ApprovalRecord[];
  getGraph: (versionId: string) => EngineGraph | undefined;
}

const now = () => new Date().toISOString();
const sid = () => Math.random().toString(36).slice(2, 10);

function findNode(graph: EngineGraph, id: string): EngineNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

function outgoingEdges(graph: EngineGraph, nodeId: string): EngineEdge[] {
  return graph.edges.filter((e) => e.sourceNodeID === nodeId);
}

function pushHistory(
  store: EngineStore,
  instanceId: string,
  nodeId: string,
  nodeTitle: string,
  action: ApprovalRecord['action'],
  approver: string,
  comment: string,
) {
  store.history.push({
    id: sid(),
    processInstanceId: instanceId,
    nodeId,
    nodeTitle,
    action,
    approver,
    comment,
    time: now(),
  });
}

export function evaluateCondition(
  node: EngineNode,
  payload: Record<string, any>,
): boolean {
  const cond = node.data?.conditions?.[0]?.value;
  if (!cond) return false;
  const { left, operator, right } = cond;
  let leftValue: unknown;
  if (left.type === 'ref') {
    if (left.content[0] !== 'payload') {
      throw new Error(`unsupported ref target: ${left.content[0]}`);
    }
    leftValue = payload[left.content[1]];
  } else {
    leftValue = left.content;
  }
  // I4: 简化 - right 只支持 constant 类型
  const rightValue = right?.content;
  switch (operator) {
    case '=':
      // spec 的 '=' 允许宽松相等（如 payload 字符串 '3' 与常量 3 比较）
      // biome-ignore lint/suspicious/noDoubleEquals: deliberate loose equality per spec
      return leftValue == rightValue;
    case '!=':
      // biome-ignore lint/suspicious/noDoubleEquals: deliberate loose equality per spec
      return leftValue != rightValue;
    case '>':
      return Number(leftValue) > Number(rightValue);
    case '>=':
      return Number(leftValue) >= Number(rightValue);
    case '<':
      return Number(leftValue) < Number(rightValue);
    case '<=':
      return Number(leftValue) <= Number(rightValue);
    default:
      throw new Error(`unsupported operator: ${operator}`);
  }
}

function walk(
  store: EngineStore,
  inst: ProcessInstance,
  payload: Record<string, any>,
) {
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  for (let i = 0; i < 100; i++) {
    const node = findNode(graph, inst.currentNodeId);
    if (!node) throw new Error(`node not found: ${inst.currentNodeId}`);
    if (node.type === 'end') {
      inst.status = 'approved';
      return;
    }
    if (node.type === 'approval') {
      inst.status = 'approving';
      return;
    }
    const edges = outgoingEdges(graph, node.id);
    if (node.type === 'condition') {
      const matched = evaluateCondition(node, payload);
      const edge = matched
        ? edges.find((e) => e.sourcePortID && e.sourcePortID.startsWith('if_'))
        : edges.find((e) => e.sourcePortID === 'else');
      if (!edge) throw new Error(`condition branch not found: ${node.id}`);
      inst.currentNodeId = edge.targetNodeID;
      continue;
    }
    if (edges.length === 0) throw new Error(`no outgoing edge: ${node.id}`);
    inst.currentNodeId = edges[0].targetNodeID;
  }
  throw new Error('walk exceeds safety limit');
}

export function startInstance(
  store: EngineStore,
  input: {
    id: string;
    flowId: string;
    flowName: string;
    versionId: string;
    applicant: string;
    payload: Record<string, any>;
  },
) {
  const inst: ProcessInstance = {
    id: input.id,
    flowId: input.flowId,
    flowName: input.flowName,
    versionId: input.versionId,
    status: 'approving',
    currentNodeId: '',
    createdAt: now(),
  };
  const graph = store.getGraph(input.versionId);
  if (!graph) throw new Error(`graph not found: ${input.versionId}`);
  const startNode = graph.nodes.find((n) => n.type === 'start');
  if (!startNode) throw new Error('no start node');
  inst.currentNodeId = startNode.id;
  store.instances.set(inst.id, inst);
  pushHistory(
    store,
    inst.id,
    startNode.id,
    startNode.data?.title ?? '开始',
    'submit',
    input.applicant,
    '提交申请',
  );
  walk(store, inst, input.payload);
}

export function approve(
  store: EngineStore,
  instanceId: string,
  input: { approver: string; comment: string; payload: Record<string, any> },
) {
  const inst = store.instances.get(instanceId);
  if (!inst || inst.status !== 'approving')
    throw new Error('instance not approvable');
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  const node = findNode(graph, inst.currentNodeId);
  const edge = outgoingEdges(graph, inst.currentNodeId).find(
    (e) => e.sourcePortID === 'pass',
  );
  if (!edge) throw new Error(`no pass edge: ${inst.currentNodeId}`);
  pushHistory(
    store,
    inst.id,
    inst.currentNodeId,
    node?.data?.title ?? '',
    'approve',
    input.approver,
    input.comment,
  );
  inst.currentNodeId = edge.targetNodeID;
  walk(store, inst, input.payload);
}

export function reject(
  store: EngineStore,
  instanceId: string,
  input: { approver: string; comment: string },
) {
  const inst = store.instances.get(instanceId);
  if (!inst || inst.status !== 'approving')
    throw new Error('instance not rejectable');
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  const node = findNode(graph, inst.currentNodeId);
  const rejectTo = node?.data?.rejectTo as string | undefined;
  if (rejectTo && !findNode(graph, rejectTo)) {
    throw new Error(`rejectTo not found: ${rejectTo}`);
  }
  pushHistory(
    store,
    inst.id,
    inst.currentNodeId,
    node?.data?.title ?? '',
    'reject',
    input.approver,
    input.comment,
  );
  const startNode = graph.nodes.find((n) => n.type === 'start');
  inst.status = 'returned';
  inst.currentNodeId = rejectTo || (startNode?.id ?? '');
}

export function resubmit(
  store: EngineStore,
  instanceId: string,
  input: { applicant: string; payload: Record<string, any> },
) {
  const inst = store.instances.get(instanceId);
  if (!inst || (inst.status !== 'returned' && inst.status !== 'withdrawn'))
    throw new Error('instance not resubmittable');
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  const startNode = graph.nodes.find((n) => n.type === 'start');
  if (!startNode) throw new Error('no start node');
  pushHistory(
    store,
    inst.id,
    startNode.id,
    startNode.data?.title ?? '开始',
    'resubmit',
    input.applicant,
    '重新提交',
  );
  inst.status = 'approving';
  inst.currentNodeId = startNode.id;
  walk(store, inst, input.payload);
}

export function withdraw(
  store: EngineStore,
  instanceId: string,
  input: { approver: string },
) {
  const inst = store.instances.get(instanceId);
  if (!inst || (inst.status !== 'approving' && inst.status !== 'returned')) {
    throw new Error('instance not withdrawable');
  }
  const graph = store.getGraph(inst.versionId);
  if (!graph) throw new Error(`graph not found: ${inst.versionId}`);
  const node = findNode(graph, inst.currentNodeId);
  pushHistory(
    store,
    inst.id,
    inst.currentNodeId,
    node?.data?.title ?? '',
    'withdraw',
    input.approver,
    '撤回申请',
  );
  inst.status = 'withdrawn';
}
