export enum Verbosity {
  Quiet = 0,
  Normal = 1,
  Verbose = 2,
}

export interface Reporter {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class ConsoleReporter implements Reporter {
  private readonly verbosity: Verbosity;

  constructor(verbosity: Verbosity = Verbosity.Normal) {
    this.verbosity = verbosity;
  }

  debug(message: string): void {
    if (this.verbosity >= Verbosity.Verbose) {
      console.log(message);
    }
  }

  info(message: string): void {
    if (this.verbosity >= Verbosity.Normal) {
      console.log(message);
    }
  }

  warn(message: string): void {
    if (this.verbosity >= Verbosity.Normal) {
      console.log(message);
    }
  }

  error(message: string): void {
    console.error(message);
  }
}

export const consoleReporter: Reporter = new ConsoleReporter();

export function resolveVerbosity(options: { verbose?: boolean; quiet?: boolean }): Verbosity {
  if (options.quiet) return Verbosity.Quiet;
  if (options.verbose) return Verbosity.Verbose;
  return Verbosity.Normal;
}

export function createReporterFromCommand(command: import("commander").Command): Reporter {
  const globalOpts = command.optsWithGlobals() as { verbose?: boolean; quiet?: boolean };
  return new ConsoleReporter(resolveVerbosity(globalOpts));
}
