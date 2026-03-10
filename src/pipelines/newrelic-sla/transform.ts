import { RawNewRelicResult, NewRelicRecord } from "./types.js";

const MONTH_NAMES: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

function parseNrqlMonth(monthStr: string): string {
  // NerdGraph monthOf() returns "February 2026"
  const parts = monthStr.split(" ");
  const monthName = parts[0];
  const year = parts[1];
  const mm = MONTH_NAMES[monthName];
  if (!mm || !year) {
    return monthStr;
  }
  return `${year}-${mm}`;
}

export function transformRecords(raw: RawNewRelicResult[]): NewRelicRecord[] {
  return raw.map((r) => {
    const base = {
      appName: r.appName,
      dataType: r.dataType,
      month: parseNrqlMonth(r.month),
      errorRatePercent: r.errorRatePercent,
    } as NewRelicRecord;

    if (r.dataType === "apm-sla") {
      base.apdex = r.apdex;
      base.satisfiedPercent = r.satisfiedPercent;
      base.responseTimeMs = r.responseTimeMs;
      base.throughputRpm = r.throughputRpm;
    }

    return base;
  });
}
