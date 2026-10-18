/**
 * 星系改造的 i18n 工具
 *
 *   node scripts/i18n.mjs check   # 校验 8 个语言包的 key 是否齐全（CI 用）
 *   node scripts/i18n.mjs fill    # 把缺失的区块补进语言包（开发用，一次性）
 *
 * 语言包文件是纯对象字面量，可以用 new Function 直接求值，不必走 TS 编译。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'de', 'ru', 'ko', 'ja', 'es-LA']
const REFERENCE = 'zh-CN'

/** 各组词的顺序必须与 key 一致 */
const SHAPE = {
  economy: ['mining', 'industrial', 'tech', 'trade', 'agriculture', 'military'],
  biome: ['rocky', 'ocean', 'desert', 'frozen', 'toxic', 'lava', 'gas', 'barren'],
  starClass: ['yellow', 'red', 'blue', 'green', 'white'],
  hazard: ['none', 'storm', 'radiation', 'extremeCold', 'extremeHeat'],
  danger: ['low', 'medium', 'high']
}

const group = (key, values) => Object.fromEntries(SHAPE[key].map((name, i) => [name, values[i]]))

// ---------------------------------------------------------------- 文案
const ZH_CN = {
  galaxy: {
    economy: group('economy', ['矿业', '工业', '科技', '贸易', '农业', '军事']),
    biome: group('biome', ['岩石', '海洋', '沙漠', '冰封', '毒气', '熔岩', '气态', '贫瘠']),
    starClass: group('starClass', ['黄矮星', '红矮星', '蓝巨星', '绿星', '白矮星']),
    hazard: group('hazard', ['无', '风暴', '辐射', '极寒', '极热']),
    danger: group('danger', ['低', '中', '高']),
    scan: { needScan: '需要扫描', level1: '已扫描 · 恒星系档案', level2: '已扫描 · 行星明细', cooldown: '扫描冷却中' },
    route: { legs: '段', fuel: '燃料', toll: '过路费', noPath: '无法抵达' },
    discovery: { unknownSignal: '未知信号', explorePercent: '探索度' }
  },
  cycle: {
    title: '周目',
    current: '当前周目',
    online: '在线',
    highest: '最高抵达',
    keep: '保留',
    lose: '失去',
    countdown: '倒计时',
    cooldown: '冷却',
    pressure: '层压制',
    status: { active: '活跃', frozen: '冻结', unexplored: '未探索' },
    jump: { up: '跃迁到上一层', down: '下潜到低层', cancel: '取消', confirm: '确认跃迁' }
  },
  faction: {
    miners_guild: '矿业联合会',
    deep_council: '深空议会',
    free_fleet: '自由舰队',
    swarm: '虫群'
  }
}

const ZH_TW = {
  galaxy: {
    economy: group('economy', ['礦業', '工業', '科技', '貿易', '農業', '軍事']),
    biome: group('biome', ['岩石', '海洋', '沙漠', '冰封', '毒氣', '熔岩', '氣態', '貧瘠']),
    starClass: group('starClass', ['黃矮星', '紅矮星', '藍巨星', '綠星', '白矮星']),
    hazard: group('hazard', ['無', '風暴', '輻射', '極寒', '極熱']),
    danger: group('danger', ['低', '中', '高']),
    scan: { needScan: '需要掃描', level1: '已掃描 · 恆星系檔案', level2: '已掃描 · 行星明細', cooldown: '掃描冷卻中' },
    route: { legs: '段', fuel: '燃料', toll: '過路費', noPath: '無法抵達' },
    discovery: { unknownSignal: '未知訊號', explorePercent: '探索度' }
  },
  cycle: {
    title: '周目',
    current: '目前周目',
    online: '線上',
    highest: '最高抵達',
    keep: '保留',
    lose: '失去',
    countdown: '倒數',
    cooldown: '冷卻',
    pressure: '層壓制',
    status: { active: '活躍', frozen: '凍結', unexplored: '未探索' },
    jump: { up: '躍遷到上一層', down: '下潛到低層', cancel: '取消', confirm: '確認躍遷' }
  },
  faction: {
    miners_guild: '礦業聯合會',
    deep_council: '深空議會',
    free_fleet: '自由艦隊',
    swarm: '蟲群'
  }
}

