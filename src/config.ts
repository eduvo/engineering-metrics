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

export interface ProjectConfig {
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

function loadConfig(): Record<string, ProjectConfig> {
  const configPath = path.resolve(process.cwd(), "config.yaml");

  try {
    return parseYaml(readFileSync(configPath, "utf-8"));
  } catch {
    throw new Error(`Missing or invalid config.yaml. Create it with per-project pipeline configs.`);
  }
}

export function loadProjectConfig(projectKey: string): ProjectConfig {
  const projects = loadConfig();
  const config = projects[projectKey];
  if (!config) {
    throw new Error(
      `No config found for project "${projectKey}" in config.yaml. Available: ${Object.keys(projects).join(", ")}`,
    );
  }

  return config;
}

export function loadAllProjectConfigs(): Record<string, ProjectConfig> {
  return loadConfig();
}
