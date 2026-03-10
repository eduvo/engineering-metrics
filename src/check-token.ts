import { loadJiraConfig, loadGitHubConfig, loadNewRelicConfig } from "./config.js";
import axios from "axios";

async function checkJira() {
  console.log("\n--- JIRA ---");
  try {
    const config = loadJiraConfig();
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    console.log(`Checking connection to ${config.baseUrl} as ${config.email}...`);
    const response = await axios.get(`${config.baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    console.log(`✓ Connected as: ${response.data.displayName} (${response.data.emailAddress})`);
  } catch (err: any) {
    if (err.response?.status === 401) {
      console.error("✗ Authentication failed. Check JIRA_EMAIL and JIRA_API_TOKEN.");
    } else if (err.response?.status === 403) {
      console.error("✗ Access denied. Your account may lack permissions.");
    } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      console.error(`✗ Cannot reach JIRA. Check JIRA_BASE_URL.`);
    } else if (err.message?.includes("Missing required environment variable")) {
      console.error(`✗ Skipped — ${err.message}`);
    } else {
      console.error("✗ Error:", err.message);
    }
  }
}

async function checkGitHub() {
  console.log("\n--- GitHub ---");
  try {
    const config = loadGitHubConfig();
    console.log("Checking GitHub token...");
    const response = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json" },
    });
    console.log(`✓ Connected as: ${response.data.login} (${response.data.name || "no name"})`);
  } catch (err: any) {
    if (err.response?.status === 401) {
      console.error("✗ Authentication failed. Check GITHUB_TOKEN.");
    } else if (err.message?.includes("Missing required environment variable")) {
      console.error(`✗ Skipped — ${err.message}`);
    } else {
      console.error("✗ Error:", err.message);
    }
  }
}

async function checkNewRelic() {
  console.log("\n--- New Relic ---");
  try {
    const config = loadNewRelicConfig();
    console.log(`Checking New Relic API (account ${config.accountId})...`);
    const response = await axios.post(
      config.apiUrl,
      { query: "{ actor { user { email name } } }" },
      { headers: { "API-Key": config.apiKey, "Content-Type": "application/json" } },
    );
    const user = response.data?.data?.actor?.user;
    if (user) {
      console.log(`✓ Connected as: ${user.name} (${user.email})`);
    } else {
      console.error("✗ Unexpected response — check NEWRELIC_API_KEY.");
    }
  } catch (err: any) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      console.error("✗ Authentication failed. Check NEWRELIC_API_KEY.");
    } else if (err.message?.includes("Missing required environment variable")) {
      console.error(`✗ Skipped — ${err.message}`);
    } else {
      console.error("✗ Error:", err.message);
    }
  }
}

async function checkAll() {
  await checkJira();
  await checkGitHub();
  await checkNewRelic();
  console.log("");
}

checkAll().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
