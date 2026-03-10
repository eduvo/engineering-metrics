import { Pipeline } from "../base.js";
import { PipelineSummary } from "../../types.js";
import { NewRelicConfig } from "../../config.js";
import { RawNewRelicResult, NewRelicRecord, NewRelicErrorsExtractOptions } from "./types.js";
import { extractNewRelicErrors } from "./extract.js";
import { transformRecords } from "./transform.js";
import { summarizeErrors } from "./summarize.js";
import { saveJson } from "../../loaders/json-loader.js";

export { summarizeAll } from "./summarize.js";
export type { ErrorsSummary } from "./summarize.js";

export class NewRelicErrorsPipeline extends Pipeline<RawNewRelicResult, NewRelicRecord> {
  readonly name = "newrelic-sla";

  constructor(
    private config: NewRelicConfig,
    private options: NewRelicErrorsExtractOptions,
  ) {
    super();
  }

  async extract(): Promise<RawNewRelicResult[]> {
    return extractNewRelicErrors(this.config, this.options);
  }

  transform(raw: RawNewRelicResult[]): NewRelicRecord[] {
    return transformRecords(raw);
  }

  summarize(records: NewRelicRecord[]): PipelineSummary {
    return summarizeErrors(records) as unknown as PipelineSummary;
  }

  async load(records: NewRelicRecord[], summary: PipelineSummary): Promise<string> {
    return saveJson(this.name, { summary, records });
  }
}
