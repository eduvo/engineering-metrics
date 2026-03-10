import { BugRecord } from "../../types.js";
import { JiraIssue } from "../../shared/jira-types.js";

export function transformBugs(issues: JiraIssue[], severityFieldId: string): BugRecord[] {
  return issues.map((issue) => {
    const created = new Date(issue.fields.created);
    const resolved = issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null;
    const timeToResolveDays = resolved
      ? parseFloat(((resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)).toFixed(2))
      : null;

    const severityField = (issue.fields as unknown as Record<string, unknown>)[severityFieldId] as { value: string } | null;
    const severity = severityField?.value?.substring(0, 2) ?? null;

    return {
      issueKey: issue.key,
      summary: issue.fields.summary,
      severity,
      issueType: issue.fields.issuetype.name,
      assignee: issue.fields.assignee?.displayName ?? null,
      createdDate: issue.fields.created,
      resolvedDate: issue.fields.resolutiondate,
      timeToResolveDays,
    };
  });
}
