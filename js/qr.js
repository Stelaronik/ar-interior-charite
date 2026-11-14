import qrcode from "../vendor/qrcode.js";

const $ = (selector) => document.querySelector(selector);

const form = $("#qr-form");
const urlInput = $("#qr-url");
const sizeSelect = $("#qr-size");
const ecSelect = $("#qr-ec");
const preview = $("#qr-preview");
const urlLabel = $("#qr-url-label");
const warning = $("#qr-warning");
const toast = $("#toast");

const isFile = location.protocol === "file:";
const fileWarning = isFile
  ? "Страница открыта как файл. Укажите URL опубликованного сайта вручную."
  : "";

let currentQR = null;
let currentUrl = "";
let toastTimer = null;

if (isFile) {
  urlInput.value = "";
  setWarning(fileWarning);
} else {
  urlInput.value = new URL("./", location.href).href;
}

form.addEventListener("submit", (event) => event.preventDefault());
urlInput.addEventListener("input", render);
ecSelect.addEventListener("change", render);

render();

/* ------------------------------------------------------------------ */
/*  Построение QR                                                      */
/* ------------------------------------------------------------------ */

function render() {
  const url = urlInput.value.trim();

  if (!url) {
    currentQR = null;
    currentUrl = "";
    preview.innerHTML = '<p class="qr-empty">Введите ссылку на сайт</p>';
    urlLabel.textContent = "";
    $("#print-qr").innerHTML = "";
    $("#print-url").textContent = "";
    setEnabled(false);
    setWarning(fileWarning);
    return;
  }

  try {
    const qr = qrcode(0, ecSelect.value);
    qr.addData(url);
    qr.make();

    currentQR = qr;
    currentUrl = url;

    preview.innerHTML = qr.createSvgTag({
      cellSize: 8,
      margin: 4,
      scalable: true,
    });
    urlLabel.textContent = url;

    // Печатная карточка заполняется заранее, чтобы работал и Ctrl+P.
    $("#print-qr").innerHTML = qr.createSvgTag({
      cellSize: 8,
      margin: 4,
      scalable: true,
    });
    $("#print-url").textContent = url;

    setEnabled(true);
    setWarning(fileWarning);
  } catch (error) {
    console.error("QR error", error);

    currentQR = null;
    currentUrl = "";
    preview.innerHTML = '<p class="qr-empty">Не удалось построить QR</p>';
    urlLabel.textContent = "";
    $("#print-qr").innerHTML = "";
    $("#print-url").textContent = "";

    setEnabled(false);
    setWarning("Ссылка слишком длинная для QR-кода. Сократите URL.");
  }
}

/* ------------------------------------------------------------------ */
/*  Скачивание                                                         */
/* ------------------------------------------------------------------ */

$("#qr-png").addEventListener("click", () => {
  if (!currentQR) return;

  const canvas = makeCanvas(currentQR, Number(sizeSelect.value));
  canvas.toBlob((blob) => {
    if (blob) download(blob, "qr-charite.png");
  }, "image/png");
});

$("#qr-svg").addEventListener("click", () => {
  if (!currentQR) return;

  const svg = currentQR.createSvgTag({
    cellSize: 8,
    margin: 4,
    scalable: true,
  });

  download(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    "qr-charite.svg"
  );
});

$("#qr-print").addEventListener("click", () => {
  if (!currentQR) return;

  $("#print-qr").innerHTML = currentQR.createSvgTag({
    cellSize: 8,
    margin: 4,
    scalable: true,
  });
  $("#print-url").textContent = currentUrl;

  window.print();
});

$("#qr-copy").addEventListener("click", () => {
  if (currentUrl) copyText(currentUrl);
});

/* ------------------------------------------------------------------ */
/*  Утилиты                                                            */
/* ------------------------------------------------------------------ */

function makeCanvas(qr, requestedSize) {
  const count = qr.getModuleCount();
  const margin = 4;
  const total = count + margin * 2;
  const cell = Math.max(1, Math.floor(requestedSize / total));
  const size = cell * total;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  context.fillStyle = "#000000";
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) {
        context.fillRect(
          (column + margin) * cell,
          (row + margin) * cell,
          cell,
          cell
        );
      }
    }
  }

  return canvas;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast("Файл сохранён");
}

function setEnabled(enabled) {
  for (const selector of ["#qr-png", "#qr-svg", "#qr-print", "#qr-copy"]) {
    $(selector).disabled = !enabled;
  }
}

function setWarning(text) {
  warning.textContent = text;
  warning.hidden = !text;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Ссылка скопирована");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
      showToast("Ссылка скопирована");
    } catch {
      showToast("Не удалось скопировать");
    }

    textarea.remove();
  }
}

function showToast(message, duration = 2600) {
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("is-visible"));

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, duration);
}
