import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderConfirmation } from '../src/tools/renderConfirmation.js';

describe('renderConfirmation', () => {
  it('renders all fields in the message', () => {
    const result = renderConfirmation(
      'Delete file',
      'important.txt',
      'Permanent data loss',
      'File contains project notes'
    );
    assert.match(result.message, /Action:\s+Delete file/);
    assert.match(result.message, /Target:\s+important\.txt/);
    assert.match(result.message, /Risk:\s+Permanent data loss/);
    assert.match(result.message, /Reason:\s+File contains project notes/);
    assert.match(result.message, /Request:\s+Confirm before I proceed\./);
  });

  it('provides default reason when none given', () => {
    const result = renderConfirmation('Install package', 'express', 'Modifies node_modules');
    assert.match(result.message, /Reason:\s+No additional context provided\./);
    assert.equal(result.structured.reason, 'No additional context provided.');
  });

  it('returns structured data matching the message', () => {
    const result = renderConfirmation('Run script', 'build.sh', 'Executes code');
    assert.equal(result.structured.action, 'Run script');
    assert.equal(result.structured.target, 'build.sh');
    assert.equal(result.structured.risk, 'Executes code');
    assert.equal(result.structured.request, 'Confirm before I proceed.');
  });
});
