/**
 * checkOkEligibility.ts
 *
 * Determines whether the --ok flag is allowed for a given action.
 *
 * Safety contract:
 *   - --ok may never bypass blocked actions.
 *   - --ok may never streamline destructive, irreversible, credential-exposing,
 *     FERPA-sensitive, or system-modifying actions.
 *   - When in doubt, this function returns okAllowed: false.
 */

import {
  OK_FLAG_BLOCKED_KEYWORDS,
  type RiskLevel,
} from "../policy/junoPolicy.js";
import { classifyActionRisk } from "./classifyActionRisk.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OkEligibilityResult {
  okAllowed: boolean;
  reason: string;
  requiresExplicitConfirmation: boolean;
}

// ---------------------------------------------------------------------------
// Main check function
// ---------------------------------------------------------------------------

/**
 * Determines whether the --ok flag may be used to streamline an action.
 *
 * @param action - Description of the action being requested.
 * @param target - Optional target of the action.
 * @param risk   - Optional pre-classified risk level (e.g., from classifyActionRisk).
 *                 If not provided, classifyActionRisk is called internally.
 */
export function checkOkEligibility(
  action: string,
  target?: string,
  risk?: string
): OkEligibilityResult {
  const combined = [action, target].filter(Boolean).join(" ").toLowerCase();

  // --- Check for explicitly blocked keywords in the action/target ---
  const blockedKw = OK_FLAG_BLOCKED_KEYWORDS.find((kw) =>
    combined.includes(kw.toLowerCase())
  );

  if (blockedKw) {
    return {
      okAllowed: false,
      reason:
        `The action contains a term ("${blockedKw}") that is on the --ok block list. ` +
        `The --ok flag must not be used for credential-related, destructive, FERPA-sensitive, ` +
        `network, or system-modifying actions.`,
      requiresExplicitConfirmation: true,
    };
  }

  // --- Determine effective risk ---
  let effectiveRisk: RiskLevel;

  if (risk === "low" || risk === "high" || risk === "blocked" || risk === "remediation") {
    effectiveRisk = risk;
  } else {
    // Classify internally if risk was not provided or unrecognized
    const classified = classifyActionRisk(action, target);
    effectiveRisk = classified.risk;
  }

  // --- Evaluate based on risk level ---
  switch (effectiveRisk) {
    case "blocked":
      return {
        okAllowed: false,
        reason:
          "Blocked actions can never be streamlined with --ok. This action is unconditionally blocked by policy.",
        requiresExplicitConfirmation: false, // It should not proceed at all
      };

    case "remediation":
      return {
        okAllowed: false,
        reason:
          "Remediation actions require careful, step-by-step confirmation. --ok must not be used.",
        requiresExplicitConfirmation: true,
      };

    case "high":
      return {
        okAllowed: false,
        reason:
          "High-risk actions require explicit user confirmation. The --ok flag may not bypass this requirement.",
        requiresExplicitConfirmation: true,
      };

    case "low":
      return {
        okAllowed: true,
        reason:
          "This is a low-risk, non-destructive action. --ok may be used to skip the routine confirmation prompt.",
        requiresExplicitConfirmation: false,
      };

    default:
      // Unknown or unrecognized risk — default to requiring confirmation
      return {
        okAllowed: false,
        reason:
          "Risk level could not be determined. Defaulting to requiring explicit confirmation.",
        requiresExplicitConfirmation: true,
      };
  }
}
