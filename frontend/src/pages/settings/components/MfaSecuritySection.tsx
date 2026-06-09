import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Lock,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertModalDescription,
  AlertModalFooter,
  AlertModalHeader,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/Modal';

type MfaMessage = {
  type: 'success' | 'error';
  text: string;
};

type MfaSetupData = {
  secret: string;
  qrCode: string;
};

type MfaSecuritySectionProps = {
  mfaEnabled: boolean;
  isLoadingMfa: boolean;
  mfaLoadError: string;
  mfaMessage: MfaMessage | null;
  showMfaSetup: boolean;
  mfaSetupData: MfaSetupData | null;
  mfaVerifyCode: string;
  isMfaLoading: boolean;
  backupCodes: string[];
  showBackupCodes: boolean;
  showDisableMfa: boolean;
  disableMfaPassword: string;
  showSecret: boolean;
  copiedSecret: boolean;
  onLoadMfaStatus: () => void;
  onMfaSetup: () => void;
  onMfaVerify: () => void;
  onMfaSetupClose: () => void;
  onMfaVerifyCodeChange: (code: string) => void;
  onMfaDisable: () => void;
  onDisableMfaOpen: () => void;
  onDisableMfaClose: () => void;
  onDisableMfaPasswordChange: (password: string) => void;
  onBackupCodesClose: () => void;
  onBackupCodesCopy: () => void;
  onShowSecretToggle: () => void;
  onCopySecret: () => void;
};

