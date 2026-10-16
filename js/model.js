// Works in both main thread and Web Worker
const _global = typeof window !== 'undefined' ? window : self;
_global.Synaptiq = _global.Synaptiq || {};

function NeuralNetwork(config) {
  this.config = config;
  this.inputSize = config.inputSize;
  this.hiddenLayers = config.hiddenLayers || 1;
  this.neuronsPerLayer = config.neuronsPerLayer || 8;
  this.outputSize = config.outputSize || 1;
  this.learningRate = config.learningRate || 0.01;
  
  const activation = config.activationFunction || 'sigmoid';
  
  if (activation === 'sigmoid') {
    this.activate = (x) => 1 / (1 + Math.exp(-x));
    this.activateDerivative = (output) => output * (1 - output);
  } else if (activation === 'tanh') {
    this.activate = (x) => Math.tanh(x);
    this.activateDerivative = (output) => 1 - output * output;
  } else if (activation === 'relu') {
    this.activate = (x) => Math.max(0, x);
    this.activateDerivative = (output) => output > 0 ? 1 : 0;
  }
  
  this.outputActivate = (x) => 1 / (1 + Math.exp(-x));
  this.outputActivateDerivative = (output) => output * (1 - output);

  this.layerSizes = [this.inputSize];
  for (let i = 0; i < this.hiddenLayers; i++) {
    this.layerSizes.push(this.neuronsPerLayer);
  }
  this.layerSizes.push(this.outputSize);

  this.weights = [];
  this.biases = [];
  
  // Xavier/Glorot initialization
  for (let l = 1; l < this.layerSizes.length; l++) {
    const fanIn = this.layerSizes[l - 1];
    const fanOut = this.layerSizes[l];
    const limit = Math.sqrt(2 / (fanIn + fanOut));
    
    const layerWeights = [];
    const layerBiases = [];
    
    for (let j = 0; j < fanOut; j++) {
      layerBiases.push(0);
      const neuronWeights = [];
      for (let k = 0; k < fanIn; k++) {
        // Random between -limit and limit
        neuronWeights.push((Math.random() * 2 - 1) * limit);
      }
      layerWeights.push(neuronWeights);
    }
    
    this.weights.push(layerWeights);
    this.biases.push(layerBiases);
  }
}

NeuralNetwork.prototype.forward = function(input) {
  this._activations = [input];
  this._zValues = [];
  
  let currentActivation = input;
  
  for (let l = 0; l < this.weights.length; l++) {
    const layerWeights = this.weights[l];
    const layerBiases = this.biases[l];
    const nextActivation = [];
    const nextZ = [];
    
    const isOutputLayer = l === this.weights.length - 1;
    const actFunc = isOutputLayer ? this.outputActivate : this.activate;
    
    for (let j = 0; j < layerWeights.length; j++) {
      let sum = layerBiases[j];
      const neuronWeights = layerWeights[j];
      for (let k = 0; k < neuronWeights.length; k++) {
        sum += neuronWeights[k] * currentActivation[k];
      }
      nextZ.push(sum);
      nextActivation.push(actFunc(sum));
    }
    
    this._zValues.push(nextZ);
    this._activations.push(nextActivation);
    currentActivation = nextActivation;
  }
  
  return currentActivation;
};

