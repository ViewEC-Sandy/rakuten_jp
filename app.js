import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const state={user:null,role:"viewer",workspaceId:"default",workspaces:[],rows:[],files:[],rawRows:[],headers:[],fieldConfig:[],charts:{},sortable:null};
const titles={dashboard:"儀表板",data:"資料管理",templates:"欄位模板",layout:"版面設定",users:"使用者"};
const defaultFields=[
{label:"日期",type:"date",source:"",required:true},
{label:"訂單編號",type:"id",source:"",required:true},
{label:"商品名稱",type:"dimension",source:"",required:true},
{label:"數量",type:"number",source:"",required:true},
{label:"營收",type:"number",source:"",required:true}
];

const $=id=>document.getElementById(id);
$("loginBtn").addEventListener("click",login);
$("resetPasswordBtn").addEventListener("click",resetPassword);
$("logoutBtn").addEventListener("click",()=>signOut(auth));
$("themeBtn").addEventListener("click",toggleTheme);
$("goImportBtn").addEventListener("click",()=>showSection("data"));
$("saveLayoutBtn").addEventListener("click",saveLayout);
$("newWorkspaceBtn").addEventListener("click",createWorkspace);

document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.section)));
function showSection(id){document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.section===id));document.querySelectorAll(".page-section").forEach(s=>s.classList.toggle("active",s.id===id));$("pageTitle").textContent=titles[id]||"";if(id==="users"&&state.role==="admin")loadUsers()}

async function login(){try{$("authMessage").textContent="登入中…";await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value)}catch(e){$("authMessage").textContent=e.message}}
async function resetPassword(){const email=$("loginEmail").value.trim();if(!email)return $("authMessage").textContent="請先輸入 Email";try{await sendPasswordResetEmail(auth,email);$("authMessage").textContent="重設密碼信件已寄出"}catch(e){$("authMessage").textContent=e.message}}

onAuthStateChanged(auth,async user=>{
$("loadingScreen").classList.add("hidden");
if(!user){state.user=null;$("authScreen").classList.remove("hidden");$("appShell").classList.add("hidden");return}
state.user=user;
try{
await ensureUserProfile();
await loadUserProfile();
await loadWorkspaces();
applyRole();
$("currentUserText").textContent=user.email||"Firebase 使用者";
$("currentRoleText").textContent=`角色：${state.role}`;
$("authScreen").classList.add("hidden");
$("appShell").classList.remove("hidden");
loadWorkspaceState();initSortable();updateAll();
}catch(e){console.error(e);$("authMessage").textContent=`登入後初始化失敗：${e.message}`;$("authScreen").classList.remove("hidden");$("appShell").classList.add("hidden")}
});

async function ensureUserProfile(){const ref=doc(db,"users",state.user.uid);const snap=await getDoc(ref);if(!snap.exists()){await setDoc(ref,{email:state.user.email||"",role:"viewer",createdAt:serverTimestamp(),lastLogin:serverTimestamp()})}else{await setDoc(ref,{email:state.user.email||snap.data().email||"",lastLogin:serverTimestamp()},{merge:true})}}
async function loadUserProfile(){const snap=await getDoc(doc(db,"users",state.user.uid));state.role=snap.exists()?(snap.data().role||"viewer"):"viewer"}
function applyRole(){
document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",state.role!=="admin"));
document.querySelectorAll(".manager-only").forEach(el=>el.classList.toggle("hidden",!["admin","manager"].includes(state.role)));const n=$("viewerNotice");if(n)n.classList.toggle("hidden",["admin","manager"].includes(state.role))
}
async function loadWorkspaces(){
const snap=await getDocs(collection(db,"workspaces"));state.workspaces=snap.docs.map(d=>({id:d.id,...d.data()}));
if(!state.workspaces.length){state.workspaces=[{id:"default",name:"Default Workspace"}]}
$("workspaceSelect").innerHTML=state.workspaces.map(w=>`<option value="${esc(w.id)}">${esc(w.name||w.id)}</option>`).join("");
state.workspaceId=localStorage.getItem("v6_workspace")||state.workspaces[0].id;$("workspaceSelect").value=state.workspaceId
}
$("workspaceSelect").addEventListener("change",e=>{saveWorkspaceState();state.workspaceId=e.target.value;localStorage.setItem("v6_workspace",state.workspaceId);loadWorkspaceState();updateAll()});
async function createWorkspace(){if(state.role!=="admin")return;const name=prompt("Workspace 名稱");if(!name)return;const id="ws_"+Date.now();await setDoc(doc(db,"workspaces",id),{name});await loadWorkspaces();$("workspaceSelect").value=id;state.workspaceId=id;localStorage.setItem("v6_workspace",id)}

