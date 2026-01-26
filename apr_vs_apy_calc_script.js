document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const aprInput = document.getElementById("cq-apr-input");
  const freqInput = document.getElementById("cq-freq-input");
  const calcBtn = document.getElementById("cq-calc-btn");
  const resetBtn = document.getElementById("cq-reset-btn");
  const errorDiv = document.getElementById("cq-input-error");

  const aprResult = document.getElementById("txt-apr-result");
  const apyResult = document.getElementById("txt-apy-result");
  const increaseResult = document.getElementById("txt-increase-result");

  // Donut Elements
  const donutApr = document.getElementById("donut-apr");
  const donutIncrease = document.getElementById("donut-increase");
  const donutLabel = document.getElementById("donut-label");
  const tooltip = document.getElementById("chart-tooltip");

  // Helper for formatting
  function format(n) {
    return n.toFixed(2) + "%";
  }

  // --- Tooltip Logic ---
  function showTooltip(e) {
    const t = e.currentTarget;
    if (!t.dataset.label) return;
    tooltip.style.display = 'block';
    tooltip.style.opacity = '1';
    tooltip.style.backgroundColor = t.dataset.color || 'rgba(30,30,47,0.95)';
    tooltip.innerHTML = `
      <div style="font-weight:600; font-size:14px; margin-bottom:2px">${t.dataset.label}</div>
      <div style="font-size:12px">${t.dataset.value}</div>
    `;
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    tooltip.style.opacity = '0';
    setTimeout(() => {
      if (tooltip.style.opacity === '0') tooltip.style.display = 'none';
    }, 200);
  }

  [donutApr, donutIncrease].forEach(el => {
    el.addEventListener('mouseenter', showTooltip);
    el.addEventListener('mousemove', moveTooltip);
    el.addEventListener('mouseleave', hideTooltip);
  });

  // Input Validation & Button Logic
  function validateInputs() {
    const apr = parseFloat(aprInput.value);
    const isValid = !isNaN(apr) && apr >= 0;

    calcBtn.disabled = !isValid;
    return isValid;
  }

  aprInput.addEventListener("input", validateInputs);
  freqInput.addEventListener("change", validateInputs);

  // Calculation logic
  function calculateAPY() {
    if (!validateInputs()) return;

    const apr = parseFloat(aprInput.value) / 100;
    const n = parseInt(freqInput.value);

    // Formula: APY = (1 + APR / n)^n - 1
    let apy;
    if (n === 1 || apr === 0) {
      apy = apr; // Annual compounding or 0% APR
    } else {
      apy = Math.pow(1 + apr / n, n) - 1;
    }

    const apyPercentage = apy * 100;
    const aprPercentage = parseFloat(aprInput.value);
    const increase = (apyPercentage - aprPercentage);

    // Display Results
    aprResult.textContent = format(aprPercentage);
    apyResult.textContent = format(apyPercentage);
    increaseResult.textContent = format(increase);

    // Update Donut Chart
    updateDonut(aprPercentage, apyPercentage);

    // Show reset button
    resetBtn.style.display = "block";
  }

  function updateDonut(apr, apy) {
    if (apy === 0) {
      donutApr.setAttribute("stroke-dasharray", "0 100");
      donutIncrease.setAttribute("stroke-dasharray", "0 100");
      donutLabel.textContent = "0%";
      return;
    }

    // Segments as % of the total APY
    const pApr = (apr / apy) * 100;
    const pInc = ( (apy - apr) / apy ) * 100;

    // Segment 1: APR (Dark)
    // Segment 2: Increase (Yellow)
    
    // APR starts at -90deg
    donutApr.setAttribute("stroke-dasharray", `${pApr} ${100 - pApr}`);
    donutApr.setAttribute("transform", "rotate(-90 21 21)");

    // Increase starts after APR
    donutIncrease.setAttribute("stroke-dasharray", `${pInc} ${100 - pInc}`);
    donutIncrease.setAttribute("transform", `rotate(${-90 + (pApr * 3.6)} 21 21)`);

    donutLabel.textContent = format(apy);

    // Tooltip data
    donutApr.dataset.label = "Nominal APR";
    donutApr.dataset.value = format(apr);
    donutApr.dataset.color = "#1E1E2F";

    donutIncrease.dataset.label = "Compounding Increase";
    donutIncrease.dataset.value = format(apy - apr);
    donutIncrease.dataset.color = "#FFAE1A";
  }

  // Event Listeners
  calcBtn.addEventListener("click", calculateAPY);

  resetBtn.addEventListener("click", () => {
    aprInput.value = "";
    freqInput.value = "12";
    
    aprResult.textContent = "0.00%";
    apyResult.textContent = "0.00%";
    increaseResult.textContent = "0.00%";
    
    donutApr.setAttribute("stroke-dasharray", "0 100");
    donutIncrease.setAttribute("stroke-dasharray", "0 100");
    donutLabel.textContent = "";

    resetBtn.style.display = "none";
    calcBtn.disabled = true;
    errorDiv.style.display = "none";
  });
});
