(function(){
  const $ = id => document.getElementById(id);

  // New IDs
  const homePriceIn = $('cq-home-price');
  const downAmtIn = $('cq-down-payment');
  const downPctIn = $('cq-down-payment-pct');
  const termIn = $('cq-term');
  const rateIn = $('cq-rate');
  
  const taxIn = $('cq-property-tax');
  const insIn = $('cq-home-insurance');
  const hoaIn = $('cq-hoa');

  const btn = $('cq-calc-btn');
  const btnReset = $('cq-reset-btn');
  const err = $('cq-input-error');
  
  // Optional Toggle
  const toggleOptional = $('cq-toggle-optional');
  const optionalContainer = $('cq-optional-container');

  // Outputs
  const txtMonthlyPI = $('txt-monthly-pi');
  const txtMonthTax = $('txt-monthly-tax');
  const txtMonthIns = $('txt-monthly-ins');
  const txtMonthHoa = $('txt-monthly-hoa');
  const txtTotalMonthly = $('txt-total-monthly');
  const txtTotalInterest = $('txt-total-interest');
  const txtTotalCost = $('txt-total-cost');

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
  const ABS_MAX = 100000;

  // Validation helpers
  function getNum(el) { return parseFloat(el.value) || 0; }
  function isFilled(el) { return el.value.trim() !== ''; }
  
  // Required fields
  function checkRequired() {
    return isFilled(homePriceIn) && isFilled(termIn) && isFilled(rateIn) && 
           (isFilled(downAmtIn) || isFilled(downPctIn));
  }

  function updateBtn(){
    if(checkRequired()){ btn.disabled=false; btn.classList.add('active'); }
    else { btn.disabled=true; btn.classList.remove('active'); }
  }

  function showErr(msg){
    err.style.display = msg ? "block" : "none";
    err.textContent = msg || "";
  }

  // Event Listeners for Validation
  [homePriceIn, downAmtIn, downPctIn, termIn, rateIn, taxIn, insIn, hoaIn].forEach(el => {
    if(el) {
      el.addEventListener('input', () => { showErr(''); updateBtn(); });
    }
  });

  // Down Payment Sync Logic
  downAmtIn.addEventListener('input', () => {
    const price = getNum(homePriceIn);
    const amt = getNum(downAmtIn);
    if(price > 0) {
      const pct = (amt / price) * 100;
      downPctIn.value = pct.toFixed(2); // 2 decimals max for inputs? User asked for precision 2 decimals
    }
  });

  downPctIn.addEventListener('input', () => {
    const price = getNum(homePriceIn);
    const pct = getNum(downPctIn);
    if(price > 0) {
      const amt = (price * pct) / 100;
      downAmtIn.value = amt.toFixed(2);
    }
  });

  // If Home Price updates, update Down Payment Amount based on Percent (Preserve %)
  homePriceIn.addEventListener('input', () => {
    const price = getNum(homePriceIn);
    const pct = getNum(downPctIn);
    if(pct > 0) {
      const amt = (price * pct) / 100;
      downAmtIn.value = amt.toFixed(2);
    } else {
      // If percent is 0, maybe amt is set?
      const amt = getNum(downAmtIn);
      if(amt > 0 && price > 0) {
         // Update percent
         const newPct = (amt / price) * 100;
         downPctIn.value = newPct.toFixed(2);
      }
    }
  });


  function format(n){
    return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  // Core Calc
  function buildSchedule(loadAmount, annualRate, years) {
    const r = (annualRate / 100) / 12;
    const n = years * 12;
    
    // Monthly PI
    let monthlyPI = 0;
    if(r === 0) {
      monthlyPI = loadAmount / n;
    } else {
      // P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
      const numerator = r * Math.pow(1+r, n);
      const denominator = Math.pow(1+r, n) - 1;
      monthlyPI = loadAmount * (numerator / denominator);
    }

    // Generate Rows
    let rows = [];
    let bal = loadAmount;
    let totalInterest = 0;

    for(let m=1; m<=n; m++) {
      const interest = bal * r;
      let principal = monthlyPI - interest;
      
      // Edge case last payment adjustment
      if(bal - principal < 0.005) {
        principal = bal;
      }
      
      const begin = bal;
      bal = bal - principal;
      if(bal < 0) bal = 0;

      rows.push({
        month: m,
        begin: begin,
        interest: interest,
        principal: principal,
        end: bal
      });

      totalInterest += interest;
      if(bal <= 0) break;
    }

    return { 
      rows, 
      monthlyPI, 
      totalInterest, 
      numberOfPayments: n
    };
  }

  // Group by Year for UI
  function yearsSummary(rows){
    const map = {};
    rows.forEach(r=>{
      const y = Math.floor((r.month-1)/12)+1;
      if(!map[y]) map[y]={year:y,principal:0,interest:0,balance:r.end, beginStart:r.begin};
      map[y].principal += r.principal;
      map[y].interest += r.interest;
      map[y].balance = r.end;
      // beginStart is already set on first occurrence (Month 1 of year).
    });
    return Object.values(map);
  }

  function renderYears(years){
    accRoot.innerHTML = "";
    years.forEach(y=>{
      const wrap=document.createElement("div");

      const row=document.createElement("div");
      row.className="acc-row";
      row.innerHTML=`
        <div class="year"><span class="icon">+</span> Year ${y.year}</div>
        <div class="num">$${format(y.beginStart)}</div>
        <div class="num">$${format(y.interest)}</div>
        <div class="num">$${format(y.principal)}</div>
        <div class="num">$${format(y.balance)}</div>
      `;

      const panel=document.createElement("div");
      panel.className="acc-panel";

      row.onclick=()=>{
        const open = panel.style.display==="block";
        document.querySelectorAll(".acc-panel").forEach(p=>p.style.display="none");
        document.querySelectorAll(".acc-row .icon").forEach(i=>i.textContent="+");

        if(!open){
          panel.style.display="block";
          row.querySelector(".icon").textContent="−";
          if(!panel.dataset.rendered){
            renderMonths(y.year,panel);
            panel.dataset.rendered="1";
          }
        }
      };

      wrap.appendChild(row);
      wrap.appendChild(panel);
      accRoot.appendChild(wrap);
    });
  }

  function renderMonths(year,panel){
    const start=(year-1)*12;
    const end=Math.min(start+12,globalRows.length);

    const table=document.createElement("table");
    table.className="month-table";

    table.innerHTML="<thead><tr><th>Month</th><th>Beginning</th><th>Interest</th><th>Principal</th><th>Ending</th></tr></thead>";

    const tbody=document.createElement("tbody");
    for(let i=start;i<end;i++){
      const r = globalRows[i];
      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td class="left" data-label="Month">Month ${r.month}</td>
        <td data-label="Beginning">$${format(r.begin)}</td>
        <td data-label="Interest">$${format(r.interest)}</td>
        <td data-label="Principal">$${format(r.principal)}</td>
        <td data-label="Ending">$${format(r.end)}</td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
  }

  function toCsv(rows){
    let out=["Month,Beginning,Interest,Principal,Ending"];
    rows.forEach(r=>{
      out.push([r.month,r.begin.toFixed(2),r.interest.toFixed(2),r.principal.toFixed(2),r.end.toFixed(2)].join(","));
    });
    return out.join("\n");
  }


  btn.onclick = () => {
    // 1. Gather Inputs
    const P_home = getNum(homePriceIn);
    const D_amt = getNum(downAmtIn);
    
    // Validation
    if(P_home <= 0) return showErr("Home price must be > 0");
    if(D_amt < 0) return showErr("Down payment must be >= 0");
    if(D_amt > P_home) return showErr("Down payment cannot exceed home price");

    const years = parseInt(termIn.value);
    if(![15,20,30].includes(years)) return showErr("Invalid loan term");

    const R_annual = getNum(rateIn);
    if(R_annual < 0) return showErr("Interest rate must be >= 0");

    // Optional
    const Tax_annual = getNum(taxIn);
    const Ins_annual = getNum(insIn);
    const HOA_mo = getNum(hoaIn);

    // 2. Calculations
    const LoanAmount = P_home - D_amt;
    // Edge case checks?
    if(LoanAmount < 0) return showErr("Loan amount cannot be negative");

    const sched = buildSchedule(LoanAmount, R_annual, years);

    globalRows = sched.rows;

    const monthlyPI = sched.monthlyPI;
    const monthlyTax = Tax_annual / 12;
    const monthlyIns = Ins_annual / 12;
    const monthlyHOA = HOA_mo;
    const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyHOA;

    const totalInterest = sched.totalInterest;
    const totalCost = LoanAmount + totalInterest;


    // 3. Render Outputs
    txtMonthlyPI.textContent = "$"+format(monthlyPI);
    txtMonthTax.textContent = "$"+format(monthlyTax);
    txtMonthIns.textContent = "$"+format(monthlyIns);
    txtMonthHoa.textContent = "$"+format(monthlyHOA);
    
    txtTotalMonthly.textContent = "$"+format(totalMonthly);
    txtTotalInterest.textContent = "$"+format(totalInterest);
    txtTotalCost.textContent = "$"+format(totalCost);

    // 4. Update Donut (Interest vs Principal)
    // Note: totalCost = LoanAmount + totalInterest. 
    // Chart P vs I
    const totalPI = LoanAmount + totalInterest;
    let ip = 0; 
    let pp = 100;
    
    if(totalPI > 0) {
      ip = Math.round((totalInterest / totalPI) * 100) || 0;
      pp = 100 - ip;
    }

    donutInterest.setAttribute("stroke-dasharray",`${ip} ${100-ip}`);
    donutPrincipal.setAttribute("stroke-dasharray",`${pp} ${100-pp}`);
    donutPrincipal.setAttribute("transform",`rotate(${ -90 + ip*3.6 } 21 21)`);
    donutLabel.textContent = ip? ip+"%" : "0%";

    // Tooltip Data
    donutInterest.dataset.label = "Interest";
    donutInterest.dataset.amount = "$"+format(totalInterest);
    donutInterest.dataset.percent = ip + "%";
    donutInterest.dataset.color = "#FFAE1A"; 

    donutPrincipal.dataset.label = "Principal";
    donutPrincipal.dataset.amount = "$"+format(LoanAmount);
    donutPrincipal.dataset.percent = pp + "%";
    donutPrincipal.dataset.color = "#1E1E2F"; 

    // 5. Amortization Table
    const yearsSum = yearsSummary(globalRows);
    renderYears(yearsSum);

    amFull.style.display="block";
    toggleLink.style.display="inline-block";
    toggleLink.textContent="Hide Amortization Table";

    csvCtas.style.display="flex";
    amTotalMonths.textContent="Total payment months: "+globalRows.length;

    exportBtn.onclick=()=>{
      const csv=toCsv(globalRows);
      const blob=new Blob([csv],{type:'text/csv'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download='mortgage_amortization.csv';
      a.click();
      URL.revokeObjectURL(url);
    };

    // Auto-scroll to result
    amFull.scrollIntoView({behavior:'smooth', block: 'start'});

    // Show Reset Button
    btnReset.style.display = 'block'; 
  };

  btnReset.onclick = () => {
    // Clear Inputs
    [homePriceIn, downAmtIn, downPctIn, rateIn, taxIn, insIn, hoaIn].forEach(el => {
      if(el) el.value = '';
    });
    // Reset Select
    if(termIn) termIn.value = "30"; 

    // Clear Outputs
    const zero = "$0.00";
    txtMonthlyPI.textContent = zero;
    txtMonthTax.textContent = zero;
    txtMonthIns.textContent = zero;
    txtMonthHoa.textContent = zero;
    txtTotalMonthly.textContent = zero;
    txtTotalInterest.textContent = zero;
    txtTotalCost.textContent = zero;

    // Reset Chart
    donutInterest.setAttribute("stroke-dasharray","0 100");
    donutPrincipal.setAttribute("stroke-dasharray","0 100");
    donutLabel.textContent = "";
    
    // Hide Amortization
    amFull.style.display="none";
    toggleLink.style.display="none";
    csvCtas.style.display="none";
    accRoot.innerHTML='';
    
    // Clear Error
    showErr('');
    
    // Hide Reset
    btnReset.style.display = 'none';
    
    // Disable Calculate until inputs filled again
    btn.disabled=true; 
    btn.classList.remove('active');
  };

  toggleLink.onclick=()=>{
    const show = amFull.style.display==="none";
    amFull.style.display = show?"block":"none";
    toggleLink.textContent = show?"Hide Amortization Table":"View Amortization Table";
  };

  // Tooltip Logic
  const segments = [donutPrincipal, donutInterest];

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
    // Tooltip position
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    tooltip.style.left = x + 'px'; // Fix: need 'px' and set prop directly
    tooltip.style.top = y + 'px';
    tooltip.style.transform = 'none'; // Clear transform if setting left/top directly
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
  accRoot.innerHTML='<div class="small" style="padding:8px;color:#888">Amortization table will appear after calculation.</div>';
  
  // Optional Toggle Logic
  if(toggleOptional) {
    toggleOptional.addEventListener('change', () => {
      optionalContainer.style.display = toggleOptional.checked ? 'block' : 'none';
      // Ensure recalculation or updateBtn might be needed if validation depended on these? 
      // Currently optional fields aren't strictly required > 0, so updateBtn OK.
    });
  }
  
  // Initial check
  if(toggleOptional && toggleOptional.checked) {
      optionalContainer.style.display = 'block';
  }

})();
