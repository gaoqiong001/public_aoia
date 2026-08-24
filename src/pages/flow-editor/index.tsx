// @ts-nocheck
/**
 * Flow editor page entry.
 * - Reads ?flowId=&versionId= to load a specific version's graph.
 * - Provides 保存 (in-place update) / 版本复制 (duplicate as new version)
 *   to the bottom toolbar via FlowEditorActionsContext.
 * Without query params, falls back to the demo initial-data (back-compat).
 */
import { createRoot } from 'react-dom/client';
import { PageContainer } from '@ant-design/pro-components';
import { unstableSetCreateRoot } from '@flowgram.ai/form-materials';
import { useSearchParams, history } from '@umijs/max';
import { useEffect, useState } from 'react';
import { message } from 'antd';

import {
  createVersion,
  getFlowDetail,
  getVersionGraph,
  updateVersion,
} from '@/pages/flow/service';
import { Editor } from './editor';
import { FlowEditorActionsContext } from './flow-editor-actions';
import type { FlowDocumentJSON } from './typings';

// React 18/19 polyfill for form-materials (ported from demo app.tsx).
unstableSetCreateRoot(createRoot);

export default function FlowEditorPage() {
  const [search] = useSearchParams();
  const flowId = search.get('flowId') || undefined;
  const versionId = search.get('versionId') || undefined;
  const [initialData, setInitialData] = useState<FlowDocumentJSON | undefined>();
  // Tracks a version just created via 保存 in new-version mode, so subsequent
  // 保存 updates it in-place instead of creating duplicates.
  const [createdId, setCreatedId] = useState<string | undefined>(undefined);
  // Flow name and version number for display in the page title.
  const [flowName, setFlowName] = useState<string>();
  const [versionNo, setVersionNo] = useState<number>();

  // Fetch flow name (available whenever flowId is set).
  useEffect(() => {
    if (!flowId) return;
    getFlowDetail(flowId).then((f) => setFlowName(f.name));
  }, [flowId]);

  // Fetch version graph when a specific version is requested.
  useEffect(() => {
    if (!flowId || !versionId) return;
    getVersionGraph(flowId, versionId).then((g) => {
      setInitialData(g.graphJson as FlowDocumentJSON);
      setVersionNo(g.version);
    });
  }, [flowId, versionId]);

  // Wait for the version graph when a specific version is requested.
  if (flowId && versionId && !initialData) {
    return <PageContainer>加载版本图中…</PageContainer>;
  }

  const currentVersionId = versionId || createdId;
  const actions = {
    canSave: !!flowId,
    canCopy: !!flowId,
    onSave: flowId
      ? async (graphJson: any) => {
          // Save: update in-place if a version is loaded/just-created, else create.
          if (currentVersionId) {
            await updateVersion(flowId, currentVersionId, { graphJson });
            message.success('已保存');
          } else {
            const v = await createVersion(flowId, { graphJson });
            setCreatedId(v.id);
            setVersionNo(v.version);
            message.success('已保存为新版本');
          }
        }
      : undefined,
    onCopy: flowId
      ? async (graphJson: any) => {
          // Copy: create a new version and jump to its editor page.
          const v = await createVersion(flowId, { graphJson });
          message.success('已复制为新版本');
          history.push(`/flow-editor?flowId=${flowId}&versionId=${v.id}`);
        }
      : undefined,
  };

  return (
    <PageContainer
      ghost
      title={flowName ? `${flowName} · ${versionNo ? `v${versionNo}` : '新版本'}` : undefined}
      childrenContentStyle={{
        height: 'calc(100vh - 160px)',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <FlowEditorActionsContext.Provider value={actions}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <Editor initialData={initialData} />
        </div>
      </FlowEditorActionsContext.Provider>
    </PageContainer>
  );
}