NeuralNetwork.prototype.backward = function(input, target, output) {
  const weightGradients = [];
  const biasGradients = [];
  const numLayers = this.weights.length;
  
  // Initialize gradients with zeros
  for (let l = 0; l < numLayers; l++) {
    const layerWeights = this.weights[l];
    const layerWGrad = [];
    const layerBGrad = [];
    for (let j = 0; j < layerWeights.length; j++) {
      layerBGrad.push(0);
      const neuronWGrad = [];
      for (let k = 0; k < layerWeights[j].length; k++) {
        neuronWGrad.push(0);
      }
      layerWGrad.push(neuronWGrad);
    }
    weightGradients.push(layerWGrad);
    biasGradients.push(layerBGrad);
  }
  
  let currentDelta = [];
  
  // Output layer
  const L = numLayers - 1;
  for (let j = 0; j < this.layerSizes[L + 1]; j++) {
    const targetVal = (target && target[j] !== undefined) ? target[j] : 0;
    const error = output[j] - targetVal;
    const delta = error * this.outputActivateDerivative(output[j]);
    currentDelta.push(delta);
    
    biasGradients[L][j] = delta;
    for (let k = 0; k < this.layerSizes[L]; k++) {
      weightGradients[L][j][k] = delta * this._activations[L][k];
    }
  }
  
  // Hidden layers
  for (let l = L - 1; l >= 0; l--) {
    const nextDelta = [];
    const prevLayerSize = this.layerSizes[l];
    const currentLayerSize = this.layerSizes[l + 1];
    
    for (let j = 0; j < currentLayerSize; j++) {
      let error = 0;
      for (let m = 0; m < this.layerSizes[l + 2]; m++) {
        error += this.weights[l + 1][m][j] * currentDelta[m];
      }
      const delta = error * this.activateDerivative(this._activations[l + 1][j]);
      nextDelta.push(delta);
      
      biasGradients[l][j] = delta;
      for (let k = 0; k < prevLayerSize; k++) {
        weightGradients[l][j][k] = delta * this._activations[l][k];
      }
    }
    currentDelta = nextDelta;
  }
  
  return { weightGradients, biasGradients };
};

NeuralNetwork.prototype.updateWeights = function(gradients, learningRate) {
  const { weightGradients, biasGradients } = gradients;
  
  for (let l = 0; l < this.weights.length; l++) {
    for (let j = 0; j < this.weights[l].length; j++) {
      this.biases[l][j] -= learningRate * biasGradients[l][j];
      for (let k = 0; k < this.weights[l][j].length; k++) {
        this.weights[l][j][k] -= learningRate * weightGradients[l][j][k];
      }
    }
  }
};

NeuralNetwork.prototype.train = function(input, target) {
  const output = this.forward(input);
  const gradients = this.backward(input, target, output);
  this.updateWeights(gradients, this.learningRate);
  
  const loss = this.calculateLoss(output, target);
  return { loss, output };
};

NeuralNetwork.prototype.trainBatch = function(batch, learningRate) {
  const numLayers = this.weights.length;
  const accWeightGradients = [];
  const accBiasGradients = [];
  
  for (let l = 0; l < numLayers; l++) {
    const layerWGrad = [];
    const layerBGrad = [];
    for (let j = 0; j < this.weights[l].length; j++) {
      layerBGrad.push(0);
      const neuronWGrad = [];
      for (let k = 0; k < this.weights[l][j].length; k++) {
        neuronWGrad.push(0);
      }
      layerWGrad.push(neuronWGrad);
    }
    accWeightGradients.push(layerWGrad);
    accBiasGradients.push(layerBGrad);
  }
  
  let totalLoss = 0;
  
  for (const sample of batch) {
    const output = this.forward(sample.input);
    totalLoss += this.calculateLoss(output, sample.target);
    const gradients = this.backward(sample.input, sample.target, output);
    
    for (let l = 0; l < numLayers; l++) {
      for (let j = 0; j < gradients.biasGradients[l].length; j++) {
        accBiasGradients[l][j] += gradients.biasGradients[l][j];
        for (let k = 0; k < gradients.weightGradients[l][j].length; k++) {
          accWeightGradients[l][j][k] += gradients.weightGradients[l][j][k];
        }
      }
    }
  }
  
  const batchSize = batch.length;
  for (let l = 0; l < numLayers; l++) {
    for (let j = 0; j < accBiasGradients[l].length; j++) {
      accBiasGradients[l][j] /= batchSize;
      for (let k = 0; k < accWeightGradients[l][j].length; k++) {
        accWeightGradients[l][j][k] /= batchSize;
      }
    }
  }
  
  this.updateWeights({ weightGradients: accWeightGradients, biasGradients: accBiasGradients }, learningRate);
  
  return { avgLoss: totalLoss / batchSize };
};

NeuralNetwork.prototype.predict = function(input) {
  return this.forward(input);
};

NeuralNetwork.prototype.calculateLoss = function(predicted, actual) {
  if (!predicted || !actual || predicted.length === 0) return 0;
  let mse = 0;
  const count = Math.min(predicted.length, actual.length);
  for (let i = 0; i < count; i++) {
    const diff = predicted[i] - actual[i];
    mse += diff * diff;
  }
  return mse / Math.max(1, count);
};

