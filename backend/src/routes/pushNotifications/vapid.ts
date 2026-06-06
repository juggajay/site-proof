import webpush from 'web-push';

const DEFAULT_VAPID_SUBJECT = 'mailto:admin@siteproof.com';

type VapidConfiguration = {
  keys: { publicKey: string; privateKey: string };
  configured: boolean;
  vapidConfigured: boolean;
  usingGeneratedKeys: boolean;
};

// Generate VAPID keys if not set (for development)
let generatedVapidKeys: { publicKey: string; privateKey: string } | null = null;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getConfiguredVapidKeys() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? '',
  };
}

function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT;
}

function getVapidKeys() {
  const configuredKeys = getConfiguredVapidKeys();

  if (configuredKeys.publicKey && configuredKeys.privateKey) {
    return {
      publicKey: configuredKeys.publicKey,
      privateKey: configuredKeys.privateKey,
    };
  }

  if (isProductionRuntime()) {
    return {
      publicKey: '',
      privateKey: '',
    };
  }

  // Generate keys for development if not set
  if (!generatedVapidKeys) {
    generatedVapidKeys = webpush.generateVAPIDKeys();
  }

  return generatedVapidKeys;
}

export function getVapidConfiguration(): VapidConfiguration {
  const keys = getVapidKeys();
  const configuredKeys = getConfiguredVapidKeys();
  const vapidConfigured = Boolean(configuredKeys.publicKey && configuredKeys.privateKey);

  return {
    keys,
    configured: Boolean(keys.publicKey && keys.privateKey),
    vapidConfigured,
    usingGeneratedKeys: !isProductionRuntime() && !vapidConfigured && Boolean(generatedVapidKeys),
  };
}

// Initialize web-push with VAPID keys
export function initializeWebPush(): VapidConfiguration {
  const config = getVapidConfiguration();
  if (config.configured) {
    webpush.setVapidDetails(getVapidSubject(), config.keys.publicKey, config.keys.privateKey);
  }
  return config;
}
