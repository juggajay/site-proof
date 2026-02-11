export function ComplianceStandards() {
  const standards = [
    { name: "TfNSW", desc: "Transport for NSW", detail: "Q6 Quality Systems, R-series specs" },
    { name: "TMR", desc: "Queensland Main Roads", detail: "MRTS technical specs" },
    { name: "VicRoads", desc: "Victoria", detail: "Section specs (204, 304, 407, 610)" },
    { name: "DIT", desc: "South Australia", detail: "Master Specification (RD/ST series)" },
    { name: "Austroads", desc: "National", detail: "Guide to Pavement Technology" },
    { name: "AS", desc: "Australian Standards", detail: "AS 1289, AS 1012, AS 1141" },
  ]

  return (
    <section className="py-16 bg-white border-b">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
            Built for Australian civil standards
          </h2>
          <p className="mt-2 text-gray-600">
            SiteProof understands the specs you build to.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {standards.map((std, index) => (
            <div key={index} className="flex flex-col items-center p-4 bg-gray-50 rounded-lg border text-center w-full sm:w-[200px] hover:border-[#1e3a5f]/30 transition-colors">
              <div className="text-2xl font-bold text-[#1e3a5f] mb-1">{std.name}</div>
              <div className="text-sm font-semibold text-gray-900">{std.desc}</div>
              <div className="text-xs text-gray-500 mt-1">{std.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
