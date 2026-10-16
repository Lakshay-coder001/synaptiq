(function() {
  window.Synaptiq = window.Synaptiq || {};

  /**
   * Utility functions for Synaptiq.
   */
  Synaptiq.utils = {
    /**
     * Generates a unique ID with a given prefix.
     * @param {string} prefix 
     * @returns {string} ID in format prefix_timestamp_randomChars
     */
    generateId(prefix) {
      const timestamp = Date.now();
      const randomChars = Math.floor(Math.random() * 4096).toString(16).padStart(3, '0');
      return `${prefix}_${timestamp}_${randomChars}`;
    },

    /**
     * Formats an ISO date string to a human-readable date.
     * @param {string} isoString 
     * @returns {string} Formatted date
     */
    formatDate(isoString) {
      if (!isoString) return 'N/A';
      try {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        }).format(date);
      } catch (e) {
        return isoString;
      }
    },

    /**
     * Formats a duration in milliseconds to a readable string.
     * @param {number} ms 
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
      if (ms == null || isNaN(ms)) return 'N/A';
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      const seconds = Math.floor(ms / 1000);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      if (m < 60) return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    /**
     * Formats a value between 0 and 1 to a percentage.
     * @param {number} value 
     * @returns {string} Formatted percentage
     */
    formatPercent(value) {
      if (value == null || isNaN(value)) return 'N/A';
      return `${(value * 100).toFixed(2)}%`;
    },

    /**
     * Formats a number with specified decimal places.
     * @param {number} value 
     * @param {number} decimals 
     * @returns {string} Formatted number
     */
    formatNumber(value, decimals = 4) {
      if (value == null || isNaN(value)) return 'N/A';
      return value.toFixed(decimals);
    },

    /**
     * Standard debounce function using setTimeout (a macrotask).
     * @param {Function} fn 
     * @param {number} delay 
     * @returns {Function}
     */
    debounce(fn, delay) {
      let timeoutId;
      return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    /**
     * Validates experiment configuration.
     * @param {Object} data 
     * @returns {Object} { valid: boolean, errors: Object }
     */
    validateExperiment(data) {
      const errors = {};
      
      if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.name = 'Name is required';
      } else if (data.name.length > 100) {
        errors.name = 'Name must be 100 characters or fewer';
      }

      if (data.description && data.description.length > 500) {
        errors.description = 'Description must be 500 characters or fewer';
      }

      if (!data.datasetId) {
        errors.datasetId = 'Dataset is required';
      }

      if (!Number.isInteger(data.epochs) || data.epochs < 1 || data.epochs > 1000) {
        errors.epochs = 'Epochs must be a positive integer between 1 and 1000';
      }

      if (typeof data.learningRate !== 'number' || data.learningRate < 0.0001 || data.learningRate > 1.0) {
        errors.learningRate = 'Learning rate must be between 0.0001 and 1.0';
      }

      if (!Number.isInteger(data.batchSize) || data.batchSize < 1 || data.batchSize > 128) {
        errors.batchSize = 'Batch size must be an integer between 1 and 128';
      }

      if (!Number.isInteger(data.hiddenLayers) || data.hiddenLayers < 1 || data.hiddenLayers > 5) {
        errors.hiddenLayers = 'Hidden layers must be between 1 and 5';
      }

      if (!Number.isInteger(data.neuronsPerLayer) || data.neuronsPerLayer < 1 || data.neuronsPerLayer > 64) {
        errors.neuronsPerLayer = 'Neurons per layer must be between 1 and 64';
      }

      const validActivations = ['sigmoid', 'tanh', 'relu'];
      if (!validActivations.includes(data.activationFunction)) {
        errors.activationFunction = 'Invalid activation function';
      }

      return {
        valid: Object.keys(errors).length === 0,
        errors
      };
    },

    /**
     * Shows a toast notification.
     * Note: Uses setTimeout (macrotask) for delaying the removal of the toast.
     * @param {string} message 
     * @param {string} type 'success' | 'error' | 'info'
     * @param {number} duration 
     * @returns {HTMLElement} Toast element
     */
    showToast(message, type = 'info', duration = 4000) {
      let container = document.getElementById('toastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `<span class="toast-message">${this.escapeHtml(message)}</span><button class="toast-close">&times;</button>`;
      
      container.appendChild(toast);
      
      // Trigger slide in
      requestAnimationFrame(() => {
        toast.classList.add('toast-show');
      });

      const closeBtn = toast.querySelector('.toast-close');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.closeToast(toast);
        };
      }

      if (duration > 0) {
        // Macrotask to auto-remove toast
        setTimeout(() => this.closeToast(toast), duration);
      }

      return toast;
    },

    /**
     * Closes a toast notification cleanly.
     * @param {HTMLElement} toastElement 
     */
    closeToast(toastElement) {
      if (!toastElement) return;
      if (toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement);
      }
    },

    /**
     * Escapes HTML special characters to prevent XSS.
     * @param {string} str 
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
      if (typeof str !== 'string') return String(str);
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return str.replace(/[&<>"']/g, function(m) { return map[m]; });
    },

    /**
     * Clamps a number to a range.
     * @param {number} value 
     * @param {number} min 
     * @param {number} max 
     * @returns {number} Clamped value
     */
    clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },

    /**
     * Calculates the mean of a number array.
     * @param {number[]} arr 
     * @returns {number} Mean
     */
    mean(arr) {
      if (!arr || arr.length === 0) return 0;
      return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    },

    /**
     * Finds the maximum in a number array.
     * @param {number[]} arr 
     * @returns {number} Max
     */
    max(arr) {
      if (!arr || arr.length === 0) return 0;
      return Math.max(...arr);
    },

    /**
     * Finds the minimum in a number array.
     * @param {number[]} arr 
     * @returns {number} Min
     */
    min(arr) {
      if (!arr || arr.length === 0) return 0;
      return Math.min(...arr);
    }
  };
})();
