const state={rawRows:[],headers:[],rows:[],files:[],charts:{},currentFileName:""};
const aliases={
date:["注文日","受注日","購入日","売上日","日付","date","created at","purchase-date"],
orderId:["注文番号","受注番号","オーダー番号","order_id","order-id","order"],
product:["商品名","商品名称","品名","lineitem name","product-name","product"],
sku:["商品管理番号","商品番号","SKU","sku","商品コード","管理番号"],
quantity:["個数","数量","注文個数","販売数量","quantity","lineitem quantity"],
revenue:["商品金額","売上金額","売上金額（すべて）","売上金額 (すべて)","請求金額","合計金額","金額","売上","total","item-price","revenue"],
platform:["プラットフォーム","モール","販売チャネル","platform","channel"],
store:["店舗","店舗名","ショップ","ショップ名","store"],
adCost:["広告費","広告コスト","RPP広告費","ad_cost","advertising cost"],
adRevenue:["広告売上","広告経由売上","RPP売上","ad_revenue","attributed sales"]
};
const mapIds={date:"mapDate",orderId:"mapOrderId",product:"mapProduct",sku:"mapSku",quantity:"mapQuantity",revenue:"mapRevenue",platform:"mapPlatform",store:"mapStore",adCost:"mapAdCost",adRevenue:"mapAdRevenue"};
const titles={overview:"營運總覽",sales:"銷售分析",products:"商品分析",stores:"店鋪／平台",ads:"廣告分析",import:"CSV 匯入",settings:"欄位模板"};

document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>showSection(btn.dataset.section)));
document.getElementById("goImportBtn").addEventListener("click",()=>showSection("import"));
function showSection(id){document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.section===id));document.querySelectorAll(".page-section").forEach(s=>s.classList.toggle("active",s.id===id));document.getElementById("pageTitle").textContent=titles[id]||"";if(id==="settings")renderTemplates()}

const csvFile=document.getElementById("csvFile"),dropZone=document.getElementById("dropZone"),statusEl=document.getElementById("importStatus");
csvFile.addEventListener("change",e=>e.target.files?.[0]&&loadCsv(e.target.files[0]));
["dragenter","dragover"].forEach(n=>dropZone.addEventListener(n,e=>{e.preventDefault();dropZone.classList.add("dragover")}));
["dragleave","drop"].forEach(n=>dropZone.addEventListener(n,e=>{e.preventDefault();dropZone.classList.remove("dragover")}));
dropZone.addEventListener("drop",e=>e.dataTransfer.files?.[0]&&loadCsv(e.dataTransfer.files[0]));

function loadCsv(file){
state.currentFileName=file.name;statusEl.textContent=`正在讀取：${file.name}`;
Papa.parse(file,{header:true,skipEmptyLines:"greedy",dynamicTyping:false,complete:r=>{
if(!r.meta.fields?.length){statusEl.textContent="找不到欄位名稱，請確認第一列為標題列。";return}
state.rawRows=r.data;state.headers=r.meta.fields.map(x=>String(x).trim());buildMappingOptions();autoMap();document.getElementById("mappingPanel").classList.remove("hidden");statusEl.textContent=`${file.name}：${state.rawRows.length} 筆資料`;refreshTemplateSelect()
},error:e=>statusEl.textContent=`讀取失敗：${e.message}`})
}
function buildMappingOptions(){Object.values(mapIds).forEach(id=>{const s=document.getElementById(id);s.innerHTML='<option value="">不使用此欄位</option>'+state.headers.map(h=>`<option value="${escAttr(h)}">${esc(h)}</option>`).join("")})}
function autoMap(){Object.entries(mapIds).forEach(([k,id])=>{document.getElementById(id).value=findHeader(aliases[k]||[])||""})}
function findHeader(candidates){const hs=state.headers.map(h=>({o:h,n:norm(h)}));for(const c of candidates){const x=hs.find(i=>i.n===norm(c));if(x)return x.o}for(const c of candidates){const x=hs.find(i=>i.n.includes(norm(c))||norm(c).includes(i.n));if(x)return x.o}return""}
function getMapping(){const m={};Object.entries(mapIds).forEach(([k,id])=>m[k]=document.getElementById(id).value);return m}

document.getElementById("analyzeBtn").addEventListener("click",()=>importRows(false));
document.getElementById("replaceBtn").addEventListener("click",()=>importRows(true));
function importRows(replace){
const m=getMapping(),required=["date","orderId","product","quantity","revenue"];if(required.some(k=>!m[k])){statusEl.textContent="請指定日期、訂單編號、商品名稱、數量與營收。";return}
const rows=state.rawRows.map(r=>({date:dateVal(r[m.date]),orderId:text(r[m.orderId]),product:text(r[m.product]),sku:m.sku?text(r[m.sku]):"",quantity:num(r[m.quantity]),revenue:num(r[m.revenue]),platform:m.platform?text(r[m.platform]):"",store:m.store?text(r[m.store]):"",adCost:m.adCost?num(r[m.adCost]):0,adRevenue:m.adRevenue?num(r[m.adRevenue]):0})).filter(r=>r.date||r.orderId||r.product);
if(replace){state.rows=[];state.files=[]}
state.rows.push(...rows);state.files.push({name:state.currentFileName,count:rows.length});statusEl.textContent=`已加入 ${rows.length} 筆資料`;updateAll();showSection("overview")
}

