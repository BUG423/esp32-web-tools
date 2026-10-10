/** OpenBlock ESP32 firmware updater: Web Serial in browsers, native Rust serial in Tauri. */
(function () {
  "use strict";

  const DEFAULT_SOURCE = {
    remoteManifest: "https://github.com/BUG423/OpenBlock-ESP32/releases/latest/download/firmware-manifest.json",
    localManifest: "./firmware/manifest.json",
  };

  const toast = (() => {
    let host = null;
    function ensure() {
      if (host) return host;
      host = document.createElement("div");
      host.id = "toast-host";
      Object.assign(host.style, {
        position: "fixed",
        zIndex: "10000",
        left: "50%",
        bottom: "32px",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
      });
      document.body.appendChild(host);
      return host;
    }
    return function showToast(message, type = "info", ttl = 4200) {
      const el = document.createElement("div");
      el.textContent = message;
      Object.assign(el.style, {
        background: type === "error" ? "#d0443b" : type === "warn" ? "#a56b00" : "#3d4761",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "8px",
        boxShadow: "0 10px 30px rgba(0,0,0,.24)",
        fontSize: "12px",
        pointerEvents: "auto",
        opacity: "0",
        transform: "translateY(8px)",
        transition: "opacity .2s ease, transform .2s ease",
      });
      ensure().appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
      setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(8px)";
        setTimeout(() => el.remove(), 220);
      }, ttl);
    };
  })();

  function appendCardHint(text, key = "environment") {
    const card = document.querySelector('[data-card="flash"]');
    if (!card || card.querySelector(`[data-hint="${key}"]`)) return;
    const hint = document.createElement("div");
    hint.className = "hint warn";
    hint.dataset.hint = key;
    hint.textContent = text;
    card.appendChild(hint);
  }

  function removeCardHint(key) {
    document.querySelector(`[data-hint="${key}"]`)?.remove();
  }

  function setWebAvailability(available, message) {
    const button = document.getElementById("btn-flash");
    if (!button) return;
    button.disabled = !available;
    button.dataset.firmwareReady = available ? "true" : "false";
    const label = button.querySelector("span");
    if (label) label.textContent = available ? "开始更新系统固件" : "固件暂不可用";
    removeCardHint("firmware");
    if (!available && message) appendCardHint(message, "firmware");
  }

  function findTauriInvoke() {
    const scopes = [window];
    try {
      if (window.parent !== window) scopes.push(window.parent);
      if (window.top && window.top !== window.parent) scopes.push(window.top);
    } catch (_error) {
      // Cross-origin parents are irrelevant; the bundled desktop frames are same-origin.
    }
    for (const scope of scopes) {
      try {
        const bridgeInvoke = scope.__OPENBLOCK_TAURI__?.invoke;
        if (typeof bridgeInvoke === "function") {
          return bridgeInvoke.bind(scope.__OPENBLOCK_TAURI__);
        }
        const invoke = scope.__TAURI__?.core?.invoke;
        if (typeof invoke === "function") return invoke.bind(scope.__TAURI__.core);
      } catch (_error) {
        // Continue looking in the next same-origin frame.
      }
    }
    return null;
  }

  async function loadSourceConfig() {
    try {
      const response = await fetch("./firmware/source.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { ...DEFAULT_SOURCE, ...(await response.json()) };
    } catch (_error) {
      return DEFAULT_SOURCE;
    }
  }

  function renderYear() {
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  }

  async function probeDownloads() {
    for (const link of document.querySelectorAll("a[data-asset]")) {
      const url = link.getAttribute("href");
      if (!url || url.startsWith("http")) continue;
      try {
        const response = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!response.ok) markBroken(link, response.status);
      } catch (_error) {
        markBroken(link, "unreachable");
      }
    }
  }

  function markBroken(link, code) {
    link.classList.add("disabled");
    link.title = `资源暂不可用（${code}）`;
    link.style.opacity = "0.55";
    link.style.cursor = "not-allowed";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      toast(`该资源暂未发布或路径错误（${code}）。`, "warn");
    });
  }

  function hexDigest(bytes) {
    return [...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function validateManifest(url) {
    if (!window.crypto?.subtle) throw new Error("当前环境无法执行 SHA-256 固件校验");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`固件清单请求失败（HTTP ${response.status}）`);
    const manifest = await response.json();
    if (!Array.isArray(manifest.builds) || manifest.builds.length === 0) {
      throw new Error("固件清单缺少 builds 数组");
    }
    const base = new URL(url, location.href);
    let count = 0;
    for (const build of manifest.builds) {
      for (const part of build.parts || []) {
        if (!part?.path) continue;
        if (!/^[a-f\d]{64}$/i.test(part.sha256 || "")) {
          throw new Error(`${part.path} 缺少有效 SHA-256`);
        }
        const partUrl = new URL(part.path, base);
        const partResponse = await fetch(partUrl, { cache: "no-store" });
        if (!partResponse.ok) throw new Error(`${part.path} 请求失败（HTTP ${partResponse.status}）`);
        const bytes = await partResponse.arrayBuffer();
        const size = bytes.byteLength;
        if (size <= 0) throw new Error(`${part.path} 是空文件`);
        if (part.size != null && Number(part.size) !== size) {
          throw new Error(`${part.path} 的大小与清单不一致`);
        }
        const actual = hexDigest(await window.crypto.subtle.digest("SHA-256", bytes));
        if (actual.toLowerCase() !== part.sha256.toLowerCase()) {
          throw new Error(`${part.path} 的 SHA-256 与清单不一致`);
        }
        count += 1;
      }
    }
    if (!count) throw new Error("固件清单中没有可烧录分片");
    return manifest;
  }

  async function configureBrowser(source) {
    document.getElementById("flash-runtime").textContent = "浏览器 Web Serial";
    document.getElementById("flash-source").textContent = "在线优先 / 本地回退";
    const webFlasher = document.getElementById("web-flasher");
    const secure = window.isSecureContext || ["localhost", "127.0.0.1"].includes(location.hostname);
    if (!secure) appendCardHint("当前页面不是 HTTPS，浏览器会拒绝串口权限。", "secure");
    if (!("serial" in navigator)) {
      appendCardHint("当前浏览器不支持 Web Serial。网页端请使用桌面版 Chrome / Edge；OpenBlock 软件端会自动改用原生串口。", "serial");
    }

    let selected = source.remoteManifest;
    if (selected) {
      try {
        await validateManifest(selected);
        document.getElementById("flash-source").textContent = "在线最新固件";
      } catch (remoteError) {
        selected = source.localManifest;
        try {
          await validateManifest(selected);
          document.getElementById("flash-source").textContent = "本地固件（远程暂不可用）";
        } catch (localError) {
          setWebAvailability(false, `固件尚未发布完整：${localError.message}。远程源：${remoteError.message}。`);
          return;
        }
      }
    } else {
      selected = source.localManifest;
      try {
        await validateManifest(selected);
        document.getElementById("flash-source").textContent = "本地固件";
      } catch (localError) {
        setWebAvailability(false, `固件尚未就绪：${localError.message}。`);
        return;
      }
    }
    webFlasher.setAttribute("manifest", selected);
    setWebAvailability(secure && "serial" in navigator);
  }

  function setNativeStatus(message, type = "") {
    const status = document.getElementById("native-status");
    status.textContent = message;
    status.className = `hint${type ? ` ${type}` : ""}`;
  }

  async function configureNative(invoke, source) {
    const webFlasher = document.getElementById("web-flasher");
    const nativeFlasher = document.getElementById("native-flasher");
    const portSelect = document.getElementById("native-port");
    const flashButton = document.getElementById("btn-native-flash");
    const refreshButton = document.getElementById("refresh-ports");
    webFlasher.hidden = true;
    nativeFlasher.hidden = false;
    document.getElementById("flash-description").textContent = "软件端直接访问系统串口，在线下载、校验并烧录最新 ESP32 固件";
    document.getElementById("flash-runtime").textContent = "软件原生串口";
    document.getElementById("flash-source").textContent = "远程发布 / 校验缓存 / 软件内置";
    document.getElementById("environment-tip").textContent = "软件端无需 Web Serial；若创作页已连接设备，请先断开再更新";

    async function refreshPorts() {
      refreshButton.disabled = true;
      flashButton.disabled = true;
      portSelect.replaceChildren();
      setNativeStatus("正在读取系统串口…");
      try {
        const ports = await invoke("list_firmware_ports");
        for (const port of ports) {
          const option = document.createElement("option");
          option.value = port.path;
          option.textContent = port.label;
          portSelect.appendChild(option);
        }
        if (ports.length) {
          flashButton.disabled = false;
          setNativeStatus(`已发现 ${ports.length} 个串口。优先选择带 USB 设备名称的端口。`);
        } else {
          setNativeStatus("未发现串口。请连接 ESP32，并确认驱动已安装。", "warn");
        }
      } catch (error) {
        setNativeStatus(String(error), "error");
      } finally {
        refreshButton.disabled = false;
      }
    }

    refreshButton.addEventListener("click", refreshPorts);
    flashButton.addEventListener("click", async () => {
      if (!portSelect.value || !source.remoteManifest) return;
      if (!window.confirm("即将更新 ESP32 系统固件。请确认已保存项目，并且烧录过程中不会拔出数据线。")) return;
      flashButton.disabled = true;
      refreshButton.disabled = true;
      portSelect.disabled = true;
      const label = flashButton.querySelector("span");
      label.textContent = "正在下载、校验并烧录…";
      setNativeStatus("正在获取远程固件；网络不可用时会尝试上次通过校验的缓存。设备可能自动重启数次。", "warn");
      try {
        const result = await invoke("flash_esp32_firmware", {
          port: portSelect.value,
          manifestUrl: source.remoteManifest,
        });
        const sourceLabel = {
          cache: "本地校验缓存",
          bundled: "软件内置固件",
          online: "在线源",
        }[result.source] || result.source;
        setNativeStatus(`更新完成：${result.version}，写入 ${Math.round(result.bytesWritten / 1024)} KiB（${sourceLabel}）。`, "success");
        toast("ESP32 系统固件更新完成");
      } catch (error) {
        const message = String(error);
        setNativeStatus(message, "error");
        toast("固件更新失败，请查看卡片中的详细提示。", "error", 6000);
      } finally {
        label.textContent = "下载并烧录最新固件";
        flashButton.disabled = !portSelect.value;
        refreshButton.disabled = false;
        portSelect.disabled = false;
      }
    });
    await refreshPorts();
  }

  function bindWebEvents() {
    const button = document.getElementById("btn-flash");
    const messages = {
      installed: "固件烧录完成",
      "installation-error": "固件烧录失败",
      "installation-aborted": "烧录已取消",
    };
    for (const [eventName, message] of Object.entries(messages)) {
      document.addEventListener(eventName, () => {
        toast(message, eventName === "installation-error" ? "error" : eventName === "installation-aborted" ? "warn" : "info");
      });
    }
    button?.addEventListener("click", (event) => {
      if (button.dataset.firmwareReady !== "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast("固件镜像尚未发布完整，当前禁止烧录。", "warn");
      }
    });
  }

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason?.message || String(event.reason || "");
    if (/serial|port|baudRate|requestPort/i.test(message)) {
      toast(`串口操作失败：${message}`, "error", 6000);
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    renderYear();
    bindWebEvents();
    probeDownloads();
    const source = await loadSourceConfig();
    const invoke = findTauriInvoke();
    if (invoke) {
      await configureNative(invoke, source);
    } else {
      await configureBrowser(source);
    }
  });
})();
