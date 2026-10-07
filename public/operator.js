const $ = id => document.getElementById(id);
let token = "";
const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
function items(root, values, render) {
  root.innerHTML = values.length ? values.map(render).join("") : '<p class="empty">Nothing to show yet.</p>';
}
async function load() {
  const response = await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) { $("status").textContent = "Console access denied. Check the server administrator token."; $("dashboard").classList.add("hidden"); return; }
  const data = await response.json();
  $("status").textContent = `Connected · updated ${new Date(data.generatedAt).toLocaleTimeString()}`;
  $("dashboard").classList.remove("hidden");
  $("totals").innerHTML = Object.entries(data.totals).map(([label,value]) => `<article class="metric"><b>${safe(value)}</b><span>${safe(label.replace(/([A-Z])/g," $1"))}</span></article>`).join("");
  items($("rooms"), data.activeRooms, room => `<article><b>${safe(room.id)}</b><span>${safe(room.players)}/${safe(room.capacity)}</span></article>`);
  items($("matches"), data.recentMatches, match => `<article><b>${safe(match.mode || "match")} · ${safe(match.map)}</b><span>${safe(match.status)}</span></article>`);
  items($("audit"), data.recentAudit, event => `<article><b>${safe(event.action)}</b><span>${safe(new Date(event.at).toLocaleString())}</span></article>`);
}
$("connectBtn").onclick = () => { token = $("token").value; load(); };
$("refreshBtn").onclick = load;
