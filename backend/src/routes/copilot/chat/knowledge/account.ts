import type { PageKnowledge } from './types.js';

export const ACCOUNT_PAGE_KNOWLEDGE = [
  {
    route: 'settings',
    title: 'Personal Settings',
    keywords: [
      'theme',
      'date format',
      'timezone',
      'email preferences',
      'mfa',
      'export my data',
      'delete account',
    ],
    roles: 'Any authenticated user.',
    surface: 'office',
    body: `Settings controls this user's own CIVOS preferences and security, not project configuration.

Appearance buttons choose Light, Dark or System theme. Regional Settings selects date format and timezone. Email Notifications has a master enable switch plus per-event toggles/timing; **Send test email** checks delivery. Push Notifications manages browser permission and subscription. MFA offers **Set up MFA**, QR/secret display, Copy secret, six-digit Verify, Copy backup codes and **Disable MFA** with confirmation.

The Password card links to Profile. **Export Your Data** downloads a portable account export. **Delete Account** opens a destructive confirmation and may be blocked for a company owner until ownership is transferred. **Leave Company** removes this membership after confirmation and has the same owner safeguard. About links identify the app/version and policy pages.`,
  },
  {
    route: 'company-settings',
    title: 'Company Settings',
    keywords: [
      'company logo',
      'team members',
      'api keys',
      'webhooks',
      'billing',
      'xero export',
      'transfer ownership',
    ],
    roles: 'Owner and admin; billing and ownership transfer are owner-only.',
    surface: 'office',
    body: `Company Settings manages the head-contractor organisation rather than one project.

Company Information edits name, ABN/contact/address and report logo; Upload/Remove logo changes branding and **Save Settings** commits it. Team Members **Invite** sends a company invitation, role selectors change company roles, and Remove revokes company membership after confirmation.

API Keys: **Create API key** chooses read/read-write scope and expiry, then reveals the secret once for Copy/Done; Revoke disables a key. Webhooks: **Create webhook** chooses URL/events; Enable/Disable, Test, Regenerate secret and Delete are explicit actions with confirmations. Xero invoice export saves account/code/tax defaults used by exports. Billing/plan controls and support links are owner-only. **Transfer Ownership** selects an eligible active member and confirms the irreversible role transfer. Retry reloads failed sections.`,
  },
  {
    route: 'profile',
    title: 'Profile',
    keywords: [
      'edit profile',
      'avatar',
      'change password',
      'logout all devices',
      'personal details',
    ],
    roles: 'Any authenticated user.',
    surface: 'office',
    body: `Profile shows and edits the signed-in user's identity.

**Edit Profile** opens name/contact fields and avatar controls. **Change avatar** chooses an image; Upload applies it and Remove clears it. **Save Changes** commits the profile. **Change Password** opens current/new/confirm password fields and submits only when valid. **Log out all devices** revokes other sessions after confirmation. These actions affect the user account, not company or project roles.`,
  },
  {
    route: 'notifications',
    title: 'Notifications',
    keywords: [
      'mark all read',
      'unread filter',
      'delete notification',
      'load more',
      'notification settings',
    ],
    roles: 'Any authenticated user.',
    surface: 'office',
    body: `Notifications is this user's inbox for assignments, mentions, approvals and workflow events.

Filter buttons switch between All and Unread. **Mark all read** clears unread state and is disabled when there is nothing to mark. Opening a notification marks it read and follows its validated in-app link. **Delete notification** removes only that inbox item. **Load more** fetches older items. **Notification settings** opens Personal Settings; Retry reloads after an error.`,
  },
  {
    route: 'docs',
    title: 'In-app Documentation',
    keywords: [
      'documentation topics',
      'start here',
      'quick reference',
      'field notes',
      'contact support',
    ],
    roles: 'Any authenticated user.',
    surface: 'office',
    body: `Documentation explains the shipped CIVOS workflows by topic.

Start-here cards and the contents list jump to a documentation section. Section links open the relevant in-app page where one exists. **Contact Support** opens Support; **Go to Projects** returns to project work. Quick-reference links jump to common concepts. This is general workflow guidance; page-specific button questions are better answered from the UI guide.`,
  },
  {
    route: 'support',
    title: 'Support',
    keywords: ['support ticket', 'bug report', 'feature request', 'email support', 'faq'],
    roles: 'Any authenticated user.',
    surface: 'office',
    body: `Support provides verified support channels, policy links, FAQs and the support request form.

Privacy Policy, Terms and Documentation cards open those resources. The form chooses General Inquiry, Technical Issue, Billing & Account, Feature Request or Bug Report, then captures subject and message; **Send/Submit request** is disabled until required fields are complete and while sending. Email/phone controls use the published support details. FAQ entries are explanatory, not actions.`,
  },
  {
    route: 'audit-log',
    title: 'Audit Log',
    keywords: [
      'audit filters',
      'export audit',
      'view details',
      'actor action entity',
      'previous next',
    ],
    roles:
      'Owner, admin, project manager and project-scoped quality manager; results are access-scoped.',
    surface: 'office',
    body: `Audit Log records critical workflow, security and administration events visible to the user's scope.

**Export** downloads the filtered audit data. **Filters** expands project, actor, action/entity and date controls; **Clear filters** resets them. Selecting **View details** opens the event metadata and before/after detail available for that event; Close dismisses it. Previous/Next pages through results. Retry reloads the query, and Dismiss hides a non-fatal warning. Quality managers see only permitted project-scoped events rather than the whole company log.`,
  },
] satisfies readonly PageKnowledge[];
