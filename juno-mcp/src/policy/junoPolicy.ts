/**
 * junoPolicy.ts
 *
 * Central policy definitions for the Juno-Goose MCP companion server.
 * These definitions mirror the behavioral rules in the root system.md
 * and are used by tools, resources, and prompts to enforce consistent
 * safety classifications.
 *
 * This file is read-only policy data — it contains no mutations,
 * network calls, or side effects.
 */

// ---------------------------------------------------------------------------
// Risk level type
// ---------------------------------------------------------------------------

export type RiskLevel = "low" | "high" | "blocked" | "remediation";

// ---------------------------------------------------------------------------
// Action classification patterns
// Each entry describes a pattern of action keywords, an associated risk level,
// and the reasoning used to classify it.
// ---------------------------------------------------------------------------

export interface ActionPattern {
  keywords: string[];
  risk: RiskLevel;
  reason: string;
  requiresConfirmation: boolean;
  okFlagAllowed: boolean;
}

export const ACTION_PATTERNS: ActionPattern[] = [
  // --- Blocked actions (highest severity) ---
  {
    keywords: [
      "exfiltrate",
      "exfiltrating",
      "leak",
      "leaking",
      "steal",
      "bypass security",
      "bypass safety",
      "ignore rules",
      "disable protection",
      "disable safety",
      "reveal credential",
      "reveal secret",
      "reveal key",
      "reveal password",
      "reveal token",
      "expose secret",
      "expose credential",
      "print secret",
      "print credential",
      "log secret",
      "echo secret",
    ],
    risk: "blocked",
    reason:
      "This action involves bypassing safety rules, exfiltrating secrets, or exposing credentials. It is unconditionally blocked.",
    requiresConfirmation: false,
    okFlagAllowed: false,
  },

  // --- Remediation actions ---
  {
    keywords: [
      "rotate key",
      "rotate keys",
      "rotate credential",
      "rotate credentials",
      "rotate secret",
      "rotate secrets",
      "rotate token",
      "rotate tokens",
      "rotate password",
      "revoke key",
      "revoke keys",
      "revoke token",
      "revoke tokens",
      "revoke credential",
      "revoke credentials",
      "revoke secret",
      "revoke secrets",
      "remove secret from git",
      "remove secrets from git",
      "remove credential from git",
      "remove credentials from git",
      "remove secret from history",
      "remove secrets from history",
      "remove key from history",
      "remove keys from history",
      "remove token from history",
      "remove tokens from history",
      "remove from history",
      "purge from git",
      "purge secrets",
      "purge credentials",
      "expunge secret",
      "expunge secrets",
      "cleanup credential",
      "cleanup credentials",
      "cleanup secret",
      "cleanup secrets",
      "cleanup key",
      "cleanup token",
      "remediate",
    ],
    risk: "remediation",
    reason:
      "This action is a remediation step: rotating, revoking, or removing an exposed credential. Proceed with care and confirm each step.",
    requiresConfirmation: true,
    okFlagAllowed: false,
  },

  // --- High-risk actions ---
  {
    keywords: [
      "delete",
      "remove",
      "unlink",
      "rm ",
      "rmdir",
      "overwrite",
      "truncate",
      "wipe",
      "format",
      "rewrite",
      "rebase",
      "reset --hard",
      "force push",
      "git push --force",
      "git reset",
      "git rebase",
      "git clean",
      "git checkout",
      "install package",
      "npm install",
      "pip install",
      "brew install",
      "apt install",
      "apt-get install",
      "run script",
      "execute script",
      "run command",
      "shell command",
      "chmod",
      "chown",
      "sudo",
      "runas",
      "send data",
      "upload",
      "post to",
      "http request",
      "fetch url",
      "curl",
      "wget",
      "modify config",
      "edit config",
      "update config",
      "change permission",
      "change ownership",
      "create symlink",
    ],
    risk: "high",
    reason:
      "This action is potentially destructive, irreversible, or modifies system state. Explicit confirmation is required.",
    requiresConfirmation: true,
    okFlagAllowed: false,
  },

  // --- Low-risk actions ---
  {
    keywords: [
      "read",
      "view",
      "open",
      "list",
      "show",
      "display",
      "summarize",
      "describe",
      "explain",
      "review",
      "analyze",
      "diff",
      "compare",
      "backup",
      "plan",
      "draft",
      "suggest",
      "preview",
      "search",
      "grep",
      "find",
      "check",
      "inspect",
      "audit",
    ],
    risk: "low",
    reason:
      "This action is read-only, non-destructive, and does not modify system state.",
    requiresConfirmation: false,
    okFlagAllowed: true,
  },
];

// ---------------------------------------------------------------------------
// Sensitive path patterns — paths that should never be read raw
// ---------------------------------------------------------------------------

export const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /^\.env$/i,
  /^\.env\./i,
  /\/\.env$/i,
  /\/\.env\./i,
  /id_rsa/i,
  /id_ed25519/i,
  /id_ecdsa/i,
  /id_dsa/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.jks$/i,
  /\.keystore$/i,
  /[/\\]\.ssh[/\\]/i,
  /^\.ssh[/\\]/i,
  /credentials$/i,
  /secret[s]?$/i,
  /token[s]?$/i,
  /password[s]?$/i,
  /passwd$/i,
  /shadow$/i,
  /htpasswd/i,
  /netrc$/i,
  /\.pgpass$/i,
  /aws\/credentials/i,
  /\.aws\/credentials/i,
  /gcloud\/credentials/i,
  /kubeconfig/i,
  /vault-token/i,
];

