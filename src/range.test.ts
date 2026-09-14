import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseRange, satisfies } from './range'
import { parse, SemVerError } from './semver'

test('caret expands to a >= / < pair anchored below the next major', () => {
  const range = parseRange('^1.2.3')
  assert.deepEqual(range.sets, [
    [
      { operator: '>=', version: parse('1.2.3') },
      { operator: '<', version: parse('2.0.0') },
    ],
  ])
})

test('caret treats a 0.x minor as the leftmost non-zero component', () => {
  const range = parseRange('^0.2.3')
  assert.deepEqual(range.sets, [
    [
      { operator: '>=', version: parse('0.2.3') },
      { operator: '<', version: parse('0.3.0') },
    ],
  ])
})

test('caret treats a 0.0.x patch as the leftmost non-zero component', () => {
  const range = parseRange('^0.0.3')
  assert.deepEqual(range.sets, [
    [
      { operator: '>=', version: parse('0.0.3') },
      { operator: '<', version: parse('0.0.4') },
    ],
  ])
})

test('tilde expands to a >= / < pair anchored below the next minor', () => {
  const range = parseRange('~1.2.3')
  assert.deepEqual(range.sets, [
    [
      { operator: '>=', version: parse('1.2.3') },
      { operator: '<', version: parse('1.3.0') },
    ],
  ])
})

test('explicit comparators are parsed as given, defaulting to "=" with no operator', () => {
  const range = parseRange('1.2.3')
  assert.deepEqual(range.sets, [[{ operator: '=', version: parse('1.2.3') }]])
})

test('whitespace-separated comparators within a set are collected together', () => {
  const range = parseRange('>=1.0.0 <2.0.0')
  assert.deepEqual(range.sets, [
    [
      { operator: '>=', version: parse('1.0.0') },
      { operator: '<', version: parse('2.0.0') },
    ],
  ])
})

test('"||" joins multiple comparator sets', () => {
  const range = parseRange('^1.2.3 || >=3.0.0')
  assert.equal(range.sets.length, 2)
  assert.deepEqual(range.sets[1], [{ operator: '>=', version: parse('3.0.0') }])
})

test('rejects an empty range string', () => {
  assert.throws(() => parseRange(''), /range string is empty/)
  assert.throws(() => parseRange('   '), /range string is empty/)
})

test('rejects an empty comparator set', () => {
  assert.throws(() => parseRange('1.0.0 || '), /comparator set is empty/)
})

test('rejects a comparator with no version', () => {
  assert.throws(() => parseRange('>='), /comparator ">=" is missing a version/)
})

test('rejects "^" and "~" with no version', () => {
  assert.throws(() => parseRange('^'), /"\^" requires a version/)
  assert.throws(() => parseRange('~'), /"~" requires a version/)
})

test('rejects a partial version, same as parse() in strict mode', () => {
  assert.throws(() => parseRange('1.2'), SemVerError)
})

test('lenient option is forwarded to the versions inside the range', () => {
  const range = parseRange('^01.2.3', { lenient: true })
  assert.deepEqual(range.sets, [
    [
      { operator: '>=', version: parse('1.2.3') },
      { operator: '<', version: parse('2.0.0') },
    ],
  ])
  assert.throws(() => parseRange('^01.2.3'), SemVerError)
})

test('satisfies matches a version within a caret range and rejects one outside it', () => {
  const range = parseRange('^1.2.3')
  assert.equal(satisfies(parse('1.2.4'), range), true)
  assert.equal(satisfies(parse('1.9.9'), range), true)
  assert.equal(satisfies(parse('1.2.3'), range), true)
  assert.equal(satisfies(parse('2.0.0'), range), false)
  assert.equal(satisfies(parse('1.2.2'), range), false)
})

test('satisfies requires every comparator in a set to match', () => {
  const range = parseRange('>=1.0.0 <2.0.0')
  assert.equal(satisfies(parse('1.5.0'), range), true)
  assert.equal(satisfies(parse('2.0.0'), range), false)
  assert.equal(satisfies(parse('0.9.0'), range), false)
})

test('satisfies matches if any "||" set matches', () => {
  const range = parseRange('^1.2.3 || >=3.0.0')
  assert.equal(satisfies(parse('1.5.0'), range), true)
  assert.equal(satisfies(parse('3.2.0'), range), true)
  assert.equal(satisfies(parse('2.5.0'), range), false)
})

test('satisfies treats an exact comparator as equality, ignoring build metadata', () => {
  const range = parseRange('1.2.3')
  assert.equal(satisfies(parse('1.2.3+build.1'), range), true)
  assert.equal(satisfies(parse('1.2.4'), range), false)
})
