// Simple In-Memory Cache (No external server required)
const cache = new Map();

const getCache = async (key) => {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.value;
};

const setCache = async (key, value, expirationInSeconds = 3600) => {
  const expiry = Date.now() + (expirationInSeconds * 1000);
  cache.set(key, { value, expiry });
};

const delCache = async (keyPattern) => {
  // Simple pattern matching for our use cases (e.g., 'all_events_*')
  const regexPattern = keyPattern.replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
};

module.exports = {
  getCache,
  setCache,
  delCache
};
