/* ============================================================
   Ladekarte — App
   Karte: hell oder Satellit. Das dunkle Design betrifft nur die
   Bedienelemente, nie die Karte selbst.
   ============================================================ */

/* ============================================================
   TARIFE — Ausgangswerte, recherchiert 18.08.2026
   ============================================================ */
const FARBEN = ["#0F5F4C","#B4451F","#B8862F","#3B5A78","#6B3A5B","#4E6B2E"];
const STAND_START = "2026-08-18";

const KARTEN_START = [
  { id:1, name:"EWE Go", farbe:FARBEN[0], stand:STAND_START,
    netze:[{cpos:["ewe"],label:"EWE Go",ac:0.52,dc:0.52,hpc:0.52},
           {cpos:[],label:"Roaming",ac:0.62,dc:0.62,hpc:0.62}],
    notiz:"Keine Blockiergebühr an eigenen Säulen. Bei Partnern 0,10 €/min ab 4 h, max. 24 €." },
  { id:2, name:"EnBW mobility+ S", farbe:FARBEN[1], stand:STAND_START,
    netze:[{cpos:["enbw"],label:"EnBW",ac:0.51,dc:0.51,hpc:0.51},
           {cpos:[],label:"Roaming",ac:0.56,dc:0.56,hpc:0.56}],
    notiz:"0,51 € ist die Sommeraktion bis 30.09.2026, danach 0,56 €. Im Fremdnetz je Standort 0,56–0,89 € — hinterlegt ist die Untergrenze." },
  { id:3, name:"ADAC e-Charge", farbe:FARBEN[2], stand:STAND_START,
    netze:[{cpos:["aral"],label:"Aral pulse",ac:0.55,dc:0.55,hpc:0.55},
           {cpos:[],label:"Roaming",ac:0.75,dc:0.75,hpc:0.75}],
    notiz:"Bei Aral keine Blockiergebühr. Fremdnetz 0,15 €/min ab 120 min AC bzw. 45 min DC." },
  { id:4, name:"Aral pulse Klassik", farbe:FARBEN[3], stand:STAND_START,
    netze:[{cpos:["aral"],label:"Aral pulse",ac:0.47,dc:0.52,hpc:0.62},
           {cpos:[],label:"Roaming",ac:null,dc:null,hpc:null}],
    notiz:"App-Tarif ohne Abo, Stand 01.07.2026. Unter 50 kW günstiger als ADAC, darüber teurer." },
  { id:5, name:"IONITY Go", farbe:FARBEN[4], stand:STAND_START,
    netze:[{cpos:["ionity"],label:"IONITY",ac:null,dc:0.68,hpc:0.68},
           {cpos:[],label:"Roaming",ac:null,dc:null,hpc:null}],
    notiz:"Kostenlose App-Registrierung. Quellen nennen 0,66 bis 0,68 € — in der App prüfen." }
];

const CPO_STIL = {
  ewe:{k:"EWE",bg:"#E2001A",fg:"#fff"},          enbw:{k:"EnBW",bg:"#EE7100",fg:"#fff"},
  aral:{k:"ARAL",bg:"#0B3B8C",fg:"#fff"},        ionity:{k:"ION",bg:"#1B1B1F",fg:"#fff"},
  tesla:{k:"TSLA",bg:"#CC0000",fg:"#fff"},       fastned:{k:"FN",bg:"#F0562D",fg:"#fff"},
  allego:{k:"ALG",bg:"#0E3B5B",fg:"#fff"},       shell:{k:"SHL",bg:"#D42D12",fg:"#fff"},
  totalenergies:{k:"TE",bg:"#E4032E",fg:"#fff"}, eon:{k:"E.ON",bg:"#E2001A",fg:"#fff"},
  vattenfall:{k:"VF",bg:"#2071B5",fg:"#fff"},    mer:{k:"MER",bg:"#00A05A",fg:"#fff"},
  tanke:{k:"TKE",bg:"#C8102E",fg:"#fff"},        chargepoint:{k:"CP",bg:"#0B7D3E",fg:"#fff"},
  stadtwerke:{k:"SW",bg:"#3B5A78",fg:"#fff"},    unbekannt:{k:"?",bg:"#8B958F",fg:"#fff"}
};

const CPO_ALIASE = {
  ewe:["ewe"], enbw:["enbw","en bw"], aral:["aral","bp europa","bp pulse"],
  ionity:["ionity"], tanke:["tanke","rheinenergie"], allego:["allego"],
  totalenergies:["totalenergies","total "], shell:["shell"], fastned:["fastned"],
  tesla:["tesla"], vattenfall:["vattenfall","incharge"],
  eon:["e.on","eon ","e-on","westenergie","innogy"], mer:["mer germany","mer "],
  chargepoint:["chargepoint"], eze:["eze.network"], wirelane:["wirelane"],
  pfalzwerke:["pfalzwerke"], autostrom:["autostrom plus"], moon:["moon power"],
  citywatt:["citywatt"], lidl:["lidl"], aldi:["aldi"], kaufland:["kaufland"],
  edeka:["edeka"], ubitricity:["ubitricity"], ecarup:["ecarup"], teag:["teag"],
  enercity:["enercity"], chargecloud:["chargecloud"],
  stadtwerke:["stadtwerke","stadtwerk","versorgungsbetriebe","energieversorgung","gemeindewerke"]
};