// ---------------------------------------------------------------------------
// --ok flag eligibility rules
// ---------------------------------------------------------------------------

/** Actions that are never eligible for --ok, regardless of classification. */
export const OK_FLAG_BLOCKED_KEYWORDS: string[] = [
  "delete",
  "remove",
  "unlink",
  "overwrite",
  "wipe",
  "format",
  "git",
  "rebase",
  "reset",
  "push",
  "install",
  "run",
  "execute",
  "shell",
  "sudo",
  "chmod",
  "upload",
  "send",
  "curl",
  "wget",
  "secret",
  "credential",
  "password",
  "token",
  "key",
  "ferpa",
  "student record",
  "pii",
  "network",
  "api call",
];

// ---------------------------------------------------------------------------
// Policy text summaries (used by resources)
// ---------------------------------------------------------------------------

export const POLICY_SUMMARIES = {
  secrets: `# Juno-Goose Secret-Handling Policy

## Core Rules
- Never repeat, log, echo, or store raw detected secrets.
- When a likely secret is found, redact it behind [REDACTED] immediately.
- Enter remediation-only mode if a real credential is detected.
- In remediation mode: assist only with rotation, revocation, removal from git history, and exposure verification.
- Resume normal work only after the user types: remediation complete

## What Counts as a Secret
- API keys (OpenAI, GitHub, AWS, Google, etc.)
- Bearer tokens and JWT tokens
- Private keys (RSA, EC, ED25519, etc.)
- SSH private key blocks
- Database connection strings with embedded credentials
- .env file values that look like real credentials
- Any high-entropy string that matches a known credential pattern

## What Does NOT Trigger Remediation
- Policy text, documentation, or placeholder examples like MY_API_KEY
- Already-redacted values [REDACTED]
- Low-entropy or clearly fake values
- Variable names by themselves (without a real value assigned)
`,

  risk: `# Juno-Goose Risk Classification Policy

## Risk Levels

### Low Risk
- Reading, viewing, summarizing, listing, or analyzing files
- Creating diffs, plans, drafts, or backups
- Searching, grepping, or inspecting project files
- Suggesting improvements without modifying anything

### High Risk (requires explicit confirmation)
- Deleting, overwriting, or wiping files
- Running shell commands, scripts, or project code
- Installing packages (npm, pip, brew, apt, etc.)
- Git operations: commit, push, reset, rebase, clean, checkout
- Changing file permissions or ownership
- Sending data externally (HTTP, upload, sync)
- Modifying configuration files

### Blocked (never proceed)
- Exfiltrating secrets or credentials
- Bypassing safety rules or disabling protections
- Revealing, printing, or echoing raw credentials
- Actions that violate SMU policy or legal requirements

### Remediation (safe-assist only)
- Rotating or revoking exposed credentials
- Removing secrets from git history
- Checking exposure scope and cleaning up
`,

  ferpa: `# Juno-Goose FERPA / Student Data Privacy Policy

## What Is FERPA
FERPA (Family Educational Rights and Privacy Act) protects the privacy of student education records. SMU and its systems must handle student data carefully.

## Rules
- Do not repeat, store, or expose student names, IDs, grades, transcripts, or records outside the task scope.
- When summarizing student data, de-identify it: use "Student A", "Student B", etc.
- Do not send student data over the network without explicit institutional authorization.
- Treat any file or dataset that appears to contain student records as high-risk.
- Confirmation is required before any operation that modifies, moves, or shares student data.

## Indicators of Student Data
- Files named roster, grades, transcript, enrollment, student_*, or similar
- Columns or fields named student_id, sis_id, banner_id, grade, gpa, etc.
- CSV/Excel files from Blackboard, Canvas, Banner, or similar SMU systems
`,

  okFlag: `# Juno-Goose --ok Flag Policy

## What --ok Does
The --ok flag tells Goose: "If this action is safe, clearly scoped, and project-local, you may proceed without the routine confirmation prompt."

## When --ok Is Allowed
- Small edits to a non-sensitive project document you specifically named
- Creating or updating non-sensitive scratch files
- Creating a project-local backup note
- Soft-deleting a specifically named, non-sensitive project file
- Restoring a file from .goose-backups/ or .goose-trash/

## When --ok Is NOT Allowed
- Secrets, credentials, tokens, private keys, or .env files
- Credential stores or high-risk system paths
- Student records, FERPA data, or sensitive institutional data
- Network calls, uploads, downloads, syncs, or API requests
- Installing or updating packages
- Running scripts, tests, builds, binaries, or package managers
- Git operations: commit, push, reset, rebase, checkout, clean
- Permission changes or admin actions (sudo, runas)
- Broad, destructive, or unclear requests

## Uncertainty Rule
If Goose is unsure whether --ok applies, it must ignore the flag and ask for confirmation normally.
`,
};
