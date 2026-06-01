export function buildEmailQueueResponse<TEmail>(emails: TEmail[]) {
  return {
    emails,
    count: emails.length,
  };
}

export function buildEmailQueueClearedResponse() {
  return {
    success: true,
    message: 'Email queue cleared',
  };
}
