import SiteShell from "../../components/site/SiteShell"
import HowWeCaptureMaps from "../../components/site/HowWeCaptureMaps"

export default function HowWeCapturePage() {
  return (
    <SiteShell
      title="How We Capture"
      subtitle="Operational mapping by sport and zone. Hover each area to see why it matters for installation control."
    >
      <HowWeCaptureMaps />
    </SiteShell>
  )
}
