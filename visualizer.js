// ---- Utilities ----
const storageKey = "flowDataV6";

function todayKey() {
  // YYYY-MM-DD in browser local timezone
  return new Date().toLocaleDateString("en-CA");
}
function isoNow() { return new Date().toISOString(); }
function fmtDate(iso) {
  const d=new Date(iso);
  return d.toLocaleDateString()+" — "+d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

// Stable category color (hash -> palette) so it is consistent across days
const palette = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab'];
function categoryColor(cat){
  let h=0; for(let i=0;i<cat.length;i++) h=(h*31+cat.charCodeAt(i))>>>0;
  return palette[h%palette.length];
}

// ---- State ----
let store = JSON.parse(localStorage.getItem(storageKey)) || {
  lastOpenDate: null,
  today: { date: todayKey(), budget: null, setTime: null, expenses: [] },
  history: [] // array of {date, budget, setTime, expenses: []}
};

// ---- Daily rollover ----
function ensureToday() {
  const tKey = todayKey();
  if (store.today?.date !== tKey) {
    // archive previous day if it had any budget or expenses
    if (store.today && (store.today.budget !== null || store.today.expenses.length)) {
      store.history.unshift(structuredClone(store.today));
      // keep last 365 days max (avoid unbounded growth)
      if (store.history.length > 365) store.history.length = 365;
    }
    // start fresh day
    store.today = { date: tKey, budget: null, setTime: null, expenses: [] };
    save();
  }
  store.lastOpenDate = tKey;
  save();
}

// ---- Persistence ----
function save(){ localStorage.setItem(storageKey, JSON.stringify(store)); }

// ---- DOM refs ----
const budgetPrompt = document.getElementById("budgetPrompt");
const expenseForm  = document.getElementById("expenseForm");
const entriesEl    = document.getElementById("entries");
const progressBar  = document.getElementById("progressBar");
const progressLabel= document.getElementById("progressLabel");
const progressNums = document.getElementById("progressNumbers");
const todayDateEl  = document.getElementById("todayDate");

// ---- Summary + progress ----
function updateSummary() {
  const spent = store.today.expenses.reduce((s,e)=>s+e.amount,0);
  const b = store.today.budget ?? 0;
  document.getElementById("spent").textContent    = spent + " USD";
  document.getElementById("budget").textContent   = store.today.budget!==null ? (b + " USD") : "—";
  document.getElementById("remaining").textContent= store.today.budget!==null ? ((b - spent) + " USD") : "—";
  document.getElementById("setTime").textContent  = store.today.setTime ? fmtDate(store.today.setTime) : "—";
  todayDateEl.textContent = store.today.date;

  // progress
  const pct = b>0 ? (spent / b) * 100 : 0;
  progressBar.style.width = clamp(pct,0,100) + "%";
  progressLabel.textContent = (b>0 ? Math.round(pct) : 0) + "% of budget used";
  progressNums.textContent = spent + " / " + (b||0) + " USD";

  // bar color by threshold
  let color = "#59a14f";            // green < 70%
  if (pct >= 70 && pct < 100) color = "#f28e2b"; // orange
  if (pct >= 100)            color = "#e15759";  // red
  progressBar.style.background = color;
}

// ---- Entries (overspend recomputed live) ----
function renderEntries(list = store.today.expenses) {
  entriesEl.innerHTML = "";
  if (!list.length) {
    entriesEl.innerHTML = '<p style="text-align:center;color:#777;">No expenses yet.</p>';
    return;
  }

  const sorted = [...list].sort((a,b)=>new Date(a.time)-new Date(b.time));
  let running = 0;
  const b = store.today.budget ?? null;

  sorted.forEach((e, idx) => {
    running += e.amount;
    const overNow = (b !== null) && (running > b);

    const div = document.createElement("div");
    div.className = "entry" + (overNow ? " over" : "");
    div.style.setProperty("--color", categoryColor(e.category));

    div.innerHTML = `
      <div class="entry-info">
        <strong>${e.category}</strong>
        <span>${e.amount} SAR</span>
      </div>
      <small>${fmtDate(e.time)}</small>
      <button class="delete-btn" title="Delete Expense">🗑️</button>
    `;

    div.querySelector(".delete-btn").addEventListener("click", () => deleteExpense(idx));
    entriesEl.appendChild(div);
  });
}

function deleteExpense(index) {
  if (!confirm("Are you sure you want to delete this expense?")) return;
  store.today.expenses.splice(index, 1);
  save();
  renderEntries();
  updateSummary();
}


// ---- History UI ----
const historyPanel = document.getElementById("historyPanel");
const historyList  = document.getElementById("historyList");
const historyDetail= document.getElementById("historyDetail");
document.getElementById("viewHistoryBtn").onclick = () => {
  buildHistoryList();
  historyPanel.classList.remove("hidden");
};
document.getElementById("closeHistory").onclick = () => {
  historyPanel.classList.add("hidden");
  historyDetail.classList.add("hidden");
  historyDetail.innerHTML = "";
};

function buildHistoryList() {
  if (!store.history.length) {
    historyList.innerHTML = '<p style="text-align:center;color:#666;">No past days yet.</p>';
    return;
  }
  historyList.innerHTML = "";
  store.history.forEach((d, idx) => {
    const spent = d.expenses.reduce((s,e)=>s+e.amount,0);
    const day = document.createElement("div");
    day.className = "day";
    day.innerHTML = `
      <span><strong>${d.date}</strong> — Budget: ${d.budget ?? "—"} USD</span>
      <span>Spent: ${spent} USD</span>
    `;
    day.onclick = () => showHistoryDetail(idx);
    historyList.appendChild(day);
  });
}

function showHistoryDetail(index) {
  const d = store.history[index];
  historyDetail.classList.remove("hidden");
  const spent = d.expenses.reduce((s,e)=>s+e.amount,0);

  let html = `
    <h3>Details — ${d.date}</h3>
    <p><strong>Budget:</strong> ${d.budget ?? "—"} USD</p>
    <p><strong>Spent:</strong> ${spent} USD</p>
    <div style="margin-top:10px;border-top:1px solid #eee;padding-top:8px"></div>
  `;

  if (!d.expenses.length) {
    html += `<p style="color:#666;">No expenses recorded.</p>`;
  } else {
    // show with live overspend relative to that day's budget
    const sorted = [...d.expenses].sort((a,b)=>new Date(a.time)-new Date(b.time));
    let running = 0;
    for (const e of sorted) {
      running += e.amount;
      const over = (d.budget !== null) && (running > d.budget);
      html += `
        <div class="entry ${over ? "over":""}" style="--color:${categoryColor(e.category)}">
          <div class="entry-info">
            <strong>${e.category}</strong>
            <span>${e.amount} USD</span>
          </div>
          <small>${fmtDate(e.time)}</small>
        </div>
      `;
    }
  }
  historyDetail.innerHTML = html;
}

// ---- Init + actions ----
function init() {
  ensureToday();

  // Gate the forms
  if (store.today.budget !== null) {
    budgetPrompt.classList.add("hidden");
    expenseForm.classList.remove("hidden");
  } else {
    budgetPrompt.classList.remove("hidden");
    expenseForm.classList.add("hidden");
  }

  updateSummary();
  renderEntries();
}

document.getElementById("setBudgetBtn").onclick = () => {
  const val = parseFloat(document.getElementById("budgetInput").value);
  if (isNaN(val) || val <= 0) return alert("Enter a valid budget.");
  store.today.budget = val;
  store.today.setTime = isoNow();
  save();
  budgetPrompt.classList.add("hidden");
  expenseForm.classList.remove("hidden");
  updateSummary();
};

document.getElementById("updateBudgetBtn").onclick = () => {
  const val = prompt("Enter new budget (USD):", store.today.budget ?? "");
  if (val === null) return;
  const num = parseFloat(val);
  if (isNaN(num) || num <= 0) return alert("Invalid budget.");
  store.today.budget = num;
  store.today.setTime = isoNow();
  save();
  // Recompute overspend on render (fixes your bug)
  updateSummary();
  renderEntries();
};

document.getElementById("addBtn").onclick = () => {
  const cat = document.getElementById("category").value.trim();
  const amt = parseFloat(document.getElementById("amount").value);
  if (!cat || isNaN(amt) || amt <= 0) return alert("Enter valid category and amount.");

  const spent = store.today.expenses.reduce((s,e)=>s+e.amount,0);
  const b = store.today.budget ?? null;

  if (b !== null && spent + amt > b) {
    const cont = confirm("This purchase exceeds your budget. Continue?");
    if (!cont) return;
  }

  store.today.expenses.push({ category: cat, amount: amt, time: isoNow() });
  save();
  document.getElementById("category").value = "";
  document.getElementById("amount").value = "";

  updateSummary();
  renderEntries();
};

document.getElementById("resetBtn").onclick = () => {
  if (!confirm("Clear all data (today + history)?")) return;
  store = {
    lastOpenDate: todayKey(),
    today: { date: todayKey(), budget: null, setTime: null, expenses: [] },
    history: []
  };
  save();
  location.reload();
};

// Run
init();

// Optional: when tab regains focus, roll over day if date changed
window.addEventListener("focus", () => { ensureToday(); updateSummary(); renderEntries(); });
