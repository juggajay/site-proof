import { useId, useRef, useState } from 'react';

interface AttachCertificateButtonProps {
  testId: string;
  hasCertificate: boolean;
  disabled?: boolean;
  // Uploads + links the certificate to the existing test. The parent owns the
  // network call (FormData + authFetch) and the list refresh; this component only
  // owns the hidden file input + per-row uploading state.
  onAttachCertificate: (testId: string, file: File) => Promise<void>;
  // Optional render variant: the desktop table uses a compact bordered button,
  // the mobile card uses a full-width outline button.
  variant?: 'table' | 'mobile';
}

const ACCEPTED_TYPES = '.pdf,image/jpeg,image/png';

// Feature B2: per-test action to attach (or replace) a certificate on an EXISTING
// test result, so a manually-created test can satisfy the verification gate.
// Mirrors UploadCertificateModal's upload UX (same accept list, FormData via the
// parent's authFetch call) but targets POST /api/test-results/:id/certificate
// instead of the AI extraction path that creates a brand-new test.
export function AttachCertificateButton({
  testId,
  hasCertificate,
  disabled,
  onAttachCertificate,
  variant = 'table',
}: AttachCertificateButtonProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const label = hasCertificate ? 'Replace certificate' : 'Attach certificate';
  const busyLabel = hasCertificate ? 'Replacing...' : 'Attaching...';

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Always clear the input so selecting the same file again re-triggers change.
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      await onAttachCertificate(testId, file);
    } finally {
      setUploading(false);
    }
  };

  const triggerPicker = () => {
    inputRef.current?.click();
  };

  const buttonClassName =
    variant === 'mobile'
      ? 'inline-flex w-full items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50'
      : 'px-3 py-1 text-xs rounded border hover:bg-muted/50 disabled:opacity-50';

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={triggerPicker}
        disabled={disabled || uploading}
        className={buttonClassName}
        title={
          hasCertificate
            ? 'Replace the linked test certificate'
            : 'Attach a test certificate so this test can be verified'
        }
      >
        {uploading ? busyLabel : label}
      </button>
    </>
  );
}
