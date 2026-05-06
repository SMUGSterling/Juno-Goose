/**
 * index.ts
 *
 * Juno-Goose MCP Companion Server entry point.
 *
 * This server runs locally over stdio and exposes safety tools, policy
 * resources, and guided prompts for the Goose AI agent.
 *
 * Design principles:
 *   - Read-only: no writes, deletes, shell execution, or git mutations.
 *   - No network calls or telemetry.
 *   - Secrets detected in inputs are never echoed back in raw form.
 *   - All tool outputs are structured JSON-compatible objects plus human-readable text.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Tool implementations
import { scanTextForSecrets } from "./tools/scanTextForSecrets.js";
import { safeReadFile } from "./tools/safeReadFile.js";
import { classifyActionRisk } from "./tools/classifyActionRisk.js";
import { checkOkEligibility } from "./tools/checkOkEligibility.js";
import { renderConfirmation } from "./tools/renderConfirmation.js";

// Resource content providers
import {
  getSystemMdContent,
  SYSTEM_RESOURCE_URI,
  SYSTEM_RESOURCE_NAME,
  SYSTEM_RESOURCE_MIME,
} from "./resources/systemResource.js";
import { POLICY_RESOURCES } from "./resources/policyResources.js";

// Prompt definitions
import { JUNO_PROMPTS } from "./prompts/junoPrompts.js";

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "juno-mcp",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

// juno://system — the root system.md behavioral constitution
server.resource(
  SYSTEM_RESOURCE_NAME,
  SYSTEM_RESOURCE_URI,
  {
    description:
      "The Juno-Goose behavioral constitution (system.md). " +
      "This is the primary safety policy for the Goose AI agent.",
    mimeType: SYSTEM_RESOURCE_MIME,
  },
  async () => ({
    contents: [
      {
        uri: SYSTEM_RESOURCE_URI,
        mimeType: SYSTEM_RESOURCE_MIME,
        text: getSystemMdContent(),
      },
    ],
  })
);

// juno://policy/* — policy summary resources
for (const resource of POLICY_RESOURCES) {
  server.resource(
    resource.name,
    resource.uri,
    {
      description: resource.description,
      mimeType: resource.mimeType,
    },
    async () => ({
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: resource.getContent(),
        },
      ],
    })
  );
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

// Tool: scan_text_for_secrets
server.tool(
  "scan_text_for_secrets",
  "Scan text for likely secrets using pattern-based detection. " +
    "Returns redacted text and findings. Never returns raw secret values.",
  {
    text: z.string().describe("The text to scan for secrets."),
    contextLabel: z
      .string()
      .optional()
      .describe(
        "Optional label for the content (e.g., filename) used in recommendations."
      ),
  },
  async ({ text, contextLabel }) => {
    const result = scanTextForSecrets(text, contextLabel);

    const summary = result.containsSecrets
      ? `⚠️  ${result.findings.length} likely secret(s) detected. Content has been redacted.`
      : "✅ No obvious secrets detected.";

    return {
      content: [
        {
          type: "text",
          text:
            summary +
            "\n\n" +
            JSON.stringify(
              {
                containsSecrets: result.containsSecrets,
                findings: result.findings,
                redactedText: result.redactedText,
                recommendation: result.recommendation,
              },
              null,
              2
            ),
        },
      ],
    };
  }
);

// Tool: safe_read_file
server.tool(
  "safe_read_file",
  "Safely read a file with path validation, sensitive-file blocking, byte limits, and secret scanning. " +
    "Returns redacted content if secrets are detected. Read-only.",
  {
    path: z
      .string()
      .describe("Path to the file to read (relative or absolute)."),
    maxBytes: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum bytes to read. Defaults to 64 KB. Hard cap at 256 KB."),
    purpose: z
      .string()
      .optional()
      .describe("Why this file is being read (used in audit context)."),
  },
  async ({ path: filePath, maxBytes, purpose }) => {
    const result = safeReadFile(filePath, maxBytes, purpose);

    const statusIcon = result.blocked
      ? "🚫"
      : result.containsSecrets
      ? "⚠️ "
      : "✅";

    const summary = result.blocked
      ? `${statusIcon} File read blocked: ${result.reason}`
      : result.containsSecrets
      ? `${statusIcon} File read with secrets detected — returning redacted content.`
      : `${statusIcon} File read successfully.`;

    return {
      content: [
        {
          type: "text",
          text:
            summary +
            "\n\n" +
            JSON.stringify(
              {
                allowed: result.allowed,
                blocked: result.blocked,
                reason: result.reason,
                resolvedPath: result.resolvedPath,
                truncated: result.truncated ?? false,
                containsSecrets: result.containsSecrets,
                findings: result.findings,
                // Only include the appropriate content field
                ...(result.blocked
                  ? {}
                  : result.containsSecrets
                  ? { redactedContent: result.redactedContent }
                  : { content: result.content }),
                recommendation: result.recommendation,
              },
              null,
              2
            ),
        },
      ],
    };
  }
);

// Tool: classify_action_risk
server.tool(
  "classify_action_risk",
  "Classify the risk level of an action according to Juno-Goose policy. " +
    "Returns: low, high, blocked, or remediation, with confirmation requirements.",
  {
    action: z
      .string()
      .describe("Description of the action to classify."),
    target: z
      .string()
      .optional()
      .describe("Optional target of the action (file, resource, system, etc.)."),
    context: z
      .string()
      .optional()
      .describe("Optional additional context about the action."),
  },
  async ({ action, target, context }) => {
    const result = classifyActionRisk(action, target, context);

    const riskIcon =
      result.risk === "blocked"
        ? "🚫"
        : result.risk === "high"
        ? "⚠️ "
        : result.risk === "remediation"
        ? "🔧"
        : "✅";

    const summary = `${riskIcon} Risk: ${result.risk.toUpperCase()}`;

    return {
      content: [
        {
          type: "text",
          text:
            summary +
            "\n\n" +
            JSON.stringify(
              {
                risk: result.risk,
                requiresConfirmation: result.requiresConfirmation,
                okFlagAllowed: result.okFlagAllowed,
                reason: result.reason,
                recommendedNextStep: result.recommendedNextStep,
                matchedPattern: result.matchedPattern,
              },
              null,
              2
            ),
        },
      ],
    };
  }
);

// Tool: check_ok_eligibility
server.tool(
  "check_ok_eligibility",
  "Determine whether the --ok flag may be used to streamline an action. " +
    "--ok must never bypass blocked, high-risk, destructive, or credential-related actions.",
  {
    action: z
      .string()
      .describe("Description of the action being requested."),
    target: z
      .string()
      .optional()
      .describe("Optional target of the action."),
    risk: z
      .string()
      .optional()
      .describe(
        "Pre-classified risk level (low, high, blocked, remediation). " +
          "If not provided, the action will be classified automatically."
      ),
  },
  async ({ action, target, risk }) => {
    const result = checkOkEligibility(action, target, risk);

    const icon = result.okAllowed ? "✅" : "🚫";
    const summary = `${icon} --ok allowed: ${result.okAllowed}`;

    return {
      content: [
        {
          type: "text",
          text:
            summary +
            "\n\n" +
            JSON.stringify(
              {
                okAllowed: result.okAllowed,
                reason: result.reason,
                requiresExplicitConfirmation:
                  result.requiresExplicitConfirmation,
              },
              null,
              2
            ),
        },
      ],
    };
  }
);

// Tool: render_confirmation
server.tool(
  "render_confirmation",
  "Render a standard Juno-Goose confirmation request message for a risky action. " +
    "Returns both a human-readable message and a structured object.",
  {
    action: z.string().describe("What Goose wants to do."),
    target: z.string().describe("What files or systems are involved."),
    risk: z.string().describe("Risk level or description of why it matters."),
    reason: z
      .string()
      .optional()
      .describe("Optional additional context or reasoning."),
  },
  async ({ action, target, risk, reason }) => {
    const result = renderConfirmation(action, target, risk, reason);

    return {
      content: [
        {
          type: "text",
          text:
            result.message +
            "\n\n---\nStructured:\n" +
            JSON.stringify(result.structured, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

for (const prompt of JUNO_PROMPTS) {
  server.prompt(
    prompt.name,
    prompt.description,
    prompt.arguments.reduce<Record<string, z.ZodString | z.ZodOptional<z.ZodString>>>(
      (acc, arg) => {
        acc[arg.name] = arg.required
          ? z.string().describe(arg.description)
          : z.string().optional().describe(arg.description);
        return acc;
      },
      {}
    ),
    async (args: Record<string, string | undefined>) => {
      const stringArgs: Record<string, string> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) stringArgs[k] = v;
      }
      const messages = prompt.getMessages(stringArgs);
      return {
        messages: messages.map((m) => ({
          role: m.role,
          content: {
            type: "text" as const,
            text: m.content,
          },
        })),
      };
    }
  );
}

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr to avoid interfering with stdio MCP protocol on stdout
  process.stderr.write(
    "[juno-mcp] Juno-Goose MCP companion server started (stdio)\n"
  );
}

main().catch((err) => {
  process.stderr.write(`[juno-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
