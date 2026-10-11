/** `--name value` and `--flag` arguments, plus positionals. */
export function parseArgs(argv = process.argv.slice(2)) {
  const named: Record<string, string | true> = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) positional.push(a)
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) named[a.slice(2)] = argv[++i]
    else named[a.slice(2)] = true
  }
  return { named, positional }
}
