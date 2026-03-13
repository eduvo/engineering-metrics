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

export function generateHTML(data: DataFiles, generatedAt: string, dateRange?: { since: string; until: string }): string {
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
  <div class="subtitle">${dateRange ? `Data from ${escapeHtml(dateRange.since)} to ${escapeHtml(dateRange.until)} &mdash; ` : ""}Generated ${escapeHtml(generatedAt)}</div>
</div>

<div class="tabs">
  <button class="tab active" onclick="switchTab('overall')">Overall</button>
  ${teams.map((t) => `<button class="tab" onclick="switchTab('team-${escapeAttr(t)}')">${escapeHtml(t)}</button>`).join("\n  ")}
</div>

<div id="tab-overall" class="tab-content active">
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

  if (sla?.summary?.crossTeam?.apmSla?.monthly) {
    sections.push(renderSLATrendSection("SLA Trend (Cross-Team)", sla.summary.crossTeam.apmSla.monthly));
  }

  if (cycleTime?.summary?.crossTeam?.weekly) {
    sections.push(renderWeeklyTrendChart(
      "Weekly Cycle Time — Median (Cross-Team)", "&#9201;",
      cycleTime.summary.crossTeam.weekly,
      [{ label: "Median (days)", extract: (s: any) => s.medianCycleTimeDays, color: "#6c8aff" }]
    ));
    sections.push(renderWeeklyTrendChart(
      "Weekly Cycle Time — Average (Cross-Team)", "&#9201;",
      cycleTime.summary.crossTeam.weekly,
      [{ label: "Average (days)", extract: (s: any) => s.averageCycleTimeDays, color: "#a78bfa" }]
    ));
    sections.push(renderWeeklyTrendChart(
      "Weekly Lead Time — Median (Cross-Team)", "&#128197;",
      cycleTime.summary.crossTeam.weekly,
      [{ label: "Median (days)", extract: (s: any) => s.medianLeadTimeDays, color: "#34d399" }]
    ));
    sections.push(renderWeeklyTrendChart(
      "Weekly Lead Time — Average (Cross-Team)", "&#128197;",
      cycleTime.summary.crossTeam.weekly,
      [{ label: "Average (days)", extract: (s: any) => s.averageLeadTimeDays, color: "#fbbf24" }]
    ));
    if (cycleTime.summary.crossTeam.total.totalStoryPoints > 0) {
      sections.push(renderWeeklyTrendChart(
        "Weekly Velocity (Cross-Team)", "&#127937;",
        cycleTime.summary.crossTeam.weekly,
        [{ label: "Story Points", extract: (s: any) => s.totalStoryPoints, color: "#22d3ee" }]
      ));
    }
  }

  if (prs?.summary?.crossTeam?.weekly) {
    sections.push(renderWeeklyTrendChart(
      "Weekly PR Trend (Cross-Team)", "&#128295;",
      prs.summary.crossTeam.weekly,
      [
        { label: "Median Close (days)", extract: (s: any) => s.medianTimeToCloseDays, color: "#6c8aff" },
        { label: "Average Close (days)", extract: (s: any) => s.averageTimeToCloseDays, color: "#a78bfa" },
      ]
    ));
  }

  if (bugs?.summary?.crossTeam?.weekly) {
    sections.push(renderBugsWeeklyChart("Weekly Bug Trend (Cross-Team)", bugs.summary.crossTeam.weekly));
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
      <div class="metric-label">Median cycle time (${ct.cycleTimeTicketCount} tickets)</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Average</span>
        <span class="value">${fmt(ct.averageCycleTimeDays)} days</span>
      </div>
    </div>`);
    cards.push(`<div class="card">
      <h3>&#128197; Lead Time</h3>
      <div class="metric-value">${fmt(ct.medianLeadTimeDays)}<span style="font-size:16px;color:var(--text-muted)"> days</span></div>
      <div class="metric-label">Median lead time (${ct.leadTimeTicketCount} tickets)</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Average</span>
        <span class="value">${fmt(ct.averageLeadTimeDays)} days</span>
      </div>
    </div>`);
    if (ct.totalStoryPoints > 0) {
      const weeklyPoints = Object.values(cycleTime.summary.crossTeam.weekly ?? {}).map((w: any) => w.totalStoryPoints).filter((v: number) => v > 0);
      const avgWeeklyVelocity = weeklyPoints.length > 0 ? weeklyPoints.reduce((s: number, v: number) => s + v, 0) / weeklyPoints.length : null;
      cards.push(`<div class="card">
        <h3>&#127937; Velocity</h3>
        <div class="metric-value">${fmt(avgWeeklyVelocity, 1)}<span style="font-size:16px;color:var(--text-muted)"> pts/wk</span></div>
        <div class="metric-label">Average weekly velocity (${weeklyPoints.length} weeks)</div>
        <div style="margin-top:12px" class="metric-row">
          <span class="label">Total</span>
          <span class="value">${fmt(ct.totalStoryPoints, 1)} pts</span>
        </div>
        <div class="metric-row">
          <span class="label">Average per ticket</span>
          <span class="value">${fmt(ct.averageStoryPoints, 1)} pts</span>
        </div>
      </div>`);
    }
  }

  if (prs?.summary?.crossTeam?.total) {
    const pr = prs.summary.crossTeam.total;
    cards.push(`<div class="card">
      <h3>&#128295; Pull Requests</h3>
      <div class="metric-value">${fmt(pr.medianTimeToCloseDays)}<span style="font-size:16px;color:var(--text-muted)"> days</span></div>
      <div class="metric-label">Median close time</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Total PRs</span>
        <span class="value">${pr.prCount}</span>
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
          `<div class="metric-row"><span class="label">${escapeHtml(sev)}</span><span class="value">${stats.totalBugs} <span style="color:var(--text-muted);font-weight:400;font-size:12px">median ${fmt(stats.medianTimeToResolveDays)}d / avg ${fmt(stats.averageTimeToResolveDays)}d</span></span></div>`
        )
        .join("")}
    </div>`);
  }

  if (sla?.summary?.crossTeam?.apmSla?.total) {
    const st = sla.summary.crossTeam.apmSla.total;
    cards.push(`<div class="card">
      <h3>&#128504; Availability</h3>
      <div class="metric-value">${fmt(st.averageErrorRatePercent, 3)}<span style="font-size:16px;color:var(--text-muted)">%</span></div>
      <div class="metric-label">Average Error Rate</div>
    </div>`);
    const apdexColor = (st.averageApdex ?? 0) >= 0.95 ? "var(--green)" : (st.averageApdex ?? 0) >= 0.85 ? "var(--yellow)" : "var(--red)";
    const satisfiedColor = (st.averageSatisfiedPercent ?? 0) >= 90 ? "var(--green)" : (st.averageSatisfiedPercent ?? 0) >= 75 ? "var(--yellow)" : "var(--red)";
    cards.push(`<div class="card">
      <h3>&#9889; Responsiveness</h3>
      <div class="metric-value" style="color:${satisfiedColor}">${fmt(st.averageSatisfiedPercent)}<span style="font-size:16px;color:var(--text-muted)">%</span></div>
      <div class="metric-label">Satisfied requests</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Apdex</span>
        <span class="value" style="color:${apdexColor}">${fmt(st.averageApdex, 4)}</span>
      </div>
      <div class="metric-row">
        <span class="label">Response Time</span>
        <span class="value">${fmt(st.averageResponseTimeMs)}ms</span>
      </div>
      <div class="metric-row">
        <span class="label">Throughput</span>
        <span class="value">${fmt(st.averageThroughputRpm, 0)} rpm</span>
      </div>
    </div>`);
  }

  if (cards.length === 0) return `<div class="no-data">No data available</div>`;
  return `<div class="section"><div class="section-title">Key Performance Indicators</div><div class="grid">${cards.join("")}</div></div>`;
}

function renderWeeklyTrendChart(
  title: string,
  icon: string,
  weekly: Record<string, any>,
  lines: { label: string; extract: (stats: any) => number | null; color: string }[],
  rightPad = 150
): string {
  const weeks = Object.keys(weekly).sort();
  if (weeks.length < 2) return "";

  const W = 720, H = 260;
  const pad = { t: 20, r: rightPad, b: 55, l: 55 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  const seriesData = lines.map(l => ({
    ...l,
    values: weeks.map(w => l.extract(weekly[w]))
  }));

  let maxVal = 0;
  for (const s of seriesData) {
    for (const v of s.values) {
      if (v !== null && v > maxVal) maxVal = v;
    }
  }
  if (maxVal === 0) maxVal = 1;
  maxVal *= 1.1;

  const xStep = weeks.length > 1 ? pw / (weeks.length - 1) : pw;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = pad.t + ph - f * ph;
    const val = f * maxVal;
    const label = val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2);
    return `<line x1="${pad.l}" y1="${y}" x2="${pad.l + pw}" y2="${y}" stroke="var(--border)" ${f > 0 ? 'stroke-dasharray="4,4"' : ""} />
      <text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${label}</text>`;
  }).join("");

  const paths = seriesData.map(s => {
    const points: string[] = [];
    const dots: string[] = [];
    s.values.forEach((v, i) => {
      if (v !== null) {
        const x = pad.l + i * xStep;
        const y = pad.t + ph - (v / maxVal) * ph;
        points.push(`${x},${y}`);
        dots.push(`<circle cx="${x}" cy="${y}" r="3" fill="${s.color}" />`);
      }
    });
    if (points.length < 2) return "";
    return `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${points.join(" ")}" />${dots.join("")}`;
  }).join("");

  const labelEvery = Math.max(1, Math.ceil(weeks.length / 14));
  const xLabels = weeks.map((w, i) =>
    i % labelEvery === 0
      ? `<text x="${pad.l + i * xStep}" y="${H - 5}" text-anchor="end" fill="var(--text-muted)" font-size="10" transform="rotate(-45 ${pad.l + i * xStep} ${H - 5})">${w}</text>`
      : ""
  ).join("");

  const legend = seriesData.map((s, i) =>
    `<rect x="${W - pad.r + 10}" y="${pad.t + 3 + i * 20}" width="12" height="12" rx="2" fill="${s.color}" />
     <text x="${W - pad.r + 26}" y="${pad.t + 13 + i * 20}" fill="var(--text)" font-size="11">${escapeHtml(s.label)}</text>`
  ).join("");

  return `<div class="section">
    <div class="section-title"><span class="icon">${icon}</span> ${title}</div>
    <div class="card">
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="max-width:${W}px">
        ${gridLines}
        ${paths}
        ${xLabels}
        ${legend}
      </svg>
    </div>
  </div>`;
}

