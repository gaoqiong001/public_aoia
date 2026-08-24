// @ts-nocheck
// Simple locale map for approval node labels
// Flow editor uses vendored code with @ts-nocheck, so we use a lightweight approach

const locales: Record<string, Record<string, string>> = {
  'zh-CN': {
    'approval.role.label': '审批人角色',
    'approval.role.direct_supervisor': '直属主管',
    'approval.role.dept_manager': '部门负责人',
    'approval.role.hr': '人事',
    'approval.remark.label': '说明',
    'approval.rejectTo.label': '退回节点',
    'approval.rejectTo.default': '退回发起人（默认）',
    'approval.port.pass': '通过',
    'approval.port.reject': '驳回',
    'approval.node.description': '人工审批步骤。通过/驳回端口决定下一步。',
  },
  'en-US': {
    'approval.role.label': 'Approver Role',
    'approval.role.direct_supervisor': 'Direct Supervisor',
    'approval.role.dept_manager': 'Department Manager',
    'approval.role.hr': 'HR',
    'approval.remark.label': 'Remark',
    'approval.rejectTo.label': 'Reject To',
    'approval.rejectTo.default': 'Back to initiator (default)',
    'approval.port.pass': 'Pass',
    'approval.port.reject': 'Reject',
    'approval.node.description': 'Human approval step. Pass/reject ports decide the next step.',
  },
  'ja-JP': {
    'approval.role.label': '承認者ロール',
    'approval.role.direct_supervisor': '直属上司',
    'approval.role.dept_manager': '部門責任者',
    'approval.role.hr': '人事',
    'approval.remark.label': '備考',
    'approval.rejectTo.label': '却下先',
    'approval.rejectTo.default': '申請者に戻る（デフォルト）',
    'approval.port.pass': '承認',
    'approval.port.reject': '却下',
    'approval.node.description': '手動承認ステップ。承認/却下ポートで次のステップを決定。',
  },
};

// Get current locale from browser or default to zh-CN
function getCurrentLocale(): string {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language;
    if (lang.startsWith('en')) return 'en-US';
    if (lang.startsWith('ja')) return 'ja-JP';
  }
  return 'zh-CN';
}

export function t(key: string): string {
  const locale = getCurrentLocale();
  return locales[locale]?.[key] || locales['zh-CN']?.[key] || key;
}

export function getRoleOptions() {
  return [
    { label: t('approval.role.direct_supervisor'), value: 'direct_supervisor' },
    { label: t('approval.role.dept_manager'), value: 'dept_manager' },
    { label: t('approval.role.hr'), value: 'hr' },
  ];
}