/* ============================================================
   Lokale Speicherung — hält die App auch ohne Konto am Laufen
   ============================================================ */
const SPEICHER = "ladekarte.v7";
const SPEICHER_ALT = "ladekarte.v6";

function laden_gespeichert(){
  try{
    const roh = localStorage.getItem(SPEICHER) || localStorage.getItem(SPEICHER_ALT);
    return roh ? JSON.parse(roh) : null;
  }catch(e){ return null; }
}
function speichern(){
  try{
    localStorage.setItem(SPEICHER, JSON.stringify({
      karten:KARTEN, dunkel:istDunkel, sat:istSat,
      rev:serverRev, letzterStand:letzterStand, kontoMail:konto ? konto.email : null
    }));
  }catch(e){ /* egal */ }
}

const gespeichert = laden_gespeichert() || {};
let KARTEN = Array.isArray(gespeichert.karten) && gespeichert.karten.length
           ? gespeichert.karten.map(k => ({stand:"", notiz:"", ...k}))
           : KARTEN_START;
let istDunkel = gespeichert.dunkel !== undefined ? gespeichert.dunkel
              : window.matchMedia("(prefers-color-scheme: dark)").matches;
let istSat = gespeichert.sat === true;
let serverRev = Number(gespeichert.rev || 0);
let letzterStand = typeof gespeichert.letzterStand === "string" ? gespeichert.letzterStand : "";

/* ============================================================
   Zustand
   ============================================================ */
let map, layer, hierMarker, basisKarte;
let stationen = [], marker = new Map();
let geladeneBox = null, laeuft = false, autoTimer = null, aktivId = null;

let konto = null;                 // {email} sobald angemeldet
let syncStatus = "lokal";         // lokal | sync | offen | fehler
let syncText = "Nur auf diesem Gerät gespeichert.";
let syncTimer = null;
let konflikt = null;              // {karten, rev, geaendert} bei Kollision
let kontoTab = "login";

const stil = cpo => CPO_STIL[cpo] || {k:(cpo||"?").slice(0,3).toUpperCase(), bg:"#6B7570", fg:"#fff"};
const esc = t => String(t ?? "").replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
const eurKwh = n => n.toFixed(2).replace(".", ",") + " €";
const $ = id => document.getElementById(id);

function normCpo(t){
  if(!t) return "unbekannt";
  const s = t.toLowerCase();
  for(const [k,m] of Object.entries(CPO_ALIASE)) if(m.some(x => s.includes(x))) return k;
  return "unbekannt";
}
const klasse = kw => kw > 50 ? "hpc" : kw > 22 ? "dc" : "ac";
const KLASSE_LABEL = {ac:"AC", dc:"DC bis 50 kW", hpc:"HPC über 50 kW"};

function preisFuer(karte, cpo, kls){
  for(const n of karte.netze){
    if(n.cpos && n.cpos.length && !n.cpos.includes(cpo)) continue;
    const p = n[kls];
    return (p === null || p === undefined || p === "") ? {preis:null, netz:n.label} : {preis:Number(p), netz:n.label};
  }
  return {preis:null, netz:"—"};
}
function bewerten(s){
  const kls = klasse(s.kw);
  const z = KARTEN.map(k => { const r = preisFuer(k, s.cpo, kls); return {karte:k, preis:r.preis, netz:r.netz}; });
  const ok = z.filter(x => x.preis !== null).sort((a,b) => a.preis - b.preis);
  return {kls, zeilen:[...ok, ...z.filter(x => x.preis === null)], sieger:ok[0] || null};
}
function belegung(s){
  const echt = s.frei + s.laedt + s.defekt + s.reserviert;
  if(echt === 0) return {stufe:"grau", text:"Status unklar", farbe:"var(--grau)"};
  if(s.frei > 0)  return {stufe:"frei", text:`${s.frei} von ${echt} frei`, farbe:"var(--frei)"};
  return {stufe:"belegt", text:`alle ${echt} belegt`, farbe:"var(--belegt)"};
}

const tageSeit = iso => {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  const d = new Date(iso + "T12:00:00");
  return isNaN(d) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
};
const datumDe = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.slice(8,10)+"."+iso.slice(5,7)+"."+iso.slice(0,4) : "";

function toast(text, fehler){
  const t = $("toast");
  t.textContent = text; t.className = "toast on" + (fehler ? " err" : "");
  clearTimeout(t._h); t._h = setTimeout(() => t.className = "toast", fehler ? 6000 : 2200);
}

/* ============================================================
   Konto und Synchronisierung
   ============================================================ */

/* Vergleichbare Fassung der Ladekarten: gleiche Reihenfolge der Felder,
   gleiche Typen — sonst gilt jede Serverantwort als Änderung. */
const kanon = ks => JSON.stringify((ks || []).map(k => ({
  id: Number(k.id),
  name: String(k.name ?? ""),
  farbe: String(k.farbe ?? ""),
  stand: String(k.stand ?? ""),
  notiz: String(k.notiz ?? ""),
  netze: (k.netze || []).map(n => ({
    cpos: (n.cpos || []).map(c => String(c)),
    label: String(n.label ?? ""),
    ac: n.ac === "" || n.ac == null ? null : Number(n.ac),
    dc: n.dc === "" || n.dc == null ? null : Number(n.dc),
    hpc: n.hpc === "" || n.hpc == null ? null : Number(n.hpc)
  }))
})));
async function ruf(pfad, methode, koerper){
  const r = await fetch(pfad, {
    method: methode || "GET",
    credentials: "same-origin",
    headers: koerper ? {"Content-Type":"application/json"} : undefined,
    body: koerper ? JSON.stringify(koerper) : undefined
  });
  let daten = null;
  try{ daten = await r.json(); }catch(e){ /* leere Antwort */ }
  if(!r.ok){
    const f = new Error((daten && daten.fehler) || ("Serverfehler " + r.status));
    f.status = r.status; f.daten = daten;
    throw f;
  }
  return daten || {};
}

