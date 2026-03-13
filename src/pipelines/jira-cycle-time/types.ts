export type {
  JiraChangelogItem,
  JiraChangelogEntry,
  JiraIssueFields,
  JiraSearchResponse,
} from "../../shared/jira-types.js";

import type { JiraIssue as SharedJiraIssue } from "../../shared/jira-types.js";

// Cycle-time pipeline requires changelog (non-optional)
export interface JiraIssue extends Omit<SharedJiraIssue, "changelog"> {
  changelog: NonNullable<SharedJiraIssue["changelog"]>;
}

export interface JiraExtractOptions {
  since: string;
  until?: string;
  filter?: string;
  estimationField?: string;
}
