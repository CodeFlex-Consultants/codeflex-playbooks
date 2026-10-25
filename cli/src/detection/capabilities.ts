import type { Capability, DetectedTechnology } from "../types/index";

const TECHNOLOGY_CAPABILITY_MAP: Record<string, Capability[]> = {
  "entity-framework-core": ["database", "persistence", "query", "migration"],
  "entity-framework-6": ["database", "persistence", "query", "migration"],
  "aspnet-core": ["api", "backend"],
  angular: ["frontend", "ui"],
  "angular-material": ["frontend", "ui"],
  ngxs: ["frontend", "state-management"],
  react: ["frontend", "ui"],
  nextjs: ["frontend", "ui", "ssr"],
  "react-native": ["mobile", "ui"],
  vue: ["frontend", "ui"],
  nuxt: ["frontend", "ui", "ssr"],
  svelte: ["frontend", "ui"],
  sveltekit: ["frontend", "ui", "ssr"],
  android: ["mobile"],
  ios: ["mobile"],
  "ios-cocoapods": ["mobile"],
  "ios-swift-package": ["mobile"],
  bicep: ["cloud", "infrastructure"],
  terraform: ["cloud", "infrastructure"],
  docker: ["cloud", "infrastructure", "containerization"],
  "azure-devops": ["cloud", "ci-cd"],
  kubernetes: ["cloud", "infrastructure"],
  helm: ["cloud", "infrastructure"],
  kustomize: ["cloud", "infrastructure"],
  vitest: ["testing"],
  jest: ["testing"],
  playwright: ["testing"],
  "dotnet-test": ["testing"],
  "testing-library": ["testing"],
  dotnet: ["backend"],
  "dotnet-sdk": ["backend"],
  "dotnet-framework": ["backend"],
  python: ["backend"],
  django: ["backend"],
  fastapi: ["backend"],
  go: ["backend"],
  rust: ["backend"],
  java: ["backend"],
  "spring-boot": ["backend"],
  prisma: ["database", "persistence"],
  tailwind: ["frontend", "ui"],
  kotlin: ["backend"],
  "kotlin-android": ["mobile"],
  swift: ["backend"],
  "swift-ios": ["mobile"],
  redis: ["database", "caching"],
  postgresql: ["database", "persistence"],
  mongodb: ["database", "persistence"],
};

export function deriveCapabilities(technologies: DetectedTechnology[]): Capability[] {
  const capabilitySet = new Set<Capability>();

  for (const tech of technologies) {
    const caps = TECHNOLOGY_CAPABILITY_MAP[tech.name];
    if (caps) {
      for (const cap of caps) {
        capabilitySet.add(cap);
      }
    }
  }

  return [...capabilitySet].sort();
}
