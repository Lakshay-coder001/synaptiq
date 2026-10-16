(function() {
  window.Synaptiq = window.Synaptiq || {};

  /**
   * Calculates nice tick values for an axis.
   */
  function niceScale(min, max, maxTicks = 5) {
    if (min === max) return { min: min - 1, max: max + 1, ticks: [min] };
    const range = niceNum(max - min, false);
    const tickSpacing = niceNum(range / (maxTicks - 1), true);
    const niceMin = Math.floor(min / tickSpacing) * tickSpacing;
    const niceMax = Math.ceil(max / tickSpacing) * tickSpacing;
    const ticks = [];
    for (let i = niceMin; i <= niceMax; i += tickSpacing) {
      ticks.push(Number(i.toFixed(10))); // avoid float precision issues
    }
    return { min: niceMin, max: niceMax, ticks };
  }

  function niceNum(range, round) {
    const exponent = Math.floor(Math.log10(range));
    const fraction = range / Math.pow(10, exponent);
    let niceFraction;
    if (round) {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    } else {
      if (fraction <= 1) niceFraction = 1;
      else if (fraction <= 2) niceFraction = 2;
      else if (fraction <= 5) niceFraction = 5;
      else niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
  }

  Synaptiq.renderer = {
    createChart(canvasElement, config) {
      const ctx = canvasElement.getContext('2d');
      let currentConfig = { ...config };
      let resizeObserver;

      const padding = { top: 30, right: 20, bottom: 40, left: 55 };

      const drawText = (text, x, y, color, font, align = 'left', baseline = 'bottom') => {
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        ctx.fillText(text, x, y);
      };

      const drawLine = (x1, y1, x2, y2, color, width = 1) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      };

      const render = () => {
        if (!canvasElement || !canvasElement.parentElement) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvasElement.parentElement.getBoundingClientRect();
        
        const width = rect.width || 400;
        const height = rect.height || 220;

        const targetW = Math.floor(width * dpr);
        const targetH = Math.floor(height * dpr);

        if (canvasElement.width !== targetW) canvasElement.width = targetW;
        if (canvasElement.height !== targetH) canvasElement.height = targetH;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;

        // Title
        if (currentConfig.title) {
          drawText(currentConfig.title, width / 2, 15, '#a0aec0', '12px sans-serif', 'center', 'top');
        }

        let allData = [];
        currentConfig.series.forEach(s => { if (s.data) allData = allData.concat(s.data); });

        if (allData.length === 0) {
          drawText('No data yet', width / 2, height / 2, '#718096', '14px sans-serif', 'center', 'middle');
          ctx.restore();
          return;
        }

        let yMin = currentConfig.yMin !== undefined ? currentConfig.yMin : Math.min(...allData);
        let yMax = currentConfig.yMax !== undefined && currentConfig.yMax !== null ? currentConfig.yMax : Math.max(...allData);
        if (yMin === yMax) {
          yMin -= 1; yMax += 1;
        }

        const scale = niceScale(yMin, yMax, 5);
        
        // Y Axis
        scale.ticks.forEach(tick => {
          const y = padding.top + innerHeight - ((tick - scale.min) / Math.max(0.0001, (scale.max - scale.min))) * innerHeight;
          drawLine(padding.left, y, width - padding.right, y, 'rgba(255, 255, 255, 0.1)', 1);
          drawText(tick.toPrecision(3), padding.left - 5, y, '#718096', '11px monospace', 'right', 'middle');
        });

        // X Axis (epochs)
        let maxEpoch = 0;
        currentConfig.series.forEach(s => {
          if (s.data && s.data.length > maxEpoch) maxEpoch = s.data.length;
        });

        const xTicksCount = Math.min(maxEpoch, 10);
        for (let i = 0; i <= xTicksCount; i++) {
          const tickVal = Math.round((i / Math.max(1, xTicksCount)) * maxEpoch);
          if (tickVal === 0) continue;
          const x = padding.left + ((tickVal - 1) / Math.max(1, maxEpoch - 1)) * innerWidth;
          drawText(tickVal.toString(), x, height - padding.bottom + 15, '#718096', '11px monospace', 'center', 'top');
        }

        // Series
        currentConfig.series.forEach(s => {
          if (!s.data || s.data.length === 0) return;
          const points = [];
          ctx.beginPath();
          const isValidation = s.name && s.name.toLowerCase().includes('val');
          if (isValidation) {
            ctx.setLineDash([5, 4]);
          } else {
            ctx.setLineDash([]);
          }
          s.data.forEach((val, i) => {
            const x = padding.left + (i / Math.max(1, maxEpoch - 1)) * innerWidth;
            const y = padding.top + innerHeight - ((val - scale.min) / Math.max(0.0001, (scale.max - scale.min))) * innerHeight;
            points.push({ x, y });
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.setLineDash([]);

          // Render filled dots at points so line is always visible
          ctx.fillStyle = s.color;
          points.forEach((pt, i) => {
            if (points.length <= 40 || i % Math.ceil(points.length / 25) === 0 || i === points.length - 1) {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
              ctx.fill();
            }
          });
        });

        // Legend
        let legendX = width - padding.right;
        currentConfig.series.slice().reverse().forEach(s => {
          ctx.font = '11px sans-serif';
          const textWidth = ctx.measureText(s.name).width;
          drawText(s.name, legendX, 15, '#a0aec0', '11px sans-serif', 'right', 'top');
          drawLine(legendX - textWidth - 25, 20, legendX - textWidth - 5, 20, s.color, 2);
          legendX -= (textWidth + 40);
        });

        ctx.restore();
      };

      // Set up resize observer without layout thrashing
      if (window.ResizeObserver && canvasElement.parentElement) {
        let rAnim;
        resizeObserver = new ResizeObserver(() => {
          if (rAnim) cancelAnimationFrame(rAnim);
          rAnim = requestAnimationFrame(render);
        });
        resizeObserver.observe(canvasElement.parentElement);
      }

      render();

      return {
        update(newSeriesData) {
          currentConfig.series.forEach((s, i) => {
            if (newSeriesData[i]) {
              s.data = newSeriesData[i];
            }
          });
          requestAnimationFrame(render);
        },
        destroy() {
          if (resizeObserver) resizeObserver.disconnect();
        },
        resize() {
          requestAnimationFrame(render);
        }
      };
    },

    renderProgressBar(container, progress, total) {
      if (!container) return;
      let bar = container.querySelector('.progress-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'progress-bar';
        container.appendChild(bar);
      }
      const pct = total > 0 ? (progress / total) * 100 : 0;
      bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }
  };
})();
