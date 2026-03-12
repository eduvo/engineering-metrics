import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { generateHTML, DataFiles } from "./html-template.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const REPORT_DIR = path.resolve(process.cwd(), "reports");

type PipelineName = keyof DataFiles;

const PIPELINE_NAMES: PipelineName[] = [
  "jira-cycle-time",
  "jira-bugs",
  "github-prs",
  "newrelic-sla",
];

async function findLatestFile(prefix: string): Promise<string | null> {
  const files = await readdir(DATA_DIR);
  const matching = files
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .reverse();
  return matching.length > 0 ? path.join(DATA_DIR, matching[0]) : null;
}

async function loadLatestData(): Promise<DataFiles> {
  const data: DataFiles = {};
  for (const name of PIPELINE_NAMES) {
    const filePath = await findLatestFile(name);
    if (filePath) {
      const content = await readFile(filePath, "utf-8");
      data[name] = JSON.parse(content);
    }
  }
  return data;
}

export async function generateReport(): Promise<string> {
  console.log("[report] Loading latest data files...");
  const data = await loadLatestData();

  const loaded = PIPELINE_NAMES.filter((n) => data[n]);
  const missing = PIPELINE_NAMES.filter((n) => !data[n]);

  if (loaded.length === 0) {
    throw new Error("No data files found in data/ directory. Run ETL pipelines first.");
  }

  console.log(`[report] Found data for: ${loaded.join(", ")}`);
  if (missing.length > 0) {
    console.log(`[report] Missing data for: ${missing.join(", ")}`);
  }

  const generatedAt = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  const html = generateHTML(data, generatedAt);

  await mkdir(REPORT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `dashboard-${timestamp}.html`;
  const filePath = path.join(REPORT_DIR, filename);

  await writeFile(filePath, html, "utf-8");
  console.log(`[report] Dashboard generated -> ${filePath}`);

  return filePath;
}
