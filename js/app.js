import { config } from "./config.js";

const $ = (selector, root = document) => root.querySelector(selector);

const viewer = $("#viewer");
const loader = $("#loader");
const loaderBar = $("#loader-bar");
const loaderMeta = $("#loader-meta");
const fatal = $("#fatal");
const panel = $("#card");
const overlay = $("#overlay");
const toast = $("#toast");
const hint = $("#hint");
const arButton = $(".ar-button");

let lastTrigger = null;
let toastTimer = null;

/* ------------------------------------------------------------------ */
/*  Сцена                                                              */
/* ------------------------------------------------------------------ */

viewer.setAttribute("src", config.scene.glb);
viewer.setAttribute("ios-src", config.scene.usdz);
viewer.setAttribute("camera-orbit", config.scene.cameraOrbit);
viewer.setAttribute("camera-target", config.scene.cameraTarget);
viewer.setAttribute("min-camera-orbit", config.scene.minCameraOrbit);
viewer.setAttribute("max-camera-orbit", config.scene.maxCameraOrbit);

loaderMeta.textContent = `Загрузка сцены · ${config.scene.sizeLabel}`;

/* ------------------------------------------------------------------ */
/*  Метки                                                              */
/* ------------------------------------------------------------------ */

const hotspotEls = new Map();

for (const hotspot of config.hotspots) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hotspot";
  button.slot = `hotspot-${hotspot.id}`;
  button.dataset.position = hotspot.position;
  button.dataset.normal = hotspot.normal;
  button.dataset.visibilityAttribute = "visible";
  button.setAttribute("aria-label", hotspot.label);
  button.innerHTML = `<svg aria-hidden="true"><use href="#i-${hotspot.icon}"></use></svg>`;
  button.addEventListener("click", () => openPanel(hotspot, button));
  viewer.append(button);
  hotspotEls.set(hotspot.id, button);
}

/* ------------------------------------------------------------------ */
/*  Карточка                                                           */
/* ------------------------------------------------------------------ */

function openPanel(data, trigger = null) {
  lastTrigger = trigger;

  $("#card-eyebrow").textContent = data.eyebrow || "";
  $("#card-title").textContent = data.title || "";
  $("#card-text").textContent = data.text || "";

  const specs = $("#card-specs");
  specs.replaceChildren();
  for (const [term, value] of data.specs || []) {
    const row = document.createElement("div");
    row.className = "spec";
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    row.append(dt, dd);
    specs.append(row);
  }

  panel.hidden = false;
  overlay.hidden = false;
  requestAnimationFrame(() => document.body.classList.add("card-open"));
  window.setTimeout(() => $("#card-close").focus({ preventScroll: true }), 240);
}

function closePanel() {
  if (!document.body.classList.contains("card-open")) return;

  document.body.classList.remove("card-open");
  window.setTimeout(() => {
    panel.hidden = true;
    overlay.hidden = true;
    if (lastTrigger) lastTrigger.focus({ preventScroll: true });
    lastTrigger = null;
  }, 240);
}

$("#card-close").addEventListener("click", closePanel);
overlay.addEventListener("click", closePanel);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("card-open")) {
    event.preventDefault();
    closePanel();
  }
});

$("#help-btn").addEventListener("click", (event) => {
  openPanel(config.help, event.currentTarget);
});

/* ------------------------------------------------------------------ */
/*  Сброс вида                                                         */
/* ------------------------------------------------------------------ */

$("#reset-btn").addEventListener("click", () => {
  viewer.setAttribute("camera-target", config.scene.cameraTarget);
  viewer.setAttribute("camera-orbit", config.scene.cameraOrbit);
  if (typeof viewer.jumpCameraToGoal === "function") viewer.jumpCameraToGoal();
  closePanel();
  showToast("Вид сброшен");
});

/* ------------------------------------------------------------------ */
/*  Загрузка / ошибка                                                  */
/* ------------------------------------------------------------------ */

