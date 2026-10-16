(function() {
  window.Synaptiq = window.Synaptiq || {};

  const PREFIX = 'synaptiq_';

  Synaptiq.storage = {
    // localStorage
    getPreference(key) {
      try {
        const item = localStorage.getItem(PREFIX + key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error(`Error parsing preference ${key}:`, error);
        return null;
      }
    },

    setPreference(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch (error) {
        console.error(`Error setting preference ${key}:`, error);
      }
    },

    removePreference(key) {
      localStorage.removeItem(PREFIX + key);
    },

    getAllPreferences() {
      const prefs = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) {
          prefs[key.replace(PREFIX, '')] = this.getPreference(key.replace(PREFIX, ''));
        }
      }
      return prefs;
    },

    // Cookies
    setCookie(name, value, days = 30) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      const expires = `expires=${date.toUTCString()}`;
      document.cookie = `${PREFIX}${name}=${value};${expires};path=/;SameSite=Lax`;
    },

    getCookie(name) {
      const cookieName = `${PREFIX}${name}=`;
      const decodedCookie = decodeURIComponent(document.cookie);
      const ca = decodedCookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
          c = c.substring(1);
        }
        if (c.indexOf(cookieName) === 0) {
          return c.substring(cookieName.length, c.length);
        }
      }
      return null;
    },

    deleteCookie(name) {
      document.cookie = `${PREFIX}${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  };

  // Initial set up
  Synaptiq.storage.setCookie('lastVisit', new Date().toISOString());
  if (!Synaptiq.storage.getCookie('sessionId')) {
    Synaptiq.storage.setCookie('sessionId', Math.random().toString(36).substring(2, 15));
  }
})();
