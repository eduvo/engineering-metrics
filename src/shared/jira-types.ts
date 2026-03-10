export interface JiraChangelogItem {
  field: string;
  fromString: string | null;
  toString: string | null;
}

export interface JiraChangelogEntry {
  id: string;
  created: string;
  items: JiraChangelogItem[];
}

export interface JiraIssueFields {
  summary: string;
  description: unknown;
  issuetype: { name: string };
  assignee: { displayName: string } | null;
  created: string;
  resolutiondate: string | null;
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
  changelog?: {
    histories: JiraChangelogEntry[];
  };
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}
