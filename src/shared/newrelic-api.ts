import axios from "axios";
import { NewRelicConfig } from "../config.js";
import { NerdGraphResponse, NrqlResult, NewRelicApplication, MetricDataResponse, MetricDataResult } from "./newrelic-types.js";

export async function executeNrql(
  config: NewRelicConfig,
  nrql: string,
): Promise<NrqlResult[]> {
  const query = `{
    actor {
      account(id: ${config.accountId}) {
        nrql(query: ${JSON.stringify(nrql)}) {
          results
        }
      }
    }
  }`;

  const response = await axios.post<NerdGraphResponse>(
    config.apiUrl,
    { query },
    {
      headers: {
        "Content-Type": "application/json",
        "API-Key": config.apiKey,
      },
    },
  ).catch((err) => {
    if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      throw new Error(`Cannot connect to New Relic NerdGraph API at ${config.apiUrl}. Check your network.`);
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error("New Relic authentication failed. Check your NEWRELIC_API_KEY.");
    }
    throw err;
  });

  if (response.data.errors?.length) {
    throw new Error(
      `NerdGraph query failed: ${response.data.errors.map((e) => e.message).join("; ")}`,
    );
  }

  if (!response.data.data) {
    throw new Error("NerdGraph returned no data.");
  }

  return response.data.data.actor.account.nrql.results;
}

export async function lookupApplicationId(
  config: NewRelicConfig,
  appName: string,
): Promise<number> {
  const response = await axios.get<{ applications: NewRelicApplication[] }>(
    `${config.restApiUrl}/v2/applications.json`,
    {
      headers: { "Api-Key": config.apiKey },
      params: { "filter[name]": appName },
    },
  ).catch((err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error("New Relic REST API authentication failed. Check your NEWRELIC_API_KEY.");
    }
    throw err;
  });

  const app = response.data.applications.find((a) => a.name === appName);
  if (!app) {
    throw new Error(`New Relic application "${appName}" not found. Check the app name in config.yaml.`);
  }
  return app.id;
}

export async function fetchSlaMetrics(
  config: NewRelicConfig,
  appId: number,
  from: string,
  to: string,
): Promise<MetricDataResult[]> {
  const response = await axios.get<MetricDataResponse>(
    `${config.restApiUrl}/v2/applications/${appId}/metrics/data.json`,
    {
      headers: { "Api-Key": config.apiKey },
      params: {
        "names[]": ["Apdex", "HttpDispatcher", "Errors/all"],
        from,
        to,
        summarize: true,
      },
      paramsSerializer: (params) => {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(params)) {
          if (Array.isArray(value)) {
            for (const v of value) {
              parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
            }
          } else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
          }
        }
        return parts.join("&");
      },
    },
  ).catch((err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error("New Relic REST API authentication failed. Check your NEWRELIC_API_KEY.");
    }
    if (err.response?.status === 404) {
      throw new Error(`New Relic application ID ${appId} not found.`);
    }
    throw err;
  });

  return response.data.metric_data.metrics;
}
