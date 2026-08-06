import { type ReactNode } from 'react';
import { Download, FileText, FlaskConical, Link2, Printer, Sparkles, XCircle } from 'lucide-react';
import type { RowAction } from '@/components/ui/RowActions';
import type { TestResult } from '../types';
import {
  nextStatusMap,
  nextStatusButtonLabels,
  canAdvanceTestStatus,
  canSendToLab,
  AT_LAB_STATUS,
  SEND_TO_LAB_LABEL,
  isEnterResultsStep,
} from '../constants';
import {
  canGenerateTestResultCertificate,
  generateTestResultCertificate,
} from '../testResultCertificate';
import { downloadTestRequestForm } from '../testRequestForm';
import { useAttachCertificate } from './useAttachCertificate';

interface UseTestRowActionsOptions {
  test: TestResult;
  projectId: string;
  updatingStatusId: string | null;
  onUpdateStatus: (testId: string, newStatus: string) => void;
  onOpenEnterResults: (test: TestResult) => void;
  onRejectTest: (testId: string) => void;
  onAttachCertificate: (testId: string, file: File, extract?: boolean) => Promise<void>;
  onLinkItpItem?: (test: TestResult) => void;
}

interface TestRowActions {
  /** Must be rendered by the row, outside the overflow menu. */
  fileInput: ReactNode;
  /** The row's next step, or undefined for a verified test. */
  primary?: RowAction;
  actions: RowAction[];
}

/**
 * The single source of truth for a test row's action set, so the desktop
 * register and the mobile card cannot drift (the same reason `ncrActions.ts`
 * exists for NCRs).
 *
 * Exactly one action is promoted to a visible button — the row's mandatory next
 * step. Everything else, including the optional lab hop and the certificate
 * actions, stays reachable behind the row's overflow menu. The gating per
 * action is unchanged; only where the control renders moved.
 */
export function useTestRowActions({
  test,
  projectId,
  updatingStatusId,
  onUpdateStatus,
  onOpenEnterResults,
  onRejectTest,
  onAttachCertificate,
  onLinkItpItem,
}: UseTestRowActionsOptions): TestRowActions {
  const certificate = useAttachCertificate({
    testId: test.id,
    hasCertificate: !!test.certificateDocId,
    onAttachCertificate,
  });

  const updating = updatingStatusId === test.id;
  const actions: RowAction[] = [];

  let primary: RowAction | undefined;
  if (canAdvanceTestStatus(test)) {
    primary = isEnterResultsStep(test.status)
      ? {
          // Ticket T2: record the result before entering.
          key: 'advance',
          label: nextStatusButtonLabels[test.status],
          onSelect: () => onOpenEnterResults(test),
        }
      : {
          key: 'advance',
          label: updating ? 'Updating...' : nextStatusButtonLabels[test.status],
          disabled: updating,
          onSelect: () => onUpdateStatus(test.id, nextStatusMap[test.status]),
        };
  }

  // Wave C2 Phase 2: record that the sample went to the lab. Never the primary
  // advance — plenty of tests never go to a lab.
  if (canSendToLab(test)) {
    actions.push({
      key: 'send-to-lab',
      label: SEND_TO_LAB_LABEL,
      icon: <FlaskConical className="h-4 w-4" />,
      disabled: updating,
      onSelect: () => onUpdateStatus(test.id, AT_LAB_STATUS),
    });
  }

  // The printable lab request form. Document generation only — it changes no
  // status and stamps nothing, which is why it sits apart from "Send to lab".
  actions.push({
    key: 'download-request-form',
    label: 'Download request form',
    icon: <Download className="h-4 w-4" />,
    title: 'Download the printable lab request form for this test',
    onSelect: () => {
      void downloadTestRequestForm(test);
    },
  });

  // Feature B2: attach/replace a certificate so a manual test can reach 'verified'.
  if (test.status !== 'verified') {
    actions.push(
      {
        key: 'attach-certificate',
        label: certificate.attachLabel,
        icon: <FileText className="h-4 w-4" />,
        title: certificate.attachTitle,
        disabled: certificate.uploading,
        onSelect: certificate.attach,
      },
      {
        key: 'read-with-ai',
        label: 'Read with AI',
        icon: <Sparkles className="h-4 w-4" />,
        title:
          'Attach the certificate and read its values with AI, for you to review before saving',
        disabled: certificate.uploading,
        onSelect: certificate.attachAndRead,
      },
    );
  }

  // Migration: link this test to one of its lot's ITP items.
  if (onLinkItpItem && test.lotId) {
    actions.push({
      key: 'link-itp-item',
      label: 'Link to ITP item',
      icon: <Link2 className="h-4 w-4" />,
      onSelect: () => onLinkItpItem(test),
    });
  }

  // Feature #204: reject a test sitting in "entered".
  if (test.status === 'entered') {
    actions.push({
      key: 'reject',
      label: 'Reject',
      icon: <XCircle className="h-4 w-4" />,
      destructive: true,
      onSelect: () => onRejectTest(test.id),
    });
  }

  // Feature #668: print the material conformance record.
  if (canGenerateTestResultCertificate(test)) {
    actions.push({
      key: 'print-conformance-record',
      label: 'Print conformance record',
      icon: <Printer className="h-4 w-4" />,
      onSelect: () => generateTestResultCertificate(test, projectId),
    });
  }

  return { fileInput: certificate.fileInput, primary, actions };
}
