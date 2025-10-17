// ===== Referencias a elementos del DOM =====
const els = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  captureBtn: document.getElementById("captureBtn"),
  form: document.getElementById("photoForm"),
  formDirect: document.getElementById("direct-post"),
  status: document.getElementById("status"),
  image_b64: document.getElementById("image_b64"),
  consent: document.getElementById("consent"),
};

let mediaStream = null;
let currentBlob = null;
let currentToken = null;

// ===== Utilidades =====
function generateToken() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `A-${part()}-${part()}`;
}

function drawImprint(ctx, canvas, token) {
  if (!token) return;

  const pad = 18;
  const x = canvas.width - pad;
  const y = canvas.height - pad;

  // Bloque semitransparente para legibilidad
  const boxW = Math.max(260, ctx.measureText(token).width + 40);
  const boxH = 70;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x - boxW, y - boxH, boxW, boxH);

  // Texto principal (token)
  ctx.textAlign = "right";
  ctx.lineJoin = "round";
  ctx.font = "bold 32px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

  // Sombra/contorno oscuro
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 4;
  ctx.strokeText(token, x - 10, y - 22);

  // Relleno claro encima
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(token, x - 10, y - 22);

  // Timestamp debajo del token
  const ts = new Date().toLocaleString();
  ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  ctx.strokeText(ts, x - 10, y - 4);
  ctx.fillText(ts, x - 10, y - 4);
}

// Convierte dataURL a Blob (por si quieres usar currentBlob)
function dataURLToBlob(dataURL) {
  const [meta, b64] = dataURL.split(",");
  const mime = meta.match(/data:(.*?);base64/)[1] || "image/jpeg";
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

// ===== Cámara =====
async function initCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }, // cámara frontal
      audio: false,
    });
    els.video.srcObject = mediaStream;
  } catch (err) {
    alert("No se pudo acceder a la cámara: " + err.message);
  }
}
initCamera();

// ===== Capturar foto con imprint =====
els.captureBtn.addEventListener("click", () => {
  try {
    // 1) Asegura que ya tienes token ANTES de dibujar
    if (!currentToken) currentToken = generateToken();

    // 2) Dibuja el frame del video
    const ctx = els.canvas.getContext("2d");
    els.canvas.width = els.video.videoWidth || 1280;
    els.canvas.height = els.video.videoHeight || 960;
    ctx.drawImage(els.video, 0, 0, els.canvas.width, els.canvas.height);

    // 3) Estampa token + timestamp
    drawImprint(ctx, els.canvas, currentToken);

    // 4) Guarda Blob (por si lo necesitas) y status
    els.canvas.toBlob(
      (blob) => {
        currentBlob = blob;
        els.status.textContent = `Foto capturada ✅ Código: ${currentToken}`;
      },
      "image/jpeg",
      0.92
    );
  } catch (e) {
    els.status.textContent = "No se pudo capturar la foto. Intenta de nuevo.";
  }
});

// ===== Envío (form + iframe, sin CORS) =====
els.form.addEventListener("submit", (e) => {
  e.preventDefault();

  const nombre = els.form.nombre?.value?.trim() || "";

  // Validaciones mínimas
  if (!nombre) {
    els.status.textContent = "Escribe tu nombre.";
    return;
  }
  if (!currentToken || !els.canvas.width) {
    els.status.textContent = "Toma la foto primero.";
    return;
  }
  if (!els.consent.checked) {
    els.status.textContent = "Debes aceptar la política de datos.";
    return;
  }

  // 1) Generar dataURL del canvas (ya contiene el imprint)
  const dataURL = els.canvas.toDataURL("image/jpeg", 0.92);

  // 2) Pasar campos al formulario oculto
  const f = els.formDirect;
  f.elements.nombre.value = nombre;
  f.elements.token.value = currentToken;
  f.elements.consent.value = "true";
  f.elements.ua.value = navigator.userAgent;
  f.elements.tz.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  f.elements.res.value = `${screen.width}x${screen.height}`;
  f.elements.image_b64.value = dataURL; // 👈 aquí va la imagen con el sello (base64)

  // 3) Enviar
  els.status.textContent = "Enviando…";
  f.submit();
  els.status.textContent = "Enviado correctamente. Revisa Drive/Sheet.";
});

// ===== Limpieza =====
window.addEventListener("beforeunload", () => {
  try {
    if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  } catch {}
});
