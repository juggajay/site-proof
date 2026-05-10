import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { validateABN, formatABN } from '@/lib/abnValidation';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { GlobalSubcontractor, Subcontractor } from '../types';
import { logError } from '@/lib/logger';

export interface InviteSubcontractorModalProps {
  projectId: string;
  onClose: () => void;
  onInvited: (subcontractor: Subcontractor) => void;
}

export const InviteSubcontractorModal = React.memo(function InviteSubcontractorModal({
  projectId,
  onClose,
  onInvited,
}: InviteSubcontractorModalProps) {
  const [inviteData, setInviteData] = useState({
    companyName: '',
    abn: '',
    contactName: '',
    email: '',
    phone: '',
  });
  const [inviting, setInviting] = useState(false);
  const [abnError, setAbnError] = useState<string | null>(null);
  const invitingRef = useRef(false);

  // Global subcontractor directory state
  const [globalSubcontractors, setGlobalSubcontractors] = useState<GlobalSubcontractor[]>([]);
  const [selectedGlobalId, setSelectedGlobalId] = useState<string | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  // Fetch global subcontractor directory when modal opens
  const fetchGlobalDirectory = useCallback(async () => {
    setLoadingDirectory(true);
    setDirectoryError(null);
    try {
      const data = await apiFetch<{ subcontractors: GlobalSubcontractor[] }>(
        '/api/subcontractors/directory',
      );
      setGlobalSubcontractors(data.subcontractors || []);
    } catch (error) {
      logError('Error fetching directory:', error);
      setGlobalSubcontractors([]);
      setDirectoryError(
        extractErrorMessage(
          error,
          'Could not load subcontractor directory. You can still create a new subcontractor.',
        ),
      );
    } finally {
      setLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    void fetchGlobalDirectory();
  }, [fetchGlobalDirectory]);

  const filteredGlobalSubcontractors = useMemo(() => {
    if (!directorySearch) return globalSubcontractors;
    const search = directorySearch.toLowerCase();
    return globalSubcontractors.filter(
      (gs) =>
        gs.companyName.toLowerCase().includes(search) || gs.abn?.toLowerCase().includes(search),
    );
  }, [globalSubcontractors, directorySearch]);

  const selectFromDirectory = useCallback((globalSub: GlobalSubcontractor | null) => {
    if (globalSub) {
      setSelectedGlobalId(globalSub.id);
      setInviteData({
        companyName: globalSub.companyName,
        abn: globalSub.abn,
        contactName: globalSub.primaryContactName,
        email: globalSub.primaryContactEmail,
        phone: globalSub.primaryContactPhone,
      });
      setAbnError(null);
    } else {
      // "Create New" selected
      setSelectedGlobalId(null);
      setInviteData({ companyName: '', abn: '', contactName: '', email: '', phone: '' });
      setAbnError(null);
    }
  }, []);

  const handleABNChange = useCallback((value: string) => {
    setInviteData((prev) => ({ ...prev, abn: value }));
    const error = validateABN(value);
    setAbnError(error);
  }, []);

  const handleABNBlur = useCallback(() => {
    if (inviteData.abn && !abnError) {
      setInviteData((prev) => ({ ...prev, abn: formatABN(prev.abn) }));
    }
  }, [inviteData.abn, abnError]);

  const inviteSubcontractor = useCallback(async () => {
    if (invitingRef.current) return;

    const trimmedInviteData = {
      companyName: inviteData.companyName.trim(),
      abn: inviteData.abn.trim(),
      contactName: inviteData.contactName.trim(),
      email: inviteData.email.trim(),
      phone: inviteData.phone.trim(),
    };

    if (
      !selectedGlobalId &&
      (!trimmedInviteData.companyName ||
        !trimmedInviteData.contactName ||
        !trimmedInviteData.email ||
        !!abnError)
    ) {
      toast({
        title: 'Missing required fields',
        description: 'Company name, contact name, email, and any entered ABN must be valid.',
        variant: 'warning',
      });
      return;
    }

    invitingRef.current = true;
    setInviting(true);

    try {
      const data = await apiFetch<{ subcontractor: Subcontractor }>('/api/subcontractors/invite', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          ...(selectedGlobalId ? { globalSubcontractorId: selectedGlobalId } : {}),
          companyName: trimmedInviteData.companyName,
          abn: trimmedInviteData.abn,
          primaryContactName: trimmedInviteData.contactName,
          primaryContactEmail: trimmedInviteData.email,
          primaryContactPhone: trimmedInviteData.phone,
        }),
      });

      onInvited(data.subcontractor);
      onClose();
    } catch (error) {
      logError('Invite subcontractor error:', error);
      toast({
        title: 'Failed to invite subcontractor',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      invitingRef.current = false;
      setInviting(false);
    }
  }, [projectId, selectedGlobalId, inviteData, abnError, onInvited, onClose]);

  const isSubmitDisabled =
    inviting ||
    (selectedGlobalId
      ? false
      : !inviteData.companyName.trim() ||
        !inviteData.contactName.trim() ||
        !inviteData.email.trim() ||
        !!abnError);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-subcontractor-title"
        aria-describedby="invite-subcontractor-description"
        className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 id="invite-subcontractor-title" className="text-xl font-semibold">
              Invite Subcontractor
            </h2>
            <p id="invite-subcontractor-description" className="sr-only">
              Select an existing subcontractor or create a new subcontractor invitation for this
              project.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg"
            aria-label="Close invite subcontractor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Directory Selector */}
          <div>
            <label
              htmlFor="subcontractor-directory-search"
              className="block text-sm font-medium mb-1"
            >
              Select from Directory
            </label>
            {loadingDirectory ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-muted/50 text-muted-foreground">
                Loading directory...
              </div>
            ) : (
              <div className="space-y-2">
                {directoryError && (
                  <div
                    className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    role="alert"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>{directoryError}</span>
                      <button
                        type="button"
                        onClick={() => void fetchGlobalDirectory()}
                        className="rounded-md border border-red-200 bg-white px-3 py-1 font-medium text-red-700 hover:bg-red-100"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="subcontractor-directory-search"
                    type="text"
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Search existing subcontractors..."
                  />
                </div>

                {/* Dropdown options */}
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {/* Create New option */}
                  <button
                    type="button"
                    onClick={() => selectFromDirectory(null)}
                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 ${
                      selectedGlobalId === null ? 'bg-primary/10 border-l-2 border-primary' : ''
                    }`}
                  >
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="font-medium">Create New Subcontractor</span>
                  </button>

                  {/* Existing subcontractors */}
                  {filteredGlobalSubcontractors.map((gs) => (
                    <button
                      key={gs.id}
                      type="button"
                      onClick={() => selectFromDirectory(gs)}
                      className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors border-t ${
                        selectedGlobalId === gs.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="font-medium">{gs.companyName}</div>
                      <div className="text-xs text-muted-foreground">
                        {gs.primaryContactName} {gs.abn && `\u2022 ${gs.abn}`}
                      </div>
                    </button>
                  ))}

                  {globalSubcontractors.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground border-t">
                      No subcontractors in directory yet
                    </div>
                  )}
                  {globalSubcontractors.length > 0 && filteredGlobalSubcontractors.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground border-t">
                      No matching subcontractors found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {selectedGlobalId ? 'Selected Details' : 'New Subcontractor Details'}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="subcontractor-invite-company"
              className="block text-sm font-medium mb-1"
            >
              Company Name *
            </label>
            <input
              id="subcontractor-invite-company"
              type="text"
              value={inviteData.companyName}
              onChange={(e) => setInviteData((prev) => ({ ...prev, companyName: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''
              }`}
              placeholder="ABC Construction Pty Ltd"
              readOnly={!!selectedGlobalId}
            />
          </div>
          <div>
            <label htmlFor="subcontractor-invite-abn" className="block text-sm font-medium mb-1">
              ABN
            </label>
            <input
              id="subcontractor-invite-abn"
              type="text"
              value={inviteData.abn}
              onChange={(e) => handleABNChange(e.target.value)}
              onBlur={handleABNBlur}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                abnError ? 'border-red-500 focus:ring-red-500' : ''
              } ${selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''}`}
              placeholder="12 345 678 901"
              data-testid="abn-input"
              readOnly={!!selectedGlobalId}
            />
            {abnError && (
              <p className="text-sm text-red-500 mt-1" data-testid="abn-error">
                {abnError}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="subcontractor-invite-contact"
              className="block text-sm font-medium mb-1"
            >
              Primary Contact Name *
            </label>
            <input
              id="subcontractor-invite-contact"
              type="text"
              value={inviteData.contactName}
              onChange={(e) => setInviteData((prev) => ({ ...prev, contactName: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''
              }`}
              placeholder="John Smith"
              readOnly={!!selectedGlobalId}
            />
          </div>
          <div>
            <label htmlFor="subcontractor-invite-email" className="block text-sm font-medium mb-1">
              Email *
            </label>
            <input
              id="subcontractor-invite-email"
              type="email"
              value={inviteData.email}
              onChange={(e) => setInviteData((prev) => ({ ...prev, email: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''
              }`}
              placeholder="john@company.com.au"
              readOnly={!!selectedGlobalId}
            />
          </div>
          <div>
            <label htmlFor="subcontractor-invite-phone" className="block text-sm font-medium mb-1">
              Phone
            </label>
            <input
              id="subcontractor-invite-phone"
              type="tel"
              value={inviteData.phone}
              onChange={(e) => setInviteData((prev) => ({ ...prev, phone: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''
              }`}
              placeholder="0412 345 678"
              readOnly={!!selectedGlobalId}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={inviteSubcontractor}
            disabled={isSubmitDisabled}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {inviting
              ? 'Sending...'
              : selectedGlobalId
                ? 'Send Invitation'
                : 'Create & Send Invitation'}
          </button>
        </div>
      </div>
    </div>
  );
});
