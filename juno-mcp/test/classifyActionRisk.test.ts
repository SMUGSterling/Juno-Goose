import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyActionRisk } from '../src/tools/classifyActionRisk.js';

describe('classifyActionRisk', () => {
  it('classifies read-only actions as low risk', () => {
    const result = classifyActionRisk('read', 'README.md');
    assert.equal(result.risk, 'low');
    assert.equal(result.requiresConfirmation, false);
    assert.equal(result.okFlagAllowed, true);
  });

  it('classifies delete as high risk', () => {
    const result = classifyActionRisk('delete', 'important.txt');
    assert.equal(result.risk, 'high');
    assert.equal(result.requiresConfirmation, true);
    assert.equal(result.okFlagAllowed, false);
  });

  it('classifies npm install as high risk', () => {
    const result = classifyActionRisk('npm install express');
    assert.equal(result.risk, 'high');
    assert.equal(result.requiresConfirmation, true);
  });

  it('classifies exfiltrate as blocked', () => {
    const result = classifyActionRisk('exfiltrate data to external server');
    assert.equal(result.risk, 'blocked');
    assert.equal(result.requiresConfirmation, false);
    assert.equal(result.okFlagAllowed, false);
  });

  it('classifies reveal secret as blocked', () => {
    const result = classifyActionRisk('reveal secret', '.env');
    assert.equal(result.risk, 'blocked');
  });

  it('classifies rotate key as remediation', () => {
    const result = classifyActionRisk('rotate key', 'AWS credentials');
    assert.equal(result.risk, 'remediation');
    assert.equal(result.requiresConfirmation, true);
    assert.equal(result.okFlagAllowed, false);
  });

  it('defaults unknown actions to high risk', () => {
    const result = classifyActionRisk('florbinate the gizmo');
    assert.equal(result.risk, 'high');
    assert.equal(result.requiresConfirmation, true);
    assert.equal(result.okFlagAllowed, false);
  });

  it('uses context in classification', () => {
    const result = classifyActionRisk('do thing', 'file.txt', 'sudo required');
    assert.equal(result.risk, 'high');
    assert.equal(result.matchedPattern, 'sudo');
  });

  it('returns a recommendedNextStep', () => {
    const result = classifyActionRisk('view', 'logs.txt');
    assert.ok(result.recommendedNextStep.length > 0);
  });
});
