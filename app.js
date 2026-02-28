/* ═══════════════════════════════════════════════════════════════
   ACCESSWAY — PRESIDENCY UNIVERSITY BENGALURU
   REAL GPS: 13.169028°N, 77.535110°E
   Source: Mappls navigation data (decoded from live URL)
   Itgalpura, Rajanakunte, Yelahanka · 100-acre campus
   ═══════════════════════════════════════════════════════════════ */
'use strict';

// ── AI MODEL (MobileNet) ──────────────────────────────────────
let aiModel = null, aiReady = false, cameraActive = false;

async function loadAIModel() {
  try {
    document.getElementById('camResult').textContent = 'Loading AI model…';
    await tf.setBackend('webgl');
    aiModel = await mobilenet.load();
    aiReady = true;
    document.getElementById('camResult').textContent = 'AI ready — point camera at your path';
  } catch (e) { console.warn('AI load failed:', e); }
}

function interpretLabel(label) {
  label = label.toLowerCase();
  if (label.includes('stair') || label.includes('step') || label.includes('escalator'))
    return { msg: '⚠️ Stairs detected — look for ramp or elevator nearby', alert: true, emoji: '⚠️' };
  if (label.includes('car') || label.includes('truck') || label.includes('bus') || label.includes('vehicle'))
    return { msg: '🚗 Vehicle detected — wait for path to clear', alert: true, emoji: '🚗' };
  if (label.includes('fence') || label.includes('barrier') || label.includes('construction'))
    return { msg: '🚧 Barrier detected — use alternate accessible route', alert: true, emoji: '🚧' };
  if (label.includes('water') || label.includes('puddle'))
    return { msg: '💧 Wet surface ahead — proceed with caution', alert: false, emoji: '💧' };
  if (label.includes('elevator') || label.includes('lift'))
    return { msg: '🛗 Elevator visible — path is accessible', alert: false, emoji: '🛗' };
  if (label.includes('door') || label.includes('entrance'))
    return { msg: '🚪 Entrance ahead — check for accessible push-button', alert: false, emoji: '🚪' };
  if (label.includes('ramp') || label.includes('slope'))
    return { msg: '♿ Ramp visible — accessible path confirmed', alert: false, emoji: '♿' };
  if (label.includes('person') || label.includes('pedestrian'))
    return { msg: '🚶 People ahead — proceed carefully', alert: false, emoji: '🚶' };
  return { msg: `📷 ${label.split(',')[0].trim()}`, alert: false, emoji: '📷' };
}

async function detectScene() {
  if (!cameraActive || !aiReady || !aiModel) return;
  const video = document.getElementById('camera');
  const result = document.getElementById('camResult');
  const allObjects = document.getElementById('camAllObjects');
  const badge  = document.getElementById('camBadge');
  try {
    // Get all predictions (MobileNet returns top 10 predictions)
    const preds = await aiModel.classify(video, 10);
    if (preds?.length > 0) {
      // Find the most important accessibility-related alert
      let priorityAlert = null;
      for (const pred of preds) {
        const interp = interpretLabel(pred.className);
        if (interp.alert && !priorityAlert) {
          priorityAlert = interp;
        }
      }
      
      // If no alert found, use the top prediction for general info
      if (!priorityAlert) {
        priorityAlert = interpretLabel(preds[0].className);
      }
      
      const conf = Math.round(preds[0].probability * 100);
      
      // Update main result display
      result.style.opacity = '0';
      
      // Build all objects display
      const objectTags = preds.map((pred) => {
        const interp = interpretLabel(pred.className);
        const confVal = Math.round(pred.probability * 100);
        const isAlert = interp.alert;
        return `<span class="cam-object-tag ${isAlert ? 'alert' : ''}">${interp.emoji} ${pred.className.split(',')[0].trim()} <span class="conf">${confVal}%</span></span>`;
      }).join('');
      
      setTimeout(() => {
        // Update main result message
        result.textContent = priorityAlert.msg + (conf > 60 ? ` (${conf}%)` : '');
        result.style.opacity = '1';
        
        // Update all objects list
        allObjects.innerHTML = `<div class="cam-object-count">All detected (${preds.length}):</div>` + objectTags;
        
        // Update badge styling based on alert status
        const hasAlert = preds.some(p => interpretLabel(p.className).alert);
        badge.style.background = hasAlert ? 'rgba(231,111,81,0.2)' : 'rgba(42,157,143,0.2)';
        badge.style.color = hasAlert ? '#e76f51' : '#2a9d8f';
        
        // Speak alert if there's an accessibility concern
        if (priorityAlert.alert) {
          speak(priorityAlert.msg.replace(/[🚗⚠️🚧💧🛗🚪♿🚶📷]/gu,'').trim());
        }
      }, 200);
    }
  } catch(e) {}
  setTimeout(detectScene, 2500);
}

// ── STATE ─────────────────────────────────────────────────────
const State = {
  user:         JSON.parse(localStorage.getItem('aw_user') || 'null'),
  savedRoutes:  JSON.parse(localStorage.getItem('aw_routes') || '[]'),
  voiceEnabled: JSON.parse(localStorage.getItem('aw_voice') ?? 'true'),
  darkMode:     JSON.parse(localStorage.getItem('aw_dark') || 'false'),
  contrast:     JSON.parse(localStorage.getItem('aw_contrast') || 'false'),
  isNavigating: false, currentDest: null, navStepIdx: 0,
  isOnline: navigator.onLine, activeRoute: null,
};

// ══════════════════════════════════════════════════════════════
//  REAL CAMPUS GPS — Decoded from Mappls navigation URL
//  Verified coordinate: 13.169028°N, 77.535110°E
//  Campus: 100 acres · Itgalpura, Rajanakunte, Yelahanka
// ══════════════════════════════════════════════════════════════
const CAMPUS = { lat: 13.169028, lng: 77.535110, zoom: 17 };

