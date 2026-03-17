#!/usr/bin/env node

/**
 * Secret redaction for Wire Memory transcript uploads.
 *
 * Scans text for common secret patterns (API keys, tokens, passwords,
 * connection strings, private keys) and replaces them with [REDACTED:label].
 *
 * Zero dependencies — Node.js built-ins only.
 */

const PATTERNS = [
  // ── API Keys ────────────────────────────────────────────────────────────
  { label: 'openai_key', re: /sk-[A-Za-z0-9]{20,}/g },
  { label: 'anthropic_key', re: /sk-ant-[A-Za-z0-9\-]{20,}/g },
  { label: 'stripe_key', re: /sk_(live|test)_[A-Za-z0-9]{20,}/g },
  { label: 'stripe_restricted', re: /rk_(live|test)_[A-Za-z0-9]{20,}/g },
  { label: 'wire_key', re: /wire_(live|test|preview)_[A-Za-z0-9]{20,}/g },
  { label: 'aws_key', re: /AKIA[0-9A-Z]{16}/g },
  { label: 'github_token', re: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  { label: 'github_pat', re: /github_pat_[A-Za-z0-9_]{20,}/g },
  { label: 'slack_token', re: /xox[bpras]-[A-Za-z0-9\-]{10,}/g },
  { label: 'sendgrid_key', re: /SG\.[A-Za-z0-9_\-]{22,}\.[A-Za-z0-9_\-]{22,}/g },
  { label: 'twilio_key', re: /SK[0-9a-f]{32}/g },
  { label: 'cloudflare_key', re: /[A-Za-z0-9_]{37,}_[A-Za-z0-9]{10,}/g }, // CF API tokens

  // ── Bearer / JWT Tokens ─────────────────────────────────────────────────
  { label: 'bearer_token', re: /Bearer\s+eyJ[A-Za-z0-9_\-\.]{20,}/g },
  { label: 'jwt', re: /eyJ[A-Za-z0-9_\-]{20,}\.eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}/g },

  // ── Connection Strings ──────────────────────────────────────────────────
  { label: 'connection_string', re: /(postgresql|postgres|mysql|mongodb|mongodb\+srv|redis|rediss|amqp|amqps):\/\/[^\s"'`}{)>\]]{10,}/g },

  // ── Private Keys ────────────────────────────────────────────────────────
  { label: 'private_key', re: /-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },

  // ── Passwords in URLs ───────────────────────────────────────────────────
  { label: 'url_password', re: /:\/\/([^:]+):([^@\s]{8,})@/g },

  // ── Env-style Secrets ───────────────────────────────────────────────────
  { label: 'env_secret', re: /(PASSWORD|SECRET|TOKEN|API_KEY|APIKEY|AUTH|CREDENTIAL|PRIVATE_KEY)\s*[:=]\s*['"]?[^\s'"`,}{)>\]]{8,}/gi },

  // ── Generic long hex/base64 secrets (conservative — only in key=value context) ──
  { label: 'hex_secret', re: /(secret|token|key|password|auth)\s*[:=]\s*['"]?[0-9a-f]{32,}['"]?/gi },
  { label: 'base64_secret', re: /(secret|token|key|password|auth)\s*[:=]\s*['"]?[A-Za-z0-9+\/]{40,}={0,2}['"]?/gi },
];

/**
 * Redact secrets from a text string.
 * @param {string} text - Input text (can be multi-line)
 * @returns {string} Text with secrets replaced by [REDACTED:label]
 */
export function redactSecrets(text) {
  let result = text;

  for (const { label, re } of PATTERNS) {
    // Reset lastIndex for global regexes
    re.lastIndex = 0;

    if (label === 'url_password') {
      // Special handling: preserve the protocol + user, redact only the password
      result = result.replace(re, (_, user) => `://${user}:[REDACTED:${label}]@`);
    } else {
      result = result.replace(re, `[REDACTED:${label}]`);
    }
  }

  return result;
}
