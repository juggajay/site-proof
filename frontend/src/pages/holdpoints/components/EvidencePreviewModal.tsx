import { Download, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';

interface EvidencePreviewModalProps {
  previewData: HPEvidencePackageData;
  onClose: () => void;
  onDownload: () => void;
}

/** Nested preview modal for evidence package */
export function EvidencePreviewModal({
  previewData,
  onClose,
  onDownload,
}: EvidencePreviewModalProps) {
  return (
    <Modal onClose={onClose} className="max-w-4xl">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Evidence Package Preview</h3>
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">PREVIEW</span>
        </div>
      </div>

      {/* Preview Content */}
      <ModalBody className="space-y-6">
        {/* Hold Point Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Hold Point</div>
            <div className="font-medium">{previewData.holdPoint.description}</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Lot</div>
            <div className="font-medium">{previewData.lot.lotNumber}</div>
            {previewData.lot.activityType && (
              <div className="text-sm text-muted-foreground">{previewData.lot.activityType}</div>
            )}
          </div>
        </div>

        {/* Project & ITP Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Project</div>
            <div className="font-medium">{previewData.project.name}</div>
            <div className="text-sm text-muted-foreground">{previewData.project.projectNumber}</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">ITP Template</div>
            <div className="font-medium">{previewData.itpTemplate.name}</div>
          </div>
        </div>

        {/* Checklist Items */}
        <div>
          <h4 className="font-medium mb-3">
            Checklist Items ({previewData.summary.completedItems}/
            {previewData.summary.totalChecklistItems} completed)
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Completed By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewData.checklist.map((item) => (
                  <tr
                    key={item.sequenceNumber}
                    className={item.isCompleted ? 'bg-green-50/50' : 'bg-red-50/50'}
                  >
                    <td className="px-3 py-2">{item.sequenceNumber}</td>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2">
                      {item.pointType === 'hold' && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                          HP
                        </span>
                      )}
                      {item.pointType === 'witness' && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                          WP
                        </span>
                      )}
                      {item.pointType === 'standard' && (
                        <span className="px-1.5 py-0.5 bg-muted text-foreground text-xs rounded">
                          Std
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.isCompleted ? (
                        <span className="text-green-600">&#x2713; Completed</span>
                      ) : (
                        <span className="text-red-600">&#x2717; Incomplete</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.completedBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Test Results */}
        {previewData.testResults.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">
              Test Results ({previewData.summary.passingTests}/
              {previewData.summary.totalTestResults} passing)
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Test Type</th>
                    <th className="px-3 py-2 text-left">Lab</th>
                    <th className="px-3 py-2 text-left">Result</th>
                    <th className="px-3 py-2 text-left">Pass/Fail</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewData.testResults.map((test) => (
                    <tr key={test.id}>
                      <td className="px-3 py-2">{test.testType}</td>
                      <td className="px-3 py-2">{test.laboratoryName || '-'}</td>
                      <td className="px-3 py-2">
                        {test.resultValue} {test.resultUnit}
                      </td>
                      <td className="px-3 py-2">
                        {test.passFail === 'pass' ? (
                          <span className="text-green-600">&#x2713; Pass</span>
                        ) : (
                          <span className="text-red-600">&#x2717; Fail</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <h4 className="font-medium text-foreground mb-2">Evidence Summary</h4>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-primary">Checklist Items</div>
              <div className="font-semibold text-foreground">
                {previewData.summary.completedItems}/{previewData.summary.totalChecklistItems}
              </div>
            </div>
            <div>
              <div className="text-primary">Verified Items</div>
              <div className="font-semibold text-foreground">
                {previewData.summary.verifiedItems}
              </div>
            </div>
            <div>
              <div className="text-primary">Test Results</div>
              <div className="font-semibold text-foreground">
                {previewData.summary.passingTests}/{previewData.summary.totalTestResults}
              </div>
            </div>
            <div>
              <div className="text-primary">Photos/Attachments</div>
              <div className="font-semibold text-foreground">
                {previewData.summary.totalPhotos + previewData.summary.totalAttachments}
              </div>
            </div>
          </div>
        </div>
      </ModalBody>

      {/* Preview Footer */}
      <ModalFooter>
        <p className="text-sm text-muted-foreground mr-auto">
          This is a preview of the evidence package that will be generated.
        </p>
        <Button
          variant="outline"
          onClick={onDownload}
          className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button onClick={onClose}>Continue to Request</Button>
      </ModalFooter>
    </Modal>
  );
}
