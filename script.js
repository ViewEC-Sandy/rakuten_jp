/*
  請把下方 ChangeMe2026! 改成你自己的密碼。
  注意：這是前端密碼，只能阻擋一般訪客。
*/
const APP_PASSWORD = "ChangeMe2026!";

const loginScreen = document.getElementById("loginScreen");
const appContent = document.getElementById("appContent");
const loginForm = document.getElementById("loginForm");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");

function unlockApp() {
  loginScreen.classList.add("hidden");
  appContent.classList.remove("hidden");
}

if (sessionStorage.getItem("dashboardAuthenticated") === "yes") {
  unlockApp();
}

loginForm.addEventListener("submit", event => {
  event.preventDefault();

  if (loginPassword.value === APP_PASSWORD) {
    sessionStorage.setItem("dashboardAuthenticated", "yes");
    loginMessage.textContent = "";
    loginPassword.value = "";
    unlockApp();
  } else {
    loginMessage.textContent = "密碼錯誤，請重新輸入。";
    loginPassword.select();
  }
});

const state = {
  rawRows: [],
  headers: [],
  analyzedRows: [],
  revenueChart: null,
  productChart: null
};

const aliases = {
  date: ["注文日", "受注日", "購入日", "売上日", "日付", "date", "created at", "purchase-date"],
  orderId: ["注文番号", "受注番号", "オーダー番号", "order_id", "order-id", "order"],
  product: ["商品名", "商品名称", "品名", "lineitem name", "product-name", "product"],
  sku: ["商品管理番号", "商品番号", "SKU", "sku", "商品コード", "管理番号"],
  quantity: ["個数", "数量", "注文個数", "販売数量", "quantity", "lineitem quantity"],
  revenue: ["商品金額", "売上金額", "請求金額", "合計金額", "金額", "売上", "total", "item-price", "revenue"],
  platform: ["プラットフォーム", "モール", "販売チャネル", "platform", "channel"],
  store: ["店舗", "店舗名", "ショップ", "ショップ名", "store"],
  adCost: ["広告費", "広告コスト", "RPP広告費", "ad_cost", "advertising cost"]
};

const ids = {
  date: "mapDate",
  orderId: "mapOrderId",
  product: "mapProduct",
  sku: "mapSku",
  quantity: "mapQuantity",
  revenue: "mapRevenue",
  platform: "mapPlatform",
  store: "mapStore",
  adCost: "mapAdCost"
};

const csvFile = document.getElementById("csvFile");
const dropZone = document.getElementById("dropZone");
const fileName = document.getElementById("fileName");
const message = document.getElementById("message");
const mappingSection = document.getElementById("mappingSection");
const dashboard = document.getElementById("dashboard");
const tableSearch = document.getElementById("tableSearch");

csvFile.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) loadCsv(file);
});

["dragenter", "dragover"].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", event => {
  const file = event.dataTransfer.files?.[0];
  if (file) loadCsv(file);
});

document.getElementById("analyzeBtn").addEventListener("click", analyze);
document.getElementById("saveMappingBtn").addEventListener("click", saveMapping);
document.getElementById("resetMappingBtn").addEventListener("click", () => {
  localStorage.removeItem("rakutenJpDashboardMapping");
  autoMapFields();
  setMessage("已清除儲存設定。", "success");
});
tableSearch.addEventListener("input", renderTable);

function loadCsv(file) {
  fileName.textContent = `已選擇：${file.name}`;
  setMessage("正在讀取 CSV…");

  Papa.parse(file, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    encoding: "",
    complete(results) {
      try {
        if (!results.meta.fields?.length) {
          throw new Error("找不到欄位名稱，請確認 CSV 第一列是標題列。");
        }

        state.rawRows = results.data;
        state.headers = results.meta.fields.map(h => String(h).trim());

        buildMappingOptions();
        autoMapFields();
        mappingSection.classList.remove("hidden");
        dashboard.classList.add("hidden");

        const warning = results.errors?.length
          ? `（另有 ${results.errors.length} 筆格式警告）`
          : "";

        setMessage(`讀取完成，共 ${state.rawRows.length} 筆資料 ${warning}`, "success");
      } catch (error) {
        setMessage(error.message, "error");
      }
    },
    error(error) {
      setMessage(`讀取失敗：${error.message}`, "error");
    }
  });
}

function buildMappingOptions() {
  Object.values(ids).forEach(selectId => {
    const select = document.getElementById(selectId);
    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "不使用此欄位";
    select.appendChild(empty);

    state.headers.forEach(header => {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      select.appendChild(option);
    });
  });
}

function autoMapFields() {
  const saved = JSON.parse(localStorage.getItem("rakutenJpDashboardMapping") || "{}");

  Object.entries(ids).forEach(([key, selectId]) => {
    const select = document.getElementById(selectId);

    if (saved[key] && state.headers.includes(saved[key])) {
      select.value = saved[key];
      return;
    }

    const matched = findHeader(aliases[key] || []);
    select.value = matched || "";
  });
}

function findHeader(candidates) {
  const normalizedHeaders = state.headers.map(header => ({
    original: header,
    normalized: normalize(header)
  }));

  for (const candidate of candidates) {
    const exact = normalizedHeaders.find(item => item.normalized === normalize(candidate));
    if (exact) return exact.original;
  }

  for (const candidate of candidates) {
    const partial = normalizedHeaders.find(item =>
      item.normalized.includes(normalize(candidate)) ||
      normalize(candidate).includes(item.normalized)
    );
    if (partial) return partial.original;
  }

  return "";
}

