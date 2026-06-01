type CompletionAttachmentSource = {
  id: string;
  documentId: string;
  document: unknown;
};

export function buildItpCompletionResultResponse(
  completion: unknown,
  ncr: unknown,
  witnessPointNotification: unknown,
  subbieCompletionNotification: unknown,
) {
  return {
    completion,
    ncr,
    witnessPointNotification,
    subbieCompletionNotification,
  };
}

export function buildItpCompletionResponse(completion: unknown) {
  return { completion };
}

export function buildItpCompletionStatusResponse<T extends object>(
  completion: T,
  isCompleted: boolean,
) {
  return {
    completion: {
      ...completion,
      isCompleted,
    },
  };
}

export function buildPendingItpVerificationsResponse(pendingVerifications: unknown[]) {
  return {
    pendingVerifications,
    count: pendingVerifications.length,
  };
}

export function mapItpCompletionAttachment(attachment: CompletionAttachmentSource) {
  return {
    id: attachment.id,
    documentId: attachment.documentId,
    document: attachment.document,
  };
}

export function buildItpCompletionAttachmentResponse(attachment: CompletionAttachmentSource) {
  return { attachment: mapItpCompletionAttachment(attachment) };
}

export function buildItpCompletionAttachmentsResponse(attachments: CompletionAttachmentSource[]) {
  return {
    attachments: attachments.map(mapItpCompletionAttachment),
  };
}

export function buildItpCompletionAttachmentDeletedResponse() {
  return { success: true };
}
