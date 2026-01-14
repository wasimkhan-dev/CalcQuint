(function() {
  // ------------------------------------------------------------------------
  // 1. INPUT ELEMENT REFERENCES
  // ------------------------------------------------------------------------
  const elCurBal     = document.getElementById('cq-current-balance');
  const elCurPmt     = document.getElementById('cq-current-payment');
  const elCurRate    = document.getElementById('cq-current-rate');
  
  const elNewTerm    = document.getElementById('cq-new-term');
  const elNewRate    = document.getElementById('cq-new-rate');
  const elPoints     = document.getElementById('cq-points');
  const elCosts      = document.getElementById('cq-costs');
  const elCashOut    = document.getElementById('cq-cash-out');

  const elCalcBtn    = document.getElementById('cq-calc-btn');
  const elResetBtn   = document.getElementById('cq-reset-btn');
  const elError      = document.getElementById('cq-input-error');

  // Outputs
  const outNewMonthly    = document.getElementById('txt-new-monthly');
  const outSavings       = document.getElementById('txt-savings');
  const outBreakeven     = document.getElementById('txt-breakeven');
  const outTotalRefiCost = document.getElementById('txt-total-refi-cost');
  const outTotalNewInt   = document.getElementById('txt-total-new-interest');
  
  const rightPanel       = document.querySelector('.cq-right'); // For scrolling

  // Chart
  const donutInterest  = document.getElementById('donut-interest');
  const donutPrincipal = document.getElementById('donut-principal');
  const donutLabel     = document.getElementById('donut-label');
  const chartTooltip   = document.getElementById('chart-tooltip');
  
  // Amortization
  const toggleLink     = document.getElementById('toggle-am-link');
  const amFullDiv      = document.getElementById('amortization-full');
  const accRoot        = document.getElementById('acc-root');
  const amTotalMonths  = document.getElementById('am-total-months');
  const csvCtas        = document.getElementById('csv-ctas');
  const exportBtn      = document.getElementById('export-csv-btn');

  // ------------------------------------------------------------------------
  // 2. STATE & CONSTANTS
  // ------------------------------------------------------------------------
  let state = {
    curBal: 200000,
    curPmt: 1500,
    curRate: 6.0,
    newTerm: 30,
    newRate: 5.0,
    points: 0,
    costs: 3000,
    cashOut: 0
  };

  let schedule = [];

  // Init
  function init() {
    elCalcBtn.addEventListener('click', handleInput);
    // elCalcBtn.classList.add('active'); // Removed: Initially inactive

    // Disable initially
    elCalcBtn.disabled = true;

    // Add input listeners for validation
    const inputs = [elCurBal, elCurPmt, elCurRate, elNewTerm, elNewRate, elPoints, elCosts, elCashOut];
    inputs.forEach(el => {
      el.addEventListener('input', checkForm);
    });

    // Amortization toggle
    toggleLink.addEventListener('click', () => {
      if(amFullDiv.style.display === 'none') {
        amFullDiv.style.display = 'block';
        toggleLink.textContent = 'Hide Amortization Table';
        amFullDiv.scrollIntoView({behavior: 'smooth'}); // Scroll to table when opened
      } else {
        amFullDiv.style.display = 'none';
        toggleLink.textContent = 'View Amortization Table';
      }
    });

    exportBtn.addEventListener('click', exportCSV);

    // Tooltip hover
    setupChartTooltips();

    // readInputs(); // Remove initial read/calc
    // calculate(false); // Remove initial calculation
  }

  function checkForm() {
    // Check if required fields have values
    // Required: Balance, Pmt, Rate, New Term, New Rate
    const hasValues = (
      elCurBal.value.trim() !== '' &&
      elCurPmt.value.trim() !== '' &&
      elCurRate.value.trim() !== '' &&
      elNewTerm.value.trim() !== '' &&
      elNewRate.value.trim() !== ''
    );

    elCalcBtn.disabled = !hasValues;
    if(hasValues) {
      elCalcBtn.classList.add('active');
    } else {
      elCalcBtn.classList.remove('active');
    }
  }

  // ------------------------------------------------------------------------
  // 3. HANDLERS
  // ------------------------------------------------------------------------
  function handleInput() {
    readInputs();
    calculate(true); // Scroll on click
    elResetBtn.style.display = 'block'; // Show reset button
  }

  function readInputs() {
    state.curBal  = parseFloat(elCurBal.value) || 0;
    state.curPmt  = parseFloat(elCurPmt.value) || 0;
    state.curRate = parseFloat(elCurRate.value) || 0;
    
    state.newTerm = parseInt(elNewTerm.value) || 0;
    state.newRate = parseFloat(elNewRate.value) || 0;
    state.points  = parseFloat(elPoints.value) || 0;
    state.costs   = parseFloat(elCosts.value) || 0;
    state.cashOut = parseFloat(elCashOut.value) || 0;
  }

  // ------------------------------------------------------------------------
  // 4. CORE CALCULATION
  // ------------------------------------------------------------------------
  function calculate(shouldScroll) {
    elError.style.display = 'none';
    
    // Validations
    if (state.curBal <= 0) {
       if(elCurBal.value !== '' && state.curBal <= 0) showError('Current remaining balance must be > 0.');
       resetOutputs(); return;
    }
    if (state.curPmt <= 0) {
       if(elCurPmt.value !== '' && state.curPmt <= 0) showError('Current monthly payment must be > 0.');
       resetOutputs(); return;
    }
    if (state.newTerm < 1) {
       if(elNewTerm.value !== '' && state.newTerm < 1) showError('New loan term must be at least 1 year.');
       resetOutputs(); return;
    }

    // --- REFINANCE LOGIC ---

    // 1. New Loan Amount
    // newLoanAmount = remainingBalance + cashOutAmount
    const newLoanAmount = state.curBal + state.cashOut;

    // 2. New Monthly Payment
    const monthlyRate = (state.newRate / 100) / 12;
    const numberOfPayments = state.newTerm * 12;
    let newMonthlyPayment = 0;

    if (state.newRate === 0) {
      newMonthlyPayment = newLoanAmount / numberOfPayments;
    } else {
      const pow = Math.pow(1 + monthlyRate, numberOfPayments);
      newMonthlyPayment = newLoanAmount * ( (monthlyRate * pow) / (pow - 1) );
    }

    // 3. Primary Outputs
    // 3. Primary Outputs
    const monthlyPaymentSavings = state.curPmt - newMonthlyPayment;

    // Interest Savings (used for Breakeven calculation)
    const currentMonthlyInterest = state.curBal * (state.curRate / 100 / 12);
    const newMonthlyInterestPart = newLoanAmount * monthlyRate;
    const monthlyInterestSavings = currentMonthlyInterest - newMonthlyInterestPart;
    
    // 4. Costs
    const pointsCost = newLoanAmount * (state.points / 100);
    const totalUpfrontCost = pointsCost + state.costs;

    // 5. Total New Payments & Interest
    const totalNewPayments = newMonthlyPayment * numberOfPayments;
    const totalNewInterest = totalNewPayments - newLoanAmount;
    
    const totalRefinanceCost = totalNewInterest + totalUpfrontCost;

    // 6. Breakeven (Iterative Calculation)
    let breakevenMonths = null;
    if (totalUpfrontCost > 0) {
      let cumulativeSavings = 0;
      let tempOldBal = state.curBal;
      let tempNewBal = newLoanAmount;
      const oldMonthlyRate = (state.curRate / 100) / 12;

      // Simulate up to reasonable limit (e.g. 100 years) to find breakeven
      for (let m = 1; m <= 1200; m++) {
        // Old Loan Interest
        const oldInt = tempOldBal * oldMonthlyRate;
        const oldPrin = state.curPmt - oldInt;
        tempOldBal -= oldPrin;
        
        // New Loan Interest
        const newInt = tempNewBal * monthlyRate;
        const newPrin = newMonthlyPayment - newInt;
        tempNewBal -= newPrin;

        // Cumulative Interest Savings
        cumulativeSavings += (oldInt - newInt);

        if (cumulativeSavings >= totalUpfrontCost) {
          breakevenMonths = m;
          break;
        }
        
        // Safety break if loans paid off
        if (tempOldBal <= 0 && tempNewBal <= 0) break;
      }
    } else {
        // No cost = immediate breakeven if savings positive
        if (monthlyInterestSavings > 0) breakevenMonths = 0;
    }

    // --- RENDER ---
    outNewMonthly.textContent = fmtCurrency(newMonthlyPayment);
    outSavings.textContent = fmtCurrency(monthlyPaymentSavings);
    
    // Colorize Savings
    if(monthlyPaymentSavings > 0) {
      outSavings.style.color = 'var(--accent)'; 
      outSavings.textContent = "+" + outSavings.textContent;
    } else if(monthlyPaymentSavings < 0) {
      outSavings.style.color = '#b00020'; // negative red
    } else {
      outSavings.style.color = 'var(--muted)';
    }

    if(breakevenMonths !== null) {
      outBreakeven.textContent = breakevenMonths + " Months";
    } else {
      outBreakeven.textContent = "Never (No Savings)";
    }

    outTotalRefiCost.textContent = fmtCurrency(totalRefinanceCost);
    outTotalNewInt.textContent = fmtCurrency(totalNewInterest);

    // Update Chart with New Loan Principals (New Loan Amount vs Total New Interest)
    updateChart(newLoanAmount, totalNewInterest);

    // Generate Schedule (Always generate, don't auto open unless requested?)
    // User wants to scroll to table on Calculate.
    generateSchedule(newLoanAmount, monthlyRate, numberOfPayments, newMonthlyPayment);
    renderSchedule();
    
    if(shouldScroll && schedule.length > 0) {
       // Auto-open and scroll to Amortization Table
       amFullDiv.style.display = 'block';
       toggleLink.textContent = 'Hide Amortization Table';
       amFullDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (shouldScroll && rightPanel) {
       // Fallback if no schedule
       rightPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  elResetBtn.addEventListener('click', () => {
     [elCurBal, elCurPmt, elCurRate, elNewTerm, elNewRate, elPoints, elCosts, elCashOut].forEach(el => el.value = '');
     state = { curBal:0, curPmt:0, curRate:0, newTerm:0, newRate:0, points:0, costs:0, cashOut:0 };
     resetOutputs();
     elError.style.display = 'none';
     amFullDiv.style.display = 'none';
     toggleLink.textContent = 'View Amortization Table';
     csvCtas.style.display = 'none';
     exportBtn.style.display = 'none';
     
     // Hide reset button
     elResetBtn.style.display = 'none';
     // Disable calc
     elCalcBtn.disabled = true;
     elCalcBtn.classList.remove('active');
  });

  function showError(msg) {
    elError.textContent = msg;
    elError.style.display = 'block';
  }
  
  function resetOutputs() {
    const zero = fmtCurrency(0);
    outNewMonthly.textContent = zero;
    outSavings.textContent = zero;
    outBreakeven.textContent = "--";
    outTotalRefiCost.textContent = zero;
    outTotalNewInt.textContent = zero;
    outSavings.style.color = 'var(--muted)';
    updateChart(0,0);
    accRoot.innerHTML = '';
  }

  // ------------------------------------------------------------------------
  // 5. CHART
  // ------------------------------------------------------------------------
  function updateChart(principal, interest) {
    const total = principal + interest;
    if (total <= 0) {
      donutInterest.style.strokeDasharray = `0 100`;
      donutPrincipal.style.strokeDasharray = `0 100`;
      donutLabel.textContent = '0%';
      return;
    }
    const pPct = (principal / total) * 100;
    const iPct = (interest / total) * 100;

    donutPrincipal.style.strokeDasharray = `${pPct} ${100 - pPct}`;
    donutPrincipal.style.strokeDashoffset = '0';
    
    donutInterest.style.strokeDasharray = `${iPct} ${100 - iPct}`;
    donutInterest.style.strokeDashoffset = `-${pPct}`; 

    donutLabel.textContent = Math.round(pPct) + '%';
    donutPrincipal.dataset.val = fmtCurrency(principal);
    donutInterest.dataset.val  = fmtCurrency(interest);
  }

  function setupChartTooltips() {
    [donutPrincipal, donutInterest].forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const type = el.id === 'donut-principal' ? 'New Principal' : 'New Interest';
        const val = el.dataset.val;
        
        // Tooltip Logic: Yellow for Interest only
        if(el.id === 'donut-interest') {
          chartTooltip.classList.add('interest');
        } else {
          chartTooltip.classList.remove('interest');
        }

        chartTooltip.textContent = `${type}: ${val}`;
        chartTooltip.style.display = 'block';
        chartTooltip.style.opacity = '1';
      });
      el.addEventListener('mousemove', (e) => {
        chartTooltip.style.left = (e.clientX + 10) + 'px';
        chartTooltip.style.top = (e.clientY - 30) + 'px';
      });
      el.addEventListener('mouseleave', () => {
        chartTooltip.style.display = 'none';
        chartTooltip.style.opacity = '0';
      });
    });
  }

  // ------------------------------------------------------------------------
  // 6. AMORTIZATION
  // ------------------------------------------------------------------------
  function generateSchedule(loanAmount, monthlyRate, totalMonths, monthlyPayment) {
    schedule = [];
    let balance = loanAmount;
    const isZeroInterest = (monthlyRate === 0);

    for(let m=1; m <= totalMonths; m++) {
      let interest = isZeroInterest ? 0 : balance * monthlyRate;
      let principal = monthlyPayment - interest;
      if(principal > balance) principal = balance;
      
      balance -= principal;
      if(balance < 0) balance = 0;

      schedule.push({
        month: m,
        begBal: balance + principal,
        interest: interest,
        principal: principal,
        endBal: balance
      });
      
      if(balance <= 0 && m < totalMonths) break; 
    }
    
    amTotalMonths.textContent = `Total months: ${schedule.length}`;
    
    if(schedule.length > 0) {
      toggleLink.style.display = 'block';
      csvCtas.style.display = 'flex';
    } else {
      toggleLink.style.display = 'none';
      csvCtas.style.display = 'none';
    }
  }

  function renderSchedule() {
    accRoot.innerHTML = '';
    const years = Math.ceil(schedule.length / 12);
    
    for(let y=1; y<=years; y++) {
      const yearStart = (y-1)*12;
      const yearEnd = Math.min(y*12, schedule.length);
      const yearSlice = schedule.slice(yearStart, yearEnd);
      
      const yPrincipal = yearSlice.reduce((sum, item) => sum + item.principal, 0);
      const yInterest  = yearSlice.reduce((sum, item) => sum + item.interest, 0);
      const yEndBal    = yearSlice[yearSlice.length - 1].endBal;
      const yBegBal    = yearSlice[0].begBal;

      const row = document.createElement('div');
      row.className = 'acc-row';
      row.innerHTML = `
        <div class="year"><span class="icon">+</span> Year ${y}</div>
        <div class="num">${fmtCurrency(yBegBal)}</div>
        <div class="num">${fmtCurrency(yInterest)}</div>
        <div class="num">${fmtCurrency(yPrincipal)}</div>
        <div class="num">${fmtCurrency(yEndBal)}</div>
      `;
      
      const panel = document.createElement('div');
      panel.className = 'acc-panel';
      let tableHtml = `
        <table class="month-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Beginning Bal.</th>
              <th>Interest Paid</th>
              <th>Principal Paid</th>
              <th>Ending Bal.</th>
            </tr>
          </thead>
          <tbody>
      `;
      yearSlice.forEach(item => {
        tableHtml += `
          <tr>
            <td data-label="Month">${item.month}</td>
            <td data-label="Beg.">${fmtCurrency(item.begBal)}</td>
            <td data-label="Int.">${fmtCurrency(item.interest)}</td>
            <td data-label="Prin.">${fmtCurrency(item.principal)}</td>
            <td data-label="End">${fmtCurrency(item.endBal)}</td>
          </tr>
        `;
      });
      tableHtml += `</tbody></table>`;
      panel.innerHTML = tableHtml;

      row.addEventListener('click', () => {
        const icon = row.querySelector('.icon');
        if(panel.style.display === 'block'){
          panel.style.display = 'none';
          icon.textContent = '+';
        } else {
          panel.style.display = 'block';
          icon.textContent = '-';
        }
      });

      accRoot.appendChild(row);
      accRoot.appendChild(panel);
    }
  }

  // ------------------------------------------------------------------------
  // 7. UTILS
  // ------------------------------------------------------------------------
  function fmtCurrency(val) {
    if (isNaN(val)) return '$0.00';
    return '$' + val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function exportCSV() {
    if(schedule.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Month,Beginning Balance,Interest,Principal,Ending Balance\n";
    schedule.forEach(row => {
      const r = [row.month, row.begBal.toFixed(2), row.interest.toFixed(2), row.principal.toFixed(2), row.endBal.toFixed(2)];
      csvContent += r.join(",") + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "refinance_amortization.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  init();

})();