function setzeSync(status, text){
  syncStatus = status; syncText = text;
  const p = $("kontoPunkt");
  p.className = "punkt" + (status === "lokal" ? "" : " " + status);
  $("btnKonto").setAttribute("aria-label", "Konto — " + text);
  if($("modalKonto").classList.contains("open")) renderKonto();
}

async function kontoPruefen(){
  try{
    const a = await ruf("/api/auth/me");
    konto = a.email ? {email:a.email} : null;
  }catch(e){
    konto = null;
    setzeSync("offen", "Server nicht erreichbar — es wird lokal gespeichert.");
    return;
  }
  if(konto){ speichern(); await abgleichen(true); }
  else setzeSync("lokal", "Nicht angemeldet — nur auf diesem Gerät gespeichert.");
}

async function abgleichen(still){
  if(!konto) return;
  let a;
  try{ a = await ruf("/api/karten"); }
  catch(e){
    if(e.status === 401){ abmeldungBemerkt(); return; }
    setzeSync("offen", "Kein Kontakt zum Server — Änderungen liegen lokal bereit.");
    return;
  }
  const lokal = kanon(KARTEN);

  if(a.karten === null){                       // Konto noch ohne Daten
    serverRev = a.rev;
    await hochladen(still);
    return;
  }

  const vomServer = kanon(a.karten);
  if(lokal === vomServer){
    serverRev = a.rev; letzterStand = lokal; speichern();
    setzeSync("sync", "Aktuell — Stand vom " + zeitKurz(a.geaendert) + ".");
    return;
  }
  // Hier nichts geändert (oder noch nie abgeglichen und alles im Auslieferungszustand)
  if(letzterStand === lokal || (letzterStand === "" && lokal === kanon(KARTEN_START))){
    KARTEN = a.karten; serverRev = a.rev; letzterStand = vomServer;
    speichern(); zeichnen(); renderKartenWennOffen();
    setzeSync("sync", "Vom Server übernommen (" + zeitKurz(a.geaendert) + ").");
    if(!still) toast("Ladekarten vom Server übernommen.");
    return;
  }
  if(letzterStand === vomServer){              // nur hier geändert → hochladen
    serverRev = a.rev;
    await hochladen(still);
    return;
  }
  konflikt = a;                                // beide Seiten geändert
  setzeSync("fehler", "Zwei Fassungen — bitte auswählen.");
  oeffneKonto();
}

async function hochladen(still, tiefe){
  if(!konto) return;
  const stand = kanon(KARTEN);
  try{
    const a = await ruf("/api/karten", "PUT", {karten:KARTEN, rev:serverRev});
    serverRev = a.rev; letzterStand = kanon(a.karten); konflikt = null;
    speichern();
    setzeSync("sync", "Gespeichert und synchronisiert (" + zeitKurz(a.geaendert) + ").");
  }catch(e){
    if(e.status === 409 && e.daten){
      if(!e.daten.karten && !(tiefe > 0)){     // Server hat gar nichts — nur die Zählung lag daneben
        serverRev = e.daten.rev;
        return hochladen(still, 1);
      }
      if(kanon(e.daten.karten) === stand){     // inhaltlich identisch, nur die Zählung lag daneben
        serverRev = e.daten.rev; letzterStand = stand; konflikt = null; speichern();
        setzeSync("sync", "Aktuell — Stand vom " + zeitKurz(e.daten.geaendert) + ".");
        return;
      }
      konflikt = e.daten;
      setzeSync("fehler", "Zwei Fassungen — bitte auswählen.");
      oeffneKonto();
      return;
    }
    if(e.status === 401){ abmeldungBemerkt(); return; }
    if(e.status === 400 || e.status === 413){
      setzeSync("fehler", e.message);
      if(!still) toast(e.message, true);
      return;
    }
    setzeSync("offen", "Nicht übertragen — wird beim nächsten Kontakt nachgeholt.");
  }
}

function abmeldungBemerkt(){
  konto = null; speichern();
  setzeSync("lokal", "Abgemeldet — Änderungen bleiben auf diesem Gerät.");
  toast("Die Anmeldung ist abgelaufen. Bitte neu anmelden.", true);
}

function planeSync(){
  speichern();
  if(!konto) return;
  setzeSync("offen", "Änderung wird übertragen …");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => hochladen(true), 1200);
}

function zeitKurz(iso){
  if(!iso) return "gerade eben";
  const d = new Date(iso);
  if(isNaN(d)) return "gerade eben";
  const heute = new Date();
  const gleich = d.toDateString() === heute.toDateString();
  const uhr = d.toLocaleTimeString("de-DE", {hour:"2-digit", minute:"2-digit"});
  return gleich ? uhr + " Uhr" : d.toLocaleDateString("de-DE") + ", " + uhr + " Uhr";
}

