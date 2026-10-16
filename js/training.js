window.initTraining = async function() {
  let worker = null;
  let currentExperiment = null;
  let currentRun = null;
  let trainingState = 'ready'; // 'ready' | 'training' | 'paused' | 'stopped' | 'completed' | 'error'
  let epochMetrics = []; // collected during training
  let lossChart = null;
  let accuracyChart = null;
  let trainingTimer = null;
  let trainingStartTime = null;
  let totalPausedTime = 0;
  let lastPauseTime = null;

  // Chart data series
  const chartData = {
    loss: [], valLoss: [], accuracy: [], valAccuracy: []
  };

  // UI Elements
  const els = {
    experimentSelect: document.getElementById('experimentSelect'),
    statusDisplay: document.getElementById('trainingStatusDisplay'),
    experimentInfo: document.getElementById('experimentInfo'),
    infoName: document.getElementById('infoName'),
    infoDataset: document.getElementById('infoDataset'),
    infoConfig: document.getElementById('infoConfig'),
    btnStart: document.getElementById('btnStart'),
    btnPause: document.getElementById('btnPause'),
    btnResume: document.getElementById('btnResume'),
    btnStop: document.getElementById('btnStop'),
    epochDisplay: document.getElementById('epochDisplay'),
    progressBarFill: document.getElementById('progressBarFill'),
    trainingTime: document.getElementById('trainingTime'),
    metricLoss: document.getElementById('metricLoss'),
    metricAccuracy: document.getElementById('metricAccuracy'),
    metricValLoss: document.getElementById('metricValLoss'),
    metricValAccuracy: document.getElementById('metricValAccuracy'),
    epochLogBody: document.getElementById('epochLogBody')
  };

  // 1. Initialize charts FIRST
  lossChart = Synaptiq.renderer.createChart(document.getElementById('lossChart'), {
    title: 'Loss Over Epochs',
    xLabel: 'Epoch',
    yLabel: 'Loss',
    series: [
      { name: 'Training', color: 'hsl(210, 100%, 60%)', data: chartData.loss },
      { name: 'Validation', color: 'hsl(265, 70%, 62%)', data: chartData.valLoss }
    ],
    yMin: 0
  });

  accuracyChart = Synaptiq.renderer.createChart(document.getElementById('accuracyChart'), {
    title: 'Accuracy Over Epochs',
    xLabel: 'Epoch',
    yLabel: 'Accuracy',
    series: [
      { name: 'Training', color: 'hsl(145, 70%, 45%)', data: chartData.accuracy },
      { name: 'Validation', color: 'hsl(30, 90%, 55%)', data: chartData.valAccuracy }
    ],
    yMin: 0,
    yMax: 100
  });

  // 2. Load experiments and populate dropdown
  const experiments = await Synaptiq.db.experiments.getAll();
  els.experimentSelect.innerHTML = '<option value="">Select an Experiment...</option>';
  experiments.forEach(exp => {
    const opt = document.createElement('option');
    opt.value = exp.id;
    opt.textContent = exp.name;
    els.experimentSelect.appendChild(opt);
  });

  // 3. Check URL params or auto-select first experiment
  const urlParams = new URLSearchParams(window.location.search);
  const selectedId = urlParams.get('id');
  if (selectedId && experiments.some(e => e.id === selectedId)) {
    els.experimentSelect.value = selectedId;
    await loadExperimentDetails(selectedId);
  } else if (experiments.length > 0) {
    els.experimentSelect.value = experiments[0].id;
    await loadExperimentDetails(experiments[0].id);
  } else {
    updateUIState('ready');
  }

  // Event Listeners
  els.experimentSelect.addEventListener('change', async (e) => {
    if (e.target.value) {
      await loadExperimentDetails(e.target.value);
    } else {
      currentExperiment = null;
      els.experimentInfo.classList.add('hidden');
      const wrapper = document.getElementById('infoConfigWrapper');
      if (wrapper) wrapper.classList.add('hidden');
      updateUIState('ready');
    }
  });

  els.btnStart.addEventListener('click', startTraining);
  els.btnPause.addEventListener('click', pauseTraining);
  els.btnResume.addEventListener('click', resumeTraining);
  els.btnStop.addEventListener('click', stopTraining);

  async function loadExperimentDetails(id) {
    try {
      currentExperiment = await Synaptiq.db.experiments.get(id);
      if (!currentExperiment) return;

      let dataset = null;
      if (currentExperiment.datasetId) {
        dataset = await Synaptiq.db.datasets.get(currentExperiment.datasetId);
      }
      
      const lr = currentExperiment.learningRate || (currentExperiment.config && currentExperiment.config.learningRate) || 0.01;
      const modelT = currentExperiment.modelType || (currentExperiment.config && currentExperiment.config.modelType) || 'Neural Network';
      const ep = currentExperiment.epochs || (currentExperiment.config && currentExperiment.config.epochs) || 50;
      const hl = currentExperiment.hiddenLayers || (currentExperiment.config && currentExperiment.config.hiddenLayers) || 1;
      const npl = currentExperiment.neuronsPerLayer || (currentExperiment.config && currentExperiment.config.neuronsPerLayer) || 8;
      const act = currentExperiment.activationFunction || (currentExperiment.config && currentExperiment.config.activationFunction) || 'sigmoid';

      els.infoName.textContent = currentExperiment.name;
      els.infoDataset.textContent = `Dataset: ${dataset ? dataset.name : (currentExperiment.datasetId || 'XOR Gate')}`;
      els.infoConfig.innerHTML = `Model: ${modelT} | Hidden Layers: ${hl} | Neurons: ${npl} | Epochs: ${ep} | LR: ${lr} | Activation: ${act}`;
      
      els.experimentInfo.classList.remove('hidden');
      const wrapper = document.getElementById('infoConfigWrapper');
      if (wrapper) wrapper.classList.remove('hidden');
      
      // Reset UI for new run
      resetTrainingUI();
      updateUIState('ready');
      els.btnStart.disabled = false;
    } catch (err) {
      console.error('Error loading experiment details:', err);
      Synaptiq.utils.showToast('Failed to load experiment details', 'error');
    }
  }

  function resetTrainingUI() {
    epochMetrics = [];
    chartData.loss.length = 0;
    chartData.valLoss.length = 0;
    chartData.accuracy.length = 0;
    chartData.valAccuracy.length = 0;
    
    if (lossChart) lossChart.update([chartData.loss, chartData.valLoss]);
    if (accuracyChart) accuracyChart.update([chartData.accuracy, chartData.valAccuracy]);
    
    els.epochDisplay.textContent = `0 / ${currentExperiment ? currentExperiment.epochs : 0}`;
    els.progressBarFill.style.width = '0%';
    els.trainingTime.textContent = '00:00.0';
    els.metricLoss.textContent = '0.0000';
    els.metricAccuracy.textContent = '0.0%';
    els.metricValLoss.textContent = '0.0000';
    els.metricValAccuracy.textContent = '0.0%';
    els.epochLogBody.innerHTML = '';
  }

  async function startTraining() {
    if (!currentExperiment) return;

    try {
      const dataset = await Synaptiq.db.datasets.get(currentExperiment.datasetId);
      if (!dataset || !dataset.data || dataset.data.length === 0) {
        throw new Error('Dataset is invalid or empty.');
      }

      // Map output to target for worker
      const mappedData = dataset.data.map(d => ({ input: d.input, target: d.output }));
      
      // Determine IO sizes matching sample feature and target array lengths
      const inputSize = dataset.data[0].input.length;
      const outputSize = dataset.data[0].output.length;

      const config = {
        modelType: currentExperiment.modelType || 'feedforward',
        learningRate: currentExperiment.learningRate || 0.01,
        epochs: currentExperiment.epochs || 50,
        batchSize: currentExperiment.batchSize || 4,
        hiddenLayers: currentExperiment.hiddenLayers || 1,
        neuronsPerLayer: currentExperiment.neuronsPerLayer || 8,
        neurons: currentExperiment.neuronsPerLayer || 8,
        activationFunction: currentExperiment.activationFunction || 'sigmoid',
        activation: currentExperiment.activationFunction || 'sigmoid',
        inputSize,
        outputSize
      };

      currentRun = {
        id: Synaptiq.utils.generateId('run'),
        experimentId: currentExperiment.id,
        config: config,
        status: 'running',
        currentEpoch: 0,
        totalEpochs: config.epochs,
        startedAt: new Date().toISOString()
      };

      await Synaptiq.db.runs.create(currentRun);
      
      currentExperiment.status = 'training';
      await Synaptiq.db.experiments.update(currentExperiment);

      resetTrainingUI();

      worker = new Worker('js/worker.js');
      worker.onmessage = handleWorkerMessage;
      
      worker.postMessage({
        type: 'START_TRAINING',
        config: config,
        epochs: config.epochs,
        dataset: mappedData,
        experimentId: currentExperiment.id,
        runId: currentRun.id
      });

      trainingStartTime = Date.now();
      totalPausedTime = 0;
      startTimer();
      updateUIState('training');

    } catch (err) {
      console.error(err);
      Synaptiq.utils.showToast(err.message, 'error');
    }
  }

  function pauseTraining() {
    if (worker) {
      worker.postMessage({ type: 'PAUSE_TRAINING' });
    }
  }

  function resumeTraining() {
    if (worker) {
      worker.postMessage({ type: 'RESUME_TRAINING' });
    }
  }

  function stopTraining() {
    if (worker) {
      worker.postMessage({ type: 'STOP_TRAINING' });
    }
  }

  async function handleWorkerMessage(event) {
    const msg = event.data;
    const payload = msg.payload || msg;
    switch (msg.type) {
      case 'TRAINING_STARTED':
        break;
      case 'EPOCH_UPDATE':
        await handleEpochUpdate(payload);
        break;
      case 'TRAINING_PAUSED':
        handlePaused();
        break;
      case 'TRAINING_RESUMED':
        handleResumed();
        break;
      case 'TRAINING_STOPPED':
        await handleStopped();
        break;
      case 'TRAINING_COMPLETED':
        await handleCompleted(payload);
        break;
      case 'TRAINING_ERROR':
        handleError(payload);
        break;
    }
  }

  async function handleEpochUpdate(data) {
    const { epoch, loss, accuracy, valLoss, valAccuracy } = data;
    currentRun.currentEpoch = epoch;

    els.epochDisplay.textContent = `${epoch} / ${currentRun.totalEpochs}`;
    els.progressBarFill.style.width = `${(epoch / currentRun.totalEpochs) * 100}%`;

    els.metricLoss.textContent = Synaptiq.utils.formatNumber(loss, 4);
    els.metricAccuracy.textContent = Synaptiq.utils.formatPercent(accuracy);
    els.metricValLoss.textContent = valLoss !== undefined ? Synaptiq.utils.formatNumber(valLoss, 4) : '-';
    els.metricValAccuracy.textContent = valAccuracy !== undefined ? Synaptiq.utils.formatPercent(valAccuracy) : '-';

    chartData.loss.push(loss);
    chartData.valLoss.push(valLoss !== undefined ? valLoss : loss); // fallback for simplicity
    chartData.accuracy.push(accuracy * 100);
    chartData.valAccuracy.push(valAccuracy !== undefined ? valAccuracy * 100 : accuracy * 100);

    lossChart.update([chartData.loss, chartData.valLoss]);
    accuracyChart.update([chartData.accuracy, chartData.valAccuracy]);

    // Add to log
    const tr = document.createElement('tr');
    const displayTime = getTrainingTimeMs();
    tr.innerHTML = `
      <td>${epoch}</td>
      <td>${Synaptiq.utils.formatDuration(displayTime)}</td>
      <td>${Synaptiq.utils.formatNumber(loss, 4)}</td>
      <td>${Synaptiq.utils.formatPercent(accuracy)}</td>
      <td>${valLoss !== undefined ? Synaptiq.utils.formatNumber(valLoss, 4) : '-'}</td>
      <td>${valAccuracy !== undefined ? Synaptiq.utils.formatPercent(valAccuracy) : '-'}</td>
    `;
    els.epochLogBody.prepend(tr);

    // Save metric to DB
    const metricDoc = {
      runId: currentRun.id,
      epoch,
      loss,
      accuracy,
      valLoss,
      valAccuracy,
      timestamp: new Date().toISOString()
    };
    await Synaptiq.db.metrics.save(metricDoc);
  }

  async function handleCompleted(data) {
    stopTimer();
    updateUIState('completed');
    
    currentRun.status = 'completed';
    if (data) {
      currentRun.finalLoss = data.finalLoss !== undefined ? data.finalLoss : data.loss;
      currentRun.finalAccuracy = data.finalAccuracy !== undefined ? data.finalAccuracy : data.accuracy;
      currentRun.finalValLoss = data.finalValLoss !== undefined ? data.finalValLoss : data.valLoss;
      currentRun.finalValAccuracy = data.finalValAccuracy !== undefined ? data.finalValAccuracy : data.valAccuracy;
      currentRun.loss = currentRun.finalLoss;
      currentRun.accuracy = currentRun.finalAccuracy;
      currentRun.duration = data.duration !== undefined ? data.duration : (trainingStartTime ? Date.now() - trainingStartTime - totalPausedTime : 0);
    }
    await Synaptiq.db.runs.update(currentRun);

    currentExperiment.status = 'completed';
    if (currentRun.finalAccuracy != null && (!currentExperiment.bestAccuracy || currentRun.finalAccuracy > currentExperiment.bestAccuracy)) {
      currentExperiment.bestAccuracy = currentRun.finalAccuracy;
    }
    await Synaptiq.db.experiments.update(currentExperiment);

    Synaptiq.utils.showToast('Training completed successfully!', 'success');
    cleanupWorker();
  }

  function handlePaused() {
    lastPauseTime = Date.now();
    stopTimer();
    updateUIState('paused');
  }

  function handleResumed() {
    if (lastPauseTime) {
      totalPausedTime += (Date.now() - lastPauseTime);
      lastPauseTime = null;
    }
    startTimer();
    updateUIState('training');
  }

  async function handleStopped() {
    stopTimer();
    updateUIState('stopped');
    currentRun.status = 'stopped';
    await Synaptiq.db.runs.update(currentRun);
    
    currentExperiment.status = 'stopped';
    await Synaptiq.db.experiments.update(currentExperiment);
    
    cleanupWorker();
  }

  function handleError(err) {
    stopTimer();
    updateUIState('error');
    Synaptiq.utils.showToast(err.message || 'Error during training', 'error');
    if (currentRun) {
      currentRun.status = 'error';
      Synaptiq.db.runs.update(currentRun);
    }
    cleanupWorker();
  }

  function cleanupWorker() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }

  function startTimer() {
    if (!trainingTimer) {
      trainingTimer = setInterval(() => {
        const ms = getTrainingTimeMs();
        els.trainingTime.textContent = Synaptiq.utils.formatDuration(ms);
      }, 100);
    }
  }

  function stopTimer() {
    if (trainingTimer) {
      clearInterval(trainingTimer);
      trainingTimer = null;
    }
  }

  function getTrainingTimeMs() {
    if (!trainingStartTime) return 0;
    const now = lastPauseTime ? lastPauseTime : Date.now();
    return now - trainingStartTime - totalPausedTime;
  }

  function updateUIState(state) {
    trainingState = state;
    els.statusDisplay.className = `status-chip status-chip--${state}`;
    els.statusDisplay.textContent = state.charAt(0).toUpperCase() + state.slice(1);

    switch (state) {
      case 'ready':
        els.btnStart.disabled = !currentExperiment;
        els.btnPause.disabled = true;
        els.btnStop.disabled = true;
        els.btnResume.classList.add('hidden');
        els.btnPause.classList.remove('hidden');
        break;
      case 'training':
        els.btnStart.disabled = true;
        els.btnPause.disabled = false;
        els.btnStop.disabled = false;
        els.btnResume.classList.add('hidden');
        els.btnPause.classList.remove('hidden');
        break;
      case 'paused':
        els.btnStart.disabled = true;
        els.btnPause.classList.add('hidden');
        els.btnResume.classList.remove('hidden');
        els.btnResume.disabled = false;
        els.btnStop.disabled = false;
        break;
      case 'completed':
      case 'stopped':
      case 'error':
        els.btnStart.disabled = false; // allow restart
        els.btnPause.disabled = true;
        els.btnStop.disabled = true;
        els.btnResume.classList.add('hidden');
        els.btnPause.classList.remove('hidden');
        break;
    }
  }
};
