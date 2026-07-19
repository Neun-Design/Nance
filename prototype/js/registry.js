// registry.js — declarative tab definitions. Each tab = entity table + filters (+ rollups/charts).
// Rendering is generic (see app.js); adding/adjusting a tab means editing one object here.

import { lookup } from './data.js';

// ---- shared helpers ----
const L = (entity, field) => (id) => lookup(entity, id, field); // filter/label mapper

const STATUS_CLASS = {
  Open: 'info', InProgress: 'caution', 'In Progress': 'caution', Resolved: 'success',
  Closed: 'neutral', Escalated: 'danger', Draft: 'neutral', Submitted: 'info',
  Approved: 'success', Archived: 'neutral', Planning: 'info', 'On Hold': 'warning',
  Active: 'success', Done: 'success', Queued: 'neutral', Stoped: 'danger',
  UnderTreatment: 'caution', Accepted: 'info', Threat: 'danger', Opportunity: 'success',
};
const statusPill = (v) => STATUS_CLASS[v] || 'neutral';
const boolCol = (key, label = 'Active') => ({
  key, label, accessor: (r) => (r[key] ? label : 'Inactive'),
  pill: (v) => (v === label ? 'success' : 'neutral'),
});

export const REGISTRY = [
  // ============================ CUSTOMERS ============================
  { name: 'Customers', icon: '👥', tabs: [
    { tab: 'Factories', entity: 'Factories', pk: 'factoryID',
      columns: [
        { key: 'factoryID', label: 'ID' }, { key: 'factoryName', label: 'Name' },
        { key: 'city', label: 'City' }, { key: 'country', label: 'Country' },
        { key: 'businessSegment', label: 'Segment', pill: () => 'neutral' },
        { key: 'region', label: 'Region' }, boolCol('isActive'),
      ],
      filters: [
        { field: 'region', label: 'Region', type: 'select' },
        { field: 'businessSegment', label: 'Segment', type: 'select' },
        { field: 'isActive', label: 'Active', type: 'select', labelFn: (v) => (v ? 'Active' : 'Inactive') },
      ],
      charts: [
        { type: 'donut', title: 'Factories by Region', groupBy: 'region', agg: 'count' },
        { type: 'donut', title: 'Factories by Segment', groupBy: 'businessSegment', agg: 'count' },
      ] },

    { tab: 'Forecasts', entity: 'Forecasts', pk: 'forecastID',
      columns: [
        { key: 'forecastID', label: 'ID' },
        { key: 'factoryID', label: 'Factory', lookup: ['Factories', 'factoryName'] },
        { key: 'forecastPeriod', label: 'Period Type' },
        { key: 'periodLabel', label: 'Period', mirror: true },
        { key: 'status', label: 'Status', pill: statusPill },
        { key: 'totalEstimatedHours', label: 'Est. Hours', num: true, mirror: true },
      ],
      filters: [
        { field: 'forecastPeriod', label: 'Period Type', type: 'select' },
        { field: 'status', label: 'Status', type: 'select' },
        { field: 'factoryID', label: 'Factory', type: 'select', labelFn: L('Factories', 'factoryName') },
      ],
      charts: [
        { type: 'line', title: 'Estimated Hours by Period', xField: 'periodLabel', seriesBy: 'factoryName',
          agg: 'sum', valueField: 'totalEstimatedHours' },
      ] },

    { tab: 'Forecast Scopes', entity: 'Forecast Scopes', pk: 'forecastScopeID',
      columns: [
        { key: 'forecastScopeID', label: 'ID' }, { key: 'forecastID', label: 'Forecast' },
        { key: 'productScopeID', label: 'Product Scope', lookup: ['Product Scopes', 'productScopeName'] },
        { key: 'eventID', label: 'Event', lookup: ['Events', 'eventTitle'] },
        { key: 'notes', label: 'Notes' },
      ],
      filters: [
        { field: 'eventID', label: 'Event', type: 'select', labelFn: L('Events', 'eventTitle') },
        { field: 'forecastID', label: 'Forecast', type: 'select' },
      ],
      charts: [
        { type: 'bar', title: 'Forecast Scopes by Event', groupBy: 'eventID', agg: 'count', labelFn: L('Events', 'eventTitle') },
      ] },
  ] },

  // ============================ OPERATION ============================
  { name: 'Operation', icon: '⚙️', tabs: [
    { tab: 'Task Templates', entity: 'Tasks', pk: 'taskID',
      subtitle: 'Tasks are templates for execution. Jobs are created from tasks in the Workload module.',
      columns: [
        { key: 'taskName', label: 'Task', mirror: true },
        { key: 'eventTitle', label: 'Event' }, { key: 'processName', label: 'Process' },
        { key: 'activityName', label: 'Activity' }, { key: 'roleName', label: 'Role' },
        { key: 'scopeName', label: 'Scope' },
        { key: 'executionTime', label: 'Exec. Hrs', num: true },
        { key: 'constraintNames', label: 'Constraints', mirror: true },
      ],
      filters: [
        { field: 'scopeName', label: 'Scope', type: 'select' },
        { field: 'processID', label: 'Process', type: 'select', labelFn: L('Processes', 'processName') },
        { field: 'eventID', label: 'Event', type: 'select', labelFn: L('Events', 'eventTitle') },
        { field: 'roleID', label: 'Role', type: 'select', labelFn: L('Roles', 'roleName') },
      ],
      charts: [
        { type: 'bar', title: 'Tasks by Process', groupBy: 'processID', agg: 'count', labelFn: L('Processes', 'processName') },
        { type: 'bar', title: 'Planned Hours by Role', groupBy: 'roleID', agg: 'sum', valueField: 'executionTime', labelFn: L('Roles', 'roleName') },
      ] },

    { tab: 'Events', entity: 'Events', pk: 'eventID',
      columns: [
        { key: 'eventID', label: 'ID' }, { key: 'eventTitle', label: 'Title' },
        { key: 'eventDescription', label: 'Description' },
        { key: 'sourceID', label: 'Source', lookup: ['Sources', 'sourceName'] },
        { key: 'eventCreatedAt', label: 'Created' },
      ],
      rollups: [
        { label: 'Tasks', childEntity: 'Tasks', childKey: 'eventID',
          columns: [{ key: 'taskName', label: 'Task' }, { key: 'roleName', label: 'Role' }, { key: 'executionTime', label: 'Hrs', num: true }] },
        { label: 'Tickets', childEntity: 'Tickets', childKey: 'eventID',
          columns: [{ key: 'ticketID', label: 'Ticket' }, { key: 'ticketStatus', label: 'Status', pill: statusPill }, { key: 'customerName', label: 'Customer' }] },
      ],
      filters: [
        { field: 'sourceID', label: 'Source', type: 'select', labelFn: L('Sources', 'sourceName') },
      ],
      charts: [
        { type: 'bar', title: 'Tasks by Event', rowsFrom: 'Tasks', groupBy: 'eventID', agg: 'count', labelFn: L('Events', 'eventTitle') },
        { type: 'bar', title: 'Tickets by Event', rowsFrom: 'Tickets', groupBy: 'eventID', agg: 'count', labelFn: L('Events', 'eventTitle') },
      ] },

    { tab: 'Processes', entity: 'Processes', pk: 'processID',
      columns: [
        { key: 'processID', label: 'ID' }, { key: 'processName', label: 'Name' },
        { key: 'processOwner', label: 'Owner', lookup: ['People', 'userName'] },
        { key: 'processDescription', label: 'Description' },
        { key: 'processStatus', label: 'Status', pill: statusPill },
        { key: 'processVersion', label: 'Version' },
      ],
      rollups: [
        { label: 'Activities', childEntity: 'Activities', childKey: 'processID',
          columns: [{ key: 'activityName', label: 'Activity' }, { key: 'execTime', label: 'Hrs', num: true }] },
        { label: 'Tasks', childEntity: 'Tasks', childKey: 'processID',
          columns: [{ key: 'taskName', label: 'Task' }, { key: 'roleName', label: 'Role' }] },
      ],
      filters: [{ field: 'processStatus', label: 'Status', type: 'select' }],
      charts: [
        { type: 'bar', title: 'Tasks by Process', rowsFrom: 'Tasks', groupBy: 'processID', agg: 'count', labelFn: L('Processes', 'processName') },
      ] },

    { tab: 'Activities', entity: 'Activities', pk: 'activityID',
      columns: [
        { key: 'activityID', label: 'ID' }, { key: 'activityName', label: 'Name' },
        { key: 'processID', label: 'Process', lookup: ['Processes', 'processName'] },
        { key: 'roleID', label: 'Role', lookup: ['Roles', 'roleName'] },
        { key: 'execTime', label: 'Exec. Hrs', num: true }, { key: 'procedureID', label: 'Procedure' },
      ],
      filters: [{ field: 'processID', label: 'Process', type: 'select', labelFn: L('Processes', 'processName') }] },

    { tab: 'Workflows', entity: 'Workflows', pk: 'workflowID',
      columns: [
        { key: 'workflowID', label: 'ID' },
        { key: 'processID', label: 'Process', lookup: ['Processes', 'processName'] },
        { key: 'activities', label: 'Activities' }, { key: 'parentStepID', label: 'Parent Step' },
      ],
      filters: [{ field: 'processID', label: 'Process', type: 'select', labelFn: L('Processes', 'processName') }] },

    { tab: 'Actions', entity: 'Actions', pk: 'actionID',
      columns: [
        { key: 'actionID', label: 'ID' }, { key: 'actionName', label: 'Name' },
        { key: 'actionDescription', label: 'Description' },
        { key: 'activityID', label: 'Activity', lookup: ['Activities', 'activityName'] },
        { key: 'riskID', label: 'Risk', lookup: ['Risks', 'riskTitle'] },
        { key: 'applicationID', label: 'ISO Application', lookup: ['actionApplication', 'applicationName'] },
      ] },

    { tab: 'Constraints', entity: 'Constraints', pk: 'constrainID',
      columns: [
        { key: 'constrainID', label: 'ID' }, { key: 'constrainName', label: 'Name' },
        { key: 'constrainDescription', label: 'Description' },
        { key: 'constrainTypeID', label: 'Type', lookup: ['Constraint Types', 'constrainTypeName'] },
        boolCol('isActive'), { key: 'regulatoryReference', label: 'Reference' },
      ],
      filters: [
        { field: 'constrainTypeID', label: 'Type', type: 'select', labelFn: L('Constraint Types', 'constrainTypeName') },
        { field: 'isActive', label: 'Active', type: 'select', labelFn: (v) => (v ? 'Active' : 'Inactive') },
      ] },

    { tab: 'Handouts', entity: 'Handouts', pk: 'handoutID',
      columns: [
        { key: 'handoutID', label: 'ID' }, { key: 'handoutName', label: 'Name' },
        { key: 'handoutDescription', label: 'Description' }, { key: 'type', label: 'Type', pill: () => 'neutral' },
        { key: 'channelID', label: 'Channel', lookup: ['Channels', 'channelName'] },
        { key: 'templateTitle', label: 'Template' },
      ],
      filters: [
        { field: 'type', label: 'Type', type: 'select' },
        { field: 'channelID', label: 'Channel', type: 'select', labelFn: L('Channels', 'channelName') },
      ],
      charts: [{ type: 'donut', title: 'Handouts by Type', groupBy: 'type', agg: 'count' }] },

    { tab: 'Channels', entity: 'Channels', pk: 'channelID',
      columns: [
        { key: 'channelID', label: 'ID' }, { key: 'channelName', label: 'Name' },
        { key: 'channelOwner', label: 'Owner' }, { key: 'channelStatus', label: 'Status', pill: statusPill },
      ],
      filters: [{ field: 'channelStatus', label: 'Status', type: 'select' }] },
  ] },

  // ============================ INVENTORY ============================
  { name: 'Inventory', icon: '📦', tabs: [
    { tab: 'Products', entity: 'Products', pk: 'productID',
      columns: [{ key: 'productID', label: 'ID' }, { key: 'productName', label: 'Name' }, boolCol('isActive')],
      filters: [{ field: 'isActive', label: 'Active', type: 'select', labelFn: (v) => (v ? 'Active' : 'Inactive') }] },

    { tab: 'Product Scopes', entity: 'Product Scopes', pk: 'productScopeID',
      columns: [
        { key: 'productScopeID', label: 'ID' }, { key: 'productScopeName', label: 'Name', mirror: true },
        { key: 'businessSegment', label: 'Segment' }, { key: 'scopeName', label: 'Scope' },
        boolCol('isActive'), { key: 'createdAt', label: 'Created' },
      ],
      filters: [
        { field: 'scopeID', label: 'Scope', type: 'select', labelFn: L('Scopes', 'scopeName') },
        { field: 'businessSegment', label: 'Segment', type: 'select' },
        { field: 'isActive', label: 'Active', type: 'select', labelFn: (v) => (v ? 'Active' : 'Inactive') },
      ],
      charts: [{ type: 'bar', title: 'Combinations by Scope', groupBy: 'scopeID', agg: 'count', labelFn: L('Scopes', 'scopeName') }] },

    { tab: 'Scopes', entity: 'Scopes', pk: 'scopeID',
      columns: [
        { key: 'scopeID', label: 'ID' }, { key: 'scopeName', label: 'Name' },
        { key: 'scopeOpportunity', label: 'Opportunity' }, boolCol('isActive'),
      ],
      charts: [{ type: 'bar', title: 'Product-Scope combos by Scope', rowsFrom: 'Product Scopes', groupBy: 'scopeID', agg: 'count', labelFn: L('Scopes', 'scopeName') }] },

    { tab: 'Product Groups', entity: 'Product Groups', pk: 'productGroupID',
      columns: [
        { key: 'productGroupID', label: 'ID' }, { key: 'businessSegment', label: 'Segment' },
        { key: 'products', label: 'Products' },
        { key: 'productClassID', label: 'Class', lookup: ['Product Class', 'voltageRate'] }, boolCol('isActive'),
      ],
      filters: [{ field: 'businessSegment', label: 'Segment', type: 'select' }] },

    { tab: 'Product Class', entity: 'Product Class', pk: 'productClassID',
      columns: [
        { key: 'productClassID', label: 'ID' }, { key: 'voltageRate', label: 'Voltage' },
        { key: 'powerRating', label: 'Power Rating' },
      ] },
  ] },

  // ============================ WORKLOAD ============================
  { name: 'Workload', icon: '🗂️', tabs: [
    { tab: 'Tickets', entity: 'Tickets', pk: 'ticketID',
      columns: [
        { key: 'ticketID', label: 'ID' }, { key: 'projectName', label: 'Project', mirror: true },
        { key: 'customerName', label: 'Customer' }, { key: 'eventTitle', label: 'Event', mirror: true },
        { key: 'ownerName', label: 'Owner' }, { key: 'ticketStatus', label: 'Status', pill: statusPill },
        { key: 'targetDate', label: 'Target' },
        { key: 'isEscalated', label: 'Escalated', accessor: (r) => (r.isEscalated ? 'Yes' : 'No'), pill: (v) => (v === 'Yes' ? 'danger' : 'neutral') },
      ],
      filters: [
        { field: 'ticketStatus', label: 'Status', type: 'select' },
        { field: 'projectID', label: 'Project', type: 'select', labelFn: L('Projects', 'projectName') },
        { field: 'customerName', label: 'Customer', type: 'select' },
        { field: 'eventID', label: 'Event', type: 'select', labelFn: L('Events', 'eventTitle') },
      ],
      charts: [
        { type: 'donut', title: 'Tickets by Status', groupBy: 'ticketStatus', agg: 'count' },
        { type: 'bar', title: 'Tickets by Customer', groupBy: 'customerName', agg: 'count' },
      ] },

    { tab: 'Projects', entity: 'Projects', pk: 'projectID',
      columns: [
        { key: 'projectID', label: 'ID' }, { key: 'projectName', label: 'Name' },
        { key: 'clientName', label: 'Client' }, { key: 'customerName', label: 'Customer' },
        { key: 'projectOwner', label: 'Owner', lookup: ['People', 'userName'] },
        { key: 'projectStatus', label: 'Status', pill: statusPill },
      ],
      rollups: [
        { label: 'Tickets', childEntity: 'Tickets', childKey: 'projectID',
          columns: [{ key: 'ticketID', label: 'Ticket' }, { key: 'ticketStatus', label: 'Status', pill: statusPill }, { key: 'eventTitle', label: 'Event' }] },
      ],
      filters: [
        { field: 'projectStatus', label: 'Status', type: 'select' },
        { field: 'customerName', label: 'Customer', type: 'select' },
      ],
      charts: [{ type: 'donut', title: 'Projects by Status', groupBy: 'projectStatus', agg: 'count' }] },

    { tab: 'Jobs', entity: 'Jobs', pk: 'jobID',
      columns: [
        { key: 'jobID', label: 'ID' }, { key: 'jobName', label: 'Job' },
        { key: 'projectName', label: 'Project' }, { key: 'ticketID', label: 'Ticket' },
        { key: 'roleName', label: 'Role', mirror: true }, { key: 'userName', label: 'Assignee' },
        { key: 'startDate', label: 'Start' }, { key: 'endDate', label: 'End' },
        { key: 'realExecutionTime', label: 'Real Hrs', num: true },
        { key: 'executionGap', label: 'Gap', num: true, mirror: true },
        { key: 'jobStatus', label: 'Status', pill: statusPill },
      ],
      filters: [
        { field: 'jobStatus', label: 'Status', type: 'select' },
        { field: 'projectName', label: 'Project', type: 'select' },
        { field: 'roleID', label: 'Role', type: 'select', labelFn: L('Roles', 'roleName') },
      ],
      charts: [
        { type: 'special', builder: 'jobExecVariance' },
        { type: 'line', title: 'Jobs Completed per Week', xField: 'realEndDate', xBucket: 'week', agg: 'count',
          rowFilter: (r) => r.jobStatus === 'Done' },
      ] },
  ] },

  // ============================ CONTROL (read-only) ============================
  { name: 'Control', icon: '📊', tabs: [
    { tab: 'Capacity', entity: 'Capacity', pk: 'capacityID', readonly: true,
      columns: [
        { key: 'roleName', label: 'Role' }, { key: 'functionName', label: 'Function' },
        { key: 'factoryID', label: 'Factory', lookup: ['Factories', 'factoryName'] },
        { key: 'periodStart', label: 'Period Start' },
        { key: 'availableHours', label: 'Available', num: true },
        { key: 'allocatedHours', label: 'Allocated', num: true },
        { key: 'utilization', label: 'Util %', num: true, accessor: (r) => `${r.utilization}%`,
          pill: (v, r) => (r.utilization > 90 ? 'danger' : r.utilization > 60 ? 'caution' : 'success') },
      ],
      filters: [
        { field: 'functionName', label: 'Function', type: 'select' },
        { field: 'factoryID', label: 'Factory', type: 'select', labelFn: L('Factories', 'factoryName') },
        { field: 'roleID', label: 'Role', type: 'select', labelFn: L('Roles', 'roleName') },
      ],
      charts: [
        { type: 'special', builder: 'capacityDualBar' },
        { type: 'special', builder: 'capacityUtil' },
      ] },

    { tab: 'Usage', entity: 'Usage', pk: 'usageID', readonly: true,
      columns: [
        { key: 'usageID', label: 'ID' }, { key: 'regionID', label: 'Region' },
        { key: 'departmentID', label: 'Dept' }, { key: 'functionName', label: 'Function' },
        { key: 'periodYear', label: 'Year', num: true }, { key: 'periodMonth', label: 'Month', num: true },
        { key: 'usedHours', label: 'Used', num: true }, { key: 'plannedHours', label: 'Planned', num: true },
      ],
      filters: [
        { field: 'regionID', label: 'Region', type: 'select' },
        { field: 'functionName', label: 'Function', type: 'select' },
      ],
      charts: [
        { type: 'line', title: 'Used Hours by Month', xField: (r) => `${r.periodYear}-M${String(r.periodMonth).padStart(2, '0')}`,
          seriesBy: 'functionName', agg: 'sum', valueField: 'usedHours' },
        { type: 'special', builder: 'usageHeatmap' },
      ] },

    { tab: 'Productivity', entity: 'Productivity', pk: 'productivityID', readonly: true,
      columns: [
        { key: 'teamName', label: 'Team' },
        { key: 'factoryID', label: 'Factory', lookup: ['Factories', 'factoryName'] },
        { key: 'periodYear', label: 'Year', num: true }, { key: 'periodMonth', label: 'Month', num: true },
        { key: 'output', label: 'Output', num: true }, { key: 'target', label: 'Target', num: true },
        { key: 'efficiency', label: 'Efficiency', num: true, accessor: (r) => (r.target ? `${Math.round((r.output / r.target) * 100)}%` : '—'),
          pill: (v, r) => { const e = r.target ? (r.output / r.target) * 100 : 0; return e < 80 ? 'danger' : e <= 100 ? 'caution' : 'success'; } },
      ],
      filters: [{ field: 'factoryID', label: 'Factory', type: 'select', labelFn: L('Factories', 'factoryName') }],
      charts: [
        { type: 'special', builder: 'productivityBars' },
        { type: 'special', builder: 'efficiencyBuckets' },
      ] },
  ] },

  // ============================ TALENT ============================
  { name: 'Talent', icon: '🎓', tabs: [
    { tab: 'People', entity: 'People', pk: 'userID',
      columns: [
        { key: 'userID', label: 'ID' }, { key: 'userName', label: 'Name' },
        { key: 'userEmail', label: 'Email' },
        { key: 'location', label: 'Location', lookup: ['Factories', 'factoryName'] },
        { key: 'functionID', label: 'Function', lookup: ['Functions', 'functionName'] },
        { key: 'roleID', label: 'Role', lookup: ['Roles', 'roleName'] },
        { key: 'squadID', label: 'Squad', lookup: ['Squads', 'squadName'] },
        { key: 'personalCost', label: 'Cost/hr', num: true }, boolCol('isActive'),
      ],
      filters: [
        { field: 'functionID', label: 'Function', type: 'select', labelFn: L('Functions', 'functionName') },
        { field: 'squadID', label: 'Squad', type: 'select', labelFn: L('Squads', 'squadName') },
        { field: 'location', label: 'Location', type: 'select', labelFn: L('Factories', 'factoryName') },
        { field: 'isActive', label: 'Active', type: 'select', labelFn: (v) => (v ? 'Active' : 'Inactive') },
      ],
      charts: [
        { type: 'donut', title: 'Headcount by Function', groupBy: 'functionID', agg: 'count', labelFn: L('Functions', 'functionName') },
        { type: 'bar', title: 'Headcount by Squad', groupBy: 'squadID', agg: 'count', labelFn: L('Squads', 'squadName') },
      ] },

    { tab: 'Roles', entity: 'Roles', pk: 'roleID',
      columns: [
        { key: 'roleID', label: 'ID' }, { key: 'roleName', label: 'Name' },
        { key: 'functionID', label: 'Function', lookup: ['Functions', 'functionName'] },
        { key: 'skillLevelID', label: 'Skill Level', lookup: ['Skill Levels', 'levelName'] },
        { key: 'graduationID', label: 'Graduation', lookup: ['Graduation', 'graduationName'] },
        { key: 'quantity', label: 'Headcount', num: true }, boolCol('isActive'),
      ],
      rollups: [
        { label: 'People', childEntity: 'People', childKey: 'roleID',
          columns: [{ key: 'userName', label: 'Name' }, { key: 'location', label: 'Location', lookup: ['Factories', 'factoryName'] }] },
      ],
      filters: [
        { field: 'functionID', label: 'Function', type: 'select', labelFn: L('Functions', 'functionName') },
        { field: 'skillLevelID', label: 'Skill Level', type: 'select', labelFn: L('Skill Levels', 'levelName') },
      ],
      charts: [
        { type: 'bar', title: 'Planned Headcount by Function', groupBy: 'functionID', agg: 'sum', valueField: 'quantity', labelFn: L('Functions', 'functionName') },
        { type: 'bar', title: 'Actual People by Role', rowsFrom: 'People', groupBy: 'roleID', agg: 'count', labelFn: L('Roles', 'roleName') },
      ] },

    { tab: 'Squads', entity: 'Squads', pk: 'squadID',
      columns: [
        { key: 'squadID', label: 'ID' }, { key: 'squadName', label: 'Name' },
        { key: 'squadType', label: 'Type', pill: (v) => (v === 'internal' ? 'info' : 'warning') },
        { key: 'managerName', label: 'Manager' }, { key: 'managerEmail', label: 'Email' },
      ],
      rollups: [
        { label: 'People', childEntity: 'People', childKey: 'squadID',
          columns: [{ key: 'userName', label: 'Name' }, { key: 'roleID', label: 'Role', lookup: ['Roles', 'roleName'] }] },
      ],
      filters: [{ field: 'squadType', label: 'Type', type: 'select' }] },

    { tab: 'Competence', entity: 'Competence', pk: 'competenceID',
      columns: [
        { key: 'competenceID', label: 'ID' },
        { key: 'roleID', label: 'Role', lookup: ['Roles', 'roleName'] },
        { key: 'scopeID', label: 'Scope', lookup: ['Scopes', 'scopeName'] },
        { key: 'productID', label: 'Product', lookup: ['Products', 'productName'] },
        { key: 'skillLevelID', label: 'Skill Level', lookup: ['Skill Levels', 'levelName'] },
        { key: 'isRequired', label: 'Required', accessor: (r) => (r.isRequired ? 'Required' : 'Optional'), pill: (v) => (v === 'Required' ? 'info' : 'neutral') },
      ],
      filters: [
        { field: 'roleID', label: 'Role', type: 'select', labelFn: L('Roles', 'roleName') },
        { field: 'scopeID', label: 'Scope', type: 'select', labelFn: L('Scopes', 'scopeName') },
      ] },

    { tab: 'Onboarding', entity: 'Onboarding', pk: 'onboardID',
      columns: [
        { key: 'onboardID', label: 'ID' },
        { key: 'userID', label: 'Person', lookup: ['People', 'userName'] },
        { key: 'competenceID', label: 'Competence' },
        { key: 'isCertified', label: 'Certified', accessor: (r) => (r.isCertified ? 'Certified' : 'Pending'), pill: (v) => (v === 'Certified' ? 'success' : 'caution') },
        { key: 'certifications', label: 'Certifications' },
      ],
      filters: [
        { field: 'isCertified', label: 'Certified', type: 'select', labelFn: (v) => (v ? 'Certified' : 'Pending') },
        { field: 'userID', label: 'Person', type: 'select', labelFn: L('People', 'userName') },
      ],
      charts: [
        { type: 'donut', title: 'Certification Status', groupBy: (r) => (r.isCertified ? 'Certified' : 'Pending'), agg: 'count' },
      ] },
  ] },
];
