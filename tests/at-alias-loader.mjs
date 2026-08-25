import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolvePath(import.meta.dirname, "..");
const extensions = ["", ".ts", ".tsx", ".js", ".mjs", ".mts"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = resolvePath(root, specifier.slice(2));
    const match = extensions.map((extension) => base + extension).find((candidate) => existsSync(candidate));
    return nextResolve(pathToFileURL(match ?? base).href, context);
  }

  return nextResolve(specifier, context);
}
