import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger, getPerformanceMetrics } from './middleware/requestLogger.js';
import { rateLimiter, authRateLimiter, supportRateLimiter } from './middleware/rateLimiter.js';
import { requireAuth, requireRole } from './middleware/authMiddleware.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { lotsRouter } from './routes/lots.js';
import { lotAssignmentsRouter } from './routes/lotAssignments.js';
import { ncrsRouter } from './routes/ncrs/index.js';
import { subcontractorsRouter } from './routes/subcontractors.js';
import { reportsRouter } from './routes/reports.js';
import { testResultsRouter } from './routes/testResults.js';
import { itpRouter } from './routes/itp/index.js';
import diaryRouter from './routes/diary/index.js';
import claimsRouter from './routes/claims.js';
import { holdpointsRouter } from './routes/holdpoints.js';
import { docketsRouter } from './routes/dockets.js';
import { companyRouter } from './routes/company.js';
import { supportRouter } from './routes/support.js';
import { auditLogRouter } from './routes/auditLog.js';
import { commentsRouter } from './routes/comments.js';
import { notificationsRouter } from './routes/notifications.js';
import documentsRouter from './routes/documents.js';
import { drawingsRouter } from './routes/drawings.js';
import { dashboardRouter } from './routes/dashboard.js';
import apiKeysRouter, { authenticateApiKey } from './routes/apiKeys.js';
import { consentRouter } from './routes/consent.js';
import { mfaRouter } from './routes/mfa.js';
import { oauthRouter } from './routes/oauth.js';
import webhooksRouter from './routes/webhooks.js';
import { pushNotificationsRouter } from './routes/pushNotifications.js';
import {
  buildBackendUrl,
  getExpressTrustProxySetting,
  getBackendUrl,
  isCorsOriginAllowed,
  validateRuntimeConfig,
} from './lib/runtimeConfig.js';
import {
  privateUploadGuard,
  uploadCacheHeaders,
  uploadsStaticHandler,
} from './lib/staticUploads.js';
import { httpsRedirect } from './middleware/httpsRedirect.js';
import { createReadinessHandler } from './lib/readiness.js';
import { logError, logInfo } from './lib/serverLogger.js';
import { startScheduledReportWorker } from './lib/scheduledReports.js';
import { startNotificationDigestWorker } from './lib/notificationJobs.js';
import { startNotificationAutomationWorker } from './lib/notificationAutomation.js';

export async function startServer(): Promise<void> {
  const app = express();
  const PORT = process.env.PORT || 3001;
  const TRUST_PROXY = process.env.TRUST_PROXY;
  let isShuttingDown = false;

  validateRuntimeConfig();

  const trustProxySetting = getExpressTrustProxySetting(TRUST_PROXY);
  if (trustProxySetting !== undefined) {
    app.set('trust proxy', trustProxySetting);
  }

  // Security middleware
  // Feature #762: HTTPS enforcement and HSTS
  app.use(
    helmet({
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // Feature #762: HTTPS redirect in production
  if (process.env.NODE_ENV === 'production') {
    app.use(httpsRedirect);
  }
  // Environment-based CORS configuration
  app.use(
    cors({
      origin: function (origin, callback) {
        callback(null, isCorsOriginAllowed(origin));
      },
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100 }));

  // Request logging
  app.use(requestLogger);

  // Rate limiting (Feature #742)
  app.use(rateLimiter);

  // Serve public upload folders directly. Protected document/drawing/certificate
  // folders are denied in production and must be accessed through signed routes.
  // Feature #755: CDN-friendly cache headers for static assets
  app.use('/uploads', privateUploadGuard, uploadCacheHeaders, uploadsStaticHandler());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get(
    '/ready',
    createReadinessHandler(() => isShuttingDown),
  );

  // Feature #751: Performance metrics endpoint (admin only)
  app.get('/api/metrics', requireAuth, requireRole(['owner', 'admin']), (_req, res) => {
    const metrics = getPerformanceMetrics();
    res.json(metrics);
  });

  // Feature #747: API key authentication middleware (checked before JWT)
  app.use(authenticateApiKey);

  // REST API routes
  // Auth routes have stricter rate limiting to prevent brute force attacks
  app.use('/api/auth', authRateLimiter, authRouter);
  app.use('/api/api-keys', apiKeysRouter); // Feature #747: API key management
  app.use('/api/projects', projectsRouter);
  app.use('/api/lots', lotsRouter);
  app.use('/api/lots', lotAssignmentsRouter);
  app.use('/api/ncrs', ncrsRouter);
  app.use('/api/subcontractors', subcontractorsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/test-results', testResultsRouter);
  app.use('/api/itp', itpRouter);
  app.use('/api/diary', diaryRouter);
  app.use('/api/projects', claimsRouter);
  app.use('/api/holdpoints', holdpointsRouter);
  app.use('/api/dockets', docketsRouter);
  app.use('/api/company', companyRouter);
  app.post('/api/support/request', supportRateLimiter);
  app.post('/api/support/client-error', supportRateLimiter);
  app.use('/api/support', supportRouter);
  app.use('/api/audit-logs', auditLogRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/drawings', drawingsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/consent', consentRouter); // Feature #776: Privacy consent tracking
  app.use('/api/mfa', mfaRouter); // Feature #22, #420, #421: MFA/2FA support
  app.use('/api/auth', oauthRouter); // Feature #414, #1004: Google OAuth support
  app.use('/api/webhooks', webhooksRouter); // Feature #746: Webhook external integration
  app.use('/api/push', pushNotificationsRouter); // Feature #657: Mobile push notifications

  // Error handling
  app.use(errorHandler);

  // Start server
  const server = app.listen(PORT, () => {
    logInfo(`SiteProof API server running on ${getBackendUrl()}`);
    logInfo(`Auth API: ${buildBackendUrl('/api/auth')}`);
    logInfo(`Readiness check: ${buildBackendUrl('/ready')}`);
  });
  const scheduledReportWorker = startScheduledReportWorker();
  const notificationDigestWorker = startNotificationDigestWorker();
  const notificationAutomationWorker = startNotificationAutomationWorker();

  // Feature #757: Graceful shutdown handling
  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) {
      logInfo(`[${signal}] Shutdown already in progress...`);
      return;
    }

    isShuttingDown = true;
    logInfo(`[${signal}] Initiating graceful shutdown...`);

    // Set a hard timeout for shutdown (30 seconds)
    const shutdownTimeout = setTimeout(() => {
      logError('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, 30000);

    try {
      // Stop accepting new connections
      server.close((err) => {
        if (err) {
          logError('Error closing server:', err);
        } else {
          logInfo('Server closed, no longer accepting connections');
        }
      });

      scheduledReportWorker?.stop();
      notificationDigestWorker?.stop();
      notificationAutomationWorker?.stop();

      // Wait a bit for in-flight requests to complete
      logInfo('Waiting for in-flight requests to complete...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Close database connections (Prisma)
      logInfo('Closing database connections...');
      const { prisma } = await import('./lib/prisma.js');
      await prisma.$disconnect();

      logInfo('Graceful shutdown complete');
      clearTimeout(shutdownTimeout);
      process.exit(0);
    } catch (error) {
      logError('Error during shutdown:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  }

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
