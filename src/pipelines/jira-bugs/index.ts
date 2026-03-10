import { Pipeline } from "../base.js";
import { BugRecord, PipelineSummary } from "../../types.js";
import { JiraConfig } from "../../config.js";
import { JiraIssue } from "../../shared/jira-types.js";
import { JiraBugsExtractOptions } from "./types.js";
import { extractJiraBugs } from "./extract.js";
import { transformBugs } from "./transform.js";
import { summarizeTeam } from "./summarize.js";
import { saveJson } from "../../loaders/json-loader.js";

export { summarizeAll } from "./summarize.js";
export type { BugsSummary } from "./summarize.js";

export class JiraBugsPipeline extends Pipeline<JiraIssue, BugRecord> {
  readonly name = "jira-bugs";
  private severityFieldId = "";

  constructor(
    private config: JiraConfig,
    private options: JiraBugsExtractOptions,
  ) {
    super();
  }

  async extract(): Promise<JiraIssue[]> {
    const result = await extractJiraBugs(this.config, this.options);
    this.severityFieldId = result.severityFieldId;
    return result.issues;
  }

  transform(raw: JiraIssue[]): BugRecord[] {
    return transformBugs(raw, this.severityFieldId);
  }

  summarize(records: BugRecord[]): PipelineSummary {
    return summarizeTeam(records) as unknown as PipelineSummary;
  }

  async load(records: BugRecord[], summary: PipelineSummary): Promise<string> {
    return saveJson(this.name, { summary, records });
  }
}
