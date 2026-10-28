
const state = {
  page:"home", cropId:"wheat", lang:"en", user:null,
  savedCrops:["wheat","potato","mustard"], savedMandis:["m1","m3"],
  notifications:[
    {id:"n-1",title:"Rain Expected Tomorrow in Lucknow",category:"Weather Alerts",message:"Scattered rainfall is forecasted tomorrow. Postpone scheduled foliar pesticide and Urea sprays by 48 hours.",time:"2 hours ago",isRead:false,priority:"urgent",actionTarget:"weather"},
    {id:"n-2",title:"Wheat Price Increased by ₹40 / Quintal",category:"Mandi Price Updates",message:"Modal price of Wheat at Lucknow APMC reached ₹2,420/q today.",time:"4 hours ago",isRead:false,priority:"normal",actionTarget:"mandi"},
    {id:"n-3",title:"PM-KISAN 18th Installment Update",category:"Government Scheme Updates",message:"Ensure your Aadhaar is linked to your bank account and land records are verified.",time:"1 day ago",isRead:true,priority:"normal",actionTarget:"schemes"},
    {id:"n-4",title:"Timely Crown Root Initiation (CRI) Advisory",category:"Crop Care Reminders",message:"If your wheat was sown 21 days ago, schedule the 1st light irrigation immediately.",time:"2 days ago",isRead:true,priority:"normal",actionTarget:"crops"}
  ],
  userCrops:[
    {id:"uc-1",cropId:"wheat",cropName:"Wheat (DBW 187)",variety:"Karan Vandana (DBW 187)",sowingDate:"2026-11-10",acreage:2.5,soilType:"Alluvial Loam",expectedHarvest:"April 2027",healthStatus:"Healthy"},
    {id:"uc-2",cropId:"mustard",cropName:"Mustard (Pusa Bold)",variety:"Pusa Bold (NRCHB 101)",sowingDate:"2026-10-15",acreage:1,soilType:"Sandy Loam",expectedHarvest:"March 2027",healthStatus:"Needs Attention"},
    {id:"uc-3",cropId:"potato",cropName:"Potato (Kufri Pukhraj)",variety:"Kufri Pukhraj",sowingDate:"2026-10-22",acreage:1,soilType:"Sandy Loam",expectedHarvest:"January 2027",healthStatus:"Healthy"}
  ],
  isSearch:false, isAuth:false, authMode:"login", modalSearch:"", modalAuth:"login"
};

state.user = null;  // set by /api/auth/me or login

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const arr=v=>Array.isArray(v)?v:[];
function navigate(page,cropId){state.page=page;if(cropId)state.cropId=cropId;window.scrollTo({top:0,behavior:"smooth"});render();}
function pill(label,active,onclick){return `<button class="pill ${active?"active":""}" onclick="${onclick}">${esc(label)}</button>`}
function card(html,cls=""){return `<div class="card ${cls}">${html}</div>`}
function list(items){return `<ul class="list">${arr(items).map(x=>`<li>${esc(typeof x==="object"?JSON.stringify(x):x)}</li>`).join("")}</ul>`}
function generic(obj){return `<div class="grid">${Object.entries(obj||{}).map(([k,v])=>`<div><div class="tiny muted bold">${esc(k.replace(/([A-Z])/g," $1"))}</div>${Array.isArray(v)?list(v):(v&&typeof v==="object"?generic(v):`<div>${esc(v)}</div>`)}</div>`).join("")}</div>`}
function shell(title,hindi,content,right=""){return `<div class="shell"><div class="shell-head"><div><h1>${esc(title)}</h1>${hindi?`<div class="hindi">${esc(hindi)}</div>`:""}</div>${right}</div>${content}</div>`}

function navbar(){
  const links=[["home","Home"],["crops","Crop Guide"],["mandi","Mandi Prices"],["weather","Weather"],["schemes","Government Schemes"],["ai-sathi","AI Sathi"],["crop-doctor","Crop Doctor"]];
  const unread=state.notifications.filter(n=>!n.isRead).length;
  return `<div class="topbar"><div class="container"><span>🟢 Free Kisan Call Centre Helpline:</span><a href="tel:18001801551">📞 1800-180-1551 (6 AM - 10 PM)</a></div></div>
  <header class="nav"><div class="container nav-main">
    <a class="brand" href="#" onclick="navigate('home');return false"><span class="brand-mark">🌾</span>Krishi<span>Sathi</span></a>
    <nav class="nav-links">${links.map(([id,label])=>`<button class="${state.page===id?"active":""}" onclick="navigate('${id}')">${label}</button>`).join("")}</nav>
    <div class="nav-actions">
      <button class="icon-btn" onclick="openSearch()">🔎 <span class="desktop-only">Search</span></button>
      <button class="icon-btn" onclick="toggleNotifications()">🔔 ${unread?`<b>${unread}</b>`:""}</button>
      <button class="icon-btn lang-btn" onclick="toggleLang()">EN/हिं</button>
      ${state.user?`<button class="user-btn" onclick="navigate('dashboard')">👤 ${esc(state.user.name.split(" ")[0])}</button>`:`<button class="user-btn" onclick="openAuth('login')">Sign In</button>`}
      <button class="icon-btn hamb" onclick="mobileNav()">☰</button>
    </div>
  </div></header>
  <div id="notification-panel"></div>`;
}

function footer(){
 return `<footer class="footer"><div class="container"><div class="footer-grid">
 <div><div class="brand" style="color:white"><span class="brand-mark">🌾</span>Krishi<span>Sathi</span></div><p class="small" style="color:#a8a29e">Your Digital Companion for Smarter Farming. AI-powered agricultural guidance for Indian farmers.</p><div class="card" style="background:#292524;border-color:#44403c;color:white"><b>Kisan Toll-Free Call Centre</b><br><a href="tel:18001801551">1800-180-1551 (All 7 Days)</a></div></div>
 <div><h4>Farmer Services</h4>${[["crops","Crop Guide & Advisory"],["mandi","Mandi Prices & Bhav"],["weather","Farming Weather Alerts"],["crop-doctor","AI Crop Doctor"],["schemes","Government Schemes"],["soil","Soil & Fertilizer"]].map(x=>`<button onclick="navigate('${x[0]}')">${x[1]}</button>`).join("")}</div>
 <div><h4>Planning & Support</h4>${[["calendar","Agricultural Calendar"],["tips","Organic & Modern Tips"],["ai-sathi","AI Krishi Sathi Chat"],["dashboard","Farmer Dashboard"]].map(x=>`<button onclick="navigate('${x[0]}')">${x[1]}</button>`).join("")}</div>
 <div><h4>Official Portals</h4>${[["https://pmkisan.gov.in","PM-KISAN Portal"],["https://pmfby.gov.in","PM Fasal Bima"],["https://enam.gov.in","e-NAM Mandi"],["https://soilhealth.dac.gov.in","Soil Health Card"],["https://icar.org.in","ICAR"]].map(x=>`<a target="_blank" href="${x[0]}">${x[1]} ↗</a>`).join("")}</div>
 </div><div class="footer-bottom"><span>© 2026 KrishiSathi. All rights reserved.</span><span>Made with ♥ for Indian Farmers</span></div></div></footer>`;
}

