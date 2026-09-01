// Range parsing for the comparator syntax used by version specifiers:
// caret (^1.2.3), tilde (~1.2.3), and explicit comparators (>=1.0.0 <2.0.0).
//
// A range is one or more comparator sets joined by "||" (any set may
// match); within a set, comparators are joined by whitespace (all must
// match). Caret and tilde are shorthand that expand to a >=/< pair, so
// by the time parseRange returns, every comparator is one of
// =, >, >=, <, <=  — there is no shorthand left to interpret downstream.
//
// Unlike parse() in semver.ts, every version inside a range must be a
// full major.minor.patch (matching the README's examples); partial
// versions like "^1.2" or ">=1" are not accepted.

import { parse, type ParseOptions, type SemVer, SemVerError } from './semver'

export type ComparatorOperator = '=' | '>' | '>=' | '<' | '<='

export interface Comparator {
  operator: ComparatorOperator
  version: SemVer
}

export type ComparatorSet = Comparator[]

export interface Range {
  sets: ComparatorSet[]
}

const OPERATORS: ComparatorOperator[] = ['>=', '<=', '>', '<', '=']

export function parseRange(input: string, options: ParseOptions = {}): Range {
  const lenient = options.lenient ?? false
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    throw new SemVerError('range string is empty', input)
  }

  const sets = trimmed.split('||').map((part) => parseComparatorSet(part, lenient, input))
  return { sets }
}

function parseComparatorSet(part: string, lenient: boolean, input: string): ComparatorSet {
  const tokens = part.trim().split(/\s+/).filter((token) => token.length > 0)
  if (tokens.length === 0) {
    throw new SemVerError('comparator set is empty', input)
  }

  const comparators: Comparator[] = []
  for (const token of tokens) {
    if (token.startsWith('^')) {
      comparators.push(...caretComparators(token.slice(1), lenient, input))
    } else if (token.startsWith('~')) {
      comparators.push(...tildeComparators(token.slice(1), lenient, input))
    } else {
      comparators.push(parseComparator(token, lenient, input))
    }
  }
  return comparators
}

function parseComparator(token: string, lenient: boolean, input: string): Comparator {
  let operator: ComparatorOperator = '='
  let versionPart = token
  for (const candidate of OPERATORS) {
    if (token.startsWith(candidate)) {
      operator = candidate
      versionPart = token.slice(candidate.length)
      break
    }
  }

  if (versionPart.length === 0) {
    throw new SemVerError(`comparator "${token}" is missing a version`, input)
  }

  return { operator, version: parse(versionPart, { lenient }) }
}

function caretComparators(versionPart: string, lenient: boolean, input: string): [Comparator, Comparator] {
  if (versionPart.length === 0) {
    throw new SemVerError('"^" requires a version', input)
  }
  const version = parse(versionPart, { lenient })
  return [
    { operator: '>=', version },
    { operator: '<', version: caretUpperBound(version) },
  ]
}

// Caret allows changes that don't modify the leftmost non-zero component,
// mirroring how npm treats 0.x releases as not yet stable.
function caretUpperBound(version: SemVer): SemVer {
  if (version.major > 0) {
    return zeroed({ major: version.major + 1 })
  }
  if (version.minor > 0) {
    return zeroed({ minor: version.minor + 1 })
  }
  return zeroed({ patch: version.patch + 1 })
}

function tildeComparators(versionPart: string, lenient: boolean, input: string): [Comparator, Comparator] {
  if (versionPart.length === 0) {
    throw new SemVerError('"~" requires a version', input)
  }
  const version = parse(versionPart, { lenient })
  return [
    { operator: '>=', version },
    { operator: '<', version: zeroed({ major: version.major, minor: version.minor + 1 }) },
  ]
}

function zeroed(overrides: Partial<Pick<SemVer, 'major' | 'minor' | 'patch'>>): SemVer {
  return {
    major: overrides.major ?? 0,
    minor: overrides.minor ?? 0,
    patch: overrides.patch ?? 0,
    prerelease: [],
    build: [],
  }
}
