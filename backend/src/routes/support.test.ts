import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { supportRouter } from './support.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { supportRateLimiter } from '../middleware/rateLimiter.js';
import { clearEmailQueue, getQueuedEmails } from '../lib/email.js';

const app = express();
app.use(express.json());
app.use('/api/support', supportRouter);
app.use(errorHandler);

const rateLimitedApp = express();
rateLimitedApp.use(express.json());
rateLimitedApp.post('/api/support/request', supportRateLimiter);
rateLimitedApp.post('/api/support/client-error', supportRateLimiter);
rateLimitedApp.use('/api/support', supportRouter);
rateLimitedApp.use(errorHandler);

const ORIGINAL_ENV = { ...process.env };

describe('Support API', () => {
  beforeEach(() => {
    clearEmailQueue();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('POST /api/support/request', () => {
    it('should submit support request with valid data', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Need help with lot creation',
        message: 'I am unable to create a new lot in my project. The form keeps showing an error.',
        category: 'technical',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('successfully');
      expect(res.body.ticketId).toBeDefined();
      expect(res.body.ticketId).toMatch(/^SP-/);

      const emails = getQueuedEmails();
      expect(emails).toHaveLength(1);
      const email = emails[0]!;
      expect(email.to).toBe('support@siteproof.com.au');
      expect(email.subject).toContain(res.body.ticketId);
      expect(email.text).toContain('Need help with lot creation');
      expect(email.text).toContain('technical');
    });

    it('should submit support request with user email', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Billing question',
        message: 'I have a question about my invoice for last month.',
        category: 'billing',
        userEmail: 'user@example.com',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ticketId).toBeDefined();
      expect(getQueuedEmails()[0]!.text).toContain('User email: user@example.com');
    });

    it('should reject request without subject', async () => {
      const res = await request(app).post('/api/support/request').send({
        message: 'This is a message without a subject',
        category: 'general',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject request without message', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Subject without message',
        category: 'general',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject request with empty subject', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: '',
        message: 'This has an empty subject',
        category: 'general',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject request with empty message', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Valid subject',
        message: '',
        category: 'general',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should accept request without category', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Request without category',
        message: 'Category is optional',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.category).toBe('general');
      expect(getQueuedEmails()[0]!.text).toContain('Category: general');
    });

    it('should accept request without user email', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Anonymous support request',
        message: 'This request does not include user email',
        category: 'general',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should trim submitted support request fields before sending', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: '  Subject with spaces  ',
        message: '  Message with spaces  ',
        category: ' technical ',
        userEmail: '  user@example.com  ',
        userName: '  Jane User  ',
      });

      expect(res.status).toBe(200);
      const email = getQueuedEmails()[0]!;
      expect(email.text).toContain('Subject: Subject with spaces');
      expect(email.text).toContain('Message:\nMessage with spaces');
      expect(email.text).toContain('Category: technical');
      expect(email.text).toContain('User email: user@example.com');
      expect(email.text).toContain('User name: Jane User');
    });

    it('should sanitize single-line support fields before sending email', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Need help\r\nCategory: billing',
        message: 'Line one\nLine two',
        category: 'technical',
        userEmail: 'user@example.com',
        userName: 'Jane\r\nTicket: spoofed',
      });

      expect(res.status).toBe(200);
      const email = getQueuedEmails()[0]!;
      expect(email.subject).toContain('Need help Category: billing');
      expect(email.text).toContain('Subject: Need help Category: billing');
      expect(email.text).toContain('User name: Jane Ticket: spoofed');
      expect(email.text).toContain('Message:\nLine one\nLine two');
      expect(email.text).not.toContain('Subject: Need help\r\nCategory: billing');
      expect(email.text).not.toContain('User name: Jane\r\nTicket: spoofed');
    });

    it('should reject whitespace-only subject and message', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: '   ',
        message: '\n\t',
        category: 'general',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
      expect(getQueuedEmails()).toHaveLength(0);
    });

    it('should reject invalid categories', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Invalid category',
        message: 'This category is not supported',
        category: 'sales',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid support category');
      expect(getQueuedEmails()).toHaveLength(0);
    });

    it('should reject invalid user email', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Invalid email',
        message: 'The email address is malformed',
        category: 'general',
        userEmail: 'not-an-email',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('valid email');
      expect(getQueuedEmails()).toHaveLength(0);
    });

    it('should reject oversized support requests', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'a'.repeat(161),
          message: 'Valid message',
          category: 'general',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('160 characters or less');
      expect(getQueuedEmails()).toHaveLength(0);
    });

    it('should rate limit repeated public support request submissions', async () => {
      process.env.SUPPORT_RATE_LIMIT_MAX = '2';
      const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
      const payload = {
        subject: 'Repeated support request',
        message: 'The user needs help with repeated support request submissions.',
        category: 'technical',
      };

      const first = await request(rateLimitedApp)
        .post('/api/support/request')
        .set('X-Forwarded-For', testIp)
        .send(payload);
      const second = await request(rateLimitedApp)
        .post('/api/support/request')
        .set('X-Forwarded-For', testIp)
        .send(payload);
      const third = await request(rateLimitedApp)
        .post('/api/support/request')
        .set('X-Forwarded-For', testIp)
        .send(payload);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe('RATE_LIMITED');
      expect(third.body.error.message).toContain('Too many support requests');
    });
  });

  describe('POST /api/support/request security', () => {
    it('should not perform user lookups from unauthenticated endpoint', async () => {
      // Support requests should work without user enumeration
      const res = await request(app).post('/api/support/request').send({
        subject: 'Test without user lookup',
        message: 'This should succeed without querying the user table',
        category: 'general',
        userEmail: 'nonexistent@example.com',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/support/client-error', () => {
    it('should accept fatal frontend error reports and notify support', async () => {
      const res = await request(app).post('/api/support/client-error').send({
        name: 'TypeError',
        message: 'Cannot read properties of undefined',
        stack: 'TypeError: Cannot read properties of undefined\n    at Component',
        componentStack: 'at ProjectDashboard',
        path: '/dashboard?[redacted]',
        userAgent: 'Mozilla/5.0',
        timestamp: '2026-05-10T01:02:03.000Z',
      });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.reportId).toMatch(/^SP-ERR-\d{8}-[A-F0-9]{8}$/);

      const emails = getQueuedEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0]!.subject).toContain('Client error: TypeError');
      expect(emails[0]!.text).toContain('Report ID:');
      expect(emails[0]!.text).toContain('Path: /dashboard?[redacted]');
      expect(emails[0]!.text).toContain('React component stack:');
    });

    it('should redact secrets from client error support emails', async () => {
      const res = await request(app).post('/api/support/client-error').send({
        name: 'FetchError',
        message: 'Request failed token=message_secret Authorization=Bearer message_jwt',
        stack: 'FetchError: failed\n    at https://app.example/reset?token=stack_secret',
        componentStack: 'at SettingsPanel authorization: Bearer component_jwt',
        path: '/settings?token=path_secret',
        userAgent: 'Mozilla/5.0 ApiKey ua_secret',
        timestamp: '2026-05-10T01:02:03.000Z',
      });

      expect(res.status).toBe(202);

      const email = getQueuedEmails()[0]!;
      const emailText = `${email.subject}\n${email.text}`;
      expect(emailText).toContain('token=[REDACTED]');
      expect(emailText).toContain('Authorization=[REDACTED]');
      expect(emailText).toContain('ApiKey [REDACTED]');
      expect(emailText).not.toContain('message_secret');
      expect(emailText).not.toContain('message_jwt');
      expect(emailText).not.toContain('stack_secret');
      expect(emailText).not.toContain('component_jwt');
      expect(emailText).not.toContain('path_secret');
      expect(emailText).not.toContain('ua_secret');
    });

    it('should reject malformed client error reports', async () => {
      const res = await request(app).post('/api/support/client-error').send({
        message: '',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Error message is required');
      expect(getQueuedEmails()).toHaveLength(0);
    });

    it('should rate limit repeated client error reports', async () => {
      process.env.SUPPORT_RATE_LIMIT_MAX = '1';
      const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
      const payload = {
        message: 'Repeated fatal UI error',
        path: '/dashboard',
      };

      const first = await request(rateLimitedApp)
        .post('/api/support/client-error')
        .set('X-Forwarded-For', testIp)
        .send(payload);
      const second = await request(rateLimitedApp)
        .post('/api/support/client-error')
        .set('X-Forwarded-For', testIp)
        .send(payload);

      expect(first.status).toBe(202);
      expect(second.status).toBe(429);
      expect(second.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /api/support/contact', () => {
    it('should return support contact information', async () => {
      const res = await request(app).get('/api/support/contact');

      expect(res.status).toBe(200);
      expect(res.body.email).toBeDefined();
      expect(res.body.hours).toBeDefined();
      expect(res.body.responseTime).toBeDefined();
      expect(res.body.address).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain('123 Construction Street');
    });

    it('should include proper email format', async () => {
      const res = await request(app).get('/api/support/contact');

      expect(res.status).toBe(200);
      expect(res.body.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should include response time information', async () => {
      const res = await request(app).get('/api/support/contact');

      expect(res.status).toBe(200);
      expect(res.body.responseTime.critical).toBeDefined();
      expect(res.body.responseTime.standard).toBeDefined();
      expect(res.body.responseTime.general).toBeDefined();
    });

    it('should use configured phone and address values when provided', async () => {
      process.env.SUPPORT_PHONE = '+61 2 5550 0100';
      process.env.SUPPORT_PHONE_LABEL = 'Support Desk';
      process.env.SUPPORT_EMERGENCY_PHONE = '+61 2 5550 0199';
      process.env.SUPPORT_ADDRESS = 'Configured support office';
      process.env.SUPPORT_HOURS = '24/7';

      const res = await request(app).get('/api/support/contact');

      expect(res.status).toBe(200);
      expect(res.body.phone).toBe('+61 2 5550 0100');
      expect(res.body.phoneLabel).toBe('Support Desk');
      expect(res.body.emergencyPhone).toBe('+61 2 5550 0199');
      expect(res.body.address).toBe('Configured support office');
      expect(res.body.hours).toBe('24/7');
    });

    it('should return consistent contact information', async () => {
      const res1 = await request(app).get('/api/support/contact');
      const res2 = await request(app).get('/api/support/contact');

      expect(res1.body).toEqual(res2.body);
    });
  });

  describe('Support request ticket ID generation', () => {
    it('should generate unique ticket IDs', async () => {
      const res1 = await request(app).post('/api/support/request').send({
        subject: 'First request',
        message: 'First message',
      });

      const res2 = await request(app).post('/api/support/request').send({
        subject: 'Second request',
        message: 'Second message',
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.ticketId).not.toBe(res2.body.ticketId);
    });

    it('should use stable support ticket ID format', async () => {
      const res = await request(app).post('/api/support/request').send({
        subject: 'Ticket ID test',
        message: 'Testing ticket ID format',
      });

      expect(res.status).toBe(200);
      expect(res.body.ticketId).toMatch(/^SP-\d{8}-[A-F0-9]{8}$/);
    });
  });
});