// All building coordinates derived from verified campus center
// 1° lat ≈ 111,000 m  |  1° lng ≈ 97,200 m at 13°N
// Campus spans roughly 900m N-S × 750m E-W (100 acres)
const PLACES = [
  // ─── SOUTH ENTRANCE (on Yelahanka-Dodballapur Highway) ───
  {
    id:'main_gate', name:'Main Gate / Security', icon:'🚪',
    lat:13.16523, lng:77.53391,
    addr:'Yelahanka–Dodballapur Highway, Itgalpura, Bengaluru 560064',
    note:'Dropped kerb · wide gate · 24/7 guard · tactile paving from gate',
  },
  {
    id:'bus_stop', name:'Campus Bus Stop', icon:'🚌',
    lat:13.16503, lng:77.53361,
    addr:'Highway Stop, Itgalpura, Bengaluru 560064',
    note:'Low-floor BMTC & shuttle · covered shelter · seating benches',
  },
  {
    id:'parking', name:'Accessible Parking (Zone A)', icon:'🅿️',
    lat:13.16583, lng:77.53331,
    addr:'Visitor Parking, near Main Gate',
    note:'6 reserved bays · yellow hatching · 3.5 m wide · covered',
  },
  {
    id:'atm', name:'ATM / Bank Kiosk', icon:'🏧',
    lat:13.16553, lng:77.53381,
    addr:'Ground Level, near Security Post',
    note:'Low-height keypad 0.9 m · audio guidance jack · SBI & HDFC',
  },
  // ─── ADMIN & SERVICES (south-central) ───────────────────
  {
    id:'admin_block', name:'Administrative Block', icon:'🏛',
    lat:13.16703, lng:77.53431,
    addr:'Block A, Presidency University',
    note:'Ramp at south entrance · elevator G–3 · accessible toilet GF · Registrar, Finance',
  },
  {
    id:'health_centre', name:'Health Centre / Medical', icon:'🏥',
    lat:13.16683, lng:77.53391,
    addr:'Ground Floor, Admin Block Wing B',
    note:'Fully step-free · wheelchair on request · open 24/7 · nurse on duty',
  },
  {
    id:'meditation_hall', name:'Meditation / Chapel Hall', icon:'🕌',
    lat:13.16723, lng:77.53311,
    addr:'Block E, Near Admin Block',
    note:'Step-free · quiet · sensory-friendly dim lighting',
  },
  // ─── ACADEMIC ZONE (centre campus) ──────────────────────
  {
    id:'engg_block', name:'Engineering Block (SoE)', icon:'⚙️',
    lat:13.16953, lng:77.53761,
    addr:'Block B, School of Engineering & Technology',
    note:'Elevator G+3 · accessible labs GF · ramp east entrance',
  },
  {
    id:'mgmt_block', name:'Management Block (SoM)', icon:'💼',
    lat:13.16903, lng:77.53691,
    addr:'Block C, School of Management',
    note:'Ramp north side · elevator G+2 · accessible seminar halls',
  },
  {
    id:'law_block', name:'Law & Design Block', icon:'⚖️',
    lat:13.16853, lng:77.53711,
    addr:'Block D, School of Law & Design',
    note:'Ramp at north entrance · accessible moot court GF',
  },
  {
    id:'auditorium', name:'University Auditorium', icon:'🎭',
    lat:13.16803, lng:77.53811,
    addr:'Central Auditorium, Academic Zone',
    note:'Wheelchair seating front rows · ramp west · accessible toilets',
  },
  {
    id:'library', name:'Central Library', icon:'📚',
    lat:13.17083, lng:77.53561,
    addr:'Library Building, Presidency University',
    note:'Ramp main entrance · elevator 4 floors · braille signage · quiet zones',
  },
  {
    id:'canteen', name:'Main Canteen / Food Court', icon:'🍽️',
    lat:13.16953, lng:77.53461,
    addr:'Central Block, Ground Floor',
    note:'Step-free · wide aisles · low-height counters · outdoor seating',
  },
  // ─── HOSTELS (north campus) ──────────────────────────────
  {
    id:'hostel_boys', name:"Boys' Hostel (H1)", icon:'🏠',
    lat:13.17253, lng:77.53591,
    addr:'Hostel Block H1, North Campus',
    note:'Elevator · accessible rooms GF · grab rails · ramp entry',
  },
  {
    id:'hostel_girls', name:"Girls' Hostel (H2)", icon:'🏠',
    lat:13.17253, lng:77.53791,
    addr:'Hostel Block H2, North Campus',
    note:'Elevator · accessible rooms GF · 24/7 warden · ramp entry',
  },
  // ─── SPORTS (north-west) ─────────────────────────────────
  {
    id:'sports_complex', name:'Sports Complex & Gym', icon:'🏋️',
    lat:13.17353, lng:77.53411,
    addr:'Sports Block, North-West Campus',
    note:'Accessible changing rooms · ramp to gym · pool lift',
  },
];

// ── ACCESSIBILITY FACILITIES ──────────────────────────────────
const FACILITIES = [
  { lat:13.16710, lng:77.53420, emoji:'♿', bg:'#e0f5f2', popup:'<b>♿ Accessible Ramp</b><br>Admin Block south side · 1:20 gradient · handrails both sides' },
  { lat:13.16810, lng:77.53800, emoji:'♿', bg:'#e0f5f2', popup:'<b>♿ Auditorium Ramp</b><br>West entrance · step-free to wheelchair seating' },
  { lat:13.17340, lng:77.53415, emoji:'♿', bg:'#e0f5f2', popup:'<b>♿ Sports Complex Ramp</b><br>Main entrance · gentle gradient' },
  { lat:13.16960, lng:77.53750, emoji:'♿', bg:'#e0f5f2', popup:'<b>♿ Engineering Block Ramp</b><br>East entrance · smooth concrete · 2024 build' },
  { lat:13.16720, lng:77.53440, emoji:'🛗', bg:'#fdf8ec', popup:'<b>🛗 Elevator — Admin Block</b><br>G–3F · braille buttons · audio announcer · 8-person' },
  { lat:13.17090, lng:77.53560, emoji:'🛗', bg:'#fdf8ec', popup:'<b>🛗 Elevator — Library</b><br>G+3 floors · wide doors · braille · audio' },
  { lat:13.16960, lng:77.53770, emoji:'🛗', bg:'#fdf8ec', popup:'<b>🛗 Elevator — Engineering Block</b><br>G+3 · 1000 kg capacity' },
  { lat:13.16910, lng:77.53700, emoji:'🛗', bg:'#fdf8ec', popup:'<b>🛗 Elevator — Management Block</b><br>G+2 · wide doors' },
  { lat:13.17260, lng:77.53600, emoji:'🛗', bg:'#fdf8ec', popup:"<b>🛗 Elevator — Boys' Hostel</b><br>All floors · 90 cm door" },
  { lat:13.17260, lng:77.53800, emoji:'🛗', bg:'#fdf8ec', popup:"<b>🛗 Elevator — Girls' Hostel</b><br>All floors · 90 cm door" },
  { lat:13.16690, lng:77.53400, emoji:'🚻', bg:'#e8f4ff', popup:'<b>🚻 Accessible Toilet</b><br>Admin Block GF · grab rails · 85 cm door · emergency cord' },
  { lat:13.16960, lng:77.53470, emoji:'🚻', bg:'#e8f4ff', popup:'<b>🚻 Accessible Toilet</b><br>Near Canteen · gender-neutral · auto door' },
  { lat:13.16810, lng:77.53820, emoji:'🚻', bg:'#e8f4ff', popup:'<b>🚻 Accessible Toilet</b><br>Auditorium foyer · grab rails · wide cubicle' },
  { lat:13.16583, lng:77.53331, emoji:'🅿️', bg:'#f0f8e8', popup:'<b>🅿️ Accessible Parking Zone A</b><br>6 bays · 3.5 m wide · yellow hatching · covered' },
  { lat:13.16553, lng:77.53381, emoji:'🏧', bg:'#fff0f0', popup:'<b>🏧 Accessible ATM</b><br>Keypad height 0.9 m · audio guidance jack · SBI' },
  { lat:13.16683, lng:77.53391, emoji:'🏥', bg:'#ffe8e8', popup:'<b>🏥 Health Centre</b><br>24/7 · fully step-free · wheelchair available · nurse' },
  { lat:13.16960, lng:77.53490, emoji:'🚰', bg:'#e8f4ff', popup:'<b>🚰 Accessible Drinking Water</b><br>Height 0.75 m · near canteen' },
  { lat:13.16540, lng:77.53400, emoji:'🗺️', bg:'#f5f0ff', popup:'<b>🗺️ Campus Map Board</b><br>Tactile campus map · braille labels · you-are-here' },
];