function home(){
 const top=(window.CROPS_DATA||[]).slice(0,4);
 const mandi=(window.MANDI_PRICES_DATA||[]).slice(0,4);
 return `<div class="container" style="padding-top:24px"><section class="hero"><div class="tag" style="background:#ffffff20;color:#d1fae5">🌱 Indian Agriculture Knowledge Platform</div><h1>Smarter Farming Starts With Better Information.</h1><p>Weather, mandi prices, crop guides, government schemes, soil guidance and AI-powered crop diagnosis — all in one place.</p><div class="hero-actions"><button class="btn btn-light" onclick="navigate('ai-sathi')">🤖 Ask AI Krishi Sathi</button><button class="btn btn-light" onclick="navigate('crop-doctor')">🩺 Scan Crop</button><button class="btn btn-light" onclick="navigate('crops')">🌱 Explore Crops</button></div></section>
 <div class="section-title"><h2>Farmer Services</h2><div class="muted small">Everything you need for daily farm decisions</div></div>
 <div class="grid grid-3">${[
 ["🌦️","Weather Updates","Current conditions and farming-related alerts.","weather"],
 ["💰","Mandi Prices","Compare crop prices across markets and mandis.","mandi"],
 ["🌱","Crop Guide","Sowing, irrigation, fertilizer, diseases and harvest advice.","crops"],
 ["🩺","Crop Doctor","Upload a crop image and check possible disease conditions.","crop-doctor"],
 ["🏛️","Government Schemes","Benefits, eligibility and application guidance.","schemes"],
 ["🧪","Soil & Fertilizer","Understand soil types, nutrients and fertilizer basics.","soil"],
 ["📅","Farming Calendar","Month-wise sowing, irrigation and crop-care planning.","calendar"],
 ["💡","Farming Tips","Practical organic and modern farming tips.","tips"],
 ["🤖","AI Sathi","Ask questions in natural language about your farm.","ai-sathi"]
 ].map(s=>`<div class="service"><div class="emoji">${s[0]}</div><h3>${s[1]}</h3><p>${s[2]}</p><button class="btn btn-green" onclick="navigate('${s[3]}')">Open →</button></div>`).join("")}</div>
 <div class="section-title"><h2>Today's Mandi Snapshot</h2><div class="muted small">Demo data — verify locally before selling</div></div>
 ${card(`<div class="table-wrap"><table class="table"><thead><tr><th>Crop</th><th>Mandi</th><th>Modal</th><th>Change</th></tr></thead><tbody>${mandi.map(m=>`<tr><td><b>${esc(m.crop)}</b></td><td>${esc(m.mandi)}</td><td>₹${m.modalPrice}</td><td class="${m.trend==='up'?'success':m.trend==='down'?'danger':''}">${m.trend==='up'?'▲':'▼'} ₹${m.changeAmount}</td></tr>`).join("")}</tbody></table></div>`)}
 <div class="section-title"><h2>Featured Crops</h2></div><div class="grid grid-4">${top.map(c=>`<div class="card"><div class="bold">${esc(c.name)} <span class="muted">${esc(c.hindiName)}</span></div><div class="tiny muted">${esc(c.season)} · ${esc(c.category)}</div><p class="small">${esc(c.overview||"")}</p><button class="btn btn-green" onclick="navigate('crop-detail','${c.id}')">View Guide</button></div>`).join("")}</div>
 </div>`;
}

function cropsPage(){
 let q="",cat="All",season="All";
 const renderList=()=>{
  const rows=(window.CROPS_DATA||[]).filter(c=>(!q||(`${c.name} ${c.hindiName} ${(c.commonDiseases||[]).join(" ")}`).toLowerCase().includes(q.toLowerCase()))&&(cat==="All"||c.category===cat)&&(season==="All"||c.season===season));
  const html=rows.map(c=>`<div class="card crop-card"><img class="crop-img" src="${esc(c.image)}" alt="${esc(c.name)}"><div class="crop-body"><div><span class="tag">${esc(c.season)}</span><span class="tag">${esc(c.category)}</span><button style="float:right" class="icon-btn" onclick="toggleCrop('${c.id}')">${state.savedCrops.includes(c.id)?"★":"☆"}</button></div><h2>${esc(c.name)} <span class="muted">${esc(c.hindiName)}</span></h2><p class="small muted">${esc(c.overview)}</p><div class="kv"><div><b>Best Sowing</b>${esc(c.bestSowingTime)}</div><div><b>Soil</b>${esc(c.soilRequirement)}</div><div><b>Climate</b>${esc(c.climate)}</div><div><b>Seed</b>${esc(c.seedRequirement)}</div><div><b>Irrigation</b>${esc(c.irrigation)}</div><div><b>Fertilizer</b>${esc(c.fertilizerGuidance)}</div></div><p class="small"><b>Diseases:</b> ${(c.commonDiseases||[]).map(d=>`<span class="tag red">${esc(d)}</span>`).join("")}</p><button class="btn btn-green" onclick="navigate('crop-detail','${c.id}')">View Full Guide →</button></div></div>`).join("");
  $("#crop-list").innerHTML=rows||`<div class="empty">No crops found.</div>`;$("#crop-count").textContent=`Showing ${rows?rows.split('crop-card').length-1:0} of ${CROPS_DATA.length} Crops`;
 };
 const categories=["All","Cereals","Pulses","Oilseeds","Vegetables","Commercial"], seasons=["All","Rabi","Kharif","Zaid","Whole Year"];
 const content=`<div class="card" style="margin-bottom:18px"><div style="display:flex;gap:10px;flex-wrap:wrap"><input id="crop-q" class="input" style="flex:1;min-width:240px" placeholder="Search crop name or disease..."><span id="crop-count" class="small muted"></span></div><hr style="border:0;border-top:1px solid #f0f0ee;margin:15px 0"><div class="pills"><b class="tiny muted">Category:</b>${categories.map(x=>pill(x,x===cat,`setCropFilter('cat','${x}')`)).join("")}</div><div class="pills" style="margin-top:8px"><b class="tiny muted">Season:</b>${seasons.map(x=>pill(x,x===season,`setCropFilter('season','${x}')`)).join("")}</div></div><div id="crop-list" class="grid grid-2"></div>`;
 const page=shell("Indian Crop Cultivation Guide","विस्तृत फसल मार्गदर्शिका",`<div class="hero" style="margin-bottom:18px;padding:30px"><h1 style="font-size:34px">Indian Crop Cultivation Guide</h1><p>Detailed agronomic manuals for major crops — sowing, seed rate, fertilizer, irrigation, disease management and harvesting.</p></div>${content}`);
 setTimeout(()=>{$("#crop-q").oninput=e=>{q=e.target.value;renderList()};window._cropFilter=(k,v)=>{if(k==="cat")cat=v;else season=v;renderList()};renderList()},0);
 return page;
}
window.setCropFilter=(k,v)=>window._cropFilter&&window._cropFilter(k,v);

function cropDetail(){
 const c=(window.CROPS_DATA||[]).find(x=>x.id===state.cropId);
 if(!c)return shell("Crop not found","",`<button class="btn btn-green" onclick="navigate('crops')">Back to Crop Guide</button>`);
 const {id,name,hindiName,...rest}=c;
 return shell(name,hindiName,`<div style="display:flex;gap:8px;margin-bottom:14px"><button class="btn btn-light" onclick="navigate('crops')">← Crop Guide</button><button class="btn btn-green" onclick="toggleCrop('${id}')">${state.savedCrops.includes(id)?"★ Saved":"☆ Save crop"}</button></div>${card(generic(rest))}`);
}

function mandi(){
 let q="",st="All",sel=null;
 const renderRows=()=>{
  const rows=(window.MANDI_PRICES_DATA||[]).filter(m=>(st==="All"||m.state===st)&&(`${m.crop} ${m.mandi} ${m.district}`).toLowerCase().includes(q.toLowerCase()));
  $("#mandi-body").innerHTML=rows.map(m=>`<tr class="clickable" onclick="selectMandi('${m.id}')"><td><b>${esc(m.crop)}</b></td><td>${esc(m.mandi)}, ${esc(m.district)}</td><td>₹${m.minPrice}</td><td>₹${m.maxPrice}</td><td><b>₹${m.modalPrice}</b></td><td class="${m.trend==='up'?'success':m.trend==='down'?'danger':''}">${m.trend==='up'?'▲':m.trend==='down'?'▼':'–'} ${m.changeAmount}</td><td><button class="icon-btn" onclick="event.stopPropagation();toggleMandi('${m.id}')">${state.savedMandis.includes(m.id)?"★":"☆"}</button></td></tr>`).join("")||`<tr><td colspan="7" class="empty">No results.</td></tr>`;
 };
 const states=["All",...new Set((window.MANDI_PRICES_DATA||[]).map(m=>m.state))];
 const content=`<div class="notice">Demo data — not live Agmarknet prices. Verify at your local APMC before selling.</div><div class="card" style="margin-bottom:15px"><div style="display:flex;gap:10px;flex-wrap:wrap"><input id="mandi-q" class="input" style="flex:1;min-width:220px" placeholder="Search crop / mandi"><select id="mandi-state" class="select" style="width:220px">${states.map(x=>`<option>${esc(x)}</option>`).join("")}</select></div></div><div id="mandi-trend"></div><div class="table-wrap"><table class="table"><thead><tr><th>Crop</th><th>Mandi</th><th>Min</th><th>Max</th><th>Modal</th><th>Change</th><th></th></tr></thead><tbody id="mandi-body"></tbody></table></div>`;
 const page=shell("Mandi Prices","मंडी भाव",content);
 setTimeout(()=>{$("#mandi-q").oninput=e=>{q=e.target.value;renderRows()};$("#mandi-state").onchange=e=>{st=e.target.value;renderRows()};window._selectMandi=id=>{sel=id;const hist=(window.MANDI_TREND_HISTORY||{})[id]||[];$("#mandi-trend").innerHTML=hist.length?card(`<b>7-day trend</b><div class="chart">${hist.map(x=>`<div class="bar" style="height:${Math.max(15,((x.modalPrice-Math.min(...hist.map(h=>h.modalPrice)))/(Math.max(...hist.map(h=>h.modalPrice))-Math.min(...hist.map(h=>h.modalPrice))||1))*150+25)}px"><span>₹${x.modalPrice}</span></div>`).join("")}</div>`):""};window.selectMandi=id=>window._selectMandi(id);renderRows()},0);
 return page;
}

