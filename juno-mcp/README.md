# Juno-Goose MCP Companion Server

An optional local [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides structured safety tools, policy resources, and guided prompts for the [Goose AI agent](https://goose-docs.ai/).

---

## What This Is

The `juno-mcp` server is a **companion toolkit** that supplements the Juno-Goose `system.md` behavioral constitution. It gives Goose structured tools it can call before performing risky actions, handling files that may contain secrets, or classifying unfamiliar operations.

The `system.md` file remains the **primary behavioral policy**. This server does not replace or weaken it.

---

## What This Server Does

- **`scan_text_for_secrets`** — Scans text for likely secrets (API keys, tokens, private keys, database URLs with credentials, JWTs, etc.) using pattern-based detection. Returns redacted text and findings. Never returns raw secret values.

- **`safe_read_file`** — Reads a file safely, enforcing path constraints, blocking sensitive files (`.env`, private keys, SSH keys, etc.), capping read size at 64 KB (configurable up to 256 KB), and scanning for secrets before returning content.

- **`classify_action_risk`** — Classifies an action as `low`, `high`, `blocked`, or `remediation` according to Juno-Goose policy.

- **`check_ok_eligibility`** — Determines whether the `--ok` flag may be used to streamline an action.

- **`render_confirmation`** — Renders a standard Juno-Goose confirmation request message.

### Policy Resources

| URI | Content |
|-----|---------|
| `juno://system` | The root `system.md` behavioral constitution |
| `juno://policy/secrets` | Secret-handling policy summary |
| `juno://policy/risk` | Risk classification categories |
| `juno://policy/ferpa` | FERPA / student data privacy policy |
| `juno://policy/ok-flag` | `--ok` flag eligibility rules |

### Guided Prompts

| Name | Purpose |
|------|---------|
| `juno_before_risky_action` | Guides Goose to classify risk and request confirmation before a risky action |
| `juno_secret_safe_summary` | Guides Goose to summarize content without exposing secrets |
| `juno_safe_file_review` | Guides Goose to use `safe_read_file` instead of raw file access |

---

## What This Server Does NOT Guarantee

- **It only protects content routed through its own tools.** If Goose uses other filesystem tools (e.g., a raw `read_file` tool from another extension) to read a secret-bearing file, this server cannot intercept that.
- **It is not a replacement for the `system.md` behavioral policy.** The MCP server is a toolkit; the policy is the constitution.
- **It is not infallible.** Pattern-based secret detection may miss novel credential formats or produce false positives.
- **It does not universally prevent secrets from reaching an AI.** Only content routed through `safe_read_file` or `scan_text_for_secrets` is protected by this server.
- **It has no network capabilities.** All processing is local.

---

## Requirements

- Node.js >= 20
- npm >= 9

---

## Installation

```bash
cd juno-mcp
npm install
```

---

## Running Locally

### Development mode (TypeScript, no build step)

```bash
npm run dev
```

### Production mode (compiled JavaScript)

```bash
npm run build
npm start
```

The server communicates over **stdio** and writes startup messages to **stderr** only.

---

## Connecting to Goose

Goose supports local MCP extensions via stdio. To add `juno-mcp` as an extension:

1. Build the server:
   ```bash
   cd juno-mcp && npm run build
   ```

2. In Goose settings, add a new **local extension** (MCP / stdio):
   - **Command:** `node`
   - **Arguments:** `/absolute/path/to/juno-mcp/dist/index.js`
   - **Name:** `juno-mcp` (or any label you prefer)

3. Start or restart your Goose session. The tools, resources, and prompts will be available.

### Using JUNO_MCP_ROOT

By default, `safe_read_file` limits reads to the current working directory. To allow a different root:

```bash
JUNO_MCP_ROOT=/path/to/your/project node dist/index.js
```

---

## Example Tool Calls

### Scan text for secrets

```json
{
  "tool": "scan_text_for_secrets",
  "arguments": {
    "text": "export OPENAI_API_KEY=sk-proj-abc123...",
    "contextLabel": "shell profile"
  }
}
```

Expected: `containsSecrets: true`, findings with redacted examples, recommendation to rotate.

---

### Read a file safely

```json
{
  "tool": "safe_read_file",
  "arguments": {
    "path": "README.md",
    "purpose": "review project documentation"
  }
}
```

Expected: file content (or redacted content if secrets found), or `blocked: true` for sensitive paths.

---

### Classify action risk

```json
{
  "tool": "classify_action_risk",
  "arguments": {
    "action": "delete backup files",
    "target": ".goose-backups/"
  }
}
```

Expected: `risk: "high"`, `requiresConfirmation: true`, recommended next step.

---

### Check --ok eligibility

```json
{
  "tool": "check_ok_eligibility",
  "arguments": {
    "action": "update README.md with new section",
    "target": "README.md"
  }
}
```

Expected: `okAllowed: true` (low-risk edit).

---

### Render confirmation

```json
{
  "tool": "render_confirmation",
  "arguments": {
    "action": "Delete .goose-backups/ folder",
    "target": ".goose-backups/",
    "risk": "high",
    "reason": "User requested cleanup of backup files."
  }
}
```

Expected:
```
Action:  Delete .goose-backups/ folder
Target:  .goose-backups/
Risk:    high
Reason:  User requested cleanup of backup files.
Request: Confirm before I proceed.
```

---

## Assumptions and Limitations

- Secret detection is regex/pattern-based and is not exhaustive. Novel or obfuscated credentials may not be detected.
- The server does not persist state between requests.
- The `safe_read_file` hard cap is 256 KB per read regardless of `maxBytes` input.
- Sensitive path blocking is heuristic — unusual credential file names may not be caught.
- This server has no write, delete, shell, git, or network capabilities by design.
