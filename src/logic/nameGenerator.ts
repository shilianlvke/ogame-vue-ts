/**
 * 程序化命名（无人深空风格）
 *
 * 设计原则：
 * 1. **不受语言系统影响**——名字一律英文，避免"中文服里的英文玩家看到中文星球名"；
 * 2. **确定性**——同一个种子永远得到同一个名字，服务端与客户端算出来一致；
 * 3. **可读**——用音节拼装，像外星地名而不是随机字符串。
 *
 * 例：`xeloth` → `Xeloth`、`veyra-7`、`Xeloth Prime`、`Vex Arano`
 */

/** FNV-1a 32 位哈希：把字符串种子转成数字 */
const hash32 = (value: string): number => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32：小巧的确定性随机数 */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ONSETS = ['x', 'v', 'th', 'z', 'k', 'r', 'n', 's', 'qu', 'dr', 'br', 'gl', 'tr', 'm', 'l', 'ph']
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ae', 'ia']
const CODAS = ['n', 'th', 'r', 'l', 'x', 's', 'm', 'k', 'nd', 'sh', 'rn']

const PLANET_SUFFIXES = [
  'Prime',
  'Major',
  'Minor',
  'II',
  'III',
  'IV',
  'V',
  'Alpha',
  'Beta',
  'Gamma',
  'Delta',
  'Secundus',
  'Tertius',
  'Ultima'
]

const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)]!

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** 拼一个词：2~3 音节（`syllables` 可覆盖），首字母大写 */
const makeWord = (rand: () => number, minSyllables = 2, maxSyllables = 3): string => {
  const syllables = minSyllables + Math.floor(rand() * (maxSyllables - minSyllables + 1))
  let word = ''
  for (let i = 0; i < syllables; i += 1) {
    word += pick(rand, ONSETS) + pick(rand, VOWELS)
    if (rand() < 0.5) word += pick(rand, CODAS)
  }
  return capitalize(word)
}

/**
 * 星系 / 恒星系名：2~3 音节，20% 概率带数字后缀（像 NMS 的 Rigel-7）
 */
export const generateSystemName = (seed: string): string => {
  const rand = mulberry32(hash32(seed))
  const name = makeWord(rand)
  return rand() < 0.2 ? `${name}-${1 + Math.floor(rand() * 9)}` : name
}

/**
 * 行星名：「星系名 + 后缀」，如 `Xeloth Prime`
 */
export const generatePlanetName = (seed: string): string => {
  const rand = mulberry32(hash32(`${seed}#planet`))
  return `${generateSystemName(`${seed}#system`)} ${pick(rand, PLANET_SUFFIXES)}`
}

/**
 * NPC 指挥官名：两个短词，如 `Vex Arano`
 */
export const generateCommanderName = (seed: string): string => {
  const rand = mulberry32(hash32(`${seed}#commander`))
  return `${makeWord(rand, 1, 2)} ${makeWord(rand, 1, 2)}`
}

/**
 * 银河（galaxy）名：致敬《无人深空》的宇宙序列
 *
 * 第 1 个固定为 Euclid（欧几里得），其余沿用 NMS 的星系名，再往后用程序化名字。
 */
const GALAXY_NAMES = [
  'Euclid',
  'Hilbert Dimension',
  'Calypso',
  'Hesperius Dimension',
  'Hyades',
  'Ickjamatew',
  'Budullangr',
  'Kikolgallr',
  'Eltiensleen',
  'Eissentam',
  'Elkupalos',
  'Aptisssar'
]

export const generateGalaxyName = (galaxy: number): string =>
  GALAXY_NAMES[galaxy - 1] ?? generateSystemName(`galaxy:${galaxy}`)

/** 恒星系名（按 银河+恒星系 稳定生成） */
export const generateStellarName = (galaxy: number, system: number): string =>
  generateSystemName(`stellar:${galaxy}:${system}`)

/** 星区名（当前银河内的扇区）：第 1 区固定为 Euclid Prime */
export const generateRegionName = (region: number): string =>
  region === 1 ? 'Euclid Prime' : generateSystemName(`region:${region}`)
