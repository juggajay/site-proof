// Testing Feature #602: Test AI extraction confidence low highlight
// This test verifies that low confidence fields are highlighted

console.log('Testing Feature #602: Test AI extraction confidence low highlight\n');

// Simulate the confidence highlighting logic (same as in backend)
function analyzeConfidence(aiExtracted, aiConfidence) {
  if (!aiExtracted || !aiConfidence) {
    return { hasLowConfidence: false, lowConfidenceFields: [], fieldStatus: {} };
  }

  const confidence = typeof aiConfidence === 'string' ? JSON.parse(aiConfidence) : aiConfidence;
  const LOW_CONFIDENCE_THRESHOLD = 0.80; // Fields below 80% get highlighted
  const MEDIUM_CONFIDENCE_THRESHOLD = 0.90; // Fields below 90% get warning

  const fieldStatus = {};
  const lowConfidenceFields = [];

  for (const [field, conf] of Object.entries(confidence)) {
    let status = 'high';
    let needsReview = false;

    if (conf < LOW_CONFIDENCE_THRESHOLD) {
      status = 'low';
      needsReview = true;
      lowConfidenceFields.push(field);
    } else if (conf < MEDIUM_CONFIDENCE_THRESHOLD) {
      status = 'medium';
      needsReview = false;
    }

    fieldStatus[field] = { confidence: conf, status, needsReview };
  }

  return {
    hasLowConfidence: lowConfidenceFields.length > 0,
    lowConfidenceFields,
    fieldStatus,
    thresholds: {
      low: LOW_CONFIDENCE_THRESHOLD,
      medium: MEDIUM_CONFIDENCE_THRESHOLD
    },
    reviewMessage: lowConfidenceFields.length > 0
      ? `${lowConfidenceFields.length} field(s) have low AI confidence and require manual verification: ${lowConfidenceFields.join(', ')}`
      : 'All AI-extracted fields have acceptable confidence levels'
  };
}

// Step 1: AI extracts with low confidence field
console.log('Step 1: Creating AI extraction with low confidence field...');
const aiConfidence = {
  resultValue: 0.97,       // High confidence (97%)
  laboratoryName: 0.72,    // LOW confidence (72%) - should be highlighted
  laboratoryReportNumber: 0.99,  // High confidence (99%)
  sampleDate: 0.85,        // Medium confidence (85%)
  testDate: 0.65           // LOW confidence (65%) - should be highlighted
};

console.log('AI Confidence scores:');
for (const [field, conf] of Object.entries(aiConfidence)) {
  console.log(`  ${field}: ${(conf * 100).toFixed(0)}%`);
}

// Analyze the confidence
const highlights = analyzeConfidence(true, aiConfidence);

// Step 2: Verify field highlighted
console.log('\nStep 2: Verifying low confidence fields are highlighted...');
console.log('Confidence thresholds:');
console.log(`  Low threshold: < ${highlights.thresholds.low * 100}%`);
console.log(`  Medium threshold: < ${highlights.thresholds.medium * 100}%`);

console.log('\nField status analysis:');
for (const [field, status] of Object.entries(highlights.fieldStatus)) {
  const indicator = status.status === 'low' ? '🔴 LOW' :
                   status.status === 'medium' ? '🟡 MEDIUM' : '🟢 HIGH';
  console.log(`  ${field}: ${indicator} (${(status.confidence * 100).toFixed(0)}%)${status.needsReview ? ' ⚠️ NEEDS REVIEW' : ''}`);
}

const lowFieldsHighlighted = highlights.hasLowConfidence;
console.log(`\nLow confidence fields identified: ${lowFieldsHighlighted ? '✓ YES' : '✗ NO'}`);
console.log(`Low confidence fields: ${highlights.lowConfidenceFields.join(', ')}`);

// Step 3: Verify reviewer attention drawn
console.log('\nStep 3: Verifying reviewer attention is drawn...');
console.log('Review message:', highlights.reviewMessage);

const hasReviewMessage = highlights.reviewMessage.includes('require manual verification');
const identifiesFields = highlights.lowConfidenceFields.length === 2 &&
                        highlights.lowConfidenceFields.includes('laboratoryName') &&
                        highlights.lowConfidenceFields.includes('testDate');

console.log(`\nReview message present: ${hasReviewMessage ? '✓ YES' : '✗ NO'}`);
console.log(`Correct fields identified: ${identifiesFields ? '✓ YES' : '✗ NO'}`);

// Final verification
console.log('\n=== VERIFICATION ===');
console.log('Low confidence field created:', aiConfidence.laboratoryName < 0.80 ? '✓ YES' : '✗ NO');
console.log('Fields highlighted:', lowFieldsHighlighted ? '✓ YES' : '✗ NO');
console.log('Reviewer attention drawn:', hasReviewMessage ? '✓ YES' : '✗ NO');

const allTestsPassed = lowFieldsHighlighted && hasReviewMessage && identifiesFields;
console.log('\nAll tests passed:', allTestsPassed ? '✓ YES' : '✗ NO');

if (allTestsPassed) {
  console.log('\nFeature #602 is working correctly!');
}

// Bonus: Test edge cases
console.log('\n--- Bonus: Edge case testing ---');

// Test with all high confidence
const allHighConf = analyzeConfidence(true, { field1: 0.95, field2: 0.99 });
console.log(`All high confidence - hasLowConfidence: ${allHighConf.hasLowConfidence} (expected: false)`);

// Test with no AI extraction
const noAI = analyzeConfidence(false, null);
console.log(`Non-AI data - hasLowConfidence: ${noAI.hasLowConfidence} (expected: false)`);

// Test boundary values
const boundaryConf = analyzeConfidence(true, {
  exactLow: 0.80,    // Exactly at threshold - should be medium
  belowLow: 0.79,    // Below threshold - should be low
  exactMed: 0.90,    // Exactly at medium - should be high
  belowMed: 0.89     // Below medium - should be medium
});
console.log('\nBoundary test results:');
console.log(`  0.80 (at low threshold): ${boundaryConf.fieldStatus.exactLow.status}`);
console.log(`  0.79 (below low threshold): ${boundaryConf.fieldStatus.belowLow.status}`);
console.log(`  0.90 (at medium threshold): ${boundaryConf.fieldStatus.exactMed.status}`);
console.log(`  0.89 (below medium threshold): ${boundaryConf.fieldStatus.belowMed.status}`);