const DISTRICT_COORDS={Lucknow:[26.85,80.95],Ayodhya:[26.80,82.20],Varanasi:[25.32,83.01],Kanpur:[26.45,80.35],Ludhiana:[30.90,75.85],Amritsar:[31.63,74.87],Delhi:[28.61,77.21],Jaipur:[26.91,75.79],Indore:[22.72,75.86],Bhopal:[23.26,77.41],Patna:[25.59,85.14],Kolkata:[22.57,88.36],Nagpur:[21.15,79.09],Pune:[18.52,73.86],Ahmedabad:[23.02,72.57],Hyderabad:[17.39,78.49]};
const WMO_HI={"clear sky":"साफ़ आसमान","mainly clear":"ज़्यादातर साफ़","partly cloudy":"आंशिक बादल","overcast":"बादल छाए","fog":"कोहरा","light drizzle":"हल्की फुहार","drizzle":"फुहार","heavy drizzle":"तेज़ फुहार","light rain":"हल्की बारिश","rain":"बारिश","heavy rain":"तेज़ बारिश","light snow":"हल्की बर्फ़बारी","snow":"बर्फ़बारी","heavy snow":"भारी बर्फ़बारी","rain showers":"बारिश की बौछारें","violent showers":"तेज़ बौछारें","thunderstorm":"आंधी-बारिश","thunderstorm with hail":"ओलों के साथ आंधी-बारिश","mixed":"मिला-जुला"};
function weather(){
 let k="Lucknow",live=null,msg="",coords=null,token=0;
 const names=[...new Set([...Object.keys(DISTRICT_COORDS),...Object.keys(window.DISTRICT_WEATHER||{})])];
 const hi=()=>state.lang==="hi";
 const T=(en,h)=>hi()?h:en;
 const cond=c=>hi()?(WMO_HI[String(c).toLowerCase()]||c):c;
 const draw=()=>{const w=live||(window.DISTRICT_WEATHER||{})[k];const el=$("#weather-content");if(!el)return;$("#weather-msg").textContent=msg;
  if(!w){el.innerHTML=card(`<p>${T("Weather not available for this place right now.","इस जगह का मौसम अभी उपलब्ध नहीं है।")}</p>`);return}
  el.innerHTML=`${card(`<div class="stat">${esc(w.current.temp)}°C</div><b>${esc(cond(w.current.condition))}</b><p class="small muted">${T("Feels","महसूस")} ${esc(w.current.feelsLike)}° · ${T("Humidity","नमी")} ${esc(w.current.humidity)}% · ${T("Wind","हवा")} ${esc(w.current.windSpeed)} km/h · ${T("Rain","बारिश")} ${esc(w.current.rainProbability)}% · UV ${esc(w.current.uvIndex)}</p>`)}<div style="margin-top:15px">${(w.alerts||[]).map(a=>`<div class="alert ${a.severity==='high'?'high':''}"><b>${esc(a.title)}</b><div class="small">${esc(a.message)}</div></div>`).join("")}</div><h2>${T("Forecast","पूर्वानुमान")}</h2><div class="forecast">${(w.forecast||[]).map(d=>card(`<b>${esc(d.day)}</b><div class="tiny muted">${esc(d.date)}</div><div class="small">${esc(cond(d.condition))}</div><b>${esc(d.tempMax)}° / ${esc(d.tempMin)}°</b><div class="tiny" style="color:#0369a1">${T("Rain","बारिश")} ${esc(d.rainProbability)}%</div>`)).join("")}</div>`};
 const load=async()=>{const my=++token;const c=coords||DISTRICT_COORDS[k];live=null;
  if(!c){msg=T("Showing sample data for this place","इस जगह का नमूना डेटा दिखा रहे हैं");draw();return}
  msg=T("Loading live weather…","लाइव मौसम आ रहा है…");draw();
  try{const r=await fetch(`/api/weather?lat=${c[0]}&lon=${c[1]}`);const d=await r.json();if(my!==token)return;if(!r.ok||!d.current)throw new Error("x");live=d;msg=T("Live · Open-Meteo · updated ","लाइव · Open-Meteo · अपडेट ")+new Date(d.fetchedAt).toLocaleTimeString()}
  catch(e){if(my!==token)return;live=null;msg=(window.DISTRICT_WEATHER||{})[k]?T("Live weather unavailable - showing sample data","लाइव मौसम नहीं मिला - नमूना डेटा दिखा रहे हैं"):T("Live weather unavailable","लाइव मौसम नहीं मिला")}
  draw()};
 const page=shell("Weather","मौसम",`<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><select id="weather-k" class="select" style="max-width:260px">${names.map(x=>`<option>${esc(x)}</option>`).join("")}</select><button id="weather-loc" class="btn btn-light">📍 ${T("Use my location","मेरी लोकेशन")}</button></div><div id="weather-msg" class="tiny muted" style="margin-bottom:10px"></div><div id="weather-content"></div>`);
 setTimeout(()=>{$("#weather-k").value=k;$("#weather-k").onchange=e=>{k=e.target.value;coords=null;load()};
  $("#weather-loc").onclick=()=>{if(!navigator.geolocation){msg=T("Location not supported in this browser","इस ब्राउज़र में लोकेशन उपलब्ध नहीं");draw();return}navigator.geolocation.getCurrentPosition(p=>{coords=[p.coords.latitude,p.coords.longitude];load()},()=>{msg=T("Location permission denied","लोकेशन की अनुमति नहीं मिली");draw()},{timeout:10000})};
  load()},0);return page;
}

