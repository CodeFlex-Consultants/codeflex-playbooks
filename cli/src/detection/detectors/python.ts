import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { detectByMarkerFilesExtensionAndContent } from "../detector-helpers";

const PYTHON_CONFIG_FILES = ["requirements.txt", "pyproject.toml", "Pipfile", "setup.py", "uv.lock", ".python-version", "pylock.toml"] as const;

const PYTHON_SPEC = {
  technology: "python",
  markerBasenames: PYTHON_CONFIG_FILES,
  fileExtension: ".py",
  fileLabel: "Python",
  contentSniffs: [
    {
      technology: "django",
      matchedBy: "django dependency found",
      test: (content: string): boolean => content.toLowerCase().includes("django"),
    },
    {
      technology: "fastapi",
      matchedBy: "fastapi dependency found",
      test: (content: string): boolean => content.toLowerCase().includes("fastapi"),
    },
  ],
};

export class PythonDetector implements Detector {
  readonly id = "python";
  readonly technology = "python";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return detectByMarkerFilesExtensionAndContent(context, PYTHON_SPEC);
  }
}
