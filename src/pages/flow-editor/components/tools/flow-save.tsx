// @ts-nocheck
/**
 * 保存 / 版本复制 buttons, rendered inside the vendored DemoTools bottom
 * toolbar. Serializes the editor document (ctx.document.toJSON()) and calls
 * the page-provided handlers via FlowEditorActionsContext.
 */
import { useState } from 'react';

import { useClientContext } from '@flowgram.ai/free-layout-editor';
import { Button } from '@douyinfe/semi-ui';

import { useFlowEditorActions } from '../../flow-editor-actions';

const btnStyle = {
  backgroundColor: 'rgba(171,181,255,0.3)',
  borderRadius: '8px',
};

export function FlowSave() {
  const ctx = useClientContext();
  const actions = useFlowEditorActions();
  const [busy, setBusy] = useState(false);

  const serialize = () => {
    if (ctx.document.disposed) return null;
    return ctx.document.toJSON();
  };

  const handleSave = async () => {
    const graphJson = serialize();
    if (!graphJson) return;
    setBusy(true);
    try {
      await actions.onSave?.(graphJson);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    const graphJson = serialize();
    if (!graphJson) return;
    setBusy(true);
    try {
      await actions.onCopy?.(graphJson);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        theme="borderless"
        disabled={!actions.canSave || busy}
        onClick={handleSave}
        style={btnStyle}
      >
        保存
      </Button>
      <Button
        theme="borderless"
        disabled={!actions.canCopy || busy}
        onClick={handleCopy}
        style={btnStyle}
      >
        版本复制
      </Button>
    </>
  );
}
