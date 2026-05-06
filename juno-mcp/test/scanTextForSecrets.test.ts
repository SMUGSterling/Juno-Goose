import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scanTextForSecrets } from '../src/tools/scanTextForSecrets.js';

describe('scanTextForSecrets', () => {
  it('redacts fake secret-like values and does not return raw matches in findings', () => {
    const fakeOpenAI = 'sk-proj-fake1234567890abcdef1234567890abcdef';
    const fakeGithub = 'ghp_fakefakefakefakefakefakefakefakefakefake';
    const input = [
      `OPENAI_API_KEY=${fakeOpenAI}`,
      `GITHUB_TOKEN=${fakeGithub}`,
    ].join('\n');

    const result = scanTextForSecrets(input, 'unit-test');

    assert.equal(result.containsSecrets, true);
    assert.match(result.redactedText, /REDACTED/);
    assert.equal(result.redactedText.includes(fakeOpenAI), false);
    assert.equal(result.redactedText.includes(fakeGithub), false);

    for (const finding of result.findings) {
      assert.match(finding.redactedExample, /REDACTED/);
      assert.equal(finding.redactedExample.includes(fakeOpenAI), false);
      assert.equal(finding.redactedExample.includes(fakeGithub), false);
    }

    assert.match(result.recommendation, /rotate|revoke|redact/i);
  });

  it('does not flag benign placeholder text', () => {
    const input = 'API_KEY=MY_API_KEY\npassword=example\nThis is documentation about secrets.';
    const result = scanTextForSecrets(input, 'docs');

    assert.equal(result.containsSecrets, false);
    assert.equal(result.findings.length, 0);
    assert.equal(result.redactedText, input);
  });
});
