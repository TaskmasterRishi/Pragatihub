export type ModerationVoteSummary = {
  keepVotes: number;
  removeVotes: number;
};

export type ModerationScore = {
  /** Probability (0–1) that the community wants the post removed */
  removalProbability: number;
  /** Simple label derived from probability for quick UI feedback */
  label: "safe" | "borderline" | "remove";
};

/**
 * Compute a smoothed probability that a post should be removed based on
 * community moderation votes. Uses a simple Bayesian estimator:
 *
 *   p(remove) ≈ (remove + 1) / (keep + remove + 2)
 *
 * This:
 * - Avoids extreme 0%/100% when there are very few votes
 * - Scales well as the number of voters grows
 */
export function computeModerationScore(
  summary: ModerationVoteSummary,
): ModerationScore {
  const keep = Math.max(0, summary.keepVotes);
  const remove = Math.max(0, summary.removeVotes);

  const total = keep + remove;

  // Laplace smoothing with Beta(1,1) prior
  const removalProbability = total === 0 ? 0 : (remove + 1) / (total + 2);

  let label: ModerationScore["label"] = "safe";
  if (removalProbability >= 0.7) {
    label = "remove";
  } else if (removalProbability >= 0.4) {
    label = "borderline";
  }

  return { removalProbability, label };
}