function renderBugsWeeklyChart(title: string, weekly: Record<string, any>): string {
  const weeks = Object.keys(weekly).sort();
  if (weeks.length < 2) return "";

  const allSeverities = new Set<string>();
  for (const w of weeks) {
    Object.keys(weekly[w]).forEach(s => allSeverities.add(s));
  }
  const severities = Array.from(allSeverities).sort();
  const colors = ["#6c8aff", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];
  const medianColors = ["#6c8aff", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];
  const avgColors = ["#3b5de7", "#1fa67a", "#d9a00a", "#dc2626", "#7c5bbf", "#e07616"];

  const countChart = renderWeeklyTrendChart(`${title} — Count`, "&#128027;", weekly,
    severities.map((sev, i) => ({
      label: sev,
      extract: (stats: any) => stats[sev]?.totalBugs ?? null,
      color: colors[i % colors.length],
    }))
  );

  const resolveLines: { label: string; extract: (stats: any) => number | null; color: string }[] = [];
  severities.forEach((sev, i) => {
    resolveLines.push({
      label: `${sev} median`,
      extract: (stats: any) => stats[sev]?.medianTimeToResolveDays ?? null,
      color: medianColors[i % medianColors.length],
    });
    resolveLines.push({
      label: `${sev} avg`,
      extract: (stats: any) => stats[sev]?.averageTimeToResolveDays ?? null,
      color: avgColors[i % avgColors.length],
    });
  });

  const resolveChart = renderWeeklyTrendChart(`${title} — Time to Resolve (days)`, "&#9201;", weekly, resolveLines);

  return [countChart, resolveChart].filter(Boolean).join("\n");
}

