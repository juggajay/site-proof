import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Mail,
  Phone,
  MessageSquare,
  Send,
  Check,
  Loader2,
  FileText,
  Book,
  ExternalLink,
  Clock,
  HeadphonesIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { logError } from '@/lib/logger';
import { DEFAULT_SUPPORT_EMAIL, supportMailtoHref, telHref } from '@/lib/contactLinks';

const supportCategoryValues = ['general', 'technical', 'billing', 'feature', 'bug'] as const;

const supportSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required')
    .max(160, 'Subject must be 160 characters or less'),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(5000, 'Message must be 5000 characters or less'),
  category: z.enum(supportCategoryValues),
});

type SupportFormData = z.infer<typeof supportSchema>;

interface SupportRequestResponse {
  success: boolean;
  message: string;
  ticketId: string;
}

interface SupportContactInfo {
  email: string;
  phone: string | null;
  phoneLabel: string | null;
  emergencyPhone: string | null;
  address: string | null;
  hours: string;
  responseTime: {
    critical: string;
    standard: string;
    general: string;
  };
}

const DEFAULT_SUPPORT_CONTACT: SupportContactInfo = {
  email: DEFAULT_SUPPORT_EMAIL,
  phone: null,
  phoneLabel: null,
  emergencyPhone: null,
  address: null,
  hours: 'Mon-Fri, 8am-6pm AEST',
  responseTime: {
    critical: 'Within 2 hours',
    standard: 'Within 24 hours',
    general: 'Within 48 hours',
  },
};

