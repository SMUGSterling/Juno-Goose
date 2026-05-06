/**
 * scanTextForSecrets.ts
 *
 * Pattern-based secret scanner. Detects likely secrets in text using
 * regex patterns. Never returns raw matched values — only redacted
 * examples and metadata about the finding.
 *
 * Safety contract:
 *   - Raw secret values MUST NOT appear in return values.
 *   - All findings include only a redacted example.
 *   - The redactedText returned has all matched regions replaced with [REDACTED].
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecretFinding {
  type: string;
  severity: "critical" | "high" | "medium";
  startLine: number;
  endLine: number;
  /** Safe preview: shows only the type prefix and masks the secret value. */
  redactedExample: string;
}

export interface ScanResult {
  containsSecrets: boolean;
  findings: SecretFinding[];
  redactedText: string;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Pattern definitions
// Each pattern includes a name, regex, severity, and a function that
// produces a safe redacted example (never the raw value).
// ---------------------------------------------------------------------------

interface SecretPattern {
  name: string;
  severity: SecretFinding["severity"];
  regex: RegExp;
  /** Returns a safe, non-revealing example string for the finding. */
  redactedExampleFn: (match: string) => string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "OpenAI API Key",
    severity: "critical",
    // sk-... or sk-proj-... (OpenAI style)
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    redactedExampleFn: () => "sk-[REDACTED]",
  },
  {
    name: "GitHub Token",
    severity: "critical",
    // ghp_, gho_, ghu_, ghs_, ghr_ prefixes
    regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g,
    redactedExampleFn: (m) => m.slice(0, 4) + "[REDACTED]",
  },
  {
    name: "AWS Access Key ID",
    severity: "critical",
    regex: /\b(AKIA|ASIA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    redactedExampleFn: (m) => m.slice(0, 4) + "[REDACTED]",
  },
  {
    name: "AWS Secret Access Key",
    severity: "critical",
    // 40-char base64-ish strings following aws_secret patterns
    regex:
      /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*["']?([A-Za-z0-9/+]{40})["']?/gi,
    redactedExampleFn: () => "aws_secret_access_key=[REDACTED]",
  },
  {
    name: "Generic API Key Assignment",
    severity: "high",
    // key = "long-value" or API_KEY=... patterns
    regex:
      /(?:api[_-]?key|apikey|x-api-key)\s*[=:]\s*["']?([A-Za-z0-9_\-./+]{16,})["']?/gi,
    redactedExampleFn: () => "api_key=[REDACTED]",
  },
  {
    name: "Bearer Token",
    severity: "high",
    regex: /Bearer\s+([A-Za-z0-9\-._~+/]+=*){20,}/gi,
    redactedExampleFn: () => "Bearer [REDACTED]",
  },
  {
    name: "Private Key Block",
    severity: "critical",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
    redactedExampleFn: () => "-----BEGIN [REDACTED] PRIVATE KEY-----",
  },
  {
    name: "SSH Private Key",
    severity: "critical",
    regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    redactedExampleFn: () => "-----BEGIN OPENSSH PRIVATE KEY [REDACTED]-----",
  },
  {
    name: "Database URL with Credentials",
    severity: "critical",
    // postgresql://user:password@host, mysql://user:pass@host, etc.
    regex:
      /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|jdbc:[^:]+):\/\/[^:@\s]+:[^@\s]+@[^\s"']+/gi,
    redactedExampleFn: (m) => {
      // Redact everything between :// and @ to hide credentials
      return m.replace(/:\/\/[^@]+@/, "://[REDACTED]@");
    },
  },
  {
    name: "JWT-like Token",
    severity: "high",
    // Three base64url segments separated by dots — typical JWT structure
    regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    redactedExampleFn: () => "eyJ[REDACTED].[REDACTED].[REDACTED]",
  },
  {
    name: "Generic High-Entropy Secret Assignment",
    severity: "medium",
    // password = "...", secret = "...", token = "..." with long values
    regex:
      /(?:password|passwd|secret|token|auth|credentials?)\s*[=:]\s*["']([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{12,})["']/gi,
    redactedExampleFn: (m) => {
      const keyPart = m.split(/[=:]/)[0]?.trim() ?? "secret";
      return `${keyPart}=[REDACTED]`;
    },
  },
];

// ---------------------------------------------------------------------------
// Helper: get line number for a character offset in text
// ---------------------------------------------------------------------------

function charOffsetToLine(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

// ---------------------------------------------------------------------------
// Main scan function
// ---------------------------------------------------------------------------

/**
 * Scans the provided text for likely secrets.
 *
 * @param text - The text to scan (may be multi-line).
 * @param contextLabel - Optional label used only in the recommendation text.
 * @returns ScanResult — never includes raw secret values.
 */
export function scanTextForSecrets(
  text: string,
  contextLabel?: string
): ScanResult {
  const findings: SecretFinding[] = [];
  let redactedText = text;

  // Collect all matches first, then apply replacements in reverse order
  // to preserve character offsets.
  interface RawMatch {
    pattern: SecretPattern;
    match: string;
    index: number;
    length: number;
  }

  const rawMatches: RawMatch[] = [];

  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.regex.exec(text)) !== null) {
      rawMatches.push({
        pattern,
        match: m[0],
        index: m.index,
        length: m[0].length,
      });
      // Guard against infinite loops on zero-length matches
      if (m[0].length === 0) {
        pattern.regex.lastIndex++;
      }
    }
  }

  // Sort matches by index descending so replacements don't shift offsets
  rawMatches.sort((a, b) => b.index - a.index);

  // Build findings and apply redactions
  for (const rm of rawMatches) {
    const startLine = charOffsetToLine(text, rm.index);
    const endLine = charOffsetToLine(text, rm.index + rm.length - 1);

    findings.push({
      type: rm.pattern.name,
      severity: rm.pattern.severity,
      startLine,
      endLine,
      // Safe example — never includes the raw value
      redactedExample: rm.pattern.redactedExampleFn(rm.match),
    });

    // Replace the match in the redacted text
    redactedText =
      redactedText.slice(0, rm.index) +
      "[REDACTED]" +
      redactedText.slice(rm.index + rm.length);
  }

  // Reverse findings so they're in document order
  findings.reverse();

  const containsSecrets = findings.length > 0;
  const label = contextLabel ? ` in "${contextLabel}"` : "";

  const recommendation = containsSecrets
    ? `Secrets were detected${label}. ` +
      `Do NOT share this content further without redacting the values. ` +
      `Rotate or revoke any exposed credentials immediately. ` +
      `Remove secrets from version control history if they were committed.`
    : `No obvious secrets detected${label}. ` +
      `Manual review is still recommended for sensitive content.`;

  return {
    containsSecrets,
    findings,
    redactedText,
    recommendation,
  };
}