function saveMapping() {
  const mapping = getMapping();
  localStorage.setItem("rakutenJpDashboardMapping", JSON.stringify(mapping));
  setMessage("欄位設定已儲存在這台瀏覽器。", "success");
}

function getMapping() {
  const mapping = {};
  Object.entries(ids).forEach(([key, selectId]) => {
    mapping[key] = document.getElementById(selectId).value;
  });
  return mapping;
}

function analyze() {
  const mapping = getMapping();
  const required = ["date", "orderId", "product", "quantity", "revenue"];
  const missing = required.filter(key => !mapping[key]);

  if (missing.length) {
    setMessage("請至少指定日期、訂單編號、商品名稱、數量與營收欄位。", "error");
    return;
  }

  state.analyzedRows = state.rawRows
    .map(row => ({
      date: normalizeDate(row[mapping.date]),
      orderId: cleanText(row[mapping.orderId]),
      product: cleanText(row[mapping.product]),
      sku: mapping.sku ? cleanText(row[mapping.sku]) : "",
      quantity: toNumber(row[mapping.quantity]),
      revenue: toNumber(row[mapping.revenue]),
      platform: mapping.platform ? cleanText(row[mapping.platform]) : "",
      store: mapping.store ? cleanText(row[mapping.store]) : "",
      adCost: mapping.adCost ? toNumber(row[mapping.adCost]) : 0
    }))
    .filter(row => row.date || row.orderId || row.product);

  if (!state.analyzedRows.length) {
    setMessage("沒有可分析的資料，請檢查欄位選擇。", "error");
    return;
  }

  updateKpis(mapping);
  renderRevenueChart();
  renderProductChart();
  renderTable();
  dashboard.classList.remove("hidden");
  dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
  setMessage(`分析完成，共 ${state.analyzedRows.length} 筆資料。`, "success");
}

function updateKpis(mapping) {
  const totalRevenue = sum(state.analyzedRows.map(row => row.revenue));
  const totalQuantity = sum(state.analyzedRows.map(row => row.quantity));
  const totalAdCost = sum(state.analyzedRows.map(row => row.adCost));
  const orders = new Set(state.analyzedRows.map(row => row.orderId).filter(Boolean));
  const products = new Set(state.analyzedRows.map(row => row.sku || row.product).filter(Boolean));
  const orderCount = orders.size;
  const aov = orderCount ? totalRevenue / orderCount : 0;

  setText("totalRevenue", yen(totalRevenue));
  setText("totalOrders", number(orderCount));
  setText("aov", yen(aov));
  setText("totalQuantity", number(totalQuantity));
  setText("productCount", number(products.size));

  if (mapping.adCost) {
    setText("totalAdCost", yen(totalAdCost));
    setText("roas", totalAdCost > 0 ? `${(totalRevenue / totalAdCost * 100).toFixed(1)}%` : "—");
    setText("tacos", totalRevenue > 0 ? `${(totalAdCost / totalRevenue * 100).toFixed(1)}%` : "—");
  } else {
    setText("totalAdCost", "—");
    setText("roas", "—");
    setText("tacos", "—");
  }
}

function renderRevenueChart() {
  const grouped = {};

  state.analyzedRows.forEach(row => {
    const key = row.date || "日期不明";
    grouped[key] = (grouped[key] || 0) + row.revenue;
  });

  const labels = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  const values = labels.map(label => grouped[label]);

  state.revenueChart?.destroy();

  state.revenueChart = new Chart(document.getElementById("revenueChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "營收",
        data: values,
        borderWidth: 3,
        tension: .28,
        fill: true,
        backgroundColor: "rgba(47,111,237,.10)",
        borderColor: "#2f6fed",
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: { label: context => `營收：${yen(context.raw)}` }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: value => yen(value) }
        }
      }
    }
  });
}

function renderProductChart() {
  const grouped = {};

  state.analyzedRows.forEach(row => {
    const key = row.product || "商品名不明";
    grouped[key] = (grouped[key] || 0) + row.revenue;
  });

  const top = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  state.productChart?.destroy();

  state.productChart = new Chart(document.getElementById("productChart"), {
    type: "bar",
    data: {
      labels: top.map(item => item[0]),
      datasets: [{
        data: top.map(item => item[1]),
        backgroundColor: "#2f6fed",
        borderRadius: 7
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: context => `營收：${yen(context.raw)}` }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { callback: value => yen(value) }
        }
      }
    }
  });
}

function renderTable() {
  const keyword = tableSearch.value.trim().toLowerCase();
  const rows = state.analyzedRows
    .filter(row => {
      if (!keyword) return true;
      return [
        row.date, row.orderId, row.product, row.sku, row.platform, row.store
      ].some(value => String(value).toLowerCase().includes(keyword));
    })
    .slice(0, 300);

  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.orderId)}</td>
      <td>${escapeHtml(row.product)}</td>
      <td>${escapeHtml(row.sku)}</td>
      <td>${number(row.quantity)}</td>
      <td>${yen(row.revenue)}</td>
      <td>${escapeHtml(row.platform)}</td>
      <td>${escapeHtml(row.store)}</td>
    </tr>
  `).join("");
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-／/（）()]/g, "");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "")
    .replace(/[¥￥円,\s]/g, "")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value) {
  const text = cleanText(value);
  if (!text) return "";

  const compact = text.replace(/\./g, "/").replace(/-/g, "/");
  const match = compact.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);

  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return text;
}

function yen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function number(value) {
  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = type;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
