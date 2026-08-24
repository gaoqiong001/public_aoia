---
feature: OA Leave Workflow
status: delivered
specs:
  - docs/compose/specs/2026-08-21-oa-leave-workflow-design.md
plans:
  - docs/compose/plans/2026-08-21-oa-leave-workflow.md
branch: feature/oa-leave-workflow
commits: bf7dd082..45d28071
---

# OA Leave Workflow — Final Report

## What Was Built

A complete OA leave approval workflow system integrated into the Ant Design Pro application. The feature demonstrates how to build traditional business workflows on top of the flow editor infrastructure.

The system includes:
- **Approval node** in the flow editor with configurable reject targets
- **Business-agnostic workflow engine** that processes workflow graphs (start → approval → condition → end)
- **Leave approval page** with four tabs: Apply, My Applications, Pending Approval, Completed
- **Full detail page** showing workflow progress with Steps, Descriptions, and Timeline
- **Edit/resubmit page** with auto-calculated days and rejection feedback
- **Mock data layer** with three-table separation (LeaveApplication, ProcessInstance, ApprovalHistory)

## Architecture

### Components

1. **Flow Editor Extension** (`src/pages/flow-editor/nodes/approval/`)
   - Approval node with pass/reject output ports
   - Configurable `rejectTo` field for custom reject targets
   - Registered in node registry alongside existing node types

2. **Workflow Engine** (`src/pages/oa/hr/leave/engine.ts`)
   - Pure function module, business-agnostic
   - Processes workflow graphs: walk through nodes, handle conditions, pause at approvals
   - Supports: submit, approve, reject, resubmit, withdraw operations
   - Condition evaluation: `payload.<field>` with operators `= != > >= < <=`
   - Reject target: `node.data.rejectTo` ?? graph start node (default)

3. **Mock Data Layer** (`src/pages/oa/hr/leave/store.ts`, `_mock.ts`)
   - Three in-memory stores: leaveStore, instanceStore, historyStore
   - Seed data covering all four statuses (approving, returned, approved, withdrawn)
   - Version reference guard prevents deleting versions used by active instances

4. **Leave Pages** (`src/pages/oa/hr/leave/`)
   - **List page** (`index.tsx`): Four tabs with ProTables, router navigation to detail/edit
   - **Detail page** (`detail/index.tsx`): Full page with Steps progress, Descriptions, Timeline
   - **Edit page** (`edit/index.tsx`): ProForm with auto-calc days, rejection feedback, FooterToolbar

### Data Flow

1. User submits leave form → `createLeaveApplication` → engine `startInstance` → walk graph → pause at first approval node
2. Approver approves → engine `approve` → walk continues along `pass` edge → condition node evaluates `days <= 3` → routes to HR (short) or dept manager (long)
3. Reject → engine `reject` → status `returned`, currentNodeId = `rejectTo` ?? start → user can resubmit
4. Withdraw → engine `withdraw` → status `withdrawn` → user can still resubmit
5. End node reached → status `approved`

## Usage

### Routes

- `/oa/hr/leave` — Leave approval list page (4 tabs)
- `/oa/hr/leave/:pid` — Leave detail page (hidden from menu)
- `/oa/hr/leave/edit` — New leave application (hidden from menu)
- `/oa/hr/leave/edit?pid=<id>` — Resubmit leave application

### Key Functions

```typescript
// Engine operations
startInstance(store, { id, flowId, flowName, versionId, applicant, payload })
approve(store, instanceId, { approver, comment, payload })
reject(store, instanceId, { approver, comment })
resubmit(store, instanceId, { applicant, payload })
withdraw(store, instanceId, { approver })

// Service functions
createLeaveApplication({ applicant, formData })
resubmitApplication(pid, formData)
withdrawApplication(pid)
getInstanceDetail(pid)
```

### Seed Data

4 pre-seeded leave applications demonstrating all statuses:
- `app-approving-1`: Pending supervisor approval (2 days annual leave)
- `app-returned-1`: Rejected by supervisor, can resubmit (3 days personal leave)
- `app-approved-1`: Fully approved through HR (2 days sick leave)
- `app-withdrawn-1`: Withdrawn by applicant, can resubmit (1 day compensatory leave)

## Verification

### Automated Tests

- **Engine tests**: 21 test cases covering all workflow operations, condition branches, reject targets, resubmit after withdraw
- **Store tests**: 2 test cases for version reference guard
- **Total**: 23/23 tests passing

### Build Verification

- `npm run tsc`: ✅ Pass
- `npm run lint`: ✅ Pass (biome + tsc)
- `npm run build`: ✅ Pass (all pages compiled)
- `npx vitest run`: ✅ Pass (23 tests)

### Manual Testing Scenarios

1. Submit ≤3 days leave → supervisor approves → HR archives → approved
2. Submit >3 days leave → supervisor approves → dept manager approves → HR archives → approved
3. Supervisor rejects → applicant sees rejection feedback → resubmit → re-enters workflow
4. Applicant withdraws during approval → can resubmit
5. Detail page shows Steps progress, Descriptions, and Timeline
6. Edit page auto-calculates days, shows rejection feedback on resubmit

## Journey Log

- [lesson] The workflow engine needed to support configurable reject targets (`node.data.rejectTo`) rather than hardcoded reject edges in the graph, simplifying the visual representation
- [pivot] Upgraded from modal-based detail/edit to full pages for better UX (consistent with profile/advanced pattern)
- [lesson] Three-table separation (LeaveApplication, ProcessInstance, ApprovalHistory) keeps business data clean while enabling flexible workflow operations

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/specs/2026-08-21-oa-leave-workflow-design.md` | Design spec | Sections S1-S12 |
| `docs/compose/plans/2026-08-21-oa-leave-workflow.md` | Implementation plan | 12 tasks completed |
| `src/pages/oa/hr/leave/engine.ts` | Workflow engine | 21 tests |
| `src/pages/oa/hr/leave/_mock.ts` | Mock endpoints | 13 API endpoints |
| `src/pages/oa/hr/leave/detail/index.tsx` | Detail page | Steps + Descriptions + Timeline |
| `src/pages/oa/hr/leave/edit/index.tsx` | Edit page | ProForm + FooterToolbar |