function renderSLATrendSection(title: string, monthly: Record<string, any>): string {
  const months = Object.keys(monthly).sort();
  if (months.length < 2) return "";

  return [
    renderWeeklyTrendChart(`${title} \u2014 Apdex`, "&#128200;", monthly, [
      { label: "Apdex", extract: (s: any) => s.averageApdex, color: "#34d399" },
    ]),
    renderWeeklyTrendChart(`${title} \u2014 Satisfied %`, "&#128200;", monthly, [
      { label: "Satisfied %", extract: (s: any) => s.averageSatisfiedPercent, color: "#6c8aff" },
    ]),
    renderWeeklyTrendChart(`${title} \u2014 Error Rate %`, "&#128200;", monthly, [
      { label: "Error Rate %", extract: (s: any) => s.averageErrorRatePercent, color: "#f87171" },
    ]),
    renderWeeklyTrendChart(`${title} \u2014 Response Time (ms)`, "&#128200;", monthly, [
      { label: "Response (ms)", extract: (s: any) => s.averageResponseTimeMs, color: "#fbbf24" },
    ]),
    renderWeeklyTrendChart(`${title} \u2014 Throughput (rpm)`, "&#128200;", monthly, [
      { label: "Throughput (rpm)", extract: (s: any) => s.averageThroughputRpm, color: "#a78bfa" },
    ]),
  ].filter(Boolean).join("\n");
}