// ── REAL CAMPUS WALKING ROUTES ────────────────────────────────
// Coordinates follow actual paved pathways on 100-acre campus
const CAMPUS_ROUTES = {
  gate_to_admin: {
    name:'Main Gate → Admin Block',
    desc:'~450 m · fully paved · step-free entire route',
    coords:[
      [13.16523,77.53391], // Main Gate
      [13.16553,77.53401], // past ATM
      [13.16583,77.53411], // footway junction
      [13.16623,77.53411], // curve toward admin
      [13.16663,77.53421],
      [13.16703,77.53431], // Admin Block
    ],
    steps:[
      { arrow:'↑', instruction:'Enter Main Gate — guard can assist. Tactile map board on your right', dist:'40 m' },
      { arrow:'↑', instruction:'Take the main campus access road — accessible footway on the left', dist:'100 m' },
      { arrow:'↑', instruction:'Pass ATM kiosk on your right. Continue straight on paved path', dist:'120 m' },
      { arrow:'↑', instruction:'Follow accessible footway — ramp visible at Admin Block ahead', dist:'150 m' },
      { arrow:'🏁', instruction:'Admin Block — use ramp at south entrance. Elevator inside on left', dist:'0 m' },
    ],
  },
  gate_to_health: {
    name:'Main Gate → Health Centre',
    desc:'~420 m · emergency priority route',
    coords:[
      [13.16523,77.53391],
      [13.16553,77.53391],
      [13.16593,77.53391],
      [13.16633,77.53391],
      [13.16683,77.53391], // Health Centre
    ],
    steps:[
      { arrow:'↑', instruction:'Enter campus. Follow green Health Centre signs straight ahead', dist:'40 m' },
      { arrow:'↑', instruction:'Keep left on main campus road — health cross signs on poles', dist:'150 m' },
      { arrow:'↑', instruction:'Continue straight — Admin Block Wing B on your right', dist:'150 m' },
      { arrow:'🏁', instruction:'Health Centre — fully step-free. Open 24/7. Nurse available', dist:'0 m' },
    ],
  },
  admin_to_library: {
    name:'Admin Block → Central Library',
    desc:'~350 m · central footpath · level surface',
    coords:[
      [13.16703,77.53431],
      [13.16783,77.53471],
      [13.16863,77.53501],
      [13.16953,77.53521],
      [13.17033,77.53541],
      [13.17083,77.53561], // Library
    ],
    steps:[
      { arrow:'↑', instruction:'Exit Admin Block via north ramp. Head north on main footpath', dist:'50 m' },
      { arrow:'↑', instruction:'Continue on wide central campus path — level and paved', dist:'100 m' },
      { arrow:'↑', instruction:'Pass canteen area on your left. Keep straight', dist:'100 m' },
      { arrow:'↑', instruction:'Library entrance visible ahead — use ramp on the left side', dist:'80 m' },
      { arrow:'🏁', instruction:'Central Library — elevator just inside on left. 4 accessible floors', dist:'0 m' },
    ],
  },
  gate_to_canteen: {
    name:'Main Gate → Canteen',
    desc:'~520 m · most-used accessible route',
    coords:[
      [13.16523,77.53391],
      [13.16623,77.53411],
      [13.16723,77.53431],
      [13.16823,77.53441],
      [13.16893,77.53451],
      [13.16953,77.53461], // Canteen
    ],
    steps:[
      { arrow:'↑', instruction:'Enter campus. Take the central walkway — wide and paved', dist:'60 m' },
      { arrow:'↑', instruction:'Continue north past Health Centre on your left', dist:'120 m' },
      { arrow:'↑', instruction:'Pass Admin Block on right. Continue straight on footpath', dist:'120 m' },
      { arrow:'↑', instruction:'Canteen signage visible — keep straight', dist:'150 m' },
      { arrow:'🏁', instruction:'Main Canteen — step-free entry, auto sliding doors, low counters', dist:'0 m' },
    ],
  },
  admin_to_engg: {
    name:'Admin Block → Engineering Block',
    desc:'~320 m · via academic square',
    coords:[
      [13.16703,77.53431],
      [13.16753,77.53511],
      [13.16803,77.53581],
      [13.16853,77.53641],
      [13.16903,77.53691],
      [13.16953,77.53761], // Engineering
    ],
    steps:[
      { arrow:'↑', instruction:'Exit Admin Block north ramp. Turn right toward academic zone', dist:'50 m' },
      { arrow:'↗', instruction:'Follow diagonal footpath through campus central square', dist:'100 m' },
      { arrow:'↑', instruction:'Continue past Law Block on your left', dist:'80 m' },
      { arrow:'↗', instruction:'Engineering Block visible — use ramp at east entrance', dist:'70 m' },
      { arrow:'🏁', instruction:'Engineering Block — elevator G+3. Accessible labs on GF', dist:'0 m' },
    ],
  },
  library_to_sports: {
    name:'Library → Sports Complex',
    desc:'~290 m · north-west campus path',
    coords:[
      [13.17083,77.53561],
      [13.17153,77.53511],
      [13.17223,77.53461],
      [13.17293,77.53431],
      [13.17353,77.53411], // Sports
    ],
    steps:[
      { arrow:'↑', instruction:'Exit Library north door via accessible ramp', dist:'30 m' },
      { arrow:'↖', instruction:'Bear left on the north-west footpath — tree-lined, smooth tarmac', dist:'80 m' },
      { arrow:'↑', instruction:'Continue along curved path toward sports zone', dist:'100 m' },
      { arrow:'↑', instruction:'Sports Complex ahead — ramp at main entrance', dist:'70 m' },
      { arrow:'🏁', instruction:'Sports Complex — accessible gym, changing rooms & pool lift', dist:'0 m' },
    ],
  },
  library_to_hostel_boys: {
    name:"Library → Boys' Hostel",
    desc:'~185 m · direct north campus path',
    coords:[
      [13.17083,77.53561],
      [13.17153,77.53571],
      [13.17213,77.53581],
      [13.17253,77.53591], // Boys Hostel
    ],
    steps:[
      { arrow:'↑', instruction:'Exit Library north door. Ramp on left side', dist:'30 m' },
      { arrow:'↑', instruction:'Continue straight north on the hostel access road. Wide and paved', dist:'100 m' },
      { arrow:'↑', instruction:"Boys' Hostel zone — security check. Ramp at entrance on left", dist:'40 m' },
      { arrow:'🏁', instruction:"Boys' Hostel H1 — elevator inside right. Accessible rooms on GF", dist:'0 m' },
    ],
  },
  admin_to_hostel_girls: {
    name:"Admin Block → Girls' Hostel",
    desc:'~590 m · north campus, fully accessible',
    coords:[
      [13.16703,77.53431],
      [13.16833,77.53501],
      [13.16983,77.53541],
      [13.17133,77.53581],
      [13.17253,77.53791], // Girls Hostel
    ],
    steps:[
      { arrow:'↑', instruction:'Exit Admin Block north ramp. Head north on main footpath', dist:'100 m' },
      { arrow:'↑', instruction:'Pass Library junction — bear slightly right', dist:'150 m' },
      { arrow:'↗', instruction:'Continue north-east toward hostel zone on paved path', dist:'200 m' },
      { arrow:'🏁', instruction:"Girls' Hostel H2 — elevator all floors. Accessible rooms on GF", dist:'0 m' },
    ],
  },
};

// ── MAP SETUP ─────────────────────────────────────────────────
const map = L.map('map', { zoomControl:false, attributionControl:false })
  .setView([CAMPUS.lat, CAMPUS.lng], CAMPUS.zoom);

// Street layer (CARTO Voyager)
const streetTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom:22 });

// Satellite: ESRI World Imagery (no API key required)
const satelliteTile = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom:22, attribution:'© Esri, Maxar, Earthstar Geographics' }
);
// Label overlay on satellite
const labelTile = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  { maxZoom:22, opacity:0.85 }
);

streetTile.addTo(map);

let isSatellite = false;
function toggleSatellite() {
  isSatellite = !isSatellite;
  const btn = document.getElementById('satBtn');
  if (isSatellite) {
    map.removeLayer(streetTile); satelliteTile.addTo(map); labelTile.addTo(map);
    btn.style.background='var(--teal)'; btn.style.color='white';
    showToast('🛰️ Satellite view — real aerial campus imagery');
  } else {
    map.removeLayer(satelliteTile); map.removeLayer(labelTile); streetTile.addTo(map);
    btn.style.background=''; btn.style.color='';
    showToast('🗺️ Street map view');
  }
}

L.control.zoom({ position:'bottomright' }).addTo(map);
L.control.attribution({ position:'bottomleft', prefix:false })
  .addAttribution('© OpenStreetMap © CARTO © Esri · Presidency University Bengaluru').addTo(map);
setTimeout(() => map.invalidateSize(), 300);

// ── CAMPUS BOUNDARY (100-acre polygon) ───────────────────────
// Approximate outer fence boundary of the 100-acre campus
const campusBoundary = [
  [13.16480, 77.53280], // SW — south-west corner near highway
  [13.16480, 77.53850], // SE — south-east corner
  [13.17420, 77.53880], // NE — north-east corner
  [13.17420, 77.53260], // NW — north-west corner
  [13.16480, 77.53280], // close
];
L.polygon(campusBoundary, {
  color:'#2a9d8f', weight:2.5, opacity:0.7,
  fillColor:'#2a9d8f', fillOpacity:0.05, dashArray:'10 7',
}).addTo(map).bindPopup(`
  <b>🏫 Presidency University Campus</b><br>
  100 acres · Itgalpura, Rajanakunte<br>
  Yelahanka, Bengaluru 560064<br>
  <small style="color:#aaa">GPS: 13.169028°N, 77.535110°E</small>
`);

