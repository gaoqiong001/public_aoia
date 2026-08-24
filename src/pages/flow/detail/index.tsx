import { PageContainer } from '@ant-design/pro-components';
import { useParams } from '@umijs/max';
import { Button, Card, Divider } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import FlowForm from '../components/FlowForm';
import { getFlowDetail } from '../service';
import BasicInfo from './components/BasicInfo';
import VersionTable from './components/VersionTable';

export default function FlowDetail() {
  const params = useParams<{ id: string }>();
  const [flow, setFlow] = useState<API.FlowItem>();
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(() => {
    if (!params.id) return;
    getFlowDetail(params.id).then(setFlow);
  }, [params.id]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer>
      <Card
        extra={
          <Button
            type="primary"
            disabled={!flow}
            onClick={() => setEditOpen(true)}
          >
            编辑
          </Button>
        }
      >
        <BasicInfo flow={flow} />
        <Divider size="large" />
        <VersionTable flowId={params.id ?? ''} />
      </Card>
      <FlowForm
        open={editOpen}
        onOpenChange={setEditOpen}
        record={flow}
        onSuccess={() => {
          setEditOpen(false);
          load();
        }}
      />
    </PageContainer>
  );
}
