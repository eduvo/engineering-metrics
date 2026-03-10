import { GitHubPullRequest } from "../../shared/github-types.js";

export interface GitHubPRsExtractOptions {
  repos: string[];
  since: string;
  until?: string;
}

export interface PRRecord {
  repo: string;
  number: number;
  title: string;
  author: string;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  timeToCloseDays: number | null;
  url: string;
}
