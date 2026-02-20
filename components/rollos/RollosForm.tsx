"use client"

import Image from "next/image"
import { ChangeEvent, useMemo, useState } from "react"

import { processImageFiles } from "../../lib/clientImage"
import { FieldType } from "../../types/fieldType"
import {
  CompactionType,
  PhaseStatus,
  RollLengthStatus,
  RollosFormValues,
  RollosRecord,
} from "../../types/rollos"
import { MacroZone, getMacroZoneOptions, getMicroZoneOptions } from "../../types/zoneHierarchy"

const INITIAL_VALUES: RollosFormValues = {
  macroZone: "",
  microZone: "",
  zone: "",
  rollColor: "",
  rollFeetTotal: "",
  rollLotId: "",
  totalRolls: "",
  totalSeams: "",
  plannedFeetNeeded: "",
  preCutCalculated: null,
  phaseStatus: "",
  compactionType: "",
  actualFeetUsed: "",
  remainingFeet: "",
  materialShortage: null,
  reworkRequired: null,
  criticalEvent: "",
  surfaceFirm: true,
  moistureOk: true,
  doubleCompaction: false,
  rollLengthStatus: "",
  photos: [],
  observations: "",
}

type RollosFormProps = {
  fieldType: FieldType
  projectId: string
  defaultZone?: string
  onSubmitRecord: (record: RollosRecord, returnToHub: boolean) => Promise<void> | void
}

