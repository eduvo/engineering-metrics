import axios from "axios";
import { GitHubPullRequest } from "./github-types.js";

const PER_PAGE = 100;
const BASE_URL = "https://api.github.com";
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface GitHubFetchOptions {
  repo: string;
  since?: string;
  until?: string;
}

const toISODate = (d: string) => new Date(d).toISOString().slice(0, 10);

function splitDateRange(since: string, until: string): { since: string; until: string }[] {
  const start = new Date(since);
  const end = new Date(until);
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  // Format mid as the day before the second half starts
  const midEnd = toISODate(mid.toISOString());
  const nextDay = new Date(mid);
  nextDay.setDate(nextDay.getDate() + 1);
  const midStart = toISODate(nextDay.toISOString());

  return [
    { since: toISODate(since), until: midEnd },
    { since: midStart, until: toISODate(until) },
  ];
}

async function fetchWindow(
  token: string,
  repo: string,
  since?: string,
  until?: string,
): Promise<GitHubPullRequest[]> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const qualifiers = [`repo:${repo}`, "is:pr", "is:closed"];

  if (since && until) {
    qualifiers.push(`closed:${since}..${until}`);
  } else if (since) {
    qualifiers.push(`closed:>=${since}`);
  } else if (until) {
    qualifiers.push(`closed:<=${until}`);
  }

  const q = qualifiers.join(" ");
  console.log(`  Search query: ${q}`);

  const allPRs: GitHubPullRequest[] = [];
  let page = 1;

  while (true) {
    let response!: { data: { total_count: number; items: GitHubPullRequest[] } };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Pause between requests to avoid GitHub's secondary rate limit
        if (page > 1 || attempt > 1) await sleep(1500);

        response = await axios.get<{ total_count: number; items: GitHubPullRequest[] }>(
          `${BASE_URL}/search/issues`,
          {
            headers,
            params: {
              q,
              sort: "created",
              order: "desc",
              per_page: PER_PAGE,
              page,
            },
          },
        );
        break;
      } catch (err: any) {
        if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
          throw new Error(`Cannot connect to GitHub API. Check your network.`);
        }
        if (err.response?.status === 401) {
          throw new Error("GitHub authentication failed. Check your GITHUB_TOKEN.");
        }
        if (err.response?.status === 403 && attempt < MAX_RETRIES) {
          const retryAfter = parseInt(err.response.headers?.["retry-after"] ?? "0", 10);
          const waitSec = retryAfter > 0 ? retryAfter : 30 * attempt;
          console.log(`  Rate limited (403). Waiting ${waitSec}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
          await sleep(waitSec * 1000);
          continue;
        }
        if (err.response?.status === 403) {
          throw new Error(`Access forbidden for "${repo}". Your GITHUB_TOKEN may lack the required scopes or you've hit a rate limit.`);
        }
        if (err.response?.status === 422) {
          throw new Error(`Repository "${repo}" not found or not accessible. Check the repo name in config.yaml and ensure your GITHUB_TOKEN has access.`);
        }
        if (err.response) {
          console.error(`  GitHub API error (${err.response.status}):`, JSON.stringify(err.response.data, null, 2));
        }
        throw err;
      }
    }

    const { total_count, items } = response.data;
    if (items.length === 0) break;

    allPRs.push(...items);

    if (allPRs.length >= total_count) break;
    if (items.length < PER_PAGE) break;

    // Search API caps at 1000 results — split into smaller date windows
    if (page >= 10) {
      if (!since || !until) {
        console.warn(`  Warning: hit 1000 result limit but no bounded date range to split. Some results may be missing.`);
        break;
      }
      console.log(`  Hit 1000 result limit (total_count: ${total_count}), splitting date range...`);
      const halves = splitDateRange(since, until);
      const firstHalf = await fetchWindow(token, repo, halves[0].since, halves[0].until);
      const secondHalf = await fetchWindow(token, repo, halves[1].since, halves[1].until);
      return [...firstHalf, ...secondHalf];
    }

    page++;
    console.log(`  Fetched ${allPRs.length} / ${total_count} PRs (page ${page})...`);
  }

  return allPRs;
}

export async function fetchGitHubPullRequests(
  token: string,
  options: GitHubFetchOptions,
): Promise<GitHubPullRequest[]> {
  console.log(`  Fetching PRs for ${options.repo}...`);

  const since = options.since ? toISODate(options.since) : undefined;
  const until = options.until ? toISODate(options.until) : toISODate(new Date().toISOString());

  const prs = await fetchWindow(token, options.repo, since, until);

  // Deduplicate by PR number in case windows overlap
  const seen = new Set<number>();
  return prs.filter((pr) => {
    if (seen.has(pr.number)) return false;
    seen.add(pr.number);
    return true;
  });
}
