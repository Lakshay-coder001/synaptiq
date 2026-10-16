function Experiment(config) {
  this.id = config.id || Synaptiq.utils.generateId('exp');
  this.name = config.name;
  this.description = config.description || '';
  this.datasetId = config.datasetId;
  this.modelType = config.modelType || 'feedforward';
  this.learningRate = config.learningRate || 0.01;
  this.epochs = config.epochs || 50;
  this.batchSize = config.batchSize || 4;
  this.hiddenLayers = config.hiddenLayers || 2;
  this.neuronsPerLayer = config.neuronsPerLayer || 8;
  this.activationFunction = config.activationFunction || 'relu';
  this.status = config.status || 'created';
  this.bestAccuracy = config.bestAccuracy || null;
  this.latestLoss = config.latestLoss || null;
  this.runCount = config.runCount || 0;
  this.createdAt = config.createdAt || new Date().toISOString();
  this.updatedAt = config.updatedAt || new Date().toISOString();

  this.config = {
    modelType: this.modelType,
    learningRate: this.learningRate,
    epochs: this.epochs,
    batchSize: this.batchSize,
    hiddenLayers: this.hiddenLayers,
    neuronsPerLayer: this.neuronsPerLayer,
    neurons: this.neuronsPerLayer,
    activationFunction: this.activationFunction,
    activation: this.activationFunction
  };
}

