export interface GitHubUser {
  login: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  user: GitHubUser | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  pull_request?: {
    merged_at: string | null;
  };
}
