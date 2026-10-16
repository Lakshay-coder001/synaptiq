window.initDashboard = async function() {
  try {
    const experiments = await Synaptiq.db.experiments.getAll();
    const runs = await Synaptiq.db.runs.getAll();
    const datasets = await Synaptiq.db.datasets.getAll();
    
    const datasetMap = datasets.reduce((map, ds) => {
      map[ds.id] = ds.name;
      return map;
    }, {});
    
    const experimentMap = experiments.reduce((map, ex) => {
      map[ex.id] = ex.name;
      return map;
    }, {});

    const totalExps = experiments.length;
    const runningExps = experiments.filter(e => e.status === 'training').length;
    const completedRuns = runs.filter(r => r.status === 'completed');
    
    let bestAcc = 0;
    const completedAccuracies = completedRuns
      .map(r => r.finalAccuracy != null ? r.finalAccuracy : r.accuracy)
      .filter(a => a != null);

    if (completedAccuracies.length > 0) {
      bestAcc = Math.max(...completedAccuracies);
    } else {
      const expAccuracies = experiments.map(e => e.bestAccuracy).filter(a => a != null);
      if (expAccuracies.length > 0) {
        bestAcc = Math.max(...expAccuracies);
      }
    }

    const hasAccuracy = completedAccuracies.length > 0 || experiments.some(e => e.bestAccuracy != null);

    document.getElementById('statTotalExperiments').textContent = Synaptiq.utils.formatNumber(totalExps, 0);
    document.getElementById('statRunningExperiments').textContent = Synaptiq.utils.formatNumber(runningExps, 0);
    document.getElementById('statCompletedRuns').textContent = Synaptiq.utils.formatNumber(completedRuns.length, 0);
    document.getElementById('statBestAccuracy').textContent = hasAccuracy ? Synaptiq.utils.formatPercent(bestAcc) : 'N/A';

    const recentExpContainer = document.getElementById('recentExperiments');
    if (experiments.length === 0) {
      recentExpContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🧪</div>
          <h4 class="empty-state__title">No experiments yet</h4>
          <p class="empty-state__text">Create your first experiment to get started.</p>
          <a href="experiments.html?action=create" class="btn btn-primary empty-state__action">+ New Experiment</a>
        </div>
      `;
    } else {
      const recentExps = experiments.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
      
      let tableHtml = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Dataset</th>
                <th>Status</th>
                <th>Accuracy</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      recentExps.forEach(exp => {
        tableHtml += `
          <tr data-id="${Synaptiq.utils.escapeHtml(exp.id)}">
            <td>${Synaptiq.utils.escapeHtml(exp.name)}</td>
            <td>${Synaptiq.utils.escapeHtml(datasetMap[exp.datasetId] || 'Unknown')}</td>
            <td><span class="status-chip status-chip--${Synaptiq.utils.escapeHtml(exp.status)}">${Synaptiq.utils.escapeHtml(exp.status)}</span></td>
            <td>${exp.bestAccuracy ? Synaptiq.utils.formatPercent(exp.bestAccuracy) : '-'}</td>
            <td>${Synaptiq.utils.formatDate(exp.updatedAt)}</td>
          </tr>
        `;
      });
      
      tableHtml += `</tbody></table></div>`;
      recentExpContainer.innerHTML = tableHtml;
    }

    const recentRunContainer = document.getElementById('recentRuns');
    if (runs.length === 0) {
      recentRunContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🔄</div>
          <h4 class="empty-state__title">No runs yet</h4>
          <p class="empty-state__text">Start training an experiment to see results here.</p>
        </div>
      `;
    } else {
      const recentRunsList = runs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
      
      let tableHtml = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Experiment</th>
                <th>Accuracy</th>
                <th>Loss</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      recentRunsList.forEach(run => {
        const runAccuracy = run.finalAccuracy != null ? run.finalAccuracy : run.accuracy;
        const runLoss = run.finalLoss != null ? run.finalLoss : run.loss;
        tableHtml += `
          <tr>
            <td class="mono">${Synaptiq.utils.escapeHtml(run.id.substring(0, 8))}</td>
            <td>${Synaptiq.utils.escapeHtml(experimentMap[run.experimentId] || 'Unknown')}</td>
            <td>${runAccuracy != null ? Synaptiq.utils.formatPercent(runAccuracy) : '-'}</td>
            <td>${runLoss != null ? Synaptiq.utils.formatNumber(runLoss, 4) : '-'}</td>
            <td>${run.duration != null ? Synaptiq.utils.formatDuration(run.duration) : '-'}</td>
            <td><span class="status-chip status-chip--${Synaptiq.utils.escapeHtml(run.status)}">${Synaptiq.utils.escapeHtml(run.status)}</span></td>
          </tr>
        `;
      });
      
      tableHtml += `</tbody></table></div>`;
      recentRunContainer.innerHTML = tableHtml;
    }
  } catch (error) {
    console.error("Dashboard initialization error:", error);
    Synaptiq.utils.showToast("Failed to load dashboard data", "error");
  }
};