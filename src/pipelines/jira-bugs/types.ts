export interface JiraBugsExtractOptions {
  projectKey: string;
  since: string;
  until?: string;
  customerBugsFilter: string;
  severityFieldName: string;
}