document.getElementById("clearDataBtn").addEventListener("click",()=>{state.rows=[];state.files=[];updateAll();renderFileList()});
document.getElementById("detailSearch").addEventListener("input",renderDetail);
document.getElementById("salesMetric").addEventListener("change",renderSalesChart);

function updateAll(){updateKpis();renderOverviewCharts();renderSalesChart();renderDetail();renderProducts();renderStorePlatform();renderAds();renderFileList();document.getElementById("datasetSummary").textContent=state.rows.length?`${state.rows.length.toLocaleString()} 筆資料／${state.files.length} 個檔案`:"尚未匯入資料"}
function updateKpis(){
const rev=sum(state.rows.map(r=>r.revenue)),qty=sum(state.rows.map(r=>r.quantity)),ad=sum(state.rows.map(r=>r.adCost)),orders=new Set(state.rows.map(r=>r.orderId).filter(Boolean)).size,products=new Set(state.rows.map(r=>r.sku||r.product).filter(Boolean)).size,aov=orders?rev/orders:0;
set("kpiRevenue",yen(rev));set("kpiOrders",fmt(orders));set("kpiAov",yen(aov));set("kpiQty",fmt(qty));set("kpiProducts",fmt(products));set("kpiAdCost",ad?yen(ad):"—");set("kpiRoas",ad?`${(rev/ad*100).toFixed(1)}%`:"—");set("kpiTacos",rev&&ad?`${(ad/rev*100).toFixed(1)}%`:"—")
}
function renderOverviewCharts(){
const daily=group(state.rows,r=>r.date,r=>r.revenue),prod=topGroup(state.rows,r=>r.product,r=>r.revenue,10);
chart("overviewRevenueChart","line",Object.keys(daily).sort(),Object.keys(daily).sort().map(k=>daily[k]),"營收");
chart("overviewProductChart","bar",prod.map(x=>x[0]),prod.map(x=>x[1]),"營收",true)
}
function renderSalesChart(){
const metric=document.getElementById("salesMetric").value,d={};
state.rows.forEach(r=>{d[r.date]??={revenue:0,quantity:0,orders:new Set()};d[r.date].revenue+=r.revenue;d[r.date].quantity+=r.quantity;if(r.orderId)d[r.date].orders.add(r.orderId)});
const labels=Object.keys(d).sort(),vals=labels.map(k=>metric==="orders"?d[k].orders.size:d[k][metric]);chart("salesChart","line",labels,vals,metric)
}
function renderDetail(){
const q=document.getElementById("detailSearch").value.toLowerCase();const body=document.getElementById("detailBody");
body.innerHTML=state.rows.filter(r=>!q||[r.date,r.orderId,r.product,r.sku,r.platform,r.store].some(v=>String(v).toLowerCase().includes(q))).slice(0,500).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.orderId)}</td><td>${esc(r.product)}</td><td>${esc(r.sku)}</td><td>${fmt(r.quantity)}</td><td>${yen(r.revenue)}</td><td>${esc(r.platform)}</td><td>${esc(r.store)}</td></tr>`).join("")
}
function renderProducts(){
const m={};state.rows.forEach(r=>{const k=r.sku||r.product;if(!m[k])m[k]={product:r.product,sku:r.sku,qty:0,rev:0,orders:new Set()};m[k].qty+=r.quantity;m[k].rev+=r.revenue;if(r.orderId)m[k].orders.add(r.orderId)});
document.getElementById("productBody").innerHTML=Object.values(m).sort((a,b)=>b.rev-a.rev).map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.product)}</td><td>${esc(x.sku)}</td><td>${fmt(x.qty)}</td><td>${yen(x.rev)}</td><td>${yen(x.qty?x.rev/x.qty:0)}</td><td>${fmt(x.orders.size)}</td></tr>`).join("")
}
function renderStorePlatform(){
const s=topGroup(state.rows,r=>r.store||"未設定",r=>r.revenue,20),p=topGroup(state.rows,r=>r.platform||"未設定",r=>r.revenue,20);
chart("storeChart","bar",s.map(x=>x[0]),s.map(x=>x[1]),"營收",true);chart("platformChart","bar",p.map(x=>x[0]),p.map(x=>x[1]),"營收",true)
}
function renderAds(){
const ad=sum(state.rows.map(r=>r.adCost)),rev=sum(state.rows.map(r=>r.revenue)),adRev=sum(state.rows.map(r=>r.adRevenue));
set("adsCost",ad?yen(ad):"—");set("adsRevenue",adRev?yen(adRev):"—");set("adsRoas",ad?(adRev?`${(adRev/ad*100).toFixed(1)}%`:`${(rev/ad*100).toFixed(1)}%`):"—");set("adsTacos",ad&&rev?`${(ad/rev*100).toFixed(1)}%`:"—");
const d={};state.rows.forEach(r=>{d[r.date]??={ad:0,rev:0};d[r.date].ad+=r.adCost;d[r.date].rev+=r.revenue});const labels=Object.keys(d).sort();
destroy("adsChart");state.charts.adsChart=new Chart(document.getElementById("adsChart"),{type:"bar",data:{labels,datasets:[{label:"廣告費",data:labels.map(k=>d[k].ad)},{label:"營收",data:labels.map(k=>d[k].rev),type:"line",tension:.25}]},options:{responsive:true,maintainAspectRatio:false}})
}
function renderFileList(){document.getElementById("fileList").innerHTML=state.files.length?state.files.map((f,i)=>`<div class="file-item"><div><strong>${esc(f.name)}</strong><small>${fmt(f.count)} 筆資料</small></div></div>`).join(""):"<p>尚未匯入任何 CSV。</p>"}

