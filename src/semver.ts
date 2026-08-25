// Semantic version parsing and formatting, per https://semver.org/spec/v2.0.0.html
//
// Strict mode enforces the spec exactly: no leading zeros in numeric
// components, no "v" prefix, and all three of major.minor.patch required.
// Real-world version strings (git tags, npm ranges pasted from changelogs)
// routinely violate at least one of those, so `lenient` relaxes them
// individually instead of accepting anything that merely looks version-ish.

export interface SemVer {
  major: number
  minor: number
  patch: number
  prerelease: Array<string | number>
  build: string[]
}

export interface ParseOptions {
  lenient?: boolean
}

export class SemVerError extends Error {
  constructor(message: string, public readonly input: string) {
    super(message)
    this.name = 'SemVerError'
  }
}

export type ParseResult = { ok: true; value: SemVer } | { ok: false; error: SemVerError }

const NUMERIC_IDENTIFIER = /^\d+$/
const ALPHANUMERIC_IDENTIFIER = /^[0-9A-Za-z-]+$/

export function parse(input: string, options: ParseOptions = {}): SemVer {
  const lenient = options.lenient ?? false

  let source = input
  if (lenient) {
    source = source.trim()
    if (source.length > 0 && (source[0] === 'v' || source[0] === 'V')) {
      source = source.slice(1)
    }
  }

  if (source.length === 0) {
    throw new SemVerError('version string is empty', input)
  }

  const [withoutBuild, buildRaw] = splitOnce(source, '+')
  const [core, prereleaseRaw] = splitOnce(withoutBuild, '-')

  const coreParts = core.split('.')
  if (lenient) {
    if (coreParts.length < 1 || coreParts.length > 3) {
      throw new SemVerError(
        `expected 1 to 3 dot-separated core components, found ${coreParts.length}`,
        input,
      )
    }
  } else if (coreParts.length !== 3) {
    throw new SemVerError(
      `expected exactly 3 dot-separated core components (major.minor.patch), found ${coreParts.length}`,
      input,
    )
  }

  const major = parseCoreComponent(coreParts[0] ?? '', 'major', lenient, input)
  const minor = coreParts.length > 1 ? parseCoreComponent(coreParts[1] ?? '', 'minor', lenient, input) : 0
  const patch = coreParts.length > 2 ? parseCoreComponent(coreParts[2] ?? '', 'patch', lenient, input) : 0

  return {
    major,
    minor,
    patch,
    prerelease: parsePrerelease(prereleaseRaw, lenient, input),
    build: parseBuild(buildRaw, input),
  }
}

export function safeParse(input: string, options: ParseOptions = {}): ParseResult {
  try {
    return { ok: true, value: parse(input, options) }
  } catch (error) {
    if (error instanceof SemVerError) {
      return { ok: false, error }
    }
    throw error
  }
}

export function format(version: SemVer): string {
  let out = `${version.major}.${version.minor}.${version.patch}`
  if (version.prerelease.length > 0) {
    out += '-' + version.prerelease.join('.')
  }
  if (version.build.length > 0) {
    out += '+' + version.build.join('.')
  }
  return out
}

// Precedence per spec section 11: major.minor.patch compared numerically,
// then prerelease fields compared field-by-field (numeric fields compared
// numerically, alphanumeric fields compared as ASCII strings, a numeric
// field always has lower precedence than an alphanumeric one, and a
// shorter prerelease is lower unless one side has no prerelease at all,
// in which case the release version wins). Build metadata never affects
// precedence, so it isn't consulted here.
export function compare(a: SemVer, b: SemVer): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
  if (a.prerelease.length === 0) return 1
  if (b.prerelease.length === 0) return -1

  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let i = 0; i < length; i++) {
    if (i >= a.prerelease.length) return -1
    if (i >= b.prerelease.length) return 1
    const result = comparePrereleaseIdentifier(a.prerelease[i] as string | number, b.prerelease[i] as string | number)
    if (result !== 0) return result
  }
  return 0
}

function comparePrereleaseIdentifier(a: string | number, b: string | number): -1 | 0 | 1 {
  const aIsNumber = typeof a === 'number'
  const bIsNumber = typeof b === 'number'
  if (aIsNumber && bIsNumber) return a === b ? 0 : a < b ? -1 : 1
  if (aIsNumber) return -1
  if (bIsNumber) return 1
  return a === b ? 0 : a < b ? -1 : 1
}

export function eq(a: SemVer, b: SemVer): boolean {
  return compare(a, b) === 0
}

export function neq(a: SemVer, b: SemVer): boolean {
  return compare(a, b) !== 0
}

export function gt(a: SemVer, b: SemVer): boolean {
  return compare(a, b) === 1
}

export function gte(a: SemVer, b: SemVer): boolean {
  return compare(a, b) !== -1
}

export function lt(a: SemVer, b: SemVer): boolean {
  return compare(a, b) === -1
}

export function lte(a: SemVer, b: SemVer): boolean {
  return compare(a, b) !== 1
}

export function sort(versions: SemVer[]): SemVer[] {
  return [...versions].sort(compare)
}

export function rsort(versions: SemVer[]): SemVer[] {
  return [...versions].sort((a, b) => compare(b, a))
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator)
  if (index === -1) {
    return [value, undefined]
  }
  return [value.slice(0, index), value.slice(index + 1)]
}

function parseCoreComponent(raw: string, label: string, lenient: boolean, input: string): number {
  if (raw.length === 0) {
    throw new SemVerError(`${label} version is missing`, input)
  }
  if (!NUMERIC_IDENTIFIER.test(raw)) {
    throw new SemVerError(`${label} version "${raw}" is not numeric`, input)
  }
  if (!lenient && raw.length > 1 && raw[0] === '0') {
    throw new SemVerError(`${label} version "${raw}" has a leading zero`, input)
  }
  return Number(raw)
}

function parsePrerelease(raw: string | undefined, lenient: boolean, input: string): Array<string | number> {
  if (raw === undefined) {
    return []
  }
  if (raw.length === 0) {
    throw new SemVerError('prerelease section is empty', input)
  }
  return raw.split('.').map((identifier) => parsePrereleaseIdentifier(identifier, lenient, input))
}

function parsePrereleaseIdentifier(identifier: string, lenient: boolean, input: string): string | number {
  if (identifier.length === 0) {
    throw new SemVerError('prerelease identifiers cannot be empty', input)
  }
  if (NUMERIC_IDENTIFIER.test(identifier)) {
    if (!lenient && identifier.length > 1 && identifier[0] === '0') {
      throw new SemVerError(`prerelease identifier "${identifier}" has a leading zero`, input)
    }
    return Number(identifier)
  }
  if (!ALPHANUMERIC_IDENTIFIER.test(identifier)) {
    throw new SemVerError(
      `prerelease identifier "${identifier}" contains characters outside [0-9A-Za-z-]`,
      input,
    )
  }
  return identifier
}

function parseBuild(raw: string | undefined, input: string): string[] {
  if (raw === undefined) {
    return []
  }
  if (raw.length === 0) {
    throw new SemVerError('build metadata section is empty', input)
  }
  return raw.split('.').map((identifier) => {
    if (identifier.length === 0) {
      throw new SemVerError('build metadata identifiers cannot be empty', input)
    }
    if (!ALPHANUMERIC_IDENTIFIER.test(identifier)) {
      throw new SemVerError(
        `build metadata identifier "${identifier}" contains characters outside [0-9A-Za-z-]`,
        input,
      )
    }
    return identifier
  })
}
