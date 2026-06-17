import type { HoldPoint } from './types';

type ReleaseIdentityFields = Pick<
  HoldPoint,
  'releasedByName' | 'releasedByOrg' | 'releaseMethod' | 'releaseRecipientEmail'
>;

const RELEASE_METHOD_LABELS: Record<string, string> = {
  secure_link: 'Secure link',
  digital: 'Digital on-site',
  email: 'Email confirmation',
  paper: 'Paper form',
};

export function getReleaseMethodLabel(method: string | null | undefined): string | null {
  if (!method) return null;
  return RELEASE_METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

export function getReleaseIdentityParts(holdPoint: ReleaseIdentityFields): {
  primary: string;
  secondary: string | null;
} {
  const name = holdPoint.releasedByName?.trim();
  const org = holdPoint.releasedByOrg?.trim();
  const recipientEmail = holdPoint.releaseRecipientEmail?.trim();
  const methodLabel = getReleaseMethodLabel(holdPoint.releaseMethod);

  const primary =
    name && org ? `${name}, ${org}` : name || org || recipientEmail || 'Release recorded';

  const secondaryParts: string[] = [];
  if (methodLabel) {
    secondaryParts.push(methodLabel);
  }
  if (recipientEmail) {
    secondaryParts.push(`sent to ${recipientEmail}`);
  }

  return {
    primary,
    secondary: secondaryParts.length > 0 ? secondaryParts.join(' · ') : null,
  };
}

export function getReleaseIdentityText(holdPoint: ReleaseIdentityFields): string {
  const { primary, secondary } = getReleaseIdentityParts(holdPoint);
  return secondary ? `${primary} (${secondary})` : primary;
}