/* ============================================================
   Karte — hell oder Satellit, unabhängig vom Design
   ============================================================ */
const TILES = {
  normal: ["https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", "© OpenStreetMap"],
  sat: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "© Esri, Maxar, Earthstar Geographics"]
};

function initMap(){
  map = L.map("map", {zoomControl:false}).setView([53.232,7.457], 12);
  setzeBasis();
  layer = L.layerGroup().addTo(map);
  map.on("moveend", pruefeNachladen);
  map.on("zoomend", markerNeuStylen);
}

function setzeBasis(){
  if(basisKarte) map.removeLayer(basisKarte);
  const [url, attr] = istSat ? TILES.sat : TILES.normal;
  basisKarte = L.tileLayer(url, {maxZoom:19, attribution:attr}).addTo(map);
  basisKarte.setZIndex(0);
}

function pruefeNachladen(){
  if(geladeneBox && geladeneBox.contains(map.getBounds())) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(laden, 500);
}

function markerIcon(s){
  const b = s._b, v = s._v, st = stil(s.cpo);
  const dot = map.getZoom() < 12;
  const preis = b.sieger ? eurKwh(b.sieger.preis) : "–";
  return L.divIcon({className:"", iconSize:[0,0], html:
    `<div class="mk ${v.stufe}${dot?" dot":""}${s.id===aktivId?" aktiv":""}">
       <span class="badge" style="background:${st.bg};color:${st.fg}">${dot?"":esc(st.k)}</span>
       ${dot?"":`<span class="pill">${preis}</span>`}
     </div>`});
}
function markerNeuStylen(){ marker.forEach(({m,s}) => m.setIcon(markerIcon(s))); }

function zeichnen(){
  const gesehen = new Set();
  stationen.forEach(s => {
    s._b = bewerten(s); s._v = belegung(s);
    gesehen.add(s.id);
    const vorhanden = marker.get(s.id);
    if(vorhanden){ vorhanden.s = s; vorhanden.m.setIcon(markerIcon(s)); }
    else{
      const m = L.marker([s.lat, s.lon], {icon:markerIcon(s), riseOnHover:true}).addTo(layer);
      m.on("click", () => zeigeDetail(s.id));
      marker.set(s.id, {m, s});
    }
  });
  marker.forEach((v, id) => { if(!gesehen.has(id)){ layer.removeLayer(v.m); marker.delete(id); } });
  liste();
}

function liste(){
  const el = $("list");
  $("sheetTitel").textContent = stationen.length ? stationen.length + " Ladesäulen" : "Ladesäulen";
  if(!stationen.length){
    el.innerHTML = `<div class="empty"><b>Hier meldet niemand Echtzeitdaten.</b><br>
      Rauszoomen, oder es gibt in diesem Ausschnitt keine angebundenen Betreiber.</div>`;
    return;
  }
  const sortiert = [...stationen].sort((a,b) =>
    (a._b.sieger ? a._b.sieger.preis : 99) - (b._b.sieger ? b._b.sieger.preis : 99));
  el.innerHTML = sortiert.map(s => {
    const b = s._b, v = s._v, st = stil(s.cpo);
    return `<div class="row" data-id="${esc(s.id)}">
      <span class="bdg" style="background:${st.bg};color:${st.fg}">${esc(st.k)}</span>
      <span class="main">
        <div class="name">${esc(s.name || s.adresse || "Ladesäule")}</div>
        <div class="sub"><span class="led" style="background:${v.farbe}"></span>${esc(v.text)} · ${s.kw} kW · ${esc(s.ort)}</div>
      </span>
      <span class="right">
        <div class="p" style="color:${b.sieger ? b.sieger.karte.farbe : "var(--grau)"}">${b.sieger ? eurKwh(b.sieger.preis) : "–"}</div>
        <div class="k">${b.sieger ? esc(b.sieger.karte.name.split(" ")[0]) : "kein Tarif"}</div>
      </span></div>`;
  }).join("");
  el.querySelectorAll(".row").forEach(r => r.onclick = () => zeigeDetail(r.dataset.id));
}

/* ============================================================
   Detail
   ============================================================ */
