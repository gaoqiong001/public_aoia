// @ts-nocheck
/**
 * Context bridge between the flow-editor page (which owns mock API handlers)
 * and the vendored Flowgram tools toolbar (which can call useClientContext).
 * Lets the bottom toolbar's 保存/版本复制 buttons reach the page handlers.
 */
import { createContext, useContext } from 'react';

export interface FlowEditorActions {
  /** Save: update current version in-place, or create a new version if none loaded. */
  onSave?: (graphJson: any) => void | Promise<void>;
  /** Duplicate current editor state as a new version. */
  onCopy?: (graphJson: any) => void | Promise<void>;
  /** A flowId is present (保存 enabled). */
  canSave: boolean;
  /** A flowId is present (版本复制 enabled). */
  canCopy: boolean;
}

export const FlowEditorActionsContext = createContext<FlowEditorActions>({
  canSave: false,
  canCopy: false,
});

export const useFlowEditorActions = () => useContext(FlowEditorActionsContext);