export function SupportPage() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [contactInfo, setContactInfo] = useState<SupportContactInfo>(DEFAULT_SUPPORT_CONTACT);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SupportFormData>({
    resolver: zodResolver(supportSchema),
    mode: 'onBlur',
    defaultValues: {
      subject: '',
      message: '',
      category: 'general',
    },
  });

  const subject = watch('subject');
  const message = watch('message');

  useEffect(() => {
    let cancelled = false;

    apiFetch<SupportContactInfo>('/api/support/contact')
      .then((data) => {
        if (!cancelled) {
          setContactInfo({ ...DEFAULT_SUPPORT_CONTACT, ...data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContactInfo(DEFAULT_SUPPORT_CONTACT);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (data: SupportFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setSubmittedTicketId(null);

    try {
      const response = await apiFetch<SupportRequestResponse>('/api/support/request', {
        method: 'POST',
        body: JSON.stringify({
          subject: data.subject,
          message: data.message,
          category: data.category,
          userEmail: user?.email,
          userName: user?.name || user?.fullName,
        }),
      });

      setSubmitSuccess(true);
      setSubmittedTicketId(response.ticketId);
      reset();

      // Clear success message after 10 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
        setSubmittedTicketId(null);
      }, 10000);
    } catch (error) {
      logError('Support request error:', error);
      setSubmitError(
        extractErrorMessage(
          error,
          'Failed to submit request. Please try again or contact us directly.',
        ),
      );
      setSubmittedTicketId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const supportCategories: Array<{ value: SupportFormData['category']; label: string }> = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'billing', label: 'Billing & Account' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'bug', label: 'Bug Report' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          Help & Support
        </h1>
        <p className="text-muted-foreground">
          Get help with SiteProof or contact our support team.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to="/privacy-policy"
          className="rounded-lg border bg-card p-4 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Privacy Policy</h3>
              <p className="text-sm text-muted-foreground">How we protect your data</p>
            </div>
          </div>
        </Link>

        <Link
          to="/terms-of-service"
          className="rounded-lg border bg-card p-4 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Book className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Terms of Service</h3>
              <p className="text-sm text-muted-foreground">Usage terms and conditions</p>
            </div>
          </div>
        </Link>

        <a
          href="https://docs.siteproof.com.au"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border bg-card p-4 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <ExternalLink className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Documentation</h3>
              <p className="text-sm text-muted-foreground">User guides and tutorials</p>
            </div>
          </div>
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact Information */}
        <div className="rounded-lg border bg-card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <HeadphonesIcon className="h-5 w-5" />
              Contact Support
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Reach out to our support team directly.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Email Support</h3>
                <a
                  href={supportMailtoHref(contactInfo.email)}
                  className="text-primary hover:underline"
                >
                  {contactInfo.email}
                </a>
                <p className="text-sm text-muted-foreground mt-1">
                  For general inquiries and technical issues
                </p>
              </div>
            </div>

            {contactInfo.phone && (
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                  <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium">Phone Support</h3>
                  <a href={telHref(contactInfo.phone)} className="text-primary hover:underline">
                    {contactInfo.phoneLabel || contactInfo.phone}
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">{contactInfo.hours}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium">Response Times</h3>
                <ul className="text-sm text-muted-foreground space-y-1 mt-1">
                  <li>• Critical issues: {contactInfo.responseTime.critical}</li>
                  <li>• Standard issues: {contactInfo.responseTime.standard}</li>
                  <li>• General inquiries: {contactInfo.responseTime.general}</li>
                </ul>
              </div>
            </div>
          </div>

          {contactInfo.emergencyPhone && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Emergency Support</h3>
              <p className="text-sm text-muted-foreground">
                For critical production issues affecting your entire organization, please call our
                emergency hotline:{' '}
                <a
                  href={telHref(contactInfo.emergencyPhone)}
                  className="text-primary hover:underline"
                >
                  {contactInfo.emergencyPhone}
                </a>
              </p>
            </div>
          )}

          {contactInfo.address && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Support Office</h3>
              <p className="text-sm text-muted-foreground">{contactInfo.address}</p>
            </div>
          )}
        </div>

        {/* Support Request Form */}
        <div className="rounded-lg border bg-card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Submit Support Request
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Fill out the form below and we'll get back to you.
            </p>
          </div>

          {submitSuccess && (
            <div
              role="status"
              className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            >
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Request submitted successfully!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  We'll respond to your request within 24-48 hours.
                </p>
                {submittedTicketId && (
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Reference: <span className="font-medium">{submittedTicketId}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            >
              <p className="text-sm text-red-800 dark:text-red-200">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="support-category" className="mb-1">
                Category
              </Label>
              <NativeSelect
                id="support-category"
                {...register('category')}
                className={errors.category ? 'border-destructive' : ''}
              >
                {supportCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </NativeSelect>
              {errors.category && (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {errors.category.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="support-subject" className="mb-1">
                Subject
              </Label>
              <Input
                id="support-subject"
                type="text"
                maxLength={160}
                {...register('subject')}
                placeholder="Brief description of your issue"
                className={errors.subject ? 'border-destructive' : ''}
              />
              {errors.subject && (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {errors.subject.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="support-message" className="mb-1">
                Message
              </Label>
              <Textarea
                id="support-message"
                maxLength={5000}
                {...register('message')}
                placeholder="Please describe your issue or question in detail..."
                rows={5}
                className={`resize-none ${errors.message ? 'border-destructive' : ''}`}
              />
              {errors.message && (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {errors.message.message}
                </p>
              )}
            </div>

            {user && (
              <div className="text-sm text-muted-foreground">
                Sending as: <span className="font-medium">{user.email}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !subject?.trim() || !message?.trim()}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* FAQ Preview */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg bg-muted/50">
            <h3 className="font-medium mb-1">How do I create a new lot?</h3>
            <p className="text-sm text-muted-foreground">
              Navigate to your project's Lots page and click "Create Lot". Fill in the required
              information including chainage, offset, and layer details.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <h3 className="font-medium mb-1">How do I export my data?</h3>
            <p className="text-sm text-muted-foreground">
              Go to Settings → Privacy & Data → Export My Data. Your data will be downloaded as a
              JSON file containing all your records.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <h3 className="font-medium mb-1">How do I approve a hold point?</h3>
            <p className="text-sm text-muted-foreground">
              Find the lot with a pending hold point, click on it, and use the "Approve Hold Point"
              button. You may need appropriate permissions.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <h3 className="font-medium mb-1">How do I invite team members?</h3>
            <p className="text-sm text-muted-foreground">
              Go to Project Settings → Users and click "Invite User". Enter their email and select
              their role. They'll receive an invitation email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
