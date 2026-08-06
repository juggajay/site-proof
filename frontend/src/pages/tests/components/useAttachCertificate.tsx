import { useRef, useState, type ReactNode } from 'react';

interface UseAttachCertificateOptions {
  testId: string;
  hasCertificate: boolean;
  // Uploads + links the certificate to the existing test. The parent owns the
  // network call (FormData + authFetch) and the list refresh; this hook only
  // owns the hidden file input + per-row uploading state. `extract` asks the
  // backend to read the certificate and open the review step (C2 Phase 1).
  onAttachCertificate: (testId: string, file: File, extract?: boolean) => Promise<void>;
}

interface AttachCertificateControls {
  /**
   * The hidden file input. Render it in the ROW, never inside the overflow
   * menu — the menu unmounts on select, which would take the input (and its
   * change handler) with it before the picker could resolve.
   */
  fileInput: ReactNode;
  uploading: boolean;
  /** 'Attach certificate' / 'Replace certificate', or the in-flight wording. */
  attachLabel: string;
  attachTitle: string;
  attach: () => void;
  attachAndRead: () => void;
}

const ACCEPTED_TYPES = '.pdf,image/jpeg,image/png';

// Feature B2: per-test action to attach (or replace) a certificate on an EXISTING
// test result, so a manually-created test can satisfy the verification gate.
// Mirrors UploadCertificateModal's upload UX (same accept list, FormData via the
// parent's authFetch call) but targets POST /api/test-results/:id/certificate
// instead of the AI extraction path that creates a brand-new test.
export function useAttachCertificate({
  testId,
  hasCertificate,
  onAttachCertificate,
}: UseAttachCertificateOptions): AttachCertificateControls {
  const [uploading, setUploading] = useState(false);
  // Which action opened the picker. Read in handleChange because one hidden
  // input serves both actions.
  const extractRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = hasCertificate ? 'Replace certificate' : 'Attach certificate';
  const busyLabel = hasCertificate ? 'Replacing...' : 'Attaching...';

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Always clear the input so selecting the same file again re-triggers change.
    event.target.value = '';
    if (!file) return;

    const extract = extractRef.current;
    setUploading(true);
    try {
      await onAttachCertificate(testId, file, extract);
    } finally {
      setUploading(false);
    }
  };

  const triggerPicker = (extract: boolean) => {
    extractRef.current = extract;
    inputRef.current?.click();
  };

  return {
    fileInput: (
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleChange}
      />
    ),
    uploading,
    attachLabel: uploading ? busyLabel : label,
    attachTitle: hasCertificate
      ? 'Replace the linked test certificate'
      : 'Attach a test certificate so this test can be verified',
    attach: () => triggerPicker(false),
    // C2 Phase 1: the same upload, plus an AI read of the certificate whose
    // values are shown for review before anything is saved to this test.
    attachAndRead: () => triggerPicker(true),
  };
}
