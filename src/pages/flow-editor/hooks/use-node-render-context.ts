// @ts-nocheck
/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useContext } from 'react';

import type { NodeRenderReturnType } from '@flowgram.ai/free-layout-editor';
import { NodeRenderContext } from '../context';

export function useNodeRenderContext(): NodeRenderReturnType {
  return useContext(NodeRenderContext);
}