function zeigeDetail(id){
  const e = marker.get(id) || {s:stationen.find(x => String(x.id) === String(id))};
  const s = e && e.s; if(!s) return;
  aktivId = s.id; markerNeuStylen();
  const b = s._b, v = s._v, st = stil(s.cpo);

  $("dBadge").innerHTML = `<span class="bdg" style="background:${st.bg};color:${st.fg}">${esc(st.k)}</span>`;
  $("dTitel").textContent = s.name || s.adresse || "Ladesäule";
  $("dMeta").textContent =
    `${s.betreiber}${s.cpo === "unbekannt" ? " · nicht zugeordnet" : ""} · ${s.adresse}, ${s.ort}`;

  const max = Math.max(...b.zeilen.filter(z=>z.preis!==null).map(z=>z.preis), 0.01);
  const leiste = b.zeilen.map((z,i) => z.preis === null
    ? `<li class="out"><span class="kname">${esc(z.karte.name)}</span><span class="bar"></span><span class="price">–</span></li>`
    : `<li class="${i===0?"win":""}"><span class="kname">${esc(z.karte.name)}</span>
       <span class="bar"><i style="width:${Math.round(z.preis/max*100)}%;background:${z.karte.farbe}"></i></span>
       <span class="price">${eurKwh(z.preis)}</span></li>`).join("");

  let standHinweis = "";
  if(b.sieger){
    const tage = tageSeit(b.sieger.karte.stand);
    if(tage === null) standHinweis = `<div class="notiz alt">Für diesen Tarif ist kein Preisstand hinterlegt. Preise pflegst du selbst — sie werden nicht automatisch aktualisiert.</div>`;
    else if(tage > 120) standHinweis = `<div class="notiz alt">Preis zuletzt am ${datumDe(b.sieger.karte.stand)} geprüft — das ist über ${Math.floor(tage/30)} Monate her. Tarife ändern sich meist quartalsweise.</div>`;
  }

  $("dBody").innerHTML = `
    <div class="d-stat">
      <div><div class="lbl">Belegung</div><div class="val" style="color:${v.farbe};font-size:13px">${esc(v.text)}</div></div>
      <div><div class="lbl">Leistung</div><div class="val">${s.kw} kW</div></div>
      <div><div class="lbl">Ladeart</div><div class="val" style="font-size:13px">${KLASSE_LABEL[b.kls]}</div></div>
    </div>
    ${b.sieger ? `<div class="d-gross">
        <span class="big" style="color:${b.sieger.karte.farbe}">${eurKwh(b.sieger.preis)}</span>
        <span class="sub">je kWh mit ${esc(b.sieger.karte.name)}<br>Tarifzeile ${esc(b.sieger.netz)}${
          b.sieger.karte.stand ? `<br>Preisstand ${datumDe(b.sieger.karte.stand)}` : ""}</span>
      </div>` : `<p style="color:var(--muted);font-size:13.5px;margin:0">Keine deiner Karten hat für diesen Betreiber einen Preis hinterlegt.</p>`}
    <div class="abschnitt">Alle Karten</div>
    <ul class="pl">${leiste}</ul>
    ${b.sieger && b.sieger.karte.notiz ? `<div class="notiz">${esc(b.sieger.karte.notiz)}</div>` : ""}
    ${standHinweis}
    <a class="dlink" target="_blank" rel="noopener"
       href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}">Navigation starten</a>`;

  $("detail").classList.add("on");
  setSheet("half");
}
function schliesseDetail(){
  $("detail").classList.remove("on");
  aktivId = null; markerNeuStylen();
}

/* ============================================================
   Abruf — MobiData BW, nur Echtzeitdaten, ohne Schlüssel
   ============================================================ */
const WFS = "https://api.mobidata-bw.de/geoserver/MobiData-BW/ows";

async function laden(){
  if(laeuft) return;
  const b = map.getBounds().pad(0.35);
  if(Math.max(b.getNorth()-b.getSouth(), b.getEast()-b.getWest()) > 2.4){
    toast("Ausschnitt zu groß — bitte reinzoomen."); return;
  }
  laeuft = true;
  $("btnReload").classList.add("laedt");
  const cql = `BBOX(geometry,${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)})`
    + " AND realtime_data_outdated=false";
  const url = WFS + "?service=WFS&version=1.0.0&request=GetFeature"
    + "&typeName=MobiData-BW%3Acharge_points&outputFormat=application%2Fjson"
    + "&srsName=EPSG%3A4326&maxFeatures=1200&CQL_FILTER=" + encodeURIComponent(cql);
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error("HTTP " + r.status);
    stationen = ((await r.json()).features || []).map(mapFeature).filter(Boolean);
    geladeneBox = b;
    zeichnen();
    toast(`${stationen.length} Säulen geladen`);
  }catch(e){
    geladeneBox = null;
    toast("Belegungsdaten nicht erreichbar: " + e.message, true);
  }finally{
    laeuft = false;
    $("btnReload").classList.remove("laedt");
  }
}

function mapFeature(f){
  const p = f.properties || {}, c = f.geometry && f.geometry.coordinates;
  if(!c) return null;
  const betreiber = p.operator_name || "unbekannter Betreiber";
  return {
    id:String(p.id ?? (c[0]+","+c[1])),
    name:p.name || "", adresse:p.address || "", ort:p.city || "",
    lat:c[1], lon:c[0], kw:Math.round((p.max_electric_power || 0)/1000),
    betreiber, cpo:normCpo(betreiber),
    frei:+p.chargepoint_available_count || 0,
    laedt:+p.chargepoint_charging_count || 0,
    defekt:(+p.chargepoint_inoperative_count || 0) + (+p.chargepoint_outoforder_count || 0),
    reserviert:+p.chargepoint_reserved_count || 0
  };
}

function zuStandort(){
  if(!navigator.geolocation){ toast("Kein Standort verfügbar.", true); return; }
  toast("Standort wird ermittelt …");
  navigator.geolocation.getCurrentPosition(p => {
    const ll = [p.coords.latitude, p.coords.longitude];
    if(hierMarker) map.removeLayer(hierMarker);
    hierMarker = L.marker(ll, {icon:L.divIcon({className:"", html:'<div class="ichbinhier"></div>', iconSize:[0,0]}), interactive:false}).addTo(map);
    map.setView(ll, 13);
    geladeneBox = null; laden();
  }, () => toast("Standortfreigabe abgelehnt — Karte manuell bewegen.", true),
  {enableHighAccuracy:false, timeout:8000, maximumAge:60000});
}

/* ============================================================
   Bottom-Sheet
   ============================================================ */
