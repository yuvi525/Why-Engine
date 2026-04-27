export const Config = {
  compression: {
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1500', 10),
  },
  cache: {
    similarityThreshold: parseFloat(process.env.CACHE_SIMILARITY_THRESHOLD || '0.92'),
    ttlSeconds: parseInt(process.env.CACHE_TTL || '86400', 10)
  },
  routing: {
    weights: {
      speed: 0.3,
      cost: 0.5,
      quality: 0.2
    }
  }
};
