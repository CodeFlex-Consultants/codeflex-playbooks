import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleReporter, Verbosity, resolveVerbosity } from "../../src/cli/reporter";

describe("ConsoleReporter", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("routes info/warn to console.log and error to console.error at Normal verbosity", () => {
    const reporter = new ConsoleReporter(Verbosity.Normal);

    reporter.info("info message");
    reporter.warn("warn message");
    reporter.error("error message");
    reporter.debug("debug message");

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith("info message");
    expect(logSpy).toHaveBeenCalledWith("warn message");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("error message");
  });

  it("shows only errors at Quiet verbosity", () => {
    const reporter = new ConsoleReporter(Verbosity.Quiet);

    reporter.info("info message");
    reporter.warn("warn message");
    reporter.error("error message");
    reporter.debug("debug message");

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("error message");
  });

  it("shows all messages at Verbose verbosity", () => {
    const reporter = new ConsoleReporter(Verbosity.Verbose);

    reporter.debug("debug message");
    reporter.info("info message");
    reporter.warn("warn message");
    reporter.error("error message");

    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(logSpy).toHaveBeenCalledWith("debug message");
    expect(logSpy).toHaveBeenCalledWith("info message");
    expect(logSpy).toHaveBeenCalledWith("warn message");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("error message");
  });

  it("defaults to Normal verbosity", () => {
    const reporter = new ConsoleReporter();

    reporter.debug("debug message");
    reporter.info("info message");

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("info message");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("always writes errors regardless of verbosity", () => {
    const quietReporter = new ConsoleReporter(Verbosity.Quiet);
    quietReporter.error("quiet error");
    expect(errorSpy).toHaveBeenCalledWith("quiet error");

    errorSpy.mockClear();
    const normalReporter = new ConsoleReporter(Verbosity.Normal);
    normalReporter.error("normal error");
    expect(errorSpy).toHaveBeenCalledWith("normal error");

    errorSpy.mockClear();
    const verboseReporter = new ConsoleReporter(Verbosity.Verbose);
    verboseReporter.error("verbose error");
    expect(errorSpy).toHaveBeenCalledWith("verbose error");
  });
});

describe("resolveVerbosity", () => {
  it("returns Normal by default", () => {
    expect(resolveVerbosity({})).toBe(Verbosity.Normal);
  });

  it("returns Verbose when verbose is true", () => {
    expect(resolveVerbosity({ verbose: true })).toBe(Verbosity.Verbose);
  });

  it("returns Quiet when quiet is true", () => {
    expect(resolveVerbosity({ quiet: true })).toBe(Verbosity.Quiet);
  });

  it("prefers quiet over verbose when both are set", () => {
    expect(resolveVerbosity({ verbose: true, quiet: true })).toBe(Verbosity.Quiet);
  });
});
