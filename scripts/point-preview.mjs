// Point the fixed preview address (PREVIEW_HOST) at a branch's newest ready Preview deploy,
// so t.me/WhoRuggedBot/preview opens that branch. Needs the Vercel CLI, logged in and linked.
// Usage: npm run preview:point -- phase1/04-dex-crew   (defaults to the current git branch)

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PREVIEW_HOST = 'who-rugged-preview.vercel.app'

// Windows runs `vercel` through cmd, which splits unquoted arguments at `&`.
const win = process.platform === 'win32'
const run = (cmd, args) =>
  execFileSync(cmd, win ? args.map((a) => `"${a}"`) : args, { encoding: 'utf8', shell: win, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MSYS_NO_PATHCONV: '1' } })

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