export function MfaSecuritySection({
  mfaEnabled,
  isLoadingMfa,
  mfaLoadError,
  mfaMessage,
  showMfaSetup,
  mfaSetupData,
  mfaVerifyCode,
  isMfaLoading,
  backupCodes,
  showBackupCodes,
  showDisableMfa,
  disableMfaPassword,
  showSecret,
  copiedSecret,
  onLoadMfaStatus,
  onMfaSetup,
  onMfaVerify,
  onMfaSetupClose,
  onMfaVerifyCodeChange,
  onMfaDisable,
  onDisableMfaOpen,
  onDisableMfaClose,
  onDisableMfaPasswordChange,
  onBackupCodesClose,
  onBackupCodesCopy,
  onShowSecretToggle,
  onCopySecret,
}: MfaSecuritySectionProps) {
  return (
    <>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security
          </h2>
          <p className="text-sm text-muted-foreground">Manage your account security settings.</p>
        </div>

        {mfaMessage && (
          <div
            role={mfaMessage.type === 'success' ? 'status' : 'alert'}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-md ${
              mfaMessage.type === 'success'
                ? 'bg-success/10 text-success'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {mfaMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {mfaMessage.text}
          </div>
        )}

        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication (2FA)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add an extra layer of security to your account. When enabled, you'll need to enter a
            code from your authenticator app when signing in.
          </p>

          {isLoadingMfa ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading security settings...
            </div>
          ) : mfaLoadError ? (
            <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              <p>{mfaLoadError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onLoadMfaStatus}
              >
                Try again
              </Button>
            </div>
          ) : mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-success/15">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-success">Two-Factor Authentication Enabled</p>
                    <p className="text-sm text-success">Your account is protected with 2FA</p>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={onDisableMfaOpen}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={isMfaLoading}
              >
                <Lock className="h-4 w-4" />
                Disable 2FA
              </Button>
            </div>
          ) : (
            <Button onClick={onMfaSetup} disabled={isMfaLoading}>
              {isMfaLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              Enable Two-Factor Authentication
            </Button>
          )}
        </div>
      </div>

      {showMfaSetup && mfaSetupData && (
        <Modal onClose={onMfaSetupClose}>
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted">
                <Smartphone className="h-6 w-6 text-muted-foreground" />
              </div>
              Set Up Two-Factor Authentication
            </div>
          </ModalHeader>
          <ModalDescription>
            Scan the QR code with an authenticator app, then verify the six-digit code to enable
            2FA.
          </ModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">
                  1. Install an authenticator app like Google Authenticator, Authy, or Microsoft
                  Authenticator.
                </p>
                <p>2. Scan the QR code below with your authenticator app:</p>
              </div>

              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={mfaSetupData.qrCode}
                  alt="QR code for two-factor authentication setup"
                  className="w-48 h-48"
                />
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">
                  Can't scan? Enter this code manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm bg-background px-2 py-1 rounded break-all">
                    {showSecret ? mfaSetupData.secret : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onShowSecretToggle}
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                    aria-label={showSecret ? 'Hide setup secret' : 'Show setup secret'}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onCopySecret}
                    title="Copy to clipboard"
                    aria-label="Copy setup secret"
                  >
                    {copiedSecret ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="mfa-verification-code" className="block mb-2">
                  3. Enter the 6-digit code from your authenticator:
                </Label>
                <Input
                  id="mfa-verification-code"
                  type="text"
                  value={mfaVerifyCode}
                  onChange={(event) =>
                    onMfaVerifyCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                  autoComplete="one-time-code"
                  disabled={isMfaLoading}
                />
              </div>

              {mfaMessage?.type === 'error' && (
                <div
                  role="alert"
                  className="text-sm text-destructive p-2 bg-destructive/10 rounded"
                >
                  {mfaMessage.text}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={onMfaSetupClose} disabled={isMfaLoading}>
              Cancel
            </Button>
            <Button onClick={onMfaVerify} disabled={isMfaLoading || mfaVerifyCode.length !== 6}>
              {isMfaLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Enable'
              )}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {showBackupCodes && backupCodes.length > 0 && (
        <Modal alert onClose={onBackupCodesClose}>
          <AlertModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/15">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              2FA Enabled Successfully!
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Save these backup codes before closing this dialog.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-sm text-warning font-medium mb-2">
                  Important: Save your backup codes!
                </p>
                <p className="text-sm text-warning">
                  If you lose access to your authenticator app, you can use these codes to regain
                  access to your account. Each code can only be used once.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                {backupCodes.map((code, index) => (
                  <code key={index} className="font-mono text-sm text-center py-1">
                    {code}
                  </code>
                ))}
              </div>

              <Button variant="outline" className="w-full" onClick={onBackupCodesCopy}>
                <Copy className="h-4 w-4" />
                Copy All Codes
              </Button>
            </div>
          </ModalBody>
          <AlertModalFooter>
            <Button className="w-full" onClick={onBackupCodesClose}>
              I've Saved My Codes
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {showDisableMfa && (
        <Modal alert onClose={onDisableMfaClose}>
          <AlertModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/15">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              Disable Two-Factor Authentication
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Confirm your password before removing two-factor protection from this account.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-sm text-destructive">
                  <strong>Warning:</strong> Disabling 2FA will make your account less secure. Are
                  you sure you want to continue?
                </p>
              </div>

              <div>
                <Label htmlFor="disable-mfa-password" className="block mb-1">
                  Enter your password to confirm:
                </Label>
                <Input
                  id="disable-mfa-password"
                  type="password"
                  value={disableMfaPassword}
                  onChange={(event) => onDisableMfaPasswordChange(event.target.value)}
                  placeholder="Your password"
                  disabled={isMfaLoading}
                />
              </div>

              {mfaMessage?.type === 'error' && (
                <div
                  role="alert"
                  className="text-sm text-destructive p-2 bg-destructive/10 rounded"
                >
                  {mfaMessage.text}
                </div>
              )}
            </div>
          </ModalBody>
          <AlertModalFooter>
            <Button variant="outline" onClick={onDisableMfaClose} disabled={isMfaLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onMfaDisable}
              disabled={isMfaLoading || !disableMfaPassword}
            >
              {isMfaLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable 2FA'
              )}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}
    </>
  );
}
