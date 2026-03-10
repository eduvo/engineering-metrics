import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");

export async function saveJson(pipelineName: string, data: unknown): Promise<string> {
  await mkdir(DATA_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${pipelineName}-${timestamp}.json`;
  const filePath = path.join(DATA_DIR, filename);

  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

  return filePath;
}
