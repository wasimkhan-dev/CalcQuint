(function(){
  const $ = id => document.getElementById(id);

  // Inputs
  const initialIn = $('cq-initial-investment');
  const contribAnnualIn = $('cq-contrib-annual');
  const contribMonthlyIn = $('cq-contrib-monthly');
  const rateIn = $('cq-rate');
  const freqIn = $('cq-compound-freq');
  const yearsIn = $('cq-years');
  const monthsIn = $('cq-months');
  
  // Radio Timing
  const timingBeg = $('cq-timing-beg');
  const timingEnd = $('cq-timing-end'); // checked by default

  // Optional
  const taxIn = $('cq-tax-rate');
  const inflationIn = $('cq-inflation-rate');

  // Outputs
  const btn = $('cq-calc-btn');
  const btnReset = $('cq-reset-btn');
  const err = $('cq-input-error');

  const txtEnding = $('txt-ending-balance');
  const txtPrincipal = $('txt-total-principal');
  const txtContrib = $('txt-total-contrib');
  const txtInterest = $('txt-total-interest');
  
  const rowBuyingPower = $('row-buying-power');
  const txtBuyingPower = $('txt-buying-power');

  // Chart
  const donutInitial = $('donut-initial');
  const donutContrib = $('donut-contrib');
  const donutInterest = $('donut-interest');
  const donutLabel = $('donut-label');
  const tooltip = $('chart-tooltip');

  // Schedule
  const toggleLink = $('toggle-am-link');
  const amFull = $('amortization-full');
  const amHead = $('am-total-duration');
  const accRoot = $('acc-root');

  // --- Constants & Helper ---
  const MAX_YEARS = 100;

  function getNum(el) { return parseFloat(el.value) || 0; }
  function isFilled(el) { return el.value.trim() !== ''; }

  function format(n){ 
    return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  // --- Validation ---
  function checkRequired() {
    // Basic checks: Initial Investment OR Contribs must exist? 
    // Usually at least one source of money. But strictly, just ensure non-negative.
    // Years+Months > 0.
    const init = getNum(initialIn);
    const y = getNum(yearsIn);
    const m = getNum(monthsIn);
    
    // Constraints:
    // Initial >= 0 (handled by min=0 but logic needed)
    // Rate >= 0
    // Time > 0
    
    // We strictly require "Time Horizon" to be > 0 to calc anything meaningful.
    const timeValid = (y * 12 + m) > 0;
    
    // Also require "Initial Investment" field to be filled (even if 0) so we know user visited it?
    // User rules say "Validation: >= 0".
    
    return isFilled(initialIn) && 
           isFilled(rateIn) && 
           timeValid;
  }

  function updateBtn(){
    if(checkRequired()){ btn.disabled=false; btn.classList.add('active'); }
    else { btn.disabled=true; btn.classList.remove('active'); }
  }

  function showErr(msg){
    err.style.display = msg ? "block" : "none";
    err.textContent = msg || "";
  }

  // Listeners
  [initialIn, contribAnnualIn, contribMonthlyIn, rateIn, yearsIn, monthsIn, taxIn, inflationIn].forEach(el => {
    if(el) el.addEventListener('input', () => { showErr(''); updateBtn(); });
  });



  // --- Core Calculation (Simulation) ---
  function calculate() {
    const P = getNum(initialIn);
    const cAnnual = getNum(contribAnnualIn);
    const cMonthly = getNum(contribMonthlyIn);
    const rPercent = getNum(rateIn);
    const r = rPercent / 100;
    
    const freqVal = freqIn.value; // "1", "12", "365", "continuous"
    
    const years = getNum(yearsIn);
    const months = getNum(monthsIn);
    const totalMonths = years * 12 + months;

    const taxRate = getNum(taxIn) / 100;
    const inflRate = getNum(inflationIn) / 100;

    const isBeg = timingBeg.checked; 

    // Simulation State
    let balance = P;
    let totalContrib = 0;
    let totalTaxPaid = 0;
    
    // For tracking annual rows
    let schedule = [];
    let yearStartBal = P;
    let yearContrib = 0;
    let yearInterest = 0;
    
    // Step size: We will simulate MONTHLY to capture monthly contributions accurately.
    // If Compounding is "Daily" or "Weekly", we approximate the monthly effective rate or iterate sub-steps.
    // BETTER: Iterate monthly, and calculate Interest for that month based on Freq.
    
    // Compounding logic per month:
    // delta_t = 1/12 year.
    // Continuous: factor = e^(r * delta_t)
    // Discrete (n times/yr): factor = (1 + r/n)^(n * delta_t)
    
    let compoundFactorMonth;
    if(freqVal === 'continuous') {
      compoundFactorMonth = Math.exp(r * (1/12));
    } else {
      const n = parseInt(freqVal);
      // (1 + r/n)^(n/12)
      compoundFactorMonth = Math.pow(1 + r/n, n/12);
    }

    // Loop
    for(let m = 1; m <= totalMonths; m++) {
      let interestEarned = 0;
      let monthContrib = cMonthly;

      // Add Annual contrib in month 1 of each year? Or spread? 
      // Requirement: "Annual contribution". Usually Lump sum?
      // Let's assume End of Year or Beginning of Year? 
      // Standard: Beginning of year implies Month 1. End of year implies Month 12.
      // Let's stick to Month 1 (Beginning) or Month 12 (End) based on user preference?
      // Actually, user "Contribution timing" usually applies to the periodic flow. 
      // Let's assume Annual contribution happens once a year.
      // If "Beginning": Month 1, 13, 25...
      // If "End": Month 12, 24, 36...
      
      let isAnnualMonth = false;
      if(isBeg) {
        if((m-1) % 12 === 0) isAnnualMonth = true;
      } else {
        if(m % 12 === 0) isAnnualMonth = true;
      }
      
      let currentDeposit = cMonthly;
      if(isAnnualMonth) currentDeposit += cAnnual;

      // Logic:
      // Beginning: Add Deposit -> Calc Interest on (Bal + Deposit)
      // End: Calc Interest on Bal -> Add Deposit
      
      let balForInterest = balance;
      
      if(isBeg) {
        balance += currentDeposit;
        balForInterest = balance;
        totalContrib += currentDeposit;
        yearContrib += currentDeposit;
      }
      
      // Apply Interest
      // NewBal = OldBal * Factor
      // Interest = NewBal - OldBal
      const newBal = balForInterest * compoundFactorMonth;
      interestEarned = newBal - balForInterest;
      
      // Tax Adjustment (on interest only)
      // "Taxes are applied to interest earned per period"
      if(taxRate > 0) {
        const tax = interestEarned * taxRate;
        interestEarned -= tax; 
        totalTaxPaid += tax;
      }
      
      balance = balForInterest + interestEarned;
      yearInterest += interestEarned;

      // End of period deposit
      if(!isBeg) {
         balance += currentDeposit;
         totalContrib += currentDeposit;
         yearContrib += currentDeposit;
      }

      // Record Year Data
      // If m is multiple of 12 OR m is last month
       if(m % 12 === 0 || m === totalMonths) {
         const currentYear = Math.ceil(m/12);
         // If we are mid-year (e.g. month 6 of year 5), this row handles that partial year.
         // If we already added this year (e.g. month 12), update it? 
         // Actually simpler to push row at end of logic block.
       }
       
       // Store for aggregation
       // We can just build the schedule array at the end of each year loop or track year change.
       if (m % 12 === 0 || m === totalMonths) {
         // Year Row
         schedule.push({
           year: Math.ceil(m/12),
           begin: yearStartBal,
           contrib: yearContrib,
           interest: yearInterest,
           end: balance
         }); 
         
         // Reset year trackers
         yearStartBal = balance;
         yearContrib = 0;
         yearInterest = 0;
       }
    }

    const totalInterest = balance - P - totalContrib;
    
    // Inflation Logic
    // Real Value = Nominal / (1 + inf)^t
    // t in years
    const tYears = totalMonths / 12;
    const realValue = balance / Math.pow(1 + inflRate, tYears);

    return {
      balance,
      totalPrincipal: P,
      totalContrib,
      totalInterest,
      realValue,
      schedule
    };
  }

  // --- Render ---
  btn.onclick = () => {
    // 1. Validate
    const P = getNum(initialIn);
    if(P < 0) return showErr("Initial investment cannot be negative");
    const y = getNum(yearsIn); 
    const m = getNum(monthsIn);
    if((y*12 + m) <= 0) return showErr("Investment duration must be greater than 0");

    // 2. Calculate
    const res = calculate();

    // 3. Update Text
    txtEnding.textContent = "$" + format(res.balance);
    // User requested Total Principal to match "Total Invested" (Initial + Contribs)
    txtPrincipal.textContent = "$" + format(res.totalPrincipal + res.totalContrib);
    txtContrib.textContent = "$" + format(res.totalContrib);
    txtInterest.textContent = "$" + format(res.totalInterest);
    
    // Buying Power
    if(getNum(inflationIn) > 0) {
      rowBuyingPower.style.display = "flex";
      txtBuyingPower.textContent = "$" + format(res.realValue);
    } else {
      rowBuyingPower.style.display = "none";
    }

    // 4. Update Donut
    // Total = Balance
    // Segments: Initial, Contrib, Interest
    const total = res.balance;
    let pInit = 0, pContrib = 0, pInterest = 0;
    
    if(total > 0) {
      pInit = (res.totalPrincipal / total) * 100;
      pContrib = (res.totalContrib / total) * 100;
      pInterest = (res.totalInterest / total) * 100; // Can be negative if loss? Interest calc'd above includes tax deduction, so could be low, but usually positive.
      // If Interest is negative (unlikely here unless tax > 100% or loss?), clamp 0.
      if(pInterest < 0) pInterest = 0;
    }
    
    // SVG Dash Arrays
    // Dasharray: LENGTH GAP
    // We need cumulative offsets.
    // Order: Interest (Top/Orange), Contrib (Middle/Blue), Initial (Bottom/Dark)
    // Actually standard donut segments stack. 
    // Segment 1 starts at -90deg.
    // Segment 2 starts at -90 + seg1_deg
    // ...
    
    // Colors mapped in CSS:
    // #donut-interest (Accent)
    // #donut-contrib (Muted)
    // #donut-initial (Primary)
    
    // Let's map values:
    // Interest
    donutInterest.setAttribute("stroke-dasharray", `${pInterest} ${100-pInterest}`);
    donutInterest.setAttribute("transform", "rotate(-90 21 21)"); 
    
    // Contrib
    donutContrib.setAttribute("stroke-dasharray", `${pContrib} ${100-pContrib}`);
    // Rotate by Interest amt
    donutContrib.setAttribute("transform", `rotate(${-90 + (pInterest * 3.6)} 21 21)`); 
    
    // Initial
    donutInitial.setAttribute("stroke-dasharray", `${pInit} ${100-pInit}`);
    // Rotate by Interest + Contrib
    donutInitial.setAttribute("transform", `rotate(${-90 + ((pInterest + pContrib) * 3.6)} 21 21)`);

    // Center Label (Interest Yield ?) or just "Total"? 
    // Mortgage calc showed Interest %.
    // Let's show Interest % here too.
    donutLabel.textContent = pInterest.toFixed(0) + "%";

    // Tooltip Data
    donutInterest.dataset.label = "Interest";
    donutInterest.dataset.amount = "$" + format(res.totalInterest);
    donutInterest.dataset.percent = pInterest.toFixed(1) + "%";
    donutInterest.dataset.color = "#FFAE1A"; // Accent

    donutContrib.dataset.label = "Contributions";
    donutContrib.dataset.amount = "$" + format(res.totalContrib);
    donutContrib.dataset.percent = pContrib.toFixed(1) + "%";
    donutContrib.dataset.color = "#4B4D6F"; // Contrib Color

    donutInitial.dataset.label = "Initial Principal";
    donutInitial.dataset.amount = "$" + format(res.totalPrincipal);
    donutInitial.dataset.percent = pInit.toFixed(1) + "%";
    donutInitial.dataset.color = "#1E1E2F"; // Primary

    // 5. Render Schedule
    // Pass Initial P to handle Year 1 Deposit display
    renderSchedule(res.schedule, res.totalPrincipal);
    amHead.textContent = `Total duration: ${y} years, ${m} months`;
    amFull.style.display = "block";
    toggleLink.style.display = "inline-block";
    toggleLink.textContent = "Hide Annual Schedule";
    
    showErr('');
    btnReset.style.display = 'block';
  };

  function renderSchedule(rows, initialPrincipal) {
    accRoot.innerHTML = "";
    // Header mimicking reference: Year | Deposit | Interest | Ending balance
    
    rows.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "acc-row";
      
      // Determine Deposit value for display
      // If Year 1 (i===0), Deposit = Contrib + Initial
      let deposit = r.contrib;
      if(i === 0) deposit += initialPrincipal;

      // Grid: Year | Deposit | Interest | End
      row.innerHTML = `
        <div class="year">Year ${r.year}</div>
        <div class="num" title="Deposit">$${format(deposit)}</div>
        <div class="num" title="Interest">$${format(r.interest)}</div>
        <div class="num" title="End Balance" style="font-weight:600">$${format(r.end)}</div>
      `;
      accRoot.appendChild(row);
    });
  }

  // Reset
  btnReset.onclick = () => {
    [initialIn, contribAnnualIn, contribMonthlyIn, rateIn, yearsIn, monthsIn, taxIn, inflationIn].forEach(el => el.value = '');
    timingEnd.checked = true;
    freqIn.value = "12";
    
    txtEnding.textContent = "$0.00";
    txtPrincipal.textContent = "$0.00";
    txtContrib.textContent = "$0.00";
    txtInterest.textContent = "$0.00";
    rowBuyingPower.style.display = "none";
    
    donutInterest.setAttribute("stroke-dasharray", "0 100");
    donutContrib.setAttribute("stroke-dasharray", "0 100");
    donutInitial.setAttribute("stroke-dasharray", "0 100");
    donutLabel.textContent = "";
    
    amFull.style.display = "none";
    toggleLink.style.display = "none";
    accRoot.innerHTML = "";
    
    btnReset.style.display = "none";
    updateBtn();
  };

  toggleLink.onclick = () => {
     const show = amFull.style.display === "none";
     amFull.style.display = show ? "block" : "none";
     toggleLink.textContent = show ? "Hide Annual Schedule" : "View Annual Schedule";
  };

  // Tooltip Logic (Standard)
  const segments = [donutInitial, donutContrib, donutInterest];
  
  function showTooltip(e) {
    const t = e.target;
    if(!t.dataset.label) return; 
    tooltip.style.display = 'block';
    tooltip.style.opacity = '1';
    tooltip.style.backgroundColor = t.dataset.color; 
    tooltip.innerHTML = `
      <div style="font-weight:600;font-size:15px;margin-bottom:2px">${t.dataset.label}</div>
      <div style="font-size:13px">${t.dataset.amount} (${t.dataset.percent})</div>
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
    setTimeout(() => { if(tooltip.style.opacity==='0') tooltip.style.display='none'; }, 200);
  }
  segments.forEach(s => {
    s.addEventListener('mouseenter', showTooltip);
    s.addEventListener('mousemove', moveTooltip);
    s.addEventListener('mouseleave', hideTooltip);
  });

  // Init
  updateBtn();

})();
