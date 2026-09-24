// ============================================================
// tools/spark/scoring.js
// ------------------------------------------------------------
// Turns a set of responses into:
//   - per-skill scores with confidence
//   - per-stream alignment (strong / moderate / limited)
//   - traceable reasons and development areas
//
// The application owns scoring. The LLM never invents a score.
// ============================================================

const { STREAM_WEIGHTS, KEY_SKILLS } = require('./session');

// Thresholds for alignment categories.
// NOT probabilities — categorical labels backed by evidence count.
const ALIGNMENT_STRONG   = 0.70;
const ALIGNMENT_MODERATE = 0.40;

// ----------------------------------------------------------------
// Per-skill scoring
// ----------------------------------------------------------------

function computeSkillScores(responses) {
  const bySkill = {};

  for (const r of responses) {
    if (!r.skill) continue;
    if (!bySkill[r.skill]) bySkill[r.skill] = [];
    bySkill[r.skill].push(r);
  }

  const scores = [];

  for (const skill of Object.keys(bySkill)) {
    const list = bySkill[skill];
    const n = list.length;

    // Weighted average: later responses weigh slightly more (recency)
    let weightedSum = 0, weightTotal = 0;
    list.forEach((r, i) => {
      const w = 1 + (i / Math.max(n - 1, 1)) * 0.5; // 1.0 → 1.5
      weightedSum += Number(r.score || 0) * w;
      weightTotal += w;
    });
    const score = weightTotal > 0 ? weightedSum / weightTotal : 0;

    // Confidence grows with evidence count and consistency
    const consistency = computeConsistency(list);
    const evidenceFactor = Math.min(1, n / 3);
    const confidence = Math.max(0.15, evidenceFactor * consistency);

    // Trend — compare first half vs second half
    const half = Math.max(1, Math.floor(n / 2));
    const firstHalf  = list.slice(0, half).reduce((a, r) => a + Number(r.score || 0), 0) / half;
    const secondHalf = list.slice(half).reduce((a, r) => a + Number(r.score || 0), 0) / Math.max(1, n - half);
    let trend = 'stable';
    if (n >= 3) {
      if (secondHalf - firstHalf > 0.15) trend = 'improving';
      else if (firstHalf - secondHalf > 0.15) trend = 'declining';
    } else {
      trend = 'unknown';
    }

    scores.push({
      skill,
      score: round4(score),
      confidence: round4(confidence),
      evidence_count: n,
      trend,
    });
  }

  return scores;
}

function computeConsistency(list) {
  if (list.length < 2) return 0.5;
  const values = list.map(r => Number(r.score || 0));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);
  // Lower stddev → higher consistency
  return Math.max(0.3, 1 - stddev * 1.5);
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

// ----------------------------------------------------------------
// Per-stream alignment
// ----------------------------------------------------------------

function computeRecommendations(skillScores) {
  const scoreMap = {};
  for (const s of skillScores) scoreMap[s.skill] = s;

  const streams = Object.keys(STREAM_WEIGHTS);
  const results = [];

  for (const stream of streams) {
    const weights = STREAM_WEIGHTS[stream];
    let weightedSum = 0, weightTotal = 0;
    let confidenceSum = 0, confidenceWeight = 0;
    const reasons = [];
    const development = [];

    for (const skill of Object.keys(weights)) {
      const w = weights[skill];
      const s = scoreMap[skill];
      if (!s) continue;

      // We only count evidence we have. A skill with no evidence does not
      // pull the score down — it pulls confidence down.
      weightedSum += s.score * w;
      weightTotal += w;

      confidenceSum += s.confidence * w;
      confidenceWeight += w;

      // Reasons for this stream
      if (s.score >= 0.70 && w >= 1.5) {
        reasons.push({
          skill,
          label: humanSkill(skill),
          score: s.score,
          note: 'Strong ' + s.evidence_count + ' of ' + s.evidence_count + ' correct',
          evidence: s.evidence_count,
        });
      } else if (s.score < 0.40) {
        development.push({
          skill,
          label: humanSkill(skill),
          score: s.score,
          note: 'Limited evidence in this area',
        });
      }
    }

    const score = weightTotal > 0 ? weightedSum / weightTotal : 0;
    const confidenceRaw = confidenceWeight > 0 ? confidenceSum / confidenceWeight : 0;

    // Coverage factor: how many stream-weighted skills do we actually have?
    const streamSkills = Object.keys(weights);
    const covered = streamSkills.filter(s => scoreMap[s]).length;
    const coverage = covered / streamSkills.length;

    const confidence = clamp(confidenceRaw * coverage, 0, 1);

    results.push({
      stream,
      score,
      alignment: toAlignment(score),
      confidence: round4(confidence),
      reasons: reasons.sort((a, b) => b.score - a.score).slice(0, 5),
      development_areas: development.slice(0, 3),
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

function toAlignment(score) {
  if (score >= ALIGNMENT_STRONG)   return 'strong';
  if (score >= ALIGNMENT_MODERATE) return 'moderate';
  return 'limited';
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// ----------------------------------------------------------------
// Human labels
// ----------------------------------------------------------------

const SKILL_LABELS = {
  numerical_reasoning:   'Numerical reasoning',
  scientific_reasoning:  'Scientific reasoning',
  verbal_reasoning:      'Verbal reasoning',
  analytical_reasoning:  'Analytical reasoning',
  pattern_recognition:   'Pattern recognition',
  creative_reasoning:    'Creative reasoning',
  commercial_reasoning:  'Commercial reasoning',
  problem_solving:       'Problem solving',
  communication:         'Communication',
  decision_making:       'Decision making',
  practical_reasoning:   'Practical reasoning',
  interest_alignment:    'Interest alignment',
};

function humanSkill(skill) {
  return SKILL_LABELS[skill] || skill;
}

// ----------------------------------------------------------------
// Build the full profile (skills + recommendations + summary)
// ----------------------------------------------------------------

function buildProfile(responses) {
  const skillScores = computeSkillScores(responses);
  const recommendations = computeRecommendations(skillScores);

  const strongest = skillScores
    .filter(s => s.evidence_count >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const develop = skillScores
    .filter(s => s.score < 0.50 && s.evidence_count >= 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return {
    skill_scores: skillScores,
    recommendations,
    strongest,
    develop,
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  computeSkillScores,
  computeRecommendations,
  buildProfile,
  humanSkill,
  SKILL_LABELS,
  ALIGNMENT_STRONG,
  ALIGNMENT_MODERATE,
};