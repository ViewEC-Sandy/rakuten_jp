import {firebaseConfig} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,sendPasswordResetEmail,signOut} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,collection,getDocs,query,where,writeBatch,serverTimestamp,Timestamp,orderBy,limit} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const state={user:null,role:'viewer',sales:[],compare:[],products:new Map(),productsByManagement:new Map(),platforms:new Set(),ads:[],productAnalytics:[],overviewAds:[],overviewAnalytics:[],adsLoaded:false,productAnalyticsLoaded:false,charts:{}};
const HIDE_PROJECTS=new Set(['GOOD LIFE','Taiwan Pavilion','未設定專案']);
const isHiddenProject=value=>HIDE_PROJECTS.has(String(value||'').trim());
const titles={overview:'營運總覽',platforms:'平台比較',products:'商品跨平台',groups:'專案分析',ads:'樂天廣告分析',productAnalysis:'商品分析',master:'商品主檔',import:'資料匯入',history:'匯入紀錄'};

const salesImportProfiles={
  rakuten:{orderId:['注文番号'],date:['注文日'],productId:['商品番号'],managementNumber:['商品管理番号'],quantity:['個数','数量'],unitPrice:['単価','商品単価'],revenue:['売上金額','金額'],status:['ステータス'],cancelled:['900']},
  shopify:{orderId:['Name'],date:['Paid at'],productId:['Lineitem sku'],managementNumber:['Variant SKU','商品管理番号'],quantity:['Lineitem quantity'],unitPrice:['Lineitem price'],revenue:['Total'],status:['Financial Status'],cancelled:['refunded']}
};

document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>show(b.dataset.page));
function show(id){document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===id));document.querySelectorAll('.page').forEach(s=>s.classList.toggle('active',s.id===id));$('title').textContent=titles[id]||'';if(id==='history')loadHistory();if(id==='ads')loadAds();if(id==='productAnalysis')loadProductAnalytics()}
$('loginBtn').onclick=async()=>{try{$('loginMsg').textContent='登入中…';await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value)}catch(e){$('loginMsg').textContent=e.code?.includes('invalid-credential')?'Email 或密碼不正確':e.message}};
$('resetBtn').onclick=async()=>{const e=$('email').value.trim();if(!e)return $('loginMsg').textContent='請先輸入 Email';try{await sendPasswordResetEmail(auth,e);$('loginMsg').textContent='重設密碼信已寄出'}catch(x){$('loginMsg').textContent=x.message}};
$('logoutBtn').onclick=()=>signOut(auth);$('refreshBtn').onclick=()=>loadReports();$('applyBtn').onclick=()=>loadReports();$('productSearch').oninput=renderProducts;$('productProjectFilter').onchange=renderProducts;$('groupSearch').oninput=renderGroups;$('masterSearch').oninput=renderMaster;
['adMonthFilter','adProjectFilter','adSearch','adSort','adOrder'].forEach(id=>$(id).addEventListener(id==='adSearch'?'input':'change',renderAds));
['paMonthFilter','paProjectFilter','paSearch','paSort','paOrder'].forEach(id=>$(id).addEventListener(id==='paSearch'?'input':'change',renderProductAnalytics));

