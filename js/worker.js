importScripts('model.js');

// Web Worker execution context (no DOM, separate thread)
// State variables for managing the training process
let currentModel = null;
let trainingState = 'idle'; // 'idle' | 'training' | 'paused' | 'stopping'
let shouldPause = false;
let shouldStop = false;
let currentEpoch = 0;

// Generator function for epoch iteration
// yield enables pause points within the loop
function* epochGenerator(totalEpochs) {
  for (let epoch = 1; epoch <= totalEpochs; epoch++) {
    yield epoch;
  }
}

// Callback function for handling incoming messages from the main thread
self.onmessage = function(event) {
  const data = event.data;
  switch (data.type) {
    case 'START_TRAINING': handleStartTraining(data); break;
    case 'PAUSE_TRAINING': handlePauseTraining(); break;
    case 'RESUME_TRAINING': handleResumeTraining(); break;
    case 'STOP_TRAINING': handleStopTraining(); break;
  }
};

function handleStartTraining(data) {
  const payload = data.payload || data;
  const { experimentId, runId, config, dataset } = payload;
  
  trainingState = 'training';
  shouldPause = false;
  shouldStop = false;
  
  postMessage({ type: 'TRAINING_STARTED', experimentId, runId });
  
  try {
    if (!config || !dataset) {
      throw new Error('Worker received invalid training parameters (config or dataset missing)');
    }

    currentModel = self.Synaptiq.createModel(config);
    const { trainData, valData } = self.Synaptiq.preprocessDataset(dataset, config);
    const totalEpochs = config.epochs || payload.epochs || 50;
    const generator = epochGenerator(totalEpochs);
    
    runTrainingLoop(currentModel, trainData, valData, generator, config);
  } catch (error) {
    console.error('Worker error:', error);
    postMessage({ type: 'TRAINING_ERROR', message: error.message });
    trainingState = 'idle';
  }
}

function handlePauseTraining() {
  if (trainingState === 'training') {
    shouldPause = true;
  }
}

function handleResumeTraining() {
  if (trainingState === 'paused') {
    shouldPause = false;
    trainingState = 'training';
  }
}

function handleStopTraining() {
  shouldStop = true;
  shouldPause = false; // Unblock if paused
}

// Inline shuffle since we don't import from utils
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// This uses setTimeout (macrotask) to create a polling loop. 
// The event loop processes incoming messages (RESUME/STOP) between poll checks.
function waitForResume() {
  return new Promise(resolve => {
    const check = () => {
      if (!shouldPause || shouldStop) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function postStopMessage(epoch, epochMetrics, startTime) {
  const duration = Date.now() - startTime;
  const finalMetrics = epochMetrics.length > 0 ? epochMetrics[epochMetrics.length - 1] : null;
  
  postMessage({
    type: 'TRAINING_STOPPED',
    epoch,
    metrics: finalMetrics,
    duration,
    modelWeights: currentModel.getWeights()
  });
  trainingState = 'idle';
}

// The core training loop using async/await and generators
async function runTrainingLoop(model, trainData, valData, generator, config) {
  const startTime = Date.now();
  let epochMetrics = [];
  
  try {
    for (const epoch of generator) {
      if (shouldStop) {
        postStopMessage(epoch, epochMetrics, startTime);
        return;
      }
      
      if (shouldPause) {
        postMessage({ type: 'TRAINING_PAUSED', epoch: epoch - 1 });
        trainingState = 'paused';
        // Wait for resume
        await waitForResume();
        if (shouldStop) {
          postStopMessage(epoch, epochMetrics, startTime);
          return;
        }
        postMessage({ type: 'TRAINING_RESUMED', epoch });
      }
      
      shuffleArray(trainData);
      
      const batchSize = config.batchSize || trainData.length;
      let epochLoss = 0;
      let batchCount = 0;
      
      for (let i = 0; i < trainData.length; i += batchSize) {
        const batch = trainData.slice(i, i + batchSize);
        const result = model.trainBatch(batch, config.learningRate);
        epochLoss += result.avgLoss;
        batchCount++;
      }
      
      epochLoss /= batchCount;
      
      const trainAccuracy = model.calculateAccuracy(trainData);
      
      let valLoss = epochLoss;
      let valAccuracy = trainAccuracy;
      if (valData.length > 0) {
        valLoss = 0;
        for (const sample of valData) {
          const pred = model.predict(sample.input);
          valLoss += model.calculateLoss(pred, sample.target);
        }
        valLoss /= valData.length;
        valAccuracy = model.calculateAccuracy(valData);
      }
      
      const metrics = {
        epoch,
        totalEpochs: config.epochs,
        loss: epochLoss,
        accuracy: trainAccuracy,
        valLoss: valLoss,
        valAccuracy: valAccuracy
      };
      
      epochMetrics.push(metrics);
      
      postMessage({ type: 'EPOCH_UPDATE', ...metrics });
      
      // Yield to allow message processing (important!)
      // This uses setTimeout to create a macrotask, giving the message queue
      // a chance to process PAUSE/STOP commands between epochs
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    const duration = Date.now() - startTime;
    const finalMetrics = epochMetrics[epochMetrics.length - 1] || { loss: 0, accuracy: 0, valLoss: 0, valAccuracy: 0 };
    
    postMessage({
      type: 'TRAINING_COMPLETED',
      finalLoss: finalMetrics.loss,
      finalAccuracy: finalMetrics.accuracy,
      finalValLoss: finalMetrics.valLoss,
      finalValAccuracy: finalMetrics.valAccuracy,
      loss: finalMetrics.loss,
      accuracy: finalMetrics.accuracy,
      valLoss: finalMetrics.valLoss,
      valAccuracy: finalMetrics.valAccuracy,
      totalEpochs: config.epochs,
      duration,
      modelWeights: model.getWeights()
    });
    
    trainingState = 'idle';
  } catch (error) {
    postMessage({ type: 'TRAINING_ERROR', message: error.message });
    trainingState = 'idle';
  }
}
