import { MfaSecuritySection } from './MfaSecuritySection';
import { useMfaSettings } from '../useMfaSettings';

// Self-contained MFA settings section: connects the useMfaSettings state/
// handlers hook to the presentational MfaSecuritySection, keeping SettingsPage
// free of MFA state and prop wiring.
export function MfaSettingsSection() {
  const {
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
    loadMfaStatus,
    handleMfaSetup,
    handleMfaVerify,
    handleMfaDisable,
    copySecret,
    closeMfaSetup,
    closeBackupCodes,
    copyBackupCodes,
    closeDisableMfa,
    openDisableMfa,
    toggleShowSecret,
    setMfaVerifyCode,
    setDisableMfaPassword,
  } = useMfaSettings();

  return (
    <MfaSecuritySection
      mfaEnabled={mfaEnabled}
      isLoadingMfa={isLoadingMfa}
      mfaLoadError={mfaLoadError}
      mfaMessage={mfaMessage}
      showMfaSetup={showMfaSetup}
      mfaSetupData={mfaSetupData}
      mfaVerifyCode={mfaVerifyCode}
      isMfaLoading={isMfaLoading}
      backupCodes={backupCodes}
      showBackupCodes={showBackupCodes}
      showDisableMfa={showDisableMfa}
      disableMfaPassword={disableMfaPassword}
      showSecret={showSecret}
      copiedSecret={copiedSecret}
      onLoadMfaStatus={() => void loadMfaStatus()}
      onMfaSetup={handleMfaSetup}
      onMfaVerify={handleMfaVerify}
      onMfaSetupClose={closeMfaSetup}
      onMfaVerifyCodeChange={setMfaVerifyCode}
      onMfaDisable={handleMfaDisable}
      onDisableMfaOpen={openDisableMfa}
      onDisableMfaClose={closeDisableMfa}
      onDisableMfaPasswordChange={setDisableMfaPassword}
      onBackupCodesClose={closeBackupCodes}
      onBackupCodesCopy={copyBackupCodes}
      onShowSecretToggle={toggleShowSecret}
      onCopySecret={() => void copySecret()}
    />
  );
}
