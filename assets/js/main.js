/**
 * 主应用脚本
 * ============
 *
 * 职责：
 *   1. 渲染年份；
 *   2. 安全上下文 / 浏览器能力的兼容性体检，结果写到固件卡片；
 *   3. 下载链接探活，避免用户点了之后才发现 404；
 *   4. manifest.json 预校验，提前给出比 vendor 更友好的中文错误；
 *   5. 集中收敛 ESP Web Tools 的事件，必要时弹中文 toast。
 */

(function () {
  "use strict";

  // ----- 工具：轻量 toast -----
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
    return function toast(msg, type = "info", ttl = 3500) {
      const el = document.createElement("div");
      el.textContent = msg;
      Object.assign(el.style, {
        background:
          type === "error"
            ? "rgba(255,80,80,0.92)"
            : type === "warn"
            ? "rgba(255,180,60,0.92)"
            : "rgba(20,20,30,0.92)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "12px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        fontSize: "14px",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        pointerEvents: "auto",
        opacity: "0",
        transform: "translateY(8px)",
        transition: "opacity .25s ease, transform .25s ease",
      });
      ensure().appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
      setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(8px)";
        setTimeout(() => el.remove(), 280);
      }, ttl);
    };
  })();

  // ----- 工具：在 flash 卡片底部追加一条中文提示 -----
  function appendCardHint(text, type = "warn") {
    const card = document.querySelector('[data-card="flash"]');
    if (!card) return;
    if (card.querySelector(`[data-hint="${type}-${text.length}"]`)) return;
    const div = document.createElement("div");
    div.className = "hint warn";
    div.dataset.hint = `${type}-${text.length}`;
    div.style.marginTop = "10px";
    div.textContent = text;
    card.appendChild(div);
  }

  // ----- 1. 年份 -----
  function renderYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  // ----- 2. 兼容性体检 -----
  function diagnose() {
    const isSecure =
      window.isSecureContext ||
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.hostname === "" /* file:// 也走警告分支 */;
    const hasSerial = "serial" in navigator;

    if (location.protocol === "file:") {
      appendCardHint(
        "⚠ 检测到您用 file:// 直接打开本页。浏览器会拒绝调用串口，请使用 http://localhost 或 HTTPS 域名打开。"
      );
      return;
    }
    if (!isSecure) {
      appendCardHint(
        "⚠ 当前不是 HTTPS 环境，浏览器将拒绝调用串口。请使用 HTTPS 域名（或 localhost）访问本页。"
      );
    }
    if (!hasSerial) {
      appendCardHint(
        "⚠ 当前浏览器不支持 Web Serial。请使用桌面端 Chrome / Edge 109 及以上版本访问。"
      );
    }
  }

  // ----- 3. 下载链接探活（HEAD），避免点完才知道 404 -----
  async function probeDownloads() {
    const links = document.querySelectorAll("a[data-asset]");
    for (const a of links) {
      const url = a.getAttribute("href");
      if (!url || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) continue;
      try {
        const r = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!r.ok) markBroken(a, r.status);
      } catch (_e) {
        markBroken(a, "unreachable");
      }
    }
  }
  function markBroken(a, code) {
    a.classList.add("disabled");
    a.title = `资源暂不可用（${code}）`;
    a.style.opacity = "0.55";
    a.style.cursor = "not-allowed";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      toast(`该资源暂未发布或路径错误（${code}），请联系管理员。`, "warn");
    });
  }

  // ----- 4. manifest.json 预校验，比 vendor 报错更友好 -----
  async function probeManifest() {
    const btn = document.querySelector("esp-web-install-button");
    if (!btn) return;
    const url = btn.getAttribute("manifest");
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        appendCardHint(
          `⚠ 固件清单 ${url} 加载失败（HTTP ${r.status}）。请确认固件已上传。`
        );
        return;
      }
      const json = await r.json();
      if (!Array.isArray(json.builds) || json.builds.length === 0) {
        appendCardHint("⚠ 固件清单格式无效：缺少 builds 数组。");
        return;
      }
      // 检查每个 build 的第一个 part 是否能 fetch（HEAD）
      const base = new URL(url, location.href);
      for (const b of json.builds) {
        const part = (b.parts || [])[0];
        if (!part || !part.path) continue;
        const partUrl = new URL(part.path, base);
        try {
          const pr = await fetch(partUrl, { method: "HEAD", cache: "no-store" });
          if (!pr.ok) {
            appendCardHint(
              `⚠ ${b.chipFamily} 固件文件 ${part.path} 暂时不可用（HTTP ${pr.status}）。`
            );
          }
        } catch {
          appendCardHint(
            `⚠ ${b.chipFamily} 固件文件 ${part.path} 无法访问，请检查路径。`
          );
        }
      }
    } catch (e) {
      appendCardHint(`⚠ 固件清单解析失败：${e.message}`);
    }
  }

  // ----- 5. 监听 ESP Web Tools 事件，提供中文 toast -----
  function bindFlashEvents() {
    const btn = document.querySelector("esp-web-install-button");
    if (!btn) return;
    // 这些是 install-dialog 在 dispatch 的事件名
    const map = {
      installed: "✅ 固件烧录完成",
      "installation-error": "❌ 固件烧录失败",
      "installation-aborted": "⚠ 烧录已取消",
    };
    Object.entries(map).forEach(([evt, msg]) => {
      document.addEventListener(evt, () => {
        toast(
          msg,
          evt === "installed" ? "info" : evt === "installation-error" ? "error" : "warn"
        );
      });
    });

    // 防止用户连点：点击后 1 秒内禁用按钮
    const inner = btn.querySelector("#btn-flash");
    if (inner) {
      inner.addEventListener("click", () => {
        inner.disabled = true;
        setTimeout(() => (inner.disabled = false), 1200);
      });
    }
  }

  // ----- 6. 全局错误提示，捕获 vendor 抛出的未处理 Promise 错误 -----
  function bindGlobalError() {
    window.addEventListener("unhandledrejection", (e) => {
      const m = (e.reason && e.reason.message) || String(e.reason || "");
      if (/serial|port|baudRate|requestPort/i.test(m)) {
        toast(`串口操作失败：${m}`, "error", 5000);
      }
    });
  }

  // ----- 启动 -----
  document.addEventListener("DOMContentLoaded", () => {
    renderYear();
    diagnose();
    bindFlashEvents();
    bindGlobalError();
    // 探活和 manifest 校验放后台，不阻塞首屏
    setTimeout(() => {
      probeDownloads();
      probeManifest();
    }, 0);
  });
})();
