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

/**
 * Transforms sentiment analysis results into a format suitable for the Sunburst chart
 */
export const formatSentimentForSunburst = (sentimentResults: any) => {
  if (!sentimentResults || !sentimentResults.segments) {
    return {
      name: "Sentiments",
      children: [],
    };
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

  // Define categories for grouping sentiments
  const categories: Record<string, string[]> = {
    Positive: [
      "joy",
      "admiration",
      "approval",
      "gratitude",
      "optimism",
      "pride",
      "relief",
      "happiness",
      "excitement",
      "love",
    ],
    Negative: [
      "anger",
      "disappointment",
      "disgust",
      "fear",
      "grief",
      "remorse",
      "sadness",
      "anxiety",
      "worry",
      "frustration",
    ],
    Neutral: [
      "neutral",
      "confusion",
      "curiosity",
      "realization",
      "surprise",
      "indifference",
    ],
    Mixed: ["amusement", "desire", "caring", "interest", "contemplation"],
  };

  // Create the hierarchical structure
  const result: {
    name: string;
    children: {
      name: string;
      children: { name: string; value: number }[];
    }[];
  } = {
    name: "Sentiments",
    children: [],
  };

  // Group sentiments by category
  Object.entries(categories).forEach(([category, sentiments]) => {
    const categoryChildren: { name: string; value: number }[] = [];

    // Find sentiments in this category
    Object.entries(sentimentCounts).forEach(([sentiment, count]) => {
      if (sentiments.includes(sentiment.toLowerCase())) {
        categoryChildren.push({ name: sentiment, value: count });
      }
    });

    // Only add this category if it has children
    if (categoryChildren.length > 0) {
      result.children.push({
        name: category,
        children: categoryChildren,
      });
    }
  });

  // Add uncategorized sentiments as "Other" category
  const uncategorizedSentiments: { name: string; value: number }[] = [];
  Object.entries(sentimentCounts).forEach(([sentiment, count]) => {
    let isCategorized = false;

    Object.values(categories).forEach((sentiments) => {
      if (sentiments.includes(sentiment.toLowerCase())) {
        isCategorized = true;
      }
    });

    if (!isCategorized) {
      uncategorizedSentiments.push({ name: sentiment, value: count });
    }
  });

  if (uncategorizedSentiments.length > 0) {
    result.children.push({
      name: "Other",
      children: uncategorizedSentiments,
    });
  }

  return result;
};
