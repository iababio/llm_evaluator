/**
 * Transforms sentiment analysis results into a format suitable for CirclePack component
 */
export const formatSentimentForCirclePack = (sentimentResults: any) => {
  if (!sentimentResults || !sentimentResults.segments) {
    return [];
  }

  // Count sentiments across all segments
  const sentimentCounts: Record<string, number> = {};

  sentimentResults.segments.forEach((segment: any) => {
    if (segment.sentiment && Array.isArray(segment.sentiment)) {
      segment.sentiment.forEach((sentiment: string) => {
        // Clean sentiment value
        const cleanSentiment = sentiment.trim().toLowerCase();
        sentimentCounts[cleanSentiment] =
          (sentimentCounts[cleanSentiment] || 0) + 1;
      });
    }
  });

  // Group by sentiment categories (can be customized)
  const categories: Record<string, string[]> = {
    positive: [
      "joy",
      "admiration",
      "approval",
      "gratitude",
      "optimism",
      "pride",
      "relief",
    ],
    negative: [
      "anger",
      "disappointment",
      "disgust",
      "fear",
      "grief",
      "remorse",
      "sadness",
    ],
    neutral: ["neutral", "confusion", "curiosity", "realization"],
    mixed: ["surprise", "amusement", "excitement", "desire", "caring", "love"],
  };

  // Format data for CirclePack
  const circlePackData = Object.entries(sentimentCounts).map(
    ([sentiment, count]) => {
      // Determine category
      let category = "other";
      for (const [cat, sentiments] of Object.entries(categories)) {
        if (sentiments.includes(sentiment)) {
          category = cat;
          break;
        }
      }

      return {
        id: `${category}.${sentiment}`,
        value: count,
      };
    },
  );

  return circlePackData;
};