const sheet = () => $("sheet");
let sheetStufe = "half";
function setSheet(stufe){
  sheetStufe = stufe;
  sheet().classList.remove("half","full");
  if(stufe !== "peek") sheet().classList.add(stufe);
  const h = stufe === "full" ? "var(--full)" : stufe === "half" ? "var(--half)" : "var(--peek)";
  $("fabs").style.bottom = `calc(${h} + 12px)`;
}
(function(){
  const griff = $("griff");
  let startY = 0, startT = 0, aktiv = false;
  const hoehe = () => sheet().getBoundingClientRect().height;
  const px = st => st === "full" ? 0 : st === "half" ? hoehe() - window.innerHeight*0.46 : hoehe() - 96;
  griff.addEventListener("pointerdown", e => {
    if(window.innerWidth >= 760) return;
    aktiv = true; startY = e.clientY; startT = px(sheetStufe);
    sheet().classList.add("drag"); griff.setPointerCapture(e.pointerId);
  });
  griff.addEventListener("pointermove", e => {
    if(!aktiv) return;
    sheet().style.transform = `translateY(${Math.max(0, Math.min(hoehe()-96, startT + (e.clientY-startY)))}px)`;
  });
  griff.addEventListener("pointerup", e => {
    if(!aktiv) return;
    aktiv = false; sheet().classList.remove("drag"); sheet().style.transform = "";
    const y = startT + (e.clientY - startY);
    const k = [["full",px("full")],["half",px("half")],["peek",px("peek")]];
    k.sort((a,b) => Math.abs(a[1]-y) - Math.abs(b[1]-y));
    setSheet(k[0][0]);
  });
  griff.addEventListener("click", () => {
    if(window.innerWidth >= 760) return;
    setSheet(sheetStufe === "full" ? "half" : sheetStufe === "half" ? "peek" : "full");
  });
})();

/* ============================================================
   Tarif-Editor
   ============================================================ */
function renderKartenWennOffen(){
  if($("modalTarife").classList.contains("open")) renderKarten();
}

function renderKarten(){
  $("cpoOptionen").innerHTML = Object.keys(CPO_ALIASE).map(k => `<option value="${k}">`).join("");
  $("tarifFuss").innerHTML = (konto
      ? "Änderungen werden sofort gespeichert und mit deinem Konto abgeglichen."
      : "Änderungen werden sofort in diesem Browser gespeichert — ohne Konto nur auf diesem Gerät.")
    + "<br><b>Die Tarifpreise pflegst du selbst</b>, sie werden nicht automatisch nachgeladen. "
    + "Live abgerufen werden nur Standorte und Belegung (OCPDB / MobiData BW, nur Säulen mit Echtzeitstatus). "
    + "Trag oben je Karte ein, wann du die Preise zuletzt geprüft hast — die App erinnert dich nach vier Monaten. "
    + "Die farbigen Kürzel sind eigene Kennzeichnungen, keine Herstellerlogos.";

  const box = $("kartenListe");
  box.innerHTML = KARTEN.map(k => {
    const tage = tageSeit(k.stand);
    const hinweis = tage === null ? "noch nicht geprüft" : tage > 120 ? "vor über vier Monaten" : "";
    return `
    <div class="karte-box" data-id="${k.id}">
      <div class="karte-kopf">
        <span class="bdg klein" style="background:${k.farbe};color:#fff">${esc((k.name||"?").slice(0,2).toUpperCase())}</span>
        <input type="text" data-f="name" value="${esc(k.name)}" aria-label="Name der Ladekarte">
        <button class="kbtn rund" data-del="${k.id}" aria-label="Karte löschen">×</button>
      </div>
      <div class="scrollx"><table>
        <thead><tr><th>Netz</th><th>AC</th><th>DC ≤50</th><th>HPC >50</th><th></th></tr></thead>
        <tbody>${k.netze.map((n,ni) => `
          <tr data-ni="${ni}">
            <td><input type="text" list="cpoOptionen" data-nf="cpos" value="${esc((n.cpos||[]).join(", "))}" placeholder="leer = Roaming"></td>
            <td><input type="number" step="0.01" inputmode="decimal" data-nf="ac" value="${n.ac ?? ""}"></td>
            <td><input type="number" step="0.01" inputmode="decimal" data-nf="dc" value="${n.dc ?? ""}"></td>
            <td><input type="number" step="0.01" inputmode="decimal" data-nf="hpc" value="${n.hpc ?? ""}"></td>
            <td><button class="kbtn rund" data-delnetz="${ni}" aria-label="Netz-Zeile löschen">×</button></td>
          </tr>`).join("")}</tbody>
      </table></div>
      <div style="margin-top:9px;display:flex;gap:8px;align-items:center">
        <button class="kbtn" data-addnetz="${k.id}">+ Netz</button>
        <input type="text" data-f="notiz" value="${esc(k.notiz||"")}" placeholder="Notiz">
      </div>
      <div class="stand-zeile">
        <span>Preise geprüft am</span>
        <input type="date" data-f="stand" value="${esc(k.stand||"")}" aria-label="Datum der letzten Preisprüfung">
        ${hinweis ? `<span style="color:var(--warn)">${hinweis}</span>` : ""}
      </div>
    </div>`;
  }).join("");

  const nach = () => { zeichnen(); planeSync(); };
  const karteVon = el => KARTEN.find(x => String(x.id) === el.closest(".karte-box").dataset.id);

  box.querySelectorAll("[data-f]").forEach(inp => inp.oninput = () => {
    karteVon(inp)[inp.dataset.f] = inp.value;
    nach();
  });
  box.querySelectorAll("[data-nf]").forEach(inp => inp.oninput = () => {
    const k = karteVon(inp);
    const n = k.netze[Number(inp.closest("tr").dataset.ni)], f = inp.dataset.nf;
    if(f === "cpos"){
      n.cpos = inp.value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      n.label = n.cpos.length ? n.cpos.join("/") : "Roaming";
    } else n[f] = inp.value === "" ? null : Number(inp.value);
    nach();
  });
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    KARTEN = KARTEN.filter(k => String(k.id) !== b.dataset.del); renderKarten(); nach(); });
  box.querySelectorAll("[data-delnetz]").forEach(b => b.onclick = () => {
    const k = karteVon(b);
    if(k.netze.length > 1) k.netze.splice(Number(b.dataset.delnetz),1);
    renderKarten(); nach(); });
  box.querySelectorAll("[data-addnetz]").forEach(b => b.onclick = () => {
    karteVon(b).netze.unshift({cpos:[],label:"Roaming",ac:null,dc:null,hpc:null});
    renderKarten(); nach(); });
}

