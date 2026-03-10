import { ETLResult, PipelineSummary } from "../types.js";

export abstract class Pipeline<TRaw, TTransformed> {
  abstract readonly name: string;

  abstract extract(): Promise<TRaw[]>;
  abstract transform(raw: TRaw[]): TTransformed[];
  abstract summarize(records: TTransformed[]): PipelineSummary;
  abstract load(records: TTransformed[], summary: PipelineSummary): Promise<string>;

  async run(): Promise<ETLResult> {
    const startedAt = new Date().toISOString();

    console.log(`[${this.name}] Extracting...`);
    const raw = await this.extract();
    console.log(`[${this.name}] Extracted ${raw.length} raw records`);

    console.log(`[${this.name}] Transforming...`);
    const transformed = this.transform(raw);
    console.log(`[${this.name}] Transformed into ${transformed.length} metric records`);

    const summary = this.summarize(transformed);

    console.log(`[${this.name}] Loading...`);
    const outputPath = await this.load(transformed, summary);

    const finishedAt = new Date().toISOString();
    console.log(`[${this.name}] Done -> ${outputPath}`);

    return {
      pipelineName: this.name,
      recordCount: transformed.length,
      summary,
      outputPath,
      startedAt,
      finishedAt,
    };
  }
}
