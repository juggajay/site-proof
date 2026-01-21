# Security Documentation

This document describes the security measures implemented in SiteProof.

## Authentication

### Password Hashing
- **Algorithm:** bcrypt with 12 rounds
- **Password Requirements:**
  - Minimum 12 characters
  - Must contain uppercase letters
  - Must contain lowercase letters
  - Must contain numbers
  - Must contain special characters

### JWT Authentication
- Configurable token expiry (default: 24 hours)
- Token invalidation on logout
- Secure token storage guidance in frontend

### Two-Factor Authentication (Optional)
- TOTP-based 2FA using authenticator apps
- Encrypted secret storage using AES-256-GCM

## Rate Limiting

### Login Protection
- Maximum 10 login attempts per minute per IP
- 15-minute account lockout after 5 consecutive failed attempts
- Lockout counter resets on successful login

### API Rate Limiting
- 100 requests per minute per authenticated user
- Configurable limits per endpoint category

## Data Protection

### Encryption
- **2FA Secrets:** AES-256-GCM encryption at rest
- **Encryption Key:** 32-byte key stored in ENCRYPTION_KEY environment variable
- **Passwords:** bcrypt one-way hashing (not reversible)

### Database Security
- Parameterized queries via Prisma ORM (SQL injection prevention)
- No raw SQL queries with user input
- Database connection over encrypted channels (PostgreSQL)

### Frontend Security
- React's automatic XSS prevention through JSX escaping
- Content Security Policy headers recommended
- Secure cookie configuration for authentication tokens

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** disclose the vulnerability publicly
2. Email security concerns to the development team
3. Include detailed steps to reproduce the issue
4. Allow reasonable time for the team to address the issue

We take all security reports seriously and will respond promptly to verified vulnerabilities.

## Security Best Practices for Deployment

1. Always use HTTPS in production
2. Set strong, unique values for JWT_SECRET and ENCRYPTION_KEY
3. Use PostgreSQL in production with encrypted connections
4. Keep Node.js and all dependencies up to date
5. Enable rate limiting at the reverse proxy level (nginx/cloudflare)
6. Implement proper CORS configuration for your domain
7. Use secure, HTTP-only cookies for sensitive tokens
8. Enable audit logging for sensitive operations
