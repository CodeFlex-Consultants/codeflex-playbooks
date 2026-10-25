import { stat, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CodeFlexSource, ReleaseManifest } from "../types/index";
import { CodeFlexSourceType, SkillSource } from "../types/index";
import { sha256Directory } from "../utils/hash";
import { SourceFetchError, errorMessage, wrapSourceFetchError } from "../utils/errors";
import { ensureDir } from "../utils/fs";
import { releaseManifestSchema } from "../types/schemas";
import type { FetchCodeFlexResult } from "./source-fetcher";
import { execFileAsync } from "../utils/exec";
import { formatZodIssues } from "../utils/yaml";

export async function fetchCodeFlexReleaseSource(
  source: Extract<CodeFlexSource, { type: CodeFlexSourceType.Release }>,
  release?: string
): Promise<FetchCodeFlexResult> {
  const { url, expectedSha256 } = source;

  let tempDir: string | undefined;
  try {
    tempDir = await mkdtemp(join(tmpdir(), "codeflex-release-"));

    const archivePath = join(tempDir, "artifact.tar.gz");
    const extractDir = join(tempDir, "extracted");
    await ensureDir(extractDir);

    const response = await fetch(url);
    if (!response.ok) {
      throw new SourceFetchError(
        `Failed to download release artifact: ${response.status} ${response.statusText}`,
        `The release artifact could not be downloaded from ${url}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    await writeFile(archivePath, Buffer.from(arrayBuffer));

    try {
      await execFileAsync("tar", ["xzf", archivePath, "-C", extractDir], { timeout: 60_000 });
    } catch (err) {
      const message = errorMessage(err);
      throw new SourceFetchError(
        `Failed to extract release artifact: ${message}`,
        "The downloaded artifact could not be extracted. Ensure it is a valid tar.gz archive."
      );
    }

    const manifestPath = join(extractDir, "release-manifest.json");

    let manifestContent: string;
    try {
      manifestContent = await readFile(manifestPath, "utf-8");
    } catch {
      throw new SourceFetchError(
        `Release manifest not found in artifact`,
        "The release artifact does not contain a release-manifest.json file"
      );
    }

    const parsed: unknown = JSON.parse(manifestContent);
    const manifestResult = releaseManifestSchema.safeParse(parsed);
    if (!manifestResult.success) {
      throw new SourceFetchError(
        `Invalid release manifest: ${formatZodIssues(manifestResult.error)}`,
        "The release-manifest.json does not match the expected schema"
      );
    }

    const manifest = manifestResult.data as ReleaseManifest;

    if (manifest.attestation && !manifest.attestation.verified) {
      throw new SourceFetchError(
        `Release attestation is not verified (type: ${manifest.attestation.type})`,
        "The release attestation has not been verified"
      );
    }

    const skillsDir = join(extractDir, "skills");
    try {
      await stat(skillsDir);
    } catch {
      throw new SourceFetchError(
        `Skills directory not found in release artifact`,
        "The release artifact does not contain a skills/ directory"
      );
    }

    const sha = await sha256Directory(skillsDir);

    if (sha !== expectedSha256) {
      throw new SourceFetchError(
        `Release SHA-256 mismatch: expected ${expectedSha256}, got ${sha}`,
        "The computed SHA-256 of the skills directory does not match the expected value"
      );
    }

    return {
      source: {
        type: SkillSource.CodeFlex,
        release: release ?? manifest.release,
        commit: manifest.commit,
        sha256: sha,
        skillsDir,
        cleanupPath: tempDir,
      },
      warnings: [],
    };
  } catch (err) {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    if (err instanceof SourceFetchError) {
      throw err;
    }

    wrapSourceFetchError(err, `Failed to fetch codeflex release source: ${url}`);
  }
}
