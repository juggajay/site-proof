export class MfaRequiredError extends Error {
  userId: string;

  constructor(userId: string) {
    super('MFA verification required');
    this.name = 'MfaRequiredError';
    this.userId = userId;
  }
}
