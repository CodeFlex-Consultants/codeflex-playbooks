import type { Command } from "commander";
import { existsSync } from "node:fs";
import { buildContext } from "./context";
import { runInit } from "./init";
import { runSync } from "./sync";
import { createReporterFromCommand } from "./reporter";
import { codeflexDir } from "../config/index";

export function registerEnterCommand(program: Command): void {
  program
    .command("enter")
    .description("Enter or switch to a CodeFlex project (refreshes AGENTS.md and projections)")
    .action(async (_options, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const context = await buildContext();
      const projectRoot = context.projectRoot;
      const codeflexDirPath = codeflexDir(projectRoot);

      if (!existsSync(codeflexDirPath)) {
        await runInit(projectRoot, { force: false, reporter });
      } else {
        await runSync(projectRoot, { reporter });
      }
    });
}
