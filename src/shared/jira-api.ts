import axios from "axios";
import { JiraConfig } from "../config.js";
import { JiraSearchResponse } from "./jira-types.js";

const MAX_RESULTS = 100;

export interface JiraFetchOptions {
  jql: string;
  fields: string;
  expand?: string;
}

export async function resolveFieldId(
  config: JiraConfig,
  fieldName: string,
): Promise<string> {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const response = await axios.get<Array<{ id: string; name: string }>>(
    `${config.baseUrl}/rest/api/3/field`,
    { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } },
  );
  const field = response.data.find((f) => f.name === fieldName);
  if (!field) {
    throw new Error(`JIRA field "${fieldName}" not found. Check the severityFieldName in config.yaml.`);
  }
  return field.id;
}

export async function fetchJiraIssues(
  config: JiraConfig,
  options: JiraFetchOptions,
): Promise<JiraSearchResponse["issues"]> {
  console.log(`  JQL: ${options.jql}`);

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

  const allIssues: JiraSearchResponse["issues"] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const params: Record<string, string | number> = {
      jql: options.jql,
      maxResults: MAX_RESULTS,
      fields: options.fields,
    };
    if (options.expand) {
      params.expand = options.expand;
    }
    if (nextPageToken) {
      params.nextPageToken = nextPageToken;
    }

    const response = await axios.get<JiraSearchResponse>(
      `${config.baseUrl}/rest/api/3/search/jql`,
      {
        headers,
        params,
      },
    ).catch((err) => {
      if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
        throw new Error(`Cannot connect to JIRA at ${config.baseUrl}. Check your network and JIRA_BASE_URL.`);
      }
      if (err.response) {
        console.error(`  JIRA API error (${err.response.status}):`, JSON.stringify(err.response.data, null, 2));
      }
      throw err;
    });

    const data = response.data;
    allIssues.push(...data.issues);

    if (data.isLast || !data.nextPageToken) break;
    nextPageToken = data.nextPageToken;

    console.log(`  Fetched ${allIssues.length} issues so far...`);
  }

  return allIssues;
}
