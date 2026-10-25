import { platform } from "node:os";

export const isWindows = platform() === "win32";
export const isMacOS = platform() === "darwin";
export const isLinux = platform() === "linux";
