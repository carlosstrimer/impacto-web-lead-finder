let runningTabId = null;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_EXTRACTION") { startExtraction(msg.payload).catch((e) => { relay({ type: "LOG", message: "Falha ao iniciar: " + (e?.message || e) }); relay({ type: "DONE", results: [] }); }); sendResponse({ ok: true }); return true; }
  if (msg.type === "STOP_EXTRACTION") { stopExtraction().catch(() => {}); sendResponse({ ok: true }); return true; }
  if (msg.type === "BG_LOG") { relay({ type: "LOG", message: msg.message }); persistLog(msg.message).catch(() => {}); return true; }
  if (msg.type === "BG_PROGRESS") { relay({ type: "PROGRESS", extracted: msg.extracted, limit: msg.limit }); persistProgress(msg.extracted, msg.limit).catch(() => {}); return true; }
  if (msg.type === "BG_DONE") { persistDone(msg.results || []).catch(() => {}); relay({ type: "DONE", results: msg.results || [] }); return true; }
  return false;
});
function relay(msg) { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch (_) {} }
async function getState() { const s = await chrome.storage.session.get(["state"]); return s.state || null; }
async function setState(state) { await chrome.storage.session.set({ state }); }
async function persistLog(message) { const state = (await getState()) || {}; state.log = state.log || []; state.log.push(message); if (state.log.length > 300) state.log = state.log.slice(-300); await setState(state); }
async function persistProgress(extracted, limit) { const state = (await getState()) || {}; state.extracted = extracted; state.limit = limit; state.running = true; await setState(state); }
async function persistDone(results) { const state = (await getState()) || {}; state.results = results; state.running = false; await setState(state); }
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => { if (id === tabId && info.status === "complete") { chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 20000);
  });
}
async function startExtraction(payload) {
  const { keyword, limit, speed, include } = payload;
  await setState({ running: true, keyword, limit, speed, include, extracted: 0, results: [], log: [], startedAt: Date.now() });
  const url = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}?hl=pt-BR`;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isMaps = activeTab && activeTab.url && activeTab.url.includes("google.com/maps");
  let tabId;
  if (isMaps) { const updated = await chrome.tabs.update(activeTab.id, { url }); tabId = updated.id; }
  else { const created = await chrome.tabs.create({ url }); tabId = created.id; }
  runningTabId = tabId;
  await waitForTabLoad(tabId);
  await new Promise((r) => setTimeout(r, 1800));
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tabId, { type: "RUN_SCRAPE", payload: { keyword, limit, speed, include } });
  } catch (e) { relay({ type: "LOG", message: "Erro ao injetar o content script: " + (e?.message || e) }); await persistDone([]); relay({ type: "DONE", results: [] }); }
}
async function stopExtraction() {
  if (runningTabId) { try { await chrome.tabs.sendMessage(runningTabId, { type: "STOP_SCRAPE" }); } catch (_) {} }
  const state = (await getState()) || {}; state.running = false; await setState(state); relay({ type: "STOPPED" });
}