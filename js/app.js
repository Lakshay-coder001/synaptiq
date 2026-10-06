(function() {
  window.Synaptiq = window.Synaptiq || {};

  async function seedDatasets() {
    try {
      const existing = await Synaptiq.db.datasets.getAll();
      if (existing.length === 0) {
        const datasetsMeta = await Synaptiq.api.loadDatasets();
        const datasetsList = Array.isArray(datasetsMeta) ? datasetsMeta : (datasetsMeta.datasets || []);
        for (const meta of datasetsList) {
          if (meta.id === 'iris' || meta.id === 'ds_iris') {
            const irisData = await Synaptiq.api.loadIrisData();
            if (irisData && irisData.length > 0) {
              meta.data = irisData;
            }
          }
          await Synaptiq.db.datasets.create(meta);
        }
      }

      const existingExps = await Synaptiq.db.experiments.getAll();
      if (existingExps.length === 0) {
        const demoExp = {
          id: 'exp_xor_demo',
          name: 'XOR Logic Classifier',
          description: 'A 2-layer neural network designed to learn non-linear XOR logic gate decision boundaries.',
          datasetId: 'xor',
          modelType: 'feedforward',
          learningRate: 0.1,
          epochs: 100,
          batchSize: 4,
          hiddenLayers: 1,
          neuronsPerLayer: 4,
          activationFunction: 'sigmoid',
          status: 'created',
          bestAccuracy: null,
          latestLoss: null,
          runCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await Synaptiq.db.experiments.create(demoExp);
      }
    } catch (err) {
      console.error('Failed during seeding:', err);
    }
  }

  async function initApp() {
    let page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    if (page === 'index') page = 'dashboard';
    Synaptiq.state.set('currentPage', page);

    try {
      await Synaptiq.db.open();
      await Synaptiq.api.loadConfig();
      await seedDatasets();
    } catch (e) {
      console.error('Initialization error:', e);
    }

    // const theme = Synaptiq.storage.getPreference('theme') || 'dark';
    // Synaptiq.state.set('theme', theme);
    // document.body.classList.toggle('dark-theme', theme === 'dark');

    const sidebarCollapsed = Synaptiq.storage.getPreference('sidebarCollapsed') || false;
    Synaptiq.state.set('sidebarCollapsed', sidebarCollapsed);
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebarCollapsed) {
      sidebar.classList.add('sidebar--collapsed');
    }

    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('sidebar--collapsed');
        Synaptiq.state.set('sidebarCollapsed', isCollapsed);
        Synaptiq.storage.setPreference('sidebarCollapsed', isCollapsed);
      });
    }

    const mobileToggle = document.getElementById('mobileSidebarToggle');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar--mobile-open');
      });
    }

    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href.includes(page) || (page === 'dashboard' && href === 'index.html'))) {
        const item = link.closest('.nav-item');
        if (item) item.classList.add('nav-item--active');
      }
    });
    if (page === 'dashboard' && window.initDashboard) window.initDashboard();
    if (page === 'experiment' && window.initExperiments) window.initExperiments();
    if (page === 'training' && window.initTraining) window.initTraining();
    if (page === 'history' && window.initHistory) window.initHistory();
    if (page === 'dataset' && window.initDatasets) window.initDatasets();
    if (page === 'comparison' && window.initComparison) window.initComparison();
    
    console.log('App initialized.');
  }
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded macrotask fired.');
    initApp();
  });

  Synaptiq.initApp = initApp;
})();
