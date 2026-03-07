export type TrafficLight = "green" | "yellow" | "red"

const GLUE_ALPHA = 0.2
const DEFAULT_CAN_PRICE_USD = 95
const DEFAULT_TAU_ZONE = 2

type GlueMetricsInput = {
  linearFtEst: number
  cansUsed: number
  baselineMu: number | null
  canPriceUsd?: number
  alpha?: number
}

export type GlueMetricsResult = {
  r: number
  muBefore: number
  muAfter: number
  ratioToBaseline: number
  traffic: TrafficLight
  predictedCans: number
  savingsUsd: number
}

type RollInstallRiskInput = {
  rollLengthSem: TrafficLight
  seamsCount: number
  hasWrongRollIncident: boolean
  tauZone?: number
}

export type RollInstallRiskResult = {
  riskScore: number
  seamsPenalty: number
}

type CompactionRiskInput = {
  surfaceFirm: boolean
  moistureOk: boolean
  doubleCompaction: boolean
  method: string
}

export type CompactionRiskResult = {
  riskScore: number
  traffic: TrafficLight
}

type MaterialPassInput = {
  bagsExpectedPerPass: number
  bagsUsed: number
  valveSetting: number
}

export type MaterialPassResult = {
  deviation: number
  valveDelta: -1 | 0 | 1
  valveNext: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function normalizeTrafficByRatio(ratio: number): TrafficLight {
  if ((ratio >= 0.85 && ratio <= 1.15)) return "green"
  if ((ratio > 1.15 && ratio <= 1.35) || (ratio >= 0.65 && ratio < 0.85)) return "yellow"
  return "red"
}

export function normalizeSemaforo(value: string | null | undefined): TrafficLight {
  const lower = (value ?? "").toLowerCase()
  if (lower.includes("green") || lower === "normal") return "green"
  if (lower.includes("yellow") || lower === "justo") return "yellow"
  return "red"
}

export function computeGlueMetrics(input: GlueMetricsInput): GlueMetricsResult {
  const linearFtEst = Math.max(input.linearFtEst, 0.0001)
  const cansUsed = Math.max(input.cansUsed, 0)
  const alpha = clamp(input.alpha ?? GLUE_ALPHA, 0, 1)
  const canPriceUsd = Math.max(input.canPriceUsd ?? DEFAULT_CAN_PRICE_USD, 0)

  const r = cansUsed / linearFtEst
  const muBefore = input.baselineMu && input.baselineMu > 0 ? input.baselineMu : r
  const ratioToBaseline = muBefore > 0 ? r / muBefore : 1
  const traffic = normalizeTrafficByRatio(ratioToBaseline)
  const predictedCans = muBefore * linearFtEst
  const savingsUsd = Math.max(0, cansUsed - predictedCans) * canPriceUsd
  const muAfter = alpha * r + (1 - alpha) * muBefore

  return {
    r: round(r),
    muBefore: round(muBefore),
    muAfter: round(muAfter),
    ratioToBaseline: round(ratioToBaseline),
    traffic,
    predictedCans: round(predictedCans),
    savingsUsd: round(savingsUsd, 2),
  }
}

export function computeRollInstallRisk(input: RollInstallRiskInput): RollInstallRiskResult {
  const tauZone = input.tauZone ?? DEFAULT_TAU_ZONE
  const semPenalty = input.rollLengthSem === "yellow" ? 25 : input.rollLengthSem === "red" ? 60 : 0
  const seamsPenalty = 5 * Math.max(0, input.seamsCount - tauZone)
  const wrongRollPenalty = input.hasWrongRollIncident ? 15 : 0

  return {
    riskScore: semPenalty + seamsPenalty + wrongRollPenalty,
    seamsPenalty,
  }
}

export function computeCompactionRisk(input: CompactionRiskInput): CompactionRiskResult {
  let risk = 0
  if (!input.surfaceFirm) risk += 40
  if (!input.moistureOk) risk += 30
  if (!input.doubleCompaction) risk += 25
  if ((input.method ?? "").toLowerCase().trim() === "manual") risk += 10

  let traffic: TrafficLight = "green"
  if (risk > 55) traffic = "red"
  else if (risk >= 25) traffic = "yellow"

  return { riskScore: risk, traffic }
}

export function computeMaterialPass(input: MaterialPassInput): MaterialPassResult {
  const expected = Math.max(input.bagsExpectedPerPass, 0.0001)
  const used = Math.max(input.bagsUsed, 0)
  const deviation = (used - expected) / expected

  let valveDelta: -1 | 0 | 1 = 0
  if (deviation > 0.1) valveDelta = -1
  else if (deviation < -0.1) valveDelta = 1

  const valveNext = clamp(input.valveSetting + valveDelta, 1, 6)
  return {
    deviation: round(deviation, 6),
    valveDelta,
    valveNext,
  }
}
