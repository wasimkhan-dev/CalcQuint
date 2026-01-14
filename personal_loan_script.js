(function() {
  // ------------------------------------------------------------------------
  // 1. INPUT ELEMENT REFERENCES
  // ------------------------------------------------------------------------
  const elLoanAmount = document.getElementById('cq-loan-amount');
  const elRate       = document.getElementById('cq-rate');
  const elYears      = document.getElementById('cq-years');
  const elMonths     = document.getElementById('cq-months');
  const elStartDate  = document.getElementById('cq-start-date');

  const elCalcBtn    = document.getElementById('cq-calc-btn');
  const elResetBtn   = document.getElementById('cq-reset-btn');
  const elError      = document.getElementById('cq-input-error');

  // Outputs
  const outMonthly       = document.getElementById('txt-monthly');
  const outPayoffDate    = document.getElementById('txt-payoff-date');
  const outTotalPayments = document.getElementById('txt-total-payments');
  const outTotalInterest = document.getElementById('txt-total-interest');
  
  const rightPanel       = document.querySelector('.cq-right');

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
    amount: 10000,
    rate: 10,
    years: 3,
    months: 0,
    startDate: '' // "YYYY-MM"
  };

  let schedule = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Init
  function init() {
    // Set default Date to next month or current month?
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2,'0');
    elStartDate.value = `${y}-${m}`;
    state.startDate = elStartDate.value;

    elCalcBtn.addEventListener('click', handleInput);
    
    // Validation listeners
    [elLoanAmount, elRate, elYears, elMonths].forEach(el => {
      el.addEventListener('input', checkValidity);
    });

    // Amortization toggle
    toggleLink.addEventListener('click', () => {
      if(amFullDiv.style.display === 'none') {
        amFullDiv.style.display = 'block';
        toggleLink.textContent = 'Hide Amortization Table';
        amFullDiv.scrollIntoView({behavior: 'smooth'});
      } else {
        amFullDiv.style.display = 'none';
        toggleLink.textContent = 'View Amortization Table';
      }
    });

    exportBtn.addEventListener('click', exportCSV);

    // Tooltip hover
    setupChartTooltips();

    // Initial check
    checkValidity();
    // Do NOT run calculate(false) automatically on load anymore
  }

  // ------------------------------------------------------------------------
  // 3. HANDLERS
  // ------------------------------------------------------------------------
  function handleInput() {
    readInputs();
    calculate(true);
  }

  function checkValidity() {
    const amt = parseFloat(elLoanAmount.value);
    const rt  = parseFloat(elRate.value);
    const yrs = parseFloat(elYears.value);
    const mos = parseFloat(elMonths.value);

    // Basic validity: Amount > 0, Rate >= 0, and at least some Term (Years or Months > 0)
    const hasAmount = !isNaN(amt) && amt > 0;
    const hasRate   = !isNaN(rt)  && rt >= 0;
    const hasTerm   = (!isNaN(yrs) && yrs > 0) || (!isNaN(mos) && mos > 0);

    if (hasAmount && hasRate && hasTerm) {
      elCalcBtn.disabled = false;
      elCalcBtn.classList.add('active');
    } else {
      elCalcBtn.disabled = true;
      elCalcBtn.classList.remove('active');
    }
  }

  function readInputs() {
    state.amount    = parseFloat(elLoanAmount.value) || 0;
    state.rate      = parseFloat(elRate.value) || 0;
    state.years     = parseInt(elYears.value) || 0;
    state.months    = parseInt(elMonths.value) || 0;
    state.startDate = elStartDate.value; // "YYYY-MM"
  }

  // ------------------------------------------------------------------------
  // 4. CORE CALCULATION
  // ------------------------------------------------------------------------
  function calculate(shouldScroll) {
    elError.style.display = 'none';
    
    // Validations
    if (state.amount <= 0) {
       if(elLoanAmount.value !== '' && state.amount <= 0) showError('Loan amount must be > 0.');
       resetOutputs(); return;
    }
    const totalTermMonths = (state.years * 12) + state.months;
    if (totalTermMonths <= 0) {
       if(elYears.value !== '' || elMonths.value !== '') showError('Loan term must be at least 1 month.');
       resetOutputs(); return;
    }

    // Calculation
    const monthlyRate = (state.rate / 100) / 12;
    let monthlyPayment = 0;

    if (state.rate === 0) {
      monthlyPayment = state.amount / totalTermMonths;
    } else {
      const pow = Math.pow(1 + monthlyRate, totalTermMonths);
      monthlyPayment = state.amount * ( (monthlyRate * pow) / (pow - 1) );
    }

    // Outputs
    const totalPayments = monthlyPayment * totalTermMonths;
    const totalInterest = totalPayments - state.amount;
    
    // Payoff Date
    let payoffStr = "--";
    if(state.startDate) {
      const parts = state.startDate.split('-'); // [YYYY, MM]
      if(parts.length === 2) {
        const startY = parseInt(parts[0]);
        const startM = parseInt(parts[1]) - 1; // 0-based
        const endDate = new Date(startY, startM + totalTermMonths, 1);
        // Format Month Year
        payoffStr = monthNames[endDate.getMonth()] + " " + endDate.getFullYear();
      }
    }

    // Render
    outMonthly.textContent = fmtCurrency(monthlyPayment);
    outPayoffDate.textContent = payoffStr;
    outTotalPayments.textContent = fmtCurrency(totalPayments);
    outTotalInterest.textContent = fmtCurrency(totalInterest);

    // Update Chart
    updateChart(state.amount, totalInterest);

    // Generate Schedule
    generateSchedule(state.amount, monthlyRate, totalTermMonths, monthlyPayment, state.startDate);
    renderSchedule();
    
    if(shouldScroll && schedule.length > 0) {
       // Auto-open and scroll to Amortization Table
       amFullDiv.style.display = 'block';
       toggleLink.textContent = 'Hide Amortization Table';
       amFullDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
       rightPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Show Reset Button
    elResetBtn.style.display = 'block'; // or 'inline-block' depending on CSS, but block/flex handles it
  }

  elResetBtn.addEventListener('click', () => {
     [elLoanAmount, elRate, elYears, elMonths].forEach(el => el.value = '');
     const now = new Date();
     elStartDate.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

     state = { amount:0, rate:0, years:0, months:0, startDate: elStartDate.value };
     resetOutputs();
     elError.style.display = 'none';
     amFullDiv.style.display = 'none';
     toggleLink.textContent = 'View Amortization Table';
     csvCtas.style.display = 'none';

     // Hide Reset Button & Disable Calculate
     elResetBtn.style.display = 'none';
     elCalcBtn.disabled = true;
     elCalcBtn.classList.remove('active');
     checkValidity(); // update state
  });

  function showError(msg) {
    elError.textContent = msg;
    elError.style.display = 'block';
  }
  
  function resetOutputs() {
    const zero = fmtCurrency(0);
    outMonthly.textContent = zero;
    outPayoffDate.textContent = "--";
    outTotalPayments.textContent = zero;
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
        const type = el.id === 'donut-principal' ? 'Principal' : 'Interest';
        const val = el.dataset.val;

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
  function generateSchedule(loanAmount, monthlyRate, totalMonths, monthlyPayment, startDateStr) {
    schedule = [];
    let balance = loanAmount;
    const isZeroInterest = (monthlyRate === 0);

    // Date setup
    let currentY = 0; 
    let currentM = 0; // 0-based
    if(startDateStr) {
      const parts = startDateStr.split('-');
      if(parts.length===2) {
        currentY = parseInt(parts[0]);
        currentM = parseInt(parts[1]) - 1; 
      }
    }

    for(let i=1; i <= totalMonths; i++) {
      let interest = isZeroInterest ? 0 : balance * monthlyRate;
      let principal = monthlyPayment - interest;
      if(principal > balance) principal = balance;
      
      balance -= principal;
      if(balance < 0) balance = 0;

      // Calculate date
      const d = new Date(currentY, currentM + i - 1, 1);
      d.setMonth(d.getMonth() + 1); 

      const dateStr = monthNames[d.getMonth()] + " " + d.getFullYear();

      schedule.push({
        num: i,
        date: dateStr,
        begBal: balance + principal,
        interest: interest,
        principal: principal,
        endBal: balance
      });
      
      if(balance <= 0 && i < totalMonths) break; 
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
      const yLabel     = yearSlice[yearSlice.length - 1].date.split(' ')[1]; // Get Year from last item

      const row = document.createElement('div');
      row.className = 'acc-row';
      row.innerHTML = `
        <div class="year"><span class="icon">+</span> ${yLabel}</div>
        <div class="num">${fmtCurrency(yearSlice[0].begBal)}</div>
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
              <th>Date</th>
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
            <td data-label="Date">${item.date}</td>
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
    csvContent += "Date,Beginning Balance,Interest,Principal,Ending Balance\n";
    schedule.forEach(row => {
      const r = [row.date, row.begBal.toFixed(2), row.interest.toFixed(2), row.principal.toFixed(2), row.endBal.toFixed(2)];
      csvContent += r.join(",") + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "personal_loan_amortization.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  init();

})();
