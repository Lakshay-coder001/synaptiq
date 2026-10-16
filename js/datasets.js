window.initDatasets = async function() {
  const container = document.getElementById('datasetsContainer');
  const importArea = document.getElementById('csvImportArea');
  const fileInput = document.getElementById('csvFileInput');

  await loadDatasets();

  // Import interactions
  importArea.addEventListener('click', () => fileInput.click());
  
  importArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    importArea.style.borderColor = 'var(--primary)';
    importArea.style.backgroundColor = 'var(--bg-secondary)';
  });

  importArea.addEventListener('dragleave', () => {
    importArea.style.borderColor = 'var(--border-color)';
    importArea.style.backgroundColor = 'transparent';
  });

  importArea.addEventListener('drop', (e) => {
    e.preventDefault();
    importArea.style.borderColor = 'var(--border-color)';
    importArea.style.backgroundColor = 'transparent';
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
    // reset input
    fileInput.value = '';
  });

  async function loadDatasets() {
    try {
      const datasets = await Synaptiq.db.datasets.getAll();
      renderDatasets(datasets);
    } catch (err) {
      Synaptiq.utils.showToast('Failed to load datasets', 'error');
    }
  }

  function renderDatasets(datasets) {
    container.innerHTML = '';
    
    if (datasets.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem; text-align: center;">
          <div class="empty-state__icon" style="font-size: 3rem;">📁</div>
          <h3 class="empty-state__title">No Datasets Found</h3>
          <p class="empty-state__text">Upload a CSV file to get started.</p>
        </div>
      `;
      return;
    }

    datasets.forEach(ds => {
      const card = document.createElement('div');
      card.className = 'dataset-card card';
      card.style.cursor = 'pointer';
      
      card.innerHTML = `
        <div class="card-body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.1rem;">${Synaptiq.utils.escapeHtml(ds.name)}</h3>
            <span class="status-chip status-chip--ready">${ds.classes > 1 ? 'Classification' : 'Regression'}</span>
          </div>
          <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">
            ${ds.description || 'Custom imported dataset'}
          </p>
          <div class="dataset-info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
            <div><strong>Samples:</strong> ${Synaptiq.utils.formatNumber(ds.samples)}</div>
            <div><strong>Features:</strong> ${ds.features}</div>
            <div><strong>Classes:</strong> ${ds.classes}</div>
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => showDatasetModal(ds));
      container.appendChild(card);
    });
  }

  function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      Synaptiq.utils.showToast('Please select a CSV file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedData = processCSV(text);
        showImportPreviewModal(file.name, parsedData);
      } catch (err) {
        Synaptiq.utils.showToast('Failed to parse CSV: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function processCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row');
    
    const headers = lines[0].split(',').map(h => h.trim());
    if (headers.length < 2) throw new Error('CSV must have at least 2 columns');

    const featureNames = headers.slice(0, -1);
    const targetName = headers[headers.length - 1];

    let rawRows = [];
    const targetValues = new Set();
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue; // skip malformed
      
      const features = values.slice(0, -1).map(v => parseFloat(v));
      if (features.some(isNaN)) continue; // skip rows with non-numeric features
      
      const targetStr = values[values.length - 1];
      targetValues.add(targetStr);
      
      rawRows.push({
        input: features,
        rawTarget: targetStr
      });
    }

    if (rawRows.length === 0) throw new Error('No valid numeric data rows found');

    // Check if target should be categorical (classification) or numeric (regression)
    const isClassification = targetValues.size <= 10;
    const uniqueTargets = Array.from(targetValues).sort();
    let classNames = [];
    let classes = 1;

    let processedData = [];

    if (isClassification) {
      classNames = uniqueTargets;
      classes = classNames.length;
      
      processedData = rawRows.map(row => {
        const classIdx = classNames.indexOf(row.rawTarget);
        const oneHot = new Array(classes).fill(0);
        oneHot[classIdx] = 1;
        return {
          input: row.input,
          output: oneHot
        };
      });
    } else {
      processedData = rawRows.map(row => {
        const numVal = parseFloat(row.rawTarget);
        if (isNaN(numVal)) throw new Error('Regression target must be numeric');
        return {
          input: row.input,
          output: [numVal]
        };
      });
    }

    return {
      featureNames,
      classNames,
      data: processedData,
      samples: processedData.length,
      features: featureNames.length,
      classes: classes,
      preview: rawRows.slice(0, 10).map(r => [...r.input, r.rawTarget]) // for preview table
    };
  }

  function showImportPreviewModal(fileName, parsedData) {
    const defaultName = fileName.replace('.csv', '');
    
    const previewHtml = `
      <div style="margin-bottom: 1rem;">
        <label class="form-label">Dataset Name</label>
        <input type="text" id="importDatasetName" class="form-input" value="${defaultName}">
      </div>
      <div class="dataset-info-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
        <div><strong>Samples:</strong> ${parsedData.samples}</div>
        <div><strong>Features:</strong> ${parsedData.features}</div>
        <div><strong>Classes:</strong> ${parsedData.classes}</div>
      </div>
      <div class="table-container dataset-preview">
        <table class="data-table">
          <thead>
            <tr>
              ${parsedData.featureNames.map(f => `<th>${Synaptiq.utils.escapeHtml(f)}</th>`).join('')}
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            ${parsedData.preview.map(row => `
              <tr>
                ${row.map(val => `<td>${Synaptiq.utils.escapeHtml(String(val))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${parsedData.samples > 10 ? `<p style="text-align: center; color: var(--text-muted); margin-top: 0.5rem; font-size: 0.85rem;">Showing first 10 rows of ${parsedData.samples}</p>` : ''}
      </div>
    `;

    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
      <div class="modal-overlay">
        <div class="modal" style="width: 800px; max-width: 90vw;">
          <div class="modal-header">
            <h3 class="modal-title">Import Dataset</h3>
            <button class="modal-close" id="closeImportModal">✕</button>
          </div>
          <div class="modal-body">
            ${previewHtml}
          </div>
          <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;">
            <button class="btn btn-secondary" id="cancelImport">Cancel</button>
            <button class="btn btn-primary" id="confirmImport">Import</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modalContainer').appendChild(modalContent);

    const closeModal = () => modalContent.remove();
    
    document.getElementById('closeImportModal').addEventListener('click', closeModal);
    document.getElementById('cancelImport').addEventListener('click', closeModal);
    
    document.getElementById('confirmImport').addEventListener('click', async () => {
      const name = document.getElementById('importDatasetName').value.trim();
      if (!name) {
        Synaptiq.utils.showToast('Please enter a name.', 'error');
        return;
      }

      const ds = {
        id: Synaptiq.utils.generateId('ds'),
        name: name,
        description: 'Imported from ' + fileName,
        featureNames: parsedData.featureNames,
        classNames: parsedData.classNames,
        features: parsedData.features,
        classes: parsedData.classes,
        samples: parsedData.samples,
        data: parsedData.data,
        createdAt: new Date().toISOString()
      };

      try {
        await Synaptiq.db.datasets.create(ds);
        Synaptiq.utils.showToast('Dataset imported successfully!', 'success');
        closeModal();
        loadDatasets();
      } catch (err) {
        Synaptiq.utils.showToast('Failed to save dataset', 'error');
      }
    });
  }

  function showDatasetModal(ds) {
    const isBuiltin = ds.builtin || ds.id === 'xor' || ds.id === 'iris' || ds.id.startsWith('builtin-') || ds.id.startsWith('ds_');
    
    const previewData = ds.data.slice(0, 10).map(row => {
      // Decode one-hot back to label for preview if possible
      let targetDisplay = row.output.join(', ');
      if (ds.classes > 1 && ds.classNames && ds.classNames.length === ds.classes) {
        const classIdx = row.output.indexOf(1);
        if (classIdx !== -1) targetDisplay = ds.classNames[classIdx];
      }
      return { input: row.input, target: targetDisplay };
    });

    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
      <div class="modal-overlay">
        <div class="modal" style="width: 800px; max-width: 90vw;">
          <div class="modal-header">
            <h3 class="modal-title">${Synaptiq.utils.escapeHtml(ds.name)}</h3>
            <button class="modal-close" id="closeDsModal">✕</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 1.5rem;">${Synaptiq.utils.escapeHtml(ds.description || '')}</p>
            
            <div class="dataset-info-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; background: var(--bg-secondary); padding: 1rem; border-radius: 6px;">
              <div><strong style="display:block; font-size:0.8rem; color:var(--text-muted)">Samples</strong> ${Synaptiq.utils.formatNumber(ds.samples)}</div>
              <div><strong style="display:block; font-size:0.8rem; color:var(--text-muted)">Features</strong> ${ds.features}</div>
              <div><strong style="display:block; font-size:0.8rem; color:var(--text-muted)">Classes</strong> ${ds.classes}</div>
              <div><strong style="display:block; font-size:0.8rem; color:var(--text-muted)">Type</strong> ${ds.classes > 1 ? 'Classification' : 'Regression'}</div>
            </div>

            <h4 style="margin-bottom: 0.75rem;">Data Preview</h4>
            <div class="table-container dataset-preview">
              <table class="data-table">
                <thead>
                  <tr>
                    ${(ds.featureNames || Array.from({length: ds.features}, (_, i) => `Feature ${i+1}`)).map(f => `<th>${Synaptiq.utils.escapeHtml(f)}</th>`).join('')}
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  ${previewData.map(row => `
                    <tr>
                      ${row.input.map(val => `<td>${Synaptiq.utils.formatNumber(val, 4)}</td>`).join('')}
                      <td>${Synaptiq.utils.escapeHtml(String(row.target))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
            ${!isBuiltin ? `<button class="btn btn-danger" id="deleteDsBtn">Delete Dataset</button>` : '<span></span>'}
            <button class="btn btn-secondary" id="closeDsBtn">Close</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modalContainer').appendChild(modalContent);

    const closeModal = () => modalContent.remove();
    
    document.getElementById('closeDsModal').addEventListener('click', closeModal);
    document.getElementById('closeDsBtn').addEventListener('click', closeModal);
    
    if (!isBuiltin) {
      document.getElementById('deleteDsBtn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this dataset? This cannot be undone.')) {
          try {
            await Synaptiq.db.datasets.delete(ds.id);
            Synaptiq.utils.showToast('Dataset deleted.', 'success');
            closeModal();
            loadDatasets();
          } catch (err) {
            Synaptiq.utils.showToast('Failed to delete dataset', 'error');
          }
        }
      });
    }
  }
};