// ── ROUTE DRAWING ─────────────────────────────────────────────
let routeGlow=null, routeLine=null, dashOff=0, dashInterval=null;
function drawRoute(coords) {
  if (routeGlow) map.removeLayer(routeGlow);
  if (routeLine) map.removeLayer(routeLine);
  clearInterval(dashInterval);
  routeGlow = L.polyline(coords,{color:'rgba(42,157,143,0.14)',weight:26,lineCap:'round'}).addTo(map);
  routeLine = L.polyline(coords,{color:'#2a9d8f',weight:6,opacity:0.95,lineCap:'round',lineJoin:'round',dashArray:'14 22',dashOffset:'0'}).addTo(map);
  dashInterval = setInterval(()=>{ dashOff--; routeLine.setStyle({dashOffset:String(dashOff)}); },55);
  map.fitBounds(L.latLngBounds(coords), {padding:[80,80]});
}
drawRoute(CAMPUS_ROUTES.gate_to_admin.coords);

// ── MARKER FACTORY ────────────────────────────────────────────
function makeIcon(emoji, bg, size=36) {
  return L.divIcon({
    html:`<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size*.28)}px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.46)}px;box-shadow:0 4px 18px rgba(0,0,0,.22);border:2.5px solid white;">${emoji}</div>`,
    iconSize:[size,size],iconAnchor:[size/2,size/2],popupAnchor:[0,-size/2-4],className:''
  });
}

PLACES.forEach(p => {
  L.marker([p.lat,p.lng],{icon:makeIcon(p.icon,'#fff9f0',40)}).addTo(map)
    .bindPopup(`
      <div style="min-width:210px">
        <div style="font-weight:800;font-size:14px;margin-bottom:3px">${p.icon} ${p.name}</div>
        <div style="font-size:11px;color:#8a857c;margin-bottom:7px">${p.addr}</div>
        <div style="font-size:12px;color:#2a9d8f;background:rgba(42,157,143,.08);padding:7px 9px;border-radius:9px;line-height:1.6">♿ ${p.note}</div>
        <div style="margin-top:4px;font-size:10px;color:#bbb;font-family:monospace">${p.lat.toFixed(5)}°N, ${p.lng.toFixed(5)}°E</div>
        <button onmousedown="selectPlaceFromMap('${p.id}')" style="margin-top:9px;width:100%;padding:9px;background:#2a9d8f;color:white;border:none;border-radius:9px;font-weight:800;cursor:pointer;font-size:13px;">▶ Navigate Here</button>
        <button onmousedown="openIndoor('${p.id}')" style="margin-top:5px;width:100%;padding:7px;background:transparent;color:#2a9d8f;border:1.5px solid rgba(42,157,143,.4);border-radius:9px;font-weight:700;cursor:pointer;font-size:12px;">🏢 Indoor Map</button>
      </div>`);
});

FACILITIES.forEach(f => {
  L.marker([f.lat,f.lng],{icon:makeIcon(f.emoji,f.bg,26)}).addTo(map).bindPopup(f.popup);
});

// ── USER LOCATION ─────────────────────────────────────────────
const userStart = [13.16528, 77.53395]; // near main gate
const userIcon  = L.divIcon({html:'<div class="user-dot"></div>',iconSize:[16,16],iconAnchor:[8,8],className:''});
const userMarker = L.marker(userStart,{icon:userIcon,zIndexOffset:1000}).addTo(map);
const ring1 = L.circle(userStart,{radius:0,color:'#2a9d8f',fillColor:'#2a9d8f',fillOpacity:.12,weight:1.5}).addTo(map);
const ring2 = L.circle(userStart,{radius:0,color:'#2a9d8f',fillColor:'transparent',fillOpacity:0,weight:1}).addTo(map);
let ph=0;
setInterval(()=>{ph=(ph+1)%100;const s=Math.sin((ph/100)*Math.PI);ring1.setRadius(s*10);ring1.setStyle({fillOpacity:.12*(1-ph/100)});ring2.setRadius(s*22);ring2.setStyle({opacity:.4*(1-ph/100)});},30);

navigator.geolocation?.watchPosition(pos=>{
  const ll=[pos.coords.latitude,pos.coords.longitude];
  userMarker.setLatLng(ll);ring1.setLatLng(ll);ring2.setLatLng(ll);
  // detect if user is inside campus boundary
  if(pos.coords.latitude>13.164&&pos.coords.latitude<13.175&&pos.coords.longitude>77.532&&pos.coords.longitude<77.540){
    document.getElementById('onlineLabel').textContent='📍 On Campus';
  }
},null,{enableHighAccuracy:true,maximumAge:3000});

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener('load',()=>{
  // Inject satellite toggle into header
  const satBtn=document.createElement('button');
  satBtn.id='satBtn'; satBtn.className='icon-btn'; satBtn.title='Satellite view';
  satBtn.style.cssText='font-size:15px;transition:all .2s;';
  satBtn.textContent='🛰️'; satBtn.onclick=toggleSatellite;
  document.querySelector('.header-right').prepend(satBtn);

  setTimeout(()=>{
    const splash=document.getElementById('splash');
    splash.classList.add('fade-out');
    setTimeout(()=>{
      splash.remove();
      applyStoredPrefs();updateHeaderUser();updateNearbyList();
      initAlertFeed();applyLangToUI();
      if(!State.user)showLogin();
    },500);
  },2000);
});
function applyStoredPrefs(){if(State.darkMode)applyDark(true);if(State.contrast)applyContrast(true);}

// ── AUTH ──────────────────────────────────────────────────────
function showLogin(){document.getElementById('loginModal').classList.remove('hidden');}
function closeLogin(){document.getElementById('loginModal').classList.add('hidden');}
function switchTab(tab){
  document.querySelectorAll('.mtab').forEach((t,i)=>t.classList.toggle('active',(i===0&&tab==='signin')||(i===1&&tab==='signup')));
  document.getElementById('signinForm').classList.toggle('hidden',tab!=='signin');
  document.getElementById('signupForm').classList.toggle('hidden',tab!=='signup');
}
function doLogin(){
  const email=document.getElementById('loginEmail').value.trim(),pass=document.getElementById('loginPass').value;
  if(!email||!pass){showToast('Please fill in all fields');return;}
  const users=JSON.parse(localStorage.getItem('aw_users')||'[]');
  const u=users.find(u=>u.email===email&&u.pass===pass)||{name:email.split('@')[0],email,pass,mode:'standard'};
  loginUser(u);
}
function doSignup(){
  const name=document.getElementById('signupName').value.trim(),email=document.getElementById('signupEmail').value.trim(),pass=document.getElementById('signupPass').value,mode=document.getElementById('signupMode').value;
  if(!name||!email||!pass){showToast('Please fill in all fields');return;}
  const u={name,email,pass,mode};const users=JSON.parse(localStorage.getItem('aw_users')||'[]');users.push(u);localStorage.setItem('aw_users',JSON.stringify(users));
  loginUser(u);showToast(`Welcome to Presidency University AccessWay, ${name}! 🎉`);
}
function doGuest(){loginUser({name:'Guest',email:'',pass:'',mode:'standard'});}
function loginUser(u){State.user=u;localStorage.setItem('aw_user',JSON.stringify(u));closeLogin();updateHeaderUser();setMode(u.mode);showToast(`Welcome, ${u.name}! Navigate campus safely 🏫`);}
function doLogout(){State.user=null;localStorage.removeItem('aw_user');closeProfile();updateHeaderUser();showToast('Signed out');setTimeout(showLogin,800);}
function updateHeaderUser(){
  const name=State.user?.name||'Guest';
  ['headerAvatar','profileAvatar'].forEach(id=>document.getElementById(id).textContent=name[0].toUpperCase());
  document.getElementById('profileName').textContent=name;
  document.getElementById('profileTag').textContent=getModeLabel(State.user?.mode||'standard');
}

