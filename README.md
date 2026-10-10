# ⚡ ESP-Web2

ESP-Web2 是一个专为 ESP32 系列芯片打造的独立在线固件烧录与驱动服务中心。项目基于 [ESP Web Tools](https://esphome.github.io/esp-web-tools/) 与浏览器原生 **Web Serial API** 构建，采用纯静态架构，可直接作为独立代码仓库托管至 GitHub Pages 或任何静态 Web 服务器。

---

## ✨ 核心特性

- **纯网页 Web Serial 在线烧录**：无需在本地安装 Python、`esptool` 或 ESP-IDF 开发环境，在现代浏览器中点击即可连接串口并烧录固件。
- **本地化依赖与离线就绪**：页面所需所有 CSS、JavaScript 及 ESP Web Tools 组件（含各种芯片的 stub flasher）均已完整本地化，不依赖第三方 CDN。
- **CH340 串口驱动分发**：内置集成常用 CH340 Windows USB 串口驱动下载及指引，一站式解决设备识别问题。
- **严格固件校验与安全保护**：烧录前自动执行 SHA-256 完整性哈希校验和文件非空检查，杜绝因镜像损坏或占位文件导致设备变砖。
- **双模固件源策略**：支持远程在线固件源（GitHub Releases）与本地内置固件双重回退，断网或远程源不可用时平滑切换。
- **开箱即用 GitHub Pages 自动化部署**：包含完整的 GitHub Actions 持续部署工作流和 `.nojekyll` 配置，推送即上线。

---

## 📁 目录结构

```text
ESP-Web2/
├── .github/
│   └── workflows/
│       └── pages.yml           # GitHub Pages 自动化部署工作流
├── .gitignore                  # Git 忽略文件规则
├── .nojekyll                   # 禁用 GitHub Pages Jekyll 处理
├── README.md                   # 项目中文文档
├── index.html                  # 独立烧录与驱动入口页面
├── assets/
│   ├── css/
│   │   └── style.css           # 页面样式文件
│   ├── esp_web_tool/           # 本地化 ESP Web Tools 运行库及各芯片 Flash Stub
│   │   ├── install-button.js   # Web Component 入口 (<esp-web-install-button>)
│   │   ├── install-dialog-*.js # 烧录引导对话框
│   │   └── ...                 # 针对 ESP32 / S2 / S3 / C2 / C3 / C5 / C6 / H2 / P4 的分发文件
│   └── js/
│       └── main.js             # 运行环境检测、固件校验及逻辑控制
├── downloads/
│   └── CH340/
│       └── CH341SER.EXE        # Windows CH340 USB 串口驱动安装包
└── firmware/
    ├── binaries/               # 固件镜像目录
    │   ├── bootloader_0x1000.bin
    │   ├── partition-table_0x8000.bin
    │   └── micropython_0x10000.bin
    ├── manifest.json           # ESP Web Tools 固件分片与校验清单
    └── source.json             # 固件源配置（远程地址与本地回退）
```

---

## 🚀 本地运行

由于现代浏览器的安全沙箱机制，`file://` 协议下禁止使用 ES Module、`fetch()` API 以及 Web Serial 串口访问，因此**不能**直接双击打开 `index.html`。

请在项目根目录下通过 Python 快速启动本地静态 HTTP 服务器：

```bash
cd /path/to/ESP-Web2
python3 -m http.server 8080
```

启动后，在浏览器中访问：

```text
http://localhost:8080
```

> **提示**：Node.js 环境下也可以使用 `npx serve .` 或 `npx http-server . -p 8080` 启动。

---

## 🔌 Web Serial 运行环境要求

Web Serial API 是浏览器直接与 USB 串口设备通信的关键技术，受浏览器安全策略严格约束：

| 条件项 | 要求说明 |
| --- | --- |
| **网络环境** | 必须在 **HTTPS** 协议安全上下文，或本地开发环境（`http://localhost` / `http://127.0.0.1`）下运行。普通公网 HTTP 会被浏览器强制拦截。 |
| **浏览器支持** | 推荐使用最新版桌面端 **Google Chrome**、**Microsoft Edge** 或 **Opera**（内核版本需 ≥ 89）。<br>❌ *Safari、Firefox 及各类移动端浏览器目前不支持 Web Serial API。* |
| **硬件连接** | 请使用支持数据传输的高质量 USB 数据线连接 ESP32（避免使用仅具备供电功能的充电线）。 |
| **驱动安装** | Windows 10/11 系统如果设备管理器中识别为黄色感叹号或未识别设备，请先下载并安装页面左侧提供的 **CH340 驱动**。 |

---

## 🌐 GitHub Pages 自动化部署

本项目已预置标准 GitHub Actions 持续集成工作流 [`.github/workflows/pages.yml`](file:///.github/workflows/pages.yml)。当项目作为独立 Git 仓库推送到 GitHub 时，可自动构建并托管到 GitHub Pages。

### 部署步骤：

1. **新建 GitHub 仓库**：在 GitHub 上创建一个新的仓库（例如 `ESP-Web2`）。
2. **推送代码**：
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit for ESP-Web2"
   git branch -M main
   git remote add origin https://github.com/<your-username>/ESP-Web2.git
   git push -u origin main
   ```
3. **开启 GitHub Pages**：
   - 进入 GitHub 仓库页面，点击 **Settings** -> **Pages**。
   - 在 **Build and deployment** -> **Source** 下拉菜单中，选择 **GitHub Actions**。
4. **自动上线**：
   - 每当向 `main` 分支执行 `push` 时，GitHub Actions 会自动打包根目录下所有静态文件并完成部署。
   - 部署成功后，访问 `https://<your-username>.github.io/ESP-Web2/` 即可在线使用。

### 为什么包含 `.nojekyll`？
GitHub Pages 默认会启用 Jekyll 静态引擎，Jekyll 会自动忽略以下划线（`_`）或点（`.`）开头的目录与文件，并可能跳过某些特殊命名的打包资源。根目录中的空 `.nojekyll` 文件会明确告知 GitHub Pages 禁用 Jekyll 解析，确保所有本地库、驱动及固件文件原样无损发布。

---

## 🛠️ 固件管理与自定义

### 1. 固件清单格式 (`firmware/manifest.json`)
ESP Web Tools 根据 `manifest.json` 下载各分片并写入对应 Flash 偏移：

```json
{
  "name": "ESP-Web2 ESP32 Firmware",
  "version": "1.0.0",
  "new_install_prompt_erase": true,
  "builds": [
    {
      "chipFamily": "ESP32",
      "parts": [
        {
          "path": "./binaries/bootloader_0x1000.bin",
          "offset": 4096,
          "size": 20832,
          "sha256": "3f37f1c91c08b11fd901d6bd9a4c80950903c1b0e1bf29f4781fc39c690de461"
        },
        {
          "path": "./binaries/partition-table_0x8000.bin",
          "offset": 32768,
          "size": 3072,
          "sha256": "96ff631babb969019e26e344ba0633eac6486ca8feba964f3000eedd02106fd1"
        },
        {
          "path": "./binaries/micropython_0x10000.bin",
          "offset": 65536,
          "size": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        }
      ]
    }
  ]
}
```

- `offset`：Flash 烧录地址十进制字节表示（`4096` = `0x1000`，`32768` = `0x8000`，`65536` = `0x10000`）。
- `path`：分片相对 `manifest.json` 的相对路径。
- `size`：分片文件字节大小。
- `sha256`：分片文件的 SHA-256 哈希值。

### 2. 固件源解析规则 (`firmware/source.json`)
```json
{
  "remoteManifest": "https://github.com/<owner>/<repo>/releases/latest/download/firmware-manifest.json",
  "localManifest": "./firmware/manifest.json"
}
```
- 网页打开时，优先请求并校验 `remoteManifest`，若成功则使用线上最新发布固件。
- 若网络超时、404 或未配置 `remoteManifest`，会自动平滑回退至 `localManifest`（本地内置固件）。

### 3. 如何更新或替换固件
1. 将编译生成的 `.bin` 固件复制到 `firmware/binaries/` 下。
2. 计算文件的准确字节大小和 SHA-256：
   ```bash
   ls -l firmware/binaries/your_app.bin
   sha256sum firmware/binaries/your_app.bin
   ```
3. 更新 `firmware/manifest.json` 中对应的 `path`、`offset`、`size` 和 `sha256`。
4. 刷新网页即可开始烧录。

---

## ❓ 常见问题排查

1. **点击“更新”时提示串口授权弹窗但找不到设备？**
   - 检查 USB 数据线是否接触良好。
   - 确认是否已安装 CH340 / CP2102 串口驱动。
   - 关闭其他正在占用该串口的程序（如 Arduino IDE 串口监视器、PuTTY 等）。
2. **提示“当前浏览器不支持 Web Serial”？**
   - 请使用桌面版 Chrome 或 Edge 浏览器打开页面。
3. **提示“页面必须在 HTTPS 环境或 localhost 下打开”？**
   - 确认访问 URL 是否为 `https://...` 或 `http://localhost:...`。在局域网 IP（如 `http://192.168.x.x`）下，浏览器会因非安全上下文而禁止调用串口。
