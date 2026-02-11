export function SocialProof() {
  const clients = [
    "Pacific Civil",
    "Georgiou",
    "BMD Constructions",
    "Fulton Hogan",
    "Downer"
  ]

  return (
    <section className="border-y bg-gray-50/50 py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center justify-center gap-8 md:flex-row md:justify-between">
          <div className="flex items-center space-x-2">
             <span className="text-3xl font-bold text-[#1e3a5f]">50+</span>
             <span className="text-sm font-medium text-gray-600 max-w-[150px] leading-tight">
               Civil contractors trust SiteProof
             </span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8 opacity-60 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0 md:justify-end">
            {clients.map((client) => (
              <div key={client} className="flex items-center text-xl font-bold text-gray-400">
                {client}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
