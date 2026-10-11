# Server Specifications, Infrastructure & Credentials Guide

**Document 1 of 5: Enterprise Deployment Documentation**  
**Project**: OneAIAssist Multi-Channel AI Platform  
**Target Host**: Hetzner Cloud VPS (OneAI-Pattacare)

---

## 1. Hardware & Infrastructure Specifications

| Specification | Configuration Value | Technical Purpose & Notes |
| :--- | :--- | :--- |
| **Cloud Provider** | **Hetzner Cloud** | Enterprise European/Global cloud hosting with high-performance NVMe storage. |
| **Server Name** | `OneAI-Pattacare` | Host identifier assigned in Hetzner Cloud Console. |
| **Server Plan** | **CX23 / x23** | Cloud VPS tier engineered for lightweight multi-container workloads. |
| **Processor (vCPU)** | **2 vCPUs** | Dedicated virtual cores executing Node.js event loops and Ollama CPU inference threads. |
| **Physical Memory (RAM)** | **4.0 GB DDR4/DDR5 ECC** | Host RAM allocated strictly between OS, Docker Engine, Application, and Local LLM. |
| **Storage (Disk)** | **40 GB NVMe SSD** | High IOPS local storage ensuring sub-millisecond weight-loading for the model and fast disk reads. |
| **Network Traffic** | **20 TB Included** | High-speed 1 Gbit/s uplink bandwidth. |
| **Operating System** | **Ubuntu 26.04 LTS (x86_64)** | Clean, minimal long-term support Linux distribution. |

---

## 2. Network Addresses & IP Topology

| Network Type | Address Range | Purpose |
| :--- | :--- | :--- |
| **Public IPv4** | `167.233.103.156/32` | Primary public routing address for web users, webhooks, and dashboard access. |
| **Public IPv6** | `2a01:4f8:c013:83b::/64` | Subnet allocated by Hetzner for native IPv6 connectivity. |
| **Gateway & DNS** | Hetzner Cloud Gateway | Resolves public APIs and Neon DB endpoints (`ipv4first` prioritized). |

---

## 3. Server Access & Authentication Credentials

> [!IMPORTANT]
> The server has been hardened to use modern ED25519 cryptographic key authentication. Keep private keys secure and never commit them to public version control.

### A. Root Access Credentials
- **Default Hetzner Initial Password**: `LvfMCxiew3mAmNHpCATj` *(used exclusively during initial initialization)*
- **Updated Host Root Password**: `Pattacare@OneAI2026!#` *(set upon initial system security prompt)*
- **SSH Port**: `22` (Standard OpenSSH daemon)

### B. SSH Key Authentication
- **Key Algorithm**: `ED25519` (256-bit elliptic-curve signature, superior to legacy RSA 2048/4096)
- **Local Private Key Path**: `~/.ssh/id_ed25519`
- **Host Authorized Keys Path**: `/root/.ssh/authorized_keys`
- **Authorized Public Key**:
  ```text
  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMNGEy6ceRmKRBpufRAXiZlp2UGkgsfaHSS380KEmPf8 mi@pattacare-ai
  ```

### C. Connection Commands

To connect securely to the server without needing to type a password:
```bash
ssh -i ~/.ssh/id_ed25519 root@167.233.103.156
```
*Why this command is used*: The `-i` flag forces OpenSSH to present the authorized ED25519 identity key, bypassing keyboard-interactive password prompts and preventing automated brute-force attacks.

To check server resource utilization and uptime without opening an interactive session:
```bash
ssh -i ~/.ssh/id_ed25519 root@167.233.103.156 "uptime && free -h && docker stats --no-stream"
```

---

## 4. Port Map & Network Security Architecture

To maintain zero attack surface, internal services are strictly forbidden from binding directly to `0.0.0.0`.

```
Internet (Clients, Browsers, WhatsApp Webhooks)
                     │
                     ▼
             ┌───────────────┐
             │ Port 80 / 443 │ (Public Host Nginx)
             └───────┬───────┘
                     │ (Reverse Proxy Stream + WebSocket Upgrades)
                     ▼
             ┌───────────────┐
             │   Port 3000   │ (Bound strictly to 127.0.0.1 on Host)
             └───────┬───────┘
                     │ (Docker Bridge Network: oneai-net)
                     ▼
             ┌───────────────┐
             │  Port 11434   │ (Completely hidden from Internet;
             └───────────────┘  accessible ONLY by oneai-app container)
```

