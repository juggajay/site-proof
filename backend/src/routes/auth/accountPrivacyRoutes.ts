import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createAccountDeletionRouter } from './accountDeletionRoutes.js';

type NormalizePasswordInput = (value: unknown, fieldName?: string) => string;

type CreateAccountPrivacyRouterDependencies = {
  prisma: PrismaClient;
  normalizePasswordInput: NormalizePasswordInput;
};

const DATA_EXPORT_FILENAME_MAX_LENGTH = 180;

function sanitizeDownloadFilenameSegment(
  value: string,
  maxLength = DATA_EXPORT_FILENAME_MAX_LENGTH,
): string {
  return value
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 || code > 126 || '<>:"/\\|?*'.includes(char) ? '_' : char;
    })
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, maxLength);
}

export function getSafeDataExportFilename(email: string, date = new Date()): string {
  const prefix = 'siteproof-data-export-';
  const suffix = `-${date.toISOString().split('T')[0]}.json`;
  const maxEmailLength = Math.max(
    1,
    DATA_EXPORT_FILENAME_MAX_LENGTH - prefix.length - suffix.length,
  );
  const safeEmail = sanitizeDownloadFilenameSegment(email, maxEmailLength) || 'user';

  return `${prefix}${safeEmail}${suffix}`;
}

