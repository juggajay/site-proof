import type {
  ClaimEvidenceReview,
  ClaimEvidenceReviewInput,
  EvidenceReadinessItem,
} from './core.js';
import { item, reviewBucket } from './core.js';

export function buildClaimEvidenceReviewFromInputs(
  input: ClaimEvidenceReviewInput,
): ClaimEvidenceReview {
  const lots = input.claim.claimedLots.map((claimedLot) => {
    const lot = claimedLot.lot;
    const items: EvidenceReadinessItem[] = [];
    const itpInstance = lot.itpInstance;

    if (itpInstance) {
      const totalItems = itpInstance.template.checklistItems.length;
      const completedItems = itpInstance.completions.filter(
        (completion) => completion.status === 'completed',
      ).length;
      const missingItems = Math.max(0, totalItems - completedItems);

      if (missingItems > 0) {
        const completionRatio = totalItems > 0 ? completedItems / totalItems : 0;
        items.push(
          item({
            code: 'itp_incomplete',
            severity: completionRatio < 0.5 ? 'blocker' : 'warning',
            area: 'itp',
            title: 'ITP checklist incomplete',
            detail: `${completedItems}/${totalItems} checklist items are complete.`,
            blocksAction: false,
            actionLabel: 'Review ITP',
            count: missingItems,
          }),
        );
      } else {
        items.push(
          item({
            code: 'itp_complete',
            severity: 'support',
            area: 'itp',
            title: 'ITP checklist complete',
            detail: `${completedItems}/${totalItems} checklist items are complete.`,
            blocksAction: false,
            count: completedItems,
          }),
        );
      }

      const holdPointItems = itpInstance.template.checklistItems.filter(
        (checklistItem) => checklistItem.pointType === 'hold_point',
      );
      const unreleasedItpHoldPoints = holdPointItems.filter((holdPointItem) => {
        const completion = itpInstance.completions.find(
          (candidate) => candidate.checklistItemId === holdPointItem.id,
        );
        return !completion || completion.verificationStatus !== 'verified';
      });

      if (unreleasedItpHoldPoints.length > 0) {
        items.push(
          item({
            code: 'unreleased_itp_hold_points',
            severity: 'blocker',
            area: 'hold_point',
            title: 'ITP hold points need release evidence',
            detail: `${unreleasedItpHoldPoints.length} ITP hold point${unreleasedItpHoldPoints.length === 1 ? '' : 's'} are not verified or released.`,
            blocksAction: false,
            actionLabel: 'Review hold points',
            count: unreleasedItpHoldPoints.length,
            relatedIds: unreleasedItpHoldPoints.map((holdPointItem) => holdPointItem.id),
          }),
        );
      }
    } else {
      items.push(
        item({
          code: 'no_itp',
          severity: 'warning',
          area: 'itp',
          title: 'No ITP assigned',
          detail:
            'Assign and complete an ITP when this activity requires formal inspection records.',
          blocksAction: false,
          actionLabel: 'Assign ITP',
        }),
      );
    }

    const unreleasedLotHoldPoints = lot.holdPoints.filter(
      (holdPoint) => holdPoint.status !== 'released',
    );
    const releasedLotHoldPoints = lot.holdPoints.length - unreleasedLotHoldPoints.length;

    if (unreleasedLotHoldPoints.length > 0) {
      items.push(
        item({
          code: 'unreleased_hold_points',
          severity: 'blocker',
          area: 'hold_point',
          title: 'Hold points need release evidence',
          detail: `${unreleasedLotHoldPoints.length} lot hold point${unreleasedLotHoldPoints.length === 1 ? '' : 's'} are not released.`,
          blocksAction: false,
          actionLabel: 'Review hold points',
          count: unreleasedLotHoldPoints.length,
          relatedIds: unreleasedLotHoldPoints.map((holdPoint) => holdPoint.id),
        }),
      );
    } else if (releasedLotHoldPoints > 0) {
      items.push(
        item({
          code: 'released_hold_points',
          severity: 'support',
          area: 'hold_point',
          title: 'Hold points released',
          detail: `${releasedLotHoldPoints} lot hold point${releasedLotHoldPoints === 1 ? '' : 's'} have release evidence.`,
          blocksAction: false,
          count: releasedLotHoldPoints,
        }),
      );
    }

    const failedTests = lot.testResults.filter((testResult) => testResult.passFail === 'fail');
    const pendingTests = lot.testResults.filter((testResult) =>
      ['pending', 'submitted'].includes(testResult.status),
    );
    const passingTests = lot.testResults.filter((testResult) => testResult.passFail === 'pass');

    if (lot.testResults.length === 0) {
      items.push(
        item({
          code: 'no_tests',
          severity: 'warning',
          area: 'test',
          title: 'No test results recorded',
          detail:
            'Attach test results when this activity type requires laboratory or field test evidence.',
          blocksAction: false,
          actionLabel: 'Review tests',
        }),
      );
    }

    if (failedTests.length > 0) {
      items.push(
        item({
          code: 'failed_tests',
          severity: 'blocker',
          area: 'test',
          title: 'Failed tests recorded',
          detail: `${failedTests.length} test result${failedTests.length === 1 ? '' : 's'} failed and should be resolved before sharing this evidence pack.`,
          blocksAction: false,
          actionLabel: 'Review tests',
          count: failedTests.length,
          relatedIds: failedTests.map((testResult) => testResult.id),
        }),
      );
    }

    if (pendingTests.length > 0) {
      items.push(
        item({
          code: 'pending_tests',
          severity: 'warning',
          area: 'test',
          title: 'Tests still pending',
          detail: `${pendingTests.length} test result${pendingTests.length === 1 ? '' : 's'} are not verified yet.`,
          blocksAction: false,
          actionLabel: 'Review tests',
          count: pendingTests.length,
          relatedIds: pendingTests.map((testResult) => testResult.id),
        }),
      );
    }

    if (passingTests.length > 0) {
      items.push(
        item({
          code: 'passing_tests',
          severity: 'support',
          area: 'test',
          title: 'Passing tests attached',
          detail: `${passingTests.length} passing test result${passingTests.length === 1 ? '' : 's'} support this claim line.`,
          blocksAction: false,
          count: passingTests.length,
          relatedIds: passingTests.map((testResult) => testResult.id),
        }),
      );
    }

    const ncrs = lot.ncrLots.map((ncrLot) => ncrLot.ncr);
    const openNcrs = ncrs.filter((ncr) => !['closed', 'closed_concession'].includes(ncr.status));
    const criticalOpenNcrs = openNcrs.filter((ncr) => ['major', 'critical'].includes(ncr.severity));
    const minorOpenNcrs = openNcrs.filter((ncr) => !['major', 'critical'].includes(ncr.severity));

    if (criticalOpenNcrs.length > 0) {
      items.push(
        item({
          code: 'open_major_ncrs',
          severity: 'blocker',
          area: 'ncr',
          title: 'Major NCRs still open',
          detail: `${criticalOpenNcrs.length} major or critical NCR${criticalOpenNcrs.length === 1 ? '' : 's'} remain open.`,
          blocksAction: false,
          actionLabel: 'Review NCRs',
          count: criticalOpenNcrs.length,
          relatedIds: criticalOpenNcrs.map((ncr) => ncr.id),
        }),
      );
    }

    if (minorOpenNcrs.length > 0) {
      items.push(
        item({
          code: 'open_minor_ncrs',
          severity: 'warning',
          area: 'ncr',
          title: 'Minor NCRs still open',
          detail: `${minorOpenNcrs.length} minor NCR${minorOpenNcrs.length === 1 ? '' : 's'} remain open.`,
          blocksAction: false,
          actionLabel: 'Review NCRs',
          count: minorOpenNcrs.length,
          relatedIds: minorOpenNcrs.map((ncr) => ncr.id),
        }),
      );
    }

    if (ncrs.length > 0 && openNcrs.length === 0) {
      items.push(
        item({
          code: 'ncrs_closed',
          severity: 'support',
          area: 'ncr',
          title: 'NCRs closed',
          detail: `${ncrs.length} NCR${ncrs.length === 1 ? '' : 's'} linked to this lot are closed.`,
          blocksAction: false,
          count: ncrs.length,
        }),
      );
    }

    const photos = lot.documents.filter((document) => document.documentType === 'photo');
    if (photos.length === 0) {
      items.push(
        item({
          code: 'no_photos',
          severity: 'warning',
          area: 'document',
          title: 'No photo evidence',
          detail: 'Add photos where they would help the client verify the claimed work.',
          blocksAction: false,
          actionLabel: 'Review documents',
        }),
      );
    } else if (photos.length < 3) {
      items.push(
        item({
          code: 'low_photo_evidence',
          severity: 'warning',
          area: 'document',
          title: 'Limited photo evidence',
          detail: `${photos.length} photo${photos.length === 1 ? '' : 's'} attached. Add more if the client needs visual proof.`,
          blocksAction: false,
          actionLabel: 'Review documents',
          count: photos.length,
        }),
      );
    } else {
      items.push(
        item({
          code: 'photo_evidence',
          severity: 'support',
          area: 'document',
          title: 'Photo evidence attached',
          detail: `${photos.length} photos support this claim line.`,
          blocksAction: false,
          count: photos.length,
        }),
      );
    }

    return {
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      activityType: lot.activityType || 'Unknown',
      claimAmount: claimedLot.amountClaimed ? Number(claimedLot.amountClaimed) : 0,
      claim: reviewBucket(items),
    };
  });

  const totalLots = lots.length;
  const blockedCount = lots.filter((lot) => lot.claim.state === 'blocked').length;
  const reviewCount = lots.filter((lot) => lot.claim.state === 'warning').length;
  const readyCount = lots.filter((lot) => lot.claim.state === 'ready').length;
  const totalClaimAmount = input.claim.totalClaimedAmount
    ? Number(input.claim.totalClaimedAmount)
    : 0;
  const recommendedAmount = lots
    .filter((lot) => lot.claim.state !== 'blocked')
    .reduce((sum, lot) => sum + lot.claimAmount, 0);

  const overallSuggestions: string[] = [];
  if (blockedCount > 0) {
    overallSuggestions.push(
      `Resolve evidence blockers on ${blockedCount} claim line${blockedCount === 1 ? '' : 's'} before sharing the claim pack.`,
    );
  }
  if (reviewCount > 0) {
    overallSuggestions.push(
      `Review warnings on ${reviewCount} claim line${reviewCount === 1 ? '' : 's'} so the client can follow the evidence trail.`,
    );
  }
  if (blockedCount === 0 && reviewCount === 0 && totalLots > 0) {
    overallSuggestions.push('Claim evidence is ready for client review.');
  }

  return {
    claimId: input.claim.id,
    claimNumber: input.claim.claimNumber,
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
    summary: {
      totalLots,
      readyCount,
      reviewCount,
      blockedCount,
      totalClaimAmount,
      recommendedAmount,
    },
    lots,
    overallSuggestions,
  };
}
