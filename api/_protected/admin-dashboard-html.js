module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Dashboard — Kiigene Church</title>
<style>
  :root{--accent:#4b2e83;--accent-dark:#3d2566;--line:#e4e1e9;--text:#191320;--text-2:#514a5c;--page:#f5f4f7;--red:#d93a1c}
  *{box-sizing:border-box}
  body{margin:0;background:var(--page);color:var(--text);font-family:system-ui,-apple-system,Arial,sans-serif;font-size:15px}
  header{background:linear-gradient(180deg,#0b3c7a,#062a55);color:#fff;padding:14px 20px;
    display:flex;align-items:center;gap:12px;border-bottom:2px solid #f2b705}
  header h1{font-size:16px;margin:0;font-weight:700}
  header .sp{flex:1}
  header button{background:rgba(255,255,255,.15);color:#fff;border:0;padding:8px 14px;
    border-radius:16px;font-size:13px;cursor:pointer}
  header button:hover{background:rgba(255,255,255,.26)}
  .wrap{max-width:1100px;margin:0 auto;padding:20px}
  .tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:16px}
  .tab{padding:8px 15px;border-radius:20px;font-size:13.5px;font-weight:600;color:var(--text-2);
    border:1px solid var(--line);white-space:nowrap;background:#fff;cursor:pointer}
  .tab.on{background:var(--accent);color:#fff;border-color:var(--accent)}
  .split{display:grid;gap:16px;grid-template-columns:1fr 1fr}
  @media(max-width:760px){.split{grid-template-columns:1fr}}
  .panel{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px}
  .panel h3{margin:0 0 12px;font-size:16px}
  .field{margin-bottom:12px}
  .field label{display:block;font-size:12.5px;font-weight:600;color:var(--text-2);margin-bottom:5px}
  .field input,.field select,.field textarea{width:100%;padding:9px 11px;border-radius:8px;
    border:1px solid var(--line);font-size:14px;outline:none;font-family:inherit}
  .field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent)}
  .btn{background:var(--accent);color:#fff;border:0;padding:10px 16px;border-radius:20px;
    font-size:14px;font-weight:600;cursor:pointer}
  .btn:hover{background:var(--accent-dark)}
  .row{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);
    border-radius:10px;background:#fff;margin-bottom:8px}
  .row .t{flex:1;min-width:0}
  .row .t b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row .t span{font-size:12.5px;color:#857d91}
  .del{width:30px;height:30px;border-radius:7px;border:1px solid var(--line);background:#fff;
    color:#857d91;cursor:pointer}
  .del:hover{color:var(--red);border-color:var(--red)}
  .msg{font-size:13px;color:#857d91;padding:8px 0}
  .err{background:#fdecea;color:#7a1f1f;border-left:3px solid var(--red);padding:9px 11px;
    border-radius:0 8px 8px 0;font-size:13px;margin-bottom:12px}
</style>
</head>
<body>
<header>
  <h1>Kiigene Church — Admin</h1>
  <div class="sp"></div>
  <button id="signOut">Sign out</button>
</header>
<div class="wrap">
  <div class="tabs" id="tabs"></div>
  <div class="split">
    <div class="panel"><h3 id="formTitle">Add</h3><div id="formArea"></div></div>
    <div class="panel"><h3 id="listTitle">Current</h3><div id="listArea"><div class="msg">Loading…</div></div></div>
  </div>
</div>

<script>
const TABS = [['events','Events'],['videos','Videos'],['albums','Photos'],['sermons','Sermons'],['leaders','Leadership']];
let tab = 'events';
let content = null;

function minOptions(){
  return (content.ministries||[]).filter(m=>m.id!=='home')
    .map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('');
}

function formFor(t){
  if (t==='events') return \`
    <div class="field"><label>Ministry</label><select id="f_ministry_id">\${minOptions()}</select></div>
    <div class="field"><label>Title</label><input id="f_title" placeholder="Youth Sunday"></div>
    <div class="field"><label>Date</label><input id="f_event_date" type="date"></div>
    <div class="field"><label>Time</label><input id="f_event_time" placeholder="10:30am"></div>
    <div class="field"><label>Venue</label><input id="f_place" placeholder="Main Sanctuary"></div>
    <div class="field"><label>Description</label><textarea id="f_description" rows="2"></textarea></div>
    <button class="btn" id="addBtn">Publish event</button>\`;
  if (t==='videos') return \`
    <div class="field"><label>Ministry</label><select id="f_ministry_id">\${minOptions()}</select></div>
    <div class="field"><label>Title</label><input id="f_title" placeholder="Men's Fellowship Gathering"></div>
    <div class="field"><label>Description</label><textarea id="f_description" rows="2"></textarea></div>
    <div class="field"><label style="color:#857d91">File upload comes with the Cloudflare R2 step — not yet.</label></div>
    <button class="btn" id="addBtn">Publish video</button>\`;
  if (t==='albums') return \`
    <div class="field"><label>Ministry</label><select id="f_ministry_id">\${minOptions()}</select></div>
    <div class="field"><label>Album title</label><input id="f_title" placeholder="Youth Camp 2026"></div>
    <button class="btn" id="addBtn">Publish album</button>\`;
  if (t==='sermons') return \`
    <div class="field"><label>Title</label><input id="f_title" placeholder="The God Who Restores"></div>
    <div class="field"><label>Preacher</label><input id="f_preacher" placeholder="Rev. J. Mwenda"></div>
    <div class="field"><label>Date</label><input id="f_sermon_date" type="date"></div>
    <button class="btn" id="addBtn">Publish sermon</button>\`;
  return \`
    <div class="field"><label>Name</label><input id="f_name" placeholder="Mrs. A. Kanana"></div>
    <div class="field"><label>Role</label><input id="f_role" placeholder="Secretary"></div>
    <div class="field"><label>Note</label><input id="f_note" placeholder="Church committee"></div>
    <button class="btn" id="addBtn">Add to leadership</button>\`;
}

function rowLabel(t, r){
  if (t==='events') return [r.title, (r.event_date||'')+' · '+(r.place||'')];
  if (t==='videos') return [r.title, r.description||''];
  if (t==='albums') return [r.title, ''];
  if (t==='sermons') return [r.title, (r.preacher||'')+' · '+(r.sermon_date||'')];
  return [r.name, r.role||''];
}

async function loadContent(){
  const r = await fetch('/api/content');
  content = await r.json();
  if (!content.ok) { document.getElementById('listArea').innerHTML = '<div class="err">'+content.error+'</div>'; return; }
  render();
}

function render(){
  document.getElementById('tabs').innerHTML = TABS.map(([k,l]) =>
    '<button class="tab '+(k===tab?'on':'')+'" data-tab="'+k+'">'+l+'</button>').join('');
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });

  document.getElementById('formTitle').textContent = 'Add ' + tab.replace(/s$/,'');
  document.getElementById('formArea').innerHTML = formFor(tab);
  document.getElementById('addBtn').onclick = addItem;

  const rows = content[tab] || [];
  document.getElementById('listTitle').textContent = 'Current ' + tab + ' (' + rows.length + ')';
  document.getElementById('listArea').innerHTML = rows.length ? rows.map(r => {
    const [title, sub] = rowLabel(tab, r);
    return '<div class="row"><span class="t"><b>'+title+'</b><span>'+sub+'</span></span>' +
      '<button class="del" data-id="'+r.id+'">✕</button></div>';
  }).join('') : '<div class="msg">Nothing published yet.</div>';

  document.querySelectorAll('[data-id]').forEach(b => b.onclick = () => deleteItem(b.dataset.id));
}

async function addItem(){
  const btn = document.getElementById('addBtn');
  const data = {};
  document.querySelectorAll('#formArea [id^="f_"]').forEach(el => {
    data[el.id.slice(2)] = el.value.trim();
  });
  if (!data.title && !data.name) { alert('Please fill in the title/name field.'); return; }
  btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    const r = await fetch('/api/admin', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ table: tab, data })
    });
    const res = await r.json();
    if (!res.ok) { alert('Error: ' + res.error); btn.disabled = false; btn.textContent = 'Publish'; return; }
    await loadContent();
  } catch (e) { alert('Could not reach the server.'); btn.disabled = false; }
}

async function deleteItem(id){
  if (!confirm('Delete this?')) return;
  try {
    const r = await fetch('/api/admin?table=' + tab + '&id=' + encodeURIComponent(id), { method: 'DELETE' });
    const res = await r.json();
    if (!res.ok) { alert('Error: ' + res.error); return; }
    await loadContent();
  } catch (e) { alert('Could not reach the server.'); }
}

document.getElementById('signOut').onclick = async () => {
  try { await fetch('/api/auth', { method: 'DELETE' }); } catch(e) {}
  window.location.href = '/admin.html';
};

loadContent();
</script>
</body>
</html>`;