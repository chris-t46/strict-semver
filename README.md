# strict-semver

A validating parser and pretty printer for semantic version strings
(https://semver.org/spec/v2.0.0.html), written in TypeScript with no
runtime dependencies.

## The problem

Most "semver parsers" you find are either too strict or too loose. Too
strict, and a version tag pulled straight from `git tag` like `v1.4.0`
gets rejected because of the `v`. Too loose, and `1.02.3` or `1.2.3-`
gets silently accepted and you find out later that some downstream
tool sorted your releases wrong because it disagreed with you about
what `1.02.3` even means.

This library picks a side: `parse()` is strict by default, rejecting
anything that isn't exactly what the spec describes. If you need to
accept the sloppier versions that show up in the wild (git tags with a
`v` prefix, leading zeros, a bare `1.4` meaning `1.4.0`), you ask for
it explicitly with `{ lenient: true }`. Nothing is relaxed silently.

## Usage

```ts
import { parse, format, safeParse } from './src/semver'

parse('1.4.0-beta.2+exp.sha.5114f85')
// => {
//   major: 1, minor: 4, patch: 0,
//   prerelease: ['beta', 2],
//   build: ['exp', 'sha', '5114f85'],
// }

parse('1.04.0')
// throws SemVerError: minor version "04" has a leading zero

parse('v1.4', { lenient: true })
// => { major: 1, minor: 4, patch: 0, prerelease: [], build: [] }

format(parse('1.4.0-beta.2'))
// => '1.4.0-beta.2'

const result = safeParse('not-a-version')
if (!result.ok) {
  console.error(result.error.message)
}
```

`format()` always emits the canonical form, so `parse` followed by
`format` is a good way to normalize a version string once you've
decided it's valid.

## CLI

```
npm run build
node dist/cli.js 1.4.0-beta.2
# 1.4.0-beta.2

node dist/cli.js v1.4 --lenient
# 1.4.0

node dist/cli.js 1.04.0
# invalid version "1.04.0": minor version "04" has a leading zero
```

Pass `--json` to get the parsed components instead of the
re-serialized string.

## Building

There are no runtime dependencies and nothing to install. Compile with
any TypeScript compiler you have available:

```
npx tsc -p .
```

Output goes to `dist/`.

## Status

Early. Parsing and formatting a single version string works. Range
parsing (`^1.2.3`, `~1.2.3`, `>=1.0.0 <2.0.0`) and comparison are not
implemented yet — see the roadmap in the issue tracker.
