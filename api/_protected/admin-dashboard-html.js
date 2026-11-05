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
    <div class="panel" id="formPanel"><h3 id="formTitle">Add</h3><div id="formArea"></div></div>
    <div class="panel"><h3 id="listTitle">Current</h3><div id="listArea"><div class="msg">Loading…</div></div></div>
  </div>
</div>

<script>
const TABS = [['ministries','Ministries'],['events','Events'],['videos','Videos'],['albums','Photos'],['sermons','Sermons'],['leaders','Leadership']];
let tab = 'events';
let content = null;
let openAlbum = null;   // the album being managed, or null

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
    <div class="field"><label>Event image (optional)</label><input type="file" id="photo_file" accept="image/*"><div style="font-size:12px;color:#857d91;margin-top:5px">Landscape 16:9 works best (other shapes are trimmed). Photos are shrunk to under 0.8MB automatically; files over 30MB are refused.</div></div>
    <button class="btn" id="addBtn">Publish event</button>\`;
  if (t==='videos') return \`
    <div class="field"><label>Ministry</label><select id="f_ministry_id">\${minOptions()}</select></div>
    <div class="field"><label>Title</label><input id="f_title" placeholder="Men's Fellowship Gathering"></div>
    <div class="field"><label>Description</label><textarea id="f_description" rows="2"></textarea></div>
    <div class="field"><label>Video file</label><input type="file" id="video_file" accept="video/*"><div style="font-size:12px;color:#857d91;margin-top:5px">MP4 (H.264) works best. Up to 720p; anything sharper is refused. Large videos upload in chunks automatically. Keep this page open until it finishes.</div></div>
    <div class="field"><label>Thumbnail (optional)</label><input type="file" id="thumb_file" accept="image/*"><div style="font-size:12px;color:#857d91;margin-top:5px">16:9 works best. If you skip this, a picture is taken from the video automatically.</div></div>
    <div id="vprog" style="display:none;margin-bottom:12px"><div style="height:8px;background:#e4e1e9;border-radius:4px;overflow:hidden"><div id="vbar" style="height:100%;width:0;background:var(--accent)"></div></div><div id="vtxt" style="font-size:12.5px;color:#857d91;margin-top:5px"></div></div>
    <button class="btn" id="addBtn">Publish video</button>\`;
  if (t==='albums') return \`
    <div class="field"><label>Ministry</label><select id="f_ministry_id">\${minOptions()}</select></div>
    <div class="field"><label>Album title</label><input id="f_title" placeholder="Youth Camp 2026"></div>
    <div class="field"><label>Photos (you can choose many)</label><input type="file" id="album_files" accept="image/*" multiple><div style="font-size:12px;color:#857d91;margin-top:5px">Each photo is shrunk to under 0.8MB automatically. You can add more photos later from Manage.</div></div>
    <button class="btn" id="addBtn">Create album</button>\`;
  if (t==='sermons') return \`
    <div class="field"><label>Title</label><input id="f_title" placeholder="The God Who Restores"></div>
    <div class="field"><label>Preacher</label><input id="f_preacher" placeholder="Rev. J. Mwenda"></div>
    <div class="field"><label>Date</label><input id="f_sermon_date" type="date"></div>
    <div class="field"><label>Audio (optional)</label><input type="file" id="audio_file" accept="audio/*"><div style="font-size:12px;color:#857d91;margin-top:5px">MP3 or M4A works best. Up to 500MB.</div></div>
    <div class="field"><label>Video (optional)</label><input type="file" id="video_file" accept="video/*"><div style="font-size:12px;color:#857d91;margin-top:5px">MP4 (H.264), up to 720p. Add audio, video, or both. Large videos upload in chunks automatically. Keep this page open until it finishes.</div></div>
    <div id="vprog" style="display:none;margin-bottom:12px"><div style="height:8px;background:#e4e1e9;border-radius:4px;overflow:hidden"><div id="vbar" style="height:100%;width:0;background:var(--accent)"></div></div><div id="vtxt" style="font-size:12.5px;color:#857d91;margin-top:5px"></div></div>
    <button class="btn" id="addBtn">Publish sermon</button>\`;
  return \`
    <div class="field"><label>Name</label><input id="f_name" placeholder="Mrs. A. Kanana"></div>
    <div class="field"><label>Role</label><input id="f_role" placeholder="Secretary"></div>
    <div class="field"><label>Note</label><input id="f_note" placeholder="Church committee"></div>
    <div class="field"><label>Photo (optional)</label><input type="file" id="photo_file" accept="image/*"><div style="font-size:12px;color:#857d91;margin-top:5px">A clear head-and-shoulders photo works best. It is shrunk to under 0.8MB automatically.</div></div>
    <button class="btn" id="addBtn">Add to leadership</button>\`;
}

function rowLabel(t, r){
  if (t==='events') return [r.title, (r.event_date||'')+' · '+(r.place||'')];
  if (t==='videos') {
    var bits = [];
    if (r.length_seconds) bits.push(fmtDuration(r.length_seconds));
    if (r.description) bits.push(r.description);
    return [r.title, bits.join(' · ')];
  }
  if (t==='albums') {
    var n = (content.photos || []).filter(function(p){ return p.album_id === r.id; }).length;
    return [r.title, n + (n === 1 ? ' photo' : ' photos')];
  }
  if (t==='sermons') {
    var sb = [];
    if (r.preacher) sb.push(r.preacher);
    if (r.sermon_date) sb.push(r.sermon_date);
    if (r.length_seconds) sb.push(fmtDuration(r.length_seconds));
    var kinds = [];
    if (r.has_audio) kinds.push('audio');
    if (r.has_video) kinds.push('video');
    if (kinds.length) sb.push(kinds.join(' + '));
    return [r.title, sb.join(' · ')];
  }
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
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; openAlbum = null; render(); });

  if (tab === 'albums' && openAlbum) { renderAlbumDetail(); return; }
  if (tab === 'ministries') { renderMinistries(); return; }
  document.getElementById('formPanel').style.display = '';

  document.getElementById('formTitle').textContent = 'Add ' + tab.replace(/s$/,'');
  document.getElementById('formArea').innerHTML = formFor(tab);
  document.getElementById('addBtn').onclick = addItem;

  const rows = content[tab] || [];
  document.getElementById('listTitle').textContent = 'Current ' + tab + ' (' + rows.length + ')';
  document.getElementById('listArea').innerHTML = rows.length ? rows.map(r => {
    const [title, sub] = rowLabel(tab, r);
    return '<div class="row"><span class="t"><b>'+title+'</b><span>'+sub+'</span></span>' +
      (tab === 'albums' ? '<button class="btn" style="padding:6px 12px;font-size:12.5px" data-manage="'+r.id+'">Manage</button>' : '') +
      '<button class="del" data-id="'+r.id+'">✕</button></div>';
  }).join('') : '<div class="msg">Nothing published yet.</div>';

  document.querySelectorAll('[data-id]').forEach(b => b.onclick = () => deleteItem(b.dataset.id));
  document.querySelectorAll('[data-manage]').forEach(b => b.onclick = () => { openAlbum = b.dataset.manage; render(); });
}

const MAX_PHOTO_BYTES = 800 * 1024;   // every photo is shrunk to under 0.8MB
const MAX_PHOTO_SIDE = 1920;          // longest side, in pixels
const PHOTO_FIELD = { events: 'image_url', leaders: 'photo_url' };   // which column holds each tab's photo

function loadImage(file){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){ URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

function canvasToJpeg(canvas, quality){
  return new Promise(function(resolve){ canvas.toBlob(resolve, 'image/jpeg', quality); });
}

async function shrinkPhoto(file){
  if (file.size <= MAX_PHOTO_BYTES) return file;   // already small: leave it untouched
  var img = await loadImage(file);
  var scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  var w = Math.round(img.naturalWidth * scale);
  var h = Math.round(img.naturalHeight * scale);
  var canvas = document.createElement('canvas');
  var blob = null;
  while (true) {
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    var q = 0.85;
    while (q >= 0.5) {
      blob = await canvasToJpeg(canvas, q);
      if (blob && blob.size <= MAX_PHOTO_BYTES) break;
      q -= 0.07;
    }
    if (blob && blob.size <= MAX_PHOTO_BYTES) break;
    if (Math.max(w, h) <= 400) break;
    w = Math.round(w * 0.85);
    h = Math.round(h * 0.85);
  }
  if (!blob) throw new Error('unreadable');
  var dot = file.name.lastIndexOf('.');
  var base = dot > 0 ? file.name.slice(0, dot) : file.name;
  return new File([blob], base + '.jpg', { type: 'image/jpeg' });
}

async function addItem(){
  const btn = document.getElementById('addBtn');
  const label = btn.textContent;
  const data = {};
  document.querySelectorAll('#formArea [id^="f_"]').forEach(el => {
    data[el.id.slice(2)] = el.value.trim();
  });
  if (!data.title && !data.name) { alert('Please fill in the title/name field.'); return; }
  if (tab === 'events' && !data.event_date) { alert('Please choose the event date.'); return; }

  if (tab === 'albums') { await createAlbum(btn, label, data); return; }
  if (tab === 'videos') { await publishVideo(btn, label, data); return; }
  if (tab === 'sermons') { await publishSermon(btn, label, data); return; }

  const payload = { table: tab, data: data };
  btn.disabled = true;
  try {
    const fileInput = document.getElementById('photo_file');
    let file = (PHOTO_FIELD[tab] && fileInput) ? fileInput.files[0] : null;
    if (file) {
      if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); btn.disabled = false; return; }
      if (file.size > 30*1024*1024) { alert('failed: image file above 30mbs'); btn.disabled = false; return; }
      btn.textContent = 'Shrinking photo…';
      try { file = await shrinkPhoto(file); }
      catch (e) { alert('This image could not be read. Please use a JPG or PNG photo.'); btn.disabled = false; btn.textContent = label; return; }
      btn.textContent = 'Uploading photo…';
      const r1 = await fetch('/api/admin', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action:'get-upload-url', kind:'image', filename:file.name, contentType:file.type, sizeBytes:file.size })
      });
      const d1 = await r1.json();
      if (!d1.ok) { alert('Error: ' + d1.error); btn.disabled = false; btn.textContent = label; return; }
      const r2 = await fetch(d1.uploadUrl, { method:'PUT', headers:{'Content-Type':file.type}, body:file });
      if (!r2.ok) { alert('Upload to storage failed.'); btn.disabled = false; btn.textContent = label; return; }
      data[PHOTO_FIELD[tab]] = d1.key;
      payload.media = { key:d1.key, kind:'image', contentType:file.type, sizeBytes:file.size, originalName:file.name };
    }
    btn.textContent = 'Publishing…';
    const r = await fetch('/api/admin', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const res = await r.json();
    if (!res.ok) { alert('Error: ' + res.error); btn.disabled = false; btn.textContent = label; return; }
    await loadContent();
  } catch (e) { alert('Could not reach the server.'); btn.disabled = false; btn.textContent = label; }
}

async function deleteItem(id){
  if (!confirm(tab === 'albums' ? 'Delete this album and ALL its photos?' : 'Delete this?')) return;
  try {
    const r = await fetch('/api/admin?table=' + tab + '&id=' + encodeURIComponent(id), { method: 'DELETE' });
    const res = await r.json();
    if (!res.ok) { alert('Error: ' + res.error); return; }
    await loadContent();
  } catch (e) { alert('Could not reach the server.'); }
}

const VIDEO_SINGLE_MAX = 500 * 1024 * 1024;   // bigger videos are uploaded in chunks
const CHUNK_MAX = 450 * 1024 * 1024;          // no chunk is bigger than this
const MAX_VIDEO_SIDE = 720;                   // "720p": the shorter side of the picture may not be bigger
let uploadBusy = false;
window.addEventListener('beforeunload', function(e){
  if (uploadBusy) { e.preventDefault(); e.returnValue = ''; }
});

// Split a big file into equal chunks, none bigger than 450MB.
function planChunks(size){
  if (size <= VIDEO_SINGLE_MAX) return [{ start: 0, end: size }];
  var n = Math.ceil(size / CHUNK_MAX);
  var each = Math.ceil(size / n);
  var parts = [];
  for (var i = 0; i < n; i++) parts.push({ start: i * each, end: Math.min(size, (i + 1) * each) });
  return parts;
}

function fmtDuration(sec){
  sec = Math.round(sec || 0);
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// Ask the browser for the video's size and length (this also proves the browser can play it).
function readVideoInfo(file){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file);
    var v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    var timer = setTimeout(function(){ cleanup(); reject(new Error('timeout')); }, 20000);
    function cleanup(){ clearTimeout(timer); URL.revokeObjectURL(url); }
    v.onloadedmetadata = function(){
      if (!v.videoWidth || !v.videoHeight) { cleanup(); reject(new Error('no picture')); return; }
      resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration, video: v, cleanup: cleanup });
    };
    v.onerror = function(){ cleanup(); reject(new Error('unreadable')); };
    v.src = url;
  });
}

// Take a picture from the video (about 2 seconds in) to use as the thumbnail.
function grabFrame(v, info){
  return new Promise(function(resolve){
    var timer = setTimeout(function(){ resolve(null); }, 8000);
    v.onseeked = function(){
      clearTimeout(timer);
      try {
        var scale = Math.min(1, 1280 / Math.max(info.width, info.height));
        var c = document.createElement('canvas');
        c.width = Math.round(info.width * scale);
        c.height = Math.round(info.height * scale);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(function(b){ resolve(b ? new File([b], 'thumbnail.jpg', { type: 'image/jpeg' }) : null); }, 'image/jpeg', 0.85);
      } catch (e) { resolve(null); }
    };
    var t = isFinite(info.duration) ? Math.min(2, info.duration / 2) : 1;
    v.currentTime = Math.max(0.1, t);
  });
}

function adminPost(body){
  return fetch('/api/admin', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
    .then(function(r){ return r.json(); })
    .then(function(d){ if (!d.ok) throw new Error(d.error || 'Something went wrong.'); return d; });
}

// Send one file (or one chunk) to storage, reporting progress as it goes.
function putBlob(url, blob, contentType, onProgress){
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = function(e){ if (e.lengthComputable) onProgress(e.loaded); };
    xhr.onload = function(){
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('storage answered ' + xhr.status));
    };
    xhr.onerror = function(){ reject(new Error('network problem')); };
    xhr.send(blob);
  });
}

// If a chunk fails (bad signal), try that chunk again, up to 3 times.
async function putWithRetry(url, blob, contentType, tries, onProgress){
  var lastErr = null;
  for (var attempt = 1; attempt <= tries; attempt++) {
    try { await putBlob(url, blob, contentType, onProgress); return; }
    catch (e) {
      lastErr = e;
      onProgress(0);
      if (attempt < tries) await new Promise(function(r){ setTimeout(r, 1000 * attempt); });
    }
  }
  throw lastErr;
}

async function publishVideo(btn, label, data){
  const fileInput = document.getElementById('video_file');
  const thumbInput = document.getElementById('thumb_file');
  const box = document.getElementById('vprog');
  const bar = document.getElementById('vbar');
  const txt = document.getElementById('vtxt');
  const file = fileInput && fileInput.files[0];
  if (!file) { alert('Please choose the video file.'); return; }
  if (!file.type.startsWith('video/')) { alert('Please choose a video file.'); return; }

  var info = null;
  var started = null;   // set once a chunked upload has begun, so it can be cancelled if something fails
  function stop(){
    uploadBusy = false;
    btn.disabled = false;
    btn.textContent = label;
    box.style.display = 'none';
    bar.style.width = '0';
    if (info && info.cleanup) info.cleanup();
  }
  uploadBusy = true;
  btn.disabled = true;
  try {
    btn.textContent = 'Checking video…';
    try { info = await readVideoInfo(file); }
    catch (e) { alert('This video could not be read by your browser. Please use an MP4 (H.264) video.'); stop(); return; }
    if (Math.min(info.width, info.height) > MAX_VIDEO_SIDE) { alert('failed: video size above 720p'); stop(); return; }

    // the thumbnail: the one you picked, or a picture taken from the video
    var thumbFile = thumbInput && thumbInput.files[0];
    if (thumbFile) {
      if (!thumbFile.type.startsWith('image/') || thumbFile.size > 30*1024*1024) {
        alert('The thumbnail must be an image under 30MB.'); stop(); return;
      }
    } else {
      btn.textContent = 'Making thumbnail…';
      thumbFile = await grabFrame(info.video, info);
    }
    var thumbMeta = null;
    if (thumbFile) {
      try { thumbFile = await shrinkPhoto(thumbFile); } catch (e) { thumbFile = null; }
    }
    if (thumbFile) {
      btn.textContent = 'Uploading thumbnail…';
      var t = await adminPost({ action:'get-upload-url', kind:'thumbnail', filename:thumbFile.name, contentType:thumbFile.type, sizeBytes:thumbFile.size });
      await putWithRetry(t.uploadUrl, thumbFile, thumbFile.type, 2, function(){});
      thumbMeta = { key:t.key, contentType:thumbFile.type, sizeBytes:thumbFile.size, originalName:thumbFile.name };
    }

    // the video itself
    box.style.display = 'block';
    var sent = 0;
    function show(loadedNow){
      var pct = Math.min(100, Math.round(((sent + loadedNow) / file.size) * 100));
      bar.style.width = pct + '%';
      txt.textContent = 'Uploading video… ' + pct + '%';
      btn.textContent = pct + '%';
    }
    show(0);
    var parts = planChunks(file.size);
    var key = null;
    var uploadId = null;
    if (parts.length === 1) {
      var one = await adminPost({ action:'get-upload-url', kind:'video', filename:file.name, contentType:file.type, sizeBytes:file.size });
      key = one.key;
      await putWithRetry(one.uploadUrl, file, file.type, 3, show);
    } else {
      var s = await adminPost({ action:'video-start', filename:file.name, contentType:file.type, sizeBytes:file.size, partCount:parts.length });
      key = s.key; uploadId = s.uploadId;
      started = { key: key, uploadId: uploadId };
      for (var i = 0; i < parts.length; i++) {
        await putWithRetry(s.partUrls[i], file.slice(parts[i].start, parts[i].end), null, 3, show);
        sent += parts[i].end - parts[i].start;
      }
    }
    sent = file.size;
    show(0);
    btn.textContent = 'Finishing…';
    txt.textContent = 'Finishing…';
    await adminPost({
      action: 'finish-video', key: key, uploadId: uploadId, contentType: file.type, originalName: file.name,
      data: { ministry_id: data.ministry_id, title: data.title, description: data.description,
              length_seconds: isFinite(info.duration) ? Math.round(info.duration) : null },
      thumbnail: thumbMeta
    });
    stop();
    await loadContent();
  } catch (e) {
    if (started) { try { await adminPost({ action:'video-abort', key:started.key, uploadId:started.uploadId }); } catch (e2) {} }
    alert('The video could not be uploaded: ' + e.message);
    stop();
  }
}

const AUDIO_MAX = 500 * 1024 * 1024;   // audio is always uploaded in one piece
const AUDIO_TYPES = { mp3:'audio/mpeg', m4a:'audio/mp4', aac:'audio/aac', wav:'audio/wav', ogg:'audio/ogg', oga:'audio/ogg', opus:'audio/ogg', flac:'audio/flac' };

// Work out an audio file's type (some phones leave it blank, so fall back to the file ending).
function audioTypeOf(file){
  if (file.type && file.type.startsWith('audio/')) return file.type;
  var dot = file.name.lastIndexOf('.');
  var ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
  return AUDIO_TYPES[ext] || null;
}

// Ask the browser for the audio's length (this also proves the browser can play it).
function readAudioInfo(file){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file);
    var a = document.createElement('audio');
    a.preload = 'metadata';
    var timer = setTimeout(function(){ done(); resolve({ duration: null }); }, 10000);
    function done(){ clearTimeout(timer); URL.revokeObjectURL(url); }
    a.onloadedmetadata = function(){ done(); resolve({ duration: a.duration }); };
    a.onerror = function(){ done(); reject(new Error('unreadable')); };
    a.src = url;
  });
}

async function publishSermon(btn, label, data){
  const audioInput = document.getElementById('audio_file');
  const videoInput = document.getElementById('video_file');
  const box = document.getElementById('vprog');
  const bar = document.getElementById('vbar');
  const txt = document.getElementById('vtxt');
  const audio = audioInput && audioInput.files[0];
  const video = videoInput && videoInput.files[0];
  if (!audio && !video) { alert('Please choose an audio file, a video, or both.'); return; }

  var vinfo = null;
  var ainfo = null;
  var audioKey = null;
  var videoKey = null;
  var started = null;   // set once a chunked video upload has begun, so it can be cancelled if something fails
  function stop(){
    uploadBusy = false;
    btn.disabled = false;
    btn.textContent = label;
    box.style.display = 'none';
    bar.style.width = '0';
    if (vinfo && vinfo.cleanup) vinfo.cleanup();
  }
  uploadBusy = true;
  btn.disabled = true;
  try {
    var audioType = null;
    if (audio) {
      audioType = audioTypeOf(audio);
      if (!audioType) { alert('Please choose an audio file (MP3 or M4A work best).'); stop(); return; }
      if (audio.size > AUDIO_MAX) { alert('failed: audio file above 500mbs'); stop(); return; }
      btn.textContent = 'Checking audio…';
      try { ainfo = await readAudioInfo(audio); }
      catch (e) { alert('This audio file could not be read by your browser. Please use MP3 or M4A.'); stop(); return; }
    }
    if (video) {
      if (!video.type.startsWith('video/')) { alert('Please choose a video file.'); stop(); return; }
      btn.textContent = 'Checking video…';
      try { vinfo = await readVideoInfo(video); }
      catch (e) { alert('This video could not be read by your browser. Please use an MP4 (H.264) video.'); stop(); return; }
      if (Math.min(vinfo.width, vinfo.height) > MAX_VIDEO_SIDE) { alert('failed: video size above 720p'); stop(); return; }
    }

    var total = (audio ? audio.size : 0) + (video ? video.size : 0);
    var sent = 0;
    box.style.display = 'block';
    function show(loadedNow){
      var pct = Math.min(100, Math.round(((sent + loadedNow) / total) * 100));
      bar.style.width = pct + '%';
      txt.textContent = 'Uploading… ' + pct + '%';
      btn.textContent = pct + '%';
    }
    show(0);

    var audioMeta = null;
    var videoMeta = null;
    if (audio) {
      var a = await adminPost({ action:'get-upload-url', kind:'audio', filename:audio.name, contentType:audioType, sizeBytes:audio.size });
      audioKey = a.key;
      await putWithRetry(a.uploadUrl, audio, audioType, 3, show);
      sent += audio.size;
      audioMeta = { key: a.key, contentType: audioType, originalName: audio.name };
    }
    if (video) {
      var parts = planChunks(video.size);
      if (parts.length === 1) {
        var one = await adminPost({ action:'get-upload-url', kind:'video', filename:video.name, contentType:video.type, sizeBytes:video.size });
        videoKey = one.key;
        await putWithRetry(one.uploadUrl, video, video.type, 3, show);
        sent += video.size;
        videoMeta = { key: one.key, uploadId: null, contentType: video.type, originalName: video.name };
      } else {
        var st = await adminPost({ action:'video-start', filename:video.name, contentType:video.type, sizeBytes:video.size, partCount:parts.length });
        started = { key: st.key, uploadId: st.uploadId };
        for (var i = 0; i < parts.length; i++) {
          await putWithRetry(st.partUrls[i], video.slice(parts[i].start, parts[i].end), null, 3, show);
          sent += parts[i].end - parts[i].start;
        }
        videoMeta = { key: st.key, uploadId: st.uploadId, contentType: video.type, originalName: video.name };
      }
    }
    sent = total;
    show(0);
    btn.textContent = 'Finishing…';
    txt.textContent = 'Finishing…';
    var secs = null;
    if (vinfo && isFinite(vinfo.duration)) secs = Math.round(vinfo.duration);
    else if (ainfo && ainfo.duration && isFinite(ainfo.duration)) secs = Math.round(ainfo.duration);
    await adminPost({
      action: 'finish-sermon',
      data: { title: data.title, preacher: data.preacher, sermon_date: data.sermon_date, length_seconds: secs },
      audio: audioMeta,
      video: videoMeta
    });
    stop();
    await loadContent();
  } catch (e) {
    // clean up anything that was uploaded but never became part of a sermon
    if (started) { try { await adminPost({ action:'video-abort', key:started.key, uploadId:started.uploadId }); } catch (e2) {} }
    var orphans = [];
    if (audioKey) orphans.push(audioKey);
    if (videoKey) orphans.push(videoKey);
    if (orphans.length) { try { await adminPost({ action:'discard-upload', keys:orphans }); } catch (e3) {} }
    alert('The sermon could not be uploaded: ' + e.message);
    stop();
  }
}

async function uploadPhotosToAlbum(albumId, files, progress){
  var failed = [];
  var done = 0;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    progress('Photo ' + (i + 1) + ' of ' + files.length + '…');
    try {
      if (!file.type.startsWith('image/')) throw new Error('not an image');
      if (file.size > 30*1024*1024) throw new Error('failed: image file above 30mbs');
      file = await shrinkPhoto(file);
      var r1 = await fetch('/api/admin', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action:'get-upload-url', kind:'image', filename:file.name, contentType:file.type, sizeBytes:file.size })
      });
      var d1 = await r1.json();
      if (!d1.ok) throw new Error(d1.error);
      var r2 = await fetch(d1.uploadUrl, { method:'PUT', headers:{'Content-Type':file.type}, body:file });
      if (!r2.ok) throw new Error('upload to storage failed');
      var r3 = await fetch('/api/admin', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action:'add-photos', albumId:albumId, photos:[{ key:d1.key, contentType:file.type, sizeBytes:file.size, originalName:file.name }] })
      });
      var d3 = await r3.json();
      if (!d3.ok) throw new Error(d3.error);
      done++;
    } catch (e) {
      failed.push(files[i].name + ' (' + e.message + ')');
    }
  }
  return { done: done, failed: failed };
}

function reportUpload(out, total){
  if (out.failed.length) {
    alert(out.done + ' of ' + total + ' photos were added. These failed: ' + out.failed.slice(0, 6).join(', '));
  }
}

async function createAlbum(btn, label, data){
  const fileInput = document.getElementById('album_files');
  const files = fileInput ? Array.from(fileInput.files) : [];
  btn.disabled = true;
  try {
    btn.textContent = 'Creating album…';
    const r = await fetch('/api/admin', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ table: 'albums', data: data })
    });
    const res = await r.json();
    if (!res.ok) { alert('Error: ' + res.error); btn.disabled = false; btn.textContent = label; return; }
    if (files.length) {
      const out = await uploadPhotosToAlbum(res.row.id, files, function(msg){ btn.textContent = msg; });
      reportUpload(out, files.length);
    }
    await loadContent();
  } catch (e) { alert('Could not reach the server.'); btn.disabled = false; btn.textContent = label; }
}

async function renderAlbumDetail(){
  document.getElementById('formPanel').style.display = 'none';
  const album = (content.albums || []).find(function(a){ return a.id === openAlbum; });
  if (!album) { openAlbum = null; render(); return; }
  const box = document.getElementById('listArea');
  document.getElementById('listTitle').textContent = album.title;
  box.innerHTML = '<div class="msg">Loading photos…</div>';
  var photos = [];
  try {
    const r = await fetch('/api/content?album=' + encodeURIComponent(album.id));
    const d = await r.json();
    if (d.ok) photos = d.photos;
  } catch (e) {}
  if (openAlbum !== album.id) return;

  var html = '<button class="tab" id="albumBack" style="margin-bottom:14px">‹ Back to albums</button>' +
    '<div class="field"><label>Add more photos</label><input type="file" id="more_files" accept="image/*" multiple></div>' +
    '<button class="btn" id="morePhotosBtn" style="margin-bottom:16px">Upload photos</button>' +
    '<div style="font-size:12.5px;color:#857d91;margin-bottom:10px">' + photos.length + (photos.length === 1 ? ' photo' : ' photos') + ' in this album</div>';
  if (photos.length) {
    html += '<div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">';
    photos.forEach(function(p){
      html += '<div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:#eee">' +
        '<img src="' + p.url + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block">' +
        '<button class="del" data-photo="' + p.id + '" title="Delete photo" style="position:absolute;top:5px;right:5px;width:26px;height:26px">✕</button></div>';
    });
    html += '</div>';
  }
  box.innerHTML = html;

  document.getElementById('albumBack').onclick = function(){ openAlbum = null; render(); };
  document.getElementById('morePhotosBtn').onclick = async function(){
    const btn = document.getElementById('morePhotosBtn');
    const files = Array.from(document.getElementById('more_files').files);
    if (!files.length) { alert('Choose some photos first.'); return; }
    btn.disabled = true;
    const out = await uploadPhotosToAlbum(album.id, files, function(msg){ btn.textContent = msg; });
    reportUpload(out, files.length);
    await loadContent();
  };
  box.querySelectorAll('[data-photo]').forEach(function(b){
    b.onclick = async function(){
      if (!confirm('Delete this photo?')) return;
      try {
        const r = await fetch('/api/admin?action=delete-photo&id=' + encodeURIComponent(b.dataset.photo), { method: 'DELETE' });
        const d = await r.json();
        if (!d.ok) { alert('Error: ' + d.error); return; }
        await loadContent();
      } catch (e) { alert('Could not reach the server.'); }
    };
  });
}

function renderMinistries(){
  document.getElementById('formPanel').style.display = 'none';
  document.getElementById('listTitle').textContent = 'Ministry Cover Photos';
  var homeCard = { id: 'home', name: 'Home page', cover_url: (content.church && content.church.cover_url) || null };
  var mins = [homeCard].concat(content.ministries || []);
  var html = '<div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">';
  mins.forEach(function(m){
    var pic = m.cover_url
      ? '<img src="' + m.cover_url + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block">'
      : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px">No cover yet</div>';
    var removeBtn = m.cover_url
      ? '<button class="del" data-remove-cover="' + m.id + '" title="Remove cover">✕</button>'
      : '';
    html += '<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff">' +
      '<div style="aspect-ratio:16/9;background:#eee">' + pic + '</div>' +
      '<div style="padding:10px">' +
        '<b style="display:block;font-size:14px;margin-bottom:8px">' + m.name + '</b>' +
        '<input type="file" accept="image/*" id="cf_' + m.id + '" style="display:block;width:100%;font-size:12px;margin-bottom:8px">' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn" style="flex:1;padding:7px 0;font-size:12.5px" data-upload-cover="' + m.id + '">Upload</button>' +
          removeBtn +
        '</div>' +
        '<div id="cs_' + m.id + '" style="font-size:11.5px;color:#857d91;margin-top:6px"></div>' +
      '</div></div>';
  });
  html += '</div>';
  document.getElementById('listArea').innerHTML = html;

  document.querySelectorAll('[data-upload-cover]').forEach(function(b){
    b.onclick = function(){ handleCoverUpload(b.dataset.uploadCover); };
  });
  document.querySelectorAll('[data-remove-cover]').forEach(function(b){
    b.onclick = function(){ handleCoverRemove(b.dataset.removeCover); };
  });
}

async function handleCoverUpload(ministryId){
  const fileInput = document.getElementById('cf_'+ministryId);
  const status = document.getElementById('cs_'+ministryId);
  let file = fileInput.files[0];
  if (!file) { status.textContent = 'Choose a file first.'; return; }
  if (!file.type.startsWith('image/')) { status.textContent = 'Please choose an image file.'; return; }
  if (file.size > 30*1024*1024) { status.textContent = 'failed: image file above 30mbs'; return; }

  status.textContent = 'Shrinking photo…';
  try { file = await shrinkPhoto(file); }
  catch (e) { status.textContent = 'This image could not be read. Please use a JPG or PNG photo.'; return; }

  status.textContent = 'Requesting upload link…';
  try {
    const r1 = await fetch('/api/admin', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'get-upload-url', kind:'cover', filename:file.name, contentType:file.type, sizeBytes:file.size })
    });
    const d1 = await r1.json();
    if (!d1.ok) { status.textContent = 'Error: ' + d1.error; return; }

    status.textContent = 'Uploading…';
    const r2 = await fetch(d1.uploadUrl, { method:'PUT', headers:{'Content-Type':file.type}, body:file });
    if (!r2.ok) { status.textContent = 'Upload to storage failed.'; return; }

    status.textContent = 'Saving…';
    const r3 = await fetch('/api/admin', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'attach-cover', ministryId, key:d1.key, contentType:file.type, sizeBytes:file.size, originalName:file.name })
    });
    const d3 = await r3.json();
    if (!d3.ok) { status.textContent = 'Error: ' + d3.error; return; }

    status.textContent = 'Done.';
    await loadContent();
  } catch (e) {
    status.textContent = 'Could not reach the server.';
  }
}

async function handleCoverRemove(ministryId){
  if (!confirm('Remove this cover photo?')) return;
  try {
    const r = await fetch('/api/admin?action=remove-cover&ministryId=' + encodeURIComponent(ministryId), { method:'DELETE' });
    const d = await r.json();
    if (!d.ok) { alert('Error: ' + d.error); return; }
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