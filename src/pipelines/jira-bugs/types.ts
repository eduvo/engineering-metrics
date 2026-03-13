export interface JiraBugsExtractOptions {
  since: string;
  until?: string;
  customerBugsFilter: string;
  severityFieldName: string;
}
