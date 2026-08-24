// @ts-nocheck
import { nanoid } from 'nanoid';

import { FlowNodeRegistry } from '../../typings';
import iconApproval from '../../assets/icon-condition.svg';
import { formMeta } from './form-meta';
import { WorkflowNodeType } from '../constants';
import { t } from './locale';

export const ApprovalNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Approval,
  info: {
    icon: iconApproval,
    description: t('approval.node.description'),
  },
  meta: {
    defaultPorts: [{ type: 'input' }],
    useDynamicPort: true,
    expandable: false,
    size: {
      width: 360,
      height: 190,
    },
  },
  formMeta,
  onAdd() {
    return {
      id: `approval_${nanoid(5)}`,
      type: 'approval',
      data: {
        title: '审批',
        approvalRole: 'direct_supervisor',
        remark: '',
        rejectTo: '',
      },
    };
  },
};
