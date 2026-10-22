const $ = (id) => document.getElementById(id);
const els = {
  keyword: $("keyword"), limit: $("limit"), speed: $("speed"),
  incSemSite: $("inc-sem-site"), incSoWhatsapp: $("inc-so-whatsapp"), incSoRedes: $("inc-so-redes"), incSiteQuebrado: $("inc-site-quebrado"),
  btnStart: $("btn-start"), btnStop: $("btn-stop"),
  progressText: $("progress-text"), progressFill: $("progress-fill"), summary: $("summary"), log: $("log"),
  btnCsv: $("btn-csv"), btnJson: $("btn-json"), btnClearLog: $("btn-clear-log"),
};
let currentState = null;
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function slugify(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "empresas"; }
function makeFilename(keyword, ext) { const d = new Date(); const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0"); return `${slugify(keyword)}-${yyyy}-${mm}-${dd}.${ext}`; }
function downloadFile(content, filename, mime) { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function csvEscape(v) { const s = String(v ?? ""); return '"' + s.replace(/"/g, '""') + '"'; }
function buildCsv(results) {
  const headers = ["Nome", "Telefone", "WhatsApp", "Instagram", "Facebook", "Motivo", "Endereço", "Categoria", "Nota", "Avaliações", "Site informado", "Link Google Maps"];
  const lines = [headers.map(csvEscape).join(";")];
  for (const r of results) { lines.push([r.nome, r.telefone, r.whatsapp, r.instagram, r.facebook, r.motivo, r.endereco, r.categoria, r.nota, r.avaliacoes, r.siteInformado, r.linkGoogleMaps].map(csvEscape).join(";")); }
  return "\uFEFF" + lines.join("\r\n");
}
function buildJson(results) { return JSON.stringify(results, null, 2); }
function pushLog(message) { const line = document.createElement("div"); line.className = "log-line"; line.textContent = message; els.log.appendChild(line); els.log.scrollTop = els.log.scrollHeight; }
function setProgress(extracted, limit) { els.progressText.textContent = `${extracted} de ${limit} empresas`; const pct = limit > 0 ? Math.min(100, (extracted / limit) * 100) : 0; els.progressFill.style.width = pct + "%"; }
function setSummary(results) { const count = (motivo) => results.filter(r => r.motivo === motivo).length; els.summary.textContent = `Sem site: ${count("SEM_SITE")} | Só WhatsApp: ${count("SO_WHATSAPP")} | Só redes: ${count("SO_REDES")} | Site quebrado: ${count("SITE_QUEBRADO")}`; }
function updateExportButtons(results) { const enabled = Array.isArray(results) && results.length > 0; els.btnCsv.disabled = !enabled; els.btnJson.disabled = !enabled; }
function applyState(state) {
  if (!state) return;
  currentState = state;
  els.keyword.value = state.keyword || els.keyword.value;
  els.limit.value = state.limit || els.limit.value;
  setProgress(state.extracted || 0, state.limit || 0);
  els.log.innerHTML = "";
  (state.log || []).forEach(pushLog);
  setSummary(state.results || []);
  updateExportButtons(state.results);
  const running = !!state.running;
  els.btnStart.disabled = running; els.btnStop.disabled = !running;
  if (running) els.progressText.textContent = `${state.extracted || 0} de ${state.limit || 0} empresas (em andamento)`;
}
(async function loadInitialState() { try { const s = await chrome.storage.session.get(["state"]); if (s.state) applyState(s.state); } catch (e) {} })();
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.tab) return;
  if (msg.type === "LOG") { pushLog(msg.message); }
  else if (msg.type === "PROGRESS") { setProgress(msg.extracted, msg.limit); }
  else if (msg.type === "DONE") {
    els.btnStart.disabled = false; els.btnStop.disabled = true; pushLog("Extração concluída.");
    chrome.storage.session.get(["state"]).then((s) => { if (s.state) applyState({ ...s.state, results: msg.results || s.state.results }); else { setSummary(msg.results || []); updateExportButtons(msg.results || []); } });
  } else if (msg.type === "STOPPED") { els.btnStart.disabled = false; els.btnStop.disabled = true; pushLog("Parada solicitada."); }
});
els.btnStart.addEventListener("click", () => {
  const keyword = els.keyword.value.trim();
  if (!keyword) { alert("Digite uma palavra-chave."); return; }
  let limit = parseInt(els.limit.value, 10); if (!Number.isFinite(limit)) limit = 20; limit = Math.min(500, Math.max(1, limit)); els.limit.value = limit;
  const include = { SEM_SITE: els.incSemSite.checked, SO_WHATSAPP: els.incSoWhatsapp.checked, SO_REDES: els.incSoRedes.checked, SITE_QUEBRADO: els.incSiteQuebrado.checked };
  if (!include.SEM_SITE && !include.SO_WHATSAPP && !include.SO_REDES && !include.SITE_QUEBRADO) { alert("Selecione ao menos um tipo."); return; }
  els.log.innerHTML = ""; pushLog("Iniciando extração..."); setProgress(0, limit); setSummary([]); updateExportButtons([]);
  els.btnStart.disabled = true; els.btnStop.disabled = false;
  chrome.runtime.sendMessage({ type: "START_EXTRACTION", payload: { keyword, limit, speed: els.speed.value, include } }).catch(() => { pushLog("Falha ao contatar o background."); els.btnStart.disabled = false; els.btnStop.disabled = true; });
});
els.btnStop.addEventListener("click", () => { chrome.runtime.sendMessage({ type: "STOP_EXTRACTION" }).catch(() => {}); els.btnStop.disabled = true; });
els.btnClearLog.addEventListener("click", () => { els.log.innerHTML = ""; });
els.btnCsv.addEventListener("click", async () => { const s = await chrome.storage.session.get(["state"]); const results = s.state?.results || []; if (!results.length) return; const kw = s.state?.keyword || "empresas"; downloadFile(buildCsv(results), makeFilename(kw, "csv"), "text/csv;charset=utf-8;"); });
els.btnJson.addEventListener("click", async () => { const s = await chrome.storage.session.get(["state"]); const results = s.state?.results || []; if (!results.length) return; const kw = s.state?.keyword || "empresas"; downloadFile(buildJson(results), makeFilename(kw, "json"), "application/json;charset=utf-8;"); });