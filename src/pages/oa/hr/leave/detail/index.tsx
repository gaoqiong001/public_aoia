import { DingdingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { PageContainer, RouteContext } from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import type { StepsProps } from 'antd';
import {
  Badge,
  Button,
  Card,
  Descriptions,
  message,
  Space,
  Statistic,
  Steps,
  Tag,
  Timeline,
} from 'antd';
import { createStyles } from 'antd-style';
import { useEffect, useMemo, useState } from 'react';
import { getVersionGraph } from '../../../../flow/service';
import {
  getInstanceDetail,
  type InstanceDetail,
  withdrawApplication,
} from '../service';

const useStyles = createStyles(({ token }) => {
  return {
    main: {
      '.ant-descriptions-row > td': { paddingBottom: '8px' },
      '.ant-page-header-heading-extra': { flexDirection: 'column' },
    },
    headerList: {
      marginBottom: '4px',
      '.ant-descriptions-row > td': { paddingBottom: '8px' },
    },
    stepDescription: {
      position: 'relative',
      paddingTop: '8px',
      fontSize: '14px',
      textAlign: 'left',
      '> div': { marginTop: '8px', marginBottom: '4px' },
      [`@media screen and (max-width: ${token.screenSM}px)`]: {
        left: '8px',
      },
    },
    pageHeader: {
      '.ant-page-header-heading-extra > * + *': { marginLeft: '8px' },
      [`@media screen and (max-width: ${token.screenSM}px)`]: {
        '.ant-pro-page-header-wrap-row': {
          flexDirection: 'column',
        },
      },
    },
    moreInfo: {
      display: 'flex',
      justifyContent: 'space-between',
      width: '200px',
    },
  };
});

const statusMap: Record<string, { text: string; color: string }> = {
  approving: { text: '审批中', color: 'processing' },
  returned: { text: '已退回', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  withdrawn: { text: '已撤回', color: 'default' },
};
const actionMap: Record<string, string> = {
  submit: '提交申请',
  approve: '通过',
  reject: '驳回',
  resubmit: '重新提交',
  withdraw: '撤回申请',
};

interface WorkflowNode {
  id: string;
  type: string;
  title: string;
  approvalRole?: string;
}

// Walk the graph from start to end to get the workflow path
// Filter out condition nodes - only show business steps
function getWorkflowPath(graph: any, days: number): WorkflowNode[] {
  if (!graph?.nodes || !graph?.edges) return [];

  const nodes = graph.nodes as any[];
  const edges = graph.edges as any[];

  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) return [];

  const path: WorkflowNode[] = [
    {
      id: startNode.id,
      type: 'start',
      title: startNode.data?.title || '开始',
    },
  ];

  let currentNodeId = startNode.id;
  const visited = new Set<string>();

  // Walk through the graph (max 10 steps to avoid infinite loop)
  for (let i = 0; i < 10; i++) {
    const outEdges = edges.filter((e) => e.sourceNodeID === currentNodeId);
    if (outEdges.length === 0) break;

    // For condition nodes, determine which branch to take
    const currentNode = nodes.find((n) => n.id === currentNodeId);
    let nextEdge = outEdges[0];

    if (currentNode?.type === 'condition') {
      // Evaluate condition: days <= 3 → if_short branch, else → else branch
      const ifShortEdge = outEdges.find((e) => e.sourcePortID === 'if_short');
      const elseEdge = outEdges.find((e) => e.sourcePortID === 'else');
      nextEdge = days <= 3 ? ifShortEdge : elseEdge || outEdges[0];
    }

    if (!nextEdge) break;

    const nextNodeId = nextEdge.targetNodeID;
    if (visited.has(nextNodeId)) break;
    visited.add(nextNodeId);

    const nextNode = nodes.find((n) => n.id === nextNodeId);
    if (!nextNode) break;

    // Skip condition nodes - only show business steps
    if (nextNode.type !== 'condition') {
      path.push({
        id: nextNode.id,
        type: nextNode.type,
        title: nextNode.data?.title || nextNode.id,
        approvalRole: nextNode.data?.approvalRole,
      });
    }

    currentNodeId = nextNodeId;

    // Stop at end node
    if (nextNode.type === 'end') break;
  }

  return path;
}

export default function LeaveDetail() {
  const { styles } = useStyles();
  const params = useParams<{ pid: string }>();
  const [detail, setDetail] = useState<InstanceDetail>();
  const [graph, setGraph] = useState<any>();

  const load = () => {
    if (!params.pid) return;
    getInstanceDetail(params.pid)
      .then((d) => {
        setDetail(d);
        // Fetch the workflow graph
        if (d.instance.flowId && d.instance.versionId) {
          getVersionGraph(d.instance.flowId, d.instance.versionId)
            .then((g: any) => setGraph(g?.graphJson))
            .catch(() => setGraph(undefined));
        }
      })
      .catch(() => setDetail(undefined));
  };
  useEffect(load, [params.pid]);

  const app = detail?.application;
  const inst = detail?.instance;
  const historyRecords = detail?.history ?? [];
  const status = statusMap[inst?.status ?? ''] ?? {
    text: '-',
    color: 'default',
  };

  // Get the full workflow path based on the graph and leave days
  const workflowPath = useMemo(() => {
    if (!graph || !app) return [];
    return getWorkflowPath(graph, app.days);
  }, [graph, app]);

  // Map history records by node ID for quick lookup
  const historyByNode = useMemo(() => {
    const map = new Map<string, typeof historyRecords>();
    for (const h of historyRecords) {
      const list = map.get(h.nodeId) || [];
      list.push(h);
      map.set(h.nodeId, list);
    }
    return map;
  }, [historyRecords]);

  // Get pending task info from detail
  const pendingTask = detail?.pendingTask;

  // Build Steps from workflow path - matching advanced detail page style
  const stepsItems: StepsProps['items'] = workflowPath.map((node) => {
    const nodeHistory = historyByNode.get(node.id) || [];
    const lastRecord = nodeHistory[nodeHistory.length - 1];
    const isCompleted = nodeHistory.some(
      (h) => h.action === 'approve' || h.action === 'submit',
    );
    const isRejected = nodeHistory.some((h) => h.action === 'reject');
    const isCurrentNode =
      inst?.status === 'approving' && inst.currentNodeId === node.id;

    // Build content - matching advanced detail page style
    let content: React.ReactNode;

    if (isCompleted && lastRecord) {
      // Completed step: show approver + icon + time
      content = (
        <div className={styles.stepDescription}>
          {lastRecord.approver}
          <DingdingOutlined
            style={{
              marginLeft: 8,
            }}
          />
          <div>{lastRecord.time}</div>
        </div>
      );
    } else if (isCurrentNode) {
      // Current step: show handler from pending task + "催一下" button
      const handler = pendingTask?.assignedTo || '待审批';
      content = (
        <div className={styles.stepDescription}>
          {handler}
          <DingdingOutlined
            style={{
              color: '#00A0E9',
              marginLeft: 8,
            }}
          />
          <div>
            <Button type="link" style={{ padding: 0 }}>
              催一下
            </Button>
          </div>
        </div>
      );
    }

    return {
      title: node.title,
      content,
    };
  });

  // Find current step index
  const currentStep = useMemo(() => {
    if (!inst) return 0;
    const idx = workflowPath.findIndex((n) => n.id === inst.currentNodeId);
    return idx >= 0 ? idx : workflowPath.length - 1;
  }, [workflowPath, inst]);

  const extra = (
    <div className={styles.moreInfo}>
      <Statistic title="状态" value={status.text} />
    </div>
  );

  const description = app ? (
    <RouteContext.Consumer>
      {({ isMobile }) => (
        <Descriptions
          className={styles.headerList}
          size="small"
          column={isMobile ? 1 : 2}
          items={[
            { key: 'applicant', label: '申请人', children: app.applicant },
            { key: 'leaveType', label: '请假类型', children: app.leaveType },
            {
              key: 'range',
              label: '起止日期',
              children: `${app.startDate} ~ ${app.endDate}`,
            },
            { key: 'days', label: '天数', children: app.days },
            { key: 'reason', label: '事由', children: app.reason },
            ...(app.diagnosisNote
              ? [
                  {
                    key: 'diagnosis',
                    label: '诊断说明',
                    children: app.diagnosisNote,
                  },
                ]
              : []),
          ]}
        />
      )}
    </RouteContext.Consumer>
  ) : null;

  return (
    <PageContainer
      className={styles.pageHeader}
      title={app ? `请假单号：${app.id}` : '请假详情'}
      content={description}
      extraContent={extra}
      extra={
        inst && (
          <Space size="medium">
            <Button onClick={() => history.push('/oa/hr/leave')}>
              返回列表
            </Button>
            {inst.status === 'approving' && (
              <Button
                danger
                onClick={async () => {
                  await withdrawApplication(inst.id);
                  message.success('已撤回');
                  load();
                }}
              >
                撤回
              </Button>
            )}
            {(inst.status === 'returned' || inst.status === 'withdrawn') && (
              <Button
                type="primary"
                onClick={() => history.push(`/oa/hr/leave/edit?pid=${inst.id}`)}
              >
                编辑重提
              </Button>
            )}
          </Space>
        )
      }
    >
      <div className={styles.main}>
        <Card
          title="流程进度"
          style={{
            marginBottom: 24,
          }}
        >
          <RouteContext.Consumer>
            {({ isMobile }) => (
              <Steps
                orientation={isMobile ? 'vertical' : 'horizontal'}
                current={currentStep}
                items={stepsItems}
              />
            )}
          </RouteContext.Consumer>
        </Card>
        <Card
          title="申请信息"
          style={{ marginBottom: 24 }}
          variant="borderless"
        >
          {app && (
            <Descriptions
              column={2}
              items={[
                { key: 'id', label: '单号', children: app.id },
                {
                  key: 'status',
                  label: '状态',
                  children: <Tag color={status.color}>{status.text}</Tag>,
                },
                {
                  key: 'applicant',
                  label: '申请人',
                  children: app.applicant,
                },
                {
                  key: 'leaveType',
                  label: '请假类型',
                  children: app.leaveType,
                },
                {
                  key: 'range',
                  label: '起止日期',
                  children: `${app.startDate} ~ ${app.endDate}`,
                },
                { key: 'days', label: '天数', children: app.days },
                { key: 'reason', label: '事由', children: app.reason },
                ...(app.diagnosisNote
                  ? [
                      {
                        key: 'diagnosis',
                        label: '诊断说明',
                        children: app.diagnosisNote,
                      },
                    ]
                  : []),
                {
                  key: 'createdAt',
                  label: '提交时间',
                  children: app.createdAt,
                },
              ]}
            />
          )}
        </Card>
        <Card title="审批记录" variant="borderless">
          <Timeline
            items={historyRecords.map((h) => ({
              color:
                h.action === 'reject'
                  ? 'red'
                  : h.action === 'approve'
                    ? 'green'
                    : 'blue',
              children: (
                <div>
                  <div>
                    {h.nodeTitle} · {actionMap[h.action] ?? h.action} ·{' '}
                    {h.approver}
                  </div>
                  <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                    {h.comment || '无意见'} · {h.time}
                  </div>
                </div>
              ),
            }))}
          />
        </Card>
      </div>
    </PageContainer>
  );
}
