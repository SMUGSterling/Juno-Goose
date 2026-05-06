/**
 * classifyActionRisk.ts
 *
 * Classifies an action's risk level according to Juno-Goose policy.
 *
 * Safety contract:
 *   - Classification is based on keyword matching against known patterns.
 *   - This tool is advisory; it does not execute or authorize any action.
 *   - All output is read-only structured data.
 */

import {
  ACTION_PATTERNS,
  type RiskLevel,
} from "../policy/junoPolicy.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifyResult {
  risk: RiskLevel;
  requiresConfirmation: boolean;
  okFlagAllowed: boolean;
  reason: string;
  recommendedNextStep: string;
  matchedPattern?: string;
}

// ---------------------------------------------------------------------------
// Default (unknown action) classification
// ---------------------------------------------------------------------------

const UNKNOWN_RESULT: ClassifyResult = {
  risk: "high",
  requiresConfirmation: true,
  okFlagAllowed: false,
  reason:
    "The action could not be matched to a known pattern. Defaulting to high risk out of caution.",
  recommendedNextStep:
    "Describe the action more specifically and request confirmation before proceeding.",
};

// ---------------------------------------------------------------------------
// Next-step recommendations per risk level
// ---------------------------------------------------------------------------

function recommendedNextStep(
  risk: RiskLevel,
  action: string,
  target?: string
): string {
  const targetNote = target ? ` on "${target}"` : "";
  switch (risk) {
    case "low":
      return `You may proceed with "${action}"${targetNote}. Use --ok if you want to skip the routine confirmation prompt.`;
    case "high":
      return (
        `"${action}"${targetNote} requires explicit user confirmation before proceeding. ` +
        `Use render_confirmation to generate a standard confirmation request.`
      );
    case "blocked":
      return (
        `"${action}"${targetNote} is unconditionally blocked by Juno-Goose policy. ` +
        `Do not proceed. If you believe this classification is incorrect, review the policy and seek guidance.`
      );
    case "remediation":
      return (
        `"${action}"${targetNote} is a remediation action. ` +
        `Proceed carefully, one step at a time, with explicit confirmation for each step. ` +
        `Focus only on rotating, revoking, or removing the exposed credential.`
      );
  }
}

// ---------------------------------------------------------------------------
// Main classification function
// ---------------------------------------------------------------------------

/**
 * Classifies the risk level of an action.
 *
 * @param action  - A description of the action to classify.
 * @param target  - Optional target (file, resource, etc.) of the action.
 * @param context - Optional additional context about the action.
 */
export function classifyActionRisk(
  action: string,
  target?: string,
  context?: string
): ClassifyResult {
  const combined = [action, target, context]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Evaluate patterns in priority order: blocked > remediation > high > low
  const priorityOrder: RiskLevel[] = ["blocked", "remediation", "high", "low"];

  for (const targetRisk of priorityOrder) {
    for (const pattern of ACTION_PATTERNS) {
      if (pattern.risk !== targetRisk) continue;

      const matched = pattern.keywords.some((kw) =>
        combined.includes(kw.toLowerCase())
      );

      if (matched) {
        const matchedKw = pattern.keywords.find((kw) =>
          combined.includes(kw.toLowerCase())
        )!;

        return {
          risk: pattern.risk,
          requiresConfirmation: pattern.requiresConfirmation,
          okFlagAllowed: pattern.okFlagAllowed,
          reason: pattern.reason,
          recommendedNextStep: recommendedNextStep(pattern.risk, action, target),
          matchedPattern: matchedKw,
        };
      }
    }
  }

  // No pattern matched — default to high risk
  return {
    ...UNKNOWN_RESULT,
    recommendedNextStep: recommendedNextStep("high", action, target),
  };
}
