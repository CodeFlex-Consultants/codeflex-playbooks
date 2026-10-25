import { describe, it, expect } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateBootstrapFile } from "../../../src/agents-md/bootstrap-file";

const defaultConfig = {
  relativePath: "TESTFILE.md",
  harnessName: "test-harness",
  expectedContent: "@AGENTS.md\n",
  marker: "@AGENTS.md",
};

describe("generateBootstrapFile", () => {
  it("should skip when harness is not included", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["other"] },
        defaultConfig,
      );

      expect(result.action).toBe("skipped");
      expect(result.path).toBe(join(tempDir, "TESTFILE.md"));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should create file when it does not exist", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["test-harness"] },
        defaultConfig,
      );

      expect(result.action).toBe("created");
      const content = await readFile(join(tempDir, "TESTFILE.md"), "utf-8");
      expect(content).toBe("@AGENTS.md\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should return unchanged when file already contains marker", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      await writeFile(join(tempDir, "TESTFILE.md"), "@AGENTS.md\n", "utf-8");

      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["test-harness"] },
        defaultConfig,
      );

      expect(result.action).toBe("unchanged");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should prepend content when file exists without marker", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      await writeFile(join(tempDir, "TESTFILE.md"), "# Existing\n", "utf-8");

      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["test-harness"] },
        defaultConfig,
      );

      expect(result.action).toBe("updated");
      const content = await readFile(join(tempDir, "TESTFILE.md"), "utf-8");
      expect(content).toBe("@AGENTS.md\n# Existing\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not write files in dryRun mode", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["test-harness"], dryRun: true },
        defaultConfig,
      );

      expect(result.action).toBe("created");

      let exists = false;
      try {
        await readFile(join(tempDir, "TESTFILE.md"));
        exists = true;
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should create parent directories when ensureParentDir is true", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["test-harness"] },
        { ...defaultConfig, relativePath: ".nested/dir/TESTFILE.md", ensureParentDir: true },
      );

      expect(result.action).toBe("created");
      const content = await readFile(join(tempDir, ".nested", "dir", "TESTFILE.md"), "utf-8");
      expect(content).toBe("@AGENTS.md\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should handle nested paths without ensureParentDir when dir exists", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      await mkdir(join(tempDir, ".nested", "dir"), { recursive: true });

      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["test-harness"] },
        { ...defaultConfig, relativePath: ".nested/dir/TESTFILE.md" },
      );

      expect(result.action).toBe("created");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should match harness from multiple harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["codex", "test-harness", "kilo"] },
        defaultConfig,
      );

      expect(result.action).toBe("created");
      const content = await readFile(join(tempDir, "TESTFILE.md"), "utf-8");
      expect(content).toBe("@AGENTS.md\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should return correct path in result", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["other"] },
        { ...defaultConfig, relativePath: "subdir/FILE.md" },
      );

      expect(result.path).toBe(join(tempDir, "subdir/FILE.md"));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not write in dryRun mode when updating", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      await writeFile(join(tempDir, "TESTFILE.md"), "# Existing\n", "utf-8");

      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["test-harness"], dryRun: true },
        defaultConfig,
      );

      expect(result.action).toBe("updated");

      const content = await readFile(join(tempDir, "TESTFILE.md"), "utf-8");
      expect(content).toBe("# Existing\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should detect marker anywhere in content", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    try {
      await writeFile(join(tempDir, "TESTFILE.md"), "# Header\n\nSome text\n@AGENTS.md\nMore text\n", "utf-8");

      const result = await generateBootstrapFile(
        { projectRoot: tempDir, harnesses: ["test-harness"] },
        defaultConfig,
      );

      expect(result.action).toBe("unchanged");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
