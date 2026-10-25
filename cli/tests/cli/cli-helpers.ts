import { mkdir } from "node:fs/promises";
import { createProgram } from "../../src/cli/index";
import { CodeFlexError, SilentExitError } from "../../src/utils/errors";
import { fakeHomeFor, withFakeHome } from "../helpers";

export {
  fakeHomeFor,
  resolveProjectionPath,
  setupInitializedProject,
  withFakeHome,
  withTempFixture,
  withEmptyTempDir,
} from "../helpers";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error: unknown;
}

export async function runCli(args: string[], cwd: string): Promise<CliResult> {
  const originalCwd = process.cwd();
  const originalExit = process.exit;
  const originalLog = console.log;
  const originalError = console.error;

  const fakeHome = fakeHomeFor(cwd);
  await mkdir(fakeHome, { recursive: true });

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let exitCode = 0;
  let caughtError: unknown = undefined;

  return withFakeHome(fakeHome, async () => {
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
    }) as typeof process.exit;

    console.log = ((...args: unknown[]) => {
      stdoutLines.push(args.map(String).join(" "));
    }) as typeof console.log;

    console.error = ((...args: unknown[]) => {
      stderrLines.push(args.map(String).join(" "));
    }) as typeof console.error;

    try {
      process.chdir(cwd);
      const program = await createProgram();
      program.exitOverride();
      program.configureOutput({
        writeOut: (str) => stdoutLines.push(str),
        writeErr: (str) => stderrLines.push(str),
      });

      await program.parseAsync(["node", "codeflex-playbooks", ...args]);
    } catch (err: unknown) {
      caughtError = err;
      if (err instanceof SilentExitError) {
        exitCode = err.exitCode;
      } else if (err instanceof CodeFlexError) {
        exitCode = err.exitCode;
      } else if (err && typeof err === "object" && "code" in err) {
        const code = (err as { code?: string }).code;
        if (code === "commander.helpDisplayed" || code === "commander.help") {
          exitCode = 0;
        } else if (code?.startsWith("commander.")) {
          exitCode = 1;
        } else {
          exitCode = 1;
        }
      } else if (err) {
        exitCode = 1;
      }
    } finally {
      process.chdir(originalCwd);
      process.exit = originalExit;
      console.log = originalLog;
      console.error = originalError;
    }

    return {
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
      exitCode,
      error: caughtError,
    };
  });
}
