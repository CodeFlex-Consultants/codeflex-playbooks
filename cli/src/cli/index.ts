import { Command } from "commander";
import { registerInitCommand } from "./init";
import { registerSyncCommand } from "./sync";
import { registerUpdateCommand } from "./update";
import { registerCheckCommand } from "./check";
import { registerDetectCommand } from "./detect";
import { registerExplainCommand } from "./explain";
import { registerStatusCommand } from "./status";
import { registerEnterCommand } from "./enter";
import { registerCleanCommand } from "./clean";
import { registerDiffCommand } from "./diff";
import { registerMigrateCommand } from "./migrate";
import { registerDoctorCommand } from "./doctor";
import { readCliVersion } from "./version";
import { CLI_NAME } from "../constants";

export async function createProgram(): Promise<Command> {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description(
      "Detect project technologies, resolve engineering standards, and distribute Agent Skills to application repositories"
    )
    .version(await readCliVersion())
    .option("-C, --project-root <path>", "Run as if the project root was <path>")
    .option("--verbose", "Enable verbose output")
    .option("--quiet", "Only show errors");

  registerInitCommand(program);
  registerSyncCommand(program);
  registerUpdateCommand(program);
  registerCheckCommand(program);
  registerDetectCommand(program);
  registerExplainCommand(program);
  registerStatusCommand(program);
  registerEnterCommand(program);
  registerCleanCommand(program);
  registerDiffCommand(program);
  registerMigrateCommand(program);
  registerDoctorCommand(program);

  return program;
}
