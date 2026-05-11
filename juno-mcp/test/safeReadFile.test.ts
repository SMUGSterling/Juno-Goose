import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { safeReadFile } from '../src/tools/safeReadFile.js';

const TMP_DIR = path.join(process.cwd(), '__test_tmp__');

function setup() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  process.env['JUNO_MCP_ROOT'] = TMP_DIR;
}

function teardown() {
  delete process.env['JUNO_MCP_ROOT'];
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('safeReadFile', () => {
  beforeEach(() => setup());
  afterEach(() => teardown());

  it('reads a safe file successfully', () => {
    fs.writeFileSync(path.join(TMP_DIR, 'hello.txt'), 'hello world');
    const result = safeReadFile('hello.txt');
    assert.equal(result.allowed, true);
    assert.equal(result.blocked, false);
    assert.equal(result.content, 'hello world');
    assert.equal(result.containsSecrets, false);
  });

  it('blocks path traversal outside root', () => {
    const result = safeReadFile('../../etc/passwd');
    assert.equal(result.allowed, false);
    assert.equal(result.blocked, true);
    assert.match(result.reason, /traversal/i);
  });

  it('blocks sensitive file patterns (.env)', () => {
    fs.writeFileSync(path.join(TMP_DIR, '.env'), 'SECRET=abc');
    const result = safeReadFile('.env');
    assert.equal(result.allowed, false);
    assert.equal(result.blocked, true);
    assert.match(result.reason, /sensitive/i);
  });

  it('blocks private key files', () => {
    fs.writeFileSync(path.join(TMP_DIR, 'id_rsa'), 'fake key');
    const result = safeReadFile('id_rsa');
    assert.equal(result.allowed, false);
    assert.equal(result.blocked, true);
  });

  it('returns not found for missing files', () => {
    const result = safeReadFile('nonexistent.txt');
    assert.equal(result.allowed, false);
    assert.equal(result.blocked, true);
    assert.match(result.reason, /not found/i);
  });

  it('redacts secrets found in file content', () => {
    const content = 'OPENAI_API_KEY=sk-proj-fake1234567890abcdef1234567890abcdef';
    fs.writeFileSync(path.join(TMP_DIR, 'config.txt'), content);
    const result = safeReadFile('config.txt');
    assert.equal(result.allowed, true);
    assert.equal(result.containsSecrets, true);
    assert.ok(result.redactedContent);
    assert.match(result.redactedContent!, /REDACTED/);
    assert.equal(result.content, undefined);
  });

  it('truncates files exceeding maxBytes', () => {
    const bigContent = 'x'.repeat(1000);
    fs.writeFileSync(path.join(TMP_DIR, 'big.txt'), bigContent);
    const result = safeReadFile('big.txt', 100);
    assert.equal(result.allowed, true);
    assert.equal(result.truncated, true);
  });

  it('rejects directories', () => {
    fs.mkdirSync(path.join(TMP_DIR, 'subdir'));
    const result = safeReadFile('subdir');
    assert.equal(result.allowed, false);
    assert.equal(result.blocked, true);
    assert.match(result.reason, /not a regular file/i);
  });

  it('blocks symlinks pointing outside root', () => {
    const outsideFile = path.join(TMP_DIR, '..', '__outside_test__.txt');
    fs.writeFileSync(outsideFile, 'outside');
    try {
      fs.symlinkSync(outsideFile, path.join(TMP_DIR, 'sneaky_link'));
      const result = safeReadFile('sneaky_link');
      assert.equal(result.allowed, false);
      assert.equal(result.blocked, true);
      assert.match(result.reason, /symlink/i);
    } finally {
      fs.unlinkSync(outsideFile);
    }
  });
});
