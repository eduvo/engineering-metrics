export interface DataFiles {
  "jira-cycle-time"?: unknown;
  "jira-bugs"?: unknown;
  "github-prs"?: unknown;
  "newrelic-sla"?: unknown;
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return "N/A";
  return Number(n).toFixed(decimals);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]/g, "_");
}

export function generateHTML(data: DataFiles, generatedAt: string): string {
  const cycleTime = data["jira-cycle-time"] as any;
  const bugs = data["jira-bugs"] as any;
  const prs = data["github-prs"] as any;
  const sla = data["newrelic-sla"] as any;

  const allTeams = new Set<string>();
  for (const d of [cycleTime, bugs, prs, sla]) {
    if (d?.summary?.teams) {
      Object.keys(d.summary.teams).forEach((t) => allTeams.add(t));
    }
  }
  const teams = Array.from(allTeams).sort();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Engineering Metrics Dashboard</title>
<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #232733;
    --border: #2e3344;
    --text: #e1e4ed;
    --text-muted: #8b8fa3;
    --accent: #6c8aff;
    --green: #34d399;
    --yellow: #fbbf24;
    --red: #f87171;
    --orange: #fb923c;
    --purple: #a78bfa;
    --cyan: #22d3ee;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    padding: 24px;
  }
  .header {
    text-align: center;
    padding: 32px 0 24px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 32px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  .header .subtitle {
    color: var(--text-muted);
    font-size: 14px;
  }
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
    overflow-x: auto;
  }
  .tab {
    padding: 10px 20px;
    cursor: pointer;
    border: none;
    background: none;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .tab:hover { color: var(--text); }
  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }
  .card h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .metric-value {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -1px;
  }
  .metric-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .metric-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .metric-row:last-child { border-bottom: none; }
  .metric-row .label { color: var(--text-muted); font-size: 13px; }
  .metric-row .value { font-weight: 600; font-size: 14px; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    padding: 10px 12px;
    background: var(--surface2);
    color: var(--text-muted);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  tr:hover td { background: var(--surface2); }
  .section {
    margin-bottom: 32px;
  }
  .section-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-title .icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .badge-green { background: rgba(52,211,153,0.15); color: var(--green); }
  .badge-yellow { background: rgba(251,191,36,0.15); color: var(--yellow); }
  .badge-red { background: rgba(248,113,113,0.15); color: var(--red); }
  .badge-blue { background: rgba(108,138,255,0.15); color: var(--accent); }
  .bar-container {
    width: 100%;
    height: 8px;
    background: var(--surface2);
    border-radius: 4px;
    overflow: hidden;
  }
  .bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.6s ease;
  }
  .bar-green { background: var(--green); }
  .bar-yellow { background: var(--yellow); }
  .bar-red { background: var(--red); }
  .bar-blue { background: var(--accent); }
  .mini-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .mini-stat {
    padding: 12px;
    background: var(--surface2);
    border-radius: 8px;
  }
  .mini-stat .val {
    font-size: 20px;
    font-weight: 700;
  }
  .mini-stat .lbl {
    font-size: 11px;
    color: var(--text-muted);
  }
  .no-data {
    color: var(--text-muted);
    font-style: italic;
    padding: 24px;
    text-align: center;
  }
  .team-header {
    font-size: 15px;
    font-weight: 600;
    color: var(--accent);
    margin: 24px 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .team-header:first-child { margin-top: 0; }
  @media (max-width: 768px) {
    body { padding: 12px; }
    .grid { grid-template-columns: 1fr; }
    .tabs { gap: 0; }
    .tab { padding: 8px 12px; font-size: 12px; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>Engineering Metrics Dashboard</h1>
  <div class="subtitle">Generated ${escapeHtml(generatedAt)}</div>
</div>

<div class="tabs">
  <button class="tab active" onclick="switchTab('overview')">Overview</button>
  ${teams.map((t) => `<button class="tab" onclick="switchTab('team-${escapeAttr(t)}')">${escapeHtml(t)}</button>`).join("\n  ")}
</div>

<div id="tab-overview" class="tab-content active">
  ${renderOverview(cycleTime, bugs, prs, sla)}
</div>

${teams
  .map(
    (team) => `<div id="tab-team-${escapeAttr(team)}" class="tab-content">
  ${renderTeam(team, cycleTime, bugs, prs, sla)}
</div>`
  )
  .join("\n")}

<script>
function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  event.target.classList.add('active');
}
</script>

</body>
</html>`;
}

function renderOverview(cycleTime: any, bugs: any, prs: any, sla: any): string {
  const sections: string[] = [];

  sections.push(renderCrossTeamKPIs(cycleTime, bugs, prs, sla));

  if (cycleTime?.summary?.crossTeam?.monthly) {
    sections.push(renderMonthlyTrendSection(
      "Cycle Time Trend (Cross-Team)",
      "&#9201;",
      cycleTime.summary.crossTeam.monthly,
      (stats: any) => [
        { label: "Tickets", value: stats.ticketCount },
        { label: "Median", value: `${fmt(stats.medianCycleTimeDays)}d` },
        { label: "Average", value: `${fmt(stats.averageCycleTimeDays)}d` },
      ]
    ));
  }

  if (prs?.summary?.crossTeam?.monthly) {
    sections.push(renderMonthlyTrendSection(
      "PR Throughput Trend (Cross-Team)",
      "&#128295;",
      prs.summary.crossTeam.monthly,
      (stats: any) => [
        { label: "PRs", value: stats.prCount },
        { label: "Median Close", value: `${fmt(stats.medianTimeToCloseDays)}d` },
        { label: "Avg Close", value: `${fmt(stats.averageTimeToCloseDays)}d` },
      ]
    ));
  }

  if (bugs?.summary?.crossTeam?.monthly) {
    sections.push(renderBugsTrendSection("Bug Trend (Cross-Team)", bugs.summary.crossTeam.monthly));
  }

  if (sla?.summary?.crossTeam?.apmSla?.monthly) {
    sections.push(renderSLATrendSection("SLA Trend (Cross-Team)", sla.summary.crossTeam.apmSla.monthly));
  }

  return sections.join("\n");
}

function renderCrossTeamKPIs(cycleTime: any, bugs: any, prs: any, sla: any): string {
  const cards: string[] = [];

  if (cycleTime?.summary?.crossTeam?.total) {
    const ct = cycleTime.summary.crossTeam.total;
    cards.push(`<div class="card">
      <h3>&#9201; Cycle Time</h3>
      <div class="metric-value">${fmt(ct.medianCycleTimeDays)}<span style="font-size:16px;color:var(--text-muted)"> days</span></div>
      <div class="metric-label">Median cycle time (${ct.ticketCount} tickets)</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Average</span>
        <span class="value">${fmt(ct.averageCycleTimeDays)} days</span>
      </div>
    </div>`);
  }

  if (prs?.summary?.crossTeam?.total) {
    const pr = prs.summary.crossTeam.total;
    cards.push(`<div class="card">
      <h3>&#128295; Pull Requests</h3>
      <div class="metric-value">${pr.prCount}</div>
      <div class="metric-label">Total PRs merged</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Median close</span>
        <span class="value">${fmt(pr.medianTimeToCloseDays)} days</span>
      </div>
      <div class="metric-row">
        <span class="label">Average close</span>
        <span class="value">${fmt(pr.averageTimeToCloseDays)} days</span>
      </div>
    </div>`);
  }

  if (bugs?.summary?.crossTeam?.total) {
    const bt = bugs.summary.crossTeam.total;
    const totalBugs = Object.values(bt).reduce((sum: number, s: any) => sum + (s.totalBugs || 0), 0);
    cards.push(`<div class="card">
      <h3>&#128027; Customer Bugs</h3>
      <div class="metric-value">${totalBugs}</div>
      <div class="metric-label">Total bugs reported</div>
      ${Object.entries(bt)
        .map(([sev, stats]: [string, any]) =>
          `<div class="metric-row"><span class="label">${escapeHtml(sev)}</span><span class="value">${stats.totalBugs} <span style="color:var(--text-muted);font-weight:400;font-size:12px">TTR ${fmt(stats.medianTimeToResolveDays)}d</span></span></div>`
        )
        .join("")}
    </div>`);
  }

  if (sla?.summary?.crossTeam?.apmSla?.total) {
    const st = sla.summary.crossTeam.apmSla.total;
    const apdexColor = (st.averageApdex ?? 0) >= 0.95 ? "var(--green)" : (st.averageApdex ?? 0) >= 0.85 ? "var(--yellow)" : "var(--red)";
    cards.push(`<div class="card">
      <h3>&#128200; SLA / Reliability</h3>
      <div class="metric-value" style="color:${apdexColor}">${fmt(st.averageApdex, 4)}</div>
      <div class="metric-label">Average Apdex</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Error Rate</span>
        <span class="value">${fmt(st.averageErrorRatePercent, 3)}%</span>
      </div>
      <div class="metric-row">
        <span class="label">Satisfied</span>
        <span class="value">${fmt(st.averageSatisfiedPercent)}%</span>
      </div>
      <div class="metric-row">
        <span class="label">Response Time</span>
        <span class="value">${fmt(st.averageResponseTimeMs)}ms</span>
      </div>
    </div>`);
  }

  if (cards.length === 0) return `<div class="no-data">No data available</div>`;
  return `<div class="section"><div class="section-title">Key Performance Indicators</div><div class="grid">${cards.join("")}</div></div>`;
}

function renderMonthlyTrendSection(
  title: string,
  icon: string,
  monthly: Record<string, any>,
  extractCols: (stats: any) => { label: string; value: string | number }[]
): string {
  const months = Object.keys(monthly).sort();
  if (months.length === 0) return "";

  const sampleCols = extractCols(monthly[months[0]]);
  return `<div class="section">
    <div class="section-title"><span class="icon">${icon}</span> ${title}</div>
    <div class="card">
      <table>
        <thead><tr><th>Month</th>${sampleCols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${months
            .map((m) => {
              const cols = extractCols(monthly[m]);
              return `<tr><td><strong>${escapeHtml(m)}</strong></td>${cols.map((c) => `<td>${escapeHtml(String(c.value))}</td>`).join("")}</tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderBugsTrendSection(title: string, monthly: Record<string, any>): string {
  const months = Object.keys(monthly).sort();
  if (months.length === 0) return "";

  const allSeverities = new Set<string>();
  for (const m of months) {
    Object.keys(monthly[m]).forEach((s) => allSeverities.add(s));
  }
  const severities = Array.from(allSeverities).sort();

  return `<div class="section">
    <div class="section-title"><span class="icon">&#128027;</span> ${title}</div>
    <div class="card">
      <table>
        <thead><tr><th>Month</th>${severities.map((s) => `<th>${escapeHtml(s)} Count</th><th>${escapeHtml(s)} TTR (days)</th>`).join("")}</tr></thead>
        <tbody>
          ${months
            .map(
              (m) =>
                `<tr><td><strong>${escapeHtml(m)}</strong></td>${severities
                  .map((s) => {
                    const st = monthly[m][s];
                    return st
                      ? `<td>${st.totalBugs}</td><td>${fmt(st.medianTimeToResolveDays)}</td>`
                      : `<td>0</td><td>N/A</td>`;
                  })
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderSLATrendSection(title: string, monthly: Record<string, any>): string {
  const months = Object.keys(monthly).sort();
  if (months.length === 0) return "";

  return `<div class="section">
    <div class="section-title"><span class="icon">&#128200;</span> ${title}</div>
    <div class="card">
      <table>
        <thead><tr><th>Month</th><th>Apdex</th><th>Satisfied %</th><th>Error Rate %</th><th>Response (ms)</th><th>Throughput (rpm)</th></tr></thead>
        <tbody>
          ${months
            .map(
              (m) => {
                const s = monthly[m];
                const apdexBadge = (s.averageApdex ?? 0) >= 0.95 ? "badge-green" : (s.averageApdex ?? 0) >= 0.85 ? "badge-yellow" : "badge-red";
                return `<tr>
                  <td><strong>${escapeHtml(m)}</strong></td>
                  <td><span class="badge ${apdexBadge}">${fmt(s.averageApdex, 4)}</span></td>
                  <td>${fmt(s.averageSatisfiedPercent)}%</td>
                  <td>${fmt(s.averageErrorRatePercent, 3)}%</td>
                  <td>${fmt(s.averageResponseTimeMs)}ms</td>
                  <td>${fmt(s.averageThroughputRpm, 0)}</td>
                </tr>`;
              }
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderTeam(team: string, cycleTime: any, bugs: any, prs: any, sla: any): string {
  const sections: string[] = [];

  // Cycle Time
  const ctTeam = cycleTime?.summary?.teams?.[team];
  if (ctTeam) {
    const cards: string[] = [];
    if (ctTeam.total) {
      cards.push(`<div class="card">
        <h3>Overall Cycle Time</h3>
        <div class="mini-grid">
          <div class="mini-stat"><div class="val">${ctTeam.total.ticketCount}</div><div class="lbl">Tickets</div></div>
          <div class="mini-stat"><div class="val">${fmt(ctTeam.total.medianCycleTimeDays)}</div><div class="lbl">Median (days)</div></div>
          <div class="mini-stat"><div class="val">${fmt(ctTeam.total.averageCycleTimeDays)}</div><div class="lbl">Average (days)</div></div>
        </div>
      </div>`);
    }
    sections.push(`<div class="section">
      <div class="section-title"><span class="icon">&#9201;</span> Cycle Time</div>
      <div class="grid">${cards.join("")}</div>
      ${ctTeam.monthly ? renderMonthlyTable("Monthly Cycle Time", ctTeam.monthly, [
        { key: "ticketCount", label: "Tickets" },
        { key: "medianCycleTimeDays", label: "Median (days)", fmt: true },
        { key: "averageCycleTimeDays", label: "Average (days)", fmt: true },
      ]) : ""}
      ${ctTeam.quarterly ? renderMonthlyTable("Quarterly Cycle Time", ctTeam.quarterly, [
        { key: "ticketCount", label: "Tickets" },
        { key: "medianCycleTimeDays", label: "Median (days)", fmt: true },
        { key: "averageCycleTimeDays", label: "Average (days)", fmt: true },
      ]) : ""}
    </div>`);
  }

  // Bugs
  const bugsTeam = bugs?.summary?.teams?.[team];
  if (bugsTeam) {
    const totalBugs = bugsTeam.total
      ? Object.values(bugsTeam.total).reduce((sum: number, s: any) => sum + (s.totalBugs || 0), 0)
      : 0;
    sections.push(`<div class="section">
      <div class="section-title"><span class="icon">&#128027;</span> Customer Bugs</div>
      <div class="grid">
        <div class="card">
          <h3>Total Bugs</h3>
          <div class="metric-value">${totalBugs}</div>
          ${bugsTeam.total
            ? Object.entries(bugsTeam.total)
                .map(([sev, stats]: [string, any]) =>
                  `<div class="metric-row"><span class="label">${escapeHtml(sev)}</span><span class="value">${stats.totalBugs} bugs, TTR ${fmt(stats.medianTimeToResolveDays)}d</span></div>`
                )
                .join("")
            : ""}
        </div>
      </div>
      ${bugsTeam.monthly ? renderBugsTrendSection(`Monthly Bugs — ${team}`, bugsTeam.monthly) : ""}
    </div>`);
  }

  // PRs
  const prsTeam = prs?.summary?.teams?.[team];
  if (prsTeam) {
    const cards: string[] = [];
    if (prsTeam.total) {
      cards.push(`<div class="card">
        <h3>Overall PR Stats</h3>
        <div class="mini-grid">
          <div class="mini-stat"><div class="val">${prsTeam.total.prCount}</div><div class="lbl">Total PRs</div></div>
          <div class="mini-stat"><div class="val">${fmt(prsTeam.total.medianTimeToCloseDays)}</div><div class="lbl">Median Close (days)</div></div>
          <div class="mini-stat"><div class="val">${fmt(prsTeam.total.averageTimeToCloseDays)}</div><div class="lbl">Average Close (days)</div></div>
        </div>
      </div>`);
    }
    // Top contributors
    if (prsTeam.total?.prsByContributor) {
      const contribs = Object.entries(prsTeam.total.prsByContributor)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 10);
      if (contribs.length > 0) {
        const maxPrs = contribs[0][1] as number;
        cards.push(`<div class="card">
          <h3>Top Contributors</h3>
          ${contribs
            .map(
              ([name, count]: any) =>
                `<div style="margin-bottom:8px">
                  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
                    <span>${escapeHtml(name)}</span><span style="font-weight:600">${count}</span>
                  </div>
                  <div class="bar-container"><div class="bar bar-blue" style="width:${(count / maxPrs) * 100}%"></div></div>
                </div>`
            )
            .join("")}
        </div>`);
      }
    }
    sections.push(`<div class="section">
      <div class="section-title"><span class="icon">&#128295;</span> Pull Requests</div>
      <div class="grid">${cards.join("")}</div>
      ${prsTeam.monthly ? renderMonthlyTable("Monthly PRs", prsTeam.monthly, [
        { key: "prCount", label: "PRs" },
        { key: "medianTimeToCloseDays", label: "Median Close (days)", fmt: true },
        { key: "averageTimeToCloseDays", label: "Avg Close (days)", fmt: true },
      ]) : ""}
    </div>`);
  }

  // SLA
  const slaTeam = sla?.summary?.teams?.[team];
  if (slaTeam) {
    if (slaTeam.apmSla) {
      const total = slaTeam.apmSla.total;
      const apdexColor = (total?.averageApdex ?? 0) >= 0.95 ? "var(--green)" : (total?.averageApdex ?? 0) >= 0.85 ? "var(--yellow)" : "var(--red)";
      sections.push(`<div class="section">
        <div class="section-title"><span class="icon">&#128200;</span> SLA / Reliability</div>
        <div class="grid">
          <div class="card">
            <h3>APM Summary</h3>
            <div class="mini-grid">
              <div class="mini-stat"><div class="val" style="color:${apdexColor}">${fmt(total?.averageApdex, 4)}</div><div class="lbl">Apdex</div></div>
              <div class="mini-stat"><div class="val">${fmt(total?.averageErrorRatePercent, 3)}%</div><div class="lbl">Error Rate</div></div>
              <div class="mini-stat"><div class="val">${fmt(total?.averageSatisfiedPercent)}%</div><div class="lbl">Satisfied</div></div>
              <div class="mini-stat"><div class="val">${fmt(total?.averageResponseTimeMs)}ms</div><div class="lbl">Response Time</div></div>
            </div>
          </div>
          ${slaTeam.browserErrors?.byApp ? `<div class="card">
            <h3>Browser Error Rates (Last 7 Days)</h3>
            ${Object.entries(slaTeam.browserErrors.byApp)
              .map(
                ([app, rate]: [string, any]) => {
                  const badgeClass = rate <= 2 ? "badge-green" : rate <= 5 ? "badge-yellow" : "badge-red";
                  return `<div class="metric-row"><span class="label">${escapeHtml(app)}</span><span class="badge ${badgeClass}">${fmt(rate)}%</span></div>`;
                }
              )
              .join("")}
          </div>` : ""}
        </div>
        ${slaTeam.apmSla.monthly ? renderSLAAppTable(slaTeam.apmSla.monthly) : ""}
      </div>`);
    }
  }

  if (sections.length === 0) {
    return `<div class="no-data">No data available for ${escapeHtml(team)}</div>`;
  }

  return sections.join("\n");
}

function renderMonthlyTable(
  title: string,
  data: Record<string, any>,
  columns: { key: string; label: string; fmt?: boolean }[]
): string {
  const periods = Object.keys(data).sort();
  if (periods.length === 0) return "";

  return `<div class="card" style="margin-top:16px">
    <h3>${escapeHtml(title)}</h3>
    <table>
      <thead><tr><th>Period</th>${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${periods
          .map(
            (p) =>
              `<tr><td><strong>${escapeHtml(p)}</strong></td>${columns
                .map((c) => `<td>${c.fmt ? fmt(data[p]?.[c.key]) : (data[p]?.[c.key] ?? "N/A")}</td>`)
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function renderSLAAppTable(monthly: Record<string, any>): string {
  const months = Object.keys(monthly).sort();
  if (months.length === 0) return "";

  const allApps = new Set<string>();
  for (const m of months) {
    if (monthly[m].byApp) {
      Object.keys(monthly[m].byApp).forEach((a) => allApps.add(a));
    }
  }
  const apps = Array.from(allApps).sort();
  if (apps.length === 0) return "";

  return `<div class="card" style="margin-top:16px">
    <h3>APM By App &amp; Month</h3>
    <div style="overflow-x:auto">
    <table>
      <thead><tr><th>App</th><th>Month</th><th>Apdex</th><th>Satisfied %</th><th>Error %</th><th>Response (ms)</th><th>Throughput (rpm)</th></tr></thead>
      <tbody>
        ${apps
          .map((app) =>
            months
              .map((m, i) => {
                const s = monthly[m]?.byApp?.[app];
                if (!s) return "";
                const apdexBadge = (s.apdex ?? 0) >= 0.95 ? "badge-green" : (s.apdex ?? 0) >= 0.85 ? "badge-yellow" : "badge-red";
                return `<tr>
                  ${i === 0 ? `<td rowspan="${months.length}"><strong>${escapeHtml(app)}</strong></td>` : ""}
                  <td>${escapeHtml(m)}</td>
                  <td><span class="badge ${apdexBadge}">${fmt(s.apdex, 4)}</span></td>
                  <td>${fmt(s.satisfiedPercent)}%</td>
                  <td>${fmt(s.errorRatePercent, 3)}%</td>
                  <td>${fmt(s.responseTimeMs)}ms</td>
                  <td>${fmt(s.throughputRpm, 0)}</td>
                </tr>`;
              })
              .join("")
          )
          .join("")}
      </tbody>
    </table>
    </div>
  </div>`;
}