function workspaceKey(suffix){return `ec_v6_${state.workspaceId}_${suffix}`}
function saveWorkspaceState(){localStorage.setItem(workspaceKey("rows"),JSON.stringify(state.rows));localStorage.setItem(workspaceKey("files"),JSON.stringify(state.files));localStorage.setItem(workspaceKey("fields"),JSON.stringify(state.fieldConfig))}
function loadWorkspaceState(){state.rows=JSON.parse(localStorage.getItem(workspaceKey("rows"))||"[]");state.files=JSON.parse(localStorage.getItem(workspaceKey("files"))||"[]");state.fieldConfig=JSON.parse(localStorage.getItem(workspaceKey("fields"))||JSON.stringify(defaultFields));restoreLayout()}

const csvFile=$("csvFile"),dropZone=$("dropZone");
csvFile.addEventListener("change",e=>e.target.files?.[0]&&loadCsv(e.target.files[0]));
["dragenter","dragover"].forEach(n=>dropZone.addEventListener(n,e=>{e.preventDefault();dropZone.classList.add("dragover")}));
["dragleave","drop"].forEach(n=>dropZone.addEventListener(n,e=>{e.preventDefault();dropZone.classList.remove("dragover")}));
dropZone.addEventListener("drop",e=>e.dataTransfer.files?.[0]&&loadCsv(e.dataTransfer.files[0]));

function loadCsv(file){
$("importStatus").textContent=`正在讀取：${file.name}`;
Papa.parse(file,{header:true,skipEmptyLines:"greedy",complete:r=>{
state.rawRows=r.data;state.headers=(r.meta.fields||[]).map(x=>String(x).trim());state.currentFileName=file.name;
state.fieldConfig=JSON.parse(JSON.stringify(defaultFields));renderFieldRows();$("mappingPanel").classList.remove("hidden");$("importStatus").textContent=`${file.name}：${state.rawRows.length} 筆資料`;refreshTemplateSelect()
},error:e=>$("importStatus").textContent=e.message})
}
$("addFieldBtn").addEventListener("click",()=>{state.fieldConfig.push({label:"新欄位",type:"dimension",source:"",required:false});renderFieldRows()});
function renderFieldRows(){
$("fieldRows").innerHTML="";
state.fieldConfig.forEach((f,i)=>{
const node=$("fieldRowTemplate").content.cloneNode(true),row=node.querySelector(".field-row"),label=row.querySelector(".field-label"),type=row.querySelector(".field-type"),source=row.querySelector(".field-source"),required=row.querySelector(".field-required");
label.value=f.label;type.value=f.type;required.checked=f.required;source.innerHTML='<option value="">不使用</option>'+state.headers.map(h=>`<option value="${esc(h)}">${esc(h)}</option>`).join("");source.value=f.source||"";
label.oninput=e=>state.fieldConfig[i].label=e.target.value.trim();type.onchange=e=>state.fieldConfig[i].type=e.target.value;source.onchange=e=>state.fieldConfig[i].source=e.target.value;required.onchange=e=>state.fieldConfig[i].required=e.target.checked;row.querySelector(".remove-field").onclick=()=>{state.fieldConfig.splice(i,1);renderFieldRows()};$("fieldRows").appendChild(node)
})
}
$("appendDataBtn").addEventListener("click",()=>importRows(false));
$("replaceDataBtn").addEventListener("click",()=>importRows(true));
function importRows(replace){
const missing=state.fieldConfig.filter(f=>f.required&&!f.source);if(missing.length)return $("importStatus").textContent=`請指定：${missing.map(x=>x.label).join("、")}`;
const usable=state.fieldConfig.filter(f=>f.source&&f.label),rows=state.rawRows.map(r=>{const o={};usable.forEach(f=>o[f.label]=f.type==="number"?num(r[f.source]):f.type==="date"?dateVal(r[f.source]):text(r[f.source]));return o}).filter(r=>Object.values(r).some(v=>v!==""&&v!==0));
if(replace){state.rows=[];state.files=[]}state.rows.push(...rows);state.files.push({name:state.currentFileName,count:rows.length});saveWorkspaceState();updateAll();showSection("dashboard")
}
$("clearDataBtn").addEventListener("click",()=>{state.rows=[];state.files=[];saveWorkspaceState();updateAll()});