function schemeInfo(s){const src=(s.sources||[]).filter(x=>/^https?:\/\//.test(x.uri)).slice(0,3).map(x=>`<a href="${esc(x.uri)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a>`).join(" · ");
 const d=s.lastUpdated||s.lastChecked;return `<div class="tiny muted" style="margin-top:10px">${s.autoAdded?"🆕 Auto-found online - official website par zaroor verify karein. ":""}${d?"Auto-updated: "+esc(String(d).slice(0,10))+". ":""}${s.recentChanges?esc(s.recentChanges)+" ":""}${src?"Sources: "+src:""}</div>`}
function schemes(){
 let cat="All",open=null;const cats=["All",...new Set((window.GOVERNMENT_SCHEMES_DATA||[]).map(s=>s.category))];
 const draw=()=>{const list=(window.GOVERNMENT_SCHEMES_DATA||[]).filter(s=>cat==="All"||s.category===cat);$("#scheme-list").innerHTML=list.map(s=>card(`<div class="bold" style="font-size:18px">${esc(s.name)} <span class="success small">${esc(s.hindiName)}</span></div><div class="tiny muted">${esc(s.category)} · ${esc(s.authority)}${s.autoAdded?" · 🆕 Auto-found":""}</div><p class="small">${esc(s.overview)}</p><button class="btn btn-light" onclick="toggleScheme('${s.id}')">${open===s.id?"Hide details":"Details"}</button>${open===s.id?`<div style="margin-top:12px"><b>Benefits</b>${list(s.benefits)}<b>Eligibility</b>${list(s.eligibility)}<b>Documents</b>${list(s.requiredDocuments)}<b>How to apply</b>${list(s.applicationProcess)}<a class="btn btn-green" style="display:inline-block;margin-top:8px;text-decoration:none" target="_blank" rel="noopener noreferrer" href="${esc(s.officialWebsite)}">Official website ↗</a>${schemeInfo(s)}</div>`:""}`)).join("")};
 const page=shell("Government Schemes","सरकारी योजनाएं",`${(window.SCHEMES_META&&window.SCHEMES_META.lastRun)?`<div class="notice">Yojanaon ki jaankari apne aap update hoti rehti hai. Last auto-update: ${esc(String(window.SCHEMES_META.lastRun).slice(0,10))} (${esc(window.SCHEMES_META.summary||"")}). Apply karne se pehle official website check karein.</div>`:`<div class="notice">Yojanaon ki jaankari periodically auto-update hoti hai (server par Gemini key chalu hone par). Apply karne se pehle official website check karein.</div>`}<div class="pills" id="scheme-cats">${cats.map(x=>pill(x,x===cat,`setSchemeCat('${x}')`)).join("")}</div><div id="scheme-list" class="grid grid-2"></div>`);
 setTimeout(()=>{window._schemeCat=x=>{cat=x;draw()};window.setSchemeCat=x=>window._schemeCat(x);window.toggleScheme=x=>{open=open===x?null:x;draw()};draw()},0);return page;
}

function soil(){
 return shell("Soil & Fertilizer","मिट्टी और पोषण",`<div class="grid grid-2">${(window.SOIL_TYPES||[]).map(s=>card(`<div class="bold">${esc(s.name)}</div><div class="success small">${esc(s.hindiName)}</div><p class="small">${esc(s.characteristics)}</p><div class="kv"><div><b>pH</b>${esc(s.phRange)}</div><div><b>Water retention</b>${esc(s.waterRetention)}</div><div><b>Organic matter</b>${esc(s.organicMatterContent)}</div><div><b>Best crops</b>${esc((s.bestSuitedCrops||[]).join(", "))}</div></div><b>Management</b>${list(s.managementTips)}`)).join("")}</div><div class="section-title"><h2>NPK Explanation</h2></div>${card(generic(window.NPK_EXPLANATION||{}))}`);
}

function calendar(){
 const months=Object.keys(window.FARMING_CALENDAR_DATA||{});let m=months[new Date().getMonth()]||months[0];
 const draw=()=>{$("#cal-body").innerHTML=card(generic(window.FARMING_CALENDAR_DATA[m]||{}))};
 const page=shell("Farming Calendar","खेती कैलेंडर",`<div class="pills">${months.map(x=>pill(x,x===m,`setMonth('${x}')`)).join("")}</div><div id="cal-body"></div>`);
 setTimeout(()=>{window.setMonth=x=>{m=x;draw()};draw()},0);return page;
}

function tips(){
 const cats=["All",...new Set((window.FARMING_TIPS_DATA||[]).map(t=>t.category))];let cat="All";
 const draw=()=>{$("#tips-list").innerHTML=(window.FARMING_TIPS_DATA||[]).filter(t=>cat==="All"||t.category===cat).map(t=>card(`<div class="tiny success bold">${esc(t.category)}</div><h3>${esc(t.title)}</h3><p class="small">${esc(t.summary)}</p>${list(t.steps)}<p class="small"><b>Benefit:</b> ${esc(t.benefit)}</p>`)).join("")};
 const page=shell("Farming Tips","खेती के सुझाव",`<div class="pills">${cats.map(x=>pill(x,x===cat,`setTipCat('${x}')`)).join("")}</div><div id="tips-list" class="grid grid-2"></div>`);
 setTimeout(()=>{window.setTipCat=x=>{cat=x;draw()};draw()},0);return page;
}

function dashboard(){
 if(!state.user)return shell("Farmer Dashboard","",card(`<p>Dashboard dekhne ke liye login karein.</p><button class="btn btn-green" onclick="openAuth('login')">Login</button><button class="btn btn-light" onclick="demoLogin()">Demo login</button>`));
 const u=state.user, unread=state.notifications.filter(n=>!n.isRead).length;
 return shell(`Namaste, ${u.name}`,`${u.village||""}, ${u.district}, ${u.state} · ${u.landSizeAcres} acres`,`${card(`<div class="grid grid-3"><div><div class="stat">${u.userCrops.length}</div>My crops</div><div><div class="stat">${unread}</div>Unread alerts</div><div><button class="btn btn-red" onclick="logout()">Logout</button></div></div>`)}
 <h2>My Crops</h2><div class="grid grid-3">${u.userCrops.map(c=>card(`<div class="bold">${esc(c.cropName)}</div><div class="tiny">${c.acreage} acres · ${esc(c.soilType)}</div><div class="small">Sown ${esc(c.sowingDate)} → Harvest ${esc(c.expectedHarvest)}</div><div class="small bold ${c.healthStatus==="Healthy"?"success":"danger"}">${esc(c.healthStatus)}</div><button class="btn btn-light" onclick="navigate('crop-doctor')">Check disease</button> <button class="btn btn-red" onclick="removeUserCrop('${c.id}')">Remove</button>`)).join("")}</div>
 <div class="section-title"><h2>Alerts</h2><button class="btn btn-light" onclick="markAllRead()">Mark all read</button></div><div class="grid">${state.notifications.map(n=>`<div class="card ${n.isRead?"":"notice"}" onclick="notificationClick('${n.id}')"><b>${esc(n.title)}</b><div class="small">${esc(n.message)}</div><div class="tiny muted">${esc(n.time)} · ${esc(n.category)}</div></div>`).join("")}</div>`);
}

function aiSathi(){
 const msgs=state.aiMsgs||[GREETING];
 state.aiMsgs=msgs;
 const quick=["Gehun me peele patte kyu hote hain?","PM-KISAN ke liye apply kaise karein?","Rabi me sarson kab boyein?"];
 const page=shell("AI Krishi Sathi","एआई कृषि साथी",`<div id="chat" class="chat">${msgs.map(m=>`<div class="bubble ${m.role}">${m.role==="bot"?md(m.text):esc(m.text)}</div>`).join("")}<div id="chat-end"></div></div><div class="pills" style="margin-top:10px">${quick.map(q=>`<button class="pill" onclick="sendChat(${JSON.stringify(q)})">${esc(q)}</button>`).join("")}</div><div class="chatbar"><input id="chat-input" class="input" placeholder="Apna sawal likhein…"><button class="btn btn-green" onclick="sendChat()">Send</button></div>`,`${langSelect(true)}<button class="btn" onclick="clearChat()">Clear chat</button>`);
 setTimeout(()=>{const el=$("#chat-input");if(el)el.onkeydown=e=>{if(e.key==="Enter")sendChat()};const ch=$("#chat");if(ch)ch.scrollTop=ch.scrollHeight},0);return page;
}
function clientId(){try{let id=localStorage.getItem("ks_client_id");if(!id){id="ks"+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem("ks_client_id",id)}return id}catch(e){return "anonymous"}}
function HDR(){return {"Content-Type":"application/json","X-Client-Id":clientId()}}
const GREETING={role:"bot",text:"Namaste! Main Krishi Sathi hoon. Fasal, khaad, mausam ya yojana — kuch bhi poochhiye."};
async function loadHistory(){try{const r=await fetch("/api/history",{headers:HDR()});const d=await r.json();if(d.messages&&d.messages.length&&!state.aiMsgs){state.aiMsgs=[GREETING,...d.messages.map(m=>({role:m.role,text:m.text}))];render()}}catch(e){}}
async function clearChat(){if(!confirm("Poori chat history delete karein?"))return;try{await fetch("/api/history",{method:"DELETE",headers:HDR()})}catch(e){}state.aiMsgs=[GREETING];render()}
async function loadDiagHistory(){const el=$("#doctor-history");if(!el)return;try{const r=await fetch("/api/diagnoses",{headers:HDR()});const d=await r.json();if(!d.items||!d.items.length){el.innerHTML="";return}el.innerHTML=card(`<h3>Pichhli jaanch (History)</h3>${d.items.map(x=>`<div class="small" style="padding:6px 0;border-bottom:1px solid #eee"><b>${esc(x.disease_name||"-")}</b> · ${esc(x.crop||"")} · ${x.confidence??"-"}% · ${esc(x.severity||"")}<br><span style="opacity:.6">${esc(x.created_at.replace("T"," "))}</span></div>`).join("")}`)}catch(e){}}

/* ---------- language selection for AI answers ---------- */
const LANG_LIST=["Hindi","English","Hinglish","Marathi","Gujarati","Punjabi","Bengali","Tamil","Telugu","Kannada","Malayalam","Odia","Urdu"];
const LANG_NATIVE={Hindi:"हिन्दी",English:"English",Hinglish:"Hinglish",Marathi:"मराठी",Gujarati:"ગુજરાતી",Punjabi:"ਪੰਜਾਬੀ",Bengali:"বাংলা",Tamil:"தமிழ்",Telugu:"తెలుగు",Kannada:"ಕನ್ನಡ",Malayalam:"മലയാളം",Odia:"ଓଡ଼ିଆ",Urdu:"اردو"};
function getAiLang(){try{return localStorage.getItem("ks_ai_lang")||"Hindi"}catch(e){return "Hindi"}}
function setAiLang(v){try{localStorage.setItem("ks_ai_lang",v)}catch(e){}}
function apiLang(){const v=getAiLang();return v==="Auto"?"":v}
function langSelect(withAuto){const cur=getAiLang();const opts=(withAuto?["Auto",...LANG_LIST]:LANG_LIST).map(l=>`<option value="${l}" ${l===cur?"selected":""}>${l==="Auto"?"Auto (jaisi bhasha mein poochho)":esc(LANG_NATIVE[l]+(LANG_NATIVE[l]!==l?" · "+l:""))}</option>`).join("");return `<select class="select" style="width:auto;display:inline-block;margin:0 8px 8px 0" title="Jawab ki bhasha / Answer language" onchange="setAiLang(this.value)">${opts}</select>`}
function toggleLang(){state.lang=state.lang==='en'?'hi':'en';setAiLang(state.lang==='hi'?'Hindi':'English');render()}
function diagCard(x){const L=Object.assign({symptoms:"Symptoms",possibleCauses:"Possible Causes",prevention:"Prevention",recommendedNextSteps:"Recommended Next Steps",expertAdvice:"Expert Advice",confidence:"Confidence",severity:"Severity"},(x&&typeof x.labels==="object"&&x.labels)||{});
 return card(`<h2>${esc(x.diseaseName)}</h2><i>${esc(x.scientificName)}</i><p>${esc(L.confidence)} <b>${esc(x.confidence)}%</b> · ${esc(L.severity)} <b>${esc(x.severityLabel||x.severity)}</b></p><h4>${esc(L.symptoms)}</h4>${list(x.symptoms)}<h4>${esc(L.possibleCauses)}</h4>${list(x.possibleCauses)}<h4>${esc(L.prevention)}</h4>${list(x.prevention)}<h4>${esc(L.recommendedNextSteps)}</h4>${list(x.recommendedNextSteps)}<h4>${esc(L.expertAdvice)}</h4><p class="small">${esc(x.expertAdvice)}</p>`)}

function md(t){return esc(t).replace(/\*\*(.*?)\*\*/g,"<b>$1</b>").replace(/^### (.*)$/gm,"<b>$1</b>").replace(/^- (.*)$/gm,"• $1").replace(/\n/g,"<br>")}
async function sendChat(q){const input=$("#chat-input");q=q||input?.value||"";if(!q.trim())return;state.aiMsgs=state.aiMsgs||[];state.aiMsgs.push({role:"user",text:q});render();try{const r=await fetch("/api/chat",{method:"POST",headers:HDR(),body:JSON.stringify({language:apiLang(),message:q,history:state.aiMsgs.map(m=>({sender:m.role==="user"?"user":"bot",text:m.text}))})});const d=await r.json();state.aiMsgs.push({role:"bot",text:d.reply||d.error||"Error"});}catch(e){state.aiMsgs.push({role:"bot",text:"Server se connect nahi ho paya."});}render()}

function cropDoctor(){
 const page=shell("Crop Doctor","क्रॉप डॉक्टर — पत्ती की फोटो से रोग पहचानें",`<div class="grid grid-2">${card(`${langSelect(false)}<input id="doctor-crop" class="input" placeholder="Crop name (e.g. Wheat)"><input id="doctor-file" style="margin-top:12px" type="file" accept="image/*"><div id="doctor-preview"></div><button id="doctor-run" class="btn btn-green" style="width:100%;margin-top:12px" disabled>Diagnose</button><div id="doctor-err" class="danger small"></div>`)}<div id="doctor-result"></div></div><div id="doctor-history"></div>`);
 setTimeout(()=>{
  loadDiagHistory();let img=null;const f=$("#doctor-file"),run=$("#doctor-run"),prev=$("#doctor-preview");
  f.onchange=()=>{const file=f.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{img=r.result;prev.innerHTML=`<img class="image-preview" src="${img}" alt="plant">`;run.disabled=false};r.readAsDataURL(file)};
  run.onclick=async()=>{if(!img)return;run.disabled=true;run.textContent="Analysing…";$("#doctor-err").textContent="";try{const crop=$("#doctor-crop").value;const r=await fetch("/api/diagnose",{method:"POST",headers:HDR(),body:JSON.stringify({imageBase64:img,mimeType:img.slice(5,img.indexOf(";")),cropName:crop,language:apiLang()||"Hindi"})});const d=await r.json();if(!d.data)throw new Error(d.error||"Diagnosis failed");const x=d.data;$("#doctor-result").innerHTML=diagCard(x)}catch(e){$("#doctor-err").textContent=e.message||"Server se connect nahi ho paya."}run.disabled=false;run.textContent="Diagnose";loadDiagHistory()};
 },0);return page;
}

let _sr=[],_srTimer=null,_srToken=0;
function localSearch(q){
 const toks=q.toLowerCase().split(/[\s,;]+/).filter(Boolean);if(!toks.length)return[];
 const idx=[];const add=(t,s,extra,a)=>idx.push({t,s,title:String(t).toLowerCase(),hay:(String(t)+" "+extra).toLowerCase(),a});
 (window.CROPS_DATA||[]).forEach(c=>add(`${c.name} (${c.hindiName})`,`Crop Guide • ${c.season}`,`${c.category} ${c.season} ${(c.commonDiseases||[]).join(" ")} ${c.soilRequirement||""} ${c.bestSowingTime||""}`,()=>navigate("crop-detail",c.id)));
 (window.GOVERNMENT_SCHEMES_DATA||[]).forEach(s=>add(s.name,`Government Scheme • ${s.authority}`,`${s.hindiName} ${s.category} ${s.overview} ${(s.benefits||[]).join(" ")}`,()=>navigate("schemes")));
 (window.FARMING_TIPS_DATA||[]).forEach(t=>add(t.title,`Farming Tip • ${t.category}`,`${t.summary} ${t.category}`,()=>navigate("tips")));
 (window.MANDI_PRICES_DATA||[]).forEach(m=>add(`${m.crop} in ${m.mandi}`,`Mandi Price • Modal ₹${m.modalPrice}`,`${m.state} ${m.district} ${m.mandi}`,()=>navigate("mandi")));
 (window.SOIL_TYPES||[]).forEach(s=>add(s.name,`Soil Guide • pH ${s.phRange}`,`${s.hindiName} ${s.characteristics}`,()=>navigate("soil")));
 add("Crop Doctor (AI Disease Detection)","Upload a plant image to check diseases","crop doctor disease scan diagnosis photo bimari rog",()=>navigate("crop-doctor"));
 add("Farming Weather Dashboard","7-day weather and alerts","weather forecast rain temperature alerts climate mausam",()=>navigate("weather"));
 add("AI Krishi Sathi Assistant","Ask farming questions","ai chatbot sathi assistant question advice sawal",()=>navigate("ai-sathi"));
 return idx.map(r=>{let sc=0;for(const t of toks){if(r.hay.includes(t)){sc+=1+(r.title.includes(t)?2:0)}else return null}return {...r,sc}}).filter(Boolean).sort((x,y)=>y.sc-x.sc);
}
function searchModal(){
 return `<div class="modal-bg" onclick="if(event.target===this)closeSearch()"><div class="modal"><div class="modal-body"><div style="display:flex;gap:8px"><input autofocus id="search-input" autocomplete="off" oninput="onSearchInput(this.value)" onkeydown="if(event.key==='Enter')fetchSearchDetails()" class="input" value="${esc(state.modalSearch)}" placeholder="Kuch bhi likhein - fasal, bimari, yojana, mandi... (poora sawal bhi chalega)"><button class="icon-btn" onclick="closeSearch()">✕</button></div><div id="sr-list"></div><div id="sr-details"></div></div></div></div>`;
}
function searchMounted(){const el=$("#search-input");if(!el)return;el.focus();try{el.setSelectionRange(el.value.length,el.value.length)}catch(e){}updateSearchResults()}
function setSearch(v){const el=$("#search-input");if(el)el.value=v;onSearchInput(v);if(el)el.focus()}
function onSearchInput(v){state.modalSearch=v;updateSearchResults();clearTimeout(_srTimer);
 const q=v.trim();if(q.length>=3&&localSearch(q).length===0){_srTimer=setTimeout(fetchSearchDetails,900)}else{const d=$("#sr-details");if(d&&!q)d.innerHTML=""}}
function updateSearchResults(){const box=$("#sr-list");if(!box)return;const q=(state.modalSearch||"").trim();
 if(!q){_sr=[];box.innerHTML=`<p class="tiny muted">Popular searches</p><div class="pills">${["Wheat","Yellow Leaves","PM-KISAN","Rice Blast","Lucknow Mandi","NPK Fertilizer","Mustard Sowing"].map(x=>`<button class="pill" onclick="setSearch('${x}')">${x}</button>`).join("")}</div>`;return}
 _sr=localSearch(q);
 box.innerHTML=`<div class="search-results">${_sr.slice(0,8).map((r,i)=>`<div class="result" onclick="openResult(${i})"><b>${esc(r.t)}</b><div class="tiny muted">${esc(r.s)}</div></div>`).join("")||`<div class="empty">App ke data mein "${esc(q)}" nahi mila.</div>`}</div><button class="btn btn-green" style="width:100%;margin-top:10px" onclick="fetchSearchDetails()">🔎 "${esc(q.length>40?q.slice(0,40)+"…":q)}" ki details fetch karo (AI + web)</button>`}
function openResult(i){const r=_sr[i];if(!r)return;closeSearch();r.a()}
async function fetchSearchDetails(){const q=(state.modalSearch||"").trim();const d=$("#sr-details");if(!d||q.length<2)return;clearTimeout(_srTimer);const my=++_srToken;
 d.innerHTML=`<div class="card" style="margin-top:12px"><p class="small muted">⏳ Details fetch ho rahi hain… (10-20 second lag sakte hain)</p></div>`;
 try{const body={query:q};const l=apiLang();if(l)body.language=l;const r=await fetch("/api/search-details",{method:"POST",headers:HDR(),body:JSON.stringify(body)});const x=await r.json();if(my!==_srToken)return;
  if(!r.ok||!x.reply){d.innerHTML=`<div class="card" style="margin-top:12px"><p class="danger small">${esc(x.error||"Details nahi mil payi.")}</p></div>`;return}
  const src=(x.sources||[]).filter(s=>/^https?:\/\//.test(s.uri)).map(s=>`<a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join(" · ");
  d.innerHTML=`<div class="card" style="margin-top:12px;max-height:45vh;overflow:auto"><div class="small">${md(x.reply)}</div>${src?`<p class="tiny muted" style="margin-top:10px">Sources: ${src}</p>`:""}<p class="tiny muted" style="margin-top:8px">${x.grounded?"AI ne web search se ye jawab banaya hai. ":"Web search nahi chali - jawab purana ho sakta hai. "}Zaroori kaam se pehle official website ya KVK se confirm karein.</p></div>`;
 }catch(e){if(my!==_srToken)return;d.innerHTML=`<div class="card" style="margin-top:12px"><p class="danger small">Server se connect nahi ho paya.</p></div>`}}
const AUTH_T={"English": ["Login", "Register", "Sign In to Your Account", "Enter your registered email or phone and password to continue", "Email or phone", "Password", "Enter your password", "Login →", "Don't have an account?", "Register free", "Create Your Account", "It is free and takes less than a minute", "Full name", "Your name", "At least 6 characters", "State", "District", "Create account →", "Already registered?", "Press ESC or click outside to dismiss", "Cancel", "Farmer Login"], "Hindi": ["लॉगिन", "रजिस्टर", "अपने खाते में साइन इन करें", "जारी रखने के लिए अपना ईमेल या फ़ोन और पासवर्ड डालें", "ईमेल या फ़ोन", "पासवर्ड", "अपना पासवर्ड डालें", "लॉगिन →", "खाता नहीं है?", "मुफ़्त रजिस्टर करें", "अपना खाता बनाएं", "यह मुफ़्त है और एक मिनट से कम लगता है", "पूरा नाम", "आपका नाम", "कम से कम 6 अक्षर", "राज्य", "ज़िला", "खाता बनाएं →", "पहले से रजिस्टर हैं?", "बंद करने के लिए ESC दबाएं या बाहर क्लिक करें", "रद्द करें", "किसान लॉगिन"], "Hinglish": ["Login", "Register", "Apne account mein Sign In karein", "Aage badhne ke liye email ya phone aur password daalein", "Email ya phone", "Password", "Apna password daalein", "Login →", "Account nahi hai?", "Free register karein", "Apna account banayein", "Free hai aur 1 minute se kam lagta hai", "Poora naam", "Aapka naam", "Kam se kam 6 akshar", "Rajya", "Zila", "Account banayein →", "Pehle se registered hain?", "Band karne ke liye ESC dabayein ya bahar click karein", "Cancel", "Kisan Login"], "Marathi": ["लॉगिन", "नोंदणी", "तुमच्या खात्यात साइन इन करा", "पुढे जाण्यासाठी ईमेल किंवा फोन आणि पासवर्ड टाका", "ईमेल किंवा फोन", "पासवर्ड", "तुमचा पासवर्ड टाका", "लॉगिन →", "खाते नाही?", "मोफत नोंदणी करा", "तुमचे खाते तयार करा", "हे मोफत आहे आणि एका मिनिटापेक्षा कमी वेळ लागतो", "पूर्ण नाव", "तुमचे नाव", "किमान 6 अक्षरे", "राज्य", "जिल्हा", "खाते तयार करा →", "आधीच नोंदणी केली आहे?", "बंद करण्यासाठी ESC दाबा किंवा बाहेर क्लिक करा", "रद्द करा", "शेतकरी लॉगिन"], "Gujarati": ["લૉગિન", "નોંધણી", "તમારા ખાતામાં સાઇન ઇન કરો", "આગળ વધવા માટે ઈમેલ અથવા ફોન અને પાસવર્ડ દાખલ કરો", "ઈમેલ અથવા ફોન", "પાસવર્ડ", "તમારો પાસવર્ડ દાખલ કરો", "લૉગિન →", "ખાતું નથી?", "મફત નોંધણી કરો", "તમારું ખાતું બનાવો", "આ મફત છે અને એક મિનિટથી ઓછો સમય લાગે છે", "પૂરું નામ", "તમારું નામ", "ઓછામાં ઓછા 6 અક્ષર", "રાજ્ય", "જિલ્લો", "ખાતું બનાવો →", "પહેલેથી નોંધાયેલા છો?", "બંધ કરવા ESC દબાવો અથવા બહાર ક્લિક કરો", "રદ કરો", "ખેડૂત લૉગિન"], "Punjabi": ["ਲਾਗਇਨ", "ਰਜਿਸਟਰ", "ਆਪਣੇ ਖਾਤੇ ਵਿੱਚ ਸਾਈਨ ਇਨ ਕਰੋ", "ਅੱਗੇ ਵਧਣ ਲਈ ਈਮੇਲ ਜਾਂ ਫ਼ੋਨ ਅਤੇ ਪਾਸਵਰਡ ਪਾਓ", "ਈਮੇਲ ਜਾਂ ਫ਼ੋਨ", "ਪਾਸਵਰਡ", "ਆਪਣਾ ਪਾਸਵਰਡ ਪਾਓ", "ਲਾਗਇਨ →", "ਖਾਤਾ ਨਹੀਂ ਹੈ?", "ਮੁਫ਼ਤ ਰਜਿਸਟਰ ਕਰੋ", "ਆਪਣਾ ਖਾਤਾ ਬਣਾਓ", "ਇਹ ਮੁਫ਼ਤ ਹੈ ਅਤੇ ਇੱਕ ਮਿੰਟ ਤੋਂ ਘੱਟ ਲੱਗਦਾ ਹੈ", "ਪੂਰਾ ਨਾਮ", "ਤੁਹਾਡਾ ਨਾਮ", "ਘੱਟੋ-ਘੱਟ 6 ਅੱਖਰ", "ਰਾਜ", "ਜ਼ਿਲ੍ਹਾ", "ਖਾਤਾ ਬਣਾਓ →", "ਪਹਿਲਾਂ ਹੀ ਰਜਿਸਟਰ ਹੋ?", "ਬੰਦ ਕਰਨ ਲਈ ESC ਦਬਾਓ ਜਾਂ ਬਾਹਰ ਕਲਿੱਕ ਕਰੋ", "ਰੱਦ ਕਰੋ", "ਕਿਸਾਨ ਲਾਗਇਨ"], "Bengali": ["লগইন", "নিবন্ধন", "আপনার অ্যাকাউন্টে সাইন ইন করুন", "এগিয়ে যেতে ইমেল বা ফোন এবং পাসওয়ার্ড দিন", "ইমেল বা ফোন", "পাসওয়ার্ড", "আপনার পাসওয়ার্ড দিন", "লগইন →", "অ্যাকাউন্ট নেই?", "বিনামূল্যে নিবন্ধন করুন", "আপনার অ্যাকাউন্ট তৈরি করুন", "এটি বিনামূল্যে এবং এক মিনিটেরও কম সময় লাগে", "পুরো নাম", "আপনার নাম", "কমপক্ষে ৬টি অক্ষর", "রাজ্য", "জেলা", "অ্যাকাউন্ট তৈরি করুন →", "আগেই নিবন্ধিত?", "বন্ধ করতে ESC চাপুন বা বাইরে ক্লিক করুন", "বাতিল", "কৃষক লগইন"], "Tamil": ["உள்நுழை", "பதிவு", "உங்கள் கணக்கில் உள்நுழைக", "தொடர மின்னஞ்சல் அல்லது தொலைபேசி மற்றும் கடவுச்சொல்லை உள்ளிடவும்", "மின்னஞ்சல் அல்லது தொலைபேசி", "கடவுச்சொல்", "உங்கள் கடவுச்சொல்லை உள்ளிடவும்", "உள்நுழை →", "கணக்கு இல்லையா?", "இலவசமாகப் பதிவு செய்க", "உங்கள் கணக்கை உருவாக்குக", "இது இலவசம், ஒரு நிமிடத்திற்குள் முடியும்", "முழுப் பெயர்", "உங்கள் பெயர்", "குறைந்தது 6 எழுத்துகள்", "மாநிலம்", "மாவட்டம்", "கணக்கை உருவாக்கு →", "ஏற்கனவே பதிவு செய்தீர்களா?", "மூட ESC அழுத்தவும் அல்லது வெளியே கிளிக் செய்யவும்", "ரத்து", "விவசாயி உள்நுழைவு"], "Telugu": ["లాగిన్", "నమోదు", "మీ ఖాతాలో సైన్ ఇన్ చేయండి", "కొనసాగడానికి ఇమెయిల్ లేదా ఫోన్ మరియు పాస్‌వర్డ్ నమోదు చేయండి", "ఇమెయిల్ లేదా ఫోన్", "పాస్‌వర్డ్", "మీ పాస్‌వర్డ్ నమోదు చేయండి", "లాగిన్ →", "ఖాతా లేదా?", "ఉచితంగా నమోదు చేసుకోండి", "మీ ఖాతాను సృష్టించండి", "ఇది ఉచితం, ఒక నిమిషం కంటే తక్కువ సమయం పడుతుంది", "పూర్తి పేరు", "మీ పేరు", "కనీసం 6 అక్షరాలు", "రాష్ట్రం", "జిల్లా", "ఖాతా సృష్టించండి →", "ఇప్పటికే నమోదు చేసుకున్నారా?", "మూసివేయడానికి ESC నొక్కండి లేదా బయట క్లిక్ చేయండి", "రద్దు", "రైతు లాగిన్"], "Kannada": ["ಲಾಗಿನ್", "ನೋಂದಣಿ", "ನಿಮ್ಮ ಖಾತೆಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ", "ಮುಂದುವರಿಯಲು ಇಮೇಲ್ ಅಥವಾ ಫೋನ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ", "ಇಮೇಲ್ ಅಥವಾ ಫೋನ್", "ಪಾಸ್‌ವರ್ಡ್", "ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ", "ಲಾಗಿನ್ →", "ಖಾತೆ ಇಲ್ಲವೇ?", "ಉಚಿತವಾಗಿ ನೋಂದಾಯಿಸಿ", "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ರಚಿಸಿ", "ಇದು ಉಚಿತ, ಒಂದು ನಿಮಿಷಕ್ಕಿಂತ ಕಡಿಮೆ ಸಮಯ ಬೇಕು", "ಪೂರ್ಣ ಹೆಸರು", "ನಿಮ್ಮ ಹೆಸರು", "ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳು", "ರಾಜ್ಯ", "ಜಿಲ್ಲೆ", "ಖಾತೆ ರಚಿಸಿ →", "ಈಗಾಗಲೇ ನೋಂದಾಯಿಸಿದ್ದೀರಾ?", "ಮುಚ್ಚಲು ESC ಒತ್ತಿ ಅಥವಾ ಹೊರಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ", "ರದ್ದು", "ರೈತ ಲಾಗಿನ್"], "Malayalam": ["ലോഗിൻ", "രജിസ്റ്റർ", "നിങ്ങളുടെ അക്കൗണ്ടിൽ സൈൻ ഇൻ ചെയ്യുക", "തുടരാൻ ഇമെയിൽ അല്ലെങ്കിൽ ഫോണും പാസ്‌വേഡും നൽകുക", "ഇമെയിൽ അല്ലെങ്കിൽ ഫോൺ", "പാസ്‌വേഡ്", "നിങ്ങളുടെ പാസ്‌വേഡ് നൽകുക", "ലോഗിൻ →", "അക്കൗണ്ട് ഇല്ലേ?", "സൗജന്യമായി രജിസ്റ്റർ ചെയ്യുക", "നിങ്ങളുടെ അക്കൗണ്ട് ഉണ്ടാക്കുക", "ഇത് സൗജന്യമാണ്, ഒരു മിനിറ്റിൽ താഴെ മതി", "മുഴുവൻ പേര്", "നിങ്ങളുടെ പേര്", "കുറഞ്ഞത് 6 അക്ഷരങ്ങൾ", "സംസ്ഥാനം", "ജില്ല", "അക്കൗണ്ട് ഉണ്ടാക്കുക →", "നേരത്തേ രജിസ്റ്റർ ചെയ്തോ?", "അടയ്ക്കാൻ ESC അമർത്തുക അല്ലെങ്കിൽ പുറത്ത് ക്ലിക്ക് ചെയ്യുക", "റദ്ദാക്കുക", "കർഷക ലോഗിൻ"], "Odia": ["ଲଗଇନ୍", "ପଞ୍ଜୀକରଣ", "ଆପଣଙ୍କ ଖାତାରେ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ", "ଆଗକୁ ବଢ଼ିବାକୁ ଇମେଲ୍ କିମ୍ବା ଫୋନ୍ ଓ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ", "ଇମେଲ୍ କିମ୍ବା ଫୋନ୍", "ପାସୱାର୍ଡ", "ଆପଣଙ୍କ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ", "ଲଗଇନ୍ →", "ଖାତା ନାହିଁ?", "ମାଗଣାରେ ପଞ୍ଜୀକରଣ କରନ୍ତୁ", "ଆପଣଙ୍କ ଖାତା ତିଆରି କରନ୍ତୁ", "ଏହା ମାଗଣା ଏବଂ ଏକ ମିନିଟ୍‌ରୁ କମ୍ ସମୟ ଲାଗେ", "ପୂରା ନାମ", "ଆପଣଙ୍କ ନାମ", "ଅତି କମରେ 6 ଅକ୍ଷର", "ରାଜ୍ୟ", "ଜିଲ୍ଲା", "ଖାତା ତିଆରି କରନ୍ତୁ →", "ଆଗରୁ ପଞ୍ଜୀକୃତ କି?", "ବନ୍ଦ କରିବାକୁ ESC ଦବାନ୍ତୁ କିମ୍ବା ବାହାରେ କ୍ଲିକ୍ କରନ୍ତୁ", "ବାତିଲ୍", "କୃଷକ ଲଗଇନ୍"], "Urdu": ["لاگ اِن", "رجسٹر", "اپنے اکاؤنٹ میں سائن اِن کریں", "جاری رکھنے کے لیے ای میل یا فون اور پاس ورڈ درج کریں", "ای میل یا فون", "پاس ورڈ", "اپنا پاس ورڈ درج کریں", "لاگ اِن ←", "اکاؤنٹ نہیں ہے؟", "مفت رجسٹر کریں", "اپنا اکاؤنٹ بنائیں", "یہ مفت ہے اور ایک منٹ سے کم لگتا ہے", "پورا نام", "آپ کا نام", "کم از کم 6 حروف", "ریاست", "ضلع", "اکاؤنٹ بنائیں ←", "پہلے سے رجسٹر ہیں؟", "بند کرنے کے لیے ESC دبائیں یا باہر کلک کریں", "منسوخ کریں", "کسان لاگ اِن"]};
function authLang(){const l=getAiLang();return AUTH_T[l]?l:"English"}
function setAuthLang(l){setAiLang(l);render()}
function authModal(){
 const mode=state.authMode,login=mode==="login",L=authLang(),t=AUTH_T[L],rtl=L==="Urdu";
 const sel=`<select class="auth-lang" onchange="setAuthLang(this.value)" aria-label="Language">${LANG_LIST.map(l=>`<option value="${l}" ${l===L?"selected":""}>${LANG_NATIVE[l]||l}</option>`).join("")}</select>`;
 const tabs=`<div class="auth-tabs"><button type="button" class="${login?"on":""}" onclick="state.authMode='login';render()">${t[0]}</button><button type="button" class="${login?"":"on"}" onclick="state.authMode='signup';render()">${t[1]}</button></div>`;
 const eye=`<button type="button" class="auth-eye" onclick="togglePass()" aria-label="Show or hide password">👁</button>`;
 const body=login?
 `<h3 class="auth-title">${t[2]}</h3><p class="auth-sub">${t[3]}</p><form onsubmit="loginSubmit(event)"><label class="auth-lbl">${t[4]}</label><input id="auth-contact" required class="input" autocomplete="username" placeholder="name@example.com"><label class="auth-lbl">${t[5]}</label><div class="auth-pw"><input id="auth-pass" type="password" required class="input" autocomplete="current-password" placeholder="${t[6]}">${eye}</div><div id="auth-err" class="danger small" style="margin-top:8px"></div><button class="btn btn-green" style="width:100%;margin-top:14px">${t[7]}</button></form><p class="auth-sub" style="margin-top:14px">${t[8]} <a href="#" onclick="state.authMode='signup';render();return false">${t[9]}</a></p>`:
 `<h3 class="auth-title">${t[10]}</h3><p class="auth-sub">${t[11]}</p><form onsubmit="signupSubmit(event)"><label class="auth-lbl">${t[12]}</label><input id="auth-name" required class="input" placeholder="${t[13]}"><label class="auth-lbl">${t[4]}</label><input id="auth-contact" required class="input" placeholder="name@example.com"><label class="auth-lbl">${t[5]}</label><div class="auth-pw"><input id="auth-pass" required type="password" minlength="6" class="input" autocomplete="new-password" placeholder="${t[14]}">${eye}</div><label class="auth-lbl">${t[15]}</label><select id="auth-state" class="select">${(window.STATES_LIST||[]).map(x=>`<option>${esc(x)}</option>`).join("")}</select><label class="auth-lbl">${t[16]}</label><input id="auth-district" class="input" value="Lucknow" placeholder="${t[16]}"><div id="auth-err" class="danger small" style="margin-top:8px"></div><button class="btn btn-green" style="width:100%;margin-top:14px">${t[17]}</button></form><p class="auth-sub" style="margin-top:14px">${t[18]} <a href="#" onclick="state.authMode='login';render();return false">${t[0]}</a></p>`;
 return `<div class="modal-bg" onclick="if(event.target===this)closeAuth()"><div class="modal" ${rtl?'dir="rtl"':""}><div class="modal-head"><button class="close" onclick="closeAuth()">✕</button>${sel}<div style="font-size:22px;font-weight:800">🌾 Krishi<span style="color:#16a34a">Sathi</span></div><div class="small muted">${t[21]}</div></div><div class="modal-body">${tabs}${body}<div class="auth-foot"><span class="tiny muted">${t[19]}</span><button class="btn btn-light" onclick="closeAuth()">${t[20]}</button></div></div></div></div>`;
}
function togglePass(){const i=$("#auth-pass");if(i)i.type=i.type==="password"?"text":"password"}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&state.isAuth)closeAuth()});
function openSearch(){state.isSearch=true;state.modalSearch="";render()}
function closeSearch(){state.isSearch=false;render()}
function openAuth(mode="login"){state.isAuth=true;state.authMode=mode;render()}
function closeAuth(){state.isAuth=false;render()}
function demoLogin(){state.user={id:"usr-demo",name:"Ramesh Kumar",email:"ramesh.farmer@example.com",phone:"+91 98765 43210",state:"Uttar Pradesh",district:"Lucknow",village:"Bakshi Ka Talab",landSizeAcres:4.5,savedCrops:state.savedCrops,savedMandis:state.savedMandis,userCrops:state.userCrops};state.isAuth=false;state.page="dashboard";render()}
function applyUser(u){state.user=u;state.savedCrops=u.savedCrops;state.savedMandis=u.savedMandis;state.userCrops=u.userCrops;state.isAuth=false;state.aiMsgs=undefined;loadHistory()}
async function authCall(url,body,btnSel){const err=$("#auth-err");if(err)err.textContent="";try{const r=await fetch(url,{method:"POST",headers:HDR(),body:JSON.stringify(body)});const d=await r.json();if(!r.ok||!d.user){if(err)err.textContent=d.error||"Kuch galat hua, dobara try karein.";return}applyUser(d.user);state.page="dashboard";render()}catch(e){if(err)err.textContent="Server se connect nahi ho paya."}}
function loginSubmit(e){e.preventDefault();authCall("/api/auth/login",{contact:$("#auth-contact").value,password:$("#auth-pass").value})}
function signupSubmit(e){e.preventDefault();authCall("/api/auth/register",{name:$("#auth-name").value,contact:$("#auth-contact").value,password:$("#auth-pass").value,state:$("#auth-state").value,district:$("#auth-district").value})}
async function logout(){try{await fetch("/api/auth/logout",{method:"POST",headers:HDR()})}catch(e){}state.user=null;state.aiMsgs=undefined;state.page="home";render()}
async function saveProfile(){if(!state.user||state.user.id==="usr-demo")return;try{await fetch("/api/auth/me",{method:"PUT",headers:HDR(),body:JSON.stringify({savedCrops:state.savedCrops,savedMandis:state.savedMandis,userCrops:state.userCrops})})}catch(e){}}
async function loadMe(){try{const r=await fetch("/api/auth/me",{headers:HDR()});const d=await r.json();if(d.user){applyUser(d.user);render()}else if(!state.user&&!sessionStorage.getItem("ks_login_shown")){try{sessionStorage.setItem("ks_login_shown","1")}catch(e){}openAuth("login")}}catch(e){}}
function toggleCrop(id){state.savedCrops=state.savedCrops.includes(id)?state.savedCrops.filter(x=>x!==id):[...state.savedCrops,id];if(state.user)state.user.savedCrops=state.savedCrops;saveProfile();render()}
function toggleMandi(id){state.savedMandis=state.savedMandis.includes(id)?state.savedMandis.filter(x=>x!==id):[...state.savedMandis,id];if(state.user)state.user.savedMandis=state.savedMandis;saveProfile();render()}
function removeUserCrop(id){if(state.user)state.user.userCrops=state.user.userCrops.filter(c=>c.id!==id);state.userCrops=state.user.userCrops;saveProfile();render()}
function markAllRead(){state.notifications.forEach(n=>n.isRead=true);render()}
function notificationClick(id){const n=state.notifications.find(x=>x.id===id);if(!n)return;n.isRead=true;if(n.actionTarget)navigate(n.actionTarget);else render()}
function toggleNotifications(){const panel=$("#notification-panel");if(panel.innerHTML){panel.innerHTML="";return}panel.innerHTML=`<div class="modal-bg" onclick="if(event.target===this)toggleNotifications()"><div class="modal" style="width:min(520px,100%)"><div class="modal-body"><div style="display:flex;justify-content:space-between"><h3>Notifications</h3><button class="btn btn-light" onclick="markAllRead()">Mark all read</button></div>${state.notifications.map(n=>`<div class="card" style="margin:8px 0" onclick="notificationClick('${n.id}')"><b>${esc(n.title)}</b><div class="small">${esc(n.message)}</div><div class="tiny muted">${esc(n.time)}</div></div>`).join("")}</div></div></div>`}
function mobileNav(){const links=["home","crops","mandi","weather","schemes","ai-sathi","crop-doctor","soil","calendar","tips","dashboard"];const html=`<div class="modal-bg" onclick="if(event.target===this)this.remove()"><div class="modal"><div class="modal-body">${links.map(x=>`<button class="btn btn-light" style="width:100%;margin:4px 0;text-align:left" onclick="navigate('${x}');this.closest('.modal-bg').remove()">${x}</button>`).join("")}</div></div></div>`;document.body.insertAdjacentHTML("beforeend",html)}

function render(){
 let content="";
 switch(state.page){
  case "crops":content=cropsPage();break;case "crop-detail":content=cropDetail();break;case "mandi":content=mandi();break;
  case "weather":content=weather();break;case "schemes":content=schemes();break;case "ai-sathi":content=aiSathi();break;
  case "crop-doctor":content=cropDoctor();break;case "soil":content=soil();break;case "calendar":content=calendar();break;
  case "tips":content=tips();break;case "dashboard":content=dashboard();break;default:content=home();
 }
 $("#app").innerHTML=navbar()+`<main class="main">${content}</main>`+footer()+(state.isSearch?searchModal():"")+(state.isAuth?authModal():"");
 if(state.isSearch)setTimeout(searchMounted,0);
}
render();
loadMe();loadHistory();
