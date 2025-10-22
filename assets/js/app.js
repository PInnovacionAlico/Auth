// ===== Referencias a elementos del DOM =====
const els = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  captureBtn: document.getElementById("captureBtn"),
  form: document.getElementById("photoForm"),
  nombre: document.getElementById("nombre"),
  formDirect: document.getElementById("direct-post"),
  status: document.getElementById("status"),
  submitStatus: document.getElementById("submitStatus"),
  image_b64: document.getElementById("image_b64"),
  consent: document.getElementById("consent"),
  preview: document.getElementById("preview"),
  toggleCamera: document.getElementById("toggleCamera"),
  uploadIframe: document.getElementById("upload_iframe"),
};

let mediaStream = null;
let currentBlob = null;
let currentToken = null;
let lastPreviewUrl = null;
// Helper para actualizar mensajes con clases de estado
function setStatus(el, text, type = "info") {
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("status--success", "status--error", "status--info");
  const cls = type === "success" ? "status--success" : type === "error" ? "status--error" : "status--info";
  el.classList.add(cls);
}


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

// Habilitar/Deshabilitar botón de captura según nombre
function updateCaptureEnabled() {
  const hasName = (els.nombre?.value || "").trim().length > 0;
  const cameraActive = !!mediaStream;
  els.captureBtn.disabled = !(hasName && cameraActive);
}

els.nombre?.addEventListener("input", updateCaptureEnabled);
// Estado inicial al cargar
updateCaptureEnabled();

// ===== Cámara (bajo demanda) =====
async function initCamera() {
  if (mediaStream) return; // ya activa
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }, // cámara frontal
      audio: false,
    });
    els.video.srcObject = mediaStream;
    els.video.classList.remove("is-hidden");
    setStatus(els.status, "Cámara activada.", "info");
  } catch (err) {
    setStatus(els.status, "No se pudo acceder a la cámara: " + err.message, "error");
    if (els.toggleCamera) els.toggleCamera.checked = false;
  }
}

function stopCamera() {
  try {
    if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  } catch {}
  mediaStream = null;
  els.video.srcObject = null;
  els.video.classList.add("is-hidden");
  setStatus(els.status, "Cámara desactivada.", "info");
}

// Toggle de cámara
els.toggleCamera?.addEventListener("change", async (e) => {
  if (e.target.checked) {
    await initCamera();
  } else {
    stopCamera();
  }
  updateCaptureEnabled();
});

// ===== Capturar foto con imprint =====
els.captureBtn.addEventListener("click", () => {
  try {
    // Validación extra por si acaso
    const nombreVal = (els.nombre?.value || "").trim();
    if (!nombreVal) {
      setStatus(els.status, "Escribe tu nombre antes de tomar la foto.", "error");
      return;
    }
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
        setStatus(els.status, `Foto capturada ✅ Código: ${currentToken}` , "success");

        // Actualiza la vista previa con un objeto URL para eficiencia
        if (els.preview) {
          if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
          lastPreviewUrl = URL.createObjectURL(blob);
          els.preview.src = lastPreviewUrl;
          els.preview.style.display = "block";
        }
      },
      "image/jpeg",
      0.92
    );
  } catch (e) {
    setStatus(els.status, "No se pudo capturar la foto. Intenta de nuevo.", "error");
  }
});

// ===== Envío (form + iframe, sin CORS) =====
els.form.addEventListener("submit", (e) => {
  e.preventDefault();

  const nombre = els.form.nombre?.value?.trim() || "";

  // Validaciones mínimas
  if (!nombre) {
    setStatus(els.submitStatus, "Escribe tu nombre.", "error");
    return;
  }
  if (!currentToken || !els.canvas.width) {
    setStatus(els.submitStatus, "Toma la foto primero.", "error");
    return;
  }
  if (!els.consent.checked) {
    setStatus(els.submitStatus, "Debes aceptar la política de datos.", "error");
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
  setStatus(els.submitStatus, "Enviando…", "info");
  f.submit();

  // Redirección robusta: espera a que el iframe cargue, con fallback por tiempo
  const target = new URL("success.html", window.location.href);
  target.searchParams.set("token", currentToken);

  let redirected = false;
  const doRedirect = (source) => {
    if (redirected) return;
    redirected = true;
    setStatus(els.submitStatus, "Enviado correctamente. Redirigiendo…", "success");
    console.log("[Redirigiendo a success.html]", { source, url: target.toString() });
    window.location.replace(target.toString());
  };

  // Si el iframe notifica carga, redirige
  if (els.uploadIframe) {
    els.uploadIframe.addEventListener("load", () => doRedirect("iframe-load"), { once: true });
  }
  // Fallback por si no se dispara load (p.ej., respuesta sin cuerpo)
  setTimeout(() => doRedirect("timeout"), 2000);
});

// ===== Limpieza =====
window.addEventListener("beforeunload", () => {
  try {
    if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  } catch {}
});