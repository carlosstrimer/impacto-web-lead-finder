const $ = id => document.getElementById(id);
const btnStart = $("btn-start");
const btnPause = $("btn-pause");
const btnStop = $("btn-stop");
const btnDash = $("btn-dashboard");

document.addEventListener('DOMContentLoaded', async () => {
  const { sessionState } = await chrome.storage.local.get("sessionState");
  if (sessionState && sessionState.status === "running") {
    updateUI("running");
  }
});

btnStart.addEventListener("click", async () => {
  const raw = $("query").value.trim();
  if (!raw) return alert("Digite pelo menos uma pesquisa.");
  
  const queries = raw.split("\n").map(q => q.trim()).filter(Boolean);
  const limit = parseInt($("limit").value) || 50;
  const isInfinite = $("mode").value === "infinite";

  chrome.runtime.sendMessage({
    type: "START_EXTRACTION",
    payload: { queries, limit, isInfinite, speed: "normal" }
  });
  updateUI("running");
});

btnPause.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "PAUSE_EXTRACTION" });
  updateUI("paused");
});

btnStop.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_EXTRACTION" });
  updateUI("idle");
});

btnDash.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

function updateUI(state) {
  if (state === "running") {
    btnStart.disabled = true; btnPause.disabled = false; btnStop.disabled = false;
    $("status-text").textContent = "Extraindo...";
  } else if (state === "paused") {
    btnStart.disabled = true; btnPause.disabled = true; btnStop.disabled = false;
    $("status-text").textContent = "Pausado";
    btnPause.textContent = "Continuar";
    btnPause.onclick = () => {
      chrome.runtime.sendMessage({ type: "RESUME_EXTRACTION" });
      updateUI("running");
    };
  } else {
    btnStart.disabled = false; btnPause.disabled = true; btnStop.disabled = true;
    $("status-text").textContent = "Aguardando...";
    btnPause.textContent = "Pausar";
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "BG_PROGRESS") {
    $("status-text").textContent = `Extraídos: ${msg.extracted} ${msg.isInfinite ? '(Até o fim)' : `/ ${msg.limit}`}`;
    const pct = msg.isInfinite ? 100 : Math.min(100, (msg.extracted / msg.limit) * 100);
    $("progress-fill").style.width = pct + "%";
  }
  if (msg.type === "BG_BLOCKED") {
    $("status-text").textContent = "Bloqueio detectado. Ação manual necessária.";
    updateUI("paused");
  }
  if (msg.type === "DONE") {
    $("status-text").textContent = "Concluído!";
    updateUI("idle");
  }
});