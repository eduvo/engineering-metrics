import { JiraConfig } from "../../config.js";
import { fetchJiraIssues, resolveFieldId } from "../../shared/jira-api.js";
import { JiraSearchResponse } from "../../shared/jira-types.js";
import { JiraBugsExtractOptions } from "./types.js";

export async function extractJiraBugs(
  config: JiraConfig,
  options: JiraBugsExtractOptions,
): Promise<{ issues: JiraSearchResponse["issues"]; severityFieldId: string }> {
  const severityFieldId = await resolveFieldId(config, options.severityFieldName);
  const jql = buildBugsJql(options);

  const issues = await fetchJiraIssues(config, {
    jql,
    fields: `summary,issuetype,assignee,created,resolutiondate,${severityFieldId}`,
  });

  return { issues, severityFieldId };
}

function buildBugsJql(options: JiraBugsExtractOptions): string {
  const parts = [
    `project = "${options.projectKey}"`,
    `created >= "${options.since}"`,
  ];

  if (options.until) {
    parts.push(`created <= "${options.until}"`);
  }

  parts.push(`(${options.customerBugsFilter})`);

  return parts.join(" AND ") + " ORDER BY created DESC";
}
