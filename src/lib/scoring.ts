export function calculateNoveltyScore(content: string, recentPosts: string[]): number {
  if (recentPosts.length === 0) return 75;

  const tokenize = (text: string) =>
    text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((w) => w.length > 2);

  const contentTokens = tokenize(content);
  if (contentTokens.length === 0) return 0;

  // Build TF-IDF: calculate document frequency across recent posts
  const docCount = recentPosts.length + 1;
  const allDocs = [content, ...recentPosts].map(tokenize);

  const df: Record<string, number> = {};
  for (const doc of allDocs) {
    const seen = new Set(doc);
    for (const word of seen) {
      df[word] = (df[word] || 0) + 1;
    }
  }

  // Calculate content's TF-IDF uniqueness
  const tf: Record<string, number> = {};
  for (const word of contentTokens) {
    tf[word] = (tf[word] || 0) + 1;
  }

  let uniquenessSum = 0;
  let totalWeight = 0;

  for (const [word, freq] of Object.entries(tf)) {
    const termFreq = freq / contentTokens.length;
    const idf = Math.log(docCount / (df[word] || 1));
    const tfidf = termFreq * idf;
    uniquenessSum += tfidf;
    totalWeight += termFreq;
  }

  if (totalWeight === 0) return 50;

  const avgUniqueness = uniquenessSum / totalWeight;
  // Normalize to 0-100 (typical TF-IDF values are 0-3ish)
  const normalized = Math.min(100, Math.max(0, avgUniqueness * 40));

  // Penalize very short posts
  const lengthBonus = Math.min(20, contentTokens.length * 0.5);

  return Math.min(100, Math.round(normalized + lengthBonus));
}

export function calculateEngagementScore(
  reactions: { type: string }[],
  commentCount: number
): number {
  let score = 0;

  for (const r of reactions) {
    if (r.type === "thumbsup") score += 5;
    if (r.type === "heart") score += 10;
    if (r.type === "thumbsdown") score -= 10;
  }

  score += commentCount * 3;

  return Math.min(100, Math.max(0, score));
}

export function calculateTotalScore(
  aiScore: number,
  noveltyScore: number,
  engagementScore: number,
  isFlagged: boolean
): number {
  const raw = aiScore * 0.5 + noveltyScore * 0.3 + engagementScore * 0.2;
  return isFlagged ? raw * 0.5 : raw;
}
