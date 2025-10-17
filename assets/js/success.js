// Lee token desde querystring (?token=...)
function getTokenFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "";
}

function setHelper(el, msg, type = "info") {
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("status--success", "status--error", "status--info");
  const cls = type === "success" ? "status--success" : type === "error" ? "status--error" : "status--info";
  el.classList.add(cls);
}

function downloadAsImage(token) {
  // Crear imagen blanca con texto negro centrado
  const canvas = document.createElement("canvas");
  const pxRatio = Math.max(1, Math.min(3, Math.floor(window.devicePixelRatio || 1))); // limitar escala
  const width = 1200;
  const height = 630;
  canvas.width = width * pxRatio;
  canvas.height = height * pxRatio;

  const ctx = canvas.getContext("2d");
  ctx.scale(pxRatio, pxRatio);
  // Fondo blanco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Texto negro centrado
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 96px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  const y = height / 2;
  ctx.fillText(token, width / 2, y);

  // Subtítulo
  ctx.font = "24px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  ctx.fillText("Preséntalo al ingresar", width / 2, y + 80);

  const link = document.createElement("a");
  link.download = `codigo-${token}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.addEventListener("DOMContentLoaded", () => {
  const token = getTokenFromQuery();
  const codeDisplay = document.getElementById("codeDisplay");
  const codeText = document.getElementById("codeText");
  const copyBtn = document.getElementById("copyBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const helper = document.getElementById("helperMsg");

  function autoShrink() {
    // Reduce la fuente si se desborda el ancho/alto del contenedor
    const parent = codeDisplay;
    const el = codeText;
    if (!parent || !el) return;
    let size = parseFloat(getComputedStyle(el).fontSize);
    const min = 20; // tamaño mínimo
    for (let i = 0; i < 10; i++) { // máx 10 iteraciones
      if (el.scrollWidth <= parent.clientWidth && el.scrollHeight <= parent.clientHeight) break;
      size = Math.max(min, size - 2);
      el.style.fontSize = size + "px";
      if (size === min) break;
    }
  }

  if (token) {
    codeText.textContent = token;
    // Espera un frame para calcular tamaños y ajustar
    requestAnimationFrame(autoShrink);
  } else {
    codeText.textContent = "—";
    setHelper(helper, "No se encontró código en la URL.", "error");
  }

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(token);
      setHelper(helper, "Código copiado al portapapeles.", "success");
    } catch (e) {
      setHelper(helper, "No se pudo copiar. Copia manualmente.", "error");
    }
  });

  downloadBtn.addEventListener("click", () => {
    if (!token) {
      setHelper(helper, "No hay código para descargar.", "error");
      return;
    }
    downloadAsImage(token);
    setHelper(helper, "Descarga iniciada.", "info");
  });
});
