import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'

// cli.ts runs main() as an import-time side effect, so the only faithful way
// to test it is to invoke the compiled binary as a real process, the same
// way a user's shell would.
const CLI_PATH = path.join(__dirname, 'cli.js')

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('prints the canonical form of a valid version and exits 0', () => {
  const result = run(['1.4.0-beta.2+exp.sha.5114f85'])
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '1.4.0-beta.2+exp.sha.5114f85\n')
  assert.equal(result.stderr, '')
})

test('rejects a spec violation and exits 1 with an error on stderr', () => {
  const result = run(['1.04.0'])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /invalid version "1\.04\.0": minor version "04" has a leading zero/)
})

test('--lenient accepts a "v" prefix and a partial version', () => {
  const result = run(['v1.4', '--lenient'])
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '1.4.0\n')
})

test('without --lenient, the same input is rejected', () => {
  const result = run(['v1.4'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /invalid version "v1\.4"/)
})

test('--json prints the parsed components instead of the canonical string', () => {
  const result = run(['1.2.3-alpha.1', '--json'])
  assert.equal(result.status, 0)
  assert.deepEqual(JSON.parse(result.stdout), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: ['alpha', 1],
    build: [],
  })
})

test('--help prints usage to stderr and exits 0 without requiring a version', () => {
  const result = run(['--help'])
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^usage: strict-semver/)
})

test('with no arguments, prints usage to stderr and exits 1', () => {
  const result = run([])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /^usage: strict-semver/)
})

test('with more than one positional argument, prints usage and exits 1', () => {
  const result = run(['1.0.0', '2.0.0'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /^usage: strict-semver/)
})

test('an unknown flag is rejected before usage is printed', () => {
  const result = run(['1.0.0', '--bogus'])
  assert.equal(result.status, 1)
  assert.equal(result.stderr, 'unknown flag: --bogus\n')
})
