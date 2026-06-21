type CompletionAttachmentSource = {
  id: string;
  documentId: string;
  document: unknown;
};

type JsonRecord = Record<string, unknown>;

function stripDocumentFileUrl<TDocument>(document: TDocument): TDocument {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return document;
  }

  const { fileUrl: _fileUrl, ...documentWithoutFileUrl } = document as JsonRecord;
  return documentWithoutFileUrl as TDocument;
}

function sanitizeCompletionAttachments<TCompletion>(completion: TCompletion): TCompletion {
  if (!completion || typeof completion !== 'object' || Array.isArray(completion)) {
    return completion;
  }

  const record = completion as JsonRecord;
  if (!Array.isArray(record.attachments)) {
    return completion;
  }

  return {
    ...record,
    attachments: record.attachments.map((attachment) => {
      if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) {
        return attachment;
      }

      const attachmentRecord = attachment as JsonRecord;
      return {
        ...attachmentRecord,
        document: stripDocumentFileUrl(attachmentRecord.document),
      };
    }),
  } as TCompletion;
}

export function sanitizeItpCompletionResponse<TCompletion>(completion: TCompletion): TCompletion {
  return sanitizeCompletionAttachments(completion);
}

export function buildItpCompletionResultResponse(
  completion: unknown,
  ncr: unknown,
  witnessPointNotification: unknown,
  subbieCompletionNotification: unknown,
) {
  return {
    completion: sanitizeItpCompletionResponse(completion),
    ncr,
    witnessPointNotification,
    subbieCompletionNotification,
  };
}

export function buildItpCompletionResponse(completion: unknown) {
  return { completion: sanitizeItpCompletionResponse(completion) };
}

export function buildItpCompletionStatusResponse<T extends object>(
  completion: T,
  isCompleted: boolean,
) {
  return {
    completion: {
      ...sanitizeItpCompletionResponse(completion),
      isCompleted,
    },
  };
}

export function buildPendingItpVerificationsResponse(pendingVerifications: unknown[]) {
  return {
    pendingVerifications: pendingVerifications.map(sanitizeItpCompletionResponse),
    count: pendingVerifications.length,
  };
}

export function mapItpCompletionAttachment(attachment: CompletionAttachmentSource) {
  return {
    id: attachment.id,
    documentId: attachment.documentId,
    document: stripDocumentFileUrl(attachment.document),
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
