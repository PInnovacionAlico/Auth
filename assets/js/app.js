// ====== CONFIGURA AQUÍ TU ENDPOINT DE APPS SCRIPT ======
const ENDPOINT = "https://script.google.com/macros/s/AKfycbwMA8h9Iwcag-CjuKBgvCeuWnUvsYAjCarf2E88A5O5bTYQs14NKiGmo7ZXGCa6LD-ZEg/exec"; // p.ej. "https://script.google.com/macros/s/AKfycb.../exec"
// =======================================================

// util
const $ = (sel) => document.querySelector(sel);

const els = {
  form: $("#verify-form"),
  nombre: $("#nombre"),
  token: $("#token"),
  video: $("#video"),
  canvas: $("#canvas"),
  btnCapture: $("#btn-capture"),
  btnRetake: $("#btn-retake"),
  shotStatus: $("#shot-status"),
  sendStatus: $("#send-status"),
  btnSubmit: $("#btn-submit"),
  fallback: $("#fallback"),
  fileFallback: $("#file-fallback"),
  consent: $("#acepto"),
};

let stream = null;
let currentBlob = null;
let currentToken = null;
let shotTaken = false;

// Genera un token legible; puedes cambiarlo por UUID si prefieres
function generateToken() {
  const part = () => Math.random().toString(36).slice(2,6).toUpperCase();
  return `A-${part()}-${part()}`;
}

// Inicializa cámara frontal
async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }, // frontal
      audio: false
    });
    els.video.srcObject = stream;
    els.fallback.hidden = true;
  } catch (e) {
    // Fallback: si la cámara falla, permitimos subir desde input (abrirá cámara en muchos móviles)
    els.fallback.hidden = false;
    els.shotStatus.textContent = "No se pudo abrir la cámara. Usa el botón alterno.";
  }
}

// Estampa token y timestamp en la imagen
function drawStamp(ctx, token) {
  const pad = 12;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(pad, pad, 260, 68);
  ctx.fillStyle = "#000";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText(`Código: ${token}`, pad + 10, pad + 28);
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleString(), pad + 10, pad + 52);
}

// Captura frame del video y lo convierte a Blob JPEG con sello
async function takeShot() {
  const video = els.video;
  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");

  // Ajusta canvas al aspect ratio del video
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 960;
  canvas.width = vw;
  canvas.height = vh;

  ctx.drawImage(video, 0, 0, vw, vh);
  drawStamp(ctx, currentToken);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

// Fallback: si el usuario usó input file, estampamos igual
async function stampOnFile(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = url;
  });

  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");
  canvas.width = img.naturalWidth || 1280;
  canvas.height = img.naturalHeight || 960;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  drawStamp(ctx, currentToken);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      URL.revokeObjectURL(url);
      resolve(blob);
    }, "image/jpeg", 0.92);
  });
}

// === Eventos ===
window.addEventListener("DOMContentLoaded", async () => {
  // genera token de sesión
  currentToken = generateToken();
  els.token.textContent = currentToken;

  await initCamera();

  // Capturar
  els.btnCapture.addEventListener("click", async () => {
    try {
      els.shotStatus.textContent = "Capturando…";
      if (els.fallback.hidden) {
        currentBlob = await takeShot();
      } else {
        const f = els.fileFallback.files?.[0];
        if (!f) {
          els.shotStatus.textContent = "Selecciona o toma una foto primero.";
          return;
        }
        currentBlob = await stampOnFile(f);
      }
      shotTaken = true;
      els.shotStatus.textContent = "Foto lista ✔️";
      els.btnRetake.hidden = false;
    } catch (e) {
      els.shotStatus.textContent = "No se pudo capturar la foto. Reintenta.";
    }
  });

  // Repetir
  els.btnRetake.addEventListener("click", () => {
    shotTaken = false;
    currentBlob = null;
    els.shotStatus.textContent = "Toma una nueva foto.";
    els.btnRetake.hidden = true;
  });

  // Envío
  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.sendStatus.textContent = "";

    // Validaciones mínimas
    if (!els.nombre.value.trim()) {
      els.sendStatus.textContent = "Escribe tu nombre.";
      return;
    }
    if (!shotTaken || !currentBlob) {
      els.sendStatus.textContent = "Toma la foto primero.";
      return;
    }
    if (!els.consent.checked) {
      els.sendStatus.textContent = "Debes aceptar la política de datos.";
      return;
    }

    // Si aún no configuraste ENDPOINT, solo muestra demo
    if (!ENDPOINT) {
      els.sendStatus.innerHTML = "✔️ Modo demo: se enviaría la imagen con el token <b>" + currentToken + "</b> a Apps Script.";
      return;
    }

    try {
      els.btnSubmit.disabled = true;
      els.btnSubmit.textContent = "Enviando…";

      const fd = new FormData();
      fd.append("nombre", els.nombre.value.trim());
      fd.append("file", currentBlob, `selfie_${currentToken}.jpg`);
      fd.append("token", currentToken);

      // Evidencia de consentimiento
      fd.append("consent", "true");
      fd.append("consent_timestamp", new Date().toISOString());
      fd.append("policy_url", "https://alicoempaques.com/blogs/politicas/politicas-de-privacidad");

      // Señales suaves del dispositivo (opcional)
      fd.append("ua", navigator.userAgent);
      fd.append("tz", Intl.DateTimeFormat().resolvedOptions().timeZone || "");
      fd.append("res", `${screen.width}x${screen.height}`);

      const r = await fetch(ENDPOINT, { method: "POST", body: fd});
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json().catch(() => ({}));

      els.sendStatus.textContent = data?.token
        ? `Enviado correctamente. Folio: ${data.token}`
        : "Enviado correctamente.";
    } catch (err) {
      els.sendStatus.textContent = "Error al enviar: " + err.message;
    } finally {
      els.btnSubmit.disabled = false;
      els.btnSubmit.textContent = "Enviar";
    }
  });
});

// Limpieza del stream al salir
window.addEventListener("beforeunload", () => {
  try { stream && stream.getTracks().forEach(t => t.stop()); } catch {}
});
