// @ts-nocheck
import { useLayoutEffect, useMemo } from 'react';

import { Field, FormRenderProps, FormMeta, useClientContext } from '@flowgram.ai/free-layout-editor';

import { FlowNodeJSON } from '../../typings';
import { FormHeader, FormContent, FormItem } from '../../form-components';
import { useNodeRenderContext } from '../../hooks';
import { ApprovalPort } from './styles';
import { t, getRoleOptions } from './locale';

export const renderForm = ({ form }: FormRenderProps<FlowNodeJSON>) => {
  const { node, readonly } = useNodeRenderContext();
  const ctx = useClientContext();
  useLayoutEffect(() => {
    window.requestAnimationFrame(() => {
      node.ports.updateDynamicPorts();
    });
  }, [node]);

  // Get all nodes in the graph for the rejectTo dropdown
  const nodeOptions = useMemo(() => {
    try {
      const document = ctx.document;
      if (!document) return [];
      const nodes = document.toJSON()?.nodes ?? [];
      return nodes
        .filter((n: any) => n.id !== node.id) // Exclude current node
        .map((n: any) => ({
          label: `${n.data?.title || n.id} (${n.id})`,
          value: n.id,
        }));
    } catch {
      return [];
    }
  }, [ctx.document, node.id]);

  const roleOptions = getRoleOptions();

  return (
    <>
      <FormHeader />
      <FormContent>
        <FormItem name="approvalRole" label={t('approval.role.label')}>
          <Field name="approvalRole">
            {({ field }) => (
              <select
                style={{ width: '100%' }}
                value={field.value}
                disabled={readonly}
                onChange={(e) => field.onChange(e.target.value)}
              >
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </FormItem>
        <FormItem name="remark" label={t('approval.remark.label')}>
          <Field name="remark">
            {({ field }) => (
              <textarea
                style={{ width: '100%' }}
                value={field.value || ''}
                disabled={readonly}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          </Field>
        </FormItem>
        <FormItem name="rejectTo" label={t('approval.rejectTo.label')}>
          <Field name="rejectTo">
            {({ field }) => (
              <select
                style={{ width: '100%' }}
                value={field.value || ''}
                disabled={readonly}
                onChange={(e) => field.onChange(e.target.value)}
              >
                <option value="">{t('approval.rejectTo.default')}</option>
                {nodeOptions.map((o: any) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </FormItem>
        <ApprovalPort data-port-id="pass" data-port-type="output" $top="34%">
          {t('approval.port.pass')}
        </ApprovalPort>
        <ApprovalPort data-port-id="reject" data-port-type="output" $top="66%">
          {t('approval.port.reject')}
        </ApprovalPort>
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
};
