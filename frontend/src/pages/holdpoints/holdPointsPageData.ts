import type { HoldPoint, HoldPointStats } from './types';
import { isOverdue } from './components/holdPointTableUtils';

export interface HoldPointChartData {
  releasesOverTime: { date: string; releases: number }[];
  avgTimeToRelease: number;
}

export function buildHoldPointStats(
  holdPoints: HoldPoint[],
  referenceDate = new Date(),
): HoldPointStats {
  const weekAgo = new Date(referenceDate);
  weekAgo.setDate(weekAgo.getDate() - 7);

  return {
    total: holdPoints.length,
    pending: holdPoints.filter((hp) => hp.status === 'pending').length,
    notified: holdPoints.filter((hp) => hp.status === 'notified').length,
    releasedThisWeek: holdPoints.filter((hp) => {
      if (hp.status !== 'released' || !hp.releasedAt) return false;
      const releasedDate = new Date(hp.releasedAt);
      return releasedDate >= weekAgo;
    }).length,
    overdue: holdPoints.filter((hp) => isOverdue(hp)).length,
  };
}

export function buildHoldPointChartData(
  holdPoints: HoldPoint[],
  referenceDate = new Date(),
): HoldPointChartData {
  const releasesOverTime: { date: string; releases: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const releases = holdPoints.filter((hp) => {
      if (!hp.releasedAt) return false;
      const releasedDate = new Date(hp.releasedAt);
      return releasedDate >= dayStart && releasedDate <= dayEnd;
    }).length;
    releasesOverTime.push({ date: dateStr, releases });
  }

  const releasedHPs = holdPoints.filter(
    (hp) => hp.status === 'released' && hp.notificationSentAt && hp.releasedAt,
  );
  let avgTimeToRelease = 0;
  if (releasedHPs.length > 0) {
    const totalHours = releasedHPs.reduce((sum, hp) => {
      const notified = new Date(hp.notificationSentAt!).getTime();
      const released = new Date(hp.releasedAt!).getTime();
      return sum + (released - notified) / (1000 * 60 * 60);
    }, 0);
    avgTimeToRelease = Math.round(totalHours / releasedHPs.length);
  }

  return { releasesOverTime, avgTimeToRelease };
}
