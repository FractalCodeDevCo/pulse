import { FIELD_TYPE_LABELS, FieldType } from "../../types/fieldType"

type FieldTypeSelectorProps = {
  value: FieldType
  onChange: (next: FieldType) => void
}

export function FieldTypeSelector({ value, onChange }: FieldTypeSelectorProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-sm text-neutral-400">Tipo de campo (por proyecto)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((fieldType) => {
          const active = value === fieldType

          return (
            <button
              key={fieldType}
              type="button"
              onClick={() => onChange(fieldType)}
              className={`rounded-xl px-3 py-3 text-sm font-semibold ${
                active
                  ? "bg-emerald-600 text-white"
                  : "border border-neutral-700 bg-neutral-950 hover:bg-neutral-800"
              }`}
            >
              {FIELD_TYPE_LABELS[fieldType]}
            </button>
          )
        })}
      </div>
    </section>
  )
}