window.initExperiments = async function() {
  let experiments = [];
  let datasets = [];
  let datasetMap = {};
  
  const container = document.getElementById('experimentsContainer');
  const searchInput = document.getElementById('experimentSearch');
  const statusFilter = document.getElementById('filterStatus');
  const btnNewExp = document.getElementById('btnNewExperiment');
  const modalContainer = document.getElementById('modalContainer');

  async function loadData() {
    try {
      experiments = await Synaptiq.db.experiments.getAll();
      datasets = await Synaptiq.db.datasets.getAll();
      datasetMap = datasets.reduce((map, ds) => {
        map[ds.id] = ds.name;
        return map;
      }, {});
      renderExperiments();
    } catch (err) {
      console.error(err);
      Synaptiq.utils.showToast("Failed to load experiments", "error");
    }
  }

  function renderExperiments() {
    const term = searchInput.value.toLowerCase();
    const status = statusFilter.value;

    const filtered = experiments.filter(e => {
      const matchName = e.name.toLowerCase().includes(term);
      const matchStatus = status ? e.status === status : true;
      return matchName && matchStatus;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state__icon">🧪</div>
          <h4 class="empty-state__title">No experiments found</h4>
          <p class="empty-state__text">Try adjusting your search or create a new experiment.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(exp => `
      <div class="card experiment-card" id="exp-${Synaptiq.utils.escapeHtml(exp.id)}">
        <div class="card-header experiment-card__header flex-between">
          <h3 class="experiment-card__title" title="${Synaptiq.utils.escapeHtml(exp.name)}">${Synaptiq.utils.escapeHtml(exp.name)}</h3>
          <span class="status-chip status-chip--${Synaptiq.utils.escapeHtml(exp.status)}">${Synaptiq.utils.escapeHtml(exp.status)}</span>
        </div>
        <div class="card-body experiment-card__body">
          <p class="text-muted" style="font-size: 0.9rem;">${Synaptiq.utils.escapeHtml(exp.description.substring(0, 120) + (exp.description.length > 120 ? '...' : ''))}</p>
          <div class="experiment-card__meta">
            <div><strong>Dataset:</strong> ${Synaptiq.utils.escapeHtml(datasetMap[exp.datasetId] || 'Unknown')}</div>
            <div><strong>Model:</strong> ${exp.hiddenLayers} layers × ${exp.neuronsPerLayer} neurons (${exp.activationFunction || 'sigmoid'})</div>
            <div><strong>Created:</strong> ${Synaptiq.utils.formatDate(exp.createdAt)}</div>
          </div>
        </div>
        <div class="card-footer experiment-card__footer flex gap-2">
          <button class="btn btn-sm btn-primary action-train" data-id="${Synaptiq.utils.escapeHtml(exp.id)}">Train</button>
          <button class="btn btn-sm btn-secondary action-edit" data-id="${Synaptiq.utils.escapeHtml(exp.id)}">Edit</button>
          <button class="btn btn-sm btn-danger action-delete" data-id="${Synaptiq.utils.escapeHtml(exp.id)}">Delete</button>
        </div>
      </div>
    `).join('');
  }

  function openModal(title, bodyHTML, footerHTML) {
    modalContainer.innerHTML = `
      <div class="modal-overlay" id="activeModalOverlay">
        <div class="modal">
          <div class="modal-header flex-between">
            <h3 class="modal-title">${Synaptiq.utils.escapeHtml(title)}</h3>
            <button class="modal-close btn btn-icon" id="btnCloseExpModal" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">${bodyHTML}</div>
          <div class="modal-footer flex-end gap-2">${footerHTML}</div>
        </div>
      </div>
    `;
    
    const closeBtn = document.getElementById('btnCloseExpModal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const overlay = document.getElementById('activeModalOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
      });
    }
  }

  function closeModal() {
    modalContainer.innerHTML = '';
  }

  async function openExperimentForm(experiment = null) {
    const isEdit = !!experiment;
    const title = isEdit ? 'Edit Experiment' : 'New Experiment';
    
    if (!datasets || datasets.length === 0) {
      datasets = await Synaptiq.db.datasets.getAll();
    }

    let datasetOptions = datasets.map(ds => 
      `<option value="${Synaptiq.utils.escapeHtml(ds.id)}" ${experiment && experiment.datasetId === ds.id ? 'selected' : ''}>${Synaptiq.utils.escapeHtml(ds.name)}</option>`
    ).join('');

    const bodyHTML = `
      <form id="experimentForm">
        <div class="form-group">
          <label class="form-label" for="expName">Name *</label>
          <input type="text" class="form-input" id="expName" value="${isEdit ? Synaptiq.utils.escapeHtml(experiment.name) : ''}" required>
          <div class="form-error" id="err-expName"></div>
        </div>
        <div class="form-group">
          <label class="form-label" for="expDesc">Description</label>
          <textarea class="form-textarea" id="expDesc" rows="2">${isEdit ? Synaptiq.utils.escapeHtml(experiment.description) : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="expDataset">Dataset *</label>
          <select class="form-select" id="expDataset" required>
            ${datasetOptions}
          </select>
          <div class="form-error" id="err-expDataset"></div>
        </div>
        <div class="form-group">
          <label class="form-label" for="expModelType">Model Type</label>
          <select class="form-select" id="expModelType">
            <option value="feedforward">Feedforward Neural Network</option>
          </select>
        </div>
        <div class="grid-2 gap-2">
          <div class="form-group">
            <label class="form-label" for="expLR">Learning Rate</label>
            <input type="number" class="form-input" id="expLR" step="0.001" value="${isEdit ? experiment.learningRate : '0.01'}" required>
            <div class="form-error" id="err-expLearningRate"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="expEpochs">Epochs</label>
            <input type="number" class="form-input" id="expEpochs" value="${isEdit ? experiment.epochs : '50'}" required>
            <div class="form-error" id="err-expEpochs"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="expBatchSize">Batch Size</label>
            <input type="number" class="form-input" id="expBatchSize" value="${isEdit ? experiment.batchSize : '4'}" required>
            <div class="form-error" id="err-expBatchSize"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="expHiddenLayers">Hidden Layers</label>
            <input type="number" class="form-input" id="expHiddenLayers" value="${isEdit ? experiment.hiddenLayers : '2'}" required>
            <div class="form-error" id="err-expHiddenLayers"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="expNeurons">Neurons Per Layer</label>
            <input type="number" class="form-input" id="expNeurons" value="${isEdit ? experiment.neuronsPerLayer : '8'}" required>
            <div class="form-error" id="err-expNeuronsPerLayer"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="expActivation">Activation Function</label>
            <select class="form-select" id="expActivation">
              <option value="sigmoid" ${isEdit && experiment.activationFunction === 'sigmoid' ? 'selected' : ''}>Sigmoid</option>
              <option value="tanh" ${isEdit && experiment.activationFunction === 'tanh' ? 'selected' : ''}>Tanh</option>
              <option value="relu" ${isEdit && experiment.activationFunction === 'relu' ? 'selected' : (!isEdit ? 'selected' : '')}>ReLU</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footerHTML = `
      <button class="btn btn-ghost" id="btnCancelExp">Cancel</button>
      <button class="btn btn-primary" id="btnSaveExp">Save</button>
    `;

    openModal(title, bodyHTML, footerHTML);

    document.getElementById('btnCancelExp').addEventListener('click', closeModal);
    document.getElementById('btnSaveExp').addEventListener('click', async () => {
      document.querySelectorAll('.form-error').forEach(el => el.textContent = '');

      const data = {
        name: document.getElementById('expName').value.trim(),
        description: document.getElementById('expDesc').value.trim(),
        datasetId: document.getElementById('expDataset').value,
        modelType: document.getElementById('expModelType').value,
        learningRate: parseFloat(document.getElementById('expLR').value),
        epochs: parseInt(document.getElementById('expEpochs').value, 10),
        batchSize: parseInt(document.getElementById('expBatchSize').value, 10),
        hiddenLayers: parseInt(document.getElementById('expHiddenLayers').value, 10),
        neuronsPerLayer: parseInt(document.getElementById('expNeurons').value, 10),
        activationFunction: document.getElementById('expActivation').value,
      };

      const valResult = Synaptiq.utils.validateExperiment ? Synaptiq.utils.validateExperiment(data) : { valid: true, errors: {} };
      if (!valResult.valid) {
        for (const [key, msg] of Object.entries(valResult.errors)) {
          const errEl = document.getElementById(`err-exp${key.charAt(0).toUpperCase() + key.slice(1)}`);
          if (errEl) errEl.textContent = msg;
        }
        return;
      }

      if (isEdit) {
        const updated = { ...experiment, ...data, updatedAt: new Date().toISOString() };
        await Synaptiq.db.experiments.update(updated);
        if (Synaptiq.utils.showToast) Synaptiq.utils.showToast("Experiment updated", "success");
      } else {
        const newExp = new Experiment(data);
        await Synaptiq.db.experiments.create(newExp);
        if (Synaptiq.utils.showToast) Synaptiq.utils.showToast("Experiment created", "success");
      }

      closeModal();
      await loadData();
    });
  }

  function openDeleteConfirmation(experiment) {
    const bodyHTML = `<p>Delete experiment <strong>${Synaptiq.utils.escapeHtml(experiment.name)}</strong>? This will also delete all associated training runs.</p>`;
    const footerHTML = `
      <button class="btn btn-ghost" id="btnCancelDel">Cancel</button>
      <button class="btn btn-danger" id="btnConfirmDel">Delete</button>
    `;
    
    openModal("Delete Experiment", bodyHTML, footerHTML);
    
    document.getElementById('btnCancelDel').addEventListener('click', closeModal);
    document.getElementById('btnConfirmDel').addEventListener('click', async () => {
      await Synaptiq.db.experiments.delete(experiment.id);
      if (Synaptiq.utils.showToast) Synaptiq.utils.showToast("Experiment deleted", "success");
      closeModal();
      await loadData();
    });
  }

  if (Synaptiq.utils.debounce) {
    searchInput.addEventListener('input', Synaptiq.utils.debounce(renderExperiments, 300));
  } else {
    searchInput.addEventListener('input', renderExperiments);
  }
  
  statusFilter.addEventListener('change', renderExperiments);
  btnNewExp.addEventListener('click', () => openExperimentForm());

  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('action-train')) {
      const id = e.target.dataset.id;
      window.location.href = `training.html?id=${encodeURIComponent(id)}`;
    } else if (e.target.classList.contains('action-edit')) {
      const id = e.target.dataset.id;
      const exp = experiments.find(x => x.id === id);
      if (exp) openExperimentForm(exp);
    } else if (e.target.classList.contains('action-delete')) {
      const id = e.target.dataset.id;
      const exp = experiments.find(x => x.id === id);
      if (exp) openDeleteConfirmation(exp);
    }
  });

  await loadData();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'create') {
    openExperimentForm();
  } else if (urlParams.get('id')) {
    const el = document.getElementById(`exp-${urlParams.get('id')}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
};