$("saveTemplateBtn").addEventListener("click",()=>{const name=$("templateName").value.trim();if(!name)return;const t=getTemplates();t[name]=state.fieldConfig;localStorage.setItem(workspaceKey("templates"),JSON.stringify(t));$("templateName").value="";renderTemplates();refreshTemplateSelect()});
$("templateSelect").addEventListener("change",e=>{const t=getTemplates()[e.target.value];if(t){state.fieldConfig=JSON.parse(JSON.stringify(t));renderFieldRows()}});
function getTemplates(){return JSON.parse(localStorage.getItem(workspaceKey("templates"))||"{}")}
function refreshTemplateSelect(){$("templateSelect").innerHTML='<option value="">選擇欄位模板</option>'+Object.keys(getTemplates()).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("")}
function renderTemplates(){$("templateList").innerHTML=Object.entries(getTemplates()).map(([n,c])=>`<div class="template-item"><div><strong>${esc(n)}</strong><small>${c.length} 個欄位</small></div><button class="danger-btn small" data-delete-template="${esc(n)}">刪除</button></div>`).join("")||"<p>尚未建立模板。</p>";document.querySelectorAll("[data-delete-template]").forEach(b=>b.onclick=()=>{const t=getTemplates();delete t[b.dataset.deleteTemplate];localStorage.setItem(workspaceKey("templates"),JSON.stringify(t));renderTemplates();refreshTemplateSelect()})}

function initSortable(){state.sortable?.destroy();state.sortable=new Sortable($("dashboardGrid"),{animation:180,handle:".drag-handle"})}
function saveLayout(){const order=[...$("dashboardGrid").children].map(x=>x.dataset.widget);localStorage.setItem(workspaceKey("layout"),JSON.stringify(order));alert("版面已儲存")}
function restoreLayout(){const order=JSON.parse(localStorage.getItem(workspaceKey("layout"))||"[]"),grid=$("dashboardGrid");order.forEach(id=>{const el=grid.querySelector(`[data-widget="${id}"]`);if(el)grid.appendChild(el)})}
function toggleTheme(){document.body.classList.toggle("dark");localStorage.setItem("ec_v6_dark",document.body.classList.contains("dark")?"1":"0")}
if(localStorage.getItem("ec_v6_dark")==="1")document.body.classList.add("dark");

["trendDateField","trendMetricField","trendChartType","rankingDimension","rankingMetric","rankingChartType","filterDateField","filterDimensionField","filterDimensionValue","tableLimit","kpiLimit"].forEach(id=>$(id).addEventListener("change",updateAll));
$("detailSearch").addEventListener("input",renderDetail);
$("clearFilterBtn").addEventListener("click",()=>{$("filterDimensionValue").value="";updateAll()});