viewer.addEventListener("progress", (event) => {
  const progress = Number(event.detail?.totalProgress || 0);
  loaderBar.style.width = `${Math.max(4, Math.min(100, progress * 100))}%`;
});

viewer.addEventListener("load", () => {
  loaderBar.style.width = "100%";
  window.setTimeout(() => {
    loader.classList.add("is-done");
    window.setTimeout(() => {
      loader.hidden = true;
    }, 500);
  }, 300);

  syncArButton();
  console.info(
    "Модель загружена. Габариты:",
    viewer.getDimensions(),
    "центр:",
    viewer.getBoundingBoxCenter()
  );
});

viewer.addEventListener("error", (event) => {
  console.error("Не удалось загрузить модель", event);
  const detail = event.detail?.type || event.detail?.message || "";
  $("#fatal-detail").textContent = detail ? `Код ошибки: ${detail}` : "";
  loader.hidden = true;
  fatal.hidden = false;
});

$("#fatal-retry").addEventListener("click", () => location.reload());

/* ------------------------------------------------------------------ */
/*  Подсказка                                                          */
/* ------------------------------------------------------------------ */

const dismissHint = (persist) => {
  hint.classList.add("is-hidden");
  if (persist) {
    try {
      sessionStorage.setItem("hint-hidden", "1");
    } catch {
      /* приватный режим */
    }
  }
};

try {
  if (sessionStorage.getItem("hint-hidden") === "1") hint.classList.add("is-hidden");
} catch {
  /* приватный режим */
}

for (const eventName of ["pointerdown", "wheel", "touchstart"]) {
  viewer.addEventListener(eventName, () => dismissHint(true), {
    once: true,
    passive: true,
  });
}

window.setTimeout(() => dismissHint(false), 9000);

/* ------------------------------------------------------------------ */
/*  AR                                                                 */
/* ------------------------------------------------------------------ */

function syncArButton() {
  if (!arButton) return;
  // model-viewer выставляет canActivateAR после загрузки модели.
  if (typeof viewer.canActivateAR === "boolean") {
    arButton.hidden = !viewer.canActivateAR;
  }
}

viewer.addEventListener("ar-status", (event) => {
  const status = event.detail?.status;
  if (status === "session-started") {
    showToast("Сцена большая — уменьшите макет щипком", 7000);
  } else if (status === "object-placed") {
    showToast("Макет установлен", 2400);
  } else if (status === "failed") {
    showToast("AR недоступен на этом устройстве", 5000);
  }
  syncArButton();
});

/* ------------------------------------------------------------------ */
/*  Тост                                                               */
/* ------------------------------------------------------------------ */