/* ============================================================
   Konto-Ansicht
   ============================================================ */
function oeffneKonto(){ $("modalKonto").classList.add("open"); renderKonto(); }
function schliesseKonto(){ $("modalKonto").classList.remove("open"); }

function renderKonto(){
  const body = $("kontoBody");
  $("kontoTitel").textContent = konto ? "Konto" : "Anmelden";

  const statusBlock = `<div class="status"><span class="punkt ${syncStatus === "lokal" ? "" : syncStatus}"></span><span>${esc(syncText)}</span></div>`;

  if(konflikt){
    const meine = KARTEN.length, dort = (konflikt.karten || []).length;
    body.innerHTML = `
      <div class="meldung on err">Die Ladekarten wurden auf zwei Geräten unterschiedlich geändert.
        Bitte wählen, welche Fassung gilt — die andere wird überschrieben.</div>
      <div class="status"><span class="punkt fehler"></span><span>Hier: ${meine} Karten · Server: ${dort} Karten, gespeichert ${esc(zeitKurz(konflikt.geaendert))}</span></div>
      <div class="knopfreihe">
        <button class="kbtn dunkel breit" id="konfServer">Fassung vom Server übernehmen</button>
        <button class="kbtn breit" id="konfLokal">Fassung dieses Geräts hochladen</button>
      </div>`;
    $("konfServer").onclick = () => {
      KARTEN = konflikt.karten; serverRev = konflikt.rev; letzterStand = kanon(KARTEN);
      konflikt = null; speichern(); zeichnen(); renderKartenWennOffen();
      setzeSync("sync", "Fassung vom Server übernommen.");
      toast("Ladekarten vom Server übernommen.");
    };
    $("konfLokal").onclick = async () => {
      serverRev = konflikt.rev; konflikt = null;
      await hochladen(false);
      toast("Diese Fassung wurde hochgeladen.");
      renderKonto();
    };
    return;
  }

  if(!konto){
    body.innerHTML = `
      ${statusBlock}
      <div class="tabs">
        <button id="tabLogin" class="${kontoTab === "login" ? "an" : ""}">Anmelden</button>
        <button id="tabReg" class="${kontoTab === "reg" ? "an" : ""}">Neues Konto</button>
      </div>
      <div class="meldung" id="kontoMeldung"></div>
      <form id="authForm" autocomplete="on">
        <div class="feld"><label for="fEmail">E-Mail</label>
          <input type="email" id="fEmail" autocomplete="username" required></div>
        <div class="feld"><label for="fPass">Passwort${kontoTab === "reg" ? " (mind. 8 Zeichen)" : ""}</label>
          <input type="password" id="fPass" autocomplete="${kontoTab === "reg" ? "new-password" : "current-password"}" required></div>
        <button class="kbtn dunkel breit" type="submit" id="authSubmit">${kontoTab === "reg" ? "Konto anlegen" : "Anmelden"}</button>
      </form>
      <p class="fuss">Ohne Konto bleiben die Ladekarten nur in diesem Browser. Mit Konto liegen sie auf dem Server
        und stehen auf jedem angemeldeten Gerät zur Verfügung. Gespeichert werden nur E-Mail, Passwort-Hash und deine Tarifdaten —
        keine Standorte, keine Ladevorgänge.</p>`;

    $("tabLogin").onclick = () => { kontoTab = "login"; renderKonto(); };
    $("tabReg").onclick = () => { kontoTab = "reg"; renderKonto(); };
    $("authForm").onsubmit = async e => {
      e.preventDefault();
      const btn = $("authSubmit"), meldung = $("kontoMeldung");
      const email = $("fEmail").value.trim(), passwort = $("fPass").value;
      btn.disabled = true; btn.textContent = "Moment …";
      try{
        const a = await ruf(kontoTab === "reg" ? "/api/auth/register" : "/api/auth/login", "POST", {email, passwort});
        konto = {email:a.email};
        speichern();
        setzeSync("offen", "Angemeldet — gleiche ab …");
        await abgleichen(false);
        renderKonto();
        toast("Angemeldet als " + a.email);
      }catch(err){
        meldung.className = "meldung on err";
        meldung.textContent = err.message || "Das hat nicht geklappt.";
        btn.disabled = false;
        btn.textContent = kontoTab === "reg" ? "Konto anlegen" : "Anmelden";
      }
    };
    return;
  }

  body.innerHTML = `
    ${statusBlock}
    <div class="konto-mail">${esc(konto.email)}</div>
    <div class="knopfreihe" style="margin-top:12px">
      <button class="kbtn" id="btnJetztSync">Jetzt abgleichen</button>
      <button class="kbtn" id="btnLogout">Abmelden</button>
    </div>
    <div class="meldung" id="kontoMeldung"></div>
    <hr class="trenner">
    <details class="mehr">
      <summary>Passwort ändern</summary>
      <form id="pwForm" style="margin-top:8px">
        <div class="feld"><label for="pwAlt">Bisheriges Passwort</label>
          <input type="password" id="pwAlt" autocomplete="current-password" required></div>
        <div class="feld"><label for="pwNeu">Neues Passwort (mind. 8 Zeichen)</label>
          <input type="password" id="pwNeu" autocomplete="new-password" required></div>
        <button class="kbtn dunkel breit" type="submit">Passwort ändern</button>
      </form>
    </details>
    <details class="mehr">
      <summary>Konto löschen</summary>
      <form id="delForm" style="margin-top:8px">
        <p class="lead">Löscht Konto und die dort gespeicherten Ladekarten unwiderruflich.
          Die Karten auf diesem Gerät bleiben erhalten.</p>
        <div class="feld"><label for="delPass">Passwort zur Bestätigung</label>
          <input type="password" id="delPass" autocomplete="current-password" required></div>
        <button class="kbtn warn breit" type="submit">Konto endgültig löschen</button>
      </form>
    </details>`;

  const meldung = $("kontoMeldung");
  const sagen = (text, ok) => { meldung.className = "meldung on " + (ok ? "ok" : "err"); meldung.textContent = text; };

  $("btnJetztSync").onclick = async () => { await abgleichen(false); renderKonto(); };
  $("btnLogout").onclick = async () => {
    try{ await ruf("/api/auth/logout", "POST"); }catch(e){ /* trotzdem abmelden */ }
    konto = null; konflikt = null; speichern();
    setzeSync("lokal", "Abgemeldet — die Karten bleiben auf diesem Gerät.");
    renderKonto();
    toast("Abgemeldet.");
  };
  $("pwForm").onsubmit = async e => {
    e.preventDefault();
    try{
      await ruf("/api/auth/passwort", "POST", {alt:$("pwAlt").value, neu:$("pwNeu").value});
      sagen("Passwort geändert. Andere Geräte wurden abgemeldet.", true);
      $("pwForm").reset();
    }catch(err){ sagen(err.message, false); }
  };
  $("delForm").onsubmit = async e => {
    e.preventDefault();
    if(!confirm("Konto und die dort gespeicherten Ladekarten wirklich löschen?")) return;
    try{
      await ruf("/api/auth/konto", "DELETE", {passwort:$("delPass").value});
      konto = null; serverRev = 0; letzterStand = ""; konflikt = null; speichern();
      setzeSync("lokal", "Konto gelöscht — die Karten bleiben auf diesem Gerät.");
      renderKonto();
      toast("Konto gelöscht.");
    }catch(err){ sagen(err.message, false); }
  };
}