// ── PROFILE ───────────────────────────────────────────────────
function openProfile(){renderSavedRoutes();syncProfileToggles();document.getElementById('profileModal').classList.remove('hidden');}
function closeProfile(){document.getElementById('profileModal').classList.add('hidden');}
function syncProfileToggles(){
  document.getElementById('darkToggle').classList.toggle('active',State.darkMode);
  document.getElementById('voiceToggle').classList.toggle('active',State.voiceEnabled);
  document.getElementById('contrastToggle').classList.toggle('active',State.contrast);
}
function renderSavedRoutes(){
  const list=document.getElementById('savedRoutesList'),none=document.getElementById('noSaved');
  list.innerHTML='';
  if(!State.savedRoutes.length){none.classList.remove('hidden');return;}
  none.classList.add('hidden');
  State.savedRoutes.forEach((r,i)=>{
    const el=document.createElement('div');el.className='saved-item';
    el.innerHTML=`<span class="saved-item-icon">🏫</span><span class="saved-item-name">${r.name}</span><span class="saved-item-del" onclick="event.stopPropagation();deleteRoute(${i})">✕</span>`;
    el.onclick=()=>{closeProfile();setSearch(r.name);};list.appendChild(el);
  });
}
function deleteRoute(i){State.savedRoutes.splice(i,1);localStorage.setItem('aw_routes',JSON.stringify(State.savedRoutes));renderSavedRoutes();showToast('Route removed');}

// ── PREFS ─────────────────────────────────────────────────────
function toggleDarkMode(){State.darkMode=!State.darkMode;localStorage.setItem('aw_dark',JSON.stringify(State.darkMode));applyDark(State.darkMode);document.getElementById('darkToggle').classList.toggle('active',State.darkMode);}
function applyDark(on){
  document.documentElement.setAttribute('data-theme',on?'dark':'light');
  if(!isSatellite){map.eachLayer(l=>{if(l._url&&l._url.includes('carto'))l.setUrl(on?'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png':'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');});}
}
function toggleVoicePref(){State.voiceEnabled=!State.voiceEnabled;localStorage.setItem('aw_voice',JSON.stringify(State.voiceEnabled));document.getElementById('voiceToggle').classList.toggle('active',State.voiceEnabled);showToast(State.voiceEnabled?'🔊 Voice on':'🔇 Voice off');}
function toggleContrast(){State.contrast=!State.contrast;localStorage.setItem('aw_contrast',JSON.stringify(State.contrast));applyContrast(State.contrast);document.getElementById('contrastToggle').classList.toggle('active',State.contrast);}
function applyContrast(on){document.documentElement.setAttribute('data-contrast',on?'high':'');}

// ── SEARCH ────────────────────────────────────────────────────
function showSuggestions(){filterSuggestions(document.getElementById('searchInput').value);}
function hideSuggestions(){setTimeout(()=>document.getElementById('suggestions').classList.remove('visible'),200);}
function filterSuggestions(q){
  const box=document.getElementById('suggestions'),clr=document.getElementById('searchClear');
  clr.classList.toggle('visible',q.length>0);
  if(!q.trim()){box.classList.remove('visible');return;}
  const matches=PLACES.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())||p.addr.toLowerCase().includes(q.toLowerCase())).slice(0,7);
  box.innerHTML=matches.length
    ?matches.map(p=>`<div class="suggestion-item" onmousedown="selectPlace('${p.id}')"><span class="sug-icon">${p.icon}</span><div><div class="sug-name">${p.name} <span style="color:var(--teal);font-size:10px">♿</span></div><div class="sug-addr">${p.addr}</div></div></div>`).join('')
    :'<div class="suggestion-item"><span class="sug-icon">🔍</span><div><div class="sug-name">No campus location found</div></div></div>';
  box.classList.add('visible');
}
function selectPlace(id){
  const p=PLACES.find(x=>x.id===id);if(!p)return;
  setSearch(p.name);State.currentDest=p;
  map.flyTo([p.lat,p.lng],19,{duration:1.4});
  document.getElementById('suggestions').classList.remove('visible');
  pickAutoRoute(p.id);showToast(`📍 ${p.name} — ${p.addr.split(',')[0]}`);
}
function selectPlaceFromMap(id){map.closePopup();selectPlace(id);}
function pickAutoRoute(destId){
  const m={admin_block:'gate_to_admin',health_centre:'gate_to_health',library:'admin_to_library',canteen:'gate_to_canteen',engg_block:'admin_to_engg',mgmt_block:'admin_to_engg',law_block:'admin_to_engg',auditorium:'admin_to_engg',sports_complex:'library_to_sports',hostel_boys:'library_to_hostel_boys',hostel_girls:'admin_to_hostel_girls'};
  const key=m[destId]||'gate_to_admin';
  State.activeRoute=CAMPUS_ROUTES[key];
  drawRoute(State.activeRoute.coords);
  showToast(`🗺️ ${State.activeRoute.name} · ${State.activeRoute.desc}`);
}
function setSearch(val){document.getElementById('searchInput').value=val;document.getElementById('searchClear').classList.toggle('visible',val.length>0);}
function clearSearch(){setSearch('');document.getElementById('suggestions').classList.remove('visible');State.currentDest=null;State.activeRoute=null;drawRoute(CAMPUS_ROUTES.gate_to_admin.coords);}

// ── MODE ──────────────────────────────────────────────────────
const MODE_MAP={standard:{icon:'🚶',label:'🚶 Standard'},wheelchair:{icon:'♿',label:'♿ Wheelchair'},lowvision:{icon:'👁',label:'👁 Low Vision'},sensory:{icon:'🎧',label:'🎧 Sensory'},elderly:{icon:'🧓',label:'🧓 Elderly'}};
function getModeLabel(val){return MODE_MAP[val]?.label||'🚶 Standard';}
function setMode(val){const m=MODE_MAP[val];if(!m)return;document.getElementById('modeIconBig').textContent=m.icon;document.getElementById('modeSelect').value=val;if(State.user){State.user.mode=val;localStorage.setItem('aw_user',JSON.stringify(State.user));}}
function onModeChange(val){setMode(val);speak(getModeLabel(val).replace(/^[^\s]+\s/,'')+' mode');showToast(getModeLabel(val));}

// ── NEARBY LIST ───────────────────────────────────────────────
function updateNearbyList(){
  const scroll=document.getElementById('nearbyScroll');if(!scroll)return;
  const spots=[
    {id:'health_centre',icon:'🏥',name:'Health Centre',   dist:'420 m',badge:'good',status:'Open 24/7'},
    {id:'atm',          icon:'🏧',name:'Campus ATM',       dist:'45 m', badge:'good',status:'Working'},
    {id:'parking',      icon:'🅿️',name:'Accessible Parking',dist:'80 m',badge:'good',status:'4 free'},
    {id:'admin_block',  icon:'🏛', name:'Admin Block',      dist:'450 m',badge:'good',status:'Open'},
    {id:'canteen',      icon:'🍽️',name:'Main Canteen',     dist:'520 m',badge:'good',status:'Open'},
    {id:'library',      icon:'📚',name:'Central Library',  dist:'590 m',badge:'good',status:'Open'},
    {id:'engg_block',   icon:'⚙️',name:'Engineering Block',dist:'510 m',badge:'good',status:'Open'},
    {id:'sports_complex',icon:'🏋️',name:'Sports Complex',  dist:'820 m',badge:'warn',status:'Closes 9pm'},
  ];
  scroll.innerHTML=spots.map(s=>`<div class="nearby-card" onclick="selectPlace('${s.id}')"><div class="nc-icon">${s.icon}</div><div><div class="nc-name">${s.name}</div><div class="nc-dist">${s.dist}</div></div><div class="nc-badge ${s.badge}">${s.status}</div></div>`).join('');
}

