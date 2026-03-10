import { loadJiraConfig } from "./config.js";
import axios from "axios";

async function checkToken() {
  const config = loadJiraConfig();
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");

  console.log(`Checking connection to ${config.baseUrl} as ${config.email}...`);

  const response = await axios.get(`${config.baseUrl}/rest/api/3/myself`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });

  console.log(`Connected as: ${response.data.displayName} (${response.data.emailAddress})`);
}

checkToken().catch((err) => {
  if (err.response?.status === 401) {
    console.error("Authentication failed. Check your JIRA_EMAIL and JIRA_API_TOKEN.");
  } else if (err.response?.status === 403) {
    console.error("Access denied. Your account may lack permissions.");
  } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
    console.error(`Cannot reach ${err.config?.baseURL || "JIRA"}. Check your JIRA_BASE_URL.`);
  } else {
    console.error("Error:", err.message);
  }
  process.exit(1);
});
