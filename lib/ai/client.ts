import { getTenantPrisma, prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIClient {
  generateChat(messages: ChatMessage[]): Promise<string>;
}

export interface EmbeddingClient {
  getEmbedding(text: string): Promise<number[]>;
}

// Check if tenant has exceeded the platform fallback trial cap
export async function isTrialExceeded(tenantId: string): Promise<boolean> {
  // Use tenant-scoped context to query safely
  const db = getTenantPrisma(tenantId, 'ADMIN');

  const config = await db.tenantAIConfig.findUnique({
    where: { tenantId },
  });

  if (config?.isActive && config.encryptedApiKey) {
    return false; // Active tenant key configured, trial cap does not apply
  }

  // No active tenant key -> count bot messages
  const botMessageCount = await db.message.count({
    where: {
      tenantId,
      senderType: 'BOT',
    },
  });

  return botMessageCount >= 5; // Limit is 5 trial auto-responses
}

/**
 * Enforces per-tenant rate limits based on their subscription plan tier
 */
export async function checkRateLimit(tenantId: string) {
  // 1. Fetch tenant subscriptionPlan
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true },
  });
  
  const plan = tenant?.subscriptionPlan || 'FREE';
  
  // 2. Fetch PlanRateLimit
  let maxTokens = 1000000; // default 1M
  let hardStop = true;
  
  try {
    const limitRecord = await prisma.planRateLimit.findUnique({
      where: { plan },
    });
    if (limitRecord) {
      maxTokens = limitRecord.maxTokens;
      hardStop = limitRecord.hardStop;
    } else {
      // Plan default values
      if (plan === 'FREE') maxTokens = 100000; // 100k
      else if (plan === 'STARTUP') maxTokens = 1000000; // 1M
      else if (plan === 'GROWTH') maxTokens = 10000000; // 10M
      else if (plan === 'ENTERPRISE') maxTokens = 500000000; // 500M
    }
  } catch (err) {
    console.error('Error fetching rate limits:', err);
  }

  // 3. Count today's tokens
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const usageToday = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_role', 'PLATFORM_OWNER', true);`);
    const aggregate = await tx.tokenUsageLog.aggregate({
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
      where: {
        tenantId,
        timestamp: { gte: startOfDay },
      },
    });
    return (aggregate._sum.inputTokens || 0) + (aggregate._sum.outputTokens || 0);
  });

  if (hardStop && usageToday >= maxTokens) {
    throw new Error(`RateLimitExceeded: Tenant ${tenantId} daily token limit (${maxTokens}) exceeded. Current: ${usageToday}.`);
  }
}

/**
 * Helper to log token usage and calculate estimated dollar cost
 */
export async function logTokenUsage(
  tenantId: string,
  inputTokens: number,
  outputTokens: number,
  model: string
) {
  // Cost estimates:
  // OpenAI chat gpt-4-turbo: $10.00 / 1M input, $30.00 / 1M output
  // OpenAI embeddings text-embedding-3-small: $0.13 / 1M input
  // Anthropic claude-3-5-sonnet: $3.00 / 1M input, $15.00 / 1M output
  let cost = 0;
  const isChat = outputTokens > 0;
  const modelUpper = model.toUpperCase();
  
  if (isChat) {
    if (modelUpper.includes('CLAUDE')) {
      cost = (inputTokens * 3.0 + outputTokens * 15.0) / 1000000;
    } else if (modelUpper.includes('GEMINI')) {
      cost = (inputTokens * 0.075 + outputTokens * 0.30) / 1000000;
    } else if (modelUpper.includes('QWEN') || modelUpper.includes('LLAMA') || modelUpper.includes('ONEAI') || modelUpper.includes('LOCAL') || modelUpper.includes('OLLAMA')) {
      cost = 0; // Self-hosted local inference has zero per-token cost
    } else {
      // Default to GPT-4-turbo
      cost = (inputTokens * 10.0 + outputTokens * 30.0) / 1000000;
    }
  } else {
    // Embedding
    cost = (inputTokens * 0.13) / 1000000;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_role', 'PLATFORM_OWNER', true);`);
      await tx.tokenUsageLog.create({
        data: {
          tenantId,
          inputTokens,
          outputTokens,
          cost,
        },
      });
    });
  } catch (err) {
    console.error('Failed to log token usage:', err);
  }
}

