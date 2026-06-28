import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertModalDescription,
  AlertModalFooter,
  AlertModalHeader,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/Modal';
import {
  API_KEY_EXPIRY_OPTIONS,
  API_KEY_SCOPE_OPTIONS,
  canRevokeApiKey,
  createApiKey,
  describeApiKeyStatus,
  formatApiKeyExpiry,
  fetchCompanyApiKeys,
  formatApiKeyLastUsed,
  revokeApiKey,
  type CompanyApiKey,
  type CreatedApiKey,
} from '../companyApiKeysData';

interface CompanyApiKeysSectionProps {
  currentUserId?: string;
}

const defaultCreateForm = { name: '', scopes: 'read', expiresInDays: '90' };

export function CompanyApiKeysSection({ currentUserId }: CompanyApiKeysSectionProps) {
  const [keys, setKeys] = useState<CompanyApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [revealedKey, setRevealedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CompanyApiKey | null>(null);
  const [revokeError, setRevokeError] = useState('');
  const creatingRef = useRef(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCompanyApiKeys();
      setKeys(data.apiKeys);
    } catch (err) {
      setKeys([]);
      setError(extractErrorMessage(err, 'Failed to load API keys'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    if (creatingRef.current) return;
    const name = createForm.name.trim();
    if (!name) {
      setCreateError('A name is required');
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    setCreateError('');
    try {
      const data = await createApiKey({
        name,
        scopes: createForm.scopes,
        expiresInDays: Number(createForm.expiresInDays),
      });
      setShowCreateModal(false);
      setCreateForm(defaultCreateForm);
      setCopied(false);
      setRevealedKey(data.apiKey);
      await loadKeys();
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Failed to create API key'));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey.key);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (insecure context / denied) — the key is
      // still visible for manual copy, so fail quietly.
      setCopied(false);
    }
  };

  const handleRevoke = async (key: CompanyApiKey) => {
    if (revokingId) return;
    setRevokingId(key.id);
    setRevokeError('');
    try {
      await revokeApiKey(key.id);
      setKeys((current) =>
        current.map((entry) => (entry.id === key.id ? { ...entry, isActive: false } : entry)),
      );
      setRevokeTarget(null);
    } catch (err) {
      setRevokeError(extractErrorMessage(err, 'Failed to revoke API key'));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">API keys</h2>
            <p className="text-sm text-muted-foreground">
              Programmatic access to the SiteProof REST API for this company.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Create API key
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6" role="status" aria-label="Loading API keys">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadKeys}>
            Try again
          </Button>
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No API keys yet. Create one to integrate external systems with SiteProof.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(96px,0.6fr)_minmax(96px,0.5fr)_minmax(112px,0.45fr)] bg-muted/50 px-4 py-2 text-xs font-medium uppercase text-muted-foreground md:grid">
            <span>Key</span>
            <span>Owner</span>
            <span>Last used</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y">
            {keys.map((key) => (
              <div
                key={key.id}
                className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(96px,0.6fr)_minmax(96px,0.5fr)_minmax(112px,0.45fr)] md:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{key.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {key.keyPrefix}… · {key.scopes}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatApiKeyExpiry(key.expiresAt)}
                  </div>
                </div>
                <div className="min-w-0 text-xs text-muted-foreground">
                  <span className="mb-1 block font-medium uppercase text-muted-foreground md:hidden">
                    Owner
                  </span>
                  <span className="block truncate">
                    {key.owner ? key.owner.fullName || key.owner.email : 'Unknown'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="mb-1 block font-medium uppercase text-muted-foreground md:hidden">
                    Last used
                  </span>
                  {formatApiKeyLastUsed(key.lastUsedAt)}
                </div>
                <div>
                  <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground md:hidden">
                    Status
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      key.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {describeApiKeyStatus(key)}
                  </span>
                </div>
                <div className="flex md:justify-end">
                  {canRevokeApiKey(key, currentUserId) ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={revokingId === key.id}
                      onClick={() => setRevokeTarget(key)}
                      title="Revoke this API key"
                    >
                      <Trash2 className="h-4 w-4" />
                      Revoke
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Already revoked</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {revokeError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {revokeError}
        </p>
      ) : null}

      {showCreateModal && (
        <Modal
          onClose={() => (creating ? undefined : setShowCreateModal(false))}
          className="max-w-md"
        >
          <ModalHeader>Create API key</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((form) => ({ ...form, name: event.target.value }))
                  }
                  placeholder="e.g. Power BI export"
                />
              </div>
              <div>
                <Label htmlFor="api-key-scopes">Access</Label>
                <select
                  id="api-key-scopes"
                  value={createForm.scopes}
                  onChange={(event) =>
                    setCreateForm((form) => ({ ...form, scopes: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {API_KEY_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="api-key-expiry">Expires after</Label>
                <select
                  id="api-key-expiry"
                  value={createForm.expiresInDays}
                  onChange={(event) =>
                    setCreateForm((form) => ({ ...form, expiresInDays: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {API_KEY_EXPIRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  New browser-created keys expire automatically. Rotate external integrations before
                  this date.
                </p>
              </div>
              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              disabled={creating}
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={creating} onClick={handleCreate}>
              {creating ? 'Creating…' : 'Create key'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {revokeTarget && (
        <Modal
          alert
          onClose={() => (revokingId ? undefined : setRevokeTarget(null))}
          className="max-w-md"
        >
          <AlertModalHeader>Revoke API key</AlertModalHeader>
          <AlertModalDescription>
            Revoke {revokeTarget.name} ({revokeTarget.keyPrefix})? This immediately stops API
            requests that use this key.
          </AlertModalDescription>
          <AlertModalFooter>
            <Button
              type="button"
              variant="outline"
              disabled={revokingId === revokeTarget.id}
              onClick={() => setRevokeTarget(null)}
            >
              Keep key
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={revokingId === revokeTarget.id}
              onClick={() => void handleRevoke(revokeTarget)}
            >
              {revokingId === revokeTarget.id ? 'Revoking...' : 'Revoke API key'}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {revealedKey && (
        <Modal onClose={() => setRevealedKey(null)} className="max-w-lg">
          <ModalHeader>API key created</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Copy this key now — for security it{' '}
                <span className="font-medium">cannot be retrieved again</span> after you close this
                dialog.
              </p>
              <div className="break-all rounded-md border bg-muted/50 p-3 font-mono text-sm">
                {revealedKey.key}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatApiKeyExpiry(revealedKey.expiresAt)}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy to clipboard'}
              </Button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" onClick={() => setRevealedKey(null)}>
              Done
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </section>
  );
}
