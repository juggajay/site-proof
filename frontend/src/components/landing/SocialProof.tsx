export function SocialProof() {
  const proofPoints = [
    { value: 'ITPs', label: 'Digital inspection records' },
    { value: 'Hold points', label: 'Secure release workflows' },
    { value: 'NCRs', label: 'Corrective action tracking' },
  ];

  return (
    <section className="border-y bg-muted/30 py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {proofPoints.map((point) => (
            <div key={point.value} className="text-center">
              <div className="text-2xl font-bold text-primary">{point.value}</div>
              <div className="mt-1 text-sm font-medium text-muted-foreground">{point.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
