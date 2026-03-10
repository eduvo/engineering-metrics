export interface NewRelicErrorsExtractOptions {
  apps: string[];
  since: string;
  until?: string;
}

export interface RawNewRelicResult {
  appName: string;
  month: string;
  dataType: "apm-sla" | "javascript";
  errorRatePercent: number;
  apdex?: number;
  satisfiedPercent?: number;
  responseTimeMs?: number;
  throughputRpm?: number;
}

export interface NewRelicRecord {
  appName: string;
  dataType: "apm-sla" | "javascript";
  month: string;
  errorRatePercent: number;
  apdex?: number;
  satisfiedPercent?: number;
  responseTimeMs?: number;
  throughputRpm?: number;
}