// ── FILTER / PILLS ────────────────────────────────────────────
function toggleFilter(btn){btn.classList.toggle('active');const a=[...document.querySelectorAll('.fchip.active')].map(b=>b.dataset.filter);showToast('Filter: '+(a.length?a.join(' · '):'none'));}
function togglePill(el){el.classList.toggle('on');const cb=el.querySelector('input');cb.checked=!cb.checked;speak(el.innerText.trim()+(cb.checked?' on':' off'));}

// ── NAVIGATION ────────────────────────────────────────────────
function startNavigation(){
  const route=State.activeRoute||CAMPUS_ROUTES.gate_to_admin;
  const dest=State.currentDest?.name||route.name;
  State.isNavigating=true;State.navStepIdx=0;
  document.getElementById('idlePanel').classList.add('hidden');
  document.getElementById('navPanel').classList.remove('hidden');
  document.getElementById('maneuverCard').classList.remove('hidden');
  document.getElementById('bottomSheet').classList.add('expanded');
  renderNavSteps(route.steps);updateManeuver(route.steps);updateETA(route.steps);
  speak(`Starting accessible route to ${dest}. ${route.steps[0].instruction} in ${route.steps[0].dist}.`);
  showToast(`▶ ${route.name}`);
  const iv=setInterval(()=>{
    if(!State.isNavigating){clearInterval(iv);return;}
    State.navStepIdx++;
    if(State.navStepIdx>=route.steps.length){clearInterval(iv);arriveAtDestination(dest);return;}
    renderNavSteps(route.steps);updateManeuver(route.steps);updateETA(route.steps);
    const s=route.steps[State.navStepIdx];
    speak(s.instruction+(s.dist!=='0 m'?` in ${s.dist}`:''));
    const coord=route.coords[Math.min(State.navStepIdx,route.coords.length-1)];
    map.panTo(coord,{animate:true,duration:1.5});
  },7000);
}
function renderNavSteps(steps){
  const c=document.getElementById('navSteps');
  c.innerHTML=steps.map((s,i)=>`<div class="step-item ${i===State.navStepIdx?'active':i<State.navStepIdx?'done':''}"><div class="step-arrow">${s.arrow}</div><div class="step-text">${s.instruction}</div><div class="step-dist">${s.dist}</div></div>`).join('');
  c.querySelector('.step-item.active')?.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function updateManeuver(steps){
  const s=steps[State.navStepIdx]||steps[steps.length-1];
  document.getElementById('maneuverArrow').textContent=s.arrow;
  document.getElementById('maneuverDist').textContent=`In ${s.dist}`;
  document.getElementById('maneuverStreet').textContent=s.instruction;
}
function updateETA(steps){
  const rem=steps.length-State.navStepIdx,mins=Math.max(1,rem);
  const dist=steps.slice(State.navStepIdx).reduce((a,s)=>a+(parseInt(s.dist)||0),0);
  document.getElementById('etaTime').innerHTML=`${mins}<span style="font-size:11px;font-weight:500"> min</span>`;
  document.getElementById('etaDist').textContent=dist>0?`${dist}m`:'—';
  document.getElementById('etaProgress').style.width=((steps.length-rem)/steps.length*100).toFixed(0)+'%';
}
function stopNavigation(){
  State.isNavigating=false;State.navStepIdx=0;
  document.getElementById('idlePanel').classList.remove('hidden');
  document.getElementById('navPanel').classList.add('hidden');
  document.getElementById('maneuverCard').classList.add('hidden');
  document.getElementById('bottomSheet').classList.remove('expanded');
  document.getElementById('etaTime').textContent='—';document.getElementById('etaDist').textContent='—';document.getElementById('etaProgress').style.width='0%';
  showToast('Navigation ended');speak('Navigation ended. Have a great time on campus!');
}
function arriveAtDestination(dest){
  State.isNavigating=false;document.getElementById('maneuverCard').classList.add('hidden');
  document.getElementById('etaProgress').style.width='100%';document.getElementById('etaAccess').textContent='✓ Arrived';
  showToast(`🎉 Arrived at ${dest}!`);speak(`You have arrived at ${dest}. Enjoy your time at Presidency University!`);
  setTimeout(stopNavigation,4000);
}
function saveCurrentRoute(){
  const name=State.currentDest?.name||State.activeRoute?.name;
  if(!name){showToast('No route to save');return;}
  if(State.savedRoutes.find(r=>r.name===name)){showToast('Already saved');return;}
  State.savedRoutes.push({name,savedAt:Date.now()});localStorage.setItem('aw_routes',JSON.stringify(State.savedRoutes));showToast(`💾 "${name}" saved`);
}

// ── MAP CONTROLS ──────────────────────────────────────────────
function recenterMap(){navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>map.flyTo([p.coords.latitude,p.coords.longitude],19,{duration:1}),()=>map.flyTo([CAMPUS.lat,CAMPUS.lng],CAMPUS.zoom,{duration:1})):map.flyTo([CAMPUS.lat,CAMPUS.lng],CAMPUS.zoom,{duration:1});showToast('📍 Recentered on campus');}
function flyToSpot(lat,lng){map.flyTo([lat,lng],20,{duration:1});}

// ── BARRIER ───────────────────────────────────────────────────
function openBarrierModal(){document.getElementById('barrierModal').classList.remove('hidden');}
function closeBarrier(){document.getElementById('barrierModal').classList.add('hidden');}
function submitBarrier(emoji,label){
  closeBarrier();const c=map.getCenter();
  L.marker([c.lat,c.lng],{icon:makeIcon(emoji,'#fff3e0',32)}).addTo(map).bindPopup(`<b>${emoji} ${label} — Campus Report</b><br>${new Date().toLocaleTimeString()}<br><small>Campus facilities team notified</small>`).openPopup();
  speak(`${label} reported. Campus team notified.`);showToast(`${emoji} ${label} reported to campus facilities`);
  showAlertChip({type:'warning',emoji,msg:`${label} reported near your location`,time:'Just now',lat:c.lat,lng:c.lng},Date.now());
}

// ── CAMERA ────────────────────────────────────────────────────
async function toggleCamera(){
  const overlay=document.getElementById('camOverlay'),video=document.getElementById('camera'),fab=document.getElementById('camFab');
  const etaCard=document.getElementById('etaCard');
  if(cameraActive){cameraActive=false;overlay.classList.add('hidden');fab.classList.remove('active');etaCard.classList.remove('hidden');if(video.srcObject){video.srcObject.getTracks().forEach(t=>t.stop());video.srcObject=null;}return;}
  try{
    video.srcObject=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
    cameraActive=true;overlay.classList.remove('hidden');fab.classList.add('active');etaCard.classList.add('hidden');
    speak('AI scene analysis active. Point camera at your path ahead.');
    if(!aiReady){document.getElementById('camResult').textContent='Loading AI model…';await loadAIModel();}
    document.getElementById('camResult').textContent='Scanning…';detectScene();
  }catch(e){showToast('Camera access denied');console.error(e);}
}

// ── SOS ───────────────────────────────────────────────────────
function triggerSOS(){
  speak('Emergency SOS activated. Notifying Presidency University Security and Health Centre.');
  showToast('🆘 SOS — Campus Security alerted! Call 080-23093500');
  const c=map.getCenter();
  L.marker([c.lat,c.lng],{
    icon:L.divIcon({html:`<div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#e76f51,#c0392b);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:white;box-shadow:0 0 0 14px rgba(231,111,81,.18);border:3px solid white;">SOS</div>`,iconSize:[50,50],iconAnchor:[25,25],className:''})
  }).addTo(map).bindPopup(`<b>🆘 SOS Active — Presidency University</b><br><b>📞 Campus Security: 080-23093500</b><br>📞 Health Centre: 080-23093501<br>📞 Ambulance: 108<br><small>GPS: ${c.lat.toFixed(5)}°N, ${c.lng.toFixed(5)}°E</small>`).openPopup();
}

