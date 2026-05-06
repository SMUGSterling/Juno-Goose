/**
 * renderConfirmation.ts
 *
 * Renders a standard Juno-Goose confirmation request message.
 *
 * The confirmation format is designed to match the pattern described in
 * the root system.md:
 *
 *   Action:  <what Goose wants to do>
 *   Target:  <what files or systems are involved>
 *   Risk:    <why it matters>
 *   Reason:  <additional context>
 *   Request: Confirm before I proceed.
 *
 * This tool is purely presentational — it performs no actions and
 * returns only formatted text and a structured object.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfirmationData {
  action: string;
  target: string;
  risk: string;
  reason: string;
}

export interface RenderConfirmationResult {
  /** Human-readable confirmation message for display to the user. */
  message: string;
  /** Structured data with the same fields, for programmatic use. */
  structured: ConfirmationData & {
    request: string;
  };
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Renders a standard Juno-Goose confirmation request.
 *
 * @param action - What Goose wants to do.
 * @param target - What files or systems are involved.
 * @param risk   - Risk level or description of why it matters.
 * @param reason - Optional additional context or reasoning.
 */
export function renderConfirmation(
  action: string,
  target: string,
  risk: string,
  reason?: string
): RenderConfirmationResult {
  const resolvedReason = reason?.trim() || "No additional context provided.";

  const message = [
    `Action:  ${action}`,
    `Target:  ${target}`,
    `Risk:    ${risk}`,
    `Reason:  ${resolvedReason}`,
    `Request: Confirm before I proceed.`,
  ].join("\n");

  return {
    message,
    structured: {
      action,
      target,
      risk,
      reason: resolvedReason,
      request: "Confirm before I proceed.",
    },
  };
}