const EN = {
  galaxy: {
    economy: group('economy', ['Mining', 'Industrial', 'Tech', 'Trade', 'Agriculture', 'Military']),
    biome: group('biome', ['Rocky', 'Ocean', 'Desert', 'Frozen', 'Toxic', 'Lava', 'Gas', 'Barren']),
    starClass: group('starClass', ['Yellow dwarf', 'Red dwarf', 'Blue giant', 'Green star', 'White dwarf']),
    hazard: group('hazard', ['None', 'Storm', 'Radiation', 'Extreme cold', 'Extreme heat']),
    danger: group('danger', ['Low', 'Medium', 'High']),
    scan: {
      needScan: 'Needs scanning',
      level1: 'Scanned · system survey',
      level2: 'Scanned · planet details',
      cooldown: 'Scan cooling down'
    },
    route: { legs: 'legs', fuel: 'Fuel', toll: 'Toll', noPath: 'No route' },
    discovery: { unknownSignal: 'Unknown signal', explorePercent: 'Explored' }
  },
  cycle: {
    title: 'Cycle',
    current: 'Current cycle',
    online: 'Online',
    highest: 'Highest reached',
    keep: 'Kept',
    lose: 'Lost',
    countdown: 'Countdown',
    cooldown: 'Cooldown',
    pressure: 'Cycle pressure',
    status: { active: 'Active', frozen: 'Frozen', unexplored: 'Unexplored' },
    jump: { up: 'Jump up', down: 'Dive down', cancel: 'Cancel', confirm: 'Confirm jump' }
  },
  faction: {
    miners_guild: 'Miners Guild',
    deep_council: 'Deep Council',
    free_fleet: 'Free Fleet',
    swarm: 'Swarm'
  }
}

/** 尚未翻译的语言先用英文占位，并在区块顶部留标记 */
const SOURCE = {
  'zh-CN': { data: ZH_CN, translated: true },
  'zh-TW': { data: ZH_TW, translated: true },
  en: { data: EN, translated: true },
  de: { data: EN, translated: false },
  ru: { data: EN, translated: false },
  ko: { data: EN, translated: false },
  ja: { data: EN, translated: false },
  'es-LA': { data: EN, translated: false }
}

// ---------------------------------------------------------------- 工具
const renderBlock = (obj, indent) => {
  const pad = ' '.repeat(indent)
  const lines = []
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      lines.push(`${pad}${key}: '${value.replace(/'/g, "\\'")}',`)
    } else {
      lines.push(`${pad}${key}: {`)
      lines.push(...renderBlock(value, indent + 2))
      lines.push(`${pad}},`)
    }
  }
  return lines
}

const loadLocale = (locale) => {
  const path = `src/locales/${locale}.ts`
  const raw = readFileSync(path, 'utf8')
  const js = raw.replace(/^export default/m, 'module.exports =')
  const mod = { exports: {} }
  new Function('module', js)(mod)
  return { path, raw, data: mod.exports }
}

const flatten = (obj, prefix = '') => {
  const out = []
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') out.push(...flatten(value, next))
    else out.push(next)
  }
  return out
}

// ---------------------------------------------------------------- check
/** 新增区块：这些 key 必须有，缺一条就失败 */
const SCOPES = ['galaxy.', 'cycle.', 'faction.']
const isScoped = key => SCOPES.some(scope => key.startsWith(scope))

