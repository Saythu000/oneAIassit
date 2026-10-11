#!/usr/bin/env bash
# ==============================================================================
# OneAIAssist: Automated Hetzner CX23 Local LLM Provisioning & Deployment Script
# Target Hardware: 2 vCPU, 4 GB RAM, 40 GB NVMe SSD
# Target Model: Qwen 2.5 3B-Instruct (4-bit Q4_K_M GGUF via Ollama)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================================${NC}"
echo -e "${BLUE}   OneAIAssist Local LLM Setup (Hetzner CX23 - 4 GB RAM Edition)   ${NC}"
echo -e "${BLUE}===================================================================${NC}"

# Check for root privilege
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This setup script must be run as root (or via sudo).${NC}"
   exit 1
fi

# ------------------------------------------------------------------------------
# STEP 1: Provision 4 GB NVMe Swapfile (Anti-OOM Protection)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Step 1/5] Checking Memory and Configuring 4 GB Swapfile...${NC}"

if swapon --show | grep -q "/swapfile"; then
    echo -e "${GREEN}[OK] /swapfile is already active.${NC}"
else
    if [ ! -f /swapfile ]; then
        echo -e "[INFO] Allocating 4 GB contiguous NVMe swap space..."
        fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
        chmod 600 /swapfile
        mkswap /swapfile
    fi
    echo -e "[INFO] Activating /swapfile..."
    swapon /swapfile
    
    # Ensure persistence in /etc/fstab
    if ! grep -q "/swapfile" /etc/fstab; then
        echo "/swapfile none swap sw 0 0" >> /etc/fstab
        echo -e "${GREEN}[OK] Added /swapfile to /etc/fstab for persistence across reboots.${NC}"
    fi
fi

# Tune virtual memory kernel parameters
echo -e "[INFO] Tuning vm.swappiness=10 and vm.vfs_cache_pressure=50..."
sysctl -w vm.swappiness=10 >/dev/null
sysctl -w vm.vfs_cache_pressure=50 >/dev/null

if ! grep -q "vm.swappiness" /etc/sysctl.conf 2>/dev/null; then
    echo "vm.swappiness = 10" >> /etc/sysctl.conf
    echo "vm.vfs_cache_pressure = 50" >> /etc/sysctl.conf
fi

echo -e "${GREEN}[OK] Memory status after swap configuration:${NC}"
free -h

# ------------------------------------------------------------------------------
# STEP 2: Install Ollama Inference Daemon
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Step 2/5] Installing & Configuring Ollama Daemon...${NC}"

if ! command -v ollama &> /dev/null; then
    echo -e "[INFO] Downloading and installing official Ollama binary..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo -e "${GREEN}[OK] Ollama is already installed: $(ollama --version)${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 3: Configure Strict Process Isolation & Localhost Security
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Step 3/5] Configuring systemd Environment Overrides...${NC}"

SYSTEMD_DIR="/etc/systemd/system/ollama.service.d"
mkdir -p "$SYSTEMD_DIR"

cat << 'SYSCONF' > "$SYSTEMD_DIR/override.conf"
[Service]
# Bind strictly to private loopback (never expose port 11434 to public internet)
Environment="OLLAMA_HOST=127.0.0.1:11434"

# Concurrency fencing: strictly 1 request at a time to prevent RAM cloning
Environment="OLLAMA_NUM_PARALLEL=1"

# Keep model weights permanently loaded in memory (eliminate cold-start latency)
Environment="OLLAMA_KEEP_ALIVE=24h"
SYSCONF

echo -e "[INFO] Reloading systemd and restarting ollama.service..."
systemctl daemon-reload
systemctl enable --now ollama
systemctl restart ollama

# Wait for Ollama to become ready
echo -e "[INFO] Waiting for Ollama HTTP endpoint (127.0.0.1:11434)..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:11434/api/version >/dev/null; then
        echo -e "${GREEN}[OK] Ollama daemon is active and responding: $(curl -s http://127.0.0.1:11434/api/version)${NC}"
        break
    fi
    sleep 1
done

# ------------------------------------------------------------------------------
# STEP 4: Pull Model & Tune Context Window (4,096 tokens)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Step 4/5] Pulling Qwen 2.5 3B & Building Tuned Model...${NC}"

echo -e "[INFO] Ingesting qwen2.5:3b (4-bit Q4_K_M GGUF, ~1.9 GB)..."
ollama pull qwen2.5:3b

# Create custom Modelfile with capped context window
TMP_MODELFILE="/tmp/Modelfile.oneai"
cat << 'MFILE' > "$TMP_MODELFILE"
FROM qwen2.5:3b
PARAMETER num_ctx 4096
PARAMETER temperature 0.7
PARAMETER top_p 0.9
MFILE

echo -e "[INFO] Building custom 'oneai-qwen' model with 4,096 context cap..."
ollama create oneai-qwen -f "$TMP_MODELFILE"
rm -f "$TMP_MODELFILE"

# ------------------------------------------------------------------------------
# STEP 5: Verification & Benchmark Test
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[Step 5/5] Executing Benchmark Verification Call...${NC}"

START_TIME=$(date +%s%N)
TEST_RESPONSE=$(curl -s http://127.0.0.1:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "oneai-qwen",
    "messages": [
      {"role": "system", "content": "You are Maya from OneAIAssist. Keep response under 10 words."},
      {"role": "user", "content": "Hello, can you help me with health insurance?"}
    ]
  }')
END_TIME=$(date +%s%N)

ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

echo -e "\n${GREEN}=== BENCHMARK RESULTS ===${NC}"
echo -e "HTTP Roundtrip Time: ${ELAPSED_MS} ms"
echo -e "Response Payload:"
echo "$TEST_RESPONSE" | grep -o '"content":"[^"]*"' || echo "$TEST_RESPONSE"

echo -e "\n${GREEN}=== SYSTEM MEMORY STATUS ===${NC}"
free -h

echo -e "\n${GREEN}===================================================================${NC}"
echo -e "${GREEN}   Local LLM Setup Complete! Next.js can now connect via:        ${NC}"
echo -e "${GREEN}   OPENAI_BASE_URL=http://127.0.0.1:11434/v1                      ${NC}"
echo -e "${GREEN}   OPENAI_MODEL=oneai-qwen                                         ${NC}"
echo -e "${GREEN}===================================================================${NC}"
