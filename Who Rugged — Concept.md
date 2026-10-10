# Who Rugged? — Concept

Oct 10, 2026 · @endrit

## The pitch

Who Rugged? is a group-chat detective game on Telegram: a fictional crypto project gets rugged, and a group of 3–6 friends has about 20 minutes to work out who did it, why, and where the money went.

- **Format:** a Telegram mini app on TON, played inside a group chat the friends already use.
- **The twist:** the clues are a fake on-chain world (wallets, transactions, leaked chats, deleted posts) that AI generates for every case.
- **Money:** Telegram Stars purchases, sponsored weekly Bounty Cases paid out in TON, and rewarded ads. No token at launch.
- **Why now:** tap-to-earn games burned players out, so a game that is fun without an airdrop stands out. Almost everyone on crypto Telegram has a rug story.

## Why this game

Players pay for games they enjoy, not for tokens: the crypto-gaming market punished token-first games and still rewards fun-first ones.

- **Token-first games failed.** About 93% of GameFi projects are effectively dead ([CoinDesk on Caladan, Apr 2026](https://www.coindesk.com/markets/2026/04/23/more-than-90-of-web3-games-failed-after-usd15-billion-boom-as-gamers-never-showed-up-caladan)). Hamster Kombat fell from 300M to 40.9M monthly players weeks after its airdrop ([ForkLog](https://forklog.com/en/hamster-kombat-loses-nearly-260-million-players-post-listing/)).
- **Paying players worked.** Catizen reached $31M from in-app purchases and 1.1M paying users by September 2024 ([ForkLog](https://forklog.com/en/catizen-clicker-game-revenue-reaches-31-million/)).
- **Telegram is the right home.** Games launch from a chat link with no install, Stars handle payments, and on-chain features must run on TON ([Decrypt](https://decrypt.co/302023/telegram-exclusive-ton-barring-other-networks)).

|  | Typical Telegram game | Who Rugged? |
| --- | --- | --- |
| Core loop | Tap, merge, wait | Investigate, argue, accuse |
| Social | Solo, plus referral bonuses | Needs a group to play |
| Content | Same loop forever | A new AI-generated case every time |
| Why people pay | Speed-ups, airdrop hopes | More cases, power-ups, bragging rights |
| Role of crypto | Token and airdrop | Theme, plus TON prize payouts |

## Core gameplay loop

A case takes 15–20 minutes, and each player holds different clues, so the group has to talk to solve it.

1. **Start.** One player opens the mini app from the group chat and picks a case. Friends join with one tap from the shared link.
2. **Briefing (about 2 min).** Everyone sees the same case file: the project, what happened, and the timeline of the crash.
3. **Private clues (about 10 min).** Each player gets a different clue set, and one or two suspects message them privately with their side of the story. No single player can solve it alone.
4. **Investigate together.** The group compares notes in the chat, digs through the shared wallet explorer, and can spend power-ups such as Subpoena or Trace.
5. **Accuse.** The group votes on three things: who did it, why, and where the money went.
6. **Reveal.** The AI narrates what really happened. The group scores on accuracy and speed and gets a verdict card to share.
7. **Come back.** One free case a day. More cases come from packs or the season pass.

**Scoring:** culprit 50 points, motive 25, money trail 25, plus a time bonus. A solo mode with AI teammates can come later, for players without a group.

## Suspects and clues

Every suspect, project and wallet is a fictional parody. No real people, projects or addresses ever appear.

| Suspect | Cover story | Classic tell |
| --- | --- | --- |
| Anon dev | "Just stepped away for a bit" | Wallets funded from the same exchange account |
| Influencer | "I was only paid in exposure" | Token transfers arrive the night before the shill post |
| Co-founder | "I sold a little to pay the team" | Small daily sells across many fresh wallets |
| Community mod | "Lucky trade on another coin" | Admin rights changed hours before the crash |
| Audit firm | "Our report was clean" | Report copied from another project |
| Whale | "I read the charts" | Sold minutes before the crash: real tip or coincidence? |

**Clue types**

- **Fake wallet explorer:** wallets, transactions and token flows players can click through. This is the signature feature.
- **Leaked chats:** screenshots from a fake team group chat.
- **Deleted posts:** archived social posts and edits.
- **Code changes:** commits that added a hidden owner function.
- **Shared-wallet votes:** who approved which payout from the team's multi-signature wallet.
- **Suspect messages:** private chats where suspects lie, deflect or slip up.

## First three cases

The launch set covers three classic crimes, each with one clear money trail and one tempting red herring.

| Case | Crime | Culprit | Key clue | Red herring |
| --- | --- | --- | --- | --- |
| The $MOONCAT Exit | Liquidity pulled overnight | Co-founder | Fresh wallets all funded from his exchange account | Whale who sold early after a public alert |
| The Audit That Wasn't | "Hack" drains the treasury | Anon dev | Hidden owner function added a week before | Audit firm with a copied report |
| Airdrop of Doom | Fake airdrop drains wallets | Community mod | Admin log shows the mod pinned the drainer link | Influencer who reposted it |

Later packs: insider trading before an exchange listing, NFT wash trading, a token you can buy but never sell, and an exchange that runs off with deposits.

## How cases are made

Each case is generated once from a structured template, checked for solvability, then reused by thousands of groups. Only the suspect chats run live.

1. **Template.** Crime type, culprit, motive, money trail (wallet hops), 2 red herrings, and the clue split across 3–6 players.
2. **Generate.** AI fills the template with names, chats, posts and explorer data, all consistent with the hidden truth.
3. **Check.** A separate AI "solver" plays the case blind. If it can't reach the answer from the clues, or reaches it from one player's clues alone, the case is rejected.
4. **Playtest.** Hand-check the first cases with real groups before they go live.
5. **Live play.** Suspect chats use a cheap, fast model that is given the hidden truth and each suspect's lies.

**Cost control:** pre-generated cases cost almost nothing per play. Live chat is capped per case, and extra interrogations are a paid power-up, so heavy use pays for itself. Planning figure: about $0.05 of AI cost per group session, to be confirmed in testing.

## Business model

Money comes from four streams. Stars purchases are the core, and sponsored Bounty Cases can pay before the audience is large.

**1. Stars purchases.** Stars retail at about $0.02 each (500 for $10), and you keep roughly 55% after the app-store cut and the exchange rate ([MEF](https://mobileecosystemforum.com/2026/02/24/telegrams-gaming-have-indie-games-found-a-new-love/)). Starting prices:

| Item | Price (Stars) | About (USD) |
| --- | --- | --- |
| Case pack, 5 cases | 250 | $5.00 |
| Season pass, 1 month: unlimited cases + 5 Subpoenas | 400 | $8.00 |
| Subpoena: one suspect must answer truthfully | 25 | $0.50 |
| Trace: reveals where a wallet's money came from | 15 | $0.30 |
| Hint | 10 | $0.20 |
| Detective badge (cosmetic) | 50–150 | $1–3 |

**2. Sponsored Bounty Cases.** One case a week that everyone plays at once, free to enter. A wallet, exchange or TON project pays a fee plus the TON prize pool, and the case carries their anti-scam message. The fastest correct groups split the pool. Planning range: $500–3,000 per case.

**3. Rewarded ads.** Players watch an ad for a free hint or an extra interrogation, through a network like AdsGram.

**4. Licensing (later).** Exchanges and wallets license custom "spot the scam" cases to train their users or staff.

**Rough monthly net, after AI costs**

| Monthly players | Net per month |
| --- | --- |
| 5,000 | \~$750 |
| 50,000 | \~$8,600 |
| 300,000 | \~$45,000 |

Assumptions: 3% of players pay $5–6 a month; 1–8 sponsored cases a month; small ad income; groups of 4 playing 4 cases a month at about $0.05 of AI cost per session. This is a planning sketch, not a forecast. The test in the last section confirms or kills the pay rate and sponsor price.

## Growth

The game spreads because it needs a group: every case played is an invitation.

- **Group invites:** a case needs 3–6 players, so the host recruits friends into it.
- **Verdict card:** "Our crew caught the rugger in 14 min" drops into chats and stories after every case.
- **Referral bonus:** a free case for both the inviter and the new player once the new player finishes a case.
- **Channel partners:** crypto Telegram channels earn a share of revenue from paying players they send, through Telegram's affiliate program.
- **Bounty Cases:** sponsors promote their own branded case to their own audience.
- **Telegram Ads:** Stars earned can buy ads, with Telegram adding a 30% bonus ([The Block](https://www.theblock.co/amp/post/303217/telegram-mini-app-developers-can-now-use-stars-to-get-ton-rewards-or-ad-discounts)).
- **Content:** short clips of the funniest suspect lies and the verdict reveals, for crypto Twitter and TikTok.

## Platform and tech

The game is a web app inside Telegram, so it can use the stack you already ship client work on.

| Layer | Choice |
| --- | --- |
| Front end | Next.js, TypeScript, React, Tailwind, as a Telegram mini app |
| Hosting | Vercel |
| Data and real-time lobby | Supabase (players, groups, cases, votes, live updates) |
| Bot | Telegram bot for links, notifications and Stars invoices |
| AI | One model to generate and check cases, a cheap fast model for live suspect chats |
| Payments | Telegram Stars for every digital item, which Telegram requires ([InviteMember](https://blog.invitemember.com/telegram-stars-vs-toncoin/)) |
| On-chain (v2) | TON Connect for winners' wallets. Bounty payouts start as plain transfers, and a payout contract in Tolk comes later |

Telegram rule to respect: any on-chain feature in the mini app must run on TON.

## Risks and guardrails

The biggest risk is boring or broken cases, not money: one case with a plot hole and the magic is gone.

| Risk | Guardrail |
| --- | --- |
| Cases with plot holes or too easy to crack | Structured templates, the blind solver check, real playtests before release |
| Defamation | Fictional parody suspects, projects and wallets only; filter out real names |
| Teaching people to scam | Cases show how rugs are detected, never step-by-step how to run one |
| Bounty Cases counted as gambling | Free entry, sponsor-funded prizes, skill-based scoring; legal check before real payouts |
| Telegram policy | Stars for every digital item, TON for anything on-chain |
| AI costs grow with players | Pre-generated cases, capped live chat, paid extra interrogations |
| Token temptation | No token at launch; only revisit if the community asks for one |
| Low retention | A fresh case daily, weekly Bounty events, clear go/no-go checks before scaling |

## First version and go/no-go

Two weeks of building gets one playable case into friends' hands; about six weeks in, four checks decide whether to scale.

&#91;embedded content: first version plan · 4 phases, 1 decision\]

The go/no-go checks only count real players, not the friend playtest.

**Out of scope for the first version:** Bounty Cases, TON payouts, ads, the season pass, solo mode and licensing. These come only after a "go".
