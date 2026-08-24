import { beforeEach, describe, expect, it } from 'vitest';
import { instanceStore, isVersionReferenced } from './store';

describe('isVersionReferenced', () => {
  beforeEach(() => {
    instanceStore.clear();
  });

  it('无实例引用时返回 false', () => {
    expect(isVersionReferenced('ver-x')).toBe(false);
  });

  it('被实例引用时返回 true', () => {
    instanceStore.set('inst-t', {
      id: 'inst-t',
      flowId: 'f',
      flowName: '请假审批',
      versionId: 'ver-leave-1',
      status: 'approving',
      currentNodeId: 'approve_supervisor',
      createdAt: new Date().toISOString(),
    });
    expect(isVersionReferenced('ver-leave-1')).toBe(true);
    expect(isVersionReferenced('ver-other')).toBe(false);
  });
});
