import { JiraConfig } from "../../config.js";
import { fetchJiraIssues, resolveFieldId } from "../../shared/jira-api.js";
import { JiraSearchResponse } from "../../shared/jira-types.js";
import { JiraExtractOptions } from "./types.js";

export async function extractJiraIssues(
  config: JiraConfig,
  options: JiraExtractOptions,
): Promise<{ issues: JiraSearchResponse["issues"]; estimationFieldId: string | null }> {
  const jql = buildJql(options);

  let estimationFieldId: string | null = null;
  let extraFields = "";
  if (options.estimationField) {
    estimationFieldId = await resolveFieldId(config, options.estimationField);
    extraFields = `,${estimationFieldId}`;
  }

  const issues = await fetchJiraIssues(config, {
    jql,
    fields: `summary,description,issuetype,assignee,created,resolutiondate${extraFields}`,
    expand: "changelog",
  });

  return { issues, estimationFieldId };
}

function buildJql(options: JiraExtractOptions): string {
  const parts = [
    `resolved >= "${options.since}"`,
  ];

  if (options.until) {
    parts.push(`resolved <= "${options.until}"`);
  }

  if (options.filter) {
    parts.push(`(${options.filter})`);
  }

  return parts.join(" AND ") + " ORDER BY resolved DESC";
}
