import { MetricRecord, StatusTransition } from "../../types.js";
import { JiraIssue } from "./types.js";

export function computeCycleTime(
  issues: JiraIssue[],
  startStatus: string,
  endStatus: string,
): MetricRecord[] {
  const records: MetricRecord[] = [];
  const startUpper = startStatus.toUpperCase();
  const endUpper = endStatus.toUpperCase();

  for (const issue of issues) {
    const startDate = findFirstTransitionTo(issue, startUpper);
    const endDate = findFirstTransitionTo(issue, endUpper);

    let cycleTimeDays: number | null = null;
    if (startDate && endDate && endDate > startDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      cycleTimeDays = parseFloat((diffMs / (1000 * 60 * 60 * 24)).toFixed(2));
    }

    let leadTimeDays: number | null = null;
    if (issue.fields.created && issue.fields.resolutiondate) {
      const createdMs = new Date(issue.fields.created).getTime();
      const resolvedMs = new Date(issue.fields.resolutiondate).getTime();
      if (resolvedMs > createdMs) {
        leadTimeDays = parseFloat(((resolvedMs - createdMs) / (1000 * 60 * 60 * 24)).toFixed(2));
      }
    }

    if (cycleTimeDays === null && leadTimeDays === null) continue;

    records.push({
      issueKey: issue.key,
      summary: issue.fields.summary,
      description: extractPlainText(issue.fields.description),
      issueType: issue.fields.issuetype.name,
      assignee: issue.fields.assignee?.displayName ?? null,
      cycleTimeDays,
      leadTimeDays,
      startDate: startDate?.toISOString() ?? null,
      endDate: endDate?.toISOString() ?? null,
      startStatus,
      endStatus,
      statusTransitions: extractStatusTransitions(issue),
      createdDate: issue.fields.created,
      resolvedDate: issue.fields.resolutiondate,
    });
  }

  return records;
}

function findFirstTransitionTo(issue: JiraIssue, statusUpper: string): Date | null {
  for (const history of issue.changelog.histories) {
    for (const item of history.items) {
      if (
        item.field === "status" &&
        item.toString?.toUpperCase() === statusUpper
      ) {
        return new Date(history.created);
      }
    }
  }
  return null;
}

function extractStatusTransitions(issue: JiraIssue): StatusTransition[] {
  const transitions: StatusTransition[] = [];
  for (const history of issue.changelog.histories) {
    for (const item of history.items) {
      if (item.field === "status") {
        transitions.push({
          from: item.fromString,
          to: item.toString,
          timestamp: history.created,
        });
      }
    }
  }
  return transitions;
}

function extractPlainText(adf: unknown): string | null {
  if (!adf || typeof adf !== "object") return null;
  const doc = adf as { content?: unknown[] };
  if (!Array.isArray(doc.content)) return null;

  const texts: string[] = [];
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as { type?: string; text?: string; content?: unknown[] };
      if (n.type === "text" && typeof n.text === "string") {
        texts.push(n.text);
      }
      if (Array.isArray(n.content)) {
        walk(n.content);
      }
    }
  };
  walk(doc.content);
  return texts.length > 0 ? texts.join("") : null;
}
