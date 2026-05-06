/**
 * junoPrompts.ts
 *
 * MCP prompt definitions for the Juno-Goose companion server.
 *
 * Prompts guide Goose to use the MCP tools appropriately before
 * performing risky actions, handling secrets, or reading files.
 *
 * Safety contract:
 *   - Prompts are advisory text; they do not execute any action.
 *   - Prompt content is static (no user data interpolated into policy text).
 *   - User-provided arguments are reflected back only in clearly labeled fields.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  getMessages: (args: Record<string, string>) => PromptMessage[];
}

// ---------------------------------------------------------------------------
// Prompt: juno_before_risky_action
// ---------------------------------------------------------------------------

const beforeRiskyAction: PromptDefinition = {
  name: "juno_before_risky_action",
  description:
    "Guides Goose to classify the risk of an action and request user confirmation if needed, " +
    "before proceeding with any potentially risky operation.",
  arguments: [
    {
      name: "action",
      description: "The action Goose intends to perform.",
      required: true,
    },
    {
      name: "target",
      description: "The file, resource, or system the action targets.",
      required: true,
    },
    {
      name: "context",
      description: "Additional context about why this action is being taken.",
      required: false,
    },
  ],
  getMessages(args) {
    const action = args["action"] ?? "(unspecified action)";
    const target = args["target"] ?? "(unspecified target)";
    const context = args["context"] ?? "";

    return [
      {
        role: "user",
        content:
          `I am about to perform this action: "${action}" on "${target}".` +
          (context ? `\n\nContext: ${context}` : "") +
          `\n\nBefore proceeding, please:` +
          `\n1. Call classify_action_risk with action="${action}", target="${target}"${context ? `, context="${context}"` : ""}.` +
          `\n2. If the risk is "high" or "blocked", call render_confirmation to produce a confirmation message and present it to me.` +
          `\n3. If the risk is "blocked", stop — do not proceed even with confirmation.` +
          `\n4. If the risk is "low", you may proceed after noting the classification.` +
          `\n5. If the risk is "remediation", proceed step-by-step and confirm each step.`,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt: juno_secret_safe_summary
// ---------------------------------------------------------------------------

const secretSafeSummary: PromptDefinition = {
  name: "juno_secret_safe_summary",
  description:
    "Guides Goose to summarize text or file content without exposing any detected secrets. " +
    "Use this before summarizing log output, config files, or any content that may contain credentials.",
  arguments: [
    {
      name: "text",
      description:
        "The text content to summarize, or a description of the file to be summarized.",
      required: true,
    },
  ],
  getMessages(args) {
    const text = args["text"] ?? "(no text provided)";

    return [
      {
        role: "user",
        content:
          `I need a summary of the following content, but I want to ensure no secrets are exposed:` +
          `\n\n---\n${text}\n---` +
          `\n\nBefore summarizing, please:` +
          `\n1. Call scan_text_for_secrets with the content above.` +
          `\n2. If secrets are found, use only the redactedText from the scan result when summarizing.` +
          `\n3. Do not repeat, quote, or paraphrase any raw secret values.` +
          `\n4. Note in your summary that secrets were detected and redacted.` +
          `\n5. Include the recommendation from the scan result at the end of your response.`,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt: juno_safe_file_review
// ---------------------------------------------------------------------------

const safeFileReview: PromptDefinition = {
  name: "juno_safe_file_review",
  description:
    "Guides Goose to read a file safely using the safe_read_file tool rather than raw filesystem access. " +
    "This ensures path validation, sensitive-file blocking, and secret scanning are applied.",
  arguments: [
    {
      name: "path",
      description: "The file path to review.",
      required: true,
    },
    {
      name: "purpose",
      description: "Why this file is being reviewed (used in audit context).",
      required: false,
    },
  ],
  getMessages(args) {
    const filePath = args["path"] ?? "(no path provided)";
    const purpose = args["purpose"] ?? "";

    return [
      {
        role: "user",
        content:
          `I want to review the file at: "${filePath}".` +
          (purpose ? `\n\nPurpose: ${purpose}` : "") +
          `\n\nPlease:` +
          `\n1. Call safe_read_file with path="${filePath}"${purpose ? `, purpose="${purpose}"` : ""} rather than reading the file directly.` +
          `\n2. If the result shows blocked=true, explain why the file was blocked and do not attempt to read it another way.` +
          `\n3. If the result shows containsSecrets=true, use only the redactedContent when discussing the file.` +
          `\n4. Do not repeat any raw secret values found in the file.` +
          `\n5. Summarize the file content and note any findings or recommendations from the tool result.`,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Exported prompt registry
// ---------------------------------------------------------------------------

export const JUNO_PROMPTS: PromptDefinition[] = [
  beforeRiskyAction,
  secretSafeSummary,
  safeFileReview,
];
