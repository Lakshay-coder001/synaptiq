window.initHistory = async function() {
  const state = {
    runs: [],
    experiments: new Map(),
    filters: {
      experimentId: 'all',
      status: 'all',
      sort: 'newest'
    },
    lossChart: null,
    accChart: null
  };

  const els = {
    historyContainer: document.getElementById('historyContainer'),
    filterExperiment: document.getElementById('filterExperiment'),
    filterRunStatus: document.getElementById('filterRunStatus'),
    sortRuns: document.getElementById('sortRuns'),
    modalContainer: document.getElementById('modalContainer')
  };

  async function loadData() {
    try {
      state.runs = await Synaptiq.db.runs.getAll();
      const exps = await Synaptiq.db.experiments.getAll();
      
      state.experiments.clear();
      exps.forEach(exp => state.experiments.set(exp.id, exp));

      populateExperimentFilter();
      renderRuns();
    } catch (err) {
      console.error("Failed to load history data", err);
      Synaptiq.utils.showToast("Failed to load history data", "error");
    }
  }

  function populateExperimentFilter() {
    const uniqueExpIds = new Set(state.runs.map(r => r.experimentId));
    
    // keep 'all'
    els.filterExperiment.innerHTML = '<option value="all">All Experiments</option>';
    
    uniqueExpIds.forEach(expId => {
      const exp = state.experiments.get(expId);
      if (exp) {
        const option = document.createElement('option');
        option.value = expId;
        option.textContent = Synaptiq.utils.escapeHtml(exp.name);
        els.filterExperiment.appendChild(option);
      }
    });
  }

  function getFilteredAndSortedRuns() {
    let filtered = state.runs.filter(run => {
      const matchExp = state.filters.experimentId === 'all' || run.experimentId === state.filters.experimentId;
      const matchStatus = state.filters.status === 'all' || run.status === state.filters.status;
      return matchExp && matchStatus;
    });

    filtered.sort((a, b) => {
      switch (state.filters.sort) {
        case 'newest': return b.createdAt - a.createdAt;
        case 'oldest': return a.createdAt - b.createdAt;
        case 'accuracy': return (b.finalAccuracy || 0) - (a.finalAccuracy || 0);
        case 'loss': return (a.finalLoss || 9999) - (b.finalLoss || 9999);
        default: return b.createdAt - a.createdAt;
      }
    });

    return filtered;
  }

  function renderRuns() {
    const runsToRender = getFilteredAndSortedRuns();

    if (runsToRender.length === 0) {
      els.historyContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📜</div>
          <div class="empty-state__title">No training runs yet</div>
          <div class="empty-state__text">Start a training run to see its history here, or adjust your filters.</div>
          <a href="training.html" class="btn btn-primary empty-state__action">Go to Training</a>
        </div>
      `;
      return;
    }

    let html = `
      <table class="data-table history-table" style="width: 100%;">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Experiment</th>
            <th>Status</th>
            <th>Epochs</th>
            <th>Final Loss</th>
            <th>Accuracy</th>
            <th>Duration</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    runsToRender.forEach(run => {
      const exp = state.experiments.get(run.experimentId);
      const expName = exp ? Synaptiq.utils.escapeHtml(exp.name) : 'Unknown';
      const shortId = run.id.substring(0, 8);
      const acc = run.finalAccuracy != null ? Synaptiq.utils.formatPercent(run.finalAccuracy) : '-';
      const loss = run.finalLoss != null ? Synaptiq.utils.formatNumber(run.finalLoss) : '-';
      const dur = run.duration ? Synaptiq.utils.formatDuration(run.duration) : '-';
      const date = Synaptiq.utils.formatDate(run.createdAt);

      html += `
        <tr style="cursor: pointer;" data-run-id="${Synaptiq.utils.escapeHtml(run.id)}">
          <td style="font-family: var(--font-mono); font-size: 0.85em;">${Synaptiq.utils.escapeHtml(shortId)}</td>
          <td>${expName}</td>
          <td><span class="status-chip status-chip--${Synaptiq.utils.escapeHtml(run.status)}">${Synaptiq.utils.escapeHtml(run.status)}</span></td>
          <td>${run.currentEpoch || 0} / ${run.config?.epochs || 0}</td>
          <td style="font-family: var(--font-mono);">${loss}</td>
          <td style="font-family: var(--font-mono);">${acc}</td>
          <td>${dur}</td>
          <td>${date}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    els.historyContainer.innerHTML = html;

    // Attach click events to rows
    els.historyContainer.querySelectorAll('tbody tr').forEach(tr => {
      tr.addEventListener('click', () => {
        openRunDetail(tr.dataset.runId);
      });
    });
  }

  async function openRunDetail(runId) {
    const run = state.runs.find(r => r.id === runId);
    if (!run) return;

    const exp = state.experiments.get(run.experimentId);
    const expName = exp ? exp.name : 'Unknown';
    
    // Fetch metrics
    const metrics = await Synaptiq.db.metrics.getByRun(runId);
    
    const config = run.config || {};

    let modalHtml = `
      <div class="modal-overlay">
        <div class="modal" style="width: 800px; max-width: 95%;">
          <div class="modal-header">
            <h3 class="modal-title">Run Detail: ${Synaptiq.utils.escapeHtml(run.id.substring(0,8))}</h3>
            <button class="modal-close" id="closeModalBtn" aria-label="Close modal">✕</button>
          </div>
          <div class="modal-body run-detail">
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
              <div>
                <strong>Experiment:</strong> ${Synaptiq.utils.escapeHtml(expName)}
              </div>
              <div>
                <span class="status-chip status-chip--${Synaptiq.utils.escapeHtml(run.status)}">${Synaptiq.utils.escapeHtml(run.status)}</span>
              </div>
            </div>

            <div class="run-detail__config card" style="margin-bottom: 1.5rem;">
              <div class="card-header"><h4 class="card-title">Configuration</h4></div>
              <div class="card-body" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.9em;">
                <div><strong>Learning Rate:</strong> ${config.learningRate}</div>
                <div><strong>Epochs:</strong> ${config.epochs}</div>
                <div><strong>Batch Size:</strong> ${config.batchSize}</div>
                <div><strong>Hidden Layers:</strong> ${config.hiddenLayers}</div>
                <div><strong>Neurons:</strong> ${config.neurons}</div>
                <div><strong>Activation:</strong> ${config.activation}</div>
              </div>
            </div>

            <div class="run-detail__metrics card" style="margin-bottom: 1.5rem;">
              <div class="card-header"><h4 class="card-title">Final Metrics</h4></div>
              <div class="card-body metric-grid">
                <div class="metric-item">
                  <div class="metric-label">Loss</div>
                  <div class="metric-value">${run.finalLoss != null ? Synaptiq.utils.formatNumber(run.finalLoss) : '-'}</div>
                </div>
                <div class="metric-item">
                  <div class="metric-label">Accuracy</div>
                  <div class="metric-value">${run.finalAccuracy != null ? Synaptiq.utils.formatPercent(run.finalAccuracy) : '-'}</div>
                </div>
                <div class="metric-item">
                  <div class="metric-label">Val Loss</div>
                  <div class="metric-value">${run.finalValLoss != null ? Synaptiq.utils.formatNumber(run.finalValLoss) : '-'}</div>
                </div>
                <div class="metric-item">
                  <div class="metric-label">Val Accuracy</div>
                  <div class="metric-value">${run.finalValAccuracy != null ? Synaptiq.utils.formatPercent(run.finalValAccuracy) : '-'}</div>
                </div>
              </div>
            </div>

            <div class="card" style="margin-bottom: 1.5rem;">
              <div class="card-header"><h4 class="card-title">Training Loss Chart</h4></div>
              <div class="card-body">
                <div class="chart-canvas-wrapper">
                  <canvas id="detailChart"></canvas>
                </div>
              </div>
            </div>
            
          </div>
          <div class="modal-footer" style="display: flex; justify-content: space-between;">
            <button class="btn btn-danger" id="deleteRunBtn">Delete Run</button>
            <button class="btn btn-secondary" id="closeModalBtn2">Close</button>
          </div>
        </div>
      </div>
    `;

    els.modalContainer.innerHTML = modalHtml;

    // Chart
    const canvas = document.getElementById('detailChart');
    if (canvas && metrics.length > 0) {
      const labels = metrics.map(m => `Ep ${m.epoch}`);
      const lossData = metrics.map(m => m.loss);
      const valLossData = metrics.map(m => m.valLoss);

      Synaptiq.renderer.createChart(canvas, {
        title: 'Run Loss Over Epochs',
        xLabel: 'Epoch',
        yLabel: 'Loss',
        series: [
          { name: 'Train Loss', color: 'hsl(210, 100%, 60%)', data: lossData },
          { name: 'Val Loss', color: 'hsl(38, 95%, 55%)', data: valLossData }
        ],
        yMin: 0
      });
    }

    // Events
    const closeModal = () => { els.modalContainer.innerHTML = ''; };
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('closeModalBtn2').addEventListener('click', closeModal);
    
    document.getElementById('deleteRunBtn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this run?')) {
        await Synaptiq.db.runs.delete(runId);
        await Synaptiq.db.metrics.deleteByRun(runId);
        Synaptiq.utils.showToast("Run deleted", "success");
        closeModal();
        loadData();
      }
    });
  }

  // Event Listeners for Filters
  els.filterExperiment.addEventListener('change', (e) => {
    state.filters.experimentId = e.target.value;
    renderRuns();
  });

  els.filterRunStatus.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    renderRuns();
  });

  els.sortRuns.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderRuns();
  });

  // URL param
  const urlParams = new URLSearchParams(window.location.search);
  const runIdParam = urlParams.get('runId');
  
  await loadData();
  
  if (runIdParam) {
    openRunDetail(runIdParam);
  }
};