function filteredRows(){const dim=$("filterDimensionField").value,val=$("filterDimensionValue").value;return state.rows.filter(r=>!dim||!val||String(r[dim])===val)}
function updateAll(){renderSelectors();renderFilterValues();renderKpis();renderTrend();renderRanking();renderDetail();renderFiles();renderTemplates();refreshTemplateSelect()}
function fields(types){const set=new Set(types),all=new Set();state.rows.forEach(r=>Object.keys(r).forEach(k=>all.add(k)));return [...all].filter(k=>state.fieldConfig.some(f=>f.label===k&&set.has(f.type)))}
function fill(id,vals,blank=false){const el=$(id),cur=el.value;el.innerHTML=(blank?'<option value="">全部</option>':'')+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(vals.includes(cur)||blank&&cur==="")el.value=cur}
function renderSelectors(){const dims=fields(["dimension","id","date"]),dates=fields(["date"]),nums=fields(["number"]);fill("trendDateField",dates);fill("trendMetricField",nums);fill("rankingDimension",dims);fill("rankingMetric",nums);fill("filterDateField",dates,true);fill("filterDimensionField",dims,true)}
function renderFilterValues(){const dim=$("filterDimensionField").value,vals=dim?[...new Set(state.rows.map(r=>r[dim]).filter(v=>v!==""&&v!=null))]:[];fill("filterDimensionValue",vals,true)}
function renderKpis(){const nums=fields(["number"]),limit=Number($("kpiLimit").value||8);$("kpiGrid").innerHTML=nums.slice(0,limit).map(n=>`<article class="kpi-card"><span>${esc(n)}</span><strong>${fmt(sum(filteredRows().map(r=>r[n])))}</strong></article>`).join("")||'<article class="kpi-card"><span>尚無數值欄位</span><strong>—</strong></article>'}
function renderTrend(){const d=$("trendDateField").value,m=$("trendMetricField").value;if(!d||!m)return draw("trendChart","line",[],[],"");const g=group(filteredRows(),r=>r[d],r=>r[m]),labels=Object.keys(g).sort();draw("trendChart",$("trendChartType").value,labels,labels.map(k=>g[k]),m)}
function renderRanking(){const d=$("rankingDimension").value,m=$("rankingMetric").value;if(!d||!m)return draw("rankingChart","bar",[],[],"");const g=Object.entries(group(filteredRows(),r=>r[d]||"未設定",r=>r[m])).sort((a,b)=>b[1]-a[1]).slice(0,10);draw("rankingChart",$("rankingChartType").value,g.map(x=>x[0]),g.map(x=>x[1]),m)}
function renderDetail(){const rows=filteredRows(),fs=[...new Set(rows.flatMap(r=>Object.keys(r)))],q=$("detailSearch").value.toLowerCase(),limit=Number($("tableLimit").value||500);$("detailHead").innerHTML=`<tr>${fs.map(f=>`<th>${esc(f)}</th>`).join("")}</tr>`;$("detailBody").innerHTML=rows.filter(r=>!q||Object.values(r).some(v=>String(v).toLowerCase().includes(q))).slice(0,limit).map(r=>`<tr>${fs.map(f=>`<td>${esc(r[f]??"")}</td>`).join("")}</tr>`).join("")}
function renderFiles(){$("fileList").innerHTML=state.files.map(f=>`<div class="file-item"><div><strong>${esc(f.name)}</strong><small>${fmt(f.count)} 筆</small></div></div>`).join("")||"<p>尚未匯入任何 CSV。</p>"}
async function loadUsers(){const snap=await getDocs(collection(db,"users"));$("userList").innerHTML=snap.docs.map(d=>{const x=d.data();return `<div class="template-item"><div><strong>${esc(x.email||d.id)}</strong><small>角色：${esc(x.role||"viewer")}</small></div></div>`}).join("")||"<p>尚無使用者資料。</p>"}

function draw(id,type,labels,data,label){state.charts[id]?.destroy();state.charts[id]=new Chart($(id),{type,data:{labels,datasets:[{label,data,borderWidth:3,tension:.25,fill:type==="line"}]},options:{responsive:true,maintainAspectRatio:false}})}
function group(rows,key,val){const o={};rows.forEach(r=>{const k=key(r)||"未設定";o[k]=(o[k]||0)+num(val(r))});return o}
function text(v){return String(v??"").trim()}function num(v){if(typeof v==="number")return v;const x=Number(String(v??"").replace(/[¥￥円,\s]/g,"").replace(/[^\d.-]/g,""));return Number.isFinite(x)?x:0}
function dateVal(v){const t=text(v).replace(/\./g,"/").replace(/-/g,"/"),m=t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:t}
function sum(a){return a.reduce((x,y)=>x+num(y),0)}function fmt(v){return new Intl.NumberFormat("zh-TW",{maximumFractionDigits:2}).format(Number(v)||0)}function esc(v){return text(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
