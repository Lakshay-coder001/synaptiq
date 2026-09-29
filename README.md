# Synaptiq

## Project Description

Synaptiq is a frontend-only machine learning experimentation platform built using HTML, CSS, and vanilla JavaScript. It allows users to create experiments, configure model parameters, run lightweight neural network training directly in the browser, monitor training metrics, and compare previous experiments. Web Workers are used to perform training computations without blocking the user interface, while IndexedDB is used to store experiments and training history locally.

## Goals

* Build a functional machine learning experimentation dashboard using only frontend technologies.
* Implement CRUD operations for managing experiments.
* Perform lightweight neural network training using JavaScript.
* Use Web Workers for background training and maintain a responsive UI.
* Demonstrate JavaScript concepts such as Promises, async/await, Fetch API, callbacks, generators, Map, Set, and array methods.
* Demonstrate browser concepts including the event loop, microtasks, macrotasks, rendering, Web Storage, Cookies, and IndexedDB.
* Provide real-time training metrics such as loss, accuracy, epochs, and training status.
* Create a responsive interface that works on desktop, tablet, and mobile devices.

## Specifications

### Technology Stack

* HTML5
* CSS3
* Vanilla JavaScript
* Canvas/SVG for data visualization

### Core Features

* Experiment creation, viewing, editing, and deletion.
* Model configuration including learning rate, epochs, batch size, and network parameters.
* Browser-based neural network training.
* Real-time training progress and metrics.
* Training history and experiment comparison.
* Dataset loading and basic CSV support.
* Responsive dashboard design..

### Might add these features

* Local data persistence using IndexedDB.


## Design

The application will use a clean dashboard-based interface with separate sections for managing experiments, running training, viewing training history, and managing datasets.

### Main Pages

```text
Dashboard
Experiments
Training
History
Datasets
```

### Application Flow

```text
Dashboard
    |
    v
Create Experiment
    |
    v
Configure Model
    |
    v
Start Training
    |
    v
Web Worker
    |
    v
Training Metrics
    |
    v
Save Results
    |
    v
Training History
```

The application will follow a modular JavaScript structure, separating database operations, model training, Web Worker logic, API handling, and UI rendering. The interface will use responsive CSS to support desktop, tablet, and mobile devices.
