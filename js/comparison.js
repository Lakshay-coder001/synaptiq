window.initComparison = async function() {
  const selectedRuns = new Set();
  
  const state = {
    runs: [],
    experiments: new Map(),
    lossChart: null,
    accChart: null
  };

  const els = {
    runSelector: document.getElementById('runSelector'),
    btnCompare: document.getElementById('btnCompare'),
    comparisonResults: document.getElementById('comparisonResults'),
    comparisonTable: document.getElementById('comparisonTable'),
    lossCompareChart: document.getElementById('lossCompareChart'),
    accCompareChart: document.getElementById('accCompareChart')
  };

  const COMPARISON_COLORS = [
    'hsl(210, 100%, 60%)',  // blue
    'hsl(145, 65%, 48%)',   // green
    'hsl(265, 70%, 62%)',   // purple
    'hsl(38, 95%, 55%)',    // orange
    'hsl(0, 75%, 58%)'      // red
  ];

  async function loadData() {
    try {
      const allRuns = await Synaptiq.db.runs.getAll();
      state.runs = allRuns.filter(r => r.status === 'completed');
      
      const exps = await Synaptiq.db.experiments.getAll();
      state.experiments.clear();
      exps.forEach(exp => state.experiments.set(exp.id, exp));

      renderRunSelector();
    } catch (err) {
      console.error("Failed to load comparison data", err);
      Synaptiq.utils.showToast("Failed to load data for comparison", "error");
    }
  }

  function renderRunSelector() {
    if (!els.runSelector) return;
    if (state.runs.length === 0) {
      els.runSelector.innerHTML = `
        <div class="empty-state comparison-empty">
          <div class="empty-state__icon">⚖️</div>
          <div class="empty-state__title">No completed runs to compare</div>
          <div class="empty-state__text">Finish training multiple runs to compare their results.</div>
        </div>
      `;
      return;
    }

    let html = `
      <table class="data-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 40px;"></th>
            <th>Experiment</th>
            <th>Epochs</th>
            <th>Accuracy</th>
            <th>Loss</th>
            <th>Duration</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    state.runs.sort((a,b) => new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt)).forEach(run => {
      const exp = state.experiments.get(run.experimentId);
      const expName = exp ? Synaptiq.utils.escapeHtml(exp.name) : 'Unknown';
      const isChecked = selectedRuns.has(run.id) ? 'checked' : '';
      const disabled = !isChecked && selectedRuns.size >= 5 ? 'disabled' : '';

      html += `
        <tr>
          <td><input type="checkbox" class="run-checkbox" data-run-id="${Synaptiq.utils.escapeHtml(run.id)}" ${isChecked} ${disabled}></td>
          <td>${expName} <span style="font-family: var(--font-mono); font-size: 0.8em; color: var(--text-secondary);">(${Synaptiq.utils.escapeHtml(run.id.substring(0,6))})</span></td>
          <td>${run.config?.epochs || 0}</td>
          <td style="font-family: var(--font-mono);">${run.finalAccuracy != null ? Synaptiq.utils.formatPercent(run.finalAccuracy) : '-'}</td>
          <td style="font-family: var(--font-mono);">${run.finalLoss != null ? Synaptiq.utils.formatNumber(run.finalLoss) : '-'}</td>
          <td>${run.duration ? Synaptiq.utils.formatDuration(run.duration) : '-'}</td>
          <td>${Synaptiq.utils.formatDate(run.startedAt || run.createdAt)}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    els.runSelector.innerHTML = html;

    // Attach listeners
    els.runSelector.querySelectorAll('.run-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.runId;
        if (e.target.checked) {
          if (selectedRuns.size < 5) selectedRuns.add(id);
          else e.target.checked = false;
        } else {
          selectedRuns.delete(id);
        }
        
        updateCompareButton();
        renderRunSelector();
      });
    });
  }

  function updateCompareButton() {
    if (els.btnCompare) {
      els.btnCompare.disabled = selectedRuns.size < 2;
    }
  }

  if (els.btnCompare) {
    els.btnCompare.addEventListener('click', async () => {
      if (selectedRuns.size < 2) return;
      await renderComparison();
    });
  }

  async function renderComparison() {
    if (els.comparisonResults) {
      els.comparisonResults.classList.remove('hidden');
    }
    const runsToCompare = state.runs.filter(r => selectedRuns.has(r.id));
    
    const metricsMap = new Map();
    const datasetsMap = new Map();
    
    const datasets = await Synaptiq.db.datasets.getAll();
    datasets.forEach(d => datasetsMap.set(d.id, d.name));

    for (const run of runsToCompare) {
      const metrics = await Synaptiq.db.metrics.getByRun(run.id);
      metricsMap.set(run.id, metrics);
    }

    renderComparisonTable(runsToCompare, datasetsMap);
    renderComparisonCharts(runsToCompare, metricsMap);
  }

  function renderComparisonTable(runs, datasetsMap) {
    if (!els.comparisonTable) return;
    const bestAcc = Math.max(...runs.map(r => r.finalAccuracy || -1));
    const bestValAcc = Math.max(...runs.map(r => r.finalValAccuracy || -1));
    const minLossRuns = runs.filter(r => r.finalLoss != null).map(r => r.finalLoss);
    const bestLoss = minLossRuns.length ? Math.min(...minLossRuns) : -1;
    const minValLossRuns = runs.filter(r => r.finalValLoss != null).map(r => r.finalValLoss);
    const bestValLoss = minValLossRuns.length ? Math.min(...minValLossRuns) : -1;

    let html = `
      <thead>
        <tr>
          <th>Metric</th>
          ${runs.map((r, i) => `<th><span style="color: ${COMPARISON_COLORS[i % COMPARISON_COLORS.length]}">■</span> Run ${Synaptiq.utils.escapeHtml(r.id.substring(0,5))}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
    `;

    const addRow = (label, valueGetter, isBestFn = () => false) => {
      html += `<tr><td><strong>${label}</strong></td>`;
      runs.forEach(r => {
        const val = valueGetter(r);
        const isBest = isBestFn(r, val);
        html += `<td class="${isBest ? 'text-success' : ''}" style="${isBest ? 'font-weight: bold;' : ''}">${val}</td>`;
      });
      html += `</tr>`;
    };

    const getDatasetName = r => {
      const exp = state.experiments.get(r.experimentId);
      return exp ? datasetsMap.get(exp.datasetId) || 'Unknown' : 'Unknown';
    };

    addRow('Dataset', getDatasetName);
    addRow('Epochs', r => r.config?.epochs || '-');
    addRow('Learning Rate', r => r.config?.learningRate || '-');
    addRow('Batch Size', r => r.config?.batchSize || '-');
    addRow('Hidden Layers', r => r.config?.hiddenLayers || '-');
    addRow('Neurons', r => r.config?.neurons || r.config?.neuronsPerLayer || '-');
    addRow('Activation', r => r.config?.activation || r.config?.activationFunction || '-');
    
    html += `<tr style="background-color: var(--bg-hover);"><td colspan="${runs.length + 1}"><strong>Results</strong></td></tr>`;

    addRow('Final Loss', 
      r => r.finalLoss != null ? Synaptiq.utils.formatNumber(r.finalLoss, 4) : '-',
      (r, val) => r.finalLoss === bestLoss && bestLoss !== -1
    );
    addRow('Accuracy', 
      r => r.finalAccuracy != null ? Synaptiq.utils.formatPercent(r.finalAccuracy) : '-',
      (r, val) => r.finalAccuracy === bestAcc && bestAcc !== -1
    );
    addRow('Val Loss', 
      r => r.finalValLoss != null ? Synaptiq.utils.formatNumber(r.finalValLoss, 4) : '-',
      (r, val) => r.finalValLoss === bestValLoss && bestValLoss !== -1
    );
    addRow('Val Accuracy', 
      r => r.finalValAccuracy != null ? Synaptiq.utils.formatPercent(r.finalValAccuracy) : '-',
      (r, val) => r.finalValAccuracy === bestValAcc && bestValAcc !== -1
    );
    addRow('Duration', r => r.duration ? Synaptiq.utils.formatDuration(r.duration) : '-');

    html += `</tbody>`;
    els.comparisonTable.innerHTML = html;
  }

  function renderComparisonCharts(runs, metricsMap) {
    if (state.lossChart) state.lossChart.destroy();
    if (state.accChart) state.accChart.destroy();

    const getSeries = (metricKey, isPercent = false) => {
      return runs.map((run, idx) => {
        const metrics = metricsMap.get(run.id) || [];
        return {
          name: `Run ${run.id.substring(0, 5)}`,
          color: COMPARISON_COLORS[idx % COMPARISON_COLORS.length],
          data: metrics.map(m => (isPercent ? (m[metricKey] || 0) * 100 : (m[metricKey] || 0)))
        };
      });
    };

    if (els.lossCompareChart) {
      state.lossChart = Synaptiq.renderer.createChart(els.lossCompareChart, {
        title: 'Loss Comparison Over Epochs',
        xLabel: 'Epoch',
        yLabel: 'Loss',
        series: getSeries('loss'),
        yMin: 0
      });
    }

    if (els.accCompareChart) {
      state.accChart = Synaptiq.renderer.createChart(els.accCompareChart, {
        title: 'Accuracy Comparison (%) Over Epochs',
        xLabel: 'Epoch',
        yLabel: 'Accuracy',
        series: getSeries('accuracy', true),
        yMin: 0,
        yMax: 100
      });
    }
  }

  await loadData();
};
