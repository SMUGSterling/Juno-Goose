/**
 * safeReadFile.ts
 *
 * Read-only file reading tool with safety boundaries.
 *
 * Safety contract:
 *   - Resolves paths to absolute form and blocks traversal outside root.
 *   - Blocks known sensitive path patterns (.env, private keys, SSH keys, etc.).
 *   - Reads up to maxBytes (default 64 KB) to limit exposure.
 *   - Scans content for secrets and returns redacted content if any are found.
 *   - Never performs writes, deletes, or any filesystem mutations.
 *   - The allowed root is the current working directory or JUNO_MCP_ROOT env var.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { scanTextForSecrets, type ScanResult } from "./scanTextForSecrets.js";
import { SENSITIVE_PATH_PATTERNS } from "../policy/junoPolicy.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default maximum bytes to read from a file (64 KB). */
const DEFAULT_MAX_BYTES = 64 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SafeReadResult {
  allowed: boolean;
  blocked: boolean;
  reason: string;
  containsSecrets: boolean;
  /** Present when allowed and no secrets detected. */
  content?: string;
  /** Present when allowed but secrets were detected. */
  redactedContent?: string;
  findings: ScanResult["findings"];
  recommendation: string;
  /** Absolute resolved path that was evaluated. */
  resolvedPath?: string;
  /** Whether the content was truncated due to maxBytes. */
  truncated?: boolean;
}

// ---------------------------------------------------------------------------
// Helper: determine the allowed root
// ---------------------------------------------------------------------------

function getAllowedRoot(): string {
  const envRoot = process.env["JUNO_MCP_ROOT"];
  if (envRoot) {
    return path.resolve(envRoot);
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Helper: check if a path matches a sensitive pattern
// ---------------------------------------------------------------------------

function isSensitivePath(resolvedPath: string): boolean {
  // Check absolute resolved path and basename
  const basename = path.basename(resolvedPath);
  const toCheck = [resolvedPath, basename];

  for (const candidate of toCheck) {
    for (const pattern of SENSITIVE_PATH_PATTERNS) {
      if (pattern.test(candidate)) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main safe read function
// ---------------------------------------------------------------------------

/**
 * Safely reads a file, applying path validation, sensitive-file blocking,
 * byte limits, and secret scanning.
 *
 * @param filePath - The path to read (relative or absolute).
 * @param maxBytes - Maximum bytes to read (default 64 KB).
 * @param purpose  - Optional description of why the file is being read
 *                   (used in recommendation text only).
 */
export function safeReadFile(
  filePath: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
  purpose?: string
): SafeReadResult {
  const allowedRoot = getAllowedRoot();
  const purposeNote = purpose ? ` (purpose: ${purpose})` : "";

  // --- Step 1: Resolve to absolute path ---
  let resolvedPath: string;
  try {
    resolvedPath = path.resolve(allowedRoot, filePath);
  } catch {
    return {
      allowed: false,
      blocked: true,
      reason: "Could not resolve the provided path.",
      containsSecrets: false,
      findings: [],
      recommendation: "Provide a valid relative or absolute file path.",
    };
  }

  // --- Step 2: Block path traversal outside allowed root ---
  const normalizedRoot = path.normalize(allowedRoot + path.sep);
  const normalizedResolved = path.normalize(resolvedPath);

  if (!normalizedResolved.startsWith(normalizedRoot) &&
      normalizedResolved !== path.normalize(allowedRoot)) {
    return {
      allowed: false,
      blocked: true,
      reason: `Path traversal blocked: "${filePath}" resolves outside the allowed root.`,
      containsSecrets: false,
      findings: [],
      recommendation:
        "Only files within the project root may be read. " +
        "Set JUNO_MCP_ROOT to expand the allowed root if needed.",
      resolvedPath,
    };
  }

  // --- Step 3: Block sensitive paths ---
  if (isSensitivePath(resolvedPath)) {
    return {
      allowed: false,
      blocked: true,
      reason: `Sensitive path blocked: "${path.basename(resolvedPath)}" matches a known secret or credential file pattern.`,
      containsSecrets: true,
      findings: [],
      recommendation:
        "This file likely contains credentials. " +
        "Do not read it directly. If you need to rotate a credential, use remediation guidance.",
      resolvedPath,
    };
  }

  // --- Step 4: Check file existence and type ---
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolvedPath);
  } catch {
    return {
      allowed: false,
      blocked: true,
      reason: `File not found or inaccessible: "${filePath}"`,
      containsSecrets: false,
      findings: [],
      recommendation: "Verify the file path and that it exists in the project.",
      resolvedPath,
    };
  }

  if (!stat.isFile()) {
    return {
      allowed: false,
      blocked: true,
      reason: `"${filePath}" is not a regular file (it may be a directory or special file).`,
      containsSecrets: false,
      findings: [],
      recommendation: "Provide the path to a regular file.",
      resolvedPath,
    };
  }

  // --- Step 5: Read up to maxBytes ---
  const clampedMax = Math.min(
    Math.max(1, maxBytes),
    DEFAULT_MAX_BYTES * 4 // Hard upper cap at 256 KB regardless of input
  );

  let rawBuffer: Buffer;
  let truncated = false;

  try {
    const fd = fs.openSync(resolvedPath, "r");
    try {
      rawBuffer = Buffer.alloc(clampedMax + 1);
      const bytesRead = fs.readSync(fd, rawBuffer, 0, clampedMax + 1, 0);
      if (bytesRead > clampedMax) {
        rawBuffer = rawBuffer.slice(0, clampedMax);
        truncated = true;
      } else {
        rawBuffer = rawBuffer.slice(0, bytesRead);
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      allowed: false,
      blocked: true,
      reason: `Could not read file: ${message}`,
      containsSecrets: false,
      findings: [],
      recommendation: "Check file permissions.",
      resolvedPath,
    };
  }

  const rawText = rawBuffer.toString("utf8");

  // --- Step 6: Scan for secrets ---
  const scan = scanTextForSecrets(rawText, path.basename(resolvedPath));

  const truncationNote = truncated
    ? ` (content truncated at ${clampedMax} bytes)`
    : "";

  if (scan.containsSecrets) {
    return {
      allowed: true,
      blocked: false,
      reason: `File was read but contains likely secrets${purposeNote}${truncationNote}. Returning redacted content.`,
      containsSecrets: true,
      redactedContent: scan.redactedText,
      findings: scan.findings,
      recommendation: scan.recommendation,
      resolvedPath,
      truncated,
    };
  }

  return {
    allowed: true,
    blocked: false,
    reason: `File read successfully${purposeNote}${truncationNote}.`,
    containsSecrets: false,
    content: rawText,
    findings: [],
    recommendation:
      "No obvious secrets detected. Manual review is still recommended for sensitive content.",
    resolvedPath,
    truncated,
  };
}
