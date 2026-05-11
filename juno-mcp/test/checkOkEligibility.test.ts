import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkOkEligibility } from '../src/tools/checkOkEligibility.js';

describe('checkOkEligibility', () => {
  it('allows --ok for low-risk read actions', () => {
    const result = checkOkEligibility('view', 'README.md', 'low');
    assert.equal(result.okAllowed, true);
    assert.equal(result.requiresExplicitConfirmation, false);
  });

  it('denies --ok for high-risk actions', () => {
    const result = checkOkEligibility('overwrite config', 'app.yml', 'high');
    assert.equal(result.okAllowed, false);
    assert.equal(result.requiresExplicitConfirmation, true);
  });

  it('denies --ok for blocked actions', () => {
    const result = checkOkEligibility('exfiltrate', 'data', 'blocked');
    assert.equal(result.okAllowed, false);
    assert.equal(result.requiresExplicitConfirmation, false);
  });

  it('denies --ok for remediation actions', () => {
    const result = checkOkEligibility('rotate key', 'aws', 'remediation');
    assert.equal(result.okAllowed, false);
    assert.equal(result.requiresExplicitConfirmation, true);
  });

  it('denies --ok when action contains blocked keyword (delete)', () => {
    const result = checkOkEligibility('delete file', 'notes.txt');
    assert.equal(result.okAllowed, false);
    assert.match(result.reason, /block list/);
  });

  it('denies --ok when action mentions credentials', () => {
    const result = checkOkEligibility('read credential file', '.env');
    assert.equal(result.okAllowed, false);
    assert.match(result.reason, /block list/);
  });

  it('denies --ok for git operations', () => {
    const result = checkOkEligibility('git push origin main');
    assert.equal(result.okAllowed, false);
  });

  it('denies --ok for network actions', () => {
    const result = checkOkEligibility('send data to network endpoint');
    assert.equal(result.okAllowed, false);
  });

  it('classifies internally when no risk provided', () => {
    const result = checkOkEligibility('view', 'file.txt');
    assert.equal(result.okAllowed, true);
  });
});
