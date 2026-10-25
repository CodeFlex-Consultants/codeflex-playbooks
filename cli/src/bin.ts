#!/usr/bin/env node

import { createProgram } from "./cli/index";
import { CodeFlexError, SilentExitError, errorMessage } from "./utils/errors";

const program = await createProgram();
program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof SilentExitError) {
    process.exit(error.exitCode);
  }
  if (error instanceof CodeFlexError) {
    process.stderr.write(`Error: ${error.message}\n`);
    if (error.detail) {
      process.stderr.write(`  ${error.detail}\n`);
    }
    process.exit(error.exitCode);
  }
  const message = errorMessage(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
