/**
 * policyResources.ts
 *
 * Exposes Juno-Goose policy summaries as MCP resources.
 *
 * Available resources:
 *   juno://policy/secrets  — secret-handling policy
 *   juno://policy/risk     — risk classification categories
 *   juno://policy/ferpa    — FERPA / student data privacy policy
 *   juno://policy/ok-flag  — --ok flag eligibility rules
 *
 * Safety contract:
 *   - All content is read-only static policy text.
 *   - No user input is interpolated into the policy text.
 */

import { POLICY_SUMMARIES } from "../policy/junoPolicy.js";

// ---------------------------------------------------------------------------
// Resource definitions
// ---------------------------------------------------------------------------

export interface PolicyResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  getContent: () => string;
}

export const POLICY_RESOURCES: PolicyResource[] = [
  {
    uri: "juno://policy/secrets",
    name: "Juno-Goose Secret-Handling Policy",
    description:
      "Describes how Juno-Goose handles detected secrets: redaction, remediation mode, and what does and does not trigger remediation.",
    mimeType: "text/markdown",
    getContent: () => POLICY_SUMMARIES.secrets,
  },
  {
    uri: "juno://policy/risk",
    name: "Juno-Goose Risk Classification Policy",
    description:
      "Defines the four risk levels: low, high, blocked, and remediation, with example actions for each.",
    mimeType: "text/markdown",
    getContent: () => POLICY_SUMMARIES.risk,
  },
  {
    uri: "juno://policy/ferpa",
    name: "Juno-Goose FERPA / Student Data Privacy Policy",
    description:
      "Summarizes FERPA requirements and how Juno-Goose handles student records and educational data.",
    mimeType: "text/markdown",
    getContent: () => POLICY_SUMMARIES.ferpa,
  },
  {
    uri: "juno://policy/ok-flag",
    name: "Juno-Goose --ok Flag Policy",
    description:
      "Explains when the --ok convenience flag is and is not allowed, and what it does and does not bypass.",
    mimeType: "text/markdown",
    getContent: () => POLICY_SUMMARIES.okFlag,
  },
];
