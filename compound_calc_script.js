"use strict";

(function () {
  // --- DOM Elements ---
  const elRate = document.getElementById("cq-rate");
  const elInputFreq = document.getElementById("cq-input-freq");
  const elOutputFreq = document.getElementById("cq-output-freq");
  
  // Optional
  const elPrincipal = document.getElementById("cq-principal");
  const elTime = document.getElementById("cq-time");

  // Actions
  const btnCalc = document.getElementById("cq-calc-btn");
  const btnReset = document.getElementById("cq-reset-btn");
  const elError = document.getElementById("cq-input-error");

  // Outputs
  const elTxtConverted = document.getElementById("txt-converted-rate");
  const elOptionalResults = document.getElementById("optional-results");
  const elOptionalPlaceholder = document.getElementById("optional-placeholder");
  const elTxtTotalAmount = document.getElementById("txt-total-amount");
  const elTxtTotalInterest = document.getElementById("txt-total-interest");

  // Chart
  const elDonutSection = document.getElementById("donut-section");
  const elMsgInterest = document.getElementById("donut-interest");
  const elMsgPrincipal = document.getElementById("donut-principal");
  const tooltip = document.getElementById("chart-tooltip");

  // --- State ---
  let state = {
    rate: null,
    inputFreq: 12, // Default Monthly
    outputFreq: 1, // Default Annual
    principal: null,
    time: null,
  };

  function init() {
    // Attach listeners
    [elRate, elPrincipal, elTime].forEach(el => {
      el.addEventListener("input", handleInput);
    });
    
    [elInputFreq, elOutputFreq].forEach(el => {
        el.addEventListener("change", handleInput);
    });

    btnCalc.addEventListener("click", calculate);
    btnReset.addEventListener("click", reset);

    // Initial check
    handleInput();
  }

  function handleInput() {
    // 1. Read values
    const r = parseFloat(elRate.value);
    const inFreq = elInputFreq.value === "continuous" ? "continuous" : parseInt(elInputFreq.value, 10);
    const outFreq = elOutputFreq.value === "continuous" ? "continuous" : parseInt(elOutputFreq.value, 10);
    
    const p = elPrincipal.value !== "" ? parseFloat(elPrincipal.value) : null;
    const t = elTime.value !== "" ? parseFloat(elTime.value) : null;

    // 2. Validate for button state
    let valid = true;
    if (isNaN(r) || r < 0) valid = false;
    
    // Optional checks (only if entered)
    if (p !== null && p < 0) valid = false;
    if (t !== null && t < 0) valid = false;

    // 3. Update state
    state = {
      rate: r,
      inputFreq: inFreq,
      outputFreq: outFreq,
      principal: p,
      time: t
    };

    // 4. Toggle Button
    btnCalc.disabled = !valid;
    
    // Reset validation error on input
    if (valid) hideError();
  }

  function calculate() {
    if (btnCalc.disabled) return;
    
    // Lock Input
    // (Optional: standard loan calc behavior usually doesn't lock inputs, but we can show Reset button)
    btnReset.style.display = "block"; // or inline-block based on CSS? default CSS usually has it block or flex logic
    // Actually in the other calculators, reset replaces/sits next to calculate. 
    // We'll follow the CSS logic: .cq-btn-group handles layout.

    // 1. Calculate Effective Annual Rate (EAR/APY)
    // Rate is input as percentage, e.g. 5.0
    const nominalDec = state.rate / 100;
    
    let ear = 0; // Effective Annual Rate (decimal)

    if (state.inputFreq === "continuous") {
        ear = Math.exp(nominalDec) - 1;
    } else {
        // (1 + r/n)^n - 1
        ear = Math.pow(1 + nominalDec / state.inputFreq, state.inputFreq) - 1;
    }

    // 2. Convert to Output Frequency
    let outputRateDec = 0;

    if (state.outputFreq === "continuous") {
        // r = ln(1 + EAR)
        outputRateDec = Math.log(1 + ear);
    } else {
        // m * [ (1 + EAR)^(1/m) - 1 ]
        outputRateDec = state.outputFreq * (Math.pow(1 + ear, 1 / state.outputFreq) - 1);
    }

    // Convert back to percent
    const outputRatePct = outputRateDec * 100;

    // 3. Display Main Result
    elTxtConverted.innerText = formatPct(outputRatePct);

    // 4. Handle Optional Growth
    if (state.principal !== null && state.time !== null && state.principal > 0 && state.time > 0) {
        // Calculate Amount
        // A = P * (1 + EAR)^t  (Works for annual steps using EAR)
        const totalAmount = state.principal * Math.pow(1 + ear, state.time);
        const totalInterest = totalAmount - state.principal;

        elTxtTotalAmount.innerText = formatMoney(totalAmount);
        elTxtTotalInterest.innerText = formatMoney(totalInterest);

        // Show Results
        elOptionalResults.style.display = "block";
        elOptionalPlaceholder.style.display = "none";
        
        // Render Chart
        renderChart(state.principal, totalInterest);
        
        // Enable Chart Section
        elDonutSection.style.opacity = "1";
        elDonutSection.style.filter = "none";
    } else {
        // Hide Optional Results
        elOptionalResults.style.display = "none";
        elOptionalPlaceholder.style.display = "block";
        elDonutSection.style.opacity = "0.3";
        elDonutSection.style.filter = "grayscale(1)";
        
        // Clear chart roughly
        elMsgInterest.style.strokeDasharray = `0 100`;
        elMsgPrincipal.style.strokeDasharray = `0 100`;
    }
  }

  function reset() {
    elRate.value = "";
    elPrincipal.value = "";
    elTime.value = "";
    elInputFreq.value = "12"; // Reset to defaults if desired? Or keep? Let's reset to defaults.
    elOutputFreq.value = "1";
    
    elTxtConverted.innerText = "0.00000%";
    elOptionalResults.style.display = "none";
    elOptionalPlaceholder.style.display = "block";
    elDonutSection.style.opacity = "0.3";
    elDonutSection.style.filter = "grayscale(1)";
    
    handleInput();
    btnReset.style.display = "none";
  }

  // --- Helpers ---

  function formatMoney(num) {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatPct(num) {
    // 5 decimal places requested
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5
    }) + "%";
  }

  function showError(msg) {
    elError.style.display = "block";
    elError.innerText = msg;
  }

  function hideError() {
    elError.style.display = "none";
    elError.innerText = "";
  }

  // --- Chart Logic ---
  function renderChart(principal, interest) {
    const total = principal + interest;
    if (total <= 0) return;

    // Proportions (0 to 100)
    const pPct = (principal / total) * 100;
    const iPct = (interest / total) * 100;

    // Stroke Dash Logic: value, gap
    // Circumference ~100 in this coordinate space (r=15.915 => 2*pi*r = 100)
    
    // Segment 1: Interest (starts at -90deg)
    // We want it to take up iPct
    elMsgInterest.style.strokeDasharray = `${iPct} ${100 - iPct}`;
    
    // Segment 2: Principal
    // Start after Interest. We can rotate it OR use dashoffset.
    // Easiest with rotation offset:
    // Interest ends at -90 + (iPct/100 * 360).
    // Actually, clean SVG stacking:
    // Interest starts at 0 (top, -90deg). Length iPct.
    // Principal starts at iPct. Length pPct.
    
    // Using stroke-dashoffset:
    // Interest: dasharray="iPct 100-iPct", offset=0 (starts at top if rotated -90)
    // Principal: dasharray="pPct 100-pPct", offset=-iPct
    
    elMsgInterest.style.strokeDasharray = `${iPct} ${100 - iPct}`;
    elMsgInterest.style.strokeDashoffset = "0";

    elMsgPrincipal.style.strokeDasharray = `${pPct} ${100 - pPct}`;
    elMsgPrincipal.style.strokeDashoffset = `-${iPct}`;
    
    // Tooltip listeners
    setupTooltip(elMsgInterest, "Interest", interest, iPct);
    setupTooltip(elMsgPrincipal, "Principal", principal, pPct);
  }

  function setupTooltip(el, label, amount, pct) {
    el.onmouseenter = (e) => {
      tooltip.style.display = "block";
      tooltip.className = "chart-tooltip" + (label === "Interest" ? " interest" : "");
      tooltip.innerHTML = `${label}<br/>${formatMoney(amount)} (${pct.toFixed(1)}%)`;
      moveTooltip(e);
    };
    el.onmousemove = moveTooltip;
    el.onmouseleave = () => {
      tooltip.style.display = "none";
    };
  }

  function moveTooltip(e) {
    // position near mouse
    const x = e.clientX;
    const y = e.clientY;
    tooltip.style.left = x + 10 + "px";
    tooltip.style.top = y + 10 + "px";
  }

  // Init
  init();

})();