export function RollosForm({ fieldType, projectId, defaultZone = "", onSubmitRecord }: RollosFormProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [values, setValues] = useState<RollosFormValues>({ ...INITIAL_VALUES, microZone: defaultZone, zone: defaultZone })
  const [error, setError] = useState("")
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canContinue = values.photos.length >= 1
  const microOptions = useMemo(() => {
    if (!values.macroZone) return []
    return getMicroZoneOptions(fieldType, values.macroZone as MacroZone)
  }, [fieldType, values.macroZone])
  const macroZoneOptions = useMemo(() => getMacroZoneOptions(fieldType), [fieldType])

  async function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    setError("")
    setIsReadingPhoto(true)

    try {
      const selected = Array.from(files)
      const urls = await processImageFiles(selected)
      setValues((prev) => ({ ...prev, photos: [...prev.photos, ...urls].slice(0, 3) }))
    } catch {
      setError("No pudimos cargar las fotos.")
    } finally {
      setIsReadingPhoto(false)
    }
  }

  function removePhoto(index: number) {
    setValues((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }))
  }

  async function saveRollos(returnToHub: boolean) {
    if (!values.macroZone) return setError("MacroZone requerida.")
    if (!values.microZone) return setError("MicroZone requerida.")
    if (!values.rollColor.trim()) return setError("Color del rollo requerido.")
    if (!values.rollFeetTotal || Number(values.rollFeetTotal) <= 0) return setError("Pies totales del rollo requeridos.")
    if (!values.totalRolls || Number(values.totalRolls) < 0) return setError("Total de rollos requerido.")
    if (!values.totalSeams || Number(values.totalSeams) < 0) return setError("Total de costuras requerido.")
    if (!values.plannedFeetNeeded || Number(values.plannedFeetNeeded) <= 0) return setError("Pies planeados requeridos.")
    if (values.preCutCalculated === null) return setError("Indica si se calculó antes de traer/cortar.")
    if (!values.phaseStatus) return setError("Estado de fase requerido.")
    if (!values.compactionType) return setError("Tipo de compactación requerido.")
    if (!values.actualFeetUsed || Number(values.actualFeetUsed) < 0) return setError("Pies usados requeridos.")
    if (!values.remainingFeet || Number(values.remainingFeet) < 0) return setError("Pies sobrantes requeridos.")
    if (values.materialShortage === null) return setError("Indica si faltó material.")
    if (values.reworkRequired === null) return setError("Indica si hubo retrabajo.")
    if (!values.rollLengthStatus) return setError("Semáforo requerido.")
    if (values.photos.length < 1 || values.photos.length > 3) return setError("Sube 1 a 3 fotos.")

    const record: RollosRecord = {
      projectId,
      fieldType,
      zone: values.microZone,
      macro_zone: values.macroZone as MacroZone,
      micro_zone: values.microZone,
      rollColor: values.rollColor.trim(),
      rollFeetTotal: Number(values.rollFeetTotal),
      rollLotId: values.rollLotId.trim() || undefined,
      totalRolls: Number(values.totalRolls),
      totalSeams: Number(values.totalSeams),
      plannedFeetNeeded: Number(values.plannedFeetNeeded),
      preCutCalculated: values.preCutCalculated,
      phaseStatus: values.phaseStatus as PhaseStatus,
      compactionType: values.compactionType as CompactionType,
      actualFeetUsed: Number(values.actualFeetUsed),
      remainingFeet: Number(values.remainingFeet),
      materialShortage: values.materialShortage,
      reworkRequired: values.reworkRequired,
      criticalEvent: values.criticalEvent.trim() || undefined,
      surfaceFirm: values.surfaceFirm,
      moistureOk: values.moistureOk,
      doubleCompaction: values.doubleCompaction,
      rollLengthStatus: values.rollLengthStatus as RollLengthStatus,
      photos: values.photos,
      observations: values.observations.trim() || undefined,
      timestamp: new Date().toISOString(),
    }

    setIsSubmitting(true)
    setError("")

    try {
      await onSubmitRecord(record, returnToHub)
      if (!returnToHub) {
        setValues({ ...INITIAL_VALUES })
        setStep(1)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar en nube."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-300">Paso {step} de 2</div>

      {step === 1 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">1) Fotos</h2>
          <p className="text-sm text-neutral-400">Sube fotos desde galería (1 a 3).</p>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosChange}
            className="block w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2 text-sm"
          />

          {values.photos.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {values.photos.map((photo, index) => (
                <div key={`${photo}-${index}`} className="space-y-2">
                  <Image
                    src={photo}
                    alt={`Evidencia ${index + 1}`}
                    width={600}
                    height={400}
                    unoptimized
                    className="h-40 w-full rounded-xl border border-neutral-700 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="w-full rounded-lg border border-neutral-600 px-2 py-1 text-xs hover:bg-neutral-800"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!canContinue || isReadingPhoto}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            Continue to Data
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">MacroZone</span>
            <select
              value={values.macroZone}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, macroZone: event.target.value as MacroZone | "", microZone: "", zone: "" }))
              }
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
            >
              <option value="">Selecciona MacroZone</option>
              {macroZoneOptions.map((macro) => (
                <option key={macro.value} value={macro.value}>
                  {macro.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">MicroZone</span>
            <select
              value={values.microZone}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, microZone: event.target.value, zone: event.target.value }))
              }
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              disabled={!values.macroZone}
            >
              <option value="">Selecciona MicroZone</option>
              {microOptions.map((micro) => (
                <option key={micro} value={micro}>
                  {micro}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Color del rollo</span>
              <input
                type="text"
                value={values.rollColor}
                onChange={(event) => setValues((prev) => ({ ...prev, rollColor: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Pies totales del rollo</span>
              <input
                type="number"
                min={0}
                value={values.rollFeetTotal}
                onChange={(event) => setValues((prev) => ({ ...prev, rollFeetTotal: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              />
            </label>

            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm text-neutral-300">Lote / ID del rollo (opcional)</span>
              <input
                type="text"
                value={values.rollLotId}
                onChange={(event) => setValues((prev) => ({ ...prev, rollLotId: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Total de rollos instalados</span>
              <input
                type="number"
                min={0}
                value={values.totalRolls}
                onChange={(event) => setValues((prev) => ({ ...prev, totalRolls: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Total de costuras (seams)</span>
              <input
                type="number"
                min={0}
                value={values.totalSeams}
                onChange={(event) => setValues((prev) => ({ ...prev, totalSeams: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              />
            </label>
          </div>

          <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">Verificación previa</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-neutral-300">Pies que se necesitan</span>
                <input
                  type="number"
                  min={0}
                  value={values.plannedFeetNeeded}
                  onChange={(event) => setValues((prev) => ({ ...prev, plannedFeetNeeded: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                />
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-neutral-300">¿Se calculó antes de traer/cortar?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, preCutCalculated: true }))}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                    values.preCutCalculated === true
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                      : "border-neutral-700"
                  }`}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, preCutCalculated: false }))}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                    values.preCutCalculated === false
                      ? "border-red-500 bg-red-500/20 text-red-200"
                      : "border-neutral-700"
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          </section>

          <fieldset className="space-y-2">
            <legend className="text-sm text-neutral-300">Estado de la fase</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: PhaseStatus.COMPACTING, label: "Compactando" },
                { value: PhaseStatus.IN_PROGRESS, label: "In Progress" },
                { value: PhaseStatus.COMPLETED, label: "Completed" },
              ].map((option) => {
                const active = values.phaseStatus === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, phaseStatus: option.value }))}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                      active ? "border-blue-500 bg-blue-500/20 text-blue-200" : "border-neutral-700 bg-neutral-900"
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Tipo de compactación</span>
            <select
              value={values.compactionType}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, compactionType: event.target.value as CompactionType | "" }))
              }
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
            >
              <option value="">Selecciona</option>
              <option value={CompactionType.PLATE}>Placa</option>
              <option value={CompactionType.ROLLER}>Rodillo</option>
              <option value={CompactionType.MANUAL}>Manual</option>
            </select>
          </label>

          <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">Resultado real</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-neutral-300">Pies usados</span>
                <input
                  type="number"
                  min={0}
                  value={values.actualFeetUsed}
                  onChange={(event) => setValues((prev) => ({ ...prev, actualFeetUsed: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-neutral-300">Pies sobrantes</span>
                <input
                  type="number"
                  min={0}
                  value={values.remainingFeet}
                  onChange={(event) => setValues((prev) => ({ ...prev, remainingFeet: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-neutral-300">¿Faltó material?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, materialShortage: true }))}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                      values.materialShortage === true
                        ? "border-amber-500 bg-amber-500/20 text-amber-200"
                        : "border-neutral-700"
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, materialShortage: false }))}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                      values.materialShortage === false
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                        : "border-neutral-700"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-neutral-300">¿Hubo retrabajo?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, reworkRequired: true }))}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                      values.reworkRequired === true
                        ? "border-amber-500 bg-amber-500/20 text-amber-200"
                        : "border-neutral-700"
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, reworkRequired: false }))}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                      values.reworkRequired === false
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                        : "border-neutral-700"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-neutral-300">Evento crítico (opcional)</span>
              <select
                value={values.criticalEvent}
                onChange={(event) => setValues((prev) => ({ ...prev, criticalEvent: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              >
                <option value="">Sin evento</option>
                <option value="MIS_CUT">Se cortó mal</option>
                <option value="WRONG_ROLL">Rollo incorrecto</option>
                <option value="REWORK_SEAM">Retrabajo por costura</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
          </section>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, surfaceFirm: !prev.surfaceFirm }))}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                values.surfaceFirm ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
              }`}
            >
              Superficie firme: {values.surfaceFirm ? "Sí" : "No"}
            </button>

            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, moistureOk: !prev.moistureOk }))}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                values.moistureOk ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-neutral-700"
              }`}
            >
              Humedad OK: {values.moistureOk ? "Sí" : "No"}
            </button>

            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, doubleCompaction: !prev.doubleCompaction }))}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                values.doubleCompaction
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : "border-neutral-700"
              }`}
            >
              Doble compactación: {values.doubleCompaction ? "Sí" : "No"}
            </button>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm text-neutral-300">Semáforo Longitud de Rollos</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: RollLengthStatus.NORMAL, label: "Verde · Normal", cls: "border-emerald-500 text-emerald-200" },
                { value: RollLengthStatus.JUSTO, label: "Amarillo · Justo", cls: "border-amber-500 text-amber-200" },
                {
                  value: RollLengthStatus.MAJOR_MISMATCH,
                  label: "Rojo · Falta/Sobra",
                  cls: "border-red-500 text-red-200",
                },
              ].map((option) => {
                const active = values.rollLengthStatus === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, rollLengthStatus: option.value }))}
                    className={`rounded-xl border px-3 py-4 text-sm font-semibold ${
                      active ? `${option.cls} bg-neutral-950` : "border-neutral-700 bg-neutral-900"
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="block space-y-2">
            <span className="text-sm text-neutral-300">Observaciones (opcional)</span>
            <textarea
              rows={3}
              value={values.observations}
              onChange={(event) => setValues((prev) => ({ ...prev, observations: event.target.value }))}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full rounded-xl border border-neutral-600 py-3 font-semibold hover:bg-neutral-800"
            >
              Volver a fotos
            </button>
            <button
              type="button"
              onClick={() => void saveRollos(false)}
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => void saveRollos(true)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-blue-500 py-3 font-semibold text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
            >
              Save & Return to Hub
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  )
}