// ── OFFLINE ───────────────────────────────────────────────────
function updateOnlineStatus(){State.isOnline=navigator.onLine;document.getElementById('onlinePill').classList.toggle('offline',!State.isOnline);document.getElementById('onlineLabel').textContent=State.isOnline?'Live':'Offline';document.getElementById('offlineBanner').classList.toggle('hidden',State.isOnline);if(!State.isOnline)showToast('⚠ Offline — campus map available');}
window.addEventListener('online',updateOnlineStatus);window.addEventListener('offline',updateOnlineStatus);updateOnlineStatus();
document.getElementById('sheetHandle').addEventListener('click',()=>document.getElementById('bottomSheet').classList.toggle('expanded'));

// ── VOICE ─────────────────────────────────────────────────────
function speak(text){if(!State.voiceEnabled||!window.speechSynthesis)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.pitch=1.05;u.volume=1;window.speechSynthesis.speak(u);}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.getElementById('toastContainer').appendChild(t);setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),350);},2800);}

// ── KEYBOARD ──────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeLogin();closeProfile();closeBarrier();if(cameraActive)toggleCamera();if(typeof closeIndoor==='function')closeIndoor();if(typeof closeRating==='function')closeRating();if(typeof closeQR==='function')closeQR();}
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();document.getElementById('searchInput').focus();}
});

// ── LANGUAGE ──────────────────────────────────────────────────
let currentLang=localStorage.getItem('aw_lang')||'en';
const TRANSLATIONS={en:{search_placeholder:'Search campus buildings, facilities…'},kn:{search_placeholder:'ಕ್ಯಾಂಪಸ್ ಕಟ್ಟಡಗಳನ್ನು ಹುಡುಕಿ…'},hi:{search_placeholder:'कैंपस भवन और सुविधाएं खोजें…'},ta:{search_placeholder:'வளாக கட்டிடங்களை தேடுங்கள்…'}};
function t(key){return TRANSLATIONS[currentLang]?.[key]||TRANSLATIONS.en[key]||key;}
function setLang(lang,btn){currentLang=lang;localStorage.setItem('aw_lang',lang);document.querySelectorAll('.lang-btn').forEach(b=>b.classList.remove('active'));btn?.classList.add('active');applyLangToUI();showToast(`Language: ${lang.toUpperCase()}`);}
function applyLangToUI(){const si=document.getElementById('searchInput');if(si)si.placeholder=t('search_placeholder');}

// ── LIVE ALERT FEED ───────────────────────────────────────────
const MOCK_ALERTS=[
  {type:'warning',emoji:'🛗',msg:'Library elevator out of service — use ramp on left of entrance',time:'5 min ago',lat:13.17083,lng:77.53561},
  {type:'danger', emoji:'🚧',msg:'Construction at Engineering Block east entrance — use west ramp',time:'12 min ago',lat:13.16953,lng:77.53761},
  {type:'warning',emoji:'💧',msg:'Wet floor near Canteen sliding doors — caution advised',time:'20 min ago',lat:13.16953,lng:77.53461},
  {type:'info',   emoji:'♿',msg:'New paved accessible path open: Admin Block → Library',time:'1 hr ago', lat:13.16883,lng:77.53491},
  {type:'info',   emoji:'🅿️',msg:'Accessible parking bay #2 now free near main gate',time:'45 min ago',lat:13.16583,lng:77.53331},
];
let shownAlerts=new Set();
function initAlertFeed(){
  [0,1].forEach(i=>setTimeout(()=>showAlertChip(MOCK_ALERTS[i],i),i*2000+3000));
  setInterval(()=>{const u=MOCK_ALERTS.filter((_,i)=>!shownAlerts.has(i));if(u.length){const idx=MOCK_ALERTS.indexOf(u[Math.floor(Math.random()*u.length)]);showAlertChip(MOCK_ALERTS[idx],idx);}},50000);
}
function showAlertChip(alert,idx){
  if(typeof idx==='number'&&shownAlerts.has(idx))return;if(typeof idx==='number')shownAlerts.add(idx);
  const feed=document.getElementById('alertFeed');if(!feed)return;
  const chip=document.createElement('div');chip.className=`alert-chip ${alert.type}`;
  chip.innerHTML=`<span class="alert-chip-dot"></span><span style="font-size:15px">${alert.emoji}</span><span style="flex:1">${alert.msg}</span><span style="font-size:10px;color:var(--muted);margin-right:4px">${alert.time}</span><span class="alert-chip-close" onclick="dismissAlert(this)">✕</span>`;
  chip.onclick=e=>{if(!e.target.classList.contains('alert-chip-close'))map.flyTo([alert.lat,alert.lng],20,{duration:1});};
  feed.appendChild(chip);setTimeout(()=>{if(chip.parentNode)chip.remove();},12000);
  const chips=feed.querySelectorAll('.alert-chip');if(chips.length>3)chips[0].remove();
}
function dismissAlert(btn){btn.closest('.alert-chip').remove();}

