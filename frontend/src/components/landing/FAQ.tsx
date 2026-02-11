import { Accordion, AccordionItem } from '@/components/ui/Accordion'

export function FAQ() {
  const faqs = [
    {
      q: "How long does setup take?",
      a: "Most teams are running within a week. We import your lot lists, set up ITP templates for your activity types, and train your team. Foremen usually get it within an hour."
    },
    {
      q: "Does it work offline?",
      a: "Yes. The mobile app stores data locally and syncs when you're back in signal. Your foremen can complete ITPs, take photos, and submit diaries from anywhere."
    },
    {
      q: "Can superintendents outside our company release hold points?",
      a: "Yes. They receive a secure email with the evidence package and can release with one click. No login required. Full audit trail recorded."
    },
    {
      q: "What about our existing data?",
      a: "We can import lot lists from Excel/CSV. Historical records can be linked as documents. Most teams start fresh with SiteProof going forward."
    },
    {
      q: "Is it secure?",
      a: "Yes. Data encrypted in transit and at rest. Hosted on Australian servers (Supabase/AWS Sydney). MFA available. Role-based permissions ensure people only see what they should."
    },
    {
      q: "How does it handle different state specs?",
      a: "ITP templates can be configured for TfNSW, TMR, VicRoads, or any other spec set. You can run projects across multiple states with the right templates for each."
    }
  ]

  return (
    <section id="faq" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Common Questions
          </h2>
        </div>
        
        <Accordion className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} title={faq.q} className="bg-white border-gray-200">
               <p className="text-gray-600">{faq.a}</p>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
