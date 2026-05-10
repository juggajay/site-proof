import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { supportMailtoHref } from '@/lib/contactLinks';

interface SupportContactInfo {
  address: string | null;
}

interface LegalContactCardProps {
  teamName: string;
  email: string;
}

export function LegalContactCard({ teamName, email }: LegalContactCardProps) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<SupportContactInfo>('/api/support/contact')
      .then((contactInfo) => {
        if (!cancelled) {
          setAddress(contactInfo.address || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAddress(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-4 p-4 bg-muted rounded-lg">
      <p className="font-medium">{teamName}</p>
      <p className="text-muted-foreground">
        Email:{' '}
        <a href={supportMailtoHref(email)} className="text-primary hover:underline">
          {email}
        </a>
      </p>
      {address && <p className="text-muted-foreground">Address: {address}</p>}
    </div>
  );
}
