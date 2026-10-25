import { describe, it, expect } from "vitest";
import {
  CodeFlexError,
  ConfigValidationError,
  LockfileMissingError,
  IntegrityError,
  ResolutionConflictError,
} from "../../../src/utils/errors";

describe("CodeFlexError", () => {
  it("has correct name, message, code, and detail", () => {
    const err = new CodeFlexError("something broke", "TEST_ERROR", "detail info");
    expect(err.message).toBe("something broke");
    expect(err.code).toBe("TEST_ERROR");
    expect(err.detail).toBe("detail info");
    expect(err.name).toBe("CodeFlexError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CodeFlexError);
  });

  it("works without detail", () => {
    const err = new CodeFlexError("msg", "CODE");
    expect(err.detail).toBeUndefined();
  });
});

describe("ConfigValidationError", () => {
  it("has CONFIG_VALIDATION_ERROR code", () => {
    const err = new ConfigValidationError("bad config", "field X is missing");
    expect(err.code).toBe("CONFIG_VALIDATION_ERROR");
    expect(err.name).toBe("ConfigValidationError");
    expect(err).toBeInstanceOf(CodeFlexError);
    expect(err.detail).toBe("field X is missing");
  });
});

describe("LockfileMissingError", () => {
  it("has default message", () => {
    const err = new LockfileMissingError();
    expect(err.code).toBe("LOCKFILE_MISSING");
    expect(err.message).toContain("engineering.lock");
  });

  it("accepts custom message", () => {
    const err = new LockfileMissingError("custom");
    expect(err.message).toBe("custom");
  });
});

describe("IntegrityError", () => {
  it("has INTEGRITY_ERROR code", () => {
    const err = new IntegrityError("hash mismatch");
    expect(err.code).toBe("INTEGRITY_ERROR");
    expect(err).toBeInstanceOf(CodeFlexError);
  });
});

describe("ResolutionConflictError", () => {
  it("has RESOLUTION_CONFLICT code", () => {
    const err = new ResolutionConflictError("conflict");
    expect(err.code).toBe("RESOLUTION_CONFLICT");
    expect(err).toBeInstanceOf(CodeFlexError);
  });
});