function showToast(message, duration = 2800) {
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

/* ------------------------------------------------------------------ */
/*  Debug-панель (?debug=1)                                            */
/* ------------------------------------------------------------------ */

if (new URLSearchParams(location.search).has("debug")) {
  initDebug();
}

function initDebug() {
  const root = $("#debug");
  root.hidden = false;

  const select = $("#debug-select");
  const out = $("#debug-out");
  const ids = ["x", "y", "z", "nx", "ny", "nz"];
  const inputs = Object.fromEntries(ids.map((id) => [id, $(`#debug-${id}`)]));
  const outputs = Object.fromEntries(
    ids.map((id) => [id, $(`#debug-${id}-val`)])
  );

  const state = new Map();
  for (const hotspot of config.hotspots) {
    state.set(hotspot.id, {
      position: parseVec(hotspot.position),
      normal: parseVec(hotspot.normal),
    });
    const option = document.createElement("option");
    option.value = hotspot.id;
    option.textContent = hotspot.label;
    select.append(option);
  }

  let active = config.hotspots[0]?.id;

  const updateBounds = () => {
    try {
      const center = viewer.getBoundingBoxCenter();
      const size = viewer.getDimensions();
      if (!center || !size) return;

      const ranges = {
        x: [center.x - size.x / 2, center.x + size.x / 2],
        y: [center.y - size.y / 2, center.y + size.y / 2],
        z: [center.z - size.z / 2, center.z + size.z / 2],
      };

      for (const axis of ["x", "y", "z"]) {
        inputs[axis].min = ranges[axis][0].toFixed(2);
        inputs[axis].max = ranges[axis][1].toFixed(2);
      }
    } catch {
      /* модель ещё не загрузилась */
    }
  };

  viewer.addEventListener("load", updateBounds);
  if (viewer.loaded) updateBounds();

  const syncInputs = () => {
    const current = state.get(active);
    if (!current) return;

    inputs.x.value = current.position[0];
    inputs.y.value = current.position[1];
    inputs.z.value = current.position[2];
    inputs.nx.value = current.normal[0];
    inputs.ny.value = current.normal[1];
    inputs.nz.value = current.normal[2];

    outputs.x.textContent = `${current.position[0].toFixed(2)} м`;
    outputs.y.textContent = `${current.position[1].toFixed(2)} м`;
    outputs.z.textContent = `${current.position[2].toFixed(2)} м`;
    outputs.nx.textContent = current.normal[0].toFixed(2);
    outputs.ny.textContent = current.normal[1].toFixed(2);
    outputs.nz.textContent = current.normal[2].toFixed(2);
  };

  const apply = () => {
    const current = state.get(active);
    if (!current) return;

    current.position = [
      Number(inputs.x.value),
      Number(inputs.y.value),
      Number(inputs.z.value),
    ];
    current.normal = [
      Number(inputs.nx.value),
      Number(inputs.ny.value),
      Number(inputs.nz.value),
    ];

    const element = hotspotEls.get(active);
    if (element) {
      element.dataset.position = formatVec(current.position, true);
      element.dataset.normal = formatVec(current.normal, false);
    }

    syncInputs();
  };

  for (const id of ids) inputs[id].addEventListener("input", apply);

  select.addEventListener("change", () => {
    active = select.value;
    syncInputs();
  });

  $("#debug-copy").addEventListener("click", () => {
    const result = config.hotspots.map((hotspot) => {
      const current = state.get(hotspot.id);
      return {
        ...hotspot,
        position: formatVec(current.position, true),
        normal: formatVec(current.normal, false),
      };
    });

    const text = JSON.stringify(result, null, 2);
    out.textContent = text;
    copyText(text);
  });

  $("#debug-camera").addEventListener("click", () => {
    const orbit = viewer.getCameraOrbit();
    const target = viewer.getCameraTarget();
    const text =
      `cameraOrbit: "${radToDeg(orbit.theta)}deg ${radToDeg(orbit.phi)}deg ${orbit.radius.toFixed(2)}m",\n` +
      `cameraTarget: "${target.x.toFixed(2)}m ${target.y.toFixed(2)}m ${target.z.toFixed(2)}m",`;

    out.textContent = text;
    copyText(text);
  });

  $("#debug-reset").addEventListener("click", () => {
    for (const hotspot of config.hotspots) {
      state.set(hotspot.id, {
        position: parseVec(hotspot.position),
        normal: parseVec(hotspot.normal),
      });
    }

    const current = state.get(active);
    const element = hotspotEls.get(active);
    if (current && element) {
      element.dataset.position = formatVec(current.position, true);
      element.dataset.normal = formatVec(current.normal, false);
    }

    syncInputs();
    showToast("Метки сброшены");
  });

  $("#debug-close").addEventListener("click", () => {
    root.hidden = true;
  });

  syncInputs();
}

/* ------------------------------------------------------------------ */
/*  Утилиты                                                            */
/* ------------------------------------------------------------------ */

function parseVec(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part));
}

function formatVec(values, withMeters) {
  return values
    .map((value) => `${value.toFixed(2)}${withMeters ? "m" : ""}`)
    .join(" ");
}

function radToDeg(radians) {
  return Math.round((radians * 180) / Math.PI);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Скопировано в буфер");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
      showToast("Скопировано в буфер");
    } catch {
      showToast("Не удалось скопировать");
    }

    textarea.remove();
  }
}
