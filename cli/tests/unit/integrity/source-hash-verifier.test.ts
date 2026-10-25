import { describe, it, expect, vi } from "vitest";
import { verifyClientSourceHashes, verifyRepositorySourceHashes } from "../../../src/integrity/source-hash-verifier";
import { SkillSource } from "../../../src/types/index";
import type { StandardsSource } from "../../../src/types/index";
import { mockLock } from "../../fixtures/builders";

vi.mock("../../../src/skills/source-fetcher.js", () => ({
  fetchRepositorySource: vi.fn(),
}));

import { fetchRepositorySource } from "../../../src/skills/source-fetcher";

const mockedFetchRepositorySource = vi.mocked(fetchRepositorySource);

describe("verifyClientSourceHashes", () => {
  it("passes on matching hashes", () => {
    const sources: StandardsSource[] = [
      { type: SkillSource.Client, id: "client-a", sha256: "hash-a", skillsDir: "/tmp/client-a" },
    ];
    const lock = mockLock({ sources: {
        client: [{ id: "client-a", source: "path", sha256: "hash-a" }],
      },
    });

    expect(() => verifyClientSourceHashes(sources, lock)).not.toThrow();
  });

  it("throws on mismatched hash", () => {
    const sources: StandardsSource[] = [
      { type: SkillSource.Client, id: "client-a", sha256: "wrong-hash", skillsDir: "/tmp/client-a" },
    ];
    const lock = mockLock({ sources: {
        client: [{ id: "client-a", source: "path", sha256: "expected-hash" }],
      },
    });

    expect(() => verifyClientSourceHashes(sources, lock)).toThrow("integrity verification failed");
  });

  it("throws when locked client source not found", () => {
    const sources: StandardsSource[] = [];
    const lock = mockLock({ sources: {
        client: [{ id: "missing-client", source: "path", sha256: "hash" }],
      },
    });

    expect(() => verifyClientSourceHashes(sources, lock)).toThrow("integrity verification failed");
  });

  it("passes when no client sources locked", () => {
    const sources: StandardsSource[] = [];
    const lock = mockLock({ sources: {} });

    expect(() => verifyClientSourceHashes(sources, lock)).not.toThrow();
  });
});

describe("verifyRepositorySourceHashes", () => {
  it("passes on matching hashes", async () => {
    const sources: StandardsSource[] = [
      { type: SkillSource.Repository, id: "repo-a", sha256: "hash-a", skillsDir: "/tmp/repo-a" },
    ];
    const lock = mockLock({ sources: {
        repository: [{ id: "repo-a", path: ".standards", sha256: "hash-a" }],
      },
    });

    await expect(verifyRepositorySourceHashes(sources, lock, "/project")).resolves.not.toThrow();
  });

  it("throws on mismatched hash", async () => {
    const sources: StandardsSource[] = [
      { type: SkillSource.Repository, id: "repo-a", sha256: "wrong-hash", skillsDir: "/tmp/repo-a" },
    ];
    const lock = mockLock({ sources: {
        repository: [{ id: "repo-a", path: ".standards", sha256: "expected-hash" }],
      },
    });

    await expect(verifyRepositorySourceHashes(sources, lock, "/project")).rejects.toThrow("integrity verification failed");
  });

  it("fetches and verifies when source not in resolved list", async () => {
    mockedFetchRepositorySource.mockResolvedValueOnce({
      type: SkillSource.Repository,
      id: "repo-a",
      sha256: "fetched-hash",
      skillsDir: "/tmp/fetched",
    });

    const sources: StandardsSource[] = [];
    const lock = mockLock({ sources: {
        repository: [{ id: "repo-a", path: ".standards", sha256: "fetched-hash" }],
      },
    });

    await expect(verifyRepositorySourceHashes(sources, lock, "/project")).resolves.not.toThrow();
  });

  it("throws when fetched source hash mismatches", async () => {
    mockedFetchRepositorySource.mockResolvedValueOnce({
      type: SkillSource.Repository,
      id: "repo-a",
      sha256: "wrong-fetched-hash",
      skillsDir: "/tmp/fetched",
    });

    const sources: StandardsSource[] = [];
    const lock = mockLock({ sources: {
        repository: [{ id: "repo-a", path: ".standards", sha256: "expected-hash" }],
      },
    });

    await expect(verifyRepositorySourceHashes(sources, lock, "/project")).rejects.toThrow("integrity verification failed");
  });

  it("passes when no repository sources locked", async () => {
    const sources: StandardsSource[] = [];
    const lock = mockLock({ sources: {} });

    await expect(verifyRepositorySourceHashes(sources, lock, "/project")).resolves.not.toThrow();
  });
});
