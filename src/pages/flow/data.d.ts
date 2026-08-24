declare namespace API {
  type FlowStatus = 'draft' | 'published' | 'archived';
  type VersionStatus = 'active' | 'inactive';

  interface FlowItem {
    id: string;
    name: string;
    description: string;
    code?: string;
    status: FlowStatus;
    activeVersionId: string | null;
    versionCount: number;
    createdAt: string;
    updatedAt: string;
  }

  interface FlowVersionItem {
    id: string;
    flowId: string;
    version: number;
    status: VersionStatus;
    remark: string;
    createdAt: string;
  }

  interface FlowVersionGraph {
    id: string;
    flowId: string;
    version: number;
    status: VersionStatus;
    remark: string;
    createdAt: string;
    graphJson: Record<string, any>;
  }
}
