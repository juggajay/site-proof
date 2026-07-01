import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { buildCompanyLogoDisplayUrl } from '../company/logoStorage.js';
import {
  buildClaimEvidencePackageResponse,
  buildClaimEvidenceReviewResponse,
} from './presentation.js';

type AuthUser = NonNullable<Express.Request['user']>;

interface ClaimEvidenceRouterDependencies {
  parseClaimRouteParam: (value: unknown, field: string) => string;
  requireCommercialProjectAccess: (user: AuthUser, projectId: string) => Promise<void>;
}

export function createClaimEvidenceRouter({
  parseClaimRouteParam,
  requireCommercialProjectAccess,
}: ClaimEvidenceRouterDependencies) {
  const evidenceRouter = Router();

  // GET /api/projects/:projectId/claims/:claimId/evidence-package - Get evidence package data for a claim
  evidenceRouter.get(
    '/:projectId/claims/:claimId/evidence-package',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const claimId = parseClaimRouteParam(req.params.claimId, 'claimId');
      const startTime = Date.now();
      await requireCommercialProjectAccess(req.user!, projectId);

      // Get the claim with all related data
      const claim = await prisma.progressClaim.findFirst({
        where: { id: claimId, projectId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
              clientName: true,
              state: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                },
              },
            },
          },
          preparedBy: {
            select: { id: true, fullName: true, email: true },
          },
          claimedLots: {
            include: {
              lot: {
                include: {
                  testResults: {
                    include: {
                      verifiedBy: {
                        select: { id: true, fullName: true, email: true },
                      },
                    },
                    orderBy: { sampleDate: 'desc' },
                  },
                  ncrLots: {
                    include: {
                      ncr: true,
                    },
                  },
                  documents: {
                    where: {
                      OR: [
                        { documentType: 'photo' },
                        { documentType: 'certificate' },
                        { documentType: 'test_result' },
                      ],
                    },
                    orderBy: { uploadedAt: 'desc' },
                  },
                  itpInstance: {
                    include: {
                      template: {
                        include: {
                          checklistItems: {
                            orderBy: { sequenceNumber: 'asc' },
                          },
                        },
                      },
                      completions: {
                        include: {
                          completedBy: {
                            select: { id: true, fullName: true, email: true },
                          },
                          verifiedBy: {
                            select: { id: true, fullName: true, email: true },
                          },
                          attachments: true,
                        },
                      },
                    },
                  },
                  holdPoints: true,
                  conformedBy: {
                    select: { id: true, fullName: true, email: true },
                  },
                },
              },
            },
            orderBy: {
              lot: {
                lotNumber: 'asc',
              },
            },
          },
        },
      });

      if (!claim) {
        throw AppError.notFound('Claim');
      }

      // Transform the data for the frontend PDF generator
      const evidencePackage = {
        claim: {
          id: claim.id,
          claimNumber: claim.claimNumber,
          periodStart: claim.claimPeriodStart.toISOString().split('T')[0],
          periodEnd: claim.claimPeriodEnd.toISOString().split('T')[0],
          status: claim.status,
          totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
          certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
          submittedAt: claim.submittedAt?.toISOString() || null,
          preparedBy: claim.preparedBy
            ? {
                name: claim.preparedBy.fullName || claim.preparedBy.email,
                email: claim.preparedBy.email,
              }
            : null,
          preparedAt: claim.preparedAt?.toISOString() || null,
        },
        company: {
          name: claim.project.company.name,
          logoUrl: buildCompanyLogoDisplayUrl(
            claim.project.company.id,
            claim.project.company.logoUrl,
          ),
        },
        project: {
          id: claim.project.id,
          name: claim.project.name,
          projectNumber: claim.project.projectNumber || null,
          clientName: claim.project.clientName || null,
          state: claim.project.state || 'NSW',
        },
        lots: claim.claimedLots.map((claimedLot) => {
          const lot = claimedLot.lot;
          const itpInstance = lot.itpInstance;

          return {
            id: lot.id,
            lotNumber: lot.lotNumber,
            description: lot.description || null,
            activityType: lot.activityType || null,
            chainageStart: lot.chainageStart ? Number(lot.chainageStart) : null,
            chainageEnd: lot.chainageEnd ? Number(lot.chainageEnd) : null,
            layer: lot.layer || null,
            areaZone: lot.areaZone || null,
            status: lot.status,
            conformedAt: lot.conformedAt?.toISOString() || null,
            conformedBy: lot.conformedBy
              ? {
                  name: lot.conformedBy.fullName || lot.conformedBy.email,
                  email: lot.conformedBy.email,
                }
              : null,
            claimAmount: claimedLot.amountClaimed ? Number(claimedLot.amountClaimed) : 0,
            percentComplete:
              claimedLot.percentageComplete === null ? 100 : Number(claimedLot.percentageComplete),

            // ITP data
            itp: itpInstance
              ? {
                  templateName: itpInstance.template.name,
                  checklistItems: itpInstance.template.checklistItems.map((item) => ({
                    id: item.id,
                    sequenceNumber: item.sequenceNumber,
                    description: item.description,
                    category: '',
                    responsibleParty: item.responsibleParty || '',
                    pointType: item.pointType,
                    isHoldPoint: item.pointType === 'hold_point',
                    evidenceRequired: item.evidenceRequired || '',
                  })),
                  completions: itpInstance.completions.map((c) => ({
                    checklistItemId: c.checklistItemId,
                    isCompleted: c.status === 'completed',
                    notes: c.notes || null,
                    completedAt: c.completedAt?.toISOString() || null,
                    completedBy: c.completedBy
                      ? {
                          name: c.completedBy.fullName || c.completedBy.email,
                          email: c.completedBy.email,
                        }
                      : null,
                    isVerified: c.verificationStatus === 'verified',
                    verifiedAt: c.verifiedAt?.toISOString() || null,
                    verifiedBy: c.verifiedBy
                      ? {
                          name: c.verifiedBy.fullName || c.verifiedBy.email,
                          email: c.verifiedBy.email,
                        }
                      : null,
                    attachmentCount: c.attachments?.length || 0,
                  })),
                }
              : null,

            // Hold Points (on lot level)
            holdPoints: lot.holdPoints.map((hp) => ({
              id: hp.id,
              description: hp.description || '',
              status: hp.status,
              releasedAt: hp.releasedAt?.toISOString() || null,
              releasedBy: hp.releasedByName
                ? {
                    name: hp.releasedByName,
                    organization: hp.releasedByOrg || null,
                  }
                : null,
            })),

            // Test results
            testResults: lot.testResults.map((test) => ({
              id: test.id,
              testType: test.testType,
              testRequestNumber: test.testRequestNumber || null,
              laboratoryName: test.laboratoryName || null,
              resultValue: test.resultValue ? Number(test.resultValue) : null,
              resultUnit: test.resultUnit || null,
              passFail: test.passFail || null,
              status: test.status,
              sampleDate: test.sampleDate?.toISOString() || null,
              resultDate: test.resultDate?.toISOString() || null,
              isVerified: test.status === 'verified',
              verifiedBy: test.verifiedBy
                ? {
                    name: test.verifiedBy.fullName || test.verifiedBy.email,
                    email: test.verifiedBy.email,
                  }
                : null,
            })),

            // NCRs (via ncrLots join table)
            ncrs: lot.ncrLots.map((ncrLot) => ({
              id: ncrLot.ncr.id,
              ncrNumber: ncrLot.ncr.ncrNumber,
              description: ncrLot.ncr.description,
              category: ncrLot.ncr.category,
              severity: ncrLot.ncr.severity,
              status: ncrLot.ncr.status,
              createdAt: ncrLot.ncr.createdAt.toISOString(),
              closedAt: ncrLot.ncr.closedAt?.toISOString() || null,
            })),

            // Documents/Photos
            documents: lot.documents.map((doc) => ({
              id: doc.id,
              filename: doc.filename,
              documentType: doc.documentType,
              caption: doc.caption || null,
              uploadedAt: doc.uploadedAt?.toISOString() || null,
            })),

            // Summary stats
            summary: {
              testResultCount: lot.testResults.length,
              passedTestCount: lot.testResults.filter((t) => t.passFail === 'pass').length,
              ncrCount: lot.ncrLots.length,
              openNcrCount: lot.ncrLots.filter(
                (nl) => !['closed', 'closed_concession'].includes(nl.ncr.status),
              ).length,
              photoCount: lot.documents.filter((d) => d.documentType === 'photo').length,
              itpCompletionPercentage: itpInstance
                ? Math.round(
                    (itpInstance.completions.filter((c) => c.status === 'completed').length /
                      Math.max(1, itpInstance.template.checklistItems.length)) *
                      100,
                  )
                : 0,
            },
          };
        }),

        // Overall summary
        summary: {
          totalLots: claim.claimedLots.length,
          totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
          totalTestResults: claim.claimedLots.reduce(
            (sum, cl) => sum + cl.lot.testResults.length,
            0,
          ),
          totalPassedTests: claim.claimedLots.reduce(
            (sum, cl) => sum + cl.lot.testResults.filter((t) => t.passFail === 'pass').length,
            0,
          ),
          totalNCRs: claim.claimedLots.reduce((sum, cl) => sum + cl.lot.ncrLots.length, 0),
          totalOpenNCRs: claim.claimedLots.reduce(
            (sum, cl) =>
              sum +
              cl.lot.ncrLots.filter(
                (nl) => !['closed', 'closed_concession'].includes(nl.ncr.status),
              ).length,
            0,
          ),
          totalPhotos: claim.claimedLots.reduce(
            (sum, cl) => sum + cl.lot.documents.filter((d) => d.documentType === 'photo').length,
            0,
          ),
          conformedLots: claim.claimedLots.filter(
            (cl) => cl.lot.status === 'conformed' || cl.lot.status === 'claimed',
          ).length,
        },

        // Feature #493: Group lots by activity type with subtotals
        lotsByActivity: (() => {
          const grouped: Record<
            string,
            {
              activityType: string;
              lotCount: number;
              subtotal: number;
              lots: { id: string; lotNumber: string; amount: number }[];
            }
          > = {};

          claim.claimedLots.forEach((claimedLot) => {
            const activityType = claimedLot.lot.activityType || 'Uncategorized';
            const amount = claimedLot.amountClaimed ? Number(claimedLot.amountClaimed) : 0;

            if (!grouped[activityType]) {
              grouped[activityType] = {
                activityType,
                lotCount: 0,
                subtotal: 0,
                lots: [],
              };
            }

            grouped[activityType].lotCount++;
            grouped[activityType].subtotal += amount;
            grouped[activityType].lots.push({
              id: claimedLot.lot.id,
              lotNumber: claimedLot.lot.lotNumber,
              amount,
            });
          });

          // Convert to sorted array
          return Object.values(grouped).sort((a, b) => b.subtotal - a.subtotal);
        })(),

        generatedAt: new Date().toISOString(),
        generationTimeMs: Date.now() - startTime,
      };

      res.json(buildClaimEvidencePackageResponse(evidencePackage));
    }),
  );

  // GET /api/projects/:projectId/claims/:claimId/completeness-check - claim evidence review
  evidenceRouter.get(
    '/:projectId/claims/:claimId/completeness-check',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const claimId = parseClaimRouteParam(req.params.claimId, 'claimId');
      await requireCommercialProjectAccess(req.user!, projectId);

      // Get the claim with all related data for completeness analysis
      const claim = await prisma.progressClaim.findFirst({
        where: { id: claimId, projectId },
        include: {
          claimedLots: {
            include: {
              lot: {
                include: {
                  testResults: true,
                  ncrLots: {
                    include: {
                      ncr: true,
                    },
                  },
                  documents: true,
                  itpInstance: {
                    include: {
                      template: {
                        include: {
                          checklistItems: true,
                        },
                      },
                      completions: true,
                    },
                  },
                  holdPoints: true,
                },
              },
            },
          },
        },
      });

      if (!claim) {
        throw AppError.notFound('Claim');
      }

      res.json(buildClaimEvidenceReviewResponse(claim));
    }),
  );

  return evidenceRouter;
}
