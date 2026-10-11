// IgniteCon invite system — shared utilities

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function getSupabase() {
  return window.supabase.createClient(
    window.IC_CONFIG.supabaseUrl,
    window.IC_CONFIG.supabaseKey
  );
}

// Generate 8-char slug without ambiguous characters (0/O/1/l/I)
function generateSlug() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const buf = crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[buf[i] % chars.length];
  return s;
}

function inviteUrl(slug) {
  const origin = window.location.origin;
  return `${origin}/i/${slug}`;
}

// Admin auth gate (shared between /create and /admin)
async function requireAuth() {
  if (sessionStorage.getItem('ic_admin') === '1') return;
  await new Promise((resolve) => {
    const el = document.createElement('div');
    el.innerHTML = `
<style>
  .pwd-overlay{position:fixed;inset:0;background:#0A0A0A;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Space Grotesk',system-ui,sans-serif;}
  .pwd-card{background:#141412;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:48px 40px;max-width:400px;width:100%;}
  .pwd-brand{font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;color:#F37021;letter-spacing:0.03em;margin:0 0 4px;line-height:1;}
  .pwd-eyebrow{font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;letter-spacing:0.3em;color:#F37021;text-transform:uppercase;margin-bottom:28px;}
  .pwd-title{font-family:'Space Grotesk',system-ui,sans-serif;color:#F5F1E8;font-size:20px;margin:0 0 20px;font-weight:400;}
  .pwd-input{width:100%;padding:14px 16px;background:#0A0A0A;border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#F5F1E8;font-size:14px;margin-bottom:12px;font-family:inherit;box-sizing:border-box;}
  .pwd-input:focus{outline:none;border-color:#F37021;}
  .pwd-err{color:#F37021;font-size:12px;height:18px;margin-bottom:14px;font-family:'JetBrains Mono',monospace;letter-spacing:0.05em;}
  .pwd-btn{width:100%;padding:14px;background:#F37021;color:#1A0A00;border:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;cursor:pointer;border-radius:4px;font-family:inherit;transition:background 150ms;}
  .pwd-btn:hover{background:#FCB614;}
</style>
<div class="pwd-overlay">
  <div class="pwd-card">
    <div class="pwd-brand">IGNITECON '26</div>
    <div class="pwd-eyebrow">Internal Access</div>
    <h2 class="pwd-title">Enter the access password</h2>
    <input id="pwd" class="pwd-input" type="password" autofocus autocomplete="off"/>
    <div id="pwd-err" class="pwd-err">&nbsp;</div>
    <button id="pwd-go" class="pwd-btn">Enter →</button>
  </div>
</div>`;
    document.body.appendChild(el);
    const check = async () => {
      const val = document.getElementById('pwd').value;
      const hash = await sha256(val);
      if (hash === window.IC_CONFIG.adminPasswordHash) {
        sessionStorage.setItem('ic_admin', '1');
        el.remove();
        resolve();
      } else {
        document.getElementById('pwd-err').textContent = 'Incorrect password';
        document.getElementById('pwd').value = '';
        document.getElementById('pwd').focus();
      }
    };
    document.getElementById('pwd-go').onclick = check;
    document.getElementById('pwd').onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); check(); }
    };
  });
}

// Build .ics calendar invite
function buildICS(invite) {
  const dt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const start = new Date('2026-10-31T08:30:00+02:00');
  const end = new Date('2026-10-31T11:00:00+02:00');
  const guest = invite.rsvp_name || invite.guest_name;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unconventional CA//IgniteCon 2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:ic2026-${invite.slug}@uca.africa`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(start)}`,
    `DTEND:${dt(end)}`,
    `SUMMARY:IgniteCon 2026 — The Reveal`,
    `DESCRIPTION:Business breakfast with growth-stage South African founders.\\nArrival from 08:30. Welcome at 08:30. Breakfast and pitches from 09:00. Networking from 10:00. Dress code: smart casual.`,
    `LOCATION:26 Degrees South Hotel\\, Cradle Moon Conservancy\\, Muldersdrift\\, Gauteng`,
    `URL:${window.location.origin}/i/${invite.slug}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:IgniteCon 2026 — The Reveal starts in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function downloadICS(invite) {
  const ics = buildICS(invite);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'IgniteCon-2026-The-Reveal.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}