function renderTeamKPIs(team: string, cycleTime: any, bugs: any, prs: any, sla: any): string {
  const cards: string[] = [];

  const ctTeam = cycleTime?.summary?.teams?.[team];
  if (ctTeam?.total) {
    const ct = ctTeam.total;
    cards.push(`<div class="card">
      <h3>&#9201; Cycle Time</h3>
      <div class="metric-value">${fmt(ct.medianCycleTimeDays)}<span style="font-size:16px;color:var(--text-muted)"> days</span></div>
      <div class="metric-label">Median cycle time (${ct.cycleTimeTicketCount} tickets)</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Average</span>
        <span class="value">${fmt(ct.averageCycleTimeDays)} days</span>
      </div>
    </div>`);
    cards.push(`<div class="card">
      <h3>&#128197; Lead Time</h3>
      <div class="metric-value">${fmt(ct.medianLeadTimeDays)}<span style="font-size:16px;color:var(--text-muted)"> days</span></div>
      <div class="metric-label">Median lead time (${ct.leadTimeTicketCount} tickets)</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Average</span>
        <span class="value">${fmt(ct.averageLeadTimeDays)} days</span>
      </div>
    </div>`);    if (ct.totalStoryPoints > 0) {
      const weeklyPoints = Object.values(ctTeam.weekly ?? {}).map((w: any) => w.totalStoryPoints).filter((v: number) => v > 0);
      const avgWeeklyVelocity = weeklyPoints.length > 0 ? weeklyPoints.reduce((s: number, v: number) => s + v, 0) / weeklyPoints.length : null;
      cards.push(`<div class=\"card\">
        <h3>&#127937; Velocity</h3>
        <div class=\"metric-value\">${fmt(avgWeeklyVelocity, 1)}<span style=\"font-size:16px;color:var(--text-muted)\"> pts/wk</span></div>
        <div class=\"metric-label\">Average weekly velocity (${weeklyPoints.length} weeks)</div>
        <div style=\"margin-top:12px\" class=\"metric-row\">
          <span class=\"label\">Total</span>
          <span class=\"value\">${fmt(ct.totalStoryPoints, 1)} pts</span>
        </div>
        <div class=\"metric-row\">
          <span class=\"label\">Average per ticket</span>
          <span class=\"value\">${fmt(ct.averageStoryPoints, 1)} pts</span>
        </div>
      </div>`);
    }  }

  const prsTeam = prs?.summary?.teams?.[team];
  if (prsTeam?.total) {
    const pr = prsTeam.total;
    cards.push(`<div class="card">
      <h3>&#128295; Pull Requests</h3>
      <div class="metric-value">${fmt(pr.medianTimeToCloseDays)}<span style="font-size:16px;color:var(--text-muted)"> days</span></div>
      <div class="metric-label">Median close time</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Total PRs</span>
        <span class="value">${pr.prCount}</span>
      </div>
      <div class="metric-row">
        <span class="label">Average close</span>
        <span class="value">${fmt(pr.averageTimeToCloseDays)} days</span>
      </div>
    </div>`);
  }

  const bugsTeam = bugs?.summary?.teams?.[team];
  if (bugsTeam?.total) {
    const bt = bugsTeam.total;
    const totalBugs = Object.values(bt).reduce((sum: number, s: any) => sum + (s.totalBugs || 0), 0);
    cards.push(`<div class="card">
      <h3>&#128027; Customer Bugs</h3>
      <div class="metric-value">${totalBugs}</div>
      <div class="metric-label">Total bugs reported</div>
      ${Object.entries(bt)
        .map(([sev, stats]: [string, any]) =>
          `<div class="metric-row"><span class="label">${escapeHtml(sev)}</span><span class="value">${stats.totalBugs} <span style="color:var(--text-muted);font-weight:400;font-size:12px">median ${fmt(stats.medianTimeToResolveDays)}d / avg ${fmt(stats.averageTimeToResolveDays)}d</span></span></div>`
        )
        .join("")}
    </div>`);
  }

  const slaTeam = sla?.summary?.teams?.[team];
  if (slaTeam?.apmSla?.total) {
    const st = slaTeam.apmSla.total;
    const errorRows: string[] = [];
    errorRows.push(`<div class="metric-row"><span class="label">APM Error Rate</span><span class="value">${fmt(st.averageErrorRatePercent, 3)}%</span></div>`);
    if (slaTeam.browserErrors?.byApp) {
      for (const [app, rate] of Object.entries(slaTeam.browserErrors.byApp) as [string, any][]) {
        const badgeClass = rate <= 2 ? "badge-green" : rate <= 5 ? "badge-yellow" : "badge-red";
        errorRows.push(`<div class="metric-row"><span class="label">Browser: ${escapeHtml(app)}</span><span class="badge ${badgeClass}">${fmt(rate)}%</span></div>`);
      }
    }
    cards.push(`<div class="card">
      <h3>&#128504; Availability</h3>
      <div class="metric-value">${fmt(st.averageErrorRatePercent, 3)}<span style="font-size:16px;color:var(--text-muted)">%</span></div>
      <div class="metric-label">APM Error Rate</div>
      ${errorRows.length > 1 ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Browser Errors</div>${errorRows.slice(1).join("")}</div>` : ""}
    </div>`);
    const apdexColor = (st.averageApdex ?? 0) >= 0.95 ? "var(--green)" : (st.averageApdex ?? 0) >= 0.85 ? "var(--yellow)" : "var(--red)";
    const satisfiedColor = (st.averageSatisfiedPercent ?? 0) >= 90 ? "var(--green)" : (st.averageSatisfiedPercent ?? 0) >= 75 ? "var(--yellow)" : "var(--red)";
    cards.push(`<div class="card">
      <h3>&#9889; Responsiveness</h3>
      <div class="metric-value" style="color:${satisfiedColor}">${fmt(st.averageSatisfiedPercent)}<span style="font-size:16px;color:var(--text-muted)">%</span></div>
      <div class="metric-label">Satisfied requests</div>
      <div style="margin-top:12px" class="metric-row">
        <span class="label">Apdex</span>
        <span class="value" style="color:${apdexColor}">${fmt(st.averageApdex, 4)}</span>
      </div>
      <div class="metric-row">
        <span class="label">Response Time</span>
        <span class="value">${fmt(st.averageResponseTimeMs)}ms</span>
      </div>
      <div class="metric-row">
        <span class="label">Throughput</span>
        <span class="value">${fmt(st.averageThroughputRpm, 0)} rpm</span>
      </div>
    </div>`);
  }

  if (cards.length === 0) return "";
  return `<div class="section"><div class="section-title">Key Performance Indicators</div><div class="grid">${cards.join("")}</div></div>`;
}

function renderTeam(team: string, cycleTime: any, bugs: any, prs: any, sla: any): string {
  const sections: string[] = [];

  sections.push(renderTeamKPIs(team, cycleTime, bugs, prs, sla));

  // Cycle Time
  const ctTeam = cycleTime?.summary?.teams?.[team];
  if (ctTeam) {
    const cards: string[] = [];
    if (ctTeam.total) {
      cards.push(`<div class="card">
        <h3>Overall Cycle Time</h3>
        <div class="mini-grid">
          <div class="mini-stat"><div class="val">${ctTeam.total.cycleTimeTicketCount}</div><div class="lbl">Tickets</div></div>
          <div class="mini-stat"><div class="val">${fmt(ctTeam.total.medianCycleTimeDays)}</div><div class="lbl">Median (days)</div></div>
          <div class="mini-stat"><div class="val">${fmt(ctTeam.total.averageCycleTimeDays)}</div><div class="lbl">Average (days)</div></div>
        </div>
      </div>`);
      cards.push(`<div class="card">
        <h3>Overall Lead Time</h3>
        <div class="mini-grid">
          <div class="mini-stat"><div class="val">${ctTeam.total.leadTimeTicketCount}</div><div class="lbl">Tickets</div></div>
          <div class="mini-stat"><div class="val">${fmt(ctTeam.total.medianLeadTimeDays)}</div><div class="lbl">Median (days)</div></div>
          <div class="mini-stat"><div class="val">${fmt(ctTeam.total.averageLeadTimeDays)}</div><div class="lbl">Average (days)</div></div>
        </div>
      </div>`);
      if (ctTeam.total.totalStoryPoints > 0) {
        const weeklyPts = Object.values(ctTeam.weekly ?? {}).map((w: any) => w.totalStoryPoints).filter((v: number) => v > 0);
        const avgWkVel = weeklyPts.length > 0 ? weeklyPts.reduce((s: number, v: number) => s + v, 0) / weeklyPts.length : null;
        cards.push(`<div class="card">
          <h3>Velocity</h3>
          <div class="mini-grid">
            <div class="mini-stat"><div class="val">${fmt(avgWkVel, 1)}</div><div class="lbl">Avg Weekly Velocity</div></div>
            <div class="mini-stat"><div class="val">${fmt(ctTeam.total.totalStoryPoints, 1)}</div><div class="lbl">Total Story Points</div></div>
            <div class="mini-stat"><div class="val">${fmt(ctTeam.total.averageStoryPoints, 1)}</div><div class="lbl">Avg Points/Ticket</div></div>
          </div>
        </div>`);
      }
    }
    sections.push(`<div class="section">
      <div class="section-title"><span class="icon">&#9201;</span> Cycle Time & Lead Time</div>
      <div class="grid">${cards.join("")}</div>
    </div>`);
    if (ctTeam.weekly) {
      sections.push(renderWeeklyTrendChart(
        `Weekly Cycle Time — Median \u2014 ${team}`, "&#9201;", ctTeam.weekly,
        [{ label: "Median (days)", extract: (s: any) => s.medianCycleTimeDays, color: "#6c8aff" }]
      ));
      sections.push(renderWeeklyTrendChart(
        `Weekly Cycle Time — Average \u2014 ${team}`, "&#9201;", ctTeam.weekly,
        [{ label: "Average (days)", extract: (s: any) => s.averageCycleTimeDays, color: "#a78bfa" }]
      ));
      sections.push(renderWeeklyTrendChart(
        `Weekly Lead Time — Median \u2014 ${team}`, "&#128197;", ctTeam.weekly,
        [{ label: "Median (days)", extract: (s: any) => s.medianLeadTimeDays, color: "#34d399" }]
      ));
      sections.push(renderWeeklyTrendChart(
        `Weekly Lead Time — Average \u2014 ${team}`, "&#128197;", ctTeam.weekly,
        [{ label: "Average (days)", extract: (s: any) => s.averageLeadTimeDays, color: "#fbbf24" }]
      ));
      if (ctTeam.total?.totalStoryPoints > 0) {
        sections.push(renderWeeklyTrendChart(
          `Weekly Velocity \u2014 ${team}`, "&#127937;", ctTeam.weekly,
          [{ label: "Story Points", extract: (s: any) => s.totalStoryPoints, color: "#22d3ee" }]
        ));
      }
    }
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
                  `<div class="metric-row"><span class="label">${escapeHtml(sev)}</span><span class="value">${stats.totalBugs} bugs, median ${fmt(stats.medianTimeToResolveDays)}d / avg ${fmt(stats.averageTimeToResolveDays)}d</span></div>`
                )
                .join("")
            : ""}
        </div>
      </div>
    </div>`);
    if (bugsTeam.weekly) {
      sections.push(renderBugsWeeklyChart(`Weekly Bug Trend \u2014 ${team}`, bugsTeam.weekly));
    }
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
    </div>`);
    if (prsTeam.weekly) {
      sections.push(renderWeeklyTrendChart(
        `Weekly PR Trend \u2014 ${team}`, "&#128295;", prsTeam.weekly,
        [
          { label: "Median Close (days)", extract: (s: any) => s.medianTimeToCloseDays, color: "#6c8aff" },
          { label: "Average Close (days)", extract: (s: any) => s.averageTimeToCloseDays, color: "#a78bfa" },
        ]
      ));
    }
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
      if (slaTeam.apmSla.weekly) {
        sections.push(renderWeeklyTrendChart(
          `Weekly SLA Trend \u2014 ${team}`, "&#128200;", slaTeam.apmSla.weekly,
          [
            { label: "Satisfied %", extract: (s: any) => s.averageSatisfiedPercent, color: "#34d399" },
            { label: "Error Rate %", extract: (s: any) => s.averageErrorRatePercent, color: "#f87171" },
          ]
        ));
      }
    }
  }

  if (sections.length === 0) {
    return `<div class="no-data">No data available for ${escapeHtml(team)}</div>`;
  }

  return sections.join("\n");
}

function renderSLAAppTable(monthly: Record<string, any>): string {
  const months = Object.keys(monthly).sort();
  if (months.length < 2) return "";

  const allApps = new Set<string>();
  for (const m of months) {
    if (monthly[m].byApp) {
      Object.keys(monthly[m].byApp).forEach((a) => allApps.add(a));
    }
  }
  const apps = Array.from(allApps).sort();
  if (apps.length === 0) return "";

  const colors = ["#6c8aff", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#22d3ee"];
  const appLines = (metric: string) =>
    apps.map((app, i) => ({
      label: app,
      extract: (s: any) => s.byApp?.[app]?.[metric] ?? null,
      color: colors[i % colors.length],
    }));

  return [
    renderWeeklyTrendChart("Apdex by App", "&#128200;", monthly, appLines("apdex"), 200),
    renderWeeklyTrendChart("Satisfied % by App", "&#128200;", monthly, appLines("satisfiedPercent"), 200),
    renderWeeklyTrendChart("Error Rate % by App", "&#128200;", monthly, appLines("errorRatePercent"), 200),
    renderWeeklyTrendChart("Response Time by App (ms)", "&#128200;", monthly, appLines("responseTimeMs"), 200),
    renderWeeklyTrendChart("Throughput by App (rpm)", "&#128200;", monthly, appLines("throughputRpm"), 200),
  ].filter(Boolean).join("\n");
}
