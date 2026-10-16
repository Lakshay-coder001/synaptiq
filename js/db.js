(function() {
  window.Synaptiq = window.Synaptiq || {};

  const DB_NAME = 'SynaptiqDB';
  const DB_VERSION = 1;

  let dbInstance = null;

  /**
   * Helper to get database connection.
   * @returns {Promise<IDBDatabase>}
   */
  function _getDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        return resolve(dbInstance);
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('experiments')) {
          const experimentsStore = db.createObjectStore('experiments', { keyPath: 'id' });
          experimentsStore.createIndex('status', 'status', { unique: false });
          experimentsStore.createIndex('createdAt', 'createdAt', { unique: false });
          experimentsStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('trainingRuns')) {
          const runsStore = db.createObjectStore('trainingRuns', { keyPath: 'id' });
          runsStore.createIndex('experimentId', 'experimentId', { unique: false });
          runsStore.createIndex('status', 'status', { unique: false });
          runsStore.createIndex('startedAt', 'startedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('metrics')) {
          const metricsStore = db.createObjectStore('metrics', { autoIncrement: true });
          metricsStore.createIndex('runId', 'runId', { unique: false });
          metricsStore.createIndex('runId_epoch', ['runId', 'epoch'], { unique: false });
        }

        if (!db.objectStoreNames.contains('datasets')) {
          const datasetsStore = db.createObjectStore('datasets', { keyPath: 'id' });
          datasetsStore.createIndex('name', 'name', { unique: false });
          datasetsStore.createIndex('type', 'type', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Helper to create transaction and get object store.
   * @param {string} storeName 
   * @param {string} mode 'readonly' or 'readwrite'
   * @returns {Promise<{store: IDBObjectStore, transaction: IDBTransaction}>}
   */
  async function _transaction(storeName, mode = 'readonly') {
    const db = await _getDB();
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    return { store, transaction };
  }

  /**
   * Helper to wrap IDBRequest in a Promise.
   * @param {IDBRequest} idbRequest 
   * @returns {Promise<any>}
   */
  function _request(idbRequest) {
    return new Promise((resolve, reject) => {
      idbRequest.onsuccess = () => resolve(idbRequest.result);
      idbRequest.onerror = () => reject(idbRequest.error);
    });
  }

  Synaptiq.db = {
    open: _getDB,

    experiments: {
      async create(experiment) {
        const { store } = await _transaction('experiments', 'readwrite');
        await _request(store.put(experiment));
        return experiment;
      },
      async getAll() {
        const { store } = await _transaction('experiments', 'readonly');
        const index = store.index('createdAt');
        const req = index.openCursor(null, 'prev');
        return new Promise((resolve, reject) => {
          const results = [];
          req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          req.onerror = () => reject(req.error);
        });
      },
      async get(id) {
        const { store } = await _transaction('experiments', 'readonly');
        return _request(store.get(id));
      },
      async update(experiment) {
        experiment.updatedAt = new Date().toISOString();
        const { store } = await _transaction('experiments', 'readwrite');
        await _request(store.put(experiment));
        return experiment;
      },
      async delete(id) {
        const { store } = await _transaction('experiments', 'readwrite');
        await _request(store.delete(id));
        // Need to delete runs and metrics... simplified for now, usually would handle in a single transaction or separate calls
        const runs = await Synaptiq.db.runs.getByExperiment(id);
        for (const run of runs) {
          await Synaptiq.db.runs.delete(run.id);
        }
      }
    },

    runs: {
      async create(run) {
        const { store } = await _transaction('trainingRuns', 'readwrite');
        await _request(store.put(run));
        return run;
      },
      async getAll() {
        const { store } = await _transaction('trainingRuns', 'readonly');
        const index = store.index('startedAt');
        const req = index.openCursor(null, 'prev');
        return new Promise((resolve, reject) => {
          const results = [];
          req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          req.onerror = () => reject(req.error);
        });
      },
      async getByExperiment(experimentId) {
        const { store } = await _transaction('trainingRuns', 'readonly');
        const index = store.index('experimentId');
        return _request(index.getAll(experimentId));
      },
      async get(id) {
        const { store } = await _transaction('trainingRuns', 'readonly');
        return _request(store.get(id));
      },
      async update(run) {
        const { store } = await _transaction('trainingRuns', 'readwrite');
        await _request(store.put(run));
        return run;
      },
      async delete(id) {
        const { store } = await _transaction('trainingRuns', 'readwrite');
        await _request(store.delete(id));
        await Synaptiq.db.metrics.deleteByRun(id);
      }
    },

    metrics: {
      async save(metric) {
        const { store } = await _transaction('metrics', 'readwrite');
        await _request(store.put(metric));
      },
      async saveBatch(metrics) {
        const { store, transaction } = await _transaction('metrics', 'readwrite');
        return new Promise((resolve, reject) => {
          metrics.forEach(metric => store.put(metric));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      },
      async getByRun(runId) {
        const { store } = await _transaction('metrics', 'readonly');
        const index = store.index('runId');
        const req = index.getAll(runId);
        const data = await _request(req);
        return data.sort((a, b) => a.epoch - b.epoch);
      },
      async deleteByRun(runId) {
        const { store, transaction } = await _transaction('metrics', 'readwrite');
        const index = store.index('runId');
        return new Promise((resolve, reject) => {
          const req = index.openCursor(IDBKeyRange.only(runId));
          req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      }
    },

    datasets: {
      async create(dataset) {
        const { store } = await _transaction('datasets', 'readwrite');
        await _request(store.put(dataset));
        return dataset;
      },
      async getAll() {
        const { store } = await _transaction('datasets', 'readonly');
        return _request(store.getAll());
      },
      async get(id) {
        const { store } = await _transaction('datasets', 'readonly');
        return _request(store.get(id));
      },
      async delete(id) {
        const { store } = await _transaction('datasets', 'readwrite');
        await _request(store.delete(id));
      }
    }
  };
})();
