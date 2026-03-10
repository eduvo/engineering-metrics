import { Command } from "commander";
import { loadJiraConfig, loadProjectConfig, loadAllProjectConfigs } from "./config.js";
import { JiraCycleTimePipeline } from "./pipelines/jira-cycle-time/index.js";
import { ProjectCycleTimeSummary } from "./pipelines/jira-cycle-time/summarize.js";
import { JiraBugsPipeline, summarizeAll } from "./pipelines/jira-bugs/index.js";
import { saveJson } from "./loaders/json-loader.js";

const program = new Command();

program
  .name("metrics-agent")
  .description("ETL pipelines for engineering metrics")
  .version("1.0.0");

program
  .command("jira-cycle-time")
  .description("Extract JIRA issues and compute cycle time")
  .option("-p, --project <key>", "JIRA project key (e.g., MYPROJ). If omitted, runs for all configured projects.")
  .option("-s, --since <date>", "Start date for resolved issues (YYYY-MM-DD)", "2026-02-09")
  .option("-u, --until <date>", "End date for resolved issues (YYYY-MM-DD)")
  .action(async (opts: { project?: string; since: string; until?: string }) => {
    const config = loadJiraConfig();
    const allProjects = loadAllProjectConfigs();
    const projectKeys = opts.project
      ? [opts.project]
      : Object.entries(allProjects)
          .filter(([, c]) => c["jira-cycle-time"])
          .map(([key]) => key);

    if (projectKeys.length === 0) {
      console.log("No projects with jira-cycle-time config found in config.yaml.");
      return;
    }

    for (const projectKey of projectKeys) {
      const projectConfig = loadProjectConfig(projectKey);
      const cycleTimeConfig = projectConfig["jira-cycle-time"];

      if (!cycleTimeConfig) {
        if (opts.project) {
          throw new Error(`Project "${projectKey}" must have jira-cycle-time config in config.yaml.`);
        }
        continue;
      }

      console.log(`\n=== Project: ${projectKey} ===`);
      console.log(`Using statuses: "${cycleTimeConfig.startStatus}" → "${cycleTimeConfig.endStatus}"`);

      const pipeline = new JiraCycleTimePipeline(config, cycleTimeConfig, {
        projectKey,
        since: opts.since,
        until: opts.until,
        filter: cycleTimeConfig.filter,
      });

      const result = await pipeline.run();
      const summary = result.summary as unknown as ProjectCycleTimeSummary;

      console.log("\n--- Summary ---");
      console.log(`Pipeline:  ${result.pipelineName}`);
      console.log(`Project:   ${projectKey}`);
      console.log(`Records:   ${result.recordCount}`);

      if (summary.total.averageCycleTimeDays !== null) {
        console.log(`Avg Cycle: ${summary.total.averageCycleTimeDays} days`);
        console.log(`Med Cycle: ${summary.total.medianCycleTimeDays} days`);
      }

      console.log(`\n  Monthly:`);
      for (const [month, stats] of Object.entries(summary.monthly)) {
        console.log(`    ${month}: ${stats.ticketCount} tickets, avg ${stats.averageCycleTimeDays ?? "N/A"} days, median ${stats.medianCycleTimeDays ?? "N/A"} days`);
      }

      console.log(`\n  Quarterly:`);
      for (const [quarter, stats] of Object.entries(summary.quarterly)) {
        console.log(`    ${quarter}: ${stats.ticketCount} tickets, avg ${stats.averageCycleTimeDays ?? "N/A"} days, median ${stats.medianCycleTimeDays ?? "N/A"} days`);
      }

      console.log(`\nOutput:    ${result.outputPath}`);
      console.log(`Started:   ${result.startedAt}`);
      console.log(`Finished:  ${result.finishedAt}`);
    }
  });

program
  .command("jira-bugs")
  .description("Extract JIRA bugs matching a customer bugs filter and count them")
  .option("-p, --project <key>", "JIRA project key (e.g., MYPROJ). If omitted, runs for all configured projects.")
  .option("-s, --since <date>", "Start date for created issues (YYYY-MM-DD)", "2026-02-09")
  .option("-u, --until <date>", "End date for created issues (YYYY-MM-DD)")
  .action(async (opts: { project?: string; since: string; until?: string }) => {
    const config = loadJiraConfig();
    const allProjects = loadAllProjectConfigs();
    const projectKeys = opts.project
      ? [opts.project]
      : Object.entries(allProjects)
          .filter(([, c]) => c["jira-bugs"])
          .map(([key]) => key);

    if (projectKeys.length === 0) {
      console.log("No projects with jira-bugs config found in config.yaml.");
      return;
    }

    const projectRecords: Record<string, import("./types.js").BugRecord[]> = {};

    for (const projectKey of projectKeys) {
      const projectConfig = loadProjectConfig(projectKey);
      const bugsConfig = projectConfig["jira-bugs"];

      if (!bugsConfig) {
        if (opts.project) {
          throw new Error(`Project "${projectKey}" must have jira-bugs config in config.yaml.`);
        }
        continue;
      }

      console.log(`\n=== Project: ${projectKey} ===`);
      console.log(`Using customerBugsFilter: ${bugsConfig.customerBugsFilter}`);

      const pipeline = new JiraBugsPipeline(config, {
        projectKey,
        since: opts.since,
        until: opts.until,
        customerBugsFilter: bugsConfig.customerBugsFilter,
        severityFieldName: bugsConfig.severityFieldName,
      });

      console.log(`[jira-bugs] Extracting...`);
      const raw = await pipeline.extract();
      console.log(`[jira-bugs] Extracted ${raw.length} raw records`);

      console.log(`[jira-bugs] Transforming...`);
      const records = pipeline.transform(raw);
      console.log(`[jira-bugs] Transformed into ${records.length} bug records`);

      projectRecords[projectKey] = records;
    }

    const summary = summarizeAll(projectRecords);
    const allRecords = Object.values(projectRecords).flat();

    console.log(`\n[jira-bugs] Loading...`);
    const outputPath = await saveJson("jira-bugs", { summary, records: projectRecords });
    console.log(`[jira-bugs] Done -> ${outputPath}`);

    console.log("\n--- Summary ---");
    console.log(`Total Bugs:  ${allRecords.length}`);
    for (const [projectKey, projectSummary] of Object.entries(summary.projects)) {
      console.log(`\n  ${projectKey}:`);
      for (const [sev, stats] of Object.entries(projectSummary.total)) {
        console.log(`    ${sev}: ${stats.totalBugs} bugs, median TTR: ${stats.medianTimeToResolveDays ?? "N/A"} days`);
      }
    }
    console.log(`\n  Cross-project:`);
    for (const [sev, stats] of Object.entries(summary.crossProject.total)) {
      console.log(`    ${sev}: ${stats.totalBugs} bugs, median TTR: ${stats.medianTimeToResolveDays ?? "N/A"} days`);
    }
    for (const [month, sevStats] of Object.entries(summary.crossProject.monthly).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`    ${month}:`);
      for (const [sev, stats] of Object.entries(sevStats)) {
        console.log(`      ${sev}: ${stats.totalBugs} bugs, median TTR: ${stats.medianTimeToResolveDays ?? "N/A"} days`);
      }
    }
    console.log(`\nOutput:      ${outputPath}`);
  });

program.parse();
