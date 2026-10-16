(function() {
  window.Synaptiq = window.Synaptiq || {};

  let _cachedDatasets = null;
  let _cachedConfig =null;
  let _cachedIrisData = null;

  

  // it will return Promise<any>
  async function fetchJSON(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok){
        if (response.status === 400){
            console.error('Bad Request', url);
        }
        else if (response.status === 404){
            console.error('Not Found', url);
        }
        else if (response.status === 500){
            console.error('Internal Server Error', url);
        }
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      if (response.status === 201){
        console.log('Created successfully');
      }
      else if (response.status === 304){
        console.log('Not Modified (cached)');
      }
      else if (response.status === 200){
        console.log('OK');
      }
      return await response.json();
    }catch (error) {
      console.error(`fetchJSON failed for url ${url}:`, error);
      throw error;
    }
  }

  Synaptiq.api = {
    fetchJSON,

    // it lods data if cached else fetches it
    async loadDatasets() {
      const cached = await Synaptiq.cache.get('datasets_meta');
      if (cached){
        return cached;
      }

      try {
        const data = await fetchJSON('data/datasets.json');
        const datasets = data.datasets || data;
        await Synaptiq.cache.set('datasets_meta', datasets);
        return datasets;
      } catch (error) {
        console.warn('Using fallback dataset info due to fetch failure:', error);
        const fallback = [
          {
            id: 'xor',
            name: 'XOR Gate',
            description: 'Classic XOR logical operation.',
            type: 'classification',
            samples: 4,
            features: 2,
            classes: 2,
            featureNames: ['Input A', 'Input B'],
            classNames: ['0', '1'],
            builtin: true,
            data: [
              { input: [0, 0], output: [0] },
              { input: [0, 1], output: [1] },
              { input: [1, 0], output: [1] },
              { input: [1, 1], output: [0] }
            ]
          }
        ];
        return fallback;
      }
    },
    //it returns object
    async loadConfig() {
      const cached = await Synaptiq.cache.get('app_config');
      if (cached){
        return cached;
      }

      try {
        const data = await fetchJSON('data/config.json');
        await Synaptiq.cache.set('app_config', data);
        return data;
      } catch (error) {
        return { version: '1.0.0', defaultTheme: 'dark' };
      }
    },

    // it loads iris data and returnds Promise<array>
    async loadIrisData() {
      const cached = await Synaptiq.cache.get('iris_data');
      if (cached){
        return cached;
      }

      try {
        const data = await fetchJSON('data/iris.json');
        await Synaptiq.cache.set('iris_data', data);
        return data;
      }catch(error) {
        return [];
      }
    }
  };
})();
