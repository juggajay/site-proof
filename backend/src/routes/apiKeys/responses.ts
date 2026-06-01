type ApiKeyCreatedRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  expiresAt: Date | null;
  createdAt: Date;
};

type ApiKeyListRecord = ApiKeyCreatedRecord & {
  lastUsedAt: Date | null;
  isActive: boolean;
};

export function buildApiKeyCreatedResponse(apiKeyRecord: ApiKeyCreatedRecord, rawKey: string) {
  return {
    apiKey: {
      ...apiKeyRecord,
      key: rawKey,
    },
    message: 'API key created. Save this key securely - it cannot be retrieved again.',
  };
}

export function buildApiKeyListResponse(apiKeys: ApiKeyListRecord[]) {
  return { apiKeys };
}

export function buildApiKeyRevokedResponse() {
  return { message: 'API key revoked successfully' };
}
