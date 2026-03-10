import { Pipeline } from "../base.js";
import { MetricRecord, PipelineSummary } from "../../types.js";
import { JiraConfig, CycleTimeConfig } from "../../config.js";
import { JiraIssue, JiraExtractOptions } from "./types.js";
import { extractJiraIssues } from "./extract.js";
import { computeCycleTime } from "./transform.js";
import { summarizeCycleTime } from "./summarize.js";
import { saveJson } from "../../loaders/json-loader.js";

export { summarizeAll } from "./summarize.js";
export type { CycleTimeSummary } from "./summarize.js";

export class JiraCycleTimePipeline extends Pipeline<JiraIssue, MetricRecord> {
  readonly name = "jira-cycle-time";

  constructor(
    private config: JiraConfig,
    private cycleTimeConfig: CycleTimeConfig,
    private options: JiraExtractOptions,
  ) {
    super();
  }

  async extract(): Promise<JiraIssue[]> {
    return extractJiraIssues(this.config, this.options) as Promise<JiraIssue[]>;
  }

  transform(raw: JiraIssue[]): MetricRecord[] {
    return computeCycleTime(raw, this.cycleTimeConfig.startStatus, this.cycleTimeConfig.endStatus);
  }

  summarize(records: MetricRecord[]): PipelineSummary {
    return summarizeCycleTime(records) as unknown as PipelineSummary;
  }

  async load(records: MetricRecord[], summary: PipelineSummary): Promise<string> {
    return saveJson(this.name, { summary, records });
  }
}
