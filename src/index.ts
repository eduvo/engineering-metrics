import { Command } from "commander";
import { loadJiraConfig, loadTeamConfig, loadAllTeamConfigs, loadGitHubConfig, loadNewRelicConfig } from "./config.js";
import { JiraCycleTimePipeline, summarizeAll as summarizeAllCycleTime } from "./pipelines/jira-cycle-time/index.js";
import { JiraBugsPipeline, summarizeAll } from "./pipelines/jira-bugs/index.js";
import { GitHubPRsPipeline, summarizeAll as summarizeAllPRs } from "./pipelines/github-prs/index.js";
import { NewRelicErrorsPipeline, summarizeAll as summarizeAllErrors } from "./pipelines/newrelic-sla/index.js";
import { saveJson } from "./loaders/json-loader.js";
import { generateReport } from "./ui/generate-report.js";

type ETLOptions = { team?: string; since: string; until?: string };

async function runAllPipelines(opts: ETLOptions) {
  const pipelines = [
    { name: "jira-cycle-time", run: runJiraCycleTime },
    { name: "jira-bugs", run: runJiraBugs },
    { name: "github-prs", run: runGitHubPRs },
    { name: "newrelic-sla", run: runNewRelicSla },
  ];

  const results: { name: string; status: "success" | "failed"; error?: string }[] = [];

  for (const pipeline of pipelines) {
    try {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Running ${pipeline.name}...`);
      console.log("=".repeat(60));
      await pipeline.run(opts);
      results.push({ name: pipeline.name, status: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n[${pipeline.name}] FAILED: ${message}`);
      results.push({ name: pipeline.name, status: "failed", error: message });
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("All Pipelines — Summary");
  console.log("=".repeat(60));
  for (const r of results) {
    const icon = r.status === "success" ? "✓" : "✗";
    console.log(`  ${icon} ${r.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.log(`\n${failed.length} pipeline(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} pipelines completed successfully.`);
  }
}

const program = new Command();

program
  .name("metrics-agent")
  .description("ETL pipelines for engineering metrics")
  .version("1.0.0");

program
  .command("jira-cycle-time")
  .description("Extract JIRA issues and compute cycle time")
  .option("-t, --team <key>", "Team key (JIRA project key, e.g., MYPROJ). If omitted, runs for all configured teams.")
  .option("-s, --since <date>", "Start date for resolved issues (YYYY-MM-DD)", "2026-02-09")
  .option("-u, --until <date>", "End date for resolved issues (YYYY-MM-DD)")
  .action(runJiraCycleTime);

async function runJiraCycleTime(opts: ETLOptions) {
    const config = loadJiraConfig();
    const allTeams = loadAllTeamConfigs();
    const teamKeys = opts.team
      ? [opts.team]
      : Object.entries(allTeams)
          .filter(([, c]) => c["jira-cycle-time"])
          .map(([key]) => key);

    if (teamKeys.length === 0) {
      console.log("No teams with jira-cycle-time config found in config.yaml.");
      return;
    }

    const teamRecords: Record<string, import("./types.js").MetricRecord[]> = {};

    for (const teamKey of teamKeys) {
      const teamConfig = loadTeamConfig(teamKey);
      const cycleTimeConfig = teamConfig["jira-cycle-time"];

      if (!cycleTimeConfig) {
        if (opts.team) {
          throw new Error(`Team "${teamKey}" must have jira-cycle-time config in config.yaml.`);
        }
        continue;
      }

      console.log(`\n=== Team: ${teamKey} ===`);
      const endStatusLabel = Array.isArray(cycleTimeConfig.endStatus) ? cycleTimeConfig.endStatus.join(", ") : cycleTimeConfig.endStatus;
      console.log(`Using statuses: "${cycleTimeConfig.startStatus}" \u2192 "${endStatusLabel}"`);

      const pipeline = new JiraCycleTimePipeline(config, cycleTimeConfig, {
        since: opts.since,
        until: opts.until,
        filter: cycleTimeConfig.filter,
        estimationField: cycleTimeConfig.estimationField,
      });

      console.log(`[jira-cycle-time] Extracting...`);
      const raw = await pipeline.extract();
      console.log(`[jira-cycle-time] Extracted ${raw.length} raw records`);

      console.log(`[jira-cycle-time] Transforming...`);
      const records = pipeline.transform(raw);
      console.log(`[jira-cycle-time] Transformed into ${records.length} metric records`);

      teamRecords[teamKey] = records;
    }

    const summary = summarizeAllCycleTime(teamRecords);
    const allRecords = Object.values(teamRecords).flat();

    console.log(`\n[jira-cycle-time] Loading...`);
    const outputPath = await saveJson("jira-cycle-time", { summary, records: teamRecords, dateRange: { since: opts.since, until: opts.until ?? new Date().toISOString().slice(0, 10) } });
    console.log(`[jira-cycle-time] Done -> ${outputPath}`);

    console.log("\n--- Summary ---");
    console.log(`Total Records: ${allRecords.length}`);
    for (const [teamKey, teamSummary] of Object.entries(summary.teams)) {
      console.log(`\n  ${teamKey}:`);
      console.log(`    Total: ${teamSummary.total.ticketCount} tickets, avg ${teamSummary.total.averageCycleTimeDays ?? "N/A"} days, median ${teamSummary.total.medianCycleTimeDays ?? "N/A"} days`);
      console.log(`    Monthly:`);
      for (const [month, stats] of Object.entries(teamSummary.monthly)) {
        console.log(`      ${month}: ${stats.ticketCount} tickets, avg ${stats.averageCycleTimeDays ?? "N/A"} days, median ${stats.medianCycleTimeDays ?? "N/A"} days`);
      }
      console.log(`    Quarterly:`);
      for (const [quarter, stats] of Object.entries(teamSummary.quarterly)) {
        console.log(`      ${quarter}: ${stats.ticketCount} tickets, avg ${stats.averageCycleTimeDays ?? "N/A"} days, median ${stats.medianCycleTimeDays ?? "N/A"} days`);
      }
    }
    console.log(`\n  Cross-team:`);
    console.log(`    Total: ${summary.crossTeam.total.ticketCount} tickets, avg ${summary.crossTeam.total.averageCycleTimeDays ?? "N/A"} days, median ${summary.crossTeam.total.medianCycleTimeDays ?? "N/A"} days`);
    console.log(`    Monthly:`);
    for (const [month, stats] of Object.entries(summary.crossTeam.monthly)) {
      console.log(`      ${month}: ${stats.ticketCount} tickets, avg ${stats.averageCycleTimeDays ?? "N/A"} days, median ${stats.medianCycleTimeDays ?? "N/A"} days`);
    }
    console.log(`    Quarterly:`);
    for (const [quarter, stats] of Object.entries(summary.crossTeam.quarterly)) {
      console.log(`      ${quarter}: ${stats.ticketCount} tickets, avg ${stats.averageCycleTimeDays ?? "N/A"} days, median ${stats.medianCycleTimeDays ?? "N/A"} days`);
    }
    console.log(`\nOutput:      ${outputPath}`);
}

program
  .command("jira-bugs")
  .description("Extract JIRA bugs matching a customer bugs filter and count them")
  .option("-t, --team <key>", "Team key (JIRA project key, e.g., MYPROJ). If omitted, runs for all configured teams.")
  .option("-s, --since <date>", "Start date for created issues (YYYY-MM-DD)", "2026-02-09")
  .option("-u, --until <date>", "End date for created issues (YYYY-MM-DD)")
  .action(runJiraBugs);

async function runJiraBugs(opts: ETLOptions) {
    const config = loadJiraConfig();
    const allTeams = loadAllTeamConfigs();
    const teamKeys = opts.team
      ? [opts.team]
      : Object.entries(allTeams)
          .filter(([, c]) => c["jira-bugs"])
          .map(([key]) => key);

    if (teamKeys.length === 0) {
      console.log("No teams with jira-bugs config found in config.yaml.");
      return;
    }

    const teamRecords: Record<string, import("./types.js").BugRecord[]> = {};

    for (const teamKey of teamKeys) {
      const teamConfig = loadTeamConfig(teamKey);
      const bugsConfig = teamConfig["jira-bugs"];

      if (!bugsConfig) {
        if (opts.team) {
          throw new Error(`Team "${teamKey}" must have jira-bugs config in config.yaml.`);
        }
        continue;
      }

      console.log(`\n=== Team: ${teamKey} ===`);
      console.log(`Using customerBugsFilter: ${bugsConfig.customerBugsFilter}`);

      const pipeline = new JiraBugsPipeline(config, {
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

      teamRecords[teamKey] = records;
    }

    const summary = summarizeAll(teamRecords);
    const allRecords = Object.values(teamRecords).flat();

    console.log(`\n[jira-bugs] Loading...`);
    const outputPath = await saveJson("jira-bugs", { summary, records: teamRecords, dateRange: { since: opts.since, until: opts.until ?? new Date().toISOString().slice(0, 10) } });
    console.log(`[jira-bugs] Done -> ${outputPath}`);

    console.log("\n--- Summary ---");
    console.log(`Total Bugs:  ${allRecords.length}`);
    for (const [teamKey, teamSummary] of Object.entries(summary.teams)) {
      console.log(`\n  ${teamKey}:`);
      for (const [sev, stats] of Object.entries(teamSummary.total)) {
        console.log(`    ${sev}: ${stats.totalBugs} bugs, median TTR: ${stats.medianTimeToResolveDays ?? "N/A"} days, avg TTR: ${stats.averageTimeToResolveDays ?? "N/A"} days`);
      }
    }
    console.log(`\n  Cross-team:`);
    for (const [sev, stats] of Object.entries(summary.crossTeam.total)) {
      console.log(`    ${sev}: ${stats.totalBugs} bugs, median TTR: ${stats.medianTimeToResolveDays ?? "N/A"} days, avg TTR: ${stats.averageTimeToResolveDays ?? "N/A"} days`);
    }
    for (const [month, sevStats] of Object.entries(summary.crossTeam.monthly).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`    ${month}:`);
      for (const [sev, stats] of Object.entries(sevStats)) {
        console.log(`      ${sev}: ${stats.totalBugs} bugs, median TTR: ${stats.medianTimeToResolveDays ?? "N/A"} days, avg TTR: ${stats.averageTimeToResolveDays ?? "N/A"} days`);
      }
    }
    console.log(`\nOutput:      ${outputPath}`);
}

program
  .command("github-prs")
  .description("Extract GitHub PRs and compute PR stats (count, time-to-close, per-contributor)")
  .option("-t, --team <key>", "Team key (as in config.yaml). If omitted, runs for all configured teams.")
  .option("-s, --since <date>", "Start date for closed PRs (YYYY-MM-DD)", "2026-02-09")
  .option("-u, --until <date>", "End date for closed PRs (YYYY-MM-DD)")
  .action(runGitHubPRs);

async function runGitHubPRs(opts: ETLOptions) {
    const githubConfig = loadGitHubConfig();
    const allTeams = loadAllTeamConfigs();
    const teamKeys = opts.team
      ? [opts.team]
      : Object.entries(allTeams)
          .filter(([, c]) => c["github-prs"])
          .map(([key]) => key);

    if (teamKeys.length === 0) {
      console.log("No teams with github-prs config found in config.yaml.");
      return;
    }

    const teamRecords: Record<string, import("./pipelines/github-prs/types.js").PRRecord[]> = {};

    for (const teamKey of teamKeys) {
      const teamConfig = loadTeamConfig(teamKey);
      const prsConfig = teamConfig["github-prs"];

      if (!prsConfig) {
        if (opts.team) {
          throw new Error(`Team "${teamKey}" must have github-prs config in config.yaml.`);
        }
        continue;
      }

      console.log(`\n=== Team: ${teamKey} ===`);
      console.log(`Repos: ${prsConfig.repos.join(", ")}`);

      const pipeline = new GitHubPRsPipeline(githubConfig.token, {
        repos: prsConfig.repos,
        since: opts.since,
        until: opts.until,
      });

      console.log(`[github-prs] Extracting...`);
      const raw = await pipeline.extract();
      console.log(`[github-prs] Extracted ${raw.length} raw PRs`);

      console.log(`[github-prs] Transforming...`);
      const records = pipeline.transform(raw);
      console.log(`[github-prs] Transformed into ${records.length} PR records`);

      teamRecords[teamKey] = records;
    }

    const summary = summarizeAllPRs(teamRecords);
    const allRecords = Object.values(teamRecords).flat();

    console.log(`\n[github-prs] Loading...`);
    const outputPath = await saveJson("github-prs", { summary, records: teamRecords, dateRange: { since: opts.since, until: opts.until ?? new Date().toISOString().slice(0, 10) } });
    console.log(`[github-prs] Done -> ${outputPath}`);

    console.log("\n--- Summary ---");
    console.log(`Total PRs: ${allRecords.length}`);
    for (const [teamKey, teamSummary] of Object.entries(summary.teams)) {
      console.log(`\n  ${teamKey}:`);
      console.log(`    Total: ${teamSummary.total.prCount} PRs, avg close ${teamSummary.total.averageTimeToCloseDays ?? "N/A"} days, median close ${teamSummary.total.medianTimeToCloseDays ?? "N/A"} days`);
      console.log(`    Monthly:`);
      for (const [month, stats] of Object.entries(teamSummary.monthly)) {
        console.log(`      ${month}: ${stats.prCount} PRs, avg close ${stats.averageTimeToCloseDays ?? "N/A"} days, median close ${stats.medianTimeToCloseDays ?? "N/A"} days`);
      }
      console.log(`    Quarterly:`);
      for (const [quarter, stats] of Object.entries(teamSummary.quarterly)) {
        console.log(`      ${quarter}: ${stats.prCount} PRs, avg close ${stats.averageTimeToCloseDays ?? "N/A"} days, median close ${stats.medianTimeToCloseDays ?? "N/A"} days`);
      }
    }
    console.log(`\n  Cross-team:`);
    console.log(`    Total: ${summary.crossTeam.total.prCount} PRs, avg close ${summary.crossTeam.total.averageTimeToCloseDays ?? "N/A"} days, median close ${summary.crossTeam.total.medianTimeToCloseDays ?? "N/A"} days`);
    console.log(`    Monthly:`);
    for (const [month, stats] of Object.entries(summary.crossTeam.monthly)) {
      console.log(`      ${month}: ${stats.prCount} PRs, avg close ${stats.averageTimeToCloseDays ?? "N/A"} days, median close ${stats.medianTimeToCloseDays ?? "N/A"} days`);
    }
    console.log(`    Quarterly:`);
    for (const [quarter, stats] of Object.entries(summary.crossTeam.quarterly)) {
      console.log(`      ${quarter}: ${stats.prCount} PRs, avg close ${stats.averageTimeToCloseDays ?? "N/A"} days, median close ${stats.medianTimeToCloseDays ?? "N/A"} days`);
    }
    console.log(`\nOutput:      ${outputPath}`);
}

program
  .command("newrelic-sla")
  .description("Extract APM SLA and Browser error rates from New Relic")
  .option("-t, --team <key>", "Team key (as in config.yaml). If omitted, runs for all configured teams.")
  .option("-s, --since <date>", "Start date (YYYY-MM-DD)", "2026-02-09")
  .option("-u, --until <date>", "End date (YYYY-MM-DD)")
  .action(runNewRelicSla);

async function runNewRelicSla(opts: ETLOptions) {
    const nrConfig = loadNewRelicConfig();
    const allTeams = loadAllTeamConfigs();
    const teamKeys = opts.team
      ? [opts.team]
      : Object.entries(allTeams)
          .filter(([, c]) => c["newrelic-sla"])
          .map(([key]) => key);

    if (teamKeys.length === 0) {
      console.log("No teams with newrelic-sla config found in config.yaml.");
      return;
    }

    const teamRecords: Record<string, import("./pipelines/newrelic-sla/types.js").NewRelicRecord[]> = {};

    for (const teamKey of teamKeys) {
      const teamConfig = loadTeamConfig(teamKey);
      const errorsConfig = teamConfig["newrelic-sla"];

      if (!errorsConfig) {
        if (opts.team) {
          throw new Error(`Team "${teamKey}" must have newrelic-sla config in config.yaml.`);
        }
        continue;
      }

      console.log(`\n=== Team: ${teamKey} ===`);
      console.log(`Apps: ${errorsConfig.apps.join(", ")}`);

      const pipeline = new NewRelicErrorsPipeline(nrConfig, {
        apps: errorsConfig.apps,
        since: opts.since,
        until: opts.until,
      });

      console.log(`[newrelic-sla] Extracting...`);
      const raw = await pipeline.extract();
      console.log(`[newrelic-sla] Extracted ${raw.length} raw records`);

      console.log(`[newrelic-sla] Transforming...`);
      const records = pipeline.transform(raw);
      console.log(`[newrelic-sla] Transformed into ${records.length} records`);

      teamRecords[teamKey] = records;
    }

    const summary = summarizeAllErrors(teamRecords);
    const allRecords = Object.values(teamRecords).flat();

    console.log(`\n[newrelic-sla] Loading...`);
    const outputPath = await saveJson("newrelic-sla", { summary, records: teamRecords, dateRange: { since: opts.since, until: opts.until ?? new Date().toISOString().slice(0, 10) } });
    console.log(`[newrelic-sla] Done -> ${outputPath}`);

    console.log("\n--- Summary ---");
    console.log(`Total Records: ${allRecords.length}`);
    for (const [teamKey, teamSummary] of Object.entries(summary.teams)) {
      console.log(`\n  ${teamKey}:`);
      console.log(`    SLA:`);
      for (const [month, stats] of Object.entries(teamSummary.apmSla.monthly)) {
        console.log(`      ${month}:`);
        for (const [app, appStats] of Object.entries(stats.byApp)) {
          console.log(`        ${app}: apdex ${appStats.apdex ?? "N/A"}, satisfied ${appStats.satisfiedPercent ?? "N/A"}%, error ${appStats.errorRatePercent ?? "N/A"}%, resp ${appStats.responseTimeMs ?? "N/A"}ms, tput ${appStats.throughputRpm ?? "N/A"} rpm`);
        }
      }
      const t = teamSummary.apmSla.total;
      console.log(`      Average: apdex ${t.averageApdex ?? "N/A"}, satisfied ${t.averageSatisfiedPercent ?? "N/A"}%, error ${t.averageErrorRatePercent ?? "N/A"}%, resp ${t.averageResponseTimeMs ?? "N/A"}ms, tput ${t.averageThroughputRpm ?? "N/A"} rpm`);
      console.log(`    Browser Errors - Last 7 days:`);
      for (const [app, rate] of Object.entries(teamSummary.browserErrors.byApp)) {
        console.log(`        ${app}: ${rate ?? "N/A"}%`);
      }
    }
    console.log(`\n  Cross-team:`);
    console.log(`    Weighted Average error rate: ${summary.crossTeam.apmSla.total.averageErrorRatePercent ?? "N/A"}%`);
    console.log(`    Weighted Average satisfied: ${summary.crossTeam.apmSla.total.averageSatisfiedPercent ?? "N/A"}%`);
    console.log(`\nOutput:      ${outputPath}`);
}

program
  .command("all")
  .description("Run all ETL pipelines sequentially")
  .option("-t, --team <key>", "Team key. If omitted, runs for all configured teams.")
  .option("-s, --since <date>", "Start date (YYYY-MM-DD)", "2026-02-09")
  .option("-u, --until <date>", "End date (YYYY-MM-DD)")
  .action(async (opts: ETLOptions) => {
    await runAllPipelines(opts);

    // Generate dashboard report
    try {
      console.log(`\n${"=".repeat(60)}`);
      console.log("Generating dashboard report...");
      console.log("=".repeat(60));
      const reportPath = await generateReport();
      console.log(`\nDashboard: ${reportPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n[report] FAILED: ${message}`);
    }
  });

program
  .command("report")
  .description("Run all ETL pipelines, then generate an HTML dashboard")
  .option("-t, --team <key>", "Team key. If omitted, runs for all configured teams.")
  .option("-s, --since <date>", "Start date (YYYY-MM-DD)", "2026-02-09")
  .option("-u, --until <date>", "End date (YYYY-MM-DD)")
  .option("--skip-etl", "Skip running ETL pipelines and generate the report from the latest existing data files")
  .action(async (opts: ETLOptions & { skipEtl?: boolean }) => {
    if (!opts.skipEtl) {
      await runAllPipelines(opts);
    } else {
      console.log("Skipping ETL pipelines (--skip-etl). Using latest data files.");
    }

    // Generate dashboard report
    try {
      console.log(`\n${"=".repeat(60)}`);
      console.log("Generating dashboard report...");
      console.log("=".repeat(60));
      const reportPath = await generateReport();
      console.log(`\nOpen in browser: file://${reportPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n[report] FAILED: ${message}`);
    }
  });

program.parse();
