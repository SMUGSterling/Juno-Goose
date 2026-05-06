/**
 * systemResource.ts
 *
 * Exposes the root system.md as a MCP resource at juno://system.
 *
 * The system.md is the primary behavioral constitution for Juno-Goose.
 * This resource makes it readable by Goose as structured content so that
 * it can reference the policy during sessions.
 *
 * Safety contract:
 *   - Read-only: this resource never modifies system.md.
 *   - Path is resolved relative to the package root, not user input.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

// The MCP package lives at <repo>/juno-mcp/, so system.md is one level up.
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SYSTEM_MD_PATH = path.resolve(__dirname, "..", "..", "..", "system.md");

// ---------------------------------------------------------------------------
// Resource content getter
// ---------------------------------------------------------------------------

/**
 * Reads and returns the content of the root system.md file.
 * Returns a placeholder message if the file cannot be read.
 */
export function getSystemMdContent(): string {
  try {
    return fs.readFileSync(SYSTEM_MD_PATH, "utf8");
  } catch {
    return (
      "# system.md not found\n\n" +
      "The root system.md could not be located at the expected path. " +
      "Ensure the juno-mcp package is run from within the Juno-Goose repository."
    );
  }
}

/** The URI for this resource. */
export const SYSTEM_RESOURCE_URI = "juno://system";

/** Human-readable name for this resource. */
export const SYSTEM_RESOURCE_NAME = "Juno-Goose System Constitution (system.md)";

/** MIME type for this resource. */
export const SYSTEM_RESOURCE_MIME = "text/markdown";