document.getElementById("saveTemplateBtn").addEventListener("click",()=>{const name=document.getElementById("templateName").value.trim();if(!name)return alert("請輸入模板名稱");const t=getTemplates();t[name]=getMapping();localStorage.setItem("ecDashboardTemplates",JSON.stringify(t));document.getElementById("templateName").value="";renderTemplates();refreshTemplateSelect()});
document.getElementById("templateSelect").addEventListener("change",e=>{const t=getTemplates()[e.target.value];if(t)Object.entries(mapIds).forEach(([k,id])=>{if(state.headers.includes(t[k]))document.getElementById(id).value=t[k]||""})});
function getTemplates(){return JSON.parse(localStorage.getItem("ecDashboardTemplates")||"{}")}
function renderTemplates(){const t=getTemplates(),el=document.getElementById("templateList");el.innerHTML=Object.keys(t).length?Object.keys(t).map(n=>`<div class="template-item"><div><strong>${esc(n)}</strong><small>已儲存在此瀏覽器</small></div><button class="danger-btn" onclick="deleteTemplate('${escAttr(n)}')">刪除</button></div>`).join(""):"<p>尚未建立模板。</p>"}
window.deleteTemplate=n=>{const t=getTemplates();delete t[n];localStorage.setItem("ecDashboardTemplates",JSON.stringify(t));renderTemplates();refreshTemplateSelect()}
function refreshTemplateSelect(){const s=document.getElementById("templateSelect"),t=getTemplates();s.innerHTML='<option value="">選擇既有模板</option>'+Object.keys(t).map(n=>`<option value="${escAttr(n)}">${esc(n)}</option>`).join("")}

function chart(id,type,labels,data,label,horizontal=false){destroy(id);state.charts[id]=new Chart(document.getElementById(id),{type,data:{labels,datasets:[{label,data,borderWidth:3,tension:.25,fill:type==="line",backgroundColor:type==="line"?"rgba(47,111,237,.1)":"#2f6fed",borderColor:"#2f6fed",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:horizontal?"y":"x",plugins:{legend:{display:type==="line"}}}})}
function destroy(id){state.charts[id]?.destroy()}
function group(rows,key,val){const d={};rows.forEach(r=>{const k=key(r)||"未設定";d[k]=(d[k]||0)+(Number(val(r))||0)});return d}
function topGroup(rows,key,val,n){return Object.entries(group(rows,key,val)).sort((a,b)=>b[1]-a[1]).slice(0,n)}
function text(v){return String(v??"").trim()}function num(v){const x=Number(String(v??"").replace(/[¥￥円,\s]/g,"").replace(/[^\d.-]/g,""));return Number.isFinite(x)?x:0}
function dateVal(v){const t=text(v).replace(/\./g,"/").replace(/-/g,"/"),m=t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:t}
function norm(v){return text(v).toLowerCase().replace(/[\s_\-／/（）()]/g,"")}function sum(a){return a.reduce((x,y)=>x+(Number(y)||0),0)}function yen(v){return new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY",maximumFractionDigits:0}).format(Number(v)||0)}function fmt(v){return new Intl.NumberFormat("zh-TW",{maximumFractionDigits:2}).format(Number(v)||0)}function set(id,v){document.getElementById(id).textContent=v}
function esc(v){return text(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function escAttr(v){return esc(v)}
updateAll();refreshTemplateSelect();
