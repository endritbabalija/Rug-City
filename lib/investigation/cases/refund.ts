import 'server-only'
import type { CaseDefinition } from '../types'

// Chapter 1, The Refund. Authored content from `Rug City — The Refund Brief.md` §3–8:
// keep identifiers, times, amounts and causal relations exactly as written there.
// Changing what a run can see or prove means a new version, not an edit of this one.

const GENERIC = 'These records do not establish that claim yet.'

export const THE_REFUND_V1: CaseDefinition = {
  id: 'the-refund',
  version: 1,
  title: 'The Refund',
  intro: {
    from: 'lena',
    message: 'Our refund money never reached the community. Owen handled the transfer. Find out what happened.',
    headline: '12,000 LUM sent. No refunds received.',
  },

  evidence: [
    {
      id: 'E01',
      title: 'Refund announcement',
      source: "Mika's public archive",
      kind: 'public',
      time: '09:00',
      minute: 540,
      sections: [{ lines: ['“The remaining 12,000 LUM will go to COMMUNITY-04 for community refunds. Founder sign-off: Lena.”'] }],
      explainer: 'LUM is the club’s own unit. 12,000 LUM is the whole remaining refund fund.',
    },
    {
      id: 'E02',
      title: 'Transfer receipt',
      source: 'Public transaction',
      kind: 'public',
      time: '10:00',
      minute: 600,
      sections: [
        {
          lines: [
            'TX-101',
            '12,000 LUM from Lantern Club treasury to RELAY-72.',
            'Submitted by: Owen',
            'The operator submits a payment; this record does not identify the destination owner.',
          ],
        },
      ],
      explainer: 'A destination is the account label a payment is sent to. Public records show labels, not the people behind them.',
    },
    {
      id: 'E03',
      title: 'Warning conversation',
      source: 'Supplied by Mika',
      kind: 'supplied',
      time: '10:08',
      minute: 608,
      sections: [
        {
          lines: [
            '10:08 Mika: “The refund post says COMMUNITY-04. You sent to RELAY-72.”',
            '10:09 Owen: “I see it. I’m contacting support. Please give me a minute.”',
          ],
        },
      ],
    },
    {
      id: 'E04',
      title: 'Reversal request',
      source: 'Supplied by Owen',
      kind: 'supplied',
      time: '10:12',
      minute: 612,
      sections: [
        {
          heading: 'Support ticket · re: TX-101',
          lines: ['“I used approved instruction PAY-17. The public address differs. Can you reverse this? Approval receipt attached.”'],
        },
        { heading: 'Attached', lines: ['Approval receipt (PAY-17)', 'Support response (10:28)'] },
      ],
    },
    {
      id: 'E05',
      title: 'Approval receipt',
      source: 'Immutable Relay Desk record · attached to the reversal request',
      kind: 'service',
      time: '09:42',
      minute: 582,
      sections: [
        {
          lines: [
            'PAY-17',
            'Approver: Lena, verified founder account',
            'Destination changed: COMMUNITY-04 → RELAY-72',
            'Amount: 12,000 LUM',
            'Approval note: “Use the replacement destination.”',
            'This receipt preserves the exact destination approved at this time; later document edits cannot change it.',
          ],
        },
      ],
      explainer: 'The payment service keeps a receipt whenever someone signs off an instruction. Nobody can edit it afterwards.',
    },
    {
      id: 'E06',
      title: 'Support response',
      source: 'Relay Desk · attached to the reversal request',
      kind: 'service',
      time: '10:28',
      minute: 628,
      sections: [
        {
          heading: 'Re: TX-101',
          lines: [
            '“Completed transfers cannot be recalled.”',
            'Receiving destination RELAY-72 belongs to account RD-204.',
            'Public onward transfer: TX-102.',
          ],
        },
      ],
      explainer: 'Recalled means pulled back by the sender. Once a transfer has completed, it can’t be.',
    },
    {
      id: 'E07',
      title: 'Older account authorisation',
      source: "Mika's expense archive · retained service authorisation attached to an expense claim",
      kind: 'supplied',
      time: 'Day −30',
      minute: -43200,
      sections: [
        {
          lines: [
            'Account: RD-204',
            'Destination: RELAY-72',
            'Account holder: Lena',
            'Personal account; sole authorised controller: Lena',
          ],
        },
        { heading: 'Project expense claim submitted by Lena', lines: ['“This is my personal Relay Desk account.”'] },
      ],
      explainer: 'Mika kept this because it came with an expense claim she processed. It names the account holder, which the public ledger never does.',
    },
    {
      id: 'E08',
      title: 'Onward transfer',
      source: 'Public ledger',
      kind: 'public',
      time: '10:20',
      minute: 620,
      sections: [
        {
          lines: ['TX-102', '12,000 LUM from RELAY-72 to CEDAR-11', 'Reference: CS-88'],
        },
        { heading: 'CEDAR-11', lines: ['Verified public business listing: Cedar Studio, settlement enquiries.'] },
      ],
      explainer: 'The ledger is the public list of transfers. A reference is a note the sender attaches, like an invoice number.',
    },
    {
      id: 'E09',
      title: 'Creditor records',
      source: 'Voluntarily supplied by Cedar Studio',
      kind: 'voluntary',
      time: 'Day −1, 16:00 · 10:20',
      minute: -480,
      sections: [
        {
          heading: 'Demand · Day −1, 16:00',
          lines: ['Lena: personal settlement CS-88, 12,000 LUM due tomorrow 18:00, unrelated to Lantern Club.'],
        },
        { heading: 'Receipt · Case Day, 10:20', lines: ['CS-88 settled by TX-102, 12,000 LUM.'] },
      ],
    },
  ],
  initialEvidence: ['E01', 'E02'],

  leads: [{ id: 'lead-tx102', evidence: 'E06', label: 'Open TX-102 on the public ledger', unlocks: ['E08'] }],

  people: [
    { id: 'lena', name: 'Lena', role: 'Client · founder', kind: 'suspect', initials: 'L', available: {}, opening: ['lena-opening'] },
    { id: 'owen', name: 'Owen', role: 'Treasury operator', kind: 'suspect', initials: 'O', available: {}, opening: [] },
    { id: 'mika', name: 'Mika', role: 'Moderator', kind: 'suspect', initials: 'M', available: {}, opening: ['mika-opening'] },
    { id: 'cedar', name: 'Cedar Studio', role: 'Business contact', kind: 'contact', initials: 'CS', available: { evidence: ['E08'] }, opening: ['cedar-opening'] },
  ],

  lines: {
    'lena-opening': { speaker: 'lena', text: 'Our refund money never reached the community. Owen handled the transfer. Find out what happened.' },
    'lena-approval': { speaker: 'lena', text: 'I approved COMMUNITY-04. Owen must have changed the destination afterwards.' },
    'lena-pressure': { speaker: 'lena', text: 'Surely you have enough for a report on Owen? I can pay extra if you finish today.' },
    'lena-c02': { speaker: 'lena', text: 'Fine. I approved RELAY-72. It was a temporary holding account. The community was still going to be paid.' },
    'lena-c03': { speaker: 'lena', text: 'Cedar wouldn’t wait. I thought I could replace the money before anyone noticed.' },
    'owen-what': { speaker: 'owen', text: 'I sent what the approved instructions said, then went offline straight afterwards.' },
    'owen-instructions': { speaker: 'owen', text: 'PAY-17 was signed off. I didn’t choose the destination.' },
    'owen-c01': {
      speaker: 'owen',
      text: 'I stayed online. Mika warned me and I panicked. I tried to reverse it. Here’s the ticket, with the approval I followed.',
    },
    'mika-opening': { speaker: 'mika', text: 'The community announcement has the correct address. I kept a copy.' },
    'mika-announcement': { speaker: 'mika', text: 'It went out at nine, with Lena’s sign-off on the plan. COMMUNITY-04 was the address we all agreed.' },
    'mika-mismatch': { speaker: 'mika', text: 'I warned Owen as soon as I saw it. He answered.' },
    'mika-rd204': {
      speaker: 'mika',
      text: 'I recognise that account. Lena used it on an old expense claim. I still have the account authorisation she attached.',
    },
    'cedar-opening': { speaker: 'cedar', text: 'Cedar Studio, settlement enquiries. How can we help?' },
    'cedar-cs88': {
      speaker: 'cedar',
      text: 'That was Lena’s personal settlement with us. It was paid this morning. We can share our demand and receipt.',
    },
  },

  statements: [
    { id: 'S-L1', person: 'lena', text: 'I approved COMMUNITY-04. Owen must have changed the destination afterwards.', visible: {}, changedBy: 'C02' },
    {
      id: 'S-L2',
      person: 'lena',
      text: 'Fine. I approved RELAY-72. It was a temporary holding account. The community was still going to be paid.',
      visible: { confrontations: ['C02'] },
      changedBy: 'C03',
    },
    { id: 'S-O1', person: 'owen', text: 'I sent what the approved instructions said, then went offline straight afterwards.', visible: {}, changedBy: 'C01' },
  ],

  topics: [
    { id: 't-lena-approval', person: 'lena', label: 'Ask about the approval', requires: {}, lines: ['lena-approval'] },
    { id: 't-lena-report', person: 'lena', label: 'Ask what she expects from the report', requires: { findings: ['F01'] }, lines: ['lena-pressure'] },
    { id: 't-owen-what', person: 'owen', label: 'Ask what happened after the transfer', requires: {}, lines: ['owen-what'] },
    { id: 't-owen-instructions', person: 'owen', label: 'Ask about the instructions', requires: { findings: ['F01'] }, lines: ['owen-instructions'] },
    { id: 't-mika-announcement', person: 'mika', label: 'Ask about the announcement', requires: {}, lines: ['mika-announcement'] },
    { id: 't-mika-mismatch', person: 'mika', label: 'Ask about the mismatch', requires: { findings: ['F01'] }, lines: ['mika-mismatch'], unlocks: ['E03'] },
    { id: 't-mika-rd204', person: 'mika', label: 'Show her account RD-204', requires: { evidence: ['E06'] }, lines: ['mika-rd204'], unlocks: ['E07'] },
    { id: 't-cedar-cs88', person: 'cedar', label: 'Ask about reference CS-88', requires: { evidence: ['E08'] }, lines: ['cedar-cs88'], unlocks: ['E09'] },
  ],

  claims: [
    {
      id: 'F01',
      text: 'The transfer used a different destination from the announced refund plan.',
      visible: {},
      support: [['E01', 'E02']],
      feedback: [
        { when: ['E01'], text: 'That’s what was promised. Compare it with what was actually sent.' },
        { when: ['E02'], text: 'That’s what was sent. Compare it with what was promised.' },
      ],
      fallback: GENERIC,
    },
    {
      id: 'F02',
      text: 'Lena approved the disputed destination before Owen sent the payment.',
      visible: { evidence: ['E05'] },
      support: [['E05', 'E02']],
      feedback: [
        { when: ['E05'], text: 'That shows what Lena approved and when. Set it against when the payment went out.' },
        { when: ['E02'], text: 'That shows when the payment went out. What had been approved before it?' },
      ],
      fallback: GENERIC,
    },
    {
      id: 'F03',
      text: 'Lena personally controlled the receiving account.',
      visible: { evidence: ['E06'] },
      // E02 + E07 is not in the brief's table: it is the same direct destination match as E08 + E07
      // (both show RELAY-72 receiving or sending the money). Flagged for Endrit in docs/architecture.md.
      support: [
        ['E06', 'E07'],
        ['E08', 'E07'],
        ['E02', 'E07'],
      ],
      feedback: [
        { when: ['E07'], text: 'That names who holds RD-204 and RELAY-72. Connect it to the account that handled the refund.' },
        { when: ['E06'], text: 'That ties RELAY-72 to account RD-204. It doesn’t say who holds RD-204.' },
        { when: ['E05'], text: 'Approving a destination isn’t the same as controlling it.' },
      ],
      fallback: GENERIC,
    },
    {
      id: 'F04',
      text: 'The diverted 12,000 LUM paid Lena’s pre-existing personal obligation.',
      visible: { evidence: ['E09'] },
      support: [['E02', 'E08', 'E09']],
      feedback: [
        { when: ['E08', 'E09'], text: 'That shows RELAY-72 settling Lena’s debt. Show that the money it sent came from the refund.' },
        { when: ['E02', 'E09'], text: 'That’s the refund leaving and Lena’s settlement being paid. Show the transfer that connects them.' },
        { when: ['E02', 'E08'], text: 'That follows the refund to Cedar Studio. What was that payment for?' },
        { when: ['E05'], text: 'This records her approval, not what the receiving account did next.' },
        { when: ['E09'], text: 'That’s Cedar’s side. Trace the money that reached them.' },
      ],
      fallback: GENERIC,
    },
    {
      id: 'X-owen-owns',
      text: 'Owen owns RELAY-72.',
      visible: {},
      feedback: [{ when: ['E02'], text: 'This shows who submitted the payment, not who owns its destination.' }],
      fallback: GENERIC,
    },
    {
      id: 'X-owen-typo',
      text: 'Owen typed the wrong destination by mistake.',
      visible: { findings: ['F01'] },
      feedback: [
        { when: ['E05'], text: 'The approval receipt shows RELAY-72 was approved at 09:42. Owen’s transfer matched the approved instruction.' },
        { when: ['E02'], text: 'This shows what Owen sent, not how RELAY-72 got into the instruction.' },
      ],
      fallback: GENERIC,
    },
    {
      id: 'X-owen-stole',
      text: 'Owen stole the money.',
      visible: { evidence: ['E03'] },
      feedback: [
        { when: ['E03'], text: 'This contradicts his claim about going offline. It does not establish who chose or owns the destination.' },
        { when: ['E02'], text: 'This shows who submitted the payment, not who owns its destination.' },
      ],
      fallback: GENERIC,
    },
    {
      id: 'X-cedar',
      text: 'Cedar Studio redirected the refund.',
      visible: { evidence: ['E08'] },
      feedback: [{ when: ['E08'], text: 'This shows Cedar Studio received money from RELAY-72, not that it chose where the refund went.' }],
      fallback: GENERIC,
    },
  ],

  challenges: [
    {
      id: 'C01',
      statement: 'S-O1',
      text: 'You were online and knew about the mismatch after the transfer.',
      visible: { findings: ['F01'] },
      confrontation: {
        evidence: ['E03'],
        lines: ['owen-c01'],
        unlocks: ['E04', 'E05', 'E06'],
        insufficient: 'Owen doesn’t budge. Show him something that puts him online after the transfer.',
      },
    },
    {
      id: 'X-O1-chose',
      statement: 'S-O1',
      text: 'You chose RELAY-72 yourself.',
      visible: { findings: ['F01'] },
      feedback: 'Nothing you have shows Owen chose the destination. Challenge what he actually claimed.',
    },
    {
      id: 'C02',
      statement: 'S-L1',
      text: 'This destination was already present in your approval.',
      visible: { evidence: ['E05'] },
      confrontation: {
        findings: ['F02'],
        lines: ['lena-c02'],
        insufficient: 'Lena waves it away. Establish what she approved, and when, first.',
      },
    },
    {
      id: 'C03',
      statement: 'S-L2',
      text: 'The funds paid your own prior obligation.',
      visible: { findings: ['F04'] },
      confrontation: {
        findings: ['F03', 'F04'],
        lines: ['lena-c03'],
        insufficient: 'Lena holds her line. Show whose account it was and what the money paid.',
      },
    },
    {
      id: 'X-L2-never',
      statement: 'S-L2',
      text: 'The community was never going to be paid.',
      visible: { confrontations: ['C02'] },
      feedback: 'You can’t prove what she meant to do later. Stick to what the money actually did.',
    },
  ],

  hints: [
    {
      id: 'h-F01',
      title: 'The transfer',
      available: {},
      done: { findings: ['F01'] },
      levels: [
        'Did the payment follow the announcement?',
        'Compare the two destination labels.',
        'COMMUNITY-04 and RELAY-72 differ. That establishes a changed destination, not ownership.',
      ],
    },
    {
      id: 'h-C01',
      title: 'Owen’s account',
      available: { findings: ['F01'] },
      done: { confrontations: ['C01'] },
      levels: [
        'Does Owen’s account fit what Mika remembers?',
        'Ask Mika about her warning, then compare Owen’s reply with his offline claim.',
        'Use the warning conversation to challenge his claim that he went offline immediately.',
      ],
    },
    {
      id: 'h-F02',
      title: 'The approval',
      available: { confrontations: ['C01'] },
      done: { findings: ['F02'] },
      levels: [
        'What had been approved before the transfer?',
        'The approval receipt preserves a destination and a time.',
        'Compare the approval receipt’s 09:42 approval with the transfer receipt’s 10:00 payment.',
      ],
    },
    {
      id: 'h-F03',
      title: 'The receiving account',
      available: { evidence: ['E06'] },
      done: { findings: ['F03'] },
      levels: [
        'Do we have anything identifying that account?',
        'Show the support response’s account ID to Mika.',
        'Connect the support response’s account record with Mika’s old account authorisation.',
      ],
    },
    {
      id: 'h-F04',
      title: 'Where the money went',
      available: { evidence: ['E06'] },
      done: { findings: ['F04'] },
      levels: [
        'Where did the receiving account send the money?',
        'Follow the onward transfer in the support response and ask the listed business about its reference.',
        'Connect the incoming transfer, the onward transfer and the creditor’s demand and receipt.',
      ],
    },
  ],

  timeline: {
    requires: { evidence: ['E05', 'E02', 'E03'] },
    items: [
      { evidence: 'E05', label: 'Lena approves PAY-17' },
      { evidence: 'E02', label: 'Owen sends TX-101' },
      { evidence: 'E03', label: 'Mika warns Owen' },
    ],
    claim: 'F02',
    submit: ['E05', 'E02'],
  },

  questions: [
    { requires: {}, text: 'Did the transfer match the announced refund plan?' },
    { requires: { findings: ['F01'] }, text: 'Who authorised the changed destination?' },
    { requires: { findings: ['F01', 'F02'] }, text: 'Who controlled the receiving account, and where did the money go?' },
    { requires: { findings: ['F01', 'F02', 'F03', 'F04'] }, text: 'Who is responsible, and can you prove it?' },
  ],

  dex: [
    { requires: {}, text: 'Client says the operator did it. Clients say lots of things. Start with the paper.' },
    { requires: { findings: ['F01'] }, text: 'The money went somewhere the plan didn’t say. Now: who knew what, and when?' },
    { requires: { confrontations: ['C01'] }, text: 'Owen lied about going offline. Lying about that isn’t the same as taking the money. Read what he was hiding.' },
    { requires: { findings: ['F02'] }, text: 'She signed off RELAY-72 herself. Signing isn’t spending, though. Follow the account.' },
    { requires: { findings: ['F03'] }, text: 'Her own account. Holding money isn’t using it. What did it pay for?' },
    { requires: { findings: ['F04'] }, text: 'The money settled a debt of hers. Whose account did it pass through?' },
    { requires: { findings: ['F03', 'F04'] }, text: 'Her account, her debt. Make sure you can show who approved the destination, too.' },
    { requires: { findings: ['F01', 'F02', 'F03', 'F04'] }, text: 'That’s the shape of it. When you’re ready, put it on the desk.' },
  ],

  accusation: {
    suspects: ['lena', 'owen', 'mika'],
    culprit: 'lena',
    available: { findings: ['F01'] },
    insufficient: 'Your theory needs more support.',
    slots: [
      {
        id: 'diverted',
        label: 'The refund payment was diverted',
        findings: ['F01'],
        missing: 'You haven’t shown that the payment left the refund plan.',
        attach: 'Attach the finding that shows the payment left the refund plan.',
      },
      {
        id: 'approved',
        label: 'They approved the changed destination',
        findings: ['F02'],
        missing: 'You haven’t established who approved the changed destination.',
        attach: 'Attach your finding about who approved the destination.',
      },
      {
        id: 'used',
        label: 'They controlled and used the receiving funds',
        findings: ['F03', 'F04'],
        missing: 'You haven’t established both who controlled the receiving account and what the money paid for.',
        attach: 'Attach your findings about who controlled the receiving account and what the money paid for.',
      },
    ],
    objections: {
      owen: [
        { requires: {}, text: 'TX-101 shows Owen submitted the payment. It doesn’t show who chose or owns RELAY-72.' },
        {
          requires: { confrontations: ['C01'] },
          text: 'Owen hid his reversal attempt. Hiding a mistake isn’t taking the money, and nothing you’ve established shows he chose or owns RELAY-72.',
        },
        { requires: { findings: ['F02'] }, text: 'Your own finding says Lena approved RELAY-72 at 09:42, before Owen sent TX-101. He followed that instruction.' },
      ],
      mika: [
        { requires: {}, text: 'Mika published COMMUNITY-04. Nothing you’ve established connects her to RELAY-72.' },
        { requires: { evidence: ['E03'] }, text: 'Mika flagged the mismatch to Owen within minutes. Nothing you’ve established connects her to RELAY-72.' },
      ],
    },
  },

  ending: {
    title: 'Case closed',
    reconstruction: [
      { requires: {}, text: 'Lena owed Cedar Studio 12,000 LUM personally, due at 18:00 on the day of the refund. The debt had nothing to do with Lantern Club.' },
      { requires: {}, text: 'At 09:42 she approved PAY-17, replacing the community’s COMMUNITY-04 with RELAY-72: the destination of her own Relay Desk account, RD-204.' },
      {
        requires: {},
        text: 'At 10:00 Owen sent the 12,000 LUM exactly as approved. Mika flagged the mismatch at 10:08. Owen tried to reverse the payment, then hid that he had, afraid of being blamed. Careless, and untruthful about it. Not the thief.',
      },
      { requires: {}, text: 'At 10:20 the money left RELAY-72 for Cedar Studio, settling Lena’s personal reference CS-88. At 11:00 she hired your agency to blame Owen.' },
      { requires: { confrontations: ['C02'] }, text: 'Shown her own approval, Lena claimed RELAY-72 was a temporary holding account.' },
      { requires: { confrontations: ['C03'] }, text: 'Then she admitted it: Cedar wouldn’t wait, and she had hoped to replace the money before anyone noticed.' },
      { requires: {}, unless: { confrontations: ['C03'] }, text: 'Lena never admitted taking the money. The records didn’t need her to.' },
      { requires: {}, text: 'The refund money was not recovered. Your report shows where it went and who sent it there.' },
    ],
    closing: [
      { speaker: 'narrator', text: 'Lena refuses to pay your invoice.' },
      { speaker: 'dex', text: 'First client. First invoice dispute. Strong start.' },
      { speaker: 'mika', text: 'You investigated the person paying you. I know someone who needs that.' },
    ],
    teaser: 'Next case · preview only. Not available yet.',
  },
}
