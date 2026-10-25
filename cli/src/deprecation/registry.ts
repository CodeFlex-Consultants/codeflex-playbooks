import { join } from "node:path";
import { pathExists } from "../utils/fs";
import { DeprecationCategory, DeprecationSeverity, type DeprecationEntry } from "./types";

const LEGACY_CURSOR_RULES_FILE: DeprecationEntry = {
  id: "LEGACY_CURSOR_RULES_FILE",
  category: DeprecationCategory.HarnessBootstrap,
  severity: DeprecationSeverity.Warning,
  title: "Legacy .cursorrules file detected",
  description: "The .cursorrules file at the project root is a deprecated Cursor format.",
  replacement: "Use .cursor/rules/ directory for Cursor rules. Run 'codeflex-playbooks sync' to regenerate.",
  migrationCommand: "codeflex-playbooks sync",
  detect: async (projectRoot: string): Promise<boolean> => {
    const legacyPath = join(projectRoot, ".cursorrules");
    return pathExists(legacyPath);
  },
};

const LEGACY_KILOCODE_DIRECTORY: DeprecationEntry = {
  id: "LEGACY_KILOCODE_DIRECTORY",
  category: DeprecationCategory.DirectoryStructure,
  severity: DeprecationSeverity.Warning,
  title: "Legacy .kilocode/ directory detected",
  description: "The .kilocode/ directory is deprecated in favor of .kilo/.",
  replacement: "Use .kilo/ directory for Kilo Code configuration.",
  detect: async (projectRoot: string): Promise<boolean> => {
    const legacyPath = join(projectRoot, ".kilocode");
    return pathExists(legacyPath);
  },
};

const LEGACY_CODEFLEX_STATE_DIRECTORY: DeprecationEntry = {
  id: "LEGACY_CODEFLEX_STATE_DIRECTORY",
  category: DeprecationCategory.DirectoryStructure,
  severity: DeprecationSeverity.Error,
  title: "Legacy CodeFlex state directory detected",
  description: "Found both .codeflex/ and legacy state directories. Only .codeflex/ should be used.",
  replacement: "Remove legacy state directories and use .codeflex/ exclusively.",
  migrationCommand: "codeflex-playbooks init --force",
  detect: async (projectRoot: string): Promise<boolean> => {
    const codeflexPath = join(projectRoot, ".codeflex");
    const legacyPaths = [
      join(projectRoot, ".engineering"),
    ];
    
    const [codeflexExists, ...legacyExists] = await Promise.all([
      pathExists(codeflexPath),
      ...legacyPaths.map((p) => pathExists(p)),
    ]);
    
    return codeflexExists && legacyExists.some((exists) => exists);
  },
};

const MOVED_BACKEND_SKILLS = ["caching", "nosql", "postgres"] as const;

const LEGACY_BACKEND_SKILLS_DIRECTORY: DeprecationEntry = {
  id: "LEGACY_BACKEND_SKILLS_DIRECTORY",
  category: DeprecationCategory.DirectoryStructure,
  severity: DeprecationSeverity.Warning,
  title: "Legacy backend/ skills detected (caching, nosql, postgres)",
  description: "The caching, nosql, and postgres skills have moved from backend/ to architecture/.",
  replacement: "Run 'codeflex-playbooks sync' to update to the new directory structure.",
  migrationCommand: "codeflex-playbooks sync",
  detect: async (projectRoot: string): Promise<boolean> => {
    const backendPath = join(projectRoot, ".codeflex", "skills", "backend");
    const checks = await Promise.all(
      MOVED_BACKEND_SKILLS.map((skill) => pathExists(join(backendPath, skill))),
    );
    return checks.some((exists) => exists);
  },
};

export const DEPRECATION_REGISTRY: readonly DeprecationEntry[] = [
  LEGACY_CURSOR_RULES_FILE,
  LEGACY_KILOCODE_DIRECTORY,
  LEGACY_CODEFLEX_STATE_DIRECTORY,
  LEGACY_BACKEND_SKILLS_DIRECTORY,
];
