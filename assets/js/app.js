// === util corto ===
const $ = (sel) => document.querySelector(sel);

// === elementos ===
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
  formDirect: $("#direct-post"),
  iframe: $("#upload_iframe"),
};

let stream = null;
let currentBlob = null;
let currentToken = null;
let shotTaken = false;

// Genera token legible
function generateToken() {
  const part = () => Math.random().toString(36).slice(2,6).toUpperCase();
  return `A-${part()}-${part()}`;
}

// Inicializa cámara frontal
async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    els.video.srcObject = stream;
    els.fallback.hidden = true;
  } catch (e) {
    els.fallback.hidden = false;
    els.shotStatus.textContent = "No se pudo abrir la cámara. Usa el botón alterno.";
  }
}

// Estampa token + timestamp
function drawStamp(ctx, token) {
  const pad = 12;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(pad, pad, 280, 70);
  ctx.fillStyle = "#000";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText(`Código: ${token}`, pad + 10, pad + 28);
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleString(), pad + 10, pad + 52);
}

// Captura del <video> a Blob JPEG
async function takeShot() {
  const video = els.video;
  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");

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

// Fallback: estampar sobre archivo seleccionado
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

// === eventos ===
window.addEventListener("DOMContentLoaded", async () => {
  // token
  currentToken = generateToken();
  els.token.textContent = currentToken;

  // cámara
  await initCamera();

  // capturar
  els.btnCapture.addEventListener("click", async () => {
    try {
      els.shotStatus.textContent = "Capturando…";
      if (els.fallback.hidden) {
        currentBlob = await takeShot();
      } else {
        const f = els.fileFallback.files?.[0];
        if (!f) { els.shotStatus.textContent = "Selecciona o toma una foto primero."; return; }
        currentBlob = await stampOnFile(f);
      }
      shotTaken = true;
      els.shotStatus.textContent = "Foto lista ✔️";
      els.btnRetake.hidden = false;
    } catch (e) {
      els.shotStatus.textContent = "No se pudo capturar la foto. Reintenta.";
    }
  });

  // repetir
  els.btnRetake.addEventListener("click", () => {
    shotTaken = false;
    currentBlob = null;
    els.shotStatus.textContent = "Toma una nueva foto.";
    els.btnRetake.hidden = true;
  });

  // envío SIN CORS: form oculto + iframe
  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.sendStatus.textContent = "";

    // validaciones mínimas
    if (!els.nombre.value.trim()) { els.sendStatus.textContent = "Escribe tu nombre."; return; }
    if (!shotTaken || !currentBlob) { els.sendStatus.textContent = "Toma la foto primero."; return; }
    if (!els.consent.checked) { els.sendStatus.textContent = "Debes aceptar la política de datos."; return; }

    try {
      els.btnSubmit.disabled = true;
      els.btnSubmit.textContent = "Enviando…";

      // pasar campos al form directo
      const f = els.formDirect;
      f.elements.nombre.value = els.nombre.value.trim();
      f.elements.token.value  = currentToken;
      f.elements.consent.value = "true";
      f.elements.consent_timestamp.value = new Date().toISOString();
      f.elements.policy_url.value = "https://alicoempaques.com/blogs/politicas/politicas-de-privacidad";
      f.elements.ua.value = navigator.userAgent;
      f.elements.tz.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      f.elements.res.value = `${screen.width}x${screen.height}`;

      // archivo desde el blob
      const dt = new DataTransfer();
      dt.items.add(new File([currentBlob], `selfie_${currentToken}.jpg`, { type: "image/jpeg" }));
      f.elements.file.files = dt.files;

      // cuando el iframe carga, consideramos éxito
      const onLoad = () => {
        els.sendStatus.textContent = "Enviado correctamente. Revisa Drive/Sheet.";
        els.btnSubmit.disabled = false;
        els.btnSubmit.textContent = "Enviar";
        els.iframe.removeEventListener("load", onLoad);
      };
      els.iframe.addEventListener("load", onLoad);

      // enviar
      f.submit();

    } catch (err) {
      els.sendStatus.textContent = "Error al enviar: " + err.message;
      els.btnSubmit.disabled = false;
      els.btnSubmit.textContent = "Enviar";
    }
  });
});

// limpiar cámara al salir
window.addEventListener("beforeunload", () => {
  try { stream && stream.getTracks().forEach(t => t.stop()); } catch {}
});
