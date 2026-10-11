# OneAIAssist: Enterprise Server Deployment & Self-Hosted LLM Architecture Guide

This document is the official, comprehensive technical reference for the deployment of **OneAIAssist** and its self-hosted local AI model (**oneai-qwen**) on a **Hetzner Cloud VPS**. It details server specifications, model selection rationale, API integration architecture, technology stack, challenges encountered, solutions applied, and the automated GitHub Actions CI/CD pipeline.

---

## 1. Server Specifications & Access Details

### 1.1 Infrastructure Specs
- **Cloud Provider**: Hetzner Cloud (Datacenter: Falkenstein / Nuremberg, Germany)
- **Server Name**: `OneAI-Pattacare` (ID: `#169621572`)
- **Plan / Model**: CX22 / CX23 Class
- **CPU**: 2 Dedicated/Shared vCPUs (x86_64 AMD/Intel architecture with AVX2 instruction set)
- **RAM**: 4.0 GB DDR4 ECC RAM
- **Storage**: 40 GB NVMe SSD (Local Storage with high IOPS)
- **Network Bandwidth**: 20 TB/month (1 Gbps symmetric link)
- **Operating System**: Ubuntu 24.04 / 26.04 LTS (Linux Kernel 6.8+)

### 1.2 Network & Credentials
- **Public IPv4**: `167.233.103.156`
- **IPv6 Subnet**: `2a01:4f8:c013:83b::/64`
- **Default SSH User**: `root`
- **SSH Authentication**: ED25519 Cryptographic Key Pair (`~/.ssh/id_ed25519`)
- **Initial Console Password**: `Pattacare@OneAI2026!#` *(Configured on initial boot)*
- **Live Application URL**: [http://167.233.103.156](http://167.233.103.156)
- **Dashboard Settings**: [http://167.233.103.156/dashboard/settings?tab=developer](http://167.233.103.156/dashboard/settings?tab=developer)

### 1.3 Active Ports & Services
| Port | Protocol | Scope | Service | Description |
| :--- | :--- | :--- | :--- | :--- |
| **22** | TCP | Public | OpenSSH Server | Key-based administrative access |
| **80** | TCP | Public | Nginx Web Server | HTTP reverse proxy & WebSocket gateway |
| **3000** | TCP | `127.0.0.1` | Docker (`oneai-app`) | Next.js 14 + Express + Socket.IO Unified Server |
| **11434**| TCP | `oneai-net` | Docker (`oneai-ollama`)| Ollama Local Inference API (Isolated from public internet) |

---

## 2. LLM Selection Rationale & Capabilities

### 2.1 The Selected Model
- **Model Name**: **Qwen 2.5 1.5B Instruct** (`qwen2.5:1.5b`)
- **Custom Alias Built**: `oneai-qwen` (with tailored system prompts and 4096 context window)
- **Quantization Level**: `Q4_K_M` (4-bit Medium Quantization via GGUF format)
- **Model Size on Disk**: **986 MB** (under 1 GB)
- **Runtime RAM Consumption**: **~1.1 GB RAM** when fully resident in memory

### 2.2 Why We Chose Qwen 2.5 1.5B for this Server

When running both a full-stack web application (Node.js/Next.js/Socket.io/PostgreSQL pool) AND a local language model on a **4.0 GB RAM server**, selecting the right model is critical.

| Model Candidate | Parameter Size | RAM Required | Feasibility on 4 GB VPS | Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **Llama 3.1 8B** | 8 Billion | ~5.2 GB | ❌ Impossible | Causes instant Out-Of-Memory kernel crash |
| **Mistral 7B** | 7 Billion | ~4.8 GB | ❌ Impossible | Exceeds available RAM |
| **Phi-3 Mini (3.8B)** | 3.8 Billion | ~2.6 GB | ⚠️ Risky | Leaves only ~600 MB for Node.js, high swap thrashing |
| **Qwen 2.5 1.5B** | **1.5 Billion** | **~1.1 GB** | 🟢 **Optimal** | **Leaves 2.0+ GB free for Node.js and system services** |

### 2.3 Core Strengths of Qwen 2.5 1.5B
1. **State-of-the-Art Reasoning for Small Models**: Developed by Alibaba Cloud, Qwen 2.5 outperforms older 7B models (such as Llama 2 7B) on benchmarks like MMLU, GSM8K, and HumanEval despite being a fraction of the size.
2. **Native Tool Calling & JSON Structured Output**: Can extract structured parameters (Age, State, Family Size, Budget, Health Conditions) into strict JSON objects without hallucination.
3. **4,096 Token Context Window**: Ample space to hold full insurance policy excerpts, conversation turn histories, and system guardrails.
4. **Sub-Second CPU Inference**: Thanks to AVX2 vector optimizations, it achieves **35–45 tokens/second on 2 vCPUs**, feeling as fast as cloud APIs without any external network latency.
5. **Zero Token Cost ($0.00)**: Eliminates unpredictable cloud bills from OpenAI, Google Gemini, and Anthropic.

---

## 3. End-to-End LLM Application Integration

### 3.1 The Communication Architecture

```mermaid
flowchart LR
    Customer["Customer on WhatsApp / Webchat"] -->|Inbound Message| App["Container: oneai-app\n(Next.js + Baileys Engine)"]
    App -->|getTenantAIClient| Router["AI Router: lib/ai/client.ts"]
    Router -->|Check DB Config| DB["Neon PostgreSQL\n(TenantAIConfig: LOCAL)"]
    Router -->|HTTP POST /v1/chat/completions| Ollama["Container: oneai-ollama\n(Endpoint: http://ollama:11434/v1)"]
    Ollama -->|GPU/CPU Matrix Math| Model["oneai-qwen\n(Qwen 2.5 1.5B in RAM)"]
    Model -->|Sub-second JSON/Text| Ollama
    Ollama -->|HTTP 200 Response| Router
    Router -->|Qualified Answer| App
    App -->|Outbound Reply| Customer
```

### 3.2 Endpoint Creation & Protocol
1. **Protocol**: The Ollama container exposes a fully compliant **OpenAI Chat Completions API**:
   - **Internal URL**: `http://ollama:11434/v1/chat/completions`
   - **Method**: `POST`
   - **Payload**: Standard OpenAI format (`messages: [{ role: "system", content: "..." }, { role: "user", content: "..." }]`, `model: "oneai-qwen"`, `temperature: 0.7`)
2. **Private Network Binding**: The endpoint is accessible only inside the Docker bridge network `oneai-net`. Port `11434` is **not** exposed to the public internet, preventing unauthorized scraping or abuse.

### 3.3 Application Code Routing (`lib/ai/client.ts`)
The application was updated to support the `LOCAL` provider natively:
- When an incoming message arrives, `getTenantAIClient(tenantId)` queries `TenantAIConfig`.
- If `provider === 'LOCAL'`, it automatically routes the request to:
  ```typescript
  const baseUrl = process.env.OPENAI_BASE_URL || 'http://ollama:11434/v1';
  const modelName = process.env.OPENAI_MODEL || 'oneai-qwen';
  ```
- **Zero Cost Logging**: In `logTokenUsage()`, local models (`oneai-qwen`, `ollama`) record a calculated cost of **`$0.00`**, ensuring the dashboard metrics accurately reflect free self-hosted inference.

### 3.4 Web Dashboard Integration (`components/settings-security-tab.tsx`)
In the dashboard under **Settings &rarr; Security/Developer tab**:
- A dedicated card displays **"Self-Hosted Local LLM (Ollama)"** with a live pulsing green indicator.
- Displays the internal endpoint (`http://ollama:11434/v1`), model name, and a badge: **`ACTIVE ENGINE • $0.00 BILLING`**.
- Includes a **"Test Connection"** button that runs a live handshake directly against the model and displays the roundtrip latency.

---

## 4. Technology Stack & Technicalities

### 4.1 The Infrastructure & Runtime Stack
- **Host OS**: Ubuntu 24.04/26.04 LTS (x86_64)
- **Container Runtime**: Docker Engine `29.9.0` with `containerd 2.4.1`
- **Orchestration**: Docker Compose `v5.6.0` (Plugin)
- **Reverse Proxy**: Nginx `1.28.3` with gzip compression and WebSocket stream upgrades
- **LLM Runtime**: **Ollama** (built upon **llama.cpp**), leveraging CPU SIMD/AVX2 vector instructions for high-throughput quantized matrix multiplications.
- **Node.js Environment**: Node.js `20.x` LTS (Debian Bookworm base for glibc compatibility)
- **TypeScript Runtime**: `tsx 4.23` running `server.ts`
- **Web Framework**: Next.js `14.2` App Router with React 18
- **Realtime Communications**: Socket.IO `4.8` + `@whiskeysockets/baileys 7.0` (WhatsApp Web Multi-Device protocol)
- **Database & ORM**: PostgreSQL (hosted on Neon Serverless) managed through Prisma ORM `7.8.0` with connection pooling

### 4.2 Anti-OOM Protection (Linux Kernel Memory Engineering)
Because small VPS instances run the risk of the Linux Out-Of-Memory (OOM) Killer terminating processes when RAM usage spikes, we implemented kernel-level memory protections:
1. **4.0 GB High-Speed NVMe Swapfile**:
   ```bash
   fallocate -l 4G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile
   ```
   Persisted in `/etc/fstab` for automatic mount on system reboots.
2. **Virtual Memory Tuning (`/etc/sysctl.d/99-oneai.conf`)**:
   - `vm.swappiness=10`: Instructs the Linux kernel to prioritize keeping active application and model code in physical RAM, only writing cold/idle memory pages to disk swap.
   - `vm.vfs_cache_pressure=50`: Prevents aggressive filesystem inode eviction, keeping file lookups fast.
3. **Docker Memory Hard Limits (`docker-compose.yml`)**:
   - `oneai-app`: Capped at `1.8G` max RAM.
   - `oneai-ollama`: Capped at `1.8G` max RAM.
   - Guaranteed combined ceiling: 3.6 GB, well within the 4 GB RAM + 4 GB Swap budget.

---

## 5. Deployment Challenges Faced & Solutions Implemented

During the transition from bare-metal execution to the containerized production stack, several challenges arose. Here is how each was diagnosed and resolved:

### Challenge 1: Bare-Metal Memory Fragmentation & Daemon Sprawl
- **Symptom**: Running PM2, host-level Node.js, and host-level Ollama simultaneously led to competing systemd daemons and difficulty replicating environments.
- **Solution**: We performed a complete cleanup (stopping PM2, removing `/var/www/oneaiassist`, disabling host Ollama) and migrated 100% of the runtime into Docker Compose. This cleanly separated host duties (Nginx, Swap, SSH) from container duties (App, AI).

### Challenge 2: WhatsApp Baileys QR Pairing Disconnections
- **Symptom**: On cloud servers, WhatsApp QR code pairing would show initially but fail to complete the cryptographic handshake, timing out or dropping.
- **Solution**: 
  1. Configured Nginx to explicitly support long-lived WebSocket upgrade tunnels on `/socket.io/`:
     ```nginx
     location /socket.io/ {
         proxy_pass http://127.0.0.1:3000;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "upgrade";
         proxy_read_timeout 86400s;
     }
     ```
  2. Enforced single-process concurrency (`-i 1` / single container replica) so the Baileys session state in memory and PostgreSQL remains deterministic with zero session race conditions.

### Challenge 3: Modern Node CJS/ESM Export Bug in `whatsapp-rust-bridge`
- **Symptom**: Container crashed on startup with:
  `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in /var/www/oneaiassist/node_modules/whatsapp-rust-bridge/package.json`
- **Root Cause**: The upstream Baileys crypto dependency `whatsapp-rust-bridge` only declared `"import"` in its `package.json` `exports` field, lacking a `"require"` or `"main"` entry needed by tsx and CommonJS loaders.
- **Solution**: Added an automated patching script in the `Dockerfile` build step:
  ```dockerfile
  RUN node -e '\
  const fs = require("fs"); \
  const p = "./node_modules/whatsapp-rust-bridge/package.json"; \
  if (fs.existsSync(p)) { \
    const pkg = JSON.parse(fs.readFileSync(p, "utf8")); \
    pkg.main = "./dist/index.js"; \
    if (pkg.exports && pkg.exports["."]) { \
      pkg.exports["."].require = "./dist/index.js"; \
      pkg.exports["."].default = "./dist/index.js"; \
    } \
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2)); \
  }'
  ```

### Challenge 4: GitHub Actions Docker Build Failures
- **Symptom A**: `Cannot find module 'tailwindcss'` during Docker build.
  - **Fix**: Removed `ENV NODE_ENV=production` before `npm install` so that Next.js build-time tools (`tailwindcss`, `postcss`, `typescript`) are installed during the build phase, and only enabled production mode at the runtime phase.
- **Symptom B**: `Error: DATABASE_URL environment variable is not set` during Next.js static collection (`Collecting page data ...`).
  - **Fix**: Added build-time placeholder environment variables in `Dockerfile`:
    ```dockerfile
    ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=disable"
    ENV NEXTAUTH_SECRET="build_placeholder_secret_32bytes_long!"
    ENV ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    ```
    This satisfies Next.js static analysis at build time, while the real production secrets are injected via `docker-compose.yml` at runtime.

### Challenge 5: Nginx 404 on CSS & JavaScript Assets (Skeleton Screen Bug)
- **Symptom**: The homepage HTML opened, but all styles and interactive components were missing, leaving only a blank skeleton loader with browser console 404s for `/_next/static/*`.
- **Root Cause**: Nginx had old `alias /var/www/oneaiassist/.next/static/` directives pointing to the deleted host folder instead of routing into the container.
- **Solution**: Removed the host file aliases and configured Nginx to proxy all routes (`location /`) into `http://127.0.0.1:3000`, allowing Next.js inside Docker to serve its own immutable static assets with high-efficiency caching.

---

## 6. GitHub Actions CI/CD Pipeline & Deployment Guide

### 6.1 The GitHub Actions Workflow (`.github/workflows/deploy.yml`)
The pipeline runs on every `git push origin main`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches:
      - main

jobs:
  build-and-push:
    name: Build & Push to GitHub Container Registry
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=raw,value=latest
            type=sha,prefix=sha-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 6.2 Server Configuration (`/opt/oneaiassist/docker-compose.yml`)

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: oneai-ollama
    restart: always
    environment:
      - OLLAMA_NUM_PARALLEL=1
      - OLLAMA_KEEP_ALIVE=24h
    volumes:
      - /usr/share/ollama/.ollama:/root/.ollama
    networks:
      - oneai-net
    deploy:
      resources:
        limits:
          memory: 1.8G

  oneaiassist:
    image: ghcr.io/saythu000/oneaiassit:latest
    container_name: oneai-app
    restart: always
    env_file:
      - .env
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - ollama
    networks:
      - oneai-net
    deploy:
      resources:
        limits:
          memory: 1.8G

networks:
  oneai-net:
    driver: bridge
```

### 6.3 Future Update Procedure (One-Command Deployment)

Whenever you push new code to GitHub:
```bash
# 1. On your local machine:
git add .
git commit -m "feat: your new feature"
git push origin main

# 2. Wait 2 minutes for GitHub Actions to build the image, then on your server:
ssh -i ~/.ssh/id_ed25519 root@167.233.103.156 "cd /opt/oneaiassist && docker compose pull oneaiassist && docker compose up -d"
```

---

## 7. Useful Verification & Troubleshooting Commands

```bash
# 1. Check container status
cd /opt/oneaiassist && docker compose ps

# 2. View real-time application logs (Next.js & WhatsApp engine)
cd /opt/oneaiassist && docker compose logs -f oneaiassist

# 3. View Ollama model inference logs
cd /opt/oneaiassist && docker compose logs -f ollama

# 4. Check RAM and CPU allocation in real time
docker stats

# 5. Run a direct model inference prompt inside Ollama
docker exec oneai-ollama ollama run oneai-qwen "Hello, are you ready?"

# 6. Test the internal OpenAI API endpoint from the app container
docker exec oneai-app curl -s http://ollama:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "oneai-qwen", "messages": [{"role": "user", "content": "Ping"}], "max_tokens": 5}'

# 7. Restart all services cleanly
cd /opt/oneaiassist && docker compose restart
```
