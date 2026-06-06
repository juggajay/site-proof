import { Router, Request, Response } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import {
  parseDiaryRouteParam,
  parseOptionalDiaryQueryString,
  requireDiaryReadAccess,
} from './diaryAccess.js';
import {
  buildActivitySuggestionsResponse,
  buildRecentPlantResponse,
} from './diaryItemsResponses.js';
import { DIARY_SHORT_TEXT_MAX_LENGTH } from './diaryItemsValidation.js';

const router = Router();

type RecentPlantSuggestion = {
  description: string;
  idRego: string | null;
  company: string | null;
  lastUsed: Date;
  usageCount: number;
};

// GET /api/diary/project/:projectId/recent-plant - Get recently used plant for a project
router.get(
  '/project/:projectId/recent-plant',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDiaryRouteParam(req.params.projectId, 'projectId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    await requireDiaryReadAccess(req.user!, projectId, 'Access denied');

    // Get plant from recent diaries (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDiaries = await prisma.dailyDiary.findMany({
      where: {
        projectId,
        date: { gte: thirtyDaysAgo },
      },
      include: {
        plant: true,
      },
      orderBy: { date: 'desc' },
      take: 10,
    });

    // Collect unique plant items by description + company
    const plantMap = new Map<string, RecentPlantSuggestion>();
    for (const diary of recentDiaries) {
      for (const plant of diary.plant) {
        const key = `${plant.description}|${plant.company || ''}|${plant.idRego || ''}`;
        if (!plantMap.has(key)) {
          plantMap.set(key, {
            description: plant.description,
            idRego: plant.idRego,
            company: plant.company,
            lastUsed: diary.date,
            usageCount: 1,
          });
        } else {
          const existing = plantMap.get(key)!;
          existing.usageCount += 1;
        }
      }
    }

    // Convert to array and sort by usage count (most used first)
    const recentPlant = Array.from(plantMap.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20); // Limit to top 20

    res.json(buildRecentPlantResponse(recentPlant));
  }),
);

// GET /api/diary/project/:projectId/activity-suggestions - Get activity suggestions
router.get(
  '/project/:projectId/activity-suggestions',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDiaryRouteParam(req.params.projectId, 'projectId');
    const search = parseOptionalDiaryQueryString(
      req.query.search,
      'search',
      DIARY_SHORT_TEXT_MAX_LENGTH,
    );
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    await requireDiaryReadAccess(req.user!, projectId, 'Access denied');

    const suggestions: Array<{ description: string; source: string; category?: string }> = [];

    // 1. Get checklist item descriptions from ITP templates for this project
    const itpTemplates = await prisma.iTPTemplate.findMany({
      where: { projectId },
      include: {
        checklistItems: {
          select: { description: true },
        },
      },
    });

    for (const template of itpTemplates) {
      for (const item of template.checklistItems) {
        suggestions.push({
          description: item.description,
          source: 'ITP Template',
          category: template.activityType ?? undefined,
        });
      }
    }

    // 2. Get recent activity descriptions from diaries
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivities = await prisma.diaryActivity.findMany({
      where: {
        diary: {
          projectId,
          date: { gte: thirtyDaysAgo },
        },
      },
      select: { description: true },
      distinct: ['description'],
      take: 50,
    });

    for (const activity of recentActivities) {
      // Only add if not already in suggestions
      if (!suggestions.some((s) => s.description === activity.description)) {
        suggestions.push({
          description: activity.description,
          source: 'Recent Activity',
        });
      }
    }

    // 3. Add common construction activities as fallback
    const commonActivities = [
      'Site setup and establishment',
      'Excavation works',
      'Backfilling and compaction',
      'Concrete pour',
      'Formwork installation',
      'Reinforcement installation',
      'Survey and setout',
      'Quality testing',
      'Material delivery',
      'Site cleanup',
    ];

    for (const desc of commonActivities) {
      if (!suggestions.some((s) => s.description === desc)) {
        suggestions.push({
          description: desc,
          source: 'Common',
        });
      }
    }

    // Filter by search term if provided
    let filtered = suggestions;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = suggestions.filter((s) => s.description.toLowerCase().includes(searchLower));
    }

    // Deduplicate and limit
    const unique = Array.from(new Map(filtered.map((s) => [s.description, s])).values());
    const limited = unique.slice(0, 20);

    res.json(buildActivitySuggestionsResponse(limited, unique.length));
  }),
);

export { router as diarySuggestionsRouter };
