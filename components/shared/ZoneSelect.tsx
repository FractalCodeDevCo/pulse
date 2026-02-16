import { Zone, ZONE_OPTIONS } from "../../types/zones"

type ZoneSelectProps = {
  value: Zone | ""
  onChange: (next: Zone | "") => void
  label?: string
}

export function ZoneSelect({ value, onChange, label = "Zone" }: ZoneSelectProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-neutral-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Zone | "")}
        className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
        required
      >
        <option value="">Select zone</option>
        {ZONE_OPTIONS.map((zone) => (
          <option key={zone.value} value={zone.value}>
            {zone.label}
          </option>
        ))}
      </select>
    </label>
  )
}
