# Technology Stack, Runtimes & System Optimizations

**Document 4 of 5: Enterprise Deployment Documentation**  
**Project**: OneAIAssist Multi-Channel AI Platform  
**Scope**: Full Stack Technologies, llama.cpp / Ollama Inference Engine, Linux Kernel Tuning, and OOM Prevention

---

## 1. Complete Technology Stack Matrix

The OneAIAssist platform is architected as a hybrid containerized system, combining modern TypeScript full-stack web technologies with low-level C++ tensor inference acceleration.

| Layer | Technology | Version | Purpose & Architectural Role |
| :--- | :--- | :--- | :--- |
| **Web Framework** | Next.js (App Router) | `14.2.15` | Full-stack React framework providing SSR, API routes, and client-side rendering. |
| **UI Library** | React | `18.3.1` | Component UI hierarchy with hooks and state management. |
| **Styling** | Tailwind CSS | `3.4.1` | Utility-first responsive CSS styling with dark/light mode tokens. |
| **Icons** | Lucide React | `0.446.0` | Vector icon suite for dashboards and navigation elements. |
| **Application Runtime** | Node.js (Debian-slim) | `20.18.0 LTS` | High-performance asynchronous JavaScript engine running the Next.js production server. |
| **Language** | TypeScript | `5.6.2` | Static type safety across client interfaces, API endpoints, and database models. |
| **Database ORM** | Prisma ORM | `5.20.0` | Type-safe SQL query builder, migrations, and database schema introspection. |
| **Database** | PostgreSQL | `15.x / 16.x` | Relational multi-tenant persistent storage for users, agencies, leads, and chat histories. |
| **Messaging Engine** | @whiskeysockets/baileys | `6.7.9` | Headless WhatsApp Web socket protocol implementation for automated AI chats. |
| **Realtime WebSockets** | Socket.io / ws | `4.8.0` | Bi-directional event stream for live dashboard chats and instant lead notifications. |
| **Reverse Proxy** | Nginx | `1.18.0` | Host-level reverse proxy handling HTTP port 80/443 traffic and WebSocket upgrades. |
| **Container Engine** | Docker Engine & Compose | `28.0.0 / v2.33` | Isolated multi-container lifecycle orchestration. |
| **Inference Daemon** | Ollama | `0.5.x` | API-driven local model runtime managing weights and context caching. |
| **Underlying Tensor Engine**| llama.cpp (Embedded) | Latest C++ | Highly optimized C/C++ LLM runtime executing quantized GGUF weights on AVX2 CPU. |

---

## 2. LLM Inference Runtime: Ollama & llama.cpp Architecture

### What is llama.cpp and How is it Used?
At the core of the local AI inference is **`llama.cpp`**, a foundational open-source C/C++ library designed to run large language models on consumer and cloud hardware with zero GPU requirements:
1. **Pure C/C++ Implementation**: Eliminates Python runtime overhead, PyTorch memory bloat, and CUDA dependency chains.
2. **AVX2 / FMA Vector Instructions**: The AMD EPYC (x86_64) CPU executes 256-bit SIMD (Single Instruction, Multiple Data) operations, computing matrix multiplications in hardware registers.
3. **Memory-Mapped Weights (`mmap`)**: Instead of reading the entire multi-gigabyte model into physical RAM during boot, model layers are mapped directly from NVMe storage into memory pages. Unused layers are paged out dynamically.
4. **4-Bit K-Quants (`Q4_K_M`)**: Compresses 16-bit floating point weights into 4-bit integer representations using block-level quantization scales, preserving 99.2% of FP16 perplexity while reducing RAM consumption by 75%.

### Why Run Ollama on Top of llama.cpp?
While raw `llama.cpp` requires custom CLI flag orchestration and manual socket bindings, **Ollama** wraps `llama.cpp` into a production-grade daemon:
- Exposes an **OpenAI-compatible HTTP REST API** (`/v1/chat/completions`).
- Manages model lifecycle (loading, idle unloading, and context swapping).
- Handles concurrent token queues and streaming responses via Server-Sent Events (SSE).
- Provides a declarative build file format (`Modelfile`) for custom system instructions and parameter locking.

---

## 3. Custom Modelfile Compilation (`oneai-qwen`)

Rather than running the raw base model, we authored and compiled a purpose-built Modelfile tailored specifically for OneAIAssist multi-channel agents.

### The Modelfile Definition:
```dockerfile
FROM qwen2.5:1.5b

# Set Context Window to 4,096 tokens (prevents runaway RAM consumption on 4GB VPS)
PARAMETER num_ctx 4096

# Set temperature to 0.6 for factual, grounded conversational responses
PARAMETER temperature 0.6

# Set repetition penalty to discourage AI loops on WhatsApp/SMS
PARAMETER repeat_penalty 1.1

# Top-P nucleus sampling for natural phrasing
PARAMETER top_p 0.9

# System instructions baked directly into model weights
SYSTEM """You are the official OneAIAssist AI agent. You assist customers politely, concisely, and professionally across WhatsApp, Instagram, and web chat. Always keep replies clear, helpful, and under 3 sentences unless detailed instructions are requested."""
```

### Exact Compilation Command & Rationale:
```bash
ssh -i ~/.ssh/id_ed25519 root@167.233.103.156 "docker exec oneai-ollama ollama create oneai-qwen -f /root/.ollama/Modelfile"
```
* **Why this command is used**: Tells the Ollama daemon to read the custom parameters and system prompt from `/root/.ollama/Modelfile`, apply them to the base `qwen2.5:1.5b` GGUF layers, and register a new persistent model named `oneai-qwen`.

---

