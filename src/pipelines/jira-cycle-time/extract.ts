import { JiraConfig } from "../../config.js";
import { fetchJiraIssues } from "../../shared/jira-api.js";
import { JiraSearchResponse } from "../../shared/jira-types.js";
import { JiraExtractOptions } from "./types.js";

export async function extractJiraIssues(
  config: JiraConfig,
  options: JiraExtractOptions,
): Promise<JiraSearchResponse["issues"]> {
  const jql = buildJql(options);

  return fetchJiraIssues(config, {
    jql,
    fields: "summary,description,issuetype,assignee,created,resolutiondate",
    expand: "changelog",
  });
}

function buildJql(options: JiraExtractOptions): string {
  const parts = [
    `project = "${options.projectKey}"`,
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
