import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compare, format, parse, rsort, safeParse, SemVerError, sort } from './semver'

test('strict mode accepts a full major.minor.patch with prerelease and build', () => {
  const version = parse('1.4.0-beta.2+exp.sha.5114f85')
  assert.deepEqual(version, {
    major: 1,
    minor: 4,
    patch: 0,
    prerelease: ['beta', 2],
    build: ['exp', 'sha', '5114f85'],
  })
})

test('strict mode rejects a "v" prefix', () => {
  assert.throws(() => parse('v1.4.0'), SemVerError)
})

test('strict mode rejects a missing component', () => {
  assert.throws(() => parse('1.4'), SemVerError)
  assert.throws(() => parse('1'), SemVerError)
})

test('strict mode rejects leading zeros in core components', () => {
  assert.throws(() => parse('1.04.0'), /minor version "04" has a leading zero/)
  assert.throws(() => parse('01.4.0'), /major version "01" has a leading zero/)
})

test('strict mode rejects leading zeros in numeric prerelease identifiers', () => {
  assert.throws(() => parse('1.4.0-01'), /prerelease identifier "01" has a leading zero/)
})

test('strict mode rejects non-numeric core components', () => {
  assert.throws(() => parse('1.x.0'), /minor version "x" is not numeric/)
})

test('strict mode rejects empty prerelease and build sections', () => {
  assert.throws(() => parse('1.4.0-'), /prerelease section is empty/)
  assert.throws(() => parse('1.4.0+'), /build metadata section is empty/)
})

test('strict mode rejects prerelease identifiers with invalid characters', () => {
  assert.throws(() => parse('1.4.0-bet@'), /contains characters outside/)
})

test('strict mode rejects an empty string', () => {
  assert.throws(() => parse(''), /version string is empty/)
})

test('lenient mode strips a "v" or "V" prefix and surrounding whitespace', () => {
  assert.deepEqual(parse('v1.4.0', { lenient: true }), parse('1.4.0'))
  assert.deepEqual(parse('  V1.4.0  ', { lenient: true }), parse('1.4.0'))
})

test('lenient mode fills in missing minor and patch with zero', () => {
  assert.deepEqual(parse('1.4', { lenient: true }), parse('1.4.0'))
  assert.deepEqual(parse('1', { lenient: true }), parse('1.0.0'))
})

test('lenient mode accepts leading zeros in core and prerelease components', () => {
  const version = parse('01.02.03-01', { lenient: true })
  assert.deepEqual(version, { major: 1, minor: 2, patch: 3, prerelease: [1], build: [] })
})

test('lenient mode still rejects more than three core components', () => {
  assert.throws(() => parse('1.2.3.4', { lenient: true }), SemVerError)
})

test('lenient mode still rejects non-numeric core components', () => {
  assert.throws(() => parse('1.x.0', { lenient: true }), /minor version "x" is not numeric/)
})

test('safeParse returns a result object instead of throwing', () => {
  const ok = safeParse('1.4.0')
  assert.equal(ok.ok, true)
  assert.equal(ok.ok && format(ok.value), '1.4.0')

  const bad = safeParse('not-a-version')
  assert.equal(bad.ok, false)
  assert.ok(!bad.ok && bad.error instanceof SemVerError)
})

test('format round-trips a version with prerelease and build metadata', () => {
  const input = '1.4.0-beta.2+exp.sha.5114f85'
  assert.equal(format(parse(input)), input)
})

test('format omits prerelease and build when absent', () => {
  assert.equal(format(parse('1.4.0')), '1.4.0')
})

test('compare orders core versions numerically, not lexically', () => {
  assert.equal(compare(parse('1.2.3'), parse('1.10.0')), -1)
  assert.equal(compare(parse('1.10.0'), parse('1.2.3')), 1)
})

test('compare treats a prerelease version as lower than the same release version', () => {
  assert.equal(compare(parse('1.2.3-beta'), parse('1.2.3')), -1)
  assert.equal(compare(parse('1.2.3'), parse('1.2.3-beta')), 1)
})

test('compare treats numeric prerelease identifiers as lower than alphanumeric ones', () => {
  assert.equal(compare(parse('1.2.3-1'), parse('1.2.3-alpha')), -1)
})

test('compare falls back to a shorter prerelease being lower', () => {
  assert.equal(compare(parse('1.2.3-alpha'), parse('1.2.3-alpha.1')), -1)
})

test('compare ignores build metadata', () => {
  assert.equal(compare(parse('1.2.3+build.1'), parse('1.2.3+build.2')), 0)
})

test('sort produces ascending order and rsort descending order', () => {
  const versions = ['1.2.3', '1.0.0', '1.2.3-beta', '2.0.0'].map((v) => parse(v))
  assert.deepEqual(sort(versions).map(format), ['1.0.0', '1.2.3-beta', '1.2.3', '2.0.0'])
  assert.deepEqual(rsort(versions).map(format), ['2.0.0', '1.2.3', '1.2.3-beta', '1.0.0'])
})
