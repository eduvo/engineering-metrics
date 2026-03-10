import { GitHubPullRequest } from "../../shared/github-types.js";
import { PRRecord } from "./types.js";

export function transformPRs(prs: GitHubPullRequest[], repos: string[]): PRRecord[] {
  // Build a lookup to find which repo each PR belongs to
  // Since we get PRs per-repo in extract, we tag them by matching repo from the URL
  return prs.map((pr) => {
    const repo = extractRepoFromUrl(pr.html_url, repos);
    const mergedAt = pr.pull_request?.merged_at ?? null;
    const closedDate = mergedAt ?? pr.closed_at;
    const createdDate = pr.created_at;

    let timeToCloseDays: number | null = null;
    if (closedDate) {
      const diffMs = new Date(closedDate).getTime() - new Date(createdDate).getTime();
      timeToCloseDays = parseFloat((diffMs / (1000 * 60 * 60 * 24)).toFixed(2));
    }

    return {
      repo,
      number: pr.number,
      title: pr.title,
      author: pr.user?.login ?? "unknown",
      createdAt: pr.created_at,
      closedAt: pr.closed_at,
      mergedAt,
      timeToCloseDays,
      url: pr.html_url,
    };
  });
}

function extractRepoFromUrl(htmlUrl: string, repos: string[]): string {
  for (const repo of repos) {
    if (htmlUrl.includes(repo)) return repo;
  }
  // Fallback: extract from URL pattern https://github.com/{owner}/{repo}/pull/{number}
  const match = htmlUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull/);
  return match ? match[1] : "unknown";
}