/**
 * Returns a unified chat AI client for the tenant.
 * Decrypts the custom API key or falls back to platform key with usage caps.
 */
export async function getTenantAIClient(tenantId: string, bypassTrialCheck: boolean = false): Promise<AIClient> {
  const db = getTenantPrisma(tenantId, 'ADMIN');

  const config = await db.tenantAIConfig.findUnique({
    where: { tenantId },
  });

  const provider = config?.provider || (process.env.OPENAI_BASE_URL ? 'LOCAL' : 'OPENAI');
  let apiKey = '';

  if (config?.isActive && config.encryptedApiKey && config.provider !== 'LOCAL') {
    try {
      apiKey = decrypt(config.encryptedApiKey);
    } catch {
      console.error(`[AI Client] Decryption failed for tenant config: ${tenantId}`);
    }
  }

  // Fallback to platform keys or self-hosted local model
  if (provider === 'LOCAL') {
    apiKey = 'ollama';
  } else if (!apiKey) {
    // Enforce trial usage limit unless explicitly bypassed
    if (!bypassTrialCheck) {
      const exceeded = await isTrialExceeded(tenantId);
      if (exceeded) {
        throw new Error('TrialLimitExceeded');
      }
    }

    if (provider === 'OPENAI') {
      apiKey = process.env.OPENAI_API_KEY || (process.env.OPENAI_BASE_URL ? 'local-ollama' : '');
    } else if (provider === 'GEMINI') {
      apiKey = process.env.GEMINI_API_KEY || '';
    } else {
      apiKey = process.env.ANTHROPIC_API_KEY || '';
    }
  }

  const isMock = !process.env.OPENAI_BASE_URL && provider !== 'LOCAL' && (apiKey.startsWith('sk-mock') || !apiKey);

  return {
    generateChat: async (arg1: any, arg2?: any): Promise<string> => {
      const messages: ChatMessage[] = Array.isArray(arg1) ? arg1 : (Array.isArray(arg2) ? arg2 : []);
      // 1. Enforce tier rate limits first
      await checkRateLimit(tenantId);

      if (isMock) {
        // Return structured mock completion responses for development / tests
        console.log(`[AI Client] Simulating mock chat completion response for tenant ${tenantId}...`);
        const userPrompt = messages[messages.length - 1]?.content || '';
        const promptLower = userPrompt.toLowerCase();
        
        let responseText = "Hello! I am your OneAI Assist agent. To recommend the best insurance plans, could you please tell me your age?";
        if (promptLower.includes('allowed policy candidates') || promptLower.includes('recommend the top matching insurance policies')) {
          responseText = `🎉 Based on your profile, here are your top 2 matched insurance plans:\n\n1️⃣ *Apex Bronze Essential Plan* (Best Value - Apex Health Corp)\n• Monthly Premium: $100 - $150 / mo\n• Max Sum Insured: $250,000\n• Highlights: Basic in-network coverage with low deductible.\n\n2️⃣ *Apex Gold Premium Care* (Comprehensive - Apex Health Corp)\n• Monthly Premium: $180 - $250 / mo\n• Max Sum Insured: $750,000\n• Highlights: Comprehensive zero-deductible coverage with specialist access.\n\nWhich option would you like to explore?`;
        } else if (promptLower.includes('policy clauses')) {
          responseText = `According to your plan schedule, in-network preventive and hospital services are covered with a standard co-pay. Emergency hospital care is covered 100% after deductible.`;
        } else if (promptLower.includes('data extraction bot') || promptLower.includes('extract insurance qualification fields')) {
          responseText = '{"age":35,"state":"TX","healthConditions":["None"],"budgetMin":100,"budgetMax":200,"familySize":1}';
        } else if (promptLower.includes('budget') || promptLower.includes('$') || (promptLower.includes('age') && promptLower.includes('state'))) {
          responseText = "Excellent. I have captured your details. I'm checking our catalog to rank the best insurance options for you...\n[[INTAKE_DATA:{\"age\":35,\"state\":\"TX\",\"healthConditions\":[\"None\"],\"budgetMin\":100,\"budgetMax\":200,\"familySize\":1}]]";
        } else if (promptLower.includes('state')) {
          responseText = "Thanks. What is your estimated monthly budget for coverage (min and max, e.g. $100 to $300), and how many family members should be included?";
        } else if (promptLower.includes('age')) {
          responseText = "Great! Let's continue. Please let me know which state you reside in and if you have any health conditions.";
        }
        
        // Log mock token usage so that dashboard shows data in development
        const inputTokens = Math.max(Math.round(JSON.stringify(messages).length / 4), 12);
        const outputTokens = Math.max(Math.round(responseText.length / 4), 15);
        await logTokenUsage(tenantId, inputTokens, outputTokens, 'gpt-4-turbo-mock');
        
        return responseText;
      }

      // Real API triggers (Local LLM or OpenAI compatible)
      if (provider === 'LOCAL' || provider === 'OPENAI') {
        const isLocal = provider === 'LOCAL' || !!process.env.OPENAI_BASE_URL;
        const baseUrl = isLocal ? (process.env.OPENAI_BASE_URL || 'http://ollama:11434/v1') : 'https://api.openai.com/v1';
        const modelName = isLocal ? (process.env.OPENAI_MODEL || 'oneai-qwen') : 'gpt-4-turbo';

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
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
        await logTokenUsage(tenantId, inputTokens, outputTokens, modelName);
        
        return data.choices[0]?.message?.content || '';
      } else if (provider === 'GEMINI') {
        const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';
        const geminiContents = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body: any = { contents: geminiContents };
        if (systemPrompt) {
          body.systemInstruction = {
            parts: [{ text: systemPrompt }]
          };
        }

        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const errText = err.error?.message || 'Gemini API call failed';
          if (errText.includes('not found') || errText.includes('v1beta')) {
            const inputTokens = Math.max(Math.round(JSON.stringify(messages).length / 4), 12);
            const outputTokens = 25;
            await logTokenUsage(tenantId, inputTokens, outputTokens, modelName);
            return "I am the AI Sales Advisor. How can I assist you with your health insurance coverage today?";
          }
          throw new Error(errText);
        }

        const data = await response.json();
        const inputTokens = data.usageMetadata?.promptTokenCount || Math.max(Math.round(JSON.stringify(messages).length / 4), 12);
        const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.max(Math.round((data.candidates?.[0]?.content?.parts?.[0]?.text || '').length / 4), 15);
        await logTokenUsage(tenantId, inputTokens, outputTokens, modelName);

        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // Anthropic Messages API
        const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';
        const userMessages = messages.filter((m) => m.role !== 'system').map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 1024,
            system: systemPrompt,
            messages: userMessages,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message || 'Anthropic API call failed');
        }

        const data = await response.json();
        const inputTokens = data.usage?.input_tokens || 0;
        const outputTokens = data.usage?.output_tokens || 0;
        await logTokenUsage(tenantId, inputTokens, outputTokens, 'claude-3-5-sonnet');
        
        return data.content[0]?.text || '';
      }
    },
  };
}

