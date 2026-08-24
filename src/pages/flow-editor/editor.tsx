// @ts-nocheck
/**
 * Flow editor component (vendored from Flowgram demo, minimally extended to
 * accept an optional initialData). Save/copy actions live in the bottom
 * DemoTools toolbar (components/tools/flow-save.tsx) and reach the page via
 * FlowEditorActionsContext.
 */
import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import { EditorRenderer, FreeLayoutEditorProvider } from '@flowgram.ai/free-layout-editor';

import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import { nodeRegistries } from './nodes';
import { initialData as defaultInitialData } from './initial-data';
import { useEditorProps } from './hooks';
import type { FlowDocumentJSON } from './typings';

export interface EditorProps {
  initialData?: FlowDocumentJSON;
}

export const Editor = ({ initialData }: EditorProps) => {
  const editorProps = useEditorProps(
    initialData ?? defaultInitialData,
    nodeRegistries,
  );
  return (
    <div className="doc-free-feature-overview">
      <FreeLayoutEditorProvider {...editorProps}>
        <div className="demo-container">
          <DockedPanelLayer>
            <EditorRenderer className="demo-editor" />
          </DockedPanelLayer>
        </div>
      </FreeLayoutEditorProvider>
    </div>
  );
};
