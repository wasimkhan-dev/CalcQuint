(function() {
  // ------------------------------------------------------------------------
  // 1. INPUT ELEMENT REFERENCES
  // ------------------------------------------------------------------------
  const elPrice      = document.getElementById('cq-price');
  const elTerm       = document.getElementById('cq-term');
  const elRate       = document.getElementById('cq-rate');
  const elIncentives = document.getElementById('cq-incentives');
  const elDown       = document.getElementById('cq-down');
  const elTradeVal   = document.getElementById('cq-trade-val');
  const elTradeOwed  = document.getElementById('cq-trade-owed');
  const elTaxRate    = document.getElementById('cq-tax-rate');
  const elFees       = document.getElementById('cq-fees');
  const elState      = document.getElementById('cq-state');
  
  const elCalcBtn    = document.getElementById('cq-calc-btn');
  const elResetBtn   = document.getElementById('cq-reset-btn');
  const elError      = document.getElementById('cq-input-error');

  // Outputs
  const outMonthly       = document.getElementById('txt-monthly');
  const outLoanAmt       = document.getElementById('txt-loan-amt');
  const outTax           = document.getElementById('txt-tax');
  const outUpfront       = document.getElementById('txt-upfront');
  const outTotalCost     = document.getElementById('txt-total-cost');
  const outTotalInterest = document.getElementById('txt-total-interest');

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
    price: 30000,
    term: 60,
    rate: 4.5,
    incentives: 0,
    down: 0,
    tradeVal: 0,
    tradeOwed: 0,
    taxRate: 0,
    fees: 0
  };

  let schedule = [];

  // Init
  function init() {
    // Attach listeners
    // [elPrice, elTerm, elRate, elIncentives, elDown, elTradeVal, elTradeOwed, elTaxRate, elFees].forEach(inp => {
    //   inp.addEventListener('input', handleInput);
    // });

    // Button: Calculate on click
    elCalcBtn.addEventListener('click', handleInput);
    elCalcBtn.classList.add('active'); // Make sure button is enabled visually

    // Amortization toggle
    toggleLink.addEventListener('click', () => {
      if(amFullDiv.style.display === 'none') {
        amFullDiv.style.display = 'block';
        toggleLink.textContent = 'Hide Amortization Table';
      } else {
        amFullDiv.style.display = 'none';
        toggleLink.textContent = 'View Amortization Table';
      }
    });

    exportBtn.addEventListener('click', exportCSV);

    // Tooltip hover
    setupChartTooltips();

    // Initial logic - Optional: Run once to show defaults or leave empty? 
    // Usually better to show defaults so it's not empty zeros.
    readInputs();
    calculate();
  }

  // ------------------------------------------------------------------------
  // 3. HANDLERS
  // ------------------------------------------------------------------------
  function handleInput() {
    readInputs();
    calculate();
  }

  function readInputs() {
    state.price      = parseFloat(elPrice.value) || 0;
    state.term       = parseInt(elTerm.value) || 0;
    state.rate       = parseFloat(elRate.value) || 0;
    state.incentives = parseFloat(elIncentives.value) || 0;
    state.down       = parseFloat(elDown.value) || 0;
    state.tradeVal   = parseFloat(elTradeVal.value) || 0;
    state.tradeOwed  = parseFloat(elTradeOwed.value) || 0;
    state.taxRate    = parseFloat(elTaxRate.value) || 0;
    state.fees       = parseFloat(elFees.value) || 0;
  }

  // ------------------------------------------------------------------------
  // 4. CORE CALCULATION
  // ------------------------------------------------------------------------
  function calculate() {
    // Validation
    elError.style.display = 'none';
    elCalcBtn.classList.add('active'); // always active for realtime
    
    if (state.price <= 0) {
      // Don't error immediately on empty initial, but if user types 0 or negative
      if(elPrice.value !== '' && state.price <= 0) {
         showError('Auto Price must be greater than 0.');
         return;
      }
      // If empty, just zero out
      resetOutputs();
      return;
    }
    if (state.term <= 0) {
       if(elTerm.value !== '') showError('Loan term must be > 0.');
       resetOutputs();
       return;
    }

    // --- LOGIC PER USER SPECS ---
    
    // 1. Net Trade-in
    // If negative, treat as additional cost (logic handled by subtraction order in loanAmount?)
    // User Formula: loanAmount = autoPrice - cashIncentives - downPayment - tradeInValue + tradeInOwed
    // So if (tradeVal - tradeOwed) is negative (upside down), it effectively adds to loan. Correct.
    
    // 2. Taxable Price
    // taxablePrice = autoPrice - cashIncentives - downPayment - tradeInValue (Min 0)
    let taxablePrice = state.price - state.incentives - state.down - state.tradeVal;
    if (taxablePrice < 0) taxablePrice = 0;

    // 3. Sales Tax
    const salesTax = taxablePrice * (state.taxRate / 100);

    // 4. Loan Amount (Financed Amount)
    // Formula: autoPrice - cashIncentives - downPayment - tradeInValue + tradeInOwed
    // Note: User said "Sales tax calculated once (not compounded)" and "Do not merge tax or fees into loan math".
    // So Loan Amount implies strictly the vehicle finance part + negative equity. 
    // Wait, usually if you don't pay tax/fees upfront, they are rolled into loan.
    // BUT user explicitly said: "Output results -> Total loan amount = Value: loanAmount"
    // And "Upfront payment = down + incentives + salesTax + fees".
    // This strongly implies Tax and Fees are PAID UPFRONT.
    // So I will NOT add them to loanAmount.
    
    let loanAmount = state.price - state.incentives - state.down - state.tradeVal + state.tradeOwed;
    if(loanAmount < 0) loanAmount = 0; // Cannot have negative loan

    // 5. Monthly Payment
    const monthlyRate = (state.rate / 100) / 12;
    const n = state.term;
    let monthlyPayment = 0;

    if (loanAmount === 0) {
       monthlyPayment = 0;
    } else if (state.rate === 0) {
       monthlyPayment = loanAmount / n;
    } else {
       // P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
       const pow = Math.pow(1 + monthlyRate, n);
       monthlyPayment = loanAmount * ( (monthlyRate * pow) / (pow - 1) );
    }

    // 6. Secondary Outputs
    const totalPayments = monthlyPayment * n;
    const totalInterest = totalPayments - loanAmount;
    
    // "Total cost (price, interest, tax, fees)"
    // totalCost = autoPrice + totalInterest + salesTax + fees
    const totalCost = state.price + totalInterest + salesTax + state.fees;

    // "Upfront Payment"
    // upfrontPayment = downPayment + cashIncentives + salesTax + fees
    const upfrontPayment = state.down + state.incentives + salesTax + state.fees;


    // Update DOM
    outMonthly.textContent = fmtCurrency(monthlyPayment);
    outLoanAmt.textContent = fmtCurrency(loanAmount);
    outTax.textContent = fmtCurrency(salesTax);
    outUpfront.textContent = fmtCurrency(upfrontPayment);
    outTotalCost.textContent = fmtCurrency(totalCost);
    outTotalInterest.textContent = fmtCurrency(totalInterest);

    // Update Chart
    updateChart(loanAmount, totalInterest);

    // Generate Schedule
    generateSchedule(loanAmount, monthlyRate, n, monthlyPayment);
    renderSchedule();
    
    // Auto-open Amortization Table
    if(schedule.length > 0) {
      amFullDiv.style.display = 'block';
      toggleLink.textContent = 'Hide Amortization Table';
    }
    amFullDiv.scrollIntoView({behavior: 'smooth'});
  }

  elResetBtn.addEventListener('click', () => {
     // Clear Inputs
     [elPrice, elTerm, elRate, elIncentives, elDown, elTradeVal, elTradeOwed, elTaxRate, elFees].forEach(el => el.value = '');
     elState.selectedIndex = 0; // Reset Select

     // Reset State
     state = {
       price: 0, term: 0, rate: 0, incentives: 0, down: 0, tradeVal: 0, tradeOwed: 0, taxRate: 0, fees: 0
     };

     resetOutputs();
     elError.style.display = 'none';

     // Hide Amortization
     amFullDiv.style.display = 'none';
     toggleLink.textContent = 'View Amortization Table';
     csvCtas.style.display = 'none';
     exportBtn.style.display = 'none'; // or csvCtas hides it
  });

  function showError(msg) {
    elError.textContent = msg;
    elError.style.display = 'block';
  }
  
  function resetOutputs() {
    const zero = fmtCurrency(0);
    outMonthly.textContent = zero;
    outLoanAmt.textContent = zero;
    outTax.textContent = zero;
    outUpfront.textContent = zero;
    outTotalCost.textContent = zero;
    outTotalInterest.textContent = zero;
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

    // Calculate percentages for the donut
    const pPct = (principal / total) * 100;
    const iPct = (interest / total) * 100;

    // Stroke-dasharray: "length gap"
    // Per user SVG setup: circumference is ~100 (r=15.915 => 2*pi*r = 100)
    
    // Principal starts at 0 (top because of rotate(-90))
    // Interest starts after Principal
    
    donutPrincipal.style.strokeDasharray = `${pPct} ${100 - pPct}`;
    
    // To stack them:
    // Actually, usually we offset the second one. 
    // But looking at index.html logic or standard CSS donuts:
    // If we want them to meet, we need `stroke-dashoffset`.
    // However, the existing CSS/SVG in index.html for mortgage actually overlays them or expects correct offsets.
    // Let's mimic standard behavior.
    // Segment 1 (Principal): start 0.
    // Segment 2 (Interest): start at pPct.
    
    // Since SVG circle dashoffset is counter-clockwise usually, check setup.
    // transform="rotate(-90 21 21)" rotates start to top.
    
    // Let's set Principal first.
    donutPrincipal.style.strokeDashoffset = '0';
    
    // Interest starts where Principal ends.
    // Offset needs to be -pPct (negative to move clockwise? or positive?)
    // standard is: offset = 100 - previous_segment_length (if iterating backwards) or just -previous.
    // Let's try:
    donutInterest.style.strokeDasharray = `${iPct} ${100 - iPct}`;
    donutInterest.style.strokeDashoffset = `-${pPct}`; 

    donutLabel.textContent = Math.round(pPct) + '%';
    
    // Store data for tooltip
    donutPrincipal.dataset.val = fmtCurrency(principal);
    donutInterest.dataset.val  = fmtCurrency(interest);
  }

  function setupChartTooltips() {
    [donutPrincipal, donutInterest].forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const type = el.id === 'donut-principal' ? 'Principal' : 'Interest';
        const val = el.dataset.val;
        chartTooltip.textContent = `${type}: ${val}`;
        chartTooltip.style.display = 'block';
        chartTooltip.style.opacity = '1';
      });
      el.addEventListener('mousemove', (e) => {
        const x = e.pageX; // clientX/Y relative to viewport, pageX/Y relative to doc
        const y = e.pageY;
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
    
    // If 0 interest
    const isZeroInterest = (monthlyRate === 0);

    for(let m=1; m <= totalMonths; m++) {
      let interest = isZeroInterest ? 0 : balance * monthlyRate;
      let principal = monthlyPayment - interest;
      
      // Last month fix
      if (m === totalMonths) {
          // just pay off whatever remainder?
          // or force balance to 0.
      }
      
      // If payment > balance + interest (early payoff?), usually not in fixed calc
      if(principal > balance) {
        principal = balance;
        // Adjust payment for last month?
        // monthlyPayment = principal + interest; 
      }
      
      balance -= principal;
      if(balance < 0) balance = 0;

      schedule.push({
        month: m,
        begBal: balance + principal,
        interest: interest,
        principal: principal,
        endBal: balance
      });
    }
    
    amTotalMonths.textContent = `Total months: ${totalMonths}`;
    
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
    
    // Group by year
    const years = Math.ceil(schedule.length / 12);
    
    for(let y=1; y<=years; y++) {
      const yearStart = (y-1)*12;
      const yearEnd = Math.min(y*12, schedule.length);
      const yearSlice = schedule.slice(yearStart, yearEnd);
      
      // Calculate Year Totals/End
      const yPrincipal = yearSlice.reduce((sum, item) => sum + item.principal, 0);
      const yInterest  = yearSlice.reduce((sum, item) => sum + item.interest, 0);
      const yEndBal    = yearSlice[yearSlice.length - 1].endBal;

      // Create Row
      const row = document.createElement('div');
      row.className = 'acc-row';
      row.innerHTML = `
        <div class="year">
          <span class="icon">+</span>
          Year ${y}
        </div>
        <div class="num">${fmtCurrency(yInterest)}</div>
        <div class="num">${fmtCurrency(yPrincipal)}</div>
        <div class="num">${fmtCurrency(yEndBal)}</div>
      `;
      
      // Month Panel
      const panel = document.createElement('div');
      panel.className = 'acc-panel';
      
      // Table
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

      // Toggle Event
      row.addEventListener('click', () => {
        const icon = row.querySelector('.icon');
        if(panel.style.display === 'block'){
          panel.style.display = 'none';
          icon.textContent = '+';
          row.classList.remove('open');
        } else {
          panel.style.display = 'block';
          icon.textContent = '-';
          row.classList.add('open');
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
      const r = [
        row.month,
        row.begBal.toFixed(2),
        row.interest.toFixed(2),
        row.principal.toFixed(2),
        row.endBal.toFixed(2)
      ];
      csvContent += r.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "auto_loan_amortization.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Start
  init();

})();
