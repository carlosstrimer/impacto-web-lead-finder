// FILE: content.js
(function () {
  if (window.__iwLeadFinderLoaded) return;
  window.__iwLeadFinderLoaded = true;

  let shouldStop = false;
  let shouldPause = false;
  const seenUrls = new Set();

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "RUN_SCRAPE") {
      shouldStop = false; shouldPause = false;
      runScrape(msg.payload).catch(e => bgLog("ERROR", "Erro fatal: " + e.message));
      sendResponse({ ok: true });
    }
    if (msg.type === "STOP_SCRAPE") { shouldStop = true; shouldPause = false; sendResponse({ ok: true }); }
    if (msg.type === "PAUSE_SCRAPE") { shouldPause = true; sendResponse({ ok: true }); }
    if (msg.type === "RESUME_SCRAPE") { shouldPause = false; sendResponse({ ok: true }); }
    return true;
  });

  function bgSend(msg) { try { chrome.runtime.sendMessage(msg); } catch (_) {} }
  function bgLog(level, message) { bgSend({ type: "BG_LOG", level, message }); }
  function bgProgress(extracted, limit, isInfinite) { bgSend({ type: "BG_PROGRESS", extracted, limit, isInfinite }); }
  function bgLead(lead) { bgSend({ type: "BG_LEAD", lead }); }
  function bgDone(reason) { bgSend({ type: "BG_DONE", reason }); }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function detectBlock() {
    if (document.querySelector('form[action*="consent"]') || document.body.innerHTML.includes("recaptcha")) {
      return true;
    }
    return false;
  }

  function normalizePhone(raw) {
    if (!raw) return "";
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length < 8) return raw;
    // BR
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.startsWith("55") && digits.length >= 12) {
      const d = digits.slice(2);
      return d.length === 11 ? `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    // US
    if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) {
      const d = digits.length === 11 ? digits.slice(1) : digits;
      return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return raw; // Outros países (retorna original)
  }

  function classifySite(url) {
    if (!url) return { type: "SEM_SITE", label: "Sem site" };
    const u = String(url).toLowerCase();
    
    if (["wa.me", "api.whatsapp.com", "web.whatsapp.com", "whatsapp.com/send"].some(h => u.includes(h))) {
      const m = u.match(/wa\.me\/(\d+)/);
      return { type: "SO_WHATSAPP", whatsapp: m ? "+" + m[1] : "" };
    }
    if (/^[\d\s()+-]{8,}$/.test(u.replace(/^https?:\/\//, ""))) {
      return { type: "SO_WHATSAPP", whatsapp: normalizePhone(u) };
    }
    if (u.includes("instagram.com") || u.includes("instagr.am")) return { type: "SO_INSTAGRAM", instagram: url };
    if (u.includes("facebook.com") || u.includes("fb.me") || u.includes("m.me")) return { type: "SO_FACEBOOK", facebook: url };
    if (["t.me", "linktr.ee", "beacons.ai", "bio.link", "linkr.bio", "tiktok.com"].some(d => u.includes(d))) {
      return { type: "LINK_IN_BIO", label: "Link na bio" };
    }
    return { type: "COM_SITE", label: "Possui site" };
  }

  async function checkSite(url) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { method: "GET", mode: "no-cors", signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      return "COM_SITE"; // Se resolveu (mesmo opaque), consideramos online
    } catch (e) {
      if (e.name === "AbortError") return "SITE_INDISPONIVEL"; // Timeout = Fora do ar
      return "INDETERMINADO"; // Erro de rede/CORS = Inconclusivo
    }
  }

  async function extractPanelData(panel, href) {
    const nome = (panel.querySelector("h1")?.textContent || "").trim();
    if (!nome) return null;

    let telefone = "";
    const phoneBtn = panel.querySelector('button[data-item-id*="phone:tel:"]');
    if (phoneBtn) telefone = normalizePhone(phoneBtn.getAttribute("aria-label").replace(/^.*?:\s*/, "").trim());
    
    let siteInformado = "";
    const webLink = panel.querySelector('a[data-item-id="authority"]');
    if (webLink) siteInformado = webLink.getAttribute("href") || "";

    let endereco = "";
    const addrBtn = panel.querySelector('button[data-item-id="address"]');
    if (addrBtn) endereco = addrBtn.getAttribute("aria-label").replace(/^.*?:\s*/, "").trim();

    let categoria = "";
    const catBtn = panel.querySelector('button[jsaction*="category"]');
    if (catBtn) categoria = catBtn.textContent.trim();

    let nota = 0, avaliacoes = 0;
    const ratingBox = panel.querySelector("div.F7nice");
    if (ratingBox) {
      const rSpan = ratingBox.querySelector('span[aria-hidden="true"]');
      if (rSpan) nota = parseFloat(rSpan.textContent.replace(",", ".")) || 0;
      const revSpan = ratingBox.querySelector('span[aria-label*="avalia"]');
      if (revSpan) avaliacoes = parseInt(revSpan.getAttribute("aria-label").replace(/\D/g, "")) || 0;
    }

    const social = classifySite(siteInformado);
    let presenca = social.type;
    
    if (presenca === "COM_SITE") {
      const siteStatus = await checkSite(siteInformado);
      presenca = siteStatus;
    }

    return {
      place_id: href.split("?")[0], // ID único baseado na URL
      nome, telefone: telefone || "Não encontrado",
      whatsapp: social.whatsapp || "",
      instagram: social.instagram || "",
      facebook: social.facebook || "",
      siteInformado,
      presenca,
      endereco: endereco || "Não encontrado",
      categoria: categoria || "Não encontrado",
      nota, avaliacoes,
      linkGoogleMaps: href
    };
  }

  async function runScrape(payload) {
    const { query, limit, isInfinite, speed } = payload;
    bgLog("INFO", `Iniciando extração: "${query}" (Modo: ${isInfinite ? 'Até o fim' : limit})`);

    const feed = document.querySelector('div[role="feed"]');
    if (!feed) { bgLog("ERROR", "Lista do Google Maps não encontrada."); bgDone("Erro na página"); return; }

    const delays = { slow: 3000, normal: 1500, fast: 800 }[speed] || 1500;
    let extracted = 0;
    let scrollStrikes = 0;
    const maxStrikes = 15; // Proteção contra loop infinito

    while (!shouldStop && (isInfinite || extracted < limit)) {
      if (shouldPause) { await sleep(2000); continue; }
      
      if (detectBlock()) {
        bgLog("WARNING", "Bloqueio ou CAPTCHA detectado. Pausando.");
        bgSend({ type: "BG_BLOCKED" });
        break;
      }

      const links = Array.from(feed.querySelectorAll('a[href*="/maps/place/"]'));
      let foundNew = false;

      for (const link of links) {
        if (shouldStop || (!isInfinite && extracted >= limit)) break;
        if (shouldPause) break;
        
        const href = link.href;
        if (seenUrls.has(href)) continue;
        seenUrls.add(href);
        foundNew = true;

        try {
          link.scrollIntoView({ block: "center" });
          await sleep(300);
          link.click();
          await sleep(1200); // Espera painel carregar

          const panel = document.querySelector('div[role="main"]');
          if (panel) {
            const data = await extractPanelData(panel, href);
            if (data) {
              data.queryOrigem = query;
              data.dataColeta = Date.now();
              data.status = "Novo";
              data.score = 0; // Será calculado no dashboard/background

              bgLead(data);
              extracted++;
              bgProgress(extracted, limit, isInfinite);
              bgLog("SUCCESS", `Lead: ${data.nome} (${data.presenca})`);
            }
          }
        } catch (e) {
          bgLog("WARNING", "Erro ao ler um card. Pulando...");
        }
        await sleep(delays);
      }

      if (shouldStop || (!isInfinite && extracted >= limit)) break;

      if (!foundNew) {
        scrollStrikes++;
        if (scrollStrikes >= maxStrikes) {
          bgLog("INFO", "Fim dos resultados locais ou Google parou de carregar.");
          break;
        }
      } else {
        scrollStrikes = 0;
      }

      feed.scrollTop = feed.scrollHeight;
      await sleep(1500);
    }

    if (shouldStop) bgLog("INFO", "Extração interrompida pelo usuário.");
    bgDone("Concluído");
  }
})();