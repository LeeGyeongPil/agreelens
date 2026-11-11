// Generates the two practice samples in src/samples/ (synthetic data, fixed seed -> reproducible).
//   node scripts/make-samples.mjs
// The samples are NOT real judge output. They are shaped to show two lessons:
//   binary-pass-fail.csv   : high agreement but low kappa (skewed labels), lenient judge, messy spellings, blanks
//   ordinal-3raters.jsonl  : judge is usually off by one point; 3 human raters give a baseline alpha
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function mulberry32(seed) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)

// ---------- binary ----------
const TOPICS = [
  ['What is the refund window?', 'Refunds are accepted within 30 days of purchase.', 'Refunds are accepted within 90 days, and shipping is always refunded too.'],
  ['Which plan includes SSO?', 'SSO is included in the Business plan.', 'SSO is included in every plan, including Free.'],
  ['How long are logs kept?', 'Logs are kept for 14 days.', 'Logs are kept forever by default.'],
  ['Can I change my username?', 'Yes, once every 30 days from the profile page.', 'No, usernames can never be changed.'],
  ['Where is data stored?', 'Data is stored in the region you choose at signup.', 'Data is always stored in a single US data center.'],
  ['What is the file size limit?', 'Uploads are limited to 25 MB per file.', 'Uploads are limited to 2 GB per file.'],
  ['Is there an API rate limit?', 'Yes, 60 requests per minute per key.', 'No, the API has no rate limit.'],
  ['How do I reset my password?', 'Use the "Forgot password" link on the sign-in page.', 'Contact the CEO by email to reset it.'],
  ['Do you support webhooks?', 'Yes, webhooks can be configured per project.', 'Webhooks were removed in 2019 and cannot be used.'],
  ['What payment methods work?', 'Credit cards and bank transfer for annual plans.', 'Only cryptocurrency is accepted.'],
  ['Can I export my data?', 'Yes, CSV and JSON exports are available in Settings.', 'Exports are available only through a paid consultant.'],
  ['How many seats on Team?', 'The Team plan includes 10 seats.', 'The Team plan includes unlimited seats for free.'],
]

function binary() {
  const rnd = mulberry32(20261111)
  // 197 comparable rows: 14 fail/fail, 12 fail->pass (lenient), 4 pass->fail (strict), 167 pass/pass; plus 3 blanks.
  const plan = []
  for (let i = 0; i < 14; i++) plan.push(['fail', 'fail'])
  for (let i = 0; i < 12; i++) plan.push(['fail', 'pass'])
  for (let i = 0; i < 4; i++) plan.push(['pass', 'fail'])
  for (let i = 0; i < 167; i++) plan.push(['pass', 'pass'])
  plan.push(['', 'pass'], ['N/A', 'pass'], ['pass', ''])
  shuffle(plan, rnd)
  const spell = (v) => {
    if (v === '' || v === 'N/A') return v
    const r = rnd()
    if (r < 0.08) return v[0].toUpperCase() + v.slice(1) // Pass
    if (r < 0.12) return ` ${v}` // " pass"
    if (r < 0.14) return v.toUpperCase() // PASS
    return v
  }
  const lines = ['id,question,answer,human,judge,judge_reason']
  plan.forEach(([human, judge], i) => {
    const [q, good, bad] = TOPICS[i % TOPICS.length]
    const answer = human === 'fail' ? bad : good
    const reason =
      judge === 'pass'
        ? 'The answer is consistent with the support article.'
        : judge === 'fail'
          ? 'The answer contains a claim that the support article does not make.'
          : ''
    const id = `q-${String(i + 1).padStart(3, '0')}`
    lines.push([id, q, answer, spell(human), spell(judge), reason].map(csvCell).join(','))
  })
  return lines.join('\n') + '\n'
}

// ---------- ordinal ----------
const ITEMS = [
  ['Summarize the meeting notes in two sentences.', 'The team agreed to ship on Friday and to postpone the redesign.'],
  ['회의록을 두 문장으로 요약하세요.', '팀은 금요일에 배포하고 개편은 다음 분기로 미루기로 했습니다.'],
  ['Explain what a hash map is to a beginner.', 'A hash map stores values under keys and finds them quickly.'],
  ['해시 맵이 무엇인지 초보자에게 설명하세요.', '해시 맵은 키로 값을 저장하고 빠르게 찾는 자료구조입니다.'],
  ['Write a polite reply declining the invitation.', 'Thank you for the invitation. Unfortunately I cannot attend.'],
  ['초대를 정중하게 거절하는 답장을 쓰세요.', '초대해 주셔서 감사합니다. 아쉽게도 참석하기 어렵습니다.'],
  ['Describe the water cycle.', 'Water evaporates, condenses into clouds, and falls as rain.'],
  ['물의 순환을 설명하세요.', '물은 증발해 구름이 되고 비로 내려 다시 흐릅니다.'],
  ['Translate "good morning" into French.', 'Bonjour.'],
  ['"좋은 아침"을 영어로 번역하세요.', 'Good morning.'],
]

function ordinal() {
  const rnd = mulberry32(7771)
  const pick = (table) => {
    let r = rnd()
    for (const [v, p] of table) {
      if (r < p) return v
      r -= p
    }
    return table[table.length - 1][0]
  }
  const clamp = (v) => Math.max(1, Math.min(5, v))
  const quality = [[1, 0.1], [2, 0.2], [3, 0.3], [4, 0.25], [5, 0.15]]
  const humanNoise = [[0, 0.8], [1, 0.1], [-1, 0.1]]
  const judgeNoise = [[0, 0.3], [1, 0.4], [-1, 0.25], [2, 0.05]]
  const reasons = {
    1: 'Does not answer the request.',
    2: 'Mostly off target, a few correct points.',
    3: 'Partly correct but incomplete.',
    4: 'Correct and clear, minor omissions.',
    5: 'Complete, correct and well written.',
  }
  const lines = []
  for (let i = 0; i < 150; i++) {
    const q = pick(quality)
    let h = [0, 1, 2].map(() => clamp(q + pick(humanNoise)))
    if (new Set(h).size === 3) h[2] = h[1] // avoid three-way ties so the human majority is always defined
    const j = clamp(q + pick(judgeNoise))
    const [prompt, response] = ITEMS[i % ITEMS.length]
    lines.push(
      JSON.stringify({
        id: `o-${String(i + 1).padStart(3, '0')}`,
        input: { prompt, response },
        scores: { human_a: h[0], human_b: h[1], human_c: h[2], judge: j },
        judge_reason: reasons[j],
      }),
    )
  }
  return lines.join('\n') + '\n'
}

const dir = new URL('../src/samples/', import.meta.url)
writeFileSync(fileURLToPath(new URL('binary-pass-fail.csv', dir)), binary())
writeFileSync(fileURLToPath(new URL('ordinal-3raters.jsonl', dir)), ordinal())
console.log('wrote src/samples/binary-pass-fail.csv and src/samples/ordinal-3raters.jsonl')