export function createAccountPrivacyRouter({
  prisma,
  normalizePasswordInput,
}: CreateAccountPrivacyRouterDependencies) {
  const accountPrivacyRouter = Router();

  // GET /api/auth/export-data - GDPR compliant data export
  // Returns all user data in a portable JSON format
  accountPrivacyRouter.get(
    '/export-data',
    asyncHandler(async (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw AppError.unauthorized();
      }

      const token = authHeader.substring(7);
      // Import verifyToken dynamically to avoid circular import
      const { verifyToken } = await import('../../lib/auth.js');
      const userData = await verifyToken(token);

      if (!userData) {
        throw AppError.unauthorized('Invalid token');
      }

      const userId = userData.userId || userData.id;

      // Fetch all user-related data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              abn: true,
              address: true,
            },
          },
          projectUsers: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  projectNumber: true,
                  status: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw AppError.notFound('User');
      }

      const [
        ncrs,
        diaries,
        itpCompletions,
        testResults,
        lotsCreated,
        auditLogs,
        commentsAuthored,
        uploadedDocuments,
        notifications,
        notificationEmailPreference,
        notificationDigestItems,
        notificationAlerts,
        consentRecords,
        apiKeys,
        pushSubscriptions,
        scheduledReports,
        webhookConfigsCreated,
        documentSignedUrlTokens,
        syncQueueItems,
      ] = await Promise.all([
        prisma.nCR.findMany({
          where: {
            OR: [{ raisedById: userId }, { responsibleUserId: userId }],
          },
          select: {
            id: true,
            ncrNumber: true,
            description: true,
            status: true,
            severity: true,
            category: true,
            raisedAt: true,
            closedAt: true,
          },
        }),
        prisma.dailyDiary.findMany({
          where: { submittedById: userId },
          select: {
            id: true,
            date: true,
            weatherConditions: true,
            temperatureMin: true,
            temperatureMax: true,
            rainfallMm: true,
            generalNotes: true,
            status: true,
            submittedAt: true,
            createdAt: true,
          },
        }),
        prisma.iTPCompletion.findMany({
          where: { completedById: userId },
          select: {
            id: true,
            completedAt: true,
            notes: true,
            checklistItem: {
              select: {
                description: true,
                sequenceNumber: true,
              },
            },
          },
        }),
        prisma.testResult.findMany({
          where: { enteredById: userId },
          select: {
            id: true,
            testType: true,
            testDate: true,
            resultValue: true,
            resultUnit: true,
            passFail: true,
            laboratoryName: true,
            laboratoryReportNumber: true,
            createdAt: true,
          },
        }),
        prisma.lot.findMany({
          where: { createdById: userId },
          select: {
            id: true,
            lotNumber: true,
            description: true,
            activityType: true,
            status: true,
            createdAt: true,
          },
        }),
        prisma.auditLog.findMany({
          where: { userId },
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            changes: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }),
        prisma.comment.findMany({
          where: { authorId: userId },
          select: {
            id: true,
            entityType: true,
            entityId: true,
            parentId: true,
            content: true,
            isEdited: true,
            editedAt: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            attachments: {
              select: {
                id: true,
                filename: true,
                fileUrl: true,
                fileSize: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.document.findMany({
          where: { uploadedById: userId },
          select: {
            id: true,
            projectId: true,
            lotId: true,
            documentType: true,
            category: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            gpsLatitude: true,
            gpsLongitude: true,
            captureTimestamp: true,
            aiClassification: true,
            caption: true,
            tags: true,
            isFavourite: true,
            version: true,
            parentDocumentId: true,
            isLatestVersion: true,
            createdAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        }),
        prisma.notification.findMany({
          where: { userId },
          select: {
            id: true,
            projectId: true,
            type: true,
            title: true,
            message: true,
            linkUrl: true,
            isRead: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notificationEmailPreference.findUnique({
          where: { userId },
          select: {
            enabled: true,
            mentions: true,
            mentionsTiming: true,
            ncrAssigned: true,
            ncrAssignedTiming: true,
            ncrStatusChange: true,
            ncrStatusChangeTiming: true,
            holdPointReminder: true,
            holdPointReminderTiming: true,
            holdPointRelease: true,
            holdPointReleaseTiming: true,
            commentReply: true,
            commentReplyTiming: true,
            scheduledReports: true,
            scheduledReportsTiming: true,
            dailyDigest: true,
            diaryReminder: true,
            diaryReminderTiming: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.notificationDigestItem.findMany({
          where: { userId },
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
            projectName: true,
            linkUrl: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notificationAlert.findMany({
          where: { assignedToId: userId },
          select: {
            id: true,
            type: true,
            severity: true,
            title: true,
            message: true,
            entityId: true,
            entityType: true,
            projectId: true,
            createdAt: true,
            resolvedAt: true,
            escalatedAt: true,
            escalationLevel: true,
            escalatedTo: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.consentRecord.findMany({
          where: { userId },
          select: {
            id: true,
            consentType: true,
            version: true,
            granted: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.apiKey.findMany({
          where: { userId },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            scopes: true,
            lastUsedAt: true,
            expiresAt: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.pushSubscription.findMany({
          where: { userId },
          select: {
            id: true,
            endpoint: true,
            userAgent: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.scheduledReport.findMany({
          where: { createdById: userId },
          select: {
            id: true,
            projectId: true,
            reportType: true,
            frequency: true,
            dayOfWeek: true,
            dayOfMonth: true,
            timeOfDay: true,
            recipients: true,
            isActive: true,
            lastSentAt: true,
            nextRunAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.webhookConfig.findMany({
          where: { createdById: userId },
          select: {
            id: true,
            companyId: true,
            url: true,
            events: true,
            enabled: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.documentSignedUrlToken.findMany({
          where: { userId },
          select: {
            id: true,
            documentId: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.syncQueue.findMany({
          where: { userId },
          select: {
            id: true,
            deviceId: true,
            entityType: true,
            entityId: true,
            action: true,
            payload: true,
            status: true,
            createdAt: true,
            syncedAt: true,
            conflictResolution: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Build the export data structure
      const exportData = {
        exportedAt: new Date().toISOString(),
        exportVersion: '1.1',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          role: user.roleInCompany,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          tosAcceptedAt: user.tosAcceptedAt,
          tosVersion: user.tosVersion,
          twoFactorEnabled: user.twoFactorEnabled,
          oauthProvider: user.oauthProvider,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
              abn: user.company.abn,
              address: user.company.address,
            }
          : null,
        projectMemberships: user.projectUsers.map((pu) => ({
          role: pu.role,
          invitedAt: pu.invitedAt,
          acceptedAt: pu.acceptedAt,
          status: pu.status,
          project: pu.project,
        })),
        ncrs: ncrs,
        dailyDiaries: diaries.map((d) => ({
          id: d.id,
          date: d.date,
          weatherConditions: d.weatherConditions,
          temperatureMin: d.temperatureMin,
          temperatureMax: d.temperatureMax,
          rainfallMm: d.rainfallMm,
          notes: d.generalNotes,
          status: d.status,
          submittedAt: d.submittedAt,
          createdAt: d.createdAt,
        })),
        itpCompletions: itpCompletions.map((c) => ({
          id: c.id,
          completedAt: c.completedAt,
          notes: c.notes,
          checklistItemDescription: c.checklistItem?.description,
          checklistItemSequence: c.checklistItem?.sequenceNumber,
        })),
        testResults: testResults,
        lotsCreated: lotsCreated,
        commentsAuthored: commentsAuthored,
        uploadedDocuments: uploadedDocuments,
        notifications: notifications,
        notificationEmailPreference: notificationEmailPreference,
        notificationDigestItems: notificationDigestItems,
        notificationAlerts: notificationAlerts,
        consentRecords: consentRecords,
        apiKeys: apiKeys,
        pushSubscriptions: pushSubscriptions,
        scheduledReports: scheduledReports,
        webhookConfigsCreated: webhookConfigsCreated,
        documentSignedUrlTokens: documentSignedUrlTokens,
        syncQueueItems: syncQueueItems,
        activityLog: auditLogs,
      };

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${getSafeDataExportFilename(user.email)}"`,
      );

      res.json(exportData);
    }),
  );

  accountPrivacyRouter.use(createAccountDeletionRouter({ prisma, normalizePasswordInput }));

  return accountPrivacyRouter;
}
