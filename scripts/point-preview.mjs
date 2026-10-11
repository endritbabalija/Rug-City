// Point the fixed preview address (PREVIEW_HOST) at a branch's newest ready Preview deploy,
// so t.me/WhoRuggedBot/preview opens that branch. Needs the Vercel CLI, logged in and linked.
// Usage: npm run preview:point -- phase1/04-dex-crew   (defaults to the current git branch)

import { execFileSync, execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PREVIEW_HOST = 'who-rugged-preview.vercel.app'

// Windows runs `vercel` (a .cmd shim) through cmd, which splits unquoted arguments at `&`,
// so there we build one quoted command line ourselves instead of passing args with `shell`.
const win = process.platform === 'win32'
const opts = { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MSYS_NO_PATHCONV: '1' } }
const run = (cmd, args) => (win ? execSync([cmd, ...args.map((a) => `"${a}"`)].join(' '), opts) : execFileSync(cmd, args, opts))

const branch = process.argv[2] || run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
const { projectId, orgId } = JSON.parse(readFileSync('.vercel/project.json', 'utf8'))

const { deployments } = JSON.parse(
  run('vercel', ['api', `/v6/deployments?projectId=${projectId}&state=READY&limit=50`, '--scope', orgId]),
)
const deploy = deployments.find((d) => d.target !== 'production' && d.meta?.githubCommitRef === branch)
if (!deploy) {
  console.error(`No ready Preview deploy for ${branch}. Push the branch and wait for Vercel to finish.`)
  process.exit(1)
}

run('vercel', ['alias', 'set', deploy.url, PREVIEW_HOST, '--scope', orgId])
console.log(`✓ https://${PREVIEW_HOST} → ${deploy.url} (${branch} @ ${deploy.meta.githubCommitSha?.slice(0, 7)})`)
console.log('Open t.me/WhoRuggedBot/preview in Telegram.')