### Port Breakdown:
1. **Port 22 (Public)**: OpenSSH management service.
2. **Port 80 (Public)**: Nginx Web Server (HTTP reverse proxy forwarding to container port 3000).
3. **Port 443 (Public)**: Nginx Web Server (pre-configured for SSL certificates e.g., Certbot / Let's Encrypt).
4. **Port 3000 (Localhost Only `127.0.0.1:3000`)**: Docker container `oneai-app`. Nginx proxies incoming traffic here. Direct external access is blocked by binding only to loopback.
5. **Port 11434 (Private Docker Network `oneai-net`)**: Docker container `oneai-ollama`. Not bound to host ports at all. Only accessible via internal container DNS (`http://ollama:11434`).

---

## 5. Storage Partitioning & Swap Anti-OOM Architecture

On a 4 GB RAM server running both an AI Large Language Model and a Node.js full-stack platform, Linux Out-Of-Memory (OOM) killer protection is an absolute requirement.

### Swapfile Configuration:
- **Location**: `/swapfile`
- **Size**: `4.0 GB` (Created using block-allocation on high-speed NVMe)
- **Permissions**: `0600` (Read/write restricted to root)
- **Kernel Persistence**: Written to `/etc/fstab`

### Commands Used to Create & Persist Swap:
```bash
# 1. Allocate 4 GB contiguous file on NVMe
fallocate -l 4G /swapfile

# 2. Lock permissions to root only
chmod 600 /swapfile

# 3. Format as Linux swap partition
mkswap /swapfile

# 4. Activate swap partition immediately
swapon /swapfile

# 5. Persist across server reboots
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
*Why these commands are used*: Without swap, a temporary memory spike (such as compiling Next.js or processing multiple long WhatsApp chat contexts simultaneously) would cause the Linux kernel to abruptly kill the Docker daemon or Ollama process.

### Kernel Memory Tuning (`/etc/sysctl.d/99-oneai.conf`):
```ini
vm.swappiness = 10
vm.vfs_cache_pressure = 50
```
### Commands Used to Apply Sysctl:
```bash
cat << 'EOF' > /etc/sysctl.d/99-oneai.conf
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
sysctl --system
```
*Why this configuration is used*:
- `vm.swappiness=10`: Instructs the Linux kernel to keep active application memory and model weights in physical RAM, only writing idle memory pages to the NVMe swap if RAM usage exceeds 90%.
- `vm.vfs_cache_pressure=50`: Keeps file system directory structures and inode caches in memory longer, speeding up Docker layer and Next.js static asset reads.

---

## 6. Resource Budget Allocation

| Process / Layer | Assigned Memory Limit | Real-World Memory Used | Headroom / Safety |
| :--- | :--- | :--- | :--- |
| **Linux OS Baseline & Nginx** | No limit | ~450 MB | Low overhead background services. |
| **Container: `oneai-ollama`** | `1.8 GB` max limit | ~1,100 MB (~1.1 GB) | Loads Qwen 2.5 1.5B (986 MB weights + KV cache). |
| **Container: `oneai-app`** | `1.8 GB` max limit | ~380 MB | Runs Next.js 14, Prisma, and Baileys WhatsApp Engine. |
| **Host Free RAM Buffer** | Unallocated | **~1.7 GB Free RAM** | Available dynamically for memory bursts. |
| **NVMe Swap Protection** | `4.0 GB` total | ~9 MB used | Total emergency buffer preventing OOM crashes. |

---

## 7. Server Directory Layout

```
/opt/oneaiassist/                    <-- Production Docker Home
├── docker-compose.yml               <-- Defines oneai-app and oneai-ollama services
├── .env                             <-- Production secrets (DATABASE_URL, NEXTAUTH_SECRET)
└── .docker/                         <-- GHCR authentication config

/etc/nginx/sites-available/oneaiassist <-- Production Reverse Proxy & WebSocket Config
/usr/share/ollama/.ollama/models/      <-- Persistent storage for downloaded model weights
/swapfile                              <-- 4 GB Anti-OOM NVMe Swapfile
```