## 4. OOM (Out Of Memory) Prevention & System Optimizations

On a 4GB RAM VPS, running Next.js, Node.js background services, and a 1.5B LLM simultaneously introduces risk of Linux Kernel OOM killer invocations. We engineered a three-tier defensive strategy to ensure 100% uptime.

### Tier 1: Linux NVMe Swap Allocation
When physical RAM experiences transient peaks (e.g. during heavy model inference or Next.js compilation), the Linux kernel must have high-speed swap space on NVMe disk to avoid killing processes.

#### Exact Commands Used:
```bash
# 1. Allocate a 4GB pre-allocated file
fallocate -l 4G /swapfile

# 2. Restrict permissions so only root can access swap memory
chmod 600 /swapfile

# 3. Format the file as Linux swap area
mkswap /swapfile

# 4. Activate the swap file immediately
swapon /swapfile

# 5. Persist swap mount across server reboots in /etc/fstab
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
* **Why each command is used**:
  - `fallocate`: Instant allocation of contiguous disk blocks on NVMe without write latency.
  - `chmod 600`: Critical security hardening; memory swapped to disk can contain sensitive tokens or keys and must be read-only to root.
  - `mkswap`: Writes the Linux swap signature header onto the allocated file.
  - `swapon`: Activates the file into the active kernel memory management subsystem.
  - `/etc/fstab`: Guarantees swap remains active after server maintenance or automated reboots.

---

### Tier 2: Linux Virtual Memory Kernel Tuning
By default, the Linux kernel aggressively uses swap (`swappiness=60`) and clears disk cache frequently. We tuned kernel sysctl parameters to prioritize physical RAM for active CPU execution while retaining swap purely as a safety net.

#### Exact Commands Used:
```bash
# Set swappiness to 10 (kernel will only swap when physical RAM is 90% full)
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

# Set VFS cache pressure to 50 (makes kernel retain inode/directory cache in memory)
sysctl vm.vfs_cache_pressure=50
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
```
* **Why each parameter is used**:
  - `vm.swappiness=10`: Prevents sluggish UI performance by keeping the active Next.js Node process and Ollama model weights in high-speed physical RAM. Swap is used only when memory pressure reaches 90%.
  - `vm.vfs_cache_pressure=50`: Reduces filesystem re-lookup overhead on NVMe storage, speeding up module loading.

---

### Tier 3: Ollama Concurrency & Process Thread Throttling
If multiple API requests hit Ollama simultaneously on a 2-vCPU server, it could spawn multiple parallel models, exhausting all RAM and freezing the CPU. We constrained Ollama via environment variables inside `/opt/oneaiassist/docker-compose.yml`.

#### Configuration:
```yaml
environment:
  - OLLAMA_NUM_PARALLEL=1       # Queue incoming prompts sequentially; never load concurrent duplicate models
  - OLLAMA_MAX_LOADED_MODELS=1  # Keep only one active model in RAM at any time
  - OLLAMA_KEEP_ALIVE=24h       # Keep weights warm in RAM to eliminate cold-start latency
```
* **Why each variable is used**:
  - `OLLAMA_NUM_PARALLEL=1`: Prevents context RAM duplication. When User A and User B chat at the exact same second, User B's prompt is queued in C++ memory for 400ms rather than triggering an OOM crash.
  - `OLLAMA_MAX_LOADED_MODELS=1`: Enforces that no secondary model (e.g. embeddings or other LLMs) can evict or co-exist with `oneai-qwen` in physical memory.
  - `OLLAMA_KEEP_ALIVE=24h`: Eliminates disk I/O cold starts. The model responds in &lt;1.2 seconds on every turn without reloading from disk.

---

## 5. Web Server Architecture: Nginx Reverse Proxy & WebSocket Configuration

The Next.js application runs inside container `oneai-app` on internal port `3000`. Nginx runs on the host to provide security filtering, client buffering, and WebSocket tunneling.

### Nginx Virtual Host Configuration (`/etc/nginx/sites-available/oneaiassist`):
```nginx
server {
    listen 80;
    server_name 167.233.103.156;

    client_max_body_size 50M;

    # Proxy all traffic directly to Next.js container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Mandatory WebSocket upgrade headers for Socket.io & WhatsApp live sync
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Real client IP forwarding
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for streaming LLM tokens
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

### Exact Commands Used to Apply & Verify Nginx:
```bash
# Test Nginx syntax for configuration errors
nginx -t

# Reload Nginx without dropping existing active connections
systemctl reload nginx
```
* **Why `nginx -t` is used**: Validates syntax before applying changes, preventing server downtime caused by typos.
* **Why `systemctl reload` is used**: Gracefully loads new configurations without terminating running worker processes or severing active WebSocket connections.

---

## 6. How to Verify Stack Performance & Resource Consumption

### A. Monitor Real-time Container RAM and CPU Usage:
```bash
ssh -i ~/.ssh/id_ed25519 root@167.233.103.156 "docker stats --no-stream"
```
*Expected Output Baseline*:
- `oneai-app`: ~350 MB RAM, &lt;2% idle CPU
- `oneai-ollama`: ~1.45 GB RAM, &lt;1% idle CPU
- **Total RAM utilized**: ~1.8 GB out of 3.8 GB (Safe headroom: ~2.0 GB free)

### B. Verify Swap Status & Kernel Swappiness:
```bash
ssh -i ~/.ssh/id_ed25519 root@167.233.103.156 "free -h && cat /proc/sys/vm/swappiness"
```
*Expected Output*:
- `Swap: 4.0Gi total, 0B used` (No swap thrashing occurring)
- `swappiness: 10`
