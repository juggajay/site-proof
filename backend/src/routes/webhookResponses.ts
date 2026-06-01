type TimestampLike = { toISOString(): string };

type WebhookCreatedSource = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: TimestampLike;
};

type WebhookDeliveryResult = {
  id: string;
  success: boolean;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
};

export function buildTestWebhookReceivedResponse(received: {
  id: string;
  timestamp: TimestampLike;
}) {
  return {
    received: true,
    id: received.id,
    timestamp: received.timestamp.toISOString(),
  };
}

export function buildTestWebhookLogsResponse(logs: unknown[], total: number) {
  return {
    logs,
    total,
    message: `Showing last ${logs.length} received webhooks`,
  };
}

export function buildTestWebhookLogsClearedResponse() {
  return { message: 'Test webhook logs cleared' };
}

export function buildWebhookConfigsResponse(webhooks: unknown[]) {
  return { webhooks };
}

export function buildWebhookCreatedResponse(config: WebhookCreatedSource) {
  return {
    id: config.id,
    url: config.url,
    secret: config.secret,
    events: config.events,
    enabled: config.enabled,
    createdAt: config.createdAt.toISOString(),
    message: 'Webhook configured successfully. Save the secret - it will not be shown again.',
  };
}

export function buildWebhookSecretRegeneratedResponse(id: string, secret: string) {
  return {
    id,
    secret,
    message: 'Secret regenerated. Save the new secret - it will not be shown again.',
  };
}

export function buildWebhookDeliveriesResponse(deliveries: unknown[], total: number) {
  return { deliveries, total };
}

export function buildWebhookTestDeliveryResponse(delivery: WebhookDeliveryResult) {
  return {
    success: delivery.success,
    deliveryId: delivery.id,
    responseStatus: delivery.responseStatus,
    responseBody: delivery.responseBody,
    error: delivery.error,
  };
}
