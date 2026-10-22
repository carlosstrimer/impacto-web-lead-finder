// FILE: background.js
importScripts('modules/db.js', 'modules/scoring.js');

let activeTabId = null;
let queue = [];
let currentQuery = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_EXTRACTION") {
    startSession(msg.payload);
    sendResponse({ ok: true });
  }
  else if (msg.type === "STOP_EXTRACTION") {
    stopSession();
    sendResponse({ ok: true });
  }
  else if (msg.type === "PAUSE_EXTRACTION") {
    chrome.tabs.sendMessage(activeTabId, { type: "PAUSE_SCRAPE" });
    setState({ status: "paused" });
  }
  else if (msg.type === "RESUME_EXTRACTION") {
    chrome.tabs.sendMessage(activeTabId, { type: "RESUME_SCRAPE" });
    setState({ status: "running" });
  }
  else if (msg.type === "BG_LEAD") {
    processLead(msg.lead);
  }
  else if (msg.type === "BG_PROGRESS") {
    relayToPopup(msg);
    setState({ extracted: msg.extracted });
  }
  else if (msg.type === "BG_LOG") {
    relayToPopup(msg);
  }
  else if (msg.type === "BG_BLOCKED") {
    setState({ status: "blocked" });
    relayToPopup({ type: "STATUS", status: "blocked" });
  }
  else if (msg.type === "BG_DONE") {
    finishCurrentQuery();
  }
  return true;
});

function relayToPopup(msg) {
  try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch (_) {}
}

async function setState(data) {
  const s = await chrome.storage.local.get("sessionState");
  const newState = { ...s.sessionState, ...data };
  await chrome.storage.local.set({ sessionState: newState });
  relayToPopup({ type: "STATE_UPDATE", state: newState });
}

async function processLead(lead) {
  // Calcula score antes de salvar
  lead.score = Scoring.calculate(lead);
  
  // Salva no banco IndexedDB
  // Como o background não tem window, usamos a API do IndexedDB nativamente
  // Para simplificar, o db.js foi importado via importScripts, mas IndexedDB nativo no SW requer um wrapper.
  // O background enviará o lead para o dashboard via storage ou mensagem, e o dashboard salvará no IndexedDB local.
  // Para garantir persistência imediata sem abrir o dashboard, usamos o IndexedDB no background mesmo.
  
  const request = indexedDB.open('ImpactoWebDB', 1);
  request.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('leads', 'readwrite');
    tx.objectStore('leads').put(lead);
  };
}

async function startSession(payload) {
  queue = payload.queries || [payload.query];
  const isInfinite = payload.isInfinite;
  const limit = payload.limit;
  const speed = payload.speed;
  
  await setState({ status: "running", totalQueries: queue.length, currentQueryIndex: 0, extracted: 0 });
  
  // Abre ou reutiliza aba
  const [tab] = await chrome.tabs.query({ url: "*://*.google.com/maps/*" });
  if (tab) {
    activeTabId = tab.id;
    chrome.tabs.update(activeTabId, { url: `https://www.google.com/maps/search/${encodeURIComponent(queue[0])}` });
  } else {
    const newTab = await chrome.tabs.create({ url: `https://www.google.com/maps/search/${encodeURIComponent(queue[0])}` });
    activeTabId = newTab.id;
  }
  
  await new Promise(r => setTimeout(r, 3000)); // Espera carregar
  
  chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ["content.js"] }, () => {
    chrome.tabs.sendMessage(activeTabId, { 
      type: "RUN_SCRAPE", 
      payload: { query: queue[0], limit, isInfinite, speed } 
    });
  });
}

function finishCurrentQuery() {
  queue.shift();
  if (queue.length > 0) {
    // Inicia próxima
    chrome.tabs.update(activeTabId, { url: `https://www.google.com/maps/search/${encodeURIComponent(queue[0])}` });
    setTimeout(() => {
      chrome.tabs.sendMessage(activeTabId, { 
        type: "RUN_SCRAPE", 
        payload: { query: queue[0], limit: 9999, isInfinite: true, speed: 'normal' } 
      });
    }, 3000);
  } else {
    setState({ status: "done" });
    relayToPopup({ type: "DONE" });
  }
}