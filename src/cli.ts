#!/usr/bin/env node
import { format, parse, SemVerError } from './semver'

function main(argv: string[]): number {
  const args = argv.slice(2)
  let lenient = false
  let json = false
  const positional: string[] = []

  for (const arg of args) {
    if (arg === '--lenient') {
      lenient = true
    } else if (arg === '--json') {
      json = true
    } else if (arg === '--help' || arg === '-h') {
      printUsage()
      return 0
    } else if (arg.startsWith('-')) {
      process.stderr.write(`unknown flag: ${arg}\n`)
      return 1
    } else {
      positional.push(arg)
    }
  }

  if (positional.length !== 1) {
    printUsage()
    return 1
  }

  const rawVersion = positional[0] as string

  try {
    const version = parse(rawVersion, { lenient })
    process.stdout.write((json ? JSON.stringify(version) : format(version)) + '\n')
    return 0
  } catch (error) {
    if (error instanceof SemVerError) {
      process.stderr.write(`invalid version "${error.input}": ${error.message}\n`)
      return 1
    }
    throw error
  }
}

function printUsage(): void {
  process.stderr.write(
    'usage: strict-semver <version> [--lenient] [--json]\n' +
      '\n' +
      'Parses <version> as a semantic version and prints its canonical form.\n' +
      'Exits non-zero and prints an error to stderr if it does not validate.\n' +
      '\n' +
      '  --lenient  accept common deviations: "v" prefix, leading zeros,\n' +
      '             missing minor/patch components\n' +
      '  --json     print the parsed components instead of the canonical string\n',
  )
}

process.exitCode = main(process.argv)
