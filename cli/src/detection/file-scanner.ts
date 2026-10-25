import { glob } from "glob";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { K8S_DIRECTORY_PATTERNS } from "./k8s-patterns";

// "templates/" is an extremely common directory name across unrelated ecosystems (Angular,
// Jinja/Django, CI configs, generic app folders, etc.). Scanning it unconditionally would force
// an unbounded recursive glob on every project run for negligible payoff. It is only added to
// the scan once a cheaper, more specific Kubernetes/Helm signal has already been found.
const KUBERNETES_TEMPLATES_PATTERN = "**/templates/**/*.{yaml,yml}";

const KUBERNETES_SIGNAL_PATTERNS = [
  "**/Chart.yaml",
  "**/Chart.yml",
  "**/kustomization.yaml",
  "**/kustomization.yml",
  "**/k8s/**/*.{yaml,yml}",
  "**/kubernetes/**/*.{yaml,yml}",
  "**/deploy/**/*.{yaml,yml}",
  "**/manifests/**/*.{yaml,yml}",
  "**/helm/**/*.{yaml,yml}",
];

export async function scanProjectFiles(projectRoot: string): Promise<string[]> {
  let gitignorePatterns: string[] = [];
  try {
    const gitignoreContent = await readFile(join(projectRoot, ".gitignore"), "utf-8");
    gitignorePatterns = gitignoreContent
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#") && !line.startsWith("!"))
      .map(pattern => {
        if (pattern.startsWith("/")) {
          return pattern.substring(1);
        }
        if (pattern.endsWith("/")) {
          return pattern + "**";
        }
        return pattern;
      });
  } catch (err) {
    // Silently ignore if .gitignore doesn't exist - it's optional
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to read .gitignore:", err.message);
    }
  }

  const patterns = [
    "**/*.{csproj,fsproj,vbproj,sln,slnx,bicep,tf}",
    "**/package.json",
    "**/angular.json",
    "**/.angular.json",
    "**/global.json",
    "**/pom.xml",
    "**/AndroidManifest.xml",
    "{src,lib,app,packages,modules}/**/*.{vue,svelte,py,go,rs,java,kt,kts,swift}",
    "**/Dockerfile",
    "**/docker-compose.yml",
    "**/azure-pipelines.yml",
    "**/.github/workflows/*.yml",
    "**/build.gradle",
    "**/build.gradle.kts",
    "**/settings.gradle.kts",
    "**/Info.plist",
    "**/*.xcodeproj/project.pbxproj",
    "**/*.xcworkspace/contents.xcworkspacedata",
    "**/Podfile",
    "**/Package.swift",
    "**/requirements.txt",
    "**/pyproject.toml",
    "**/Pipfile",
    "**/setup.py",
    "**/uv.lock",
    "**/.python-version",
    "**/pylock.toml",
    "**/go.mod",
    "**/go.sum",
    "**/Cargo.toml",
    "**/Cargo.lock",
    "**/nuxt.config.{ts,js,mjs}",
    "**/svelte.config.{js,ts}",
    "**/playwright.config.{ts,js,mjs,cjs}",
    "**/tailwind.config.{js,ts,mjs,cjs}",
    "**/prisma/schema.prisma",
    "**/contract.prisma",
    "**/prisma.config.{ts,js,mjs,cjs,mts,cts}",
    "**/packages.config",
    ...KUBERNETES_SIGNAL_PATTERNS,
  ];

  const ignore = [
    "**/node_modules/**",
    "**/dist/**",
    "**/bin/**",
    "**/obj/**",
    "**/.git/**",
    "**/.codeflex/**",
    "**/coverage/**",
    "**/tests/fixtures/**",
    "**/test/fixtures/**",
    "**/__tests__/fixtures/**",
    "**/__fixtures__/**",
    ...gitignorePatterns,
  ];

  const files = await glob(patterns, {
    cwd: projectRoot,
    ignore,
    nodir: true,
    dot: false,
  });

  if (hasKubernetesSignal(files)) {
    const templateFiles = await glob(KUBERNETES_TEMPLATES_PATTERN, {
      cwd: projectRoot,
      ignore,
      nodir: true,
      dot: false,
    });
    files.push(...templateFiles);
  }

  return [...new Set(files)].sort();
}

/** Whether a cheaper, more specific Kubernetes/Helm file was already found, justifying the
 * broader (and costlier) `templates/**` scan for chart templates. Reuses the same directory
 * pattern list as `detectors/kubernetes.ts` so the two checks cannot drift apart; basename
 * endings for `Chart.yaml`/`kustomization.yaml` are checked separately since those are exact
 * file matches rather than directory signals. */
function hasKubernetesSignal(files: string[]): boolean {
  return files.some((file) => {
    const lower = file.toLowerCase();
    return (
      lower.endsWith("chart.yaml") ||
      lower.endsWith("chart.yml") ||
      lower.endsWith("kustomization.yaml") ||
      lower.endsWith("kustomization.yml") ||
      K8S_DIRECTORY_PATTERNS.some((pattern) => lower.includes(pattern))
    );
  });
}
