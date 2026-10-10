# ⚡ ESP-Web2 - ESP32 固件在线烧录与驱动中心

ESP-Web2 是一个专为 ESP32 系列芯片打造的纯静态在线固件烧录与配套驱动服务中心。项目基于 [ESP Web Tools](https://esphome.github.io/esp-web-tools/) 与浏览器原生 **Web Serial API** 构建，无需在本地配置 Python、`esptool` 或庞大的交叉编译工具链，用户使用现代桌面端浏览器即可一站式完成串口识别、驱动下载与固件快速烧录。

---

## ✨ 核心特性

- **🌌 沉浸式极光拟态 UI (Glassmorphism)**：采用深色星空渐变、动态色彩光球与通透毛玻璃卡片设计，交互优雅直观。
- **⚡ 浏览器原生 Web Serial 直连**：免安装本地烧录工具，通过浏览器标准串口 API 实现与 ESP32 硬件的高速通信。
- **🐍 官方 MicroPython v1.27.0 固件**：内置经过完整验证的官方 ESP32 MicroPython 稳定版固件（包含完整镜像及标准分片）。
- **🧩 图形化编程平台直达**：直连 OpenBlock Web 在线图形化编程环境，免安装即开即用。
- **📦 离线化本地依赖**：样式文件、交互脚本及 ESP Web Tools 多芯片 Flash Stub 均已完整离线部署，不依赖外部 CDN。
- **🛠️ 驱动与工具一站式服务**：内置 CH340 串口芯片驱动下载，提供新手友好的步骤式操作引导与状态反馈。
- **🚀 GitHub Pages 自动化上线**：内置 GitHub Actions 持续集成与部署工作流及 `.nojekyll` 配置，支持零配置托管上线。

---

## 🔌 浏览器与运行环境要求

Web Serial API 是浏览器直接与 USB 串口设备通信的关键底层能力，受浏览器安全模型严格约束：

| 维度 | 要求说明 |
| --- | --- |
| **安全上下文** | 必须在 **HTTPS 协议**或本地开发环境（`http://localhost` / `http://127.0.0.1`）下运行。普通 HTTP 协议会被浏览器强制禁止访问串口。 |
| **推荐浏览器** | 推荐使用桌面端 **Google Chrome** 或 **Microsoft Edge**（版本 89 及以上，推荐 109+）。<br>⚠️ *Safari、Firefox 及移动端浏览器目前尚未原生支持 Web Serial API。* |
| **硬件连接** | 请使用具备数据传输能力的优质 USB 数据线连接 ESP32 开发板（避免仅有供电功能的充电线）。 |
| **设备驱动** | 若 Windows 设备管理器显示黄色感叹号或无法识别端口，请先下载并安装页面提供的 **CH340 驱动**。 |

---

## 🚀 快速上手 / 本地运行

由于浏览器的安全策略，`file://` 协议下禁止使用 ES Module、Fetch 请求以及 Web Serial 串口访问，请通过本地 HTTP 服务器运行：

### 使用 Python 快速启动

```bash
cd /path/to/ESP-Web2
python3 -m http.server 8080
```

### 使用 Node.js 快速启动

```bash
npx serve .
# 或使用 http-server
npx http-server . -p 8080
```

启动完成后，使用 Chrome 或 Edge 打开：

```text
http://localhost:8080
```

---

## 📁 目录结构

```text
ESP-Web2/
├── .github/
│   └── workflows/
│       └── pages.yml           # GitHub Pages 自动化部署工作流
├── .gitignore                  # Git 忽略文件配置
├── .nojekyll                   # 禁用 Jekyll 静态处理
├── LICENSE                     # 开源许可协议
├── README.md                   # 项目使用与配置说明文档
├── index.html                  # 核心入口页面
├── assets/
│   ├── css/
│   │   └── style.css           # 极光夜空毛玻璃样式表
│   ├── esp_web_tool/           # 本地化 ESP Web Tools 运行库及多芯片 Flasher Stub
│   │   ├── install-button.js   # Web Component 入口 (<esp-web-install-button>)
│   │   ├── install-dialog-*.js # 烧录引导对话框组件
│   │   └── ...                 # ESP32 / S2 / S3 / C2 / C3 / C5 / C6 / H2 / P4 运行支持库
│   └── js/
│       └── main.js             # 运行环境自检、下载探活及交互控制
├── downloads/
│   └── CH340/
│       └── CH341SER.EXE        # Windows CH340 USB 串口驱动安装包
└── firmware/
    ├── binaries/               # 固件镜像目录
    │   ├── bootloader_0x1000.bin        # 引导程序 (0x1000)
    │   ├── partition-table_0x8000.bin   # 分区表 (0x8000)
    │   ├── micropython_0x10000.bin      # MicroPython 应用程序 (0x10000)
    │   └── ESP32_GENERIC-v1.27.0.bin    # MicroPython 官方完整镜像
    └── manifest.json           # ESP Web Tools 固件分片与配置清单
```

---

## 🛠️ 固件配置与自定义

### 1. 固件清单规范 (`firmware/manifest.json`)

ESP Web Tools 根据 `manifest.json` 解析芯片型号、烧录偏移量并下载对应分片：

```json
{
  "name": "ESP32 MicroPython 固件",
  "version": "1.27.0",
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
          "size": 1698016,
          "sha256": "fdb2434e468fd50108c46e1e45424df9f44e864fc14979122cdc51d7e049b1f0"
        }
      ]
    }
  ]
}
```

- **`chipFamily`**：目标芯片架构，如 `ESP32`、`ESP32-S3`、`ESP32-C3` 等。
- **`offset`**：Flash 写入起始地址（十进制字节表示，`4096` = `0x1000`，`32768` = `0x8000`，`65536` = `0x10000`）。
- **`path`**：固件二进制相对于 `manifest.json` 的访问路径。
- **`new_install_prompt_erase`**：全新安装时是否提示擦除整个 Flash（推荐 `true`）。

### 2. 替换为自定义固件

1. 将编译生成的 `.bin` 固件放入 `firmware/binaries/` 目录。
2. 计算文件的字节大小与校验值：
   ```bash
   ls -l firmware/binaries/your_firmware.bin
   sha256sum firmware/binaries/your_firmware.bin
   ```
3. 更新 `firmware/manifest.json` 中的 `path`、`offset` 及元数据。
4. 重新加载页面即可开始烧录。

---

## 🌐 GitHub Pages 托管部署

1. 将仓库推送到 GitHub：
   ```bash
   git push origin main
   ```
2. 进入 GitHub 仓库设置：**Settings** ➔ **Pages**。
3. 在 **Build and deployment** ➔ **Source** 中选择 **GitHub Actions**。
4. 部署完成后，通过生成的 GitHub Pages 域名（自带 HTTPS）即可在线使用。

---

## ❓ 常见问题排查

1. **点击“开始在线更新”弹出选择框，但列表中找不到 ESP32 串口？**
   - 检查 USB 线是否支持数据传输，尝试更换电脑 USB 接口（推荐插在机箱后置 USB 口）。
   - 检查是否正确安装了 CH340 驱动；Windows 可打开“设备管理器”查看“端口 (COM 和 LPT)”是否有识别到对应设备。
   - 确保没有其他串口调试软件（如 Arduino 串口监视器、Thonny、Putty 等）正在占用该串口。
2. **连接时提示等待握手或连接超时？**
   - 部分 ESP32 开发板下载电路没有自动复位功能，请在点击连接/烧录并在控制台显示连接中时，按住板载的 `BOOT`（或 `IO0`）按键 1~2 秒，待进入下载模式后再松开。
3. **提示“页面必须在 HTTPS 环境（或 localhost）下打开”？**
   - 现代浏览器严格限制 Web Serial 仅在安全上下文生效。请确保通过 `https://` 域名访问，或在本地使用 `http://localhost` 访问。
