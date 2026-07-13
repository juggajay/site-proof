import { useMemo, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { COORDINATE_SYSTEM_OPTIONS, isGda94 } from '@/lib/spatial/coordinateSystems';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { createPlanSheet } from './planSheetsData';
import { fileStem, pageSheetName } from './planSheetNaming';
import {
  MAX_PDF_PAGES,
  renderPdfPageToPng,
  renderPdfPreviews,
  type PdfPreview,
} from './planSheetRasterize';

type PageStatus = 'pending' | 'uploading' | 'done' | 'error';

interface PlanSheetUploadModalProps {
  projectId: string;
  defaultCoordinateSystem: string;
  onClose: () => void;
  onUploaded: () => void;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function PlanSheetUploadModal({
  projectId,
  defaultCoordinateSystem,
  onClose,
  onUploaded,
}: PlanSheetUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [coordinateSystem, setCoordinateSystem] = useState(defaultCoordinateSystem);
  const [preview, setPreview] = useState<PdfPreview | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([1]));
  const [analysing, setAnalysing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<Record<number, PageStatus>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const pdfSelected = file != null && isPdf(file);

  const handleFile = async (chosen: File | undefined) => {
    setError(null);
    setSummary(null);
    setPageStatus({});
    setPreview(null);
    if (!chosen) return;

    setFile(chosen);
    setName(fileStem(chosen.name));

    if (isPdf(chosen)) {
      setAnalysing(true);
      try {
        const result = await renderPdfPreviews(chosen);
        setPreview(result);
        setSelectedPages(new Set([1]));
      } catch (err) {
        logError('Failed to read PDF:', err);
        setError(extractErrorMessage(err, 'Could not read that PDF. Is the file valid?'));
        setFile(null);
      } finally {
        setAnalysing(false);
      }
    } else {
      // Image path: no page picker; the file uploads as-is.
      setSelectedPages(new Set([1]));
    }
  };

  const togglePage = (n: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const orderedSelectedPages = useMemo(
    () => Array.from(selectedPages).sort((a, b) => a - b),
    [selectedPages],
  );

  const canSubmit =
    file != null &&
    name.trim().length > 0 &&
    !analysing &&
    !uploading &&
    (!pdfSelected || orderedSelectedPages.length > 0);

  const uploadImage = async () => {
    if (!file) return;
    setPageStatus({ 1: 'uploading' });
    try {
      await createPlanSheet(projectId, {
        blob: file,
        name: name.trim(),
        pageNumber: 1,
        coordinateSystem,
      });
      setPageStatus({ 1: 'done' });
      setSummary('Uploaded 1 plan sheet.');
      onUploaded();
    } catch (err) {
      logError('Plan sheet image upload failed:', err);
      setPageStatus({ 1: 'error' });
      setError(extractErrorMessage(err, 'Upload failed. Please try again.'));
    }
  };

  const uploadPdfPages = async () => {
    if (!file) return;
    const pages = orderedSelectedPages;
    const singlePage = pages.length === 1;
    let succeeded = 0;
    const failed: number[] = [];

    for (const n of pages) {
      setPageStatus((prev) => ({ ...prev, [n]: 'uploading' }));
      try {
        const blob = await renderPdfPageToPng(file, n);
        await createPlanSheet(projectId, {
          blob,
          name: pageSheetName(name, n, singlePage),
          pageNumber: n,
          coordinateSystem,
        });
        setPageStatus((prev) => ({ ...prev, [n]: 'done' }));
        succeeded += 1;
      } catch (err) {
        logError(`Plan sheet page ${n} upload failed:`, err);
        setPageStatus((prev) => ({ ...prev, [n]: 'error' }));
        failed.push(n);
      }
    }

    if (succeeded > 0) onUploaded();
    const parts = [`Uploaded ${succeeded} of ${pages.length} page${pages.length === 1 ? '' : 's'}`];
    if (failed.length > 0) parts.push(`pages ${failed.join(', ')} failed`);
    setSummary(`${parts.join('; ')}.`);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setUploading(true);
    setError(null);
    setSummary(null);
    try {
      if (pdfSelected) await uploadPdfPages();
      else await uploadImage();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      onClose={() => {
        if (!uploading && !analysing) onClose();
      }}
      className="sm:max-w-2xl"
    >
      <ModalHeader>Add plan sheets</ModalHeader>
      <ModalDescription>
        Upload a construction plan PDF (each selected page becomes a sheet) or a PNG/JPEG image.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-5">
          <div>
            <Label className="mb-1">File *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => void handleFile(e.target.files?.[0])}
              disabled={uploading}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              aria-label="Plan sheet file"
            />
            {analysing && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading PDF…
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="plan-sheet-name" className="mb-1">
              Name *
            </Label>
            <Input
              id="plan-sheet-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., C-101 Rev D"
              disabled={uploading}
            />
            {pdfSelected && orderedSelectedPages.length > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Each page is saved as &quot;{name.trim() || 'Plan sheet'} — p&lt;N&gt;&quot;.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="plan-sheet-crs" className="mb-1">
              Coordinate system *
            </Label>
            <NativeSelect
              id="plan-sheet-crs"
              value={coordinateSystem}
              onChange={(e) => setCoordinateSystem(e.target.value)}
              disabled={uploading}
            >
              {COORDINATE_SYSTEM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            {isGda94(coordinateSystem) && (
              <p
                className="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning"
                role="status"
                data-testid="gda94-warning"
              >
                GDA94 coordinates sit about 1.8 m off current satellite imagery. Use GDA2020 if your
                survey data supports it.
              </p>
            )}
          </div>

          {preview && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="mb-0">
                  Pages ({orderedSelectedPages.length} of {preview.pageCount} selected)
                </Label>
              </div>
              {preview.truncated && (
                <p className="mb-2 rounded-md bg-warning/10 p-2 text-xs text-warning" role="status">
                  This document has {preview.totalPageCount} pages; only the first {MAX_PDF_PAGES}{' '}
                  can be imported at once.
                </p>
              )}
              <div className="grid max-h-72 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
                {preview.thumbnails.map((thumb, index) => {
                  const n = index + 1;
                  const checked = selectedPages.has(n);
                  const status = pageStatus[n];
                  return (
                    <label
                      key={n}
                      className={`relative cursor-pointer rounded-md border p-1 text-center text-xs ${
                        checked ? 'border-primary ring-1 ring-primary' : 'border-input'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="absolute left-2 top-2 z-10"
                        checked={checked}
                        onChange={() => togglePage(n)}
                        disabled={uploading}
                        aria-label={`Select page ${n}`}
                      />
                      <img
                        src={thumb}
                        alt={`Page ${n}`}
                        className="mx-auto h-28 w-auto object-contain"
                      />
                      <span className="mt-1 block text-muted-foreground">
                        Page {n}
                        {status === 'done' && ' ✓'}
                        {status === 'uploading' && ' …'}
                        {status === 'error' && ' ✕'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {summary && (
            <div role="status" className="rounded-md bg-muted p-3 text-sm">
              {summary}
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={uploading || analysing}>
          {summary ? 'Close' : 'Cancel'}
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4" /> Upload
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
