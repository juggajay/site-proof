import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';

export function FAQ() {
  const faqs = [
    {
      q: 'How long does setup take?',
      a: 'Setup starts with your projects, lot lists, ITP templates, and user roles. We scope the rollout around the records and workflows your team needs first.',
    },
    {
      q: 'Does it work offline?',
      a: "Yes. The mobile app stores data locally and syncs when you're back in signal. Your foremen can complete ITPs, take photos, and submit diaries from anywhere.",
    },
    {
      q: 'Can superintendents outside our company release hold points?',
      a: 'Yes. They receive a secure email with the evidence package and can release with one click. No login required. Full audit trail recorded.',
    },
    {
      q: 'What about our existing data?',
      a: 'Lot lists can be imported from Excel/CSV, and historical records can be linked as documents when they need to remain part of the project record.',
    },
    {
      q: 'Is it secure?',
      a: 'SiteProof supports encrypted transport, MFA, role-based permissions, audit logging, and controlled document access. Storage region depends on your configured deployment.',
    },
    {
      q: 'How does it handle different state specs?',
      a: 'ITP templates can be configured for TfNSW, TMR, VicRoads, or any other spec set. You can run projects across multiple states with the right templates for each.',
    },
  ];

  return (
    <section id="faq" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4 md:px-6 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Common Questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`} className="bg-card border-border">
              <AccordionTrigger>{faq.q}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{faq.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