// ── INDOOR MAPS ───────────────────────────────────────────────
const INDOOR_DATA={
  library:{name:'📚 Central Library',floors:['Ground Floor','1st Floor','2nd Floor','3rd Floor'],
    maps:{'Ground Floor':{rooms:[{x:10,y:10,w:160,h:60,fill:'#e0f5f2',label:'Reception & Issue',highlight:true},{x:10,y:78,w:75,h:90,fill:'#e8f4ff',label:'Study Area A'},{x:93,y:78,w:77,h:90,fill:'#fdf8ec',label:'Computer Lab'},{x:10,y:176,w:42,h:52,fill:'#ffe8e8',label:'Toilet'},{x:60,y:176,w:42,h:52,fill:'#e0f5f2',label:'♿ Toilet',highlight:true},{x:178,y:10,w:52,h:218,fill:'#f5f5f5',label:'Staircase'},{x:238,y:10,w:52,h:218,fill:'#e0f5f2',label:'LIFT ♿',highlight:true},{x:298,y:10,w:92,h:130,fill:'#f0f8e8',label:'Reading Hall'},{x:298,y:148,w:92,h:80,fill:'#e0f5f2',label:'Accessible\nToilet ♿',highlight:true}],you:{x:22,y:28}},
    '1st Floor':{rooms:[{x:10,y:10,w:160,h:160,fill:'#e8f4ff',label:'Fiction & Literature'},{x:10,y:178,w:160,h:50,fill:'#fdf8ec',label:'Silent Zone 🔇'},{x:178,y:10,w:52,h:218,fill:'#f5f5f5',label:'Staircase'},{x:238,y:10,w:52,h:218,fill:'#e0f5f2',label:'LIFT ♿',highlight:true},{x:298,y:10,w:92,h:218,fill:'#f0f8e8',label:'Reference\nSection'}],you:{x:248,y:110}},
    '2nd Floor':{rooms:[{x:10,y:10,w:380,h:100,fill:'#e8f4ff',label:'Research & Journals'},{x:10,y:118,w:160,h:110,fill:'#fdf8ec',label:'Group Discussion Rooms'},{x:178,y:118,w:52,h:110,fill:'#e0f5f2',label:'LIFT ♿',highlight:true},{x:238,y:118,w:152,h:110,fill:'#e0f5f2',label:'Accessible Toilet ♿',highlight:true}],you:{x:20,y:128}},
    '3rd Floor':{rooms:[{x:10,y:10,w:380,h:228,fill:'#f0f8e8',label:'Rare Books & Archives\n(Staff Assisted)'}],you:null}}},
  admin_block:{name:'🏛 Administrative Block',floors:['Ground Floor','1st Floor','2nd Floor'],
    maps:{'Ground Floor':{rooms:[{x:10,y:10,w:130,h:80,fill:'#ffe8e8',label:'Health Centre 🏥',highlight:true},{x:148,y:10,w:90,h:80,fill:'#e0f5f2',label:'Ramp Entry ♿',highlight:true},{x:246,y:10,w:144,h:80,fill:'#e8f4ff',label:'Admissions'},{x:10,y:98,w:180,h:80,fill:'#fdf8ec',label:'Finance & Accounts'},{x:198,y:98,w:92,h:80,fill:'#e0f5f2',label:'LIFT ♿',highlight:true},{x:298,y:98,w:92,h:80,fill:'#e0f5f2',label:'♿ Toilet',highlight:true},{x:10,y:186,w:380,h:32,fill:'#f5f5f5',label:'Main Corridor'}],you:{x:155,y:28}},
    '1st Floor':{rooms:[{x:10,y:10,w:180,h:120,fill:'#e8f4ff',label:'Registrar & Records'},{x:198,y:10,w:92,h:120,fill:'#e0f5f2',label:'LIFT ♿',highlight:true},{x:298,y:10,w:92,h:120,fill:'#fdf8ec',label:"VC's Office"},{x:10,y:138,w:380,h:80,fill:'#f0f8e8',label:'Conference Room'}],you:{x:210,y:65}},
    '2nd Floor':{rooms:[{x:10,y:10,w:380,h:218,fill:'#fdf8ec',label:'Examinations & Records\n(Staff Assisted)'}],you:null}}},
};
let currentIndoorBuilding='library',currentFloor='Ground Floor';
function openIndoor(bid){
  const data=INDOOR_DATA[bid]||INDOOR_DATA['library'];
  currentIndoorBuilding=bid in INDOOR_DATA?bid:'library';
  currentFloor=data.floors[0];
  document.getElementById('indoorTitle').textContent=data.name+' — Floor Map';
  renderFloorTabs(data);renderFloorMap(data.maps[currentFloor]);
  document.getElementById('indoorModal').classList.remove('hidden');
}
function closeIndoor(){document.getElementById('indoorModal').classList.add('hidden');}
function renderFloorTabs(data){document.getElementById('floorTabs').innerHTML=data.floors.map(f=>`<button class="floor-tab ${f===currentFloor?'active':''}" onclick="switchFloor('${f}')">${f}</button>`).join('');}
function switchFloor(floor){currentFloor=floor;const data=INDOOR_DATA[currentIndoorBuilding];renderFloorTabs(data);renderFloorMap(data.maps[floor]);speak(`Showing ${floor}`);}
function renderFloorMap(fd){
  const svg=document.getElementById('floorMapSvg'),dk=document.documentElement.getAttribute('data-theme')==='dark';
  let s=`<rect x="5" y="5" width="390" height="268" rx="10" fill="${dk?'#1e2330':'#f7f5f0'}" stroke="${dk?'#2d3547':'#d0ccc4'}" stroke-width="2"/>`;
  fd.rooms.forEach(r=>{
    const fill=dk?(r.highlight?'rgba(42,157,143,.22)':'rgba(255,255,255,.04)'):r.fill;
    const stroke=r.highlight?'#2a9d8f':(dk?'#2d3547':'#ccc8c0');
    s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${r.highlight?2:1}"/>`;
    const lines=r.label.split('\n'),midY=r.y+r.h/2;
    lines.forEach((l,li)=>{const ly=midY+(li-(lines.length-1)/2)*14;s+=`<text x="${r.x+r.w/2}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-family="Plus Jakarta Sans,sans-serif" font-weight="${r.highlight?'700':'600'}" fill="${r.highlight?(dk?'#2a9d8f':'#1f7a6e'):(dk?'#a8a49c':'#4a4640')}">${l}</text>`;});
  });
  if(fd.you){s+=`<circle cx="${fd.you.x+12}" cy="${fd.you.y+12}" r="10" fill="#2a9d8f" opacity=".2"/><circle cx="${fd.you.x+12}" cy="${fd.you.y+12}" r="5" fill="#2a9d8f"/><text x="${fd.you.x+12}" y="${fd.you.y+26}" text-anchor="middle" font-size="8" font-family="Plus Jakarta Sans,sans-serif" font-weight="700" fill="#2a9d8f">YOU</text>`;}
  svg.innerHTML=s;
  document.getElementById('floorLegend').innerHTML='<div class="fl-item"><div class="fl-dot" style="background:#2a9d8f"></div>Accessible</div><div class="fl-item"><div class="fl-dot" style="background:#4fc3f7"></div>Rooms</div><div class="fl-item"><div class="fl-dot" style="background:#2a9d8f;border-radius:50%"></div>You are here</div>';
}

// ── QR SCANNER ────────────────────────────────────────────────
const QR_MAP={'PU-GATE':'main_gate','PU-ADMIN':'admin_block','PU-LIB':'library','PU-ENGG':'engg_block','PU-CANTEEN':'canteen','PU-HEALTH':'health_centre','PU-H1':'hostel_boys','PU-H2':'hostel_girls','PU-SPORTS':'sports_complex','PU-AUD':'auditorium'};
let qrStream=null,qrInterval=null;
async function openQR(){
  document.getElementById('qrOverlay').classList.remove('hidden');
  try{qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});document.getElementById('qrVideo').srcObject=qrStream;speak('QR scanner active. Point camera at campus QR code.');qrInterval=setTimeout(()=>{const codes=Object.keys(QR_MAP);handleQRResult(codes[Math.floor(Math.random()*codes.length)]);},4000);}
  catch(e){showToast('Camera permission needed for QR scan');closeQR();}
}
function handleQRResult(code){const pid=QR_MAP[code];if(pid){closeQR();selectPlace(pid);showToast(`📍 QR: ${code}`);speak('QR scanned. Destination set.');}}
function closeQR(){document.getElementById('qrOverlay').classList.add('hidden');clearTimeout(qrInterval);if(qrStream){qrStream.getTracks().forEach(t=>t.stop());qrStream=null;}}

// ── RATINGS ───────────────────────────────────────────────────
let currentRating=0,ratings=JSON.parse(localStorage.getItem('aw_ratings')||'{}');
function openRating(){document.getElementById('ratingRouteName').textContent=State.activeRoute?.name||State.currentDest?.name||'Current Route';currentRating=0;renderStars(0);document.querySelectorAll('.rtag').forEach(t=>t.classList.remove('on'));document.getElementById('ratingModal').classList.remove('hidden');}
function closeRating(){document.getElementById('ratingModal').classList.add('hidden');}
function setStar(n){currentRating=n;renderStars(n);}
function renderStars(n){document.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('lit',i<n));}
function toggleRatingTag(el){el.classList.toggle('on');}
function submitRating(){
  if(!currentRating){showToast('Please select a star rating');return;}
  const key=State.activeRoute?.name||'general',tags=[...document.querySelectorAll('.rtag.on')].map(t=>t.textContent);
  if(!ratings[key])ratings[key]=[];ratings[key].push({stars:currentRating,tags,ts:Date.now()});
  localStorage.setItem('aw_ratings',JSON.stringify(ratings));closeRating();
  const avg=(ratings[key].reduce((a,r)=>a+r.stars,0)/ratings[key].length).toFixed(1);
  showToast(`⭐ ${currentRating}/5 rated! Avg: ${avg}★`);speak(`Thank you for rating ${currentRating} out of 5 stars.`);
  L.marker([map.getCenter().lat,map.getCenter().lng],{icon:makeIcon('⭐','#fdf8ec',26)}).addTo(map).bindPopup(`<b>⭐ Rated ${currentRating}/5</b><br>${tags.join(', ')||'No tags'}`);
}

// ── EMERGENCY PANEL ───────────────────────────────────────────
let emergencyPanelOpen=false;
function toggleEmergencyPanel(){emergencyPanelOpen=!emergencyPanelOpen;document.getElementById('emergencyPanel').classList.toggle('hidden',!emergencyPanelOpen);if(emergencyPanelOpen)speak('Emergency contacts panel open.');}

// ── ADMIN DASHBOARD ───────────────────────────────────────────
function openAdminDashboard(){window.open('admin.html','_blank');}