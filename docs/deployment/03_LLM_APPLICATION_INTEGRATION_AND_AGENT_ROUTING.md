# LLM Application Integration & Multi-Agent Routing Architecture

**Document 3 of 5: Enterprise Deployment Documentation**  
**Project**: OneAIAssist Multi-Channel AI Platform  
**Integration Scope**: Ollama Internal Endpoint &rarr; Next.js Runtime &rarr; Prisma Database &rarr; Multi-Agent Workflow Engine

---

## 1. Internal Endpoint Generation & Network Discovery

In traditional cloud deployments, applications call third-party HTTP APIs over the public internet (e.g. `https://api.openai.com/v1`). 

In our self-hosted architecture, the AI model runs locally inside a dedicated Docker container. The application communicates with it across a private, high-speed Linux bridge network.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Docker Bridge Network: oneai-net                     │
│                                                                        │
│   ┌───────────────────────────┐            ┌───────────────────────┐   │
│   │   Container: oneai-app    │  HTTP POST │ Container:            │   │
│   │   (Next.js & Agents)      ├───────────►│ oneai-ollama          │   │
│   │                           │ /chat/     │ (Qwen 2.5 1.5B)       │   │
│   │   OPENAI_BASE_URL:        │ completions│                       │   │
│   │   http://ollama:11434/v1  │◄───────────┤ Port 11434            │   │
│   └───────────────────────────┘  JSON Resp │ (Private Network Only)│   │
│                                            └───────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### A. How the Endpoint Was Created (`docker-compose.yml`):
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

### B. Network Principles:
1. **Container DNS Resolution**: Docker automatically injects an embedded DNS server (`127.0.0.11`). When the application requests `http://ollama:11434`, Docker resolves `ollama` directly to the IP address of the `oneai-ollama` container on the `oneai-net` bridge.
2. **Zero Internet Exposure**: Notice that `ollama` contains **no `ports:` definition**. Port `11434` is never opened to the host machine or public internet. It exists strictly within `oneai-net`, making unauthorized access impossible.
3. **Environment Injection**: The application container (`oneai-app`) receives the endpoint URL via `/opt/oneaiassist/.env`:
   ```env
   OPENAI_BASE_URL="http://ollama:11434/v1"
   OPENAI_MODEL="oneai-qwen"
   OPENAI_API_KEY="ollama"
   ```

---

## 2. OpenAI Protocol Compatibility

Ollama provides a native **OpenAI-Compatible REST API** on path `/v1`. 

Because our application was initially architected around standard OpenAI completion schemas, we did not need to install complex proprietary SDKs or rewrite prompts. We simply redirected the base URL.

### Request Sent by OneAIAssist:
```http
POST /v1/chat/completions HTTP/1.1
Host: ollama:11434
Content-Type: application/json
Authorization: Bearer ollama

{
  "model": "oneai-qwen",
  "messages": [
    {
      "role": "system",
      "content": "You are OneAI Assist, qualifying leads for healthcare insurance."
    },
    {
      "role": "user",
      "content": "I am 35 years old living in Texas with no health conditions."
    }
  ],
  "temperature": 0.7
}
```

### Response Returned by `oneai-qwen`:
```json
{
  "id": "chatcmpl-477",
  "object": "chat.completion",
  "created": 1791706233,
  "model": "oneai-qwen",
  "system_fingerprint": "fp_ollama",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Thank you! What is your estimated monthly budget for coverage?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 31,
    "completion_tokens": 14,
    "total_tokens": 45
  }
}
```

---

## 3. The Core AI Router (`lib/ai/client.ts`)

Every component in OneAIAssist (WhatsApp engine, email workflows, customer webchat, live chat copilot) fetches its AI execution client through a single factory function: `getTenantAIClient(tenantId)`.

### Code Implementation:
```typescript
export async function getTenantAIClient(tenantId: string, bypassTrialCheck: boolean = false): Promise<AIClient> {
  const db = getTenantPrisma(tenantId, 'ADMIN');

  // 1. Query the database to find the tenant's active AI configuration
  const config = await db.tenantAIConfig.findUnique({
    where: { tenantId },
  });

  // Default to LOCAL if OPENAI_BASE_URL exists in the container environment
  const provider = config?.provider || (process.env.OPENAI_BASE_URL ? 'LOCAL' : 'OPENAI');
  let apiKey = '';

  if (config?.isActive && config.encryptedApiKey && config.provider !== 'LOCAL') {
    try {
      apiKey = decrypt(config.encryptedApiKey);
    } catch {
      console.error(`[AI Client] Decryption failed for tenant config: ${tenantId}`);
    }
  }

  // 2. Self-Hosted Local Routing Logic
  if (provider === 'LOCAL') {
    apiKey = 'ollama'; // Local Ollama does not require real API keys
  } else if (!apiKey) {
    if (!bypassTrialCheck) {
      const exceeded = await isTrialExceeded(tenantId);
      if (exceeded) throw new Error('TrialLimitExceeded');
    }
    if (provider === 'OPENAI') {
      apiKey = process.env.OPENAI_API_KEY || (process.env.OPENAI_BASE_URL ? 'local-ollama' : '');
    } else if (provider === 'GEMINI') {
      apiKey = process.env.GEMINI_API_KEY || '';
    } else {
      apiKey = process.env.ANTHROPIC_API_KEY || '';
    }
  }

  return {
    generateChat: async (arg1: any, arg2?: any): Promise<string> => {
      const messages: ChatMessage[] = Array.isArray(arg1) ? arg1 : (Array.isArray(arg2) ? arg2 : []);
      await checkRateLimit(tenantId);

      // 3. Dispatch to Self-Hosted Local Ollama Container
      if (provider === 'LOCAL' || provider === 'OPENAI') {
        const isLocal = provider === 'LOCAL' || !!process.env.OPENAI_BASE_URL;
        const baseUrl = isLocal 
          ? (process.env.OPENAI_BASE_URL || 'http://ollama:11434/v1') 
          : 'https://api.openai.com/v1';
        const modelName = isLocal 
          ? (process.env.OPENAI_MODEL || 'oneai-qwen') 
          : 'gpt-4-turbo';

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey || 'ollama'}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `AI API call failed with status ${response.status}`);
        }

        const data = await response.json();
        const inputTokens = data.usage?.prompt_tokens || 0;
        const outputTokens = data.usage?.completion_tokens || 0;

        // Log token usage with $0.00 cost calculation
        await logTokenUsage(tenantId, inputTokens, outputTokens, modelName);
        return data.choices[0]?.message?.content || '';
      }
      
      // Fallback handlers for Gemini and Anthropic...
    }
  };
}
```

### Zero-Dollar Cost Accounting:
In `logTokenUsage()`:
```typescript
if (modelUpper.includes('QWEN') || modelUpper.includes('LOCAL') || modelUpper.includes('OLLAMA') || modelUpper.includes('ONEAI')) {
  cost = 0; // Self-hosted local inference incurs zero per-token cost
}
```
*Why this is critical*: The agency dashboard tracks token metrics and billing. By explicitly calculating `cost = 0` for `oneai-qwen`, agency admins can see the volume of messages handled while their token invoice remains \$0.00.

---

## 4. Database Architecture (`TenantAIConfig`)

To persist the selection of the local model in PostgreSQL across server reboots, we extended the database schema.

### Prisma Schema (`prisma/schema.prisma`):
```prisma
enum AIProvider {
  OPENAI
  ANTHROPIC
  GEMINI
  LOCAL      // Added for Self-Hosted Qwen 2.5 1.5B
  OTHER
}

model TenantAIConfig {
  id              String     @id @default(cuid())
  tenantId        String     @unique
  provider        AIProvider
  encryptedApiKey String
  isActive        Boolean    @default(true)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```