onAuthStateChanged(auth,async user=>{$('loading').classList.add('hidden');if(!user){$('login').classList.remove('hidden');$('app').classList.add('hidden');return}state.user=user;await ensureUser();await loadRole();applyRole();$('userText').textContent=user.email||'';$('roleText').textContent='角色：'+state.role;$('login').classList.add('hidden');$('app').classList.remove('hidden');setDates();setMonthInputs();setupTableFilters();await loadProductMaster();await loadPlatforms();await loadReports()});
async function ensureUser(){const r=doc(db,'users',state.user.uid),s=await getDoc(r);if(!s.exists())await setDoc(r,{email:state.user.email||'',role:'viewer',createdAt:serverTimestamp(),lastLogin:serverTimestamp()});else await setDoc(r,{lastLogin:serverTimestamp()},{merge:true})}
async function loadRole(){const s=await getDoc(doc(db,'users',state.user.uid));state.role=s.exists()?(s.data().role||'viewer'):'viewer'}
function applyRole(){const edit=['admin','manager'].includes(state.role);document.querySelectorAll('.editor').forEach(x=>x.classList.toggle('hidden',!edit));$('viewerNotice').classList.toggle('hidden',edit)}
function setDates(){const n=new Date(),s=new Date(n.getFullYear(),n.getMonth(),1);$('start').value=fd(s);$('end').value=fd(n)}
function setMonthInputs(){const n=new Date(),m=monthFromDate(n);if($('paImportMonth'))$('paImportMonth').value=m}function fd(d){return d.toISOString().slice(0,10)}
async function loadProductMaster(){const s=await getDocs(collection(db,'products'));const rows=s.docs.map(d=>({id:d.id,...d.data()}));state.products=new Map(rows.map(x=>[String(x.id),x]));state.productsByManagement=new Map(rows.filter(x=>String(x.managementNumber||'').trim()).map(x=>[String(x.managementNumber).trim(),x]));renderMaster();fillAdProjectFilter();fillProductProjectFilter()}
function findProduct(productNumber){return state.products.get(String(productNumber))||null}
function findProductByManagementNumber(value){return state.productsByManagement.get(String(value||'').trim())||null}
async function loadPlatforms(){const s=await getDocs(collection(db,'platforms'));state.platforms=new Set(s.docs.map(d=>canonicalPlatform(d.id)).filter(Boolean));$('platform').innerHTML='<option value="">全部平台</option>'+[...state.platforms].sort().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}
async function loadReports(){const s=$('start').value,e=$('end').value;if(!s||!e)return;await loadOverviewSources();state.sales=await fetchSales(s,e,$('platform').value);if($('compare').value==='none')state.compare=[];else{const [cs,ce]=compareRange(s,e,$('compare').value);state.compare=await fetchSales(cs,ce,$('platform').value)}renderAll()}
async function fetchSales(s,e,p){const qy=query(collection(db,'sales'),where('saleDate','>=',Timestamp.fromDate(new Date(s+'T00:00:00'))),where('saleDate','<=',Timestamp.fromDate(new Date(e+'T23:59:59'))));const snap=await getDocs(qy);return snap.docs.map(d=>({id:d.id,...d.data(),platform:canonicalPlatform(d.data().platform)})).filter(x=>!p||x.platform===p)}
function compareRange(s,e,m){const a=new Date(s),b=new Date(e);if(m==='yoy'){a.setFullYear(a.getFullYear()-1);b.setFullYear(b.getFullYear()-1);return[fd(a),fd(b)]}const days=Math.round((b-a)/86400000)+1,ce=new Date(a);ce.setDate(ce.getDate()-1);const cs=new Date(ce);cs.setDate(cs.getDate()-days+1);return[fd(cs),fd(ce)]}
function sum(a){return a.reduce((x,y)=>x+num(y),0)}function summary(r){return{revenue:sum(r.map(x=>x.revenue)),quantity:sum(r.map(x=>x.quantity)),orders:new Set(r.map(x=>x.orderId)).size,products:new Set(r.map(x=>x.productId)).size}}
function growth(a,b){if(!state.compare.length)return{text:'—',cls:'muted'};if(!b)return{text:a?'無比較基準':'0.0%',cls:'muted'};const p=(a-b)/b*100;return{text:(p>=0?'+':'')+p.toFixed(1)+'%',cls:p>0?'pos':p<0?'neg':'muted'}}
function renderAll(){renderKpis();renderTrend();renderShare();renderOverviewMarketing();renderTrafficTrend();renderTopProducts();renderPlatforms();renderProducts();renderGroups()}
function renderKpis(){const a=summary(state.sales),b=summary(state.compare),cards=[['營收',a.revenue,b.revenue,true],['訂單數',a.orders,b.orders],['銷售數量',a.quantity,b.quantity],['商品數',a.products,b.products],['平均客單價',a.orders?a.revenue/a.orders:0,b.orders?b.revenue/b.orders:0,true]];$('kpis').innerHTML=cards.map(([n,v,c,m])=>{const g=growth(v,c);return`<div class="kpi"><span>${n}</span><strong>${m?yen(v):fmt(v)}</strong><small class="${g.cls}">${g.text}</small></div>`}).join('')}
function by(rows,key,val){const o={};rows.forEach(r=>{const k=key(r)||'未設定';o[k]=(o[k]||0)+num(val(r))});return o}
function renderTrend(){const a=by(state.sales,r=>month(r.saleDate),r=>r.revenue),b=by(state.compare,r=>month(r.saleDate),r=>r.revenue),labels=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();chart('trend','line',labels,[{label:'本期',data:labels.map(x=>a[x]||0)},{label:'比較期',data:labels.map(x=>b[x]||0)}])}
function renderShare(){const g=Object.entries(by(state.sales,r=>r.platform,r=>r.revenue)).sort((a,b)=>b[1]-a[1]);chart('share','doughnut',g.map(x=>x[0]),[{label:'營收',data:g.map(x=>x[1])}])}
async function loadOverviewSources(){const months=[...selectedMonths()];state.overviewAds=await fetchByMonths('ads',months);state.overviewAnalytics=await fetchByMonths('productAnalytics',months)}
async function fetchByMonths(collectionName,months){if(!months.length)return[];const rows=[];for(let i=0;i<months.length;i+=30){const snap=await getDocs(query(collection(db,collectionName),where('month','in',months.slice(i,i+30))));rows.push(...snap.docs.map(d=>({id:d.id,...d.data()})))}return rows}
function selectedMonths(){const s=$('start').value,e=$('end').value;if(!s||!e)return new Set();const out=new Set(),d=new Date(s+'T00:00:00'),end=new Date(e+'T00:00:00');d.setDate(1);end.setDate(1);while(d<=end){out.add(monthFromDate(d));d.setMonth(d.getMonth()+1)}return out}
function renderOverviewMarketing(){const months=selectedMonths(),ads=state.overviewAds.filter(x=>months.has(x.month));const adSpend=sum(ads.map(x=>x.adSpend)),adSales=sum(ads.map(x=>x.salesAmount)),roas=adSpend?adSales/adSpend*100:0;const pa=state.overviewAnalytics.filter(x=>months.has(x.month)),traffic=sum(pa.map(x=>x.traffic)),salesOrders=sum(pa.map(x=>x.salesOrders)),conversion=traffic?salesOrders/traffic*100:0;$('overviewMarketingKpis').innerHTML=[['商品頁流量',fmt(traffic)],['廣告費總計',yen(adSpend)],['廣告銷售額',yen(adSales)],['ROAS',pct(roas)],['整體轉換率',pct(conversion)]].map(([n,v])=>`<div class="kpi"><span>${n}</span><strong>${v}</strong></div>`).join('')}
function renderTrafficTrend(){const months=[...selectedMonths()].sort(),paBy=new Map(),adBy=new Map();state.overviewAnalytics.forEach(x=>{if(months.includes(x.month))paBy.set(x.month,(paBy.get(x.month)||0)+num(x.traffic))});state.overviewAds.forEach(x=>{if(months.includes(x.month))adBy.set(x.month,(adBy.get(x.month)||0)+num(x.clicks))});chart('trafficTrend','line',months,[{label:'商品頁流量',data:months.map(m=>paBy.get(m)||0)},{label:'RPP廣告流量',data:months.map(m=>adBy.get(m)||0)},{label:'自然流量',data:months.map(m=>Math.max(0,(paBy.get(m)||0)-(adBy.get(m)||0)))}])}
function renderTopProducts(){const m=new Map();state.sales.forEach(r=>{const p=findProduct(r.productId)||{},k=r.productId;if(!m.has(k))m.set(k,{productId:k,name:p.nameZh||p.name||p.nameJa||'未設定',revenue:0,quantity:0});const x=m.get(k);x.revenue+=num(r.revenue);x.quantity+=num(r.quantity)});const rows=[...m.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,10);$('topProductRows').innerHTML=rows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.productId)}</td><td>${esc(x.name)}</td><td>${yen(x.revenue)}</td><td>${fmt(x.quantity)}</td></tr>`).join('')}
function canonicalPlatform(value){const v=String(value||'').trim();if(v.toLowerCase()==='rakuten')return'Rakuten';if(v.toLowerCase()==='shopify')return'shopify';return v}

function renderPlatforms(){const ks=[...new Set([...state.sales.map(x=>x.platform),...state.compare.map(x=>x.platform)])].filter(Boolean).sort();$('platformRows').innerHTML=ks.map(k=>{const a=summary(state.sales.filter(x=>x.platform===k)),b=summary(state.compare.filter(x=>x.platform===k)),g=growth(a.revenue,b.revenue);return`<tr><td>${esc(k)}</td><td>${yen(a.revenue)}</td><td>${yen(b.revenue)}</td><td>${yen(a.revenue-b.revenue)}</td><td class="${g.cls}">${g.text}</td><td>${fmt(a.quantity)}</td><td>${fmt(a.orders)}</td></tr>`}).join('')}
function fillProductProjectFilter(){if(!$('productProjectFilter'))return;const current=$('productProjectFilter').value;const projects=[...new Set([...state.products.values()].map(p=>String(p.projectName||'').trim()).filter(v=>v&&!isHiddenProject(v)))].sort();$('productProjectFilter').innerHTML='<option value="">全部專案</option>'+projects.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');$('productProjectFilter').value=current}
function renderProducts(){const q=$('productSearch').value.toLowerCase(),projectFilter=$('productProjectFilter').value,m=new Map();state.sales.forEach(r=>{const platform=canonicalPlatform(r.platform),k=r.productId+'||'+platform;if(!m.has(k))m.set(k,{...r,platform,revenue:0,quantity:0,cmp:0});const x=m.get(k);x.revenue+=num(r.revenue);x.quantity+=num(r.quantity)});state.compare.forEach(r=>{const platform=canonicalPlatform(r.platform),k=r.productId+'||'+platform;if(!m.has(k))m.set(k,{...r,platform,revenue:0,quantity:0,cmp:0});m.get(k).cmp+=num(r.revenue)});const rows=[...m.values()].filter(x=>{const p=findProduct(x.productId)||{},project=String(p.projectName||'').trim();return!isHiddenProject(project)&&(!projectFilter||project===projectFilter)&&(!q||(x.productId+' '+(p.managementNumber||'')+' '+(p.nameZh||'')+' '+(p.nameJa||'')+' '+project).toLowerCase().includes(q))}).sort((a,b)=>b.revenue-a.revenue);const totals={revenue:sum(rows.map(x=>x.revenue)),quantity:sum(rows.map(x=>x.quantity))};$('productTotals').innerHTML=[['篩選營收總計',yen(totals.revenue)],['篩選銷量總計',fmt(totals.quantity)],['結果筆數',fmt(rows.length)]].map(([n,v])=>`<div class="kpi"><span>${n}</span><strong>${v}</strong></div>`).join('');$('productRows').innerHTML=rows.slice(0,500).map(x=>{const p=findProduct(x.productId)||{},g=growth(x.revenue,x.cmp);return`<tr><td>${esc(x.productId)}</td><td>${esc(p.managementNumber)}</td><td>${esc(p.nameZh||p.name||'未設定')}</td><td>${esc(p.nameJa||'')}</td><td>${esc(x.platform)}</td><td>${yen(x.revenue)}</td><td>${yen(x.cmp)}</td><td class="${g.cls}">${g.text}</td><td>${fmt(x.quantity)}</td></tr>`}).join('')}
function renderGroups(){const q=$('groupSearch').value.trim().toLowerCase(),m=new Map();state.sales.forEach(r=>{const k=String(findProduct(r.productId)?.projectName||'').trim();if(!k||isHiddenProject(k))return;if(!m.has(k))m.set(k,{rev:0,cmp:0,qty:0});const x=m.get(k);x.rev+=num(r.revenue);x.qty+=num(r.quantity)});state.compare.forEach(r=>{const k=String(findProduct(r.productId)?.projectName||'').trim();if(!k||isHiddenProject(k))return;if(!m.has(k))m.set(k,{rev:0,cmp:0,qty:0});m.get(k).cmp+=num(r.revenue)});const rows=[...m.entries()].filter(([k])=>!q||k.toLowerCase().includes(q)).sort((a,b)=>b[1].rev-a[1].rev),total=sum(rows.map(([,x])=>x.rev)),qty=sum(rows.map(([,x])=>x.qty));$('groupTotals').innerHTML=[['篩選營收總計',yen(total)],['篩選銷量總計',fmt(qty)],['專案數',fmt(rows.length)]].map(([n,v])=>`<div class="kpi"><span>${n}</span><strong>${v}</strong></div>`).join('');$('groupRows').innerHTML=rows.map(([k,x])=>{const g=growth(x.rev,x.cmp);return`<tr><td>${esc(k)}</td><td>${yen(x.rev)}</td><td>${yen(x.cmp)}</td><td>${yen(x.rev-x.cmp)}</td><td class="${g.cls}">${g.text}</td><td>${fmt(x.qty)}</td><td>${total?(x.rev/total*100).toFixed(1):0}%</td></tr>`}).join('')}

function renderMaster(){const q=$('masterSearch').value.trim().toLowerCase();$('masterRows').innerHTML=[...state.products.values()].filter(p=>!q||((p.id||'')+' '+(p.managementNumber||'')+' '+(p.nameZh||'')+' '+(p.nameJa||'')+' '+(p.projectName||'')+' '+(p.vendorName||'')+' '+(p.barcode||'')).toLowerCase().includes(q)).sort((a,b)=>String(a.id).localeCompare(String(b.id),'ja')).map(p=>`<tr><td>${esc(p.id)}</td><td>${esc(p.managementNumber)}</td><td>${esc(p.nameZh||p.name)}</td><td>${esc(p.nameJa)}</td><td>${esc(p.projectName)}</td><td>${esc(p.vendorName)}</td><td>${twd(p.supplyPrice)}</td><td>${yen(p.rakutenPriceJpy)}</td><td>${yen(p.netseaPriceJpy)}</td><td>${yen(p.shopifyPrice)}</td><td>${esc(p.barcode)}</td></tr>`).join('')}

$('productFile').onchange=e=>e.target.files?.[0]&&importProducts(e.target.files[0]);
async function importProducts(file){const mode=$('productImportMode')?.value||'merge';$('productStatus').textContent='讀取中…';Papa.parse(file,{header:true,skipEmptyLines:'greedy',complete:async r=>{try{const parsed=r.data.map((x,i)=>({id:pick(x,['商品番号']),productNumber:pick(x,['商品番号']),managementNumber:pick(x,['商品管理番号']),nameZh:pick(x,['中文商品名','中文品名','商品名（中文）']),nameJa:pick(x,['日文商品名','日文品名','商品名（日文）','商品名']),projectName:pick(x,['專案名稱']),vendorName:pick(x,['廠商名']),supplyPrice:num(pick(x,['商品供應價'])),rakutenPriceJpy:num(pick(x,['樂天日幣售價'])),netseaPriceJpy:num(pick(x,['NETSEA日幣售價'])),shopifyPrice:num(pick(x,['Shopify售價'])),barcode:pick(x,['商品條碼']),sourceRow:i+2})).filter(x=>x.id);if(!parsed.length)throw new Error('CSV 找不到商品番号');const mp=new Map();parsed.forEach(x=>mp.set(String(x.id),x));const rows=[...mp.values()].map(({sourceRow,...x})=>x),duplicateCount=parsed.length-rows.length;let deleted=0;if(mode==='replace'){if(prompt(`此操作將刪除目前 ${state.products.size} 筆商品資料，再匯入 ${rows.length} 筆。\n請輸入 DELETE 確認：`)!=='DELETE'){ $('productStatus').textContent='已取消';$('productFile').value='';return}deleted=await deleteCollectionDocuments('products')}await batchWrite('products',rows,x=>x.id);await logImport(mode==='replace'?'productMasterReplace':'productMasterMerge','',file.name,rows.length,rows.length,0);$('productStatus').textContent=mode==='replace'?`完成：刪除 ${deleted} 筆，匯入 ${rows.length} 筆`:`完成：更新／新增 ${rows.length} 筆${duplicateCount?`，重複 ${duplicateCount} 列採最後一列`:''}`;$('productFile').value='';await loadProductMaster();renderProducts();renderGroups()}catch(e){console.error(e);$('productStatus').textContent='匯入失敗：'+e.message}}})}
async function deleteCollectionDocuments(collectionName){const snap=await getDocs(collection(db,collectionName));for(let i=0;i<snap.docs.length;i+=450){const batch=writeBatch(db);snap.docs.slice(i,i+450).forEach(d=>batch.delete(d.ref));await batch.commit()}return snap.docs.length}

$('salesFile').onchange=e=>e.target.files?.[0]&&importSales(e.target.files[0]);
async function importSales(file){
  const p=$('importPlatform').value,profile=salesImportProfiles[p];
  if(!profile)return $('salesStatus').textContent='請先選擇平台';
  $('salesStatus').textContent='讀取中…';
  Papa.parse(file,{header:true,skipEmptyLines:'greedy',complete:async r=>{try{
    if(r.errors?.length)throw new Error(`CSV 解析錯誤：第 ${r.errors[0].row+2} 列 ${r.errors[0].message}`);
    let cancelled=0;
    const rows=r.data.map((x,i)=>{
      const status=pick(x,profile.status||[]).toLowerCase();
      if((profile.cancelled||[]).some(v=>status===String(v).toLowerCase())){cancelled++;return null}
      const date=pick(x,profile.date),orderId=pick(x,profile.orderId),productId=pick(x,profile.productId),managementNumber=pick(x,profile.managementNumber),line=String(i+1);
      if(!date||!orderId||!productId)return null;
      const d=parseDate(date),quantity=num(pick(x,profile.quantity)),unitPrice=num(pick(x,profile.unitPrice)),directRevenue=pick(x,profile.revenue),revenue=directRevenue?num(directRevenue):unitPrice*quantity;
      return{id:safe(p+'_'+orderId+'_'+productId+'_'+line),platform:canonicalPlatform(p),orderId,productId,managementNumber,quantity,unitPrice,revenue,saleDate:Timestamp.fromDate(d),year:d.getFullYear(),month:monthFromDate(d),sourceFile:file.name,updatedAt:serverTimestamp()}
    }).filter(Boolean);
    let write=rows,skipped=0;
    if($('duplicate').value==='skip'){const checks=await Promise.all(rows.map(x=>getDoc(doc(db,'sales',x.id))));write=rows.filter((_,i)=>!checks[i].exists());skipped=rows.length-write.length}
    await batchWrite('sales',write,x=>x.id);const platformName=canonicalPlatform(p);await setDoc(doc(db,'platforms',platformName),{name:platformName,updatedAt:serverTimestamp()},{merge:true});await logImport('sales',p,file.name,r.data.length,write.length,skipped+cancelled);
    $('salesStatus').textContent=`完成：有效 ${rows.length}、寫入 ${write.length}、重複跳過 ${skipped}、取消／退款排除 ${cancelled}`;await loadPlatforms();await loadReports()
  }catch(e){console.error(e);$('salesStatus').textContent='匯入失敗：'+e.message}}})}


$('adFile').onchange=e=>e.target.files?.[0]&&importAds(e.target.files[0]);
async function importAds(file){
  $('adStatus').textContent='讀取中…';
  Papa.parse(file,{header:true,skipEmptyLines:'greedy',complete:async r=>{
    try{
      if(r.errors?.length)throw new Error(`CSV 解析錯誤：第 ${r.errors[0].row+2} 列 ${r.errors[0].message}`);
      const grouped=new Map();
      r.data.forEach((x,i)=>{
        const rowNo=i+2,dateText=pick(x,['日付']),managementNumber=pick(x,['商品管理番号']);
        if(!dateText&&!managementNumber)return;
        if(!dateText)throw new Error(`第 ${rowNo} 列缺少「日付」`);
        if(!managementNumber)throw new Error(`第 ${rowNo} 列缺少「商品管理番号」`);
        let d;
        try{d=parseRakutenAdDate(dateText)}catch(e){throw new Error(`第 ${rowNo} 列：${e.message}`)}
        const monthKey=monthFromDate(d),key=monthKey+'||'+managementNumber;
        const clicks=num(pick(x,['クリック数(合計)','クリック数']));
        const adSpend=num(pick(x,['実績額(合計)','実績額']));
        const salesAmount=num(pick(x,['売上金額(合計720時間)','売上金額(720時間)','売上金額']));
        const salesOrders=num(pick(x,['売上件数(合計720時間)','売上件数(720時間)','売上件数']));
        const ctr=num(pick(x,['CTR(%)','CTR']));
        if(!grouped.has(key))grouped.set(key,{month:monthKey,adDate:d,managementNumber,clicks:0,adSpend:0,salesAmount:0,salesOrders:0,ctrWeighted:0,ctrWeight:0});
        const g=grouped.get(key),weight=Math.max(clicks,1);
        g.clicks+=clicks;g.adSpend+=adSpend;g.salesAmount+=salesAmount;g.salesOrders+=salesOrders;g.ctrWeighted+=ctr*weight;g.ctrWeight+=weight;
      });
      const rows=[...grouped.values()].map(g=>{
        const product=findProductByManagementNumber(g.managementNumber),ctr=g.ctrWeight?g.ctrWeighted/g.ctrWeight:0;
        return{id:safe('rakuten_ads_'+g.month+'_'+g.managementNumber),platform:'rakuten',adDate:Timestamp.fromDate(g.adDate),month:g.month,managementNumber:g.managementNumber,productId:product?.id||'',ctr,clicks:g.clicks,adSpend:g.adSpend,salesAmount:g.salesAmount,salesOrders:g.salesOrders,cvr:g.clicks?g.salesOrders/g.clicks*100:0,roas:g.adSpend?g.salesAmount/g.adSpend*100:0,sourceFile:file.name};
      });
      if(!rows.length)throw new Error('CSV 中找不到可匯入的廣告資料');
      let write=rows,skipped=0;
      if($('adDuplicate').value==='skip'){
        const checks=await Promise.all(rows.map(x=>getDoc(doc(db,'ads',x.id))));
        write=rows.filter((_,i)=>!checks[i].exists());skipped=rows.length-write.length;
      }
      await batchWrite('ads',write,x=>x.id);
      await logImport('rakutenAds','rakuten',file.name,rows.length,write.length,skipped);
      const unmatched=rows.filter(x=>!x.productId).length;
      $('adStatus').textContent=`完成：彙整 ${rows.length} 筆、寫入 ${write.length}、跳過 ${skipped}${unmatched?`、未對應商品 ${unmatched} 筆`:''}`;
      $('adFile').value='';await loadAds();
    }catch(e){console.error(e);$('adStatus').textContent='匯入失敗：'+e.message}
  }});
}

async function loadAds(){const s=await getDocs(collection(db,'ads'));state.ads=s.docs.map(d=>({id:d.id,...d.data()}));state.adsLoaded=true;fillAdMonthFilter();renderAds()}
function fillAdMonthFilter(){const current=$('adMonthFilter').value,months=[...new Set(state.ads.map(x=>x.month).filter(Boolean))].sort().reverse();$('adMonthFilter').innerHTML='<option value="">全部月份</option>'+months.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');$('adMonthFilter').value=current}
function fillAdProjectFilter(){const current=$('adProjectFilter')?.value||'',projects=[...new Set([...state.products.values()].map(p=>p.projectName).filter(v=>v&&!isHiddenProject(v)))].sort();if($('adProjectFilter')){$('adProjectFilter').innerHTML='<option value="">全部專案</option>'+projects.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');$('adProjectFilter').value=current}}
function renderAds(){if(!$('adRows'))return;const monthFilter=$('adMonthFilter').value,projectFilter=$('adProjectFilter').value,q=$('adSearch').value.trim().toLowerCase(),sortKey=$('adSort').value,order=$('adOrder').value==='asc'?1:-1,m=new Map();state.ads.forEach(r=>{if(monthFilter&&r.month!==monthFilter)return;const p=r.productId?findProduct(r.productId):findProductByManagementNumber(r.managementNumber);if(isHiddenProject(p?.projectName))return;if(projectFilter&&(p?.projectName||'')!==projectFilter)return;const hay=(r.managementNumber+' '+(p?.id||'')+' '+(p?.nameZh||'')+' '+(p?.nameJa||'')+' '+(p?.projectName||'')).toLowerCase();if(q&&!hay.includes(q))return;const k=r.month+'||'+r.managementNumber;if(!m.has(k))m.set(k,{month:r.month,managementNumber:r.managementNumber,productId:p?.id||r.productId||'',nameZh:p?.nameZh||p?.name||'',nameJa:p?.nameJa||'',projectName:p?.projectName||'',clicks:0,adSpend:0,salesAmount:0,salesOrders:0,ctrWeighted:0,ctrWeight:0});const x=m.get(k),clicks=num(r.clicks);x.clicks+=clicks;x.adSpend+=num(r.adSpend);x.salesAmount+=num(r.salesAmount);x.salesOrders+=num(r.salesOrders);x.ctrWeighted+=num(r.ctr)*Math.max(clicks,1);x.ctrWeight+=Math.max(clicks,1)});const rows=[...m.values()].map(x=>({...x,ctr:x.ctrWeight?x.ctrWeighted/x.ctrWeight:0,cvr:x.clicks?x.salesOrders/x.clicks*100:0,roas:x.adSpend?x.salesAmount/x.adSpend*100:0})).sort((a,b)=>{const av=typeof a[sortKey]==='string'?a[sortKey]:num(a[sortKey]),bv=typeof b[sortKey]==='string'?b[sortKey]:num(b[sortKey]);return typeof av==='string'?av.localeCompare(bv,'zh-Hant')*order:(av-bv)*order});const total={clicks:sum(rows.map(x=>x.clicks)),adSpend:sum(rows.map(x=>x.adSpend)),salesAmount:sum(rows.map(x=>x.salesAmount)),salesOrders:sum(rows.map(x=>x.salesOrders))};total.cvr=total.clicks?total.salesOrders/total.clicks*100:0;total.roas=total.adSpend?total.salesAmount/total.adSpend*100:0;$('adKpis').innerHTML=[['點擊數',fmt(total.clicks)],['廣告花費',yen(total.adSpend)],['廣告銷售額',yen(total.salesAmount)],['CVR',pct(total.cvr)],['ROAS',pct(total.roas)]].map(([n,v])=>`<div class="kpi"><span>${n}</span><strong>${v}</strong></div>`).join('');$('adRows').innerHTML=rows.map(x=>`<tr><td>${esc(x.month)}</td><td>${esc(x.productId)}</td><td>${esc(x.managementNumber)}</td><td>${esc(x.nameZh||'未對應')}</td><td>${esc(x.nameJa)}</td><td>${esc(x.projectName)}</td><td>${pct(x.ctr)}</td><td>${fmt(x.clicks)}</td><td>${yen(x.adSpend)}</td><td>${yen(x.salesAmount)}</td><td>${fmt(x.salesOrders)}</td><td>${pct(x.cvr)}</td><td>${pct(x.roas)}</td></tr>`).join('')}


$('paFile').onchange=e=>e.target.files?.[0]&&importProductAnalytics(e.target.files[0]);
async function importProductAnalytics(file){
  const monthKey=$('paImportMonth').value;
  if(!monthKey)return $('paStatus').textContent='請先選擇資料月份';
  $('paStatus').textContent='讀取中…';
  Papa.parse(file,{header:true,skipEmptyLines:'greedy',complete:async r=>{try{
    if(r.errors?.length)throw new Error(`CSV 解析錯誤：第 ${r.errors[0].row+2} 列 ${r.errors[0].message}`);
    const grouped=new Map();
    r.data.forEach((x,i)=>{
      const productId=pick(x,['商品番号','商品管理番号（商品URL）','商品コード']);
      if(!productId)return;
      const key=String(productId).trim();
      if(!grouped.has(key))grouped.set(key,{productId:key,sales:0,salesOrders:0,salesQuantity:0,traffic:0,newOrders:0,repeatOrders:0,favoriteNew:0,favoriteTotal:0});
      const g=grouped.get(key);
      g.sales+=num(pick(x,['売上','売上金額']));g.salesOrders+=num(pick(x,['売上件数']));g.salesQuantity+=num(pick(x,['売上個数']));g.traffic+=num(pick(x,['アクセス人数']));g.newOrders+=num(pick(x,['新規購入件数']));g.repeatOrders+=num(pick(x,['リピート購入件数']));g.favoriteNew+=num(pick(x,['お気に入り登録ユーザ数']));g.favoriteTotal=Math.max(g.favoriteTotal,num(pick(x,['お気に入り総ユーザ数'])));
    });
    const rows=[...grouped.values()].map(g=>{const product=findProduct(g.productId);return{id:safe('product_analysis_'+monthKey+'_'+g.productId),month:monthKey,productId:g.productId,managementNumber:product?.managementNumber||'',...g,sourceFile:file.name}});
    if(!rows.length)throw new Error('CSV 中找不到「商品番号」或可匯入資料');
    let write=rows,skipped=0;if($('paDuplicate').value==='skip'){const checks=await Promise.all(rows.map(x=>getDoc(doc(db,'productAnalytics',x.id))));write=rows.filter((_,i)=>!checks[i].exists());skipped=rows.length-write.length}
    await batchWrite('productAnalytics',write,x=>x.id);await logImport('productAnalytics','rakuten',file.name,rows.length,write.length,skipped);
    $('paStatus').textContent=`完成：彙整 ${rows.length} 筆、寫入 ${write.length}、跳過 ${skipped}`;$('paFile').value='';await loadProductAnalytics()
  }catch(e){console.error(e);$('paStatus').textContent='匯入失敗：'+e.message}}})}

async function loadProductAnalytics(){const s=await getDocs(collection(db,'productAnalytics'));state.productAnalytics=s.docs.map(d=>({id:d.id,...d.data()}));state.productAnalyticsLoaded=true;fillPaFilters();if(!state.adsLoaded){const a=await getDocs(collection(db,'ads'));state.ads=a.docs.map(d=>({id:d.id,...d.data()}));state.adsLoaded=true}renderProductAnalytics()}
function fillPaFilters(){const monthCurrent=$('paMonthFilter').value,projectCurrent=$('paProjectFilter').value;const months=[...new Set(state.productAnalytics.map(x=>x.month).filter(Boolean))].sort().reverse();$('paMonthFilter').innerHTML='<option value="">全部月份</option>'+months.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');$('paMonthFilter').value=monthCurrent;const projects=[...new Set([...state.products.values()].map(p=>p.projectName).filter(v=>v&&!isHiddenProject(v)))].sort();$('paProjectFilter').innerHTML='<option value="">全部專案</option>'+projects.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');$('paProjectFilter').value=projectCurrent}
function renderProductAnalytics(){if(!$('paRows'))return;const mf=$('paMonthFilter').value,pf=$('paProjectFilter').value,q=$('paSearch').value.trim().toLowerCase(),sortKey=$('paSort').value,order=$('paOrder').value==='asc'?1:-1;const adClicks=new Map();state.ads.forEach(a=>{const p=a.productId?findProduct(a.productId):findProductByManagementNumber(a.managementNumber),pid=p?.id||a.productId||'';if(pid)adClicks.set(a.month+'||'+pid,(adClicks.get(a.month+'||'+pid)||0)+num(a.clicks))});const rows=state.productAnalytics.map(r=>{const p=findProduct(r.productId)||{},rppTraffic=adClicks.get(r.month+'||'+r.productId)||0,traffic=num(r.traffic);return{...r,managementNumber:p.managementNumber||r.managementNumber||'',nameZh:p.nameZh||p.name||'',projectName:p.projectName||'',rppTraffic,organicTraffic:traffic-rppTraffic,conversionRate:traffic?num(r.salesOrders)/traffic*100:0}}).filter(r=>!isHiddenProject(r.projectName)&&(!mf||r.month===mf)&&(!pf||r.projectName===pf)&&(!q||(r.productId+' '+r.managementNumber+' '+r.nameZh+' '+r.projectName).toLowerCase().includes(q))).sort((a,b)=>(num(a[sortKey])-num(b[sortKey]))*order);const totals={sales:sum(rows.map(x=>x.sales)),salesOrders:sum(rows.map(x=>x.salesOrders)),salesQuantity:sum(rows.map(x=>x.salesQuantity)),traffic:sum(rows.map(x=>x.traffic)),rppTraffic:sum(rows.map(x=>x.rppTraffic)),newOrders:sum(rows.map(x=>x.newOrders)),repeatOrders:sum(rows.map(x=>x.repeatOrders))};totals.organicTraffic=totals.traffic-totals.rppTraffic;totals.conversionRate=totals.traffic?totals.salesOrders/totals.traffic*100:0;$('paKpis').innerHTML=[['銷售額',yen(totals.sales)],['銷售訂單數',fmt(totals.salesOrders)],['商品頁流量',fmt(totals.traffic)],['自然流量',fmt(totals.organicTraffic)],['轉換率',pct(totals.conversionRate)]].map(([n,v])=>`<div class="kpi"><span>${n}</span><strong>${v}</strong></div>`).join('');$('paRows').innerHTML=rows.map(x=>`<tr><td>${esc(x.month)}</td><td>${esc(x.productId)}</td><td>${esc(x.managementNumber)}</td><td>${esc(x.nameZh||'未對應')}</td><td>${yen(x.sales)}</td><td>${fmt(x.salesOrders)}</td><td>${fmt(x.salesQuantity)}</td><td>${fmt(x.traffic)}</td><td>${fmt(x.rppTraffic)}</td><td>${fmt(x.organicTraffic)}</td><td>${pct(x.conversionRate)}</td><td>${fmt(x.newOrders)}</td><td>${fmt(x.repeatOrders)}</td><td>${fmt(x.favoriteNew)}</td><td>${fmt(x.favoriteTotal)}</td></tr>`).join('')}

function setupTableFilters(){
  document.querySelectorAll('.table table:not([data-no-auto-filter])').forEach(table=>{
    if(table.dataset.filterReady)return;
    table.dataset.filterReady='1';
    const headers=[...table.querySelectorAll('thead th')].map((th,j)=>({j,label:th.textContent.trim()}));
    const box=document.createElement('div');
    box.className='subfilters auto-table-filter';
    box.innerHTML=`<label>搜尋<input data-role="search" placeholder="搜尋表格內容"></label><label>排序欄位<select data-role="column">${headers.map(h=>`<option value="${h.j}">${esc(h.label)}</option>`).join('')}</select></label><label>順序<select data-role="order"><option value="desc">由大到小</option><option value="asc">由小到大</option></select></label>`;
    table.closest('.table').before(box);
    const apply=()=>{
      const tbody=table.tBodies[0];
      if(!tbody)return;
      const q=box.querySelector('[data-role=search]').value.trim().toLowerCase();
      const col=Number(box.querySelector('[data-role=column]').value)||0;
      const dir=box.querySelector('[data-role=order]').value==='asc'?1:-1;
      const rows=[...tbody.rows];
      rows.forEach(row=>{row.hidden=Boolean(q)&&!row.textContent.toLowerCase().includes(q)});
      const visible=rows.filter(row=>!row.hidden).sort((a,b)=>compareCell(a.cells[col]?.textContent,b.cells[col]?.textContent)*dir);
      const hidden=rows.filter(row=>row.hidden);
      const frag=document.createDocumentFragment();
      [...visible,...hidden].forEach(row=>frag.appendChild(row));
      tbody.appendChild(frag);
    };
    box.querySelector('[data-role=search]').addEventListener('input',apply);
    box.querySelector('[data-role=column]').addEventListener('change',apply);
    box.querySelector('[data-role=order]').addEventListener('change',apply);
  });
}
function compareCell(a='',b=''){const clean=v=>String(v).replace(/[¥￥円,%\s,]/g,'');const an=Number(clean(a)),bn=Number(clean(b));return Number.isFinite(an)&&Number.isFinite(bn)?an-bn:String(a).localeCompare(String(b),'zh-Hant',{numeric:true})}

async function batchWrite(c,rows,id){for(let i=0;i<rows.length;i+=450){const b=writeBatch(db);rows.slice(i,i+450).forEach(x=>b.set(doc(db,c,id(x)),{...x,updatedAt:serverTimestamp()},{merge:true}));await b.commit()}}
async function logImport(type,platform,fileName,total,written,skipped){await setDoc(doc(collection(db,'imports')),{type,platform,fileName,total,written,skipped,importedBy:state.user.email||'',importedAt:serverTimestamp()})}
async function loadHistory(){const s=await getDocs(query(collection(db,'imports'),orderBy('importedAt','desc'),limit(100)));$('historyRows').innerHTML=s.docs.map(d=>{const x=d.data();return`<tr><td>${x.importedAt?.toDate?x.importedAt.toDate().toLocaleString('zh-TW'):''}</td><td>${esc(x.type)}</td><td>${esc(x.platform)}</td><td>${esc(x.fileName)}</td><td>${fmt(x.total)}</td><td>${fmt(x.written)}</td><td>${fmt(x.skipped)}</td><td>${esc(x.importedBy)}</td></tr>`}).join('')}
function chart(id,type,labels,datasets){state.charts[id]?.destroy();state.charts[id]=new Chart($(id),{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false}})}
function month(t){const d=t?.toDate?t.toDate():new Date(t);return monthFromDate(d)}function monthFromDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}function fdLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function pick(o,n){for(const k of n)if(o[k]!==undefined&&String(o[k]).trim()!=='')return String(o[k]).trim();return''}
function parseDate(v){const raw=String(v||'').trim();if(!raw)throw new Error('日期欄位為空');const jp=raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);if(jp)return new Date(+jp[1],+jp[2]-1,+jp[3]);const s=raw.replace(/\./g,'/').replace(/-/g,'/'),m=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);const d=new Date(raw);if(isNaN(d))throw new Error('無法辨識日期：'+raw);return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function parseRakutenAdDate(v){const s=String(v||'').trim(),m=s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);return parseDate(v)}
function safe(s){return String(s).replace(/[\/#?\[\]]/g,'_').slice(0,1400)}function num(v){const n=Number(String(v??'').replace(/[¥￥円,\s]/g,'').replace(/[^\d.-]/g,''));return isFinite(n)?n:0}function fmt(v){return new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Number(v)||0)}function yen(v){return new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(Number(v)||0)}function twd(v){return new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0}).format(Number(v)||0)}function pct(v){return `${fmt(v)}%`}function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
