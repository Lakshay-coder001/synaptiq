(function() {
  window.Synaptiq = window.Synaptiq || {};

  /**
   * Lightweight pub/sub state manager using Observer pattern.
   */
  const _state = {
    currentPage: null,
    sidebarCollapsed: false,
    theme: 'dark',
    trainingState: 'ready',
    currentExperimentId: null,
    currentRunId: null
  };

  const _listeners = new Map();

  Synaptiq.state = {
    /**
     * Gets a state value.
     * @param {string} key 
     * @returns {*}
     */
    get(key) {
      return _state[key];
    },

    /**
     * Sets a state value and notifies subscribers.
     * @param {string} key 
     * @param {*} value 
     */
    set(key, value) {
      if (_state[key] !== value) {
        _state[key] = value;
        if (_listeners.has(key)) {
          const listeners = _listeners.get(key);
          // Trigger all listener callbacks
          listeners.forEach(callback => callback(value));
        }
      }
    },

    /**
     * Subscribes to changes on a specific key.
     * @param {string} key 
     * @param {Function} callback 
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
      if (!_listeners.has(key)) {
        _listeners.set(key, new Set());
      }
      _listeners.get(key).add(callback);

      return () => {
        const listeners = _listeners.get(key);
        if (listeners) {
          listeners.delete(callback);
          if (listeners.size === 0) {
            _listeners.delete(key);
          }
        }
      };
    },

    /**
     * Returns a shallow copy of the state.
     * @returns {Object}
     */
    getAll() {
      return { ..._state };
    }
  };
})();
