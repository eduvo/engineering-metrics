import { Pipeline } from "../base.js";
import { PipelineSummary } from "../../types.js";
import { GitHubPullRequest } from "../../shared/github-types.js";
import { PRRecord, GitHubPRsExtractOptions } from "./types.js";
import { extractGitHubPRs } from "./extract.js";
import { transformPRs } from "./transform.js";
import { summarizePRs } from "./summarize.js";
import { saveJson } from "../../loaders/json-loader.js";

export { summarizeAll } from "./summarize.js";
export type { PRsSummary } from "./summarize.js";

export class GitHubPRsPipeline extends Pipeline<GitHubPullRequest, PRRecord> {
  readonly name = "github-prs";

  constructor(
    private token: string,
    private options: GitHubPRsExtractOptions,
  ) {
    super();
  }

  async extract(): Promise<GitHubPullRequest[]> {
    return extractGitHubPRs(this.token, this.options);
  }

  transform(raw: GitHubPullRequest[]): PRRecord[] {
    return transformPRs(raw, this.options.repos);
  }

  summarize(records: PRRecord[]): PipelineSummary {
    return summarizePRs(records) as unknown as PipelineSummary;
  }

  async load(records: PRRecord[], summary: PipelineSummary): Promise<string> {
    return saveJson(this.name, { summary, records });
  }
}