/* ============================================================
   Verdrahtung
   ============================================================ */
function setzeDesign(){
  document.body.classList.toggle("dunkel", istDunkel);
  $("btnDark").classList.toggle("on", istDunkel);
  $("btnSat").classList.toggle("on", istSat);
  document.querySelector('meta[name=theme-color]').setAttribute("content", istDunkel ? "#18211F" : "#FAFAF7");
}

setzeDesign();
initMap();
setSheet("half");
setzeSync("lokal", "Nur auf diesem Gerät gespeichert.");

$("btnDark").onclick = () => { istDunkel = !istDunkel; setzeDesign(); speichern(); };
$("btnSat").onclick = () => { istSat = !istSat; setzeDesign(); setzeBasis(); speichern(); };
$("btnReload").onclick = () => { geladeneBox = null; laden(); };
$("btnHier").onclick = zuStandort;
$("dClose").onclick = schliesseDetail;
$("btnTarife").onclick = () => { renderKarten(); $("modalTarife").classList.add("open"); };
$("btnCloseTarife").onclick = () => $("modalTarife").classList.remove("open");
$("btnKonto").onclick = oeffneKonto;
$("btnCloseKonto").onclick = schliesseKonto;
$("btnAddKarte").onclick = () => {
  const id = Math.max(0, ...KARTEN.map(k => Number(k.id) || 0)) + 1;
  KARTEN.push({id, name:"Neue Karte", farbe:FARBEN[(id-1) % FARBEN.length], stand:"",
    netze:[{cpos:[],label:"Roaming",ac:null,dc:null,hpc:null}], notiz:""});
  renderKarten(); zeichnen(); planeSync();
};
document.querySelectorAll(".modal").forEach(m => m.onclick = e => { if(e.target === m) m.classList.remove("open"); });

window.addEventListener("online", () => { if(konto) abgleichen(true); });
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && konto && syncStatus !== "fehler") abgleichen(true);
});

kontoPruefen();
zuStandort();

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