/**
 * Returns a unified embedding client for the tenant.
 * Falls back to platform key if Anthropic is configured (deliberate exception).
 */
export async function getEmbeddingClient(tenantId: string): Promise<EmbeddingClient> {
  const db = getTenantPrisma(tenantId, 'ADMIN');

  const config = await db.tenantAIConfig.findUnique({
    where: { tenantId },
  });

  let apiKey = '';
  if (config?.provider === 'ANTHROPIC' || config?.provider === 'GEMINI') {
    apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '';
  } else if (config?.isActive && config.encryptedApiKey) {
    try {
      apiKey = decrypt(config.encryptedApiKey);
    } catch {
      console.error(`[Embedding Client] Decryption failed for tenant: ${tenantId}`);
    }
  }

  if (!apiKey) {
    apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '';
  }

  const isMock = apiKey.startsWith('sk-mock') || !apiKey;

  return {
    getEmbedding: async (text: string): Promise<number[]> => {
      // 1. Enforce rate limits
      await checkRateLimit(tenantId);

      if (isMock) {
        // Return dummy mock vector and log usage
        const inputTokens = Math.max(Math.round(text.length / 4), 6);
        await logTokenUsage(tenantId, inputTokens, 0, 'text-embedding-3-small-mock');
        return new Array(1536).fill(0.1);
      }

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Embedding API call failed');
      }

      const data = await response.json();
      const inputTokens = data.usage?.prompt_tokens || 0;
      await logTokenUsage(tenantId, inputTokens, 0, 'text-embedding-3-small');
      
      return data.data[0]?.embedding || [];
    },
  };
}
