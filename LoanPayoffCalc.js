(function(){
  const $ = id => document.getElementById(id);

  // --- State ---
  let DEBT_COUNT = 3;
  
  // --- Constants ---
  const MAX_MONTHS = 600; // 50 Years cap to prevent infinite loops

  // --- Initial Render of Debt Rows ---
  const debtListContainer = $('debt-list-container');
  
  function renderDebtRows() {
    debtListContainer.innerHTML = '';
    for(let i=0; i<DEBT_COUNT; i++) {
        const div = document.createElement('div');
        div.className = 'debt-row';
        div.dataset.index = i;
        div.innerHTML = `
            <input type="text" class="d-name" placeholder="Debt ${i+1} Name">
            <input type="number" class="d-bal" min="0" step="0.01" placeholder="Balance">
            <input type="number" class="d-pay" min="0" step="0.01" placeholder="Min Pay">
            <input type="number" class="d-rate" min="0" step="0.01" placeholder="Rate %">
        `;
        debtListContainer.appendChild(div);
        
        // Add listeners for auto-calc or validation clearing
        const inputs = div.querySelectorAll('input');
        inputs.forEach(inp => {
             inp.addEventListener('input', () => {
                 $('cq-input-error').style.display = 'none';
                 updateBtnState(); // optional
             });
        });
    }
  }
  
  // Add Debt Button
  $('btn-add-debt').addEventListener('click', () => {
      DEBT_COUNT++;
      const div = document.createElement('div');
      div.className = 'debt-row';
      div.dataset.index = DEBT_COUNT-1;
      div.innerHTML = `
          <input type="text" class="d-name" placeholder="Debt ${DEBT_COUNT} Name">
          <input type="number" class="d-bal" min="0" step="0.01" placeholder="Balance">
          <input type="number" class="d-pay" min="0" step="0.01" placeholder="Min Pay">
          <input type="number" class="d-rate" min="0" step="0.01" placeholder="Rate %">
          <button class="remove-debt-btn" title="Remove">&times;</button>
      `;
      debtListContainer.appendChild(div);
      
      div.querySelector('.remove-debt-btn').addEventListener('click', () => {
          div.remove();
          // We don't decrement DEBT_COUNT to keep indices unique or simple, 
          // but actually we just parse standard DOM rows so it doesn't matter.
      });
  });

  // --- Helper Functions ---
  const getNum = (el) => parseFloat(el.value) || 0;
  const formatMoney = (n) => n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  // --- Core Calculation ---
  function getDebtsFromDOM() {
      const rows = document.querySelectorAll('.debt-row');
      const debts = [];
      rows.forEach(row => {
          const name = row.querySelector('.d-name').value.trim() || `Debt ${debts.length+1}`;
          const bal = getNum(row.querySelector('.d-bal'));
          const pay = getNum(row.querySelector('.d-pay'));
          const rate = getNum(row.querySelector('.d-rate'));
          
          if(bal > 0) {
              debts.push({
                  id: Math.random().toString(36).substr(2,9),
                  name,
                  balance: bal,
                  minPay: pay,
                  rate: rate,
                  startBalance: bal,
                  totalInterest: 0,
                  totalPaid: 0,
                  monthsToPayoff: 0
              });
          }
      });
      return debts;
  }

  function calculate() {
      const debts = getDebtsFromDOM();
      if(debts.length === 0) {
          showError("Please enter details for at least one debt.");
          return;
      }

      // Inputs
      const extraMonthly = getNum($('cq-extra-monthly'));
      const extraYearly = getNum($('cq-extra-yearly'));
      const extraOneTime = getNum($('cq-extra-onetime'));
      const extraOneTimeMonth = getNum($('cq-extra-onetime-month'));
      
      const strategyRedistribute = $('cq-strat-fix').checked; // Yes
      
      // Sort for Avalanche (Highest Rate First)
      debts.sort((a,b) => b.rate - a.rate);

      // Simulation State
      let m = 0;
      let allPaid = false;
      let history = []; 
      
      // Calculate Initial Total Minimum Payment for Strategy=Yes
      const initialTotalMinPay = debts.reduce((sum, d) => sum + d.minPay, 0);

      // Global Totals
      let globalInterest = 0;
      let globalPaid = 0;

      while(!allPaid && m < MAX_MONTHS) {
          m++;
          
          let monthTotalInterest = 0;
          let monthTotalPrincipal = 0;
          let monthTotalPayment = 0;
          
          // 1. Determine Monthly Budget
          // If Strategy Yes: Budget = Initial Min Total + Monthly Extra
          // If Strategy No:  Budget = Sum of Current Active Min Payments + Monthly Extra (This means we don't redistribute freed cash)
          
          let currentBudget = 0;
          if(strategyRedistribute) {
              currentBudget = initialTotalMinPay + extraMonthly;
          } else {
              // Sum only active debts min pay
              const activeMinTotal = debts.reduce((sum, d) => (d.balance > 0 ? sum + d.minPay : sum), 0);
              currentBudget = activeMinTotal + extraMonthly;
          }

          // Add Periodic Extras
          if(m % 12 === 0) currentBudget += extraYearly;
          if(m === parseInt(extraOneTimeMonth)) currentBudget += extraOneTime;

          // 2. Accrue Interest First (on all active debts)
          debts.forEach(d => {
              if(d.balance > 0) {
                  const monthlyRate = (d.rate / 100) / 12;
                  const interest = d.balance * monthlyRate;
                  d.balance += interest;
                  d.totalInterest += interest;
                  
                  globalInterest += interest;
                  monthTotalInterest += interest;
              }
          });

          // 3. Satisfy Minimum Payments
          // We must pay at least the MinPay for each active debt from our budget.
          // Note: If Budget < Sum(MinPayments), that's a problem (Income shortage). 
          // For this calc, we assume Budget is at least sum of mins (since Budget is derived from mins).
          
          debts.forEach(d => {
              if(d.balance > 0) {
                  // Determine required payment (Min or Balance)
                  let required = d.minPay;
                  if(required > d.balance) required = d.balance;
                  
                  // Deduct from Budget
                  // If Budget is exhausted, we theoretically can't pay, but calculator assumes we pay minimums.
                  // Implies: If Strategy=No, Budget excludes cleared mins, so we are fine.
                  // If Strategy=Yes, Budget is static high, so we are fine.
                  
                  // Pay it
                  d.balance -= required;
                  d.totalPaid += required;
                  
                  globalPaid += required;
                  monthTotalPrincipal += (required > 0 ? required : 0); // Interest was added to balance, so Principal = Pay - Interest?
                  // Wait. Balance tracks total. 
                  // If Balance was 100, Interest +1. New Bal 101.
                  // Pay 50. New Bal 51.
                  // Principal reduced = OldBal - NewBal? 100 - 51 = 49.
                  // Interest paid? Effectively 1.
                  // But we just pushed interest to balance.
                  // So Principal component of this payment = Payment - (Interest accrued this month)?
                  // Be careful: Interest is accrued on specific debt.
                  // For the chart/table, we want "Total Monthly Interest Paid".
                  // Since we added interest to balance, paying effectively pays interest first.
                   
                  currentBudget -= required; // Remaining money for snowball
                  
                  // Check payoff
                  if(d.balance <= 0.005) {
                      d.balance = 0;
                      if(d.monthsToPayoff === 0) d.monthsToPayoff = m;
                  }
              }
          });
          
          // 4. Apply Remaining Budget (Snowball/Avalanche)
          // `currentBudget` now holds (Extra + Freed Up Mins + Unused parts of Mins).
          // Apply to Highest Priority (Sorted by Rate DESC).
          
          if(currentBudget > 0.005) {
              for(let d of debts) {
                  if(d.balance > 0) {
                      let pay = currentBudget;
                      if(pay > d.balance) pay = d.balance;
                      
                      d.balance -= pay;
                      d.totalPaid += pay;
                      globalPaid += pay;
                      currentBudget -= pay;
                      
                      if(d.balance <= 0.005) {
                          d.balance = 0;
                          if(d.monthsToPayoff === 0) d.monthsToPayoff = m;
                      }
                      
                      if(currentBudget <= 0.005) break;
                  }
              }
          }
          
          // Snapshot
          let currentTotalBal = debts.reduce((sum, d) => sum + d.balance, 0);
          
          // Recalculate true Principal Paid this month for the history
          // Principal Paid = (StartBal + Interest) - EndBal? 
          // StartBal not tracked easily per debt here.
          // Easier: Principal Paid = TotalPaidThisMonth - InterestAccruedThisMonth
          // (Assuming Payment >= Interest. If negative amortization, Principal Paid is negative).
          
          let totalMonthlyPayment = monthTotalInterest + (globalPaid - (globalPaid - (monthTotalPrincipal + (currentBudget < 0 ? 0 : 0)))); 
          // Simplify:
          // GlobalPaid incremented in loops.
          // Let's track `thisMonthPaid` locally.
          const thisMonthPaid = debts.reduce((sum, d) => sum + d.totalPaid, 0) - (globalPaid - (globalPaid - 0)); // Tricky with global accumulation.
          
          // Let's just use delta of Global Paid?
          // No, GlobalPaid is cumulative forever.
          // Reset logic needed or local var.
          
          // Re-sum for history correct values
          // We know Interest Accrued = monthTotalInterest.
          // We know Balance decreased by X.
          // Principal Paid = Total Interest - (EndBal - StartBal)? No.
          // NewBal = OldBal + Interest - Pay
          // Pay = OldBal - NewBal + Interest
          
          // We need OldBal.
          // Look at history[m-1] or initial.
          let prevBal = (history.length > 0) ? history[history.length-1].balance : getDebtsFromDOM().reduce((s,d)=>s+d.balance, 0);
          
          let actualPrincipalPaid = prevBal - currentTotalBal;
          let actualTotalPay = actualPrincipalPaid + monthTotalInterest; 
          // Note: if extra payment logic was weird, actualTotalPay should match our logic.
          
          history.push({
              month: m,
              balance: currentTotalBal,
              interest: monthTotalInterest,
          principal: actualPrincipalPaid,
              totalPay: actualTotalPay
          });

          if(currentTotalBal <= 0) allPaid = true;
      }
      // --- Render Results ---
      renderResults(m, globalInterest, globalPaid, history, debts);
  }

  function renderResults(months, totalInterest, totalPaid, schedule, finalDebts) {
      // KPIs
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      let timeStr = "";
      if(years > 0) timeStr += `${years} Year${years>1?'s':''} `;
      if(remMonths > 0 || years===0) timeStr += `${remMonths} Month${remMonths!==1?'s':''}`;
      
      $('txt-time-free').textContent = timeStr;
      $('txt-total-interest').textContent = "$" + formatMoney(totalInterest);
      $('txt-total-paid').textContent = "$" + formatMoney(totalPaid);
      
      // Order Table: Debt | Payoff length | Total interest | Total payments
      const tbody = $('order-table-body');
      tbody.innerHTML = '';
      
      // We want to show the list in Input Order? Or Payoff Order?
      // "Suggested Payoff Order" was the old title. User deleted "Suggested" and just said "TABLE DATA ...".
      // Usually users want to know when EACH debt is free.
      // Let's sort by Payoff Month (asc) to be helpful, or keep Original ID order?
      // Users usually list debts as they know them. Let's list by Payoff Date (Ascending).
      
      finalDebts.sort((a,b) => a.monthsToPayoff - b.monthsToPayoff); 
      
      finalDebts.forEach((d) => {
          const tr = document.createElement('tr');
          
          const dYears = Math.floor(d.monthsToPayoff / 12);
          const dMonths = d.monthsToPayoff % 12;
          let dTime = "";
          if(dYears > 0) dTime += `${dYears}y `;
          dTime += `${dMonths}m`;
          
          tr.innerHTML = `
              <td>${d.name}</td>
              <td>${dTime}</td>
              <td>$${formatMoney(d.totalInterest)}</td>
              <td>$${formatMoney(d.totalPaid)}</td>
          `;
          tbody.appendChild(tr);
      });

      // Chart: Donut
      // Segments: Principal (TotalPaid - Interest) vs Interest
      const principalPaid = totalPaid - totalInterest;
      renderDonut(principalPaid, totalInterest, totalPaid);
      
      // Full Schedule
      renderFullSchedule(schedule);
      
      $('cq-reset-btn').style.display = 'block';
  }

  function renderDonut(principal, interest, total) {
      const donutInterest = $('donut-interest');
      const donutPrincipal = $('donut-principal');
      const donutLabel = $('donut-label');
      
      let pInterest = 0, pPrincipal = 0;
      
      if(total > 0) {
          pInterest = (interest / total) * 100;
          pPrincipal = (principal / total) * 100;
          
          donutLabel.textContent = pInterest.toFixed(0) + "%";
      } else {
          donutLabel.textContent = "0%";
          // Reset dashes
          donutInterest.setAttribute("stroke-dasharray", "0 100");
          donutPrincipal.setAttribute("stroke-dasharray", "0 100");
      }
      
      if(total > 0) {
        // Segments
        // Interest (Accent #FFAE1A)
        donutInterest.setAttribute("stroke-dasharray", `${pInterest} ${100-pInterest}`);
        donutInterest.setAttribute("transform", "rotate(-90 21 21)"); 
        
        // Principal (Muted/Dark #1E1E2F)
        donutPrincipal.setAttribute("stroke-dasharray", `${pPrincipal} ${100-pPrincipal}`);
        // Rotate by Interest amt to stack
        donutPrincipal.setAttribute("transform", `rotate(${-90 + (pInterest * 3.6)} 21 21)`); 
      }
      
      // Tooltip Data - Set even if 0 to avoid undefined
      donutInterest.dataset.amount = "$" + formatMoney(interest);
      donutInterest.dataset.label = "Interest Paid";
      donutInterest.dataset.percent = pInterest.toFixed(1) + "%";
      donutInterest.dataset.color = "#FFAE1A";

      donutPrincipal.dataset.label = "Principal Paid";
      donutPrincipal.dataset.amount = "$" + formatMoney(principal);
      donutPrincipal.dataset.percent = pPrincipal.toFixed(1) + "%";
      donutPrincipal.dataset.color = "#1E1E2F"; 
  }

  // --- Tooltip Logic (Matched to Auto Loan) ---
  const tooltip = $('chart-tooltip');
  if(tooltip) {
      const segments = [$('donut-interest'), $('donut-principal')];
      
      segments.forEach(el => {
        // Mouse Events
        el.addEventListener("mouseenter", (e) => {
           showTooltip(el);
        });
        el.addEventListener("mousemove", (e) => {
           moveTooltip(e);
        });
        el.addEventListener("mouseleave", () => {
           hideTooltip();
        });

        // Touch Events for Mobile
        el.addEventListener("touchstart", (e) => {
           e.preventDefault(); // Prevent scroll while touching chart
           showTooltip(el);
           moveTooltip(e.touches[0]); // Use first touch point
        }, {passive: false});
      });
      
      function showTooltip(el) {
           const type = el.id === "donut-principal" ? "Principal" : "Interest";
           
           if (el.id === "donut-interest") {
             tooltip.classList.add("interest");
             tooltip.style.backgroundColor = "#FFAE1A"; 
           } else {
             tooltip.classList.remove("interest");
             tooltip.style.backgroundColor = "#1E1E2F"; 
           }
    
           tooltip.textContent = `${type}: ${el.dataset.amount}`;
           tooltip.style.display = "block";
           tooltip.style.opacity = "1";
      }

      function moveTooltip(e) {
           tooltip.style.left = (e.clientX + 10) + 'px';
           tooltip.style.top = (e.clientY - 30) + 'px';
      }

      function hideTooltip() {
           tooltip.style.display = "none";
           tooltip.style.opacity = "0";
      }
  }

  function renderFullSchedule(schedule) {
      const body = $('schedule-body');
      body.innerHTML = '';
      $('am-total-duration').textContent = $('txt-time-free').textContent;
      
      schedule.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
              <td style="text-align:left">${row.month}</td>
              <td>$${formatMoney(row.balance)}</td>
              <td>$${formatMoney(row.interest)}</td>
              <td>$${formatMoney(row.principal)}</td>
              <td>$${formatMoney(row.totalPay)}</td>
          `;
          body.appendChild(tr);
      });
  }

  function showError(msg) {
      const err = $('cq-input-error');
      err.textContent = msg;
      err.style.display = 'block';
  }

  function updateBtnState() {
      // Basic check
      $('cq-calc-btn').disabled = false;
  }

  // --- Listeners ---
  $('cq-calc-btn').addEventListener('click', calculate);
  
  $('cq-reset-btn').addEventListener('click', () => {
      renderDebtRows(); // Reset inputs to empty defaults
      ['cq-extra-monthly', 'cq-extra-yearly', 'cq-extra-onetime', 'cq-extra-onetime-month'].forEach(id => $(id).value = '');
      $('cq-strat-fix').checked = true;
      
      $('txt-time-free').textContent = "--";
      $('txt-total-interest').textContent = "$0.00";
      $('txt-total-paid').textContent = "$0.00";
      
      $('order-table-body').innerHTML = '';
      
      // Reset Donut
      $('donut-interest').setAttribute("stroke-dasharray", "0 100");
      $('donut-principal').setAttribute("stroke-dasharray", "0 100");
      $('donut-label').textContent = "";

      $('schedule-body').innerHTML = '';
      
      $('cq-reset-btn').style.display = 'none';
  });
  
  $('toggle-am-link').addEventListener('click', () => {
      const am = $('amortization-full');
      const link = $('toggle-am-link');
      if(am.style.display === 'none') {
          am.style.display = 'block';
          link.textContent = 'Hide Payoff Schedule';
      } else {
          am.style.display = 'none';
          link.textContent = 'View Payoff Schedule';
      }
  });

  // Init
  renderDebtRows();
  // Initialize Donut empty
  renderDonut(0,0,0);

})();
