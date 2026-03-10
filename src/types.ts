export interface StatusTransition {
  from: string | null;
  to: string | null;
  timestamp: string;
}

export interface MetricRecord {
  issueKey: string;
  summary: string;
  description: string | null;
  issueType: string;
  assignee: string | null;
  cycleTimeDays: number;
  startDate: string;
  endDate: string;
  startStatus: string;
  endStatus: string;
  statusTransitions: StatusTransition[];
  createdDate: string;
  resolvedDate: string | null;
}

export interface PipelineSummary {
  [key: string]: unknown;
}

export interface BugRecord {
  issueKey: string;
  summary: string;
  severity: string | null;
  issueType: string;
  assignee: string | null;
  createdDate: string;
  resolvedDate: string | null;
  timeToResolveDays: number | null;
}

export interface ETLResult {
  pipelineName: string;
  recordCount: number;
  summary: PipelineSummary;
  outputPath: string;
  startedAt: string;
  finishedAt: string;
}
