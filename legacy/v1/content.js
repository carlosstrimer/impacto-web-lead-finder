(function () {
  if (window.__empresasSemSiteLoaded) return;
  window.__empresasSemSiteLoaded = true;
  let shouldStop = false;
  const seen = new Set();
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "RUN_SCRAPE") { shouldStop = false; runScrape(msg.payload).catch((e) => { bgLog("Erro fatal: " + (e?.message || e)); bgDone([]); }); sendResponse({ ok: true }); return true; }
    if (msg.type === "STOP_SCRAPE") { shouldStop = true; bgLog("Parada solicitada."); sendResponse({ ok: true }); return true; }
  });
  function bgSend(msg) { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch (_) {} }
  function bgLog(message) { bgSend({ type: "BG_LOG", message: String(message) }); }
  function bgProgress(extracted, limit) { bgSend({ type: "BG_PROGRESS", extracted, limit }); }
  function bgDone(results) { bgSend({ type: "BG_DONE", results }); }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function waitForElement(selector, timeoutMs) {
    return new Promise((resolve) => {
      const found = document.querySelector(selector); if (found) return resolve(found);
      const observer = new MutationObserver(() => { const el = document.querySelector(selector); if (el) { observer.disconnect(); resolve(el); } });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(document.querySelector(selector)); }, timeoutMs);
    });
  }
  async function handleConsent() {
    const btn = document.querySelector('button[aria-label*="Aceitar tudo"], button[aria-label*="Aceitar"], button[aria-label*="Accept all"], button[aria-label*="Accept"], form[action*="consent"] button');
    if (btn) { bgLog("Fechando banner de consentimento..."); btn.click(); await sleep(1200); }
  }
  function normalizePhone(raw) {
    if (!raw) return ""; const digits = String(raw).replace(/\D/g, ""); if (digits.length < 8) return "";
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 13 && digits.startsWith("55")) return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    if (digits.length === 12 && digits.startsWith("55")) return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    return String(raw).trim();
  }
  function formatWhatsapp(num) { const s = String(num).replace(/\D/g, ""); if (s.length === 13) return `+${s.slice(0, 2)} ${s.slice(2, 4)} ${s.slice(4, 9)}-${s.slice(9)}`; if (s.length === 12) return `+${s.slice(0, 2)} ${s.slice(2, 4)} ${s.slice(4, 8)}-${s.slice(8)}`; return "+" + s; }
  function classifySite(url) {
    if (!url) return { type: "none" };
    const u = String(url).toLowerCase();
    const whatsappHints = ["wa.me", "api.whatsapp.com", "web.whatsapp.com", "whatsapp.com/send"];
    if (whatsappHints.some((h) => u.includes(h))) { const m = u.match(/wa\.me\/(\d+)/); return { type: "whatsapp", whatsapp: m ? formatWhatsapp(m[1]) : "" }; }
    const noProto = u.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (/^[\d\s()+-]{8,}$/.test(noProto)) { return { type: "whatsapp", whatsapp: normalizePhone(noProto) }; }
    if (u.includes("instagram.com") || u.includes("instagr.am")) { return { type: "social", instagram: url }; }
    if (u.includes("facebook.com") || u.includes("fb.me") || u.includes("m.me") || u.includes("messenger.com")) { return { type: "social", facebook: url }; }
    const other = ["t.me", "linktr.ee", "beacons.ai", "bio.link", "linkr.bio", "tiktok.com"];
    if (other.some((d) => u.includes(d))) { return { type: "social" }; }
    return { type: "site" };
  }
  async function checkSite(url) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
      await fetch(url, { method: "GET", mode: "no-cors", redirect: "follow", signal: controller.signal, cache: "no-store" });
      clearTimeout(timer); return true;
    } catch (e) { if (e && e.name === "AbortError") return false; return false; }
  }
  async function extractDetailsFromPanel(panel) {
    const nome = (panel.querySelector("h1")?.textContent || "").trim(); if (!nome) return null;
    let telefone = ""; const phoneBtn = panel.querySelector('button[data-item-id*="phone:tel:"]');
    if (phoneBtn) { const aria = phoneBtn.getAttribute("aria-label") || ""; const raw = aria.replace(/^.*?:\s*/, "").trim(); telefone = normalizePhone(raw); }
    if (!telefone) { const telLink = panel.querySelector('a[href^="tel:"]'); if (telLink) telefone = normalizePhone(telLink.getAttribute("href").replace("tel:", "")); }
    let siteInformado = ""; const webLink = panel.querySelector('a[data-item-id="authority"]'); if (webLink) siteInformado = webLink.getAttribute("href") || "";
    let endereco = ""; const addrBtn = panel.querySelector('button[data-item-id="address"]'); if (addrBtn) { const aria = addrBtn.getAttribute("aria-label") || ""; endereco = aria.replace(/^.*?:\s*/, "").trim(); }
    let categoria = ""; const catBtn = panel.querySelector('button[jsaction*="category"]') || panel.querySelector("button.DkEaL"); if (catBtn) categoria = catBtn.textContent.trim();
    let nota = ""; let avaliacoes = ""; const ratingBox = panel.querySelector("div.F7nice");
    if (ratingBox) {
      const ratingSpan = ratingBox.querySelector('span[aria-hidden="true"]'); if (ratingSpan) nota = ratingSpan.textContent.trim();
      const reviewsSpan = ratingBox.querySelector('span[aria-label*="avalia"]'); if (reviewsSpan) { const lbl = reviewsSpan.getAttribute("aria-label") || ""; const num = lbl.replace(/\D/g, ""); if (num) avaliacoes = num; }
    }
    if (!avaliacoes) { const revBtn = panel.querySelector('button[jsaction*="reviews"]'); if (revBtn) { const m = revBtn.textContent.match(/([\d.]+)/); if (m) avaliacoes = m[1].replace(/\./g, ""); } }
    const social = classifySite(siteInformado);
    let motivo = null; let whatsapp = social.whatsapp || ""; let instagram = social.instagram || ""; let facebook = social.facebook || "";
    if (social.type === "whatsapp") { motivo = "SO_WHATSAPP"; }
    else if (social.type === "social") { motivo = "SO_REDES"; }
    else if (social.type === "site" && siteInformado) {
      const ok = await checkSite(siteInformado);
      if (ok === true) return null;
      if (ok === false) motivo = "SITE_QUEBRADO";
      else return null;
    } else { motivo = "SEM_SITE"; }
    return { nome, telefone: telefone || "Sem telefone", whatsapp, instagram, facebook, motivo, endereco, categoria, nota, avaliacoes, siteInformado, linkGoogleMaps: "" };
  }
  async function processLink(link) {
    const href = link.href; try { link.scrollIntoView({ block: "center" }); } catch (_) {}
    await sleep(200); link.click(); await sleep(1200);
    const panel = (await waitForElement('div[role="main"][aria-label]', 6000)) || (await waitForElement('div[role="main"]', 4000));
    if (!panel) return null; await sleep(400);
    const data = await extractDetailsFromPanel(panel); if (!data) return null; data.linkGoogleMaps = href; return data;
  }
  async function runScrape(payload) {
    const { keyword, limit, speed, include } = payload;
    bgLog(`Iniciando extração para: "${keyword}" (limite: ${limit})`);
    await handleConsent();
    const feed = await waitForElement('div[role="feed"]', 15000);
    if (!feed) { bgLog("Não encontrei a lista de resultados. A busca foi concluída?"); bgDone([]); return; }
    bgLog("Lista de resultados carregada.");
    const delays = { slow: [2000, 3000], normal: [1000, 2000], fast: [500, 1000] }[speed] || [1000, 2000];
    const results = []; let scrollStrikes = 0; const maxScrollStrikes = 12;
    while (results.length < limit && !shouldStop) {
      const links = Array.from(feed.querySelectorAll('a[href*="/maps/place/"]')); let foundNew = false;
      for (const link of links) {
        if (shouldStop) break; if (results.length >= limit) break;
        const href = link.href; if (seen.has(href)) continue; seen.add(href); foundNew = true;
        try {
          const data = await processLink(link);
          if (data) {
            const wanted = !!include[data.motivo];
            if (wanted) { results.push(data); bgProgress(results.length, limit); const extra = data.siteInformado ? ` — ${data.siteInformado}` : ""; bgLog(`[${results.length}/${limit}] ${data.nome} (${data.motivo})${extra}`); }
            else { bgLog(`Ignorado (${data.motivo}): ${data.nome}`); }
          }
        } catch (e) { bgLog("Erro em um card: " + (e?.message || e)); }
        const [minD, maxD] = delays; const d = minD + Math.random() * (maxD - minD); await sleep(d);
      }
      if (results.length >= limit || shouldStop) break;
      if (!foundNew) { scrollStrikes++; if (scrollStrikes >= maxScrollStrikes) { bgLog("Sem mais resultados novos. Encerrando."); break; } } else { scrollStrikes = 0; }
      feed.scrollTop = feed.scrollHeight; await sleep(1400);
      const text = feed.innerText || "";
      if (text.includes("Você chegou ao fim da lista") || text.includes("You've reached the end of the list")) { bgLog("Fim da lista alcançado."); break; }
    }
    if (shouldStop) bgLog("Extração interrompida.");
    if (results.length < limit && !shouldStop) { bgLog(`Sem mais resultados disponíveis. Coletadas: ${results.length}.`); }
    bgLog(`Concluído. ${results.length} empresa(s) coletada(s).`);
    bgDone(results);
  }
})();