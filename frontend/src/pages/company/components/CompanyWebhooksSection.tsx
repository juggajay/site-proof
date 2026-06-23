import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Webhook } from 'lucide-react';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import {
  createWebhook,
  deleteWebhook,
  describeWebhookStatus,
  fetchWebhooks,
  formatWebhookEvents,
  regenerateWebhookSecret,
  setWebhookEnabled,
  summarizeWebhookTest,
  testWebhook,
  type CompanyWebhook,
} from '../companyWebhooksData';

interface RevealedSecret {
  title: string;
  secret: string;
}

export function CompanyWebhooksSection() {
  const [webhooks, setWebhooks] = useState<CompanyWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUrl, setCreateUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const creatingRef = useRef(false);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWebhooks();
      setWebhooks(data.webhooks);
    } catch (err) {
      setWebhooks([]);
      setError(extractErrorMessage(err, 'Failed to load webhooks'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  const handleCreate = async () => {
    if (creatingRef.current) return;
    const url = createUrl.trim();
    if (!url) {
      setCreateError('A URL is required');
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    setCreateError('');
    try {
      const data = await createWebhook({ url, events: ['*'] });
      setShowCreateModal(false);
      setCreateUrl('');
      setCopied(false);
      setRevealed({ title: 'Webhook created', secret: data.secret });
      await loadWebhooks();
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Failed to create webhook'));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleToggle = async (webhook: CompanyWebhook) => {
    if (busyId) return;
    setBusyId(webhook.id);
    setActionError('');
    try {
      await setWebhookEnabled(webhook.id, !webhook.enabled);
      setWebhooks((current) =>
        current.map((entry) =>
          entry.id === webhook.id ? { ...entry, enabled: !webhook.enabled } : entry,
        ),
      );
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to update webhook'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (webhook: CompanyWebhook) => {
    if (busyId) return;
    setBusyId(webhook.id);
    setActionError('');
    try {
      await deleteWebhook(webhook.id);
      setWebhooks((current) => current.filter((entry) => entry.id !== webhook.id));
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to delete webhook'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenerate = async (webhook: CompanyWebhook) => {
    if (busyId) return;
    setBusyId(webhook.id);
    setActionError('');
    try {
      const data = await regenerateWebhookSecret(webhook.id);
      setCopied(false);
      setRevealed({ title: 'New signing secret', secret: data.secret });
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to regenerate secret'));
    } finally {
      setBusyId(null);
    }
  };

  const handleTest = async (webhook: CompanyWebhook) => {
    if (busyId) return;
    setBusyId(webhook.id);
    setActionError('');
    try {
      const result = await testWebhook(webhook.id);
      setTestResults((current) => ({ ...current, [webhook.id]: summarizeWebhookTest(result) }));
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to send test webhook'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Webhooks</h2>
            <p className="text-sm text-muted-foreground">
              Notify external systems when events happen in SiteProof.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Add webhook
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6" role="status" aria-label="Loading webhooks">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadWebhooks}>
            Try again
          </Button>
        </div>
      ) : webhooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No webhooks yet. Add one to receive event notifications at your own endpoint.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{webhook.url}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                      webhook.enabled
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {describeWebhookStatus(webhook.enabled)}
                  </span>
                  <span>{formatWebhookEvents(webhook.events)}</span>
                </div>
                {testResults[webhook.id] ? (
                  <p className="mt-1 text-xs text-muted-foreground">{testResults[webhook.id]}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === webhook.id}
                  onClick={() => handleToggle(webhook)}
                >
                  {webhook.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === webhook.id}
                  onClick={() => handleTest(webhook)}
                >
                  Test
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === webhook.id}
                  onClick={() => handleRegenerate(webhook)}
                >
                  Regenerate secret
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={busyId === webhook.id}
                  onClick={() => handleDelete(webhook)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {showCreateModal && (
        <Modal
          onClose={() => (creating ? undefined : setShowCreateModal(false))}
          className="max-w-md"
        >
          <ModalHeader>Add webhook</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  value={createUrl}
                  onChange={(event) => setCreateUrl(event.target.value)}
                  placeholder="https://example.com/webhooks/siteproof"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Subscribes to all events. We sign every delivery with the secret shown next.
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
              {creating ? 'Adding…' : 'Add webhook'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {revealed && (
        <Modal onClose={() => setRevealed(null)} className="max-w-lg">
          <ModalHeader>{revealed.title}</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Copy this signing secret now — for security it{' '}
                <span className="font-medium">will not be shown again</span> after you close this
                dialog.
              </p>
              <div className="break-all rounded-md border bg-muted/50 p-3 font-mono text-sm">
                {revealed.secret}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy to clipboard'}
              </Button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" onClick={() => setRevealed(null)}>
              Done
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </section>
  );
}
