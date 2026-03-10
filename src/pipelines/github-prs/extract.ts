import { GitHubPullRequest } from "../../shared/github-types.js";
import { fetchGitHubPullRequests } from "../../shared/github-api.js";
import { GitHubPRsExtractOptions } from "./types.js";

export async function extractGitHubPRs(
  token: string,
  options: GitHubPRsExtractOptions,
): Promise<GitHubPullRequest[]> {
  const allPRs: GitHubPullRequest[] = [];

  for (const repo of options.repos) {
    const prs = await fetchGitHubPullRequests(token, {
      repo,
      since: options.since,
      until: options.until,
    });
    allPRs.push(...prs);
  }

  return allPRs;
}
