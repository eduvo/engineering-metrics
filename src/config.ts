import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

dotenv.config();

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface CycleTimeConfig {
  startStatus: string;
  endStatus: string;
  filter?: string;
}

export interface BugsConfig {
  customerBugsFilter: string;
  severityFieldName: string;
}

export interface TeamConfig {
  "jira-cycle-time"?: CycleTimeConfig;
  "jira-bugs"?: BugsConfig;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadJiraConfig(): JiraConfig {
  return {
    baseUrl: requireEnv("JIRA_BASE_URL").replace(/\/+$/, ""),
    email: requireEnv("JIRA_EMAIL"),
    apiToken: requireEnv("JIRA_API_TOKEN"),
  };
}

function loadConfig(): Record<string, TeamConfig> {
  const configPath = path.resolve(process.cwd(), "config.yaml");

  try {
    return parseYaml(readFileSync(configPath, "utf-8"));
  } catch {
    throw new Error(`Missing or invalid config.yaml. Create it with per-team pipeline configs.`);
  }
}

export function loadTeamConfig(teamKey: string): TeamConfig {
  const teams = loadConfig();
  const config = teams[teamKey];
  if (!config) {
    throw new Error(
      `No config found for team "${teamKey}" in config.yaml. Available: ${Object.keys(teams).join(", ")}`,
    );
  }

  return config;
}

export function loadAllTeamConfigs(): Record<string, TeamConfig> {
  return loadConfig();
}