NeuralNetwork.prototype.calculateAccuracy = function(dataset) {
  let correct = 0;
  const isMultiClass = this.outputSize > 1;
  
  for (const sample of dataset) {
    const pred = this.predict(sample.input);
    if (isMultiClass) {
      let maxPredIdx = 0;
      for (let i = 1; i < pred.length; i++) {
        if (pred[i] > pred[maxPredIdx]) maxPredIdx = i;
      }
      let maxTargetIdx = 0;
      for (let i = 1; i < sample.target.length; i++) {
        if (sample.target[i] > sample.target[maxTargetIdx]) maxTargetIdx = i;
      }
      if (maxPredIdx === maxTargetIdx) correct++;
    } else {
      const predClass = pred[0] > 0.5 ? 1 : 0;
      const targetClass = sample.target[0] > 0.5 ? 1 : 0;
      if (predClass === targetClass) correct++;
    }
  }
  return correct / dataset.length;
};

NeuralNetwork.prototype.getWeights = function() {
  return {
    weights: JSON.parse(JSON.stringify(this.weights)),
    biases: JSON.parse(JSON.stringify(this.biases))
  };
};

NeuralNetwork.prototype.setWeights = function(saved) {
  this.weights = JSON.parse(JSON.stringify(saved.weights));
  this.biases = JSON.parse(JSON.stringify(saved.biases));
};

NeuralNetwork.prototype.getSummary = function() {
  let totalParams = 0;
  for (let l = 0; l < this.weights.length; l++) {
    totalParams += this.biases[l].length; // biases
    for (let j = 0; j < this.weights[l].length; j++) {
      totalParams += this.weights[l][j].length; // weights
    }
  }
  return {
    layers: [...this.layerSizes],
    totalParams,
    activationFunction: this.config.activationFunction || 'sigmoid'
  };
};

function createModel(config) {
  return new NeuralNetwork(config);
}

function preprocessDataset(dataset, config) {
  const data = JSON.parse(JSON.stringify(dataset)); // Deep copy
  
  if (!data || data.length === 0) return { trainData: [], valData: [], featureMin: [], featureMax: [] };
  
  // Find min and max for features
  const featureMin = [];
  const featureMax = [];
  const numFeatures = data[0].input.length;
  
  for (let i = 0; i < numFeatures; i++) {
    featureMin.push(Infinity);
    featureMax.push(-Infinity);
  }
  
  for (const sample of data) {
    for (let i = 0; i < numFeatures; i++) {
      if (sample.input[i] < featureMin[i]) featureMin[i] = sample.input[i];
      if (sample.input[i] > featureMax[i]) featureMax[i] = sample.input[i];
    }
  }
  
  // Normalize
  for (const sample of data) {
    for (let i = 0; i < numFeatures; i++) {
      const range = featureMax[i] - featureMin[i];
      if (range !== 0) {
        sample.input[i] = (sample.input[i] - featureMin[i]) / range;
      } else {
        sample.input[i] = 0; // Avoid division by zero
      }
    }
  }
  
  // Shuffle
  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [data[i], data[j]] = [data[j], data[i]];
  }
  
  // Split
  let trainData = [];
  let valData = [];
  if (data.length < 5) {
    trainData = data;
    valData = [];
  } else {
    const splitIdx = Math.floor(data.length * 0.8);
    trainData = data.slice(0, splitIdx);
    valData = data.slice(splitIdx);
  }
  
  return { trainData, valData, featureMin, featureMax };
}

function normalizeFeatures(data, min, max) {
  const result = JSON.parse(JSON.stringify(data));
  if (!result || result.length === 0) return result;
  
  const numFeatures = min.length;
  for (const sample of result) {
    for (let i = 0; i < numFeatures; i++) {
      const range = max[i] - min[i];
      if (range !== 0) {
        sample.input[i] = (sample.input[i] - min[i]) / range;
      } else {
        sample.input[i] = 0;
      }
    }
  }
  return result;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

_global.Synaptiq.NeuralNetwork = NeuralNetwork;
_global.Synaptiq.createModel = createModel;
_global.Synaptiq.preprocessDataset = preprocessDataset;
_global.Synaptiq.normalizeFeatures = normalizeFeatures;
_global.Synaptiq.shuffleArray = shuffleArray;