### SQL Applied to Database:
```sql
-- 1. Add LOCAL value to the PostgreSQL native enum
ALTER TYPE "AIProvider" ADD VALUE IF NOT EXISTS 'LOCAL';

-- 2. Upsert the tenant configuration to LOCAL
INSERT INTO "TenantAIConfig" ("id", "tenantId", "provider", "encryptedApiKey", "isActive", "createdAt", "updatedAt")
VALUES ('cfg_local_01', 'tenant_pme_ff9xl', 'LOCAL', 'self_hosted_encrypted_key', true, NOW(), NOW())
ON CONFLICT ("tenantId") DO UPDATE
SET "provider" = 'LOCAL', "isActive" = true, "updatedAt" = NOW();
```

---

## 5. Multi-Agent System Integration

The OneAIAssist platform operates four autonomous agent lanes. Each lane now queries `http://ollama:11434/v1` through the unified router:

```
                  Incoming Inbound Message (WhatsApp / Email / Webchat)
                                            │
                                            ▼
                                  InboundJobWorker (Queue)
                                            │
                                            ▼
                                       AgentRouter
                                            │
                   ┌────────────────────────┴────────────────────────┐
                   ▼                                                 ▼
          NewCustomerAgent                                  ExistingCustomerAgent
    (Intake & Lead Qualification)                        (Policy Inquiries & Claims)
                   │                                                 │
                   └────────────────────────┬────────────────────────┘
                                            ▼
                                   RecommendationEngine
                                (Catalog & Quote Matching)
                                            │
                                            ▼
                           getTenantAIClient(tenantId)
                                            │
                                            ▼
                           http://ollama:11434/v1/chat/completions
```

1. **`NewCustomerAgent` (`whatsapp-engine/agents/NewCustomerAgent.ts`)**:
   - Manages multi-turn conversation turn-by-turn.
   - Prompts the user for Age, US State, Health Conditions, Monthly Budget, and Family Size.
   - Instructs `oneai-qwen` to output structured JSON:
     ```json
     [[INTAKE_DATA:{"age":34,"state":"FL","healthConditions":["None"],"budgetMin":150,"budgetMax":250,"familySize":3}]]
     ```
2. **`ExistingCustomerAgent` (`whatsapp-engine/agents/ExistingCustomerAgent.ts`)**:
   - Answers questions regarding active policies, renewal dates, and claims.
3. **`RecommendationEngine` (`whatsapp-engine/agents/RecommendationEngine.ts`)**:
   - Ranks policies from the agency catalog matching the customer's budget and state requirements.

---

## 6. Dashboard Settings UI Integration

In `components/settings-security-tab.tsx`, we integrated a dedicated card for the local model under **Dashboard &rarr; Settings &rarr; AI & API Keys**:

- **Visual Badge**: Shows `🟢 ACTIVE ENGINE • $0.00 BILLING`.
- **Endpoint Display**: Renders `http://ollama:11434/v1` with a pulsing green indicator.
- **1-Click Handshake Button**: When clicked, calls `/api/settings/keys` with `action: 'TEST_CONNECTION', provider: 'LOCAL'`, sending a test ping to `oneai-qwen` and displaying real-time latency (e.g. `240ms latency, $0.00 token cost`).
- **1-Click Activation**: Allows agency admins to switch between Local Qwen and Cloud APIs with a single click.

---

## 7. How to Test and Verify Integration via Terminal

### A. Test Direct Container-to-Container Network Connection:
```bash
ssh -i ~/.ssh/id_ed25519 root@167.233.103.156 "docker exec oneai-app curl -s http://ollama:11434/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"oneai-qwen\", \"messages\": [{\"role\": \"user\", \"content\": \"Say Ready\"}]}'"
```
*Expected Output*: Returns JSON containing `"content": "Ready"`.

### B. Test the Complete Node.js Agent Router (`lib/ai/client.ts`):
```bash
ssh -i ~/.ssh/id_ed25519 root@167.233.103.156 "docker exec oneai-app npx tsx -e '
import { getTenantAIClient } from \"./lib/ai/client\";
async function test() {
  const ai = await getTenantAIClient(\"tenant_pme_ff9xl\");
  const res = await ai.generateChat([{ role: \"user\", content: \"Who wrote Hamlet? Answer in 2 words.\" }]);
  console.log(\"Agent Output:\", res.trim());
}
test();
'"
```
*Expected Output*: `Agent Output: William Shakespeare`.
