import { z } from 'zod';

const emailAddressSchema = z.string().trim().email();

export function parseNotificationEmails(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export const requestReleaseSchema = z.object({
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  notificationSentTo: z
    .string()
    .min(1, 'At least one notification email is required')
    .refine((value) => {
      const emails = parseNotificationEmails(value);
      return (
        emails.length > 0 && emails.every((email) => emailAddressSchema.safeParse(email).success)
      );
    }, 'Enter valid email addresses separated by commas or semicolons'),
  overrideReason: z.string().optional(),
});

export type RequestReleaseFormData = z.infer<typeof requestReleaseSchema>;
