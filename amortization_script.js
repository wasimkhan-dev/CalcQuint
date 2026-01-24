(function(){
  const $ = id => document.getElementById(id);

  // Inputs
  const loanAmtIn = $('cq-loan-amount');
  const termYearsIn = $('cq-loan-term-years');
  const termMonthsIn = $('cq-loan-term-months');
  const rateIn = $('cq-rate');
  
  // Extra Payments Toggle
  const toggleExtra = $('cq-toggle-extra');
  const extraContainer = $('cq-extra-container');

  // Extra Payment Inputs
  const startMonthIn = $('cq-start-month');
  const startYearIn = $('cq-start-year');
  
  const extMonthlyAmt = $('cq-extra-monthly');
  const extMonthlyStartM = $('cq-extra-monthly-month');
  const extMonthlyStartY = $('cq-extra-monthly-year');
  
  const extYearlyAmt = $('cq-extra-yearly');
  const extYearlyStartM = $('cq-extra-yearly-month');
  const extYearlyStartY = $('cq-extra-yearly-year');
  
  const extOneTimeAmt = $('cq-extra-onetime');
  const extOneTimeMonth = $('cq-extra-onetime-month');
  const extOneTimeYear = $('cq-extra-onetime-year');

  // Buttons & Errors
  const btn = $('cq-calc-btn');
  const btnReset = $('cq-reset-btn');
  const err = $('cq-input-error');

  // Outputs
  const txtMonthlyPayment = $('txt-monthly-payment');
  const txtTotalPayments = $('txt-total-payments');
  const txtTotalMonthsCount = $('txt-total-months-count'); // Count in text
  const txtTotalInterest = $('txt-total-interest');
  const kpiPayoff = $('kpi-payoff-date');
  const txtPayoffDate = $('txt-payoff-date');

  // Chart
  const donutPrincipal = $('donut-principal');
  const donutInterest = $('donut-interest');
  const donutLabel = $('donut-label');
  const tooltip = $('chart-tooltip');

  // Amortization
  const toggleLink = $('toggle-am-link');
  const amFull = $('amortization-full');
  const accRoot = $('acc-root');
  const exportBtn = $('export-csv-btn');
  const csvCtas = $('csv-ctas');
  const amTotalMonths = $('am-total-months');

  let globalRows = [];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Populate Month Selects
  function popMonths(sel) {
    sel.innerHTML = "";
    MONTH_NAMES.forEach((m,i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = m;
        sel.appendChild(opt);
    });
  }
  [startMonthIn, extMonthlyStartM, extYearlyStartM, extOneTimeMonth].forEach(popMonths);

  // Set Default Dates (Current Date)
  const now = new Date();
  const curM = now.getMonth();
  const curY = now.getFullYear();
  
  startMonthIn.value = curM;
  startYearIn.value = curY;
  
  [extMonthlyStartM, extYearlyStartM, extOneTimeMonth].forEach(s => s.value = curM);
  [extMonthlyStartY, extYearlyStartY, extOneTimeYear].forEach(i => i.value = curY);


  // Utils
  function getNum(el) { return parseFloat(el.value) || 0; }
  function isFilled(el) { return el.value.trim() !== ''; }
  function format(n){ return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }

  // Validation
  function checkRequired() {
    // Requirements:
    // Loan Amount > 0
    // Term: Years > 0 OR Months > 0 (At least 1 month total)
    // Rate >= 0
    const amt = getNum(loanAmtIn);
    const yrs = getNum(termYearsIn);
    const mos = getNum(termMonthsIn);
    const Rate = getNum(rateIn);
    
    // total months must be > 0
    const totalM = (yrs * 12) + mos;
    
    return isFilled(loanAmtIn) && amt > 0 &&
           (yrs > 0 || mos > 0) &&
           isFilled(rateIn) && Rate >= 0;
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
  [loanAmtIn, termYearsIn, termMonthsIn, rateIn].forEach(el => {
    el.addEventListener('input', () => { showErr(''); updateBtn(); });
  });

  // Toggle Extra
  toggleExtra.addEventListener('change', () => {
    extraContainer.style.display = toggleExtra.checked ? 'block' : 'none';
  });

  // ---------------------------------------------------------
  // CALCULATION LOGIC
  // ---------------------------------------------------------
  function getDateFromInputs(mEl, yEl) {
      // Inputs are 0-based month index, and full year
      const m = parseInt(mEl.value);
      const y = parseInt(yEl.value);
      return new Date(y, m, 1);
  }

  function buildSchedule(P, r_annual, monthsTotal) {
      const r = (r_annual / 100) / 12;
      
      // Calculate Scheduled Monthly Payment (PMT)
      // If rate 0 -> P / n
      let scheduledPMT = 0;
      if(r === 0 && monthsTotal > 0) {
          scheduledPMT = P / monthsTotal;
      } else if (monthsTotal > 0) {
          scheduledPMT = P * ( r * Math.pow(1+r, monthsTotal) ) / ( Math.pow(1+r, monthsTotal) - 1 );
      } else {
          return null; // Invalid
      }

      // Preparation for Extra Payments
      const useExtra = toggleExtra.checked;
      let extraMonthly = 0, startExtraMonthly = null;
      let extraYearly = 0, startExtraYearly = null;
      let extraOneTime = 0, dateOneTime = null;
      let startDate = new Date();

      if(useExtra) {
          startDate = getDateFromInputs(startMonthIn, startYearIn);
          
          extraMonthly = getNum(extMonthlyAmt);
          if(extraMonthly > 0) startExtraMonthly = getDateFromInputs(extMonthlyStartM, extMonthlyStartY);

          extraYearly = getNum(extYearlyAmt);
          if(extraYearly > 0) startExtraYearly = getDateFromInputs(extYearlyStartM, extYearlyStartY);

          // One time
          extraOneTime = getNum(extOneTimeAmt);
          if(extraOneTime > 0) dateOneTime = getDateFromInputs(extOneTimeMonth, extOneTimeYear);
      } else {
          // Default start date to now if not provided/checked? 
          // Actually let's just use the inputs or default to now if hidden.
          // Inputs are pre-filled with now.
          startDate = getDateFromInputs(startMonthIn, startYearIn);
      }

      let balance = P;
      let totalInterest = 0;
      let rows = [];
      
      // Safety Cap
      const MAX_MONTHS = 1200; // 100 years

      // Loop
      // We iterate month by month.
      // Current Date tracking.
      let currentD = new Date(startDate.getTime());
      
      // Need to handle "Month 1, Month 2..." mapping to Dates
      // The first payment is usually 1 month *after* start date? 
      // Mortgage terminology: "Loan Start Date" usually means origination. First payment is next month.
      // But typically calculators show "Jan 2026" as payment #1 if you select Jan 2026 as start.
      // Let's assume the user selects "Jan 2026" as the date of the *first payment* or similar?
      // The image says "Loan start date Jan 2026". 
      // Let's treat "Jan 2026" as month 1.
      
      for(let m=1; m<=MAX_MONTHS; m++) {
          // 1. Calculate Interest for this month
          const interest = balance * r;
          
          // 2. Calculate Principal component of scheduled payment
          // If scheduledPMT > balance + interest, cap it (payoff)
          let pmt = scheduledPMT;
          
          // 3. Check Extra Payments
          let extra = 0;
          if(useExtra) {
              // Monthly Extra
              if(startExtraMonthly && currentD >= startExtraMonthly) {
                  extra += extraMonthly;
              }
              // Yearly Extra (Same month each year)
              if(startExtraYearly && currentD >= startExtraYearly && currentD.getMonth() === startExtraYearly.getMonth()) {
                  extra += extraYearly;
              }
              // One Time
              if(dateOneTime && currentD.getMonth() === dateOneTime.getMonth() && currentD.getFullYear() === dateOneTime.getFullYear()) {
                  extra += extraOneTime;
              }
          }
          
          // Total payment for this month (Scheduled + Extra)
          let totalPay = pmt + extra;
          
          // Check if payoff
          if(totalPay >= balance + interest) {
              totalPay = balance + interest;
              pmt = totalPay - extra; // Adjust pmt breakdown? Or just say totalPay pays it off?
              // Actually logic: 
              // Interest is fixed based on balance.
              // Principal = TotalPay - Interest.
          }
          
          let principal = totalPay - interest;
          if(principal > balance) principal = balance; // Should match totalPay logic above
          
          // Update Balance
          let begin = balance;
          balance -= principal;
          if(balance < 0.005) balance = 0; // Floating point fix
          
          totalInterest += interest;
          
          rows.push({
              id: m,
              date: new Date(currentD.getTime()),
              monthStr: MONTH_NAMES[currentD.getMonth()] + " " + currentD.getFullYear(),
              yearVal: currentD.getFullYear(),
              begin: begin,
              interest: interest,
              principal: principal,
              end: balance
          });
          
          if(balance <= 0) break;
          
          // Advance Month
          // Fix: Date object auto-handles overflow (Jan 31 -> Feb 28/29? Be careful)
          // Best way: setMonth(currentMonth + 1)
          // Create new date to avoid reference issues
          // Reset day to 1 to avoid "31st" issues shifting months weirdly
          currentD.setDate(1); 
          currentD.setMonth(currentD.getMonth() + 1);
      }
      
      return {
          rows,
          scheduledPMT,
          totalInterest,
          actualMonths: rows.length
      };
  }

  // ---------------------------------------------------------
  // RENDER UI
  // ---------------------------------------------------------
  function renderYears(rows) {
      accRoot.innerHTML = "";
      
      // Group by Year
      const yearsMap = {};
      const yearOrder = [];
      
      rows.forEach(r => {
          const y = r.yearVal;
          if(!yearsMap[y]) {
              yearsMap[y] = { 
                  year: y, 
                  begin: r.begin, // First month of year begin balance
                  interest: 0, 
                  principal: 0, 
                  end: 0,
                  months: []
              };
              yearOrder.push(y);
          }
          const yObj = yearsMap[y];
          yObj.interest += r.interest;
          yObj.principal += r.principal;
          yObj.end = r.end; // Will update to last month's end
          yObj.months.push(r);
      });
      
      yearOrder.forEach(y => {
          const data = yearsMap[y];
          
          const wrap=document.createElement("div");

          const row=document.createElement("div");
          row.className="acc-row";
          row.innerHTML=`
            <div class="year"><span class="icon">+</span> ${data.year}</div>
            <div class="num">$${format(data.begin)}</div>
            <div class="num">$${format(data.interest)}</div>
            <div class="num">$${format(data.principal)}</div>
            <div class="num">$${format(data.end)}</div>
          `;

          const panel=document.createElement("div");
          panel.className="acc-panel";
          
          // Render inner table immediately or lazy? Immediate is fine for < 30 years typically.
          // Let's lazy render for performance? 
          // Just render it now.
          const table = document.createElement("table");
          table.className = "month-table";
          table.innerHTML = `<thead><tr><th>Month</th><th>Beginning</th><th>Interest</th><th>Principal</th><th>Ending</th></tr></thead><tbody id="tbody-${y}"></tbody>`;
          
          const tbody = table.querySelector('tbody');
          data.months.forEach(m => {
             const tr = document.createElement('tr');
             tr.innerHTML = `
                <td class="left" data-label="Month">${m.monthStr}</td>
                <td data-label="Beginning">$${format(m.begin)}</td>
                <td data-label="Interest">$${format(m.interest)}</td>
                <td data-label="Principal">$${format(m.principal)}</td>
                <td data-label="Ending">$${format(m.end)}</td>
             `;
             tbody.appendChild(tr);
          });
          panel.appendChild(table);

          // Toggle
          row.onclick=()=>{
            const open = panel.style.display==="block";
            // Close others? No, allow multiple open for comparison is nice.
            // But Mortgage calc behavior closed others. Let's close others to match.
            document.querySelectorAll(".acc-panel").forEach(p=>p.style.display="none");
            document.querySelectorAll(".acc-row .icon").forEach(i=>i.textContent="+");

            if(!open){
              panel.style.display="block";
              row.querySelector(".icon").textContent="−";
            }
          };

          wrap.appendChild(row);
          wrap.appendChild(panel);
          accRoot.appendChild(wrap);
      });
  }

  function toCsv(rows){
    let out=["Month,Beginning,Interest,Principal,Ending"];
    rows.forEach(r=>{
      // Use date string for month col
      out.push([r.monthStr, r.begin.toFixed(2), r.interest.toFixed(2), r.principal.toFixed(2), r.end.toFixed(2)].join(","));
    });
    return out.join("\n");
  }


  btn.onclick = () => {
      // 1. Gather & Validate
      const P = getNum(loanAmtIn);
      const Y = getNum(termYearsIn);
      const M = getNum(termMonthsIn);
      const R_annual = getNum(rateIn);
      
      const totalMonthsInput = (Y*12) + M;
      if(totalMonthsInput <=0) return showErr("Loan term must be > 0");
      if(P <= 0) return showErr("Loan amount must be > 0");
      
      // 2. Calc
      const sched = buildSchedule(P, R_annual, totalMonthsInput);
      if(!sched) return showErr("Calculation failed");
      
      const LoanAmount = P;
      const TotalInterest = sched.totalInterest;
      const TotalPayments = LoanAmount + TotalInterest;
      const MonthlyPMT = sched.scheduledPMT;
      
      globalRows = sched.rows;

      // 3. Output
      txtMonthlyPayment.textContent = "$"+format(MonthlyPMT);
      txtTotalPayments.textContent = "$"+format(TotalPayments);
      txtTotalInterest.textContent = "$"+format(TotalInterest);
      txtTotalMonthsCount.textContent = sched.actualMonths;
      
      if(sched.actualMonths < totalMonthsInput) {
          // Early payoff
          kpiPayoff.style.display = "flex";
          // Get last row date
          const lastDate = globalRows[globalRows.length-1].date;
          txtPayoffDate.textContent = MONTH_NAMES[lastDate.getMonth()] + " " + lastDate.getFullYear();
      } else {
          kpiPayoff.style.display = "none";
      }

      // 4. Chart
      let ip = 0; 
      let pp = 100;
      if(TotalPayments > 0) {
        ip = Math.round((TotalInterest / TotalPayments) * 100) || 0;
        pp = 100 - ip;
      }

      donutInterest.setAttribute("stroke-dasharray",`${ip} ${100-ip}`);
      donutPrincipal.setAttribute("stroke-dasharray",`${pp} ${100-pp}`);
      donutPrincipal.setAttribute("transform",`rotate(${ -90 + ip*3.6 } 21 21)`);
      donutLabel.textContent = ip? ip+"%" : "0%";

      // Tooltip Data
      donutInterest.dataset.label = "Interest";
      donutInterest.dataset.amount = "$"+format(TotalInterest);
      donutInterest.dataset.percent = ip + "%";
      donutInterest.dataset.color = "#FFAE1A"; 

      donutPrincipal.dataset.label = "Principal";
      donutPrincipal.dataset.amount = "$"+format(LoanAmount);
      donutPrincipal.dataset.percent = pp + "%";
      donutPrincipal.dataset.color = "#1E1E2F"; 

      // 5. Render Schedule
      renderYears(globalRows);

      amFull.style.display="block";
      toggleLink.style.display="inline-block";
      toggleLink.textContent="Hide Amortization Table";
      csvCtas.style.display="flex";
      amTotalMonths.textContent = "Total payment months: " + sched.actualMonths;
      
      amFull.scrollIntoView({behavior:'smooth', block: 'start'});
      btnReset.style.display='block';
  };
  
  // CSV Export
  exportBtn.onclick=()=>{
      const csv=toCsv(globalRows);
      const blob=new Blob([csv],{type:'text/csv'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download='amortization_schedule.csv';
      a.click();
      URL.revokeObjectURL(url);
  };

  btnReset.onclick = () => {
      // Clear Inputs
      loanAmtIn.value = '';
      termYearsIn.value = '';
      termMonthsIn.value = '';
      rateIn.value = '';
      
      // Clear Extras?
      extMonthlyAmt.value='';
      extYearlyAmt.value='';
      extOneTimeAmt.value='';
      
      // Clear Outputs
      const zero = "$0.00";
      txtMonthlyPayment.textContent = zero;
      txtTotalPayments.textContent = zero;
      txtTotalInterest.textContent = zero;
      txtTotalMonthsCount.textContent = "0";
      kpiPayoff.style.display="none";

      donutInterest.setAttribute("stroke-dasharray","0 100");
      donutPrincipal.setAttribute("stroke-dasharray","0 100");
      donutLabel.textContent = "";

      amFull.style.display="none";
      toggleLink.style.display="none";
      csvCtas.style.display="none";
      accRoot.innerHTML='';
      
      showErr('');
      btnReset.style.display='none';
      btn.disabled=true; 
      btn.classList.remove('active');
  };

  toggleLink.onclick=()=>{
    const show = amFull.style.display==="none";
    amFull.style.display = show?"block":"none";
    toggleLink.textContent = show?"Hide Amortization Table":"View Amortization Table";
  };

  // Tooltip Logic (Shared)
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
    tooltip.style.transform = 'none';
  }
  function hideTooltip() {
    tooltip.style.opacity = '0';
    setTimeout(() => { if(tooltip.style.opacity==='0') tooltip.style.display='none'; }, 200);
  }
  [donutPrincipal, donutInterest].forEach(s => {
    s.addEventListener('mouseenter', showTooltip);
    s.addEventListener('mousemove', moveTooltip);
    s.addEventListener('mouseleave', hideTooltip);
  });

  updateBtn();
  accRoot.innerHTML='<div class="small" style="padding:8px;color:#888">Amortization table will appear after calculation.</div>';

})();
