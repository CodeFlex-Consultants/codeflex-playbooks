import { execFile as execFileCb, exec as execCb } from "node:child_process";
import { promisify } from "node:util";

export const execFile = promisify(execFileCb);
export const exec = promisify(execCb);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export async function execFileAsync(
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<ExecResult> {
  const result = await execFile(command, args, { ...options, encoding: "utf-8" });
  return { stdout: result.stdout, stderr: result.stderr };
}
