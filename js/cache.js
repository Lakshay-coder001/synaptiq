(function() {
  window.Synaptiq = window.Synaptiq || {};

  const CACHE_NAME = 'synaptiq-data-cache-v1';
  const memoryCache = new Map();

  Synaptiq.cache = {
    async get(key) {
      if(memoryCache.has(key)){
        console.log(`[Cache HIT - Memory] ${key}`);
        return memoryCache.get(key);
      }
      try {
        if ('caches' in window){
          const cache = await caches.open(CACHE_NAME);
          const response = await cache.match(key);
          if (response){
            console.log(`[Cache HIT - CacheAPI] ${key}`);
            const data = await response.json();
            memoryCache.set(key, data);
            return data;
          }
        }
      } catch (e){
        console.warn('Cache API match error:', e);
      }
      console.log(`[Cache MISS] ${key}`);
      return null;
    },

    async set(key, data) {
      memoryCache.set(key, data);
      try {
        if ('caches' in window){
          const cache = await caches.open(CACHE_NAME);
          const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
          });
          await cache.put(key, response);
          console.log(`[Cache STORE] ${key}`);
        }
      } catch (e) {
        console.warn('Cache API store error:', e);
      }
    },

    clear() {
      memoryCache.clear();
    }
  };
})();