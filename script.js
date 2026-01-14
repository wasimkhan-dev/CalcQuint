(function(){
  const $ = id => document.getElementById(id);

  const required = ['cq-amount','cq-rate','cq-term'];
  const inputs = required.concat(['cq-extra-monthly','cq-extra-once']).map(id => $(id));

  const btn = $('cq-calc-btn');
  const btnReset = $('cq-reset-btn');
  const err = $('cq-input-error');

  const txtMonthly = $('txt-monthly');
  const txtInterest = $('txt-interest');
  const txtMonths = $('txt-months');

  const donutPrincipal = $('donut-principal');
  const donutInterest = $('donut-interest');
  const donutLabel = $('donut-label');

  const toggleLink = $('toggle-am-link');
  const amFull = $('amortization-full');
  const accRoot = $('acc-root');

  const exportBtn = $('export-csv-btn');
  const csvCtas = $('csv-ctas');
  const amNote = $('am-note');
  const amTotalMonths = $('am-total-months');

  const advToggle = $('cq-adv-toggle');
  const rateInput = $('cq-rate');
  const rateTooltip = $('cq-rate-tooltip'); // Renamed from rateNote

  let globalRows = [];
  const ABS_MAX = 100000;

  function isFilled(id){ return $(id).value.trim() !== ''; }
  function allFilled(){ return required.every(isFilled); }

  function updateBtn(){
    if(allFilled()){ btn.disabled=false; btn.classList.add('active'); }
    else { btn.disabled=true; btn.classList.remove('active'); }
  }

  function showErr(msg){
    err.style.display = msg ? "block" : "none";
    err.textContent = msg || "";
  }

  inputs.forEach(i=>{
    i.addEventListener('input',()=>{showErr('');updateBtn();});
  });

  advToggle.addEventListener('change',()=>{
    if(advToggle.checked){
      rateInput.removeAttribute('min');
      rateInput.removeAttribute('max');
      // Update Tooltip Text
      rateTooltip.setAttribute('data-tip', "Advanced mode enabled.");
      rateTooltip.style.color = "#b85b00"; // Optional visual cue
    } else {
      rateInput.setAttribute('min','0.01');
      rateInput.setAttribute('max','25');
      // Restore Tooltip Text
      rateTooltip.setAttribute('data-tip', "Min 0.01% – Max 25");
      rateTooltip.style.color = "";
    }
  });

  function format(n){
    return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  function buildSchedule(P,R,N,extraM,extraOnce){
    const r = R/100/12;
    const base = r===0? P/N : P*r/(1-Math.pow(1+r,-N));

    const pay = base + (extraM||0);
    let bal = P - (extraOnce||0);

    let rows=[], totalInterest=0, month=0;

    while(bal > 0.004 && month < ABS_MAX){
      month++;
      const interest = bal*r;
      let principal = pay - interest;

      if(principal <= 0) principal = 0;
      if(principal > bal) principal = bal;

      const begin = bal;
      bal = bal - principal;

      rows.push({month, begin, interest, principal, end: bal});
      totalInterest += interest;

      if(bal <= 0) break;
    }
    return {rows,totalInterest,months:month,basePayment:base,monthlyPayment:pay};
  }

  function yearsSummary(rows){
    const map = {};
    rows.forEach(r=>{
      const y = Math.floor((r.month-1)/12)+1;
      if(!map[y]) map[y]={year:y,principal:0,interest:0,balance:r.end, begin: r.begin};
      map[y].principal += r.principal;
      map[y].interest += r.interest;
      map[y].balance = r.end;
      // Note: r.begin is the monthly beginning balance.
      // For the first month of the year (when map[y] is created), r.begin is correct year begin balance.
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
        <div class="num">$${format(y.begin)}</div>
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

  btn.onclick=()=>{

    const P=+$('cq-amount').value,
          R=+$('cq-rate').value,
          N=+$('cq-term').value;

    const EM=+$('cq-extra-monthly').value||0;
    const EO=+$('cq-extra-once').value||0;

    if(!advToggle.checked && (R<0.01 || R>25))
      return showErr("Rate must be between 0.01–25");

    if(P<1000 || P>5000000) return showErr("Loan amount must be 1,000–5,000,000");
    if(N<6 || N>480) return showErr("Term must be 6–480 months");

    const full = buildSchedule(P,R,N,EM,EO);
    globalRows = full.rows;

    txtMonthly.textContent = "$"+format(full.monthlyPayment);
    txtInterest.textContent = "$"+format(full.totalInterest);
    txtMonths.textContent = full.months;

    const total = P + full.totalInterest;
    const ip = Math.round((full.totalInterest/total)*100)||0;
    const pp = 100-ip;

    donutInterest.setAttribute("stroke-dasharray",`${ip} ${100-ip}`);
    donutPrincipal.setAttribute("stroke-dasharray",`${pp} ${100-pp}`);
    donutPrincipal.setAttribute("transform",`rotate(${ -90 + ip*3.6 } 21 21)`);
    donutLabel.textContent = ip? ip+"%" : "";

    // Tooltip Data
    donutInterest.dataset.label = "Interest";
    donutInterest.dataset.amount = "$"+format(full.totalInterest);
    donutInterest.dataset.percent = ip + "%";
    donutInterest.dataset.color = "#FFAE1A"; // Brand Accent

    donutPrincipal.dataset.label = "Principal";
    donutPrincipal.dataset.amount = "$"+format(P);
    donutPrincipal.dataset.percent = pp + "%";
    donutPrincipal.dataset.color = "#1E1E2F"; // Brand Primary


    const years = yearsSummary(globalRows);
    renderYears(years);

    amFull.style.display="block";
    toggleLink.style.display="inline-block";
    toggleLink.textContent="Hide Amortization Table";

    csvCtas.style.display="flex";
    amTotalMonths.textContent="Total months: "+globalRows.length;

    exportBtn.onclick=()=>{
      const csv=toCsv(globalRows);
      const blob=new Blob([csv],{type:'text/csv'});
      const url=URL.createObjectURL(blob);

      const a=document.createElement('a');
      a.href=url;
      a.download='amortization.csv';
      a.click();
      URL.revokeObjectURL(url);
    };

    // Auto-scroll to Amortization Table
    if(amFull) {
      amFull.scrollIntoView({behavior:'smooth', block:'start'});
    }
    
    // Show Reset
    btnReset.style.display = 'block';
  };

  btnReset.onclick = () => {
    // Clear Inputs
    inputs.forEach(i => i.value = '');
    
    // Reset Checkbox
    advToggle.checked = false;
    advToggle.dispatchEvent(new Event('change')); 

    // Clear Outputs
    const zero = "$0.00";
    txtMonthly.textContent = zero;
    txtInterest.textContent = zero;
    txtMonths.textContent = "0";

    // Reset Chart
    donutInterest.setAttribute("stroke-dasharray","0 100");
    donutPrincipal.setAttribute("stroke-dasharray","0 100");
    donutLabel.textContent = "";

    // Hide Amortization
    amFull.style.display="none";
    toggleLink.style.display="none";
    csvCtas.style.display="none";
    accRoot.innerHTML='';
    
    showErr('');
    
    // Hide Reset
    btnReset.style.display = 'none';
    updateBtn();
  };

  toggleLink.onclick=()=>{
    const show = amFull.style.display==="none";
    amFull.style.display = show?"block":"none";
    toggleLink.textContent = show?"Hide Amortization Table":"View Amortization Table";
  };

  updateBtn();
  accRoot.innerHTML='<div class="small" style="padding:8px;color:#888">Amortization table will appear after calculation.</div>';

  /* ----------------------
     Tooltip Logic
     ---------------------- */
  const tooltip = $('chart-tooltip');
  const segments = [donutPrincipal, donutInterest];

  function showTooltip(e) {
    const t = e.target;
    if(!t.dataset.label) return; // Not calculated yet
    
    // Add logic for specific interest color
    if(t.dataset.label === "Interest") {
        tooltip.classList.add('interest');
    } else {
        tooltip.classList.remove('interest');
    }

    tooltip.style.display = 'block';
    tooltip.style.opacity = '1';
    // Removed direct backgroundColor setting to let CSS class handle it
    // tooltip.style.backgroundColor = t.dataset.color; 

    tooltip.innerHTML = `
      <div style="font-weight:600;font-size:15px;margin-bottom:2px">${t.dataset.label}</div>
      <div style="font-size:13px">${t.dataset.amount} (${t.dataset.percent})</div>
    `;
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
    // Adjust if off screen (simple check)
    // For fixed position, using clientX/Y directly with fixed tooltip is easier
    tooltip.style.left = 0; 
    tooltip.style.top = 0;
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


})();