const check = () => {
  const reference = flatten(loadLocale(REFERENCE).data)
  const referenceSet = new Set(reference)
  let failures = 0
  let legacyTotal = 0

  for (const locale of LOCALES) {
    const { data } = loadLocale(locale)
    const keys = new Set(flatten(data))
    const missing = reference.filter(key => !keys.has(key))
    const missingScoped = missing.filter(isScoped)
    const missingLegacy = missing.filter(key => !isScoped(key))
    const extra = [...keys].filter(key => !referenceSet.has(key))
    const pending = SOURCE[locale].translated ? 0 : flatten(SOURCE[locale].data).length
    legacyTotal += missingLegacy.length

    const status = missingScoped.length === 0 ? '✅' : '❌'
    const extraText = extra.length ? ` · 多余 ${extra.length}` : ''
    const pendingText = pending ? ` · 英文占位 ${pending}` : ''
    const legacyText = missingLegacy.length ? ` · 历史缺口 ${missingLegacy.length}` : ''
    console.log(`${status} ${locale.padEnd(6)} ${keys.size} keys${extraText}${pendingText}${legacyText}`)
    if (missingScoped.length) {
      failures += 1
      console.log(`   缺少（本次新增）：${missingScoped.join(', ')}`)
    }
    if (missingLegacy.length) {
      console.log(`   历史缺口示例：${missingLegacy.slice(0, 4).join(', ')}${missingLegacy.length > 4 ? ' …' : ''}`)
    }
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} 个语言包缺少本次新增的星系/周目文案`)
    process.exit(1)
  }
  console.log(`\n✅ 星系 / 周目文案在 8 个语言包中齐全`)
  if (legacyTotal > 0) {
    console.log(`⚠️  历史缺口共 ${legacyTotal} 条（不属于本次范围，可后续用 fill 补齐）`)
  }
}

// ---------------------------------------------------------------- fill
/** 历史缺口里影响新手的少量关键 key（补一次即可） */
const LEGACY = {
  'zh-TW': { errors: { targetProtected: '目標處於保護期', attackerProtected: '攻擊方處於保護期' } },
  de: { errors: { targetProtected: 'Ziel ist im Schutzstatus', attackerProtected: 'Angreifer ist im Schutzstatus' } },
  ru: { errors: { targetProtected: 'Цель под защитой', attackerProtected: 'Атакующий под защитой' } },
  ko: { errors: { targetProtected: '대상이 보호 중입니다', attackerProtected: '공격자가 보호 중입니다' } },
  ja: { errors: { targetProtected: '対象は保護中です', attackerProtected: '攻撃側は保護中です' } },
  'es-LA': { errors: { targetProtected: 'El objetivo está protegido', attackerProtected: 'El atacante está protegido' } }
}

/** 把 LEGACY 里的 key 插到对应区块末尾（区块不存在则跳过） */
const fillLegacy = (locale, raw) => {
  const patch = LEGACY[locale]
  if (!patch) return raw
  const { data } = loadLocale(locale)
  let next = raw
  for (const [section, values] of Object.entries(patch)) {
    const existing = data[section] ?? {}
    const missing = Object.entries(values).filter(([key]) => !(key in existing))
    if (missing.length === 0) continue
    const anchor = new RegExp(`^  ${section}: \\{\\r?\\n`, 'm')
    if (!anchor.test(next)) continue
    const lines = missing.map(([key, value]) => `    ${key}: '${value.replace(/'/g, "\\'")}',`).join('\n')
    next = next.replace(anchor, match => `${match}${lines}\n`)
  }
  return next
}

// ---------------------------------------------------------------- fill
const fill = () => {
  for (const locale of LOCALES) {
    const { path, raw, data } = loadLocale(locale)
    let next = raw

    // 1) 历史缺口（少量关键 key）
    const patched = fillLegacy(locale, next)
    if (patched !== next) {
      next = patched
      console.log(`已补历史 key：${locale}`)
    }

    // 2) 星系 / 周目 / 派系三个新区块
    if (!(data.galaxy && data.cycle && data.faction)) {
      const { data: source, translated } = SOURCE[locale]
      const sections = []
      if (!translated) sections.push('  // TODO(i18n): 以下星系/周目文案为英文占位，待翻译')
      sections.push('  galaxy: {', ...renderBlock(source.galaxy, 4), '  },')
      sections.push('  cycle: {', ...renderBlock(source.cycle, 4), '  },')
      sections.push('  faction: {', ...renderBlock(source.faction, 4), '  },')

      const anchor = /^  settings: \{/m
      if (!anchor.test(next)) throw new Error(`${locale}: 找不到 settings 锚点`)
      next = next.replace(anchor, `${sections.join('\n')}\n$&`)
      console.log(`已补齐 ${locale}${translated ? '' : '（英文占位）'}`)
    }

    if (next !== raw) writeFileSync(path, next, 'utf8')
  }
}

const mode = process.argv[2] ?? 'check'
if (mode === 'check') check()
else if (mode === 'fill') fill()
else {
  console.error(`未知模式：${mode}（可用：check / fill）`)
  process.exit(1)
}
