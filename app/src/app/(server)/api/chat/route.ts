import { getMcpPrompts } from '@/lib/gateway/inspect-mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  convertToModelMessages,
  experimental_createMCPClient as createMCPClient,
  streamText,
  UIMessage,
  ToolSet,
  generateObject,
  createUIMessageStream,
  createUIMessageStreamResponse
} from 'ai';
import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';
import { createHash } from 'crypto';
import { getKVConfig } from '@/lib/gateway/env';
import { z } from 'zod';
import type { MCPClient } from '@/types/mcp';
import { DEPLOYMENT_URL } from "vercel-url";


// Type definitions for MCP data
interface McpPrompt {
  name: string;
  description?: string;
  content: string;
  messages: unknown[];
}

interface McpPromptsResponse {
  prompts: McpPrompt[];
}

interface CachedMcpData {
  prompts: McpPromptsResponse;
  tools: ToolSet;
}

// Allow streaming responses up to 30 seconds
export const maxDuration = 800;

const CACHE_TTL = 300; // 5 minutes in seconds

// Initialize KV client with configuration from env.ts
const kvConfig = getKVConfig();
const kv = createClient({
  url: kvConfig.restApiUrl,
  token: kvConfig.restApiToken,
});

function getCacheKey(mcpUrl: string): string {
  // Create a stable cache key from the URL
  const hash = createHash('md5').update(mcpUrl).digest('hex');
  return `mcp_data:${hash}`;
}

// Create MCP client efficiently for serverless environment
// Includes Better Auth session cookies by forwarding the incoming request cookies
async function createOptimizedMcpClient(
  mcpUrl: string,
  requestHeaders?: Headers
): Promise<{ client: MCPClient; tools: ToolSet }> {
  console.log('Chat API: Creating optimized MCP client for serverless');

  try {
    const cookieHeader = requestHeaders?.get('cookie');
    const outboundHeaders: Record<string, string> = {};
    if (cookieHeader) {
      outboundHeaders['cookie'] = cookieHeader;
    }

    // Use Streamable HTTP transport which is more efficient for serverless
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: {
        headers: outboundHeaders,
        credentials: 'include',
      },
    });
    const client = await createMCPClient({ transport });
    const tools = await client.tools();

    return { client, tools };
  } catch (error) {
    console.error('Chat API: Failed to create MCP client:', error);
    throw error;
  }
}

async function getCachedMcpData(mcpUrl: string, requestHeaders?: Headers): Promise<CachedMcpData> {
  const promptsCacheKey = `${getCacheKey(mcpUrl)}_prompts`;

  try {
    // Check for cached prompts first
    const cachedPrompts = await kv.get(promptsCacheKey);

    if (cachedPrompts) {
      console.log('Chat API: Using cached prompts, creating fresh MCP client');

      // Always create fresh client for tools (tools are hard to serialize reliably)
      const { tools } = await createOptimizedMcpClient(mcpUrl, requestHeaders);

      return {
        prompts: cachedPrompts as McpPromptsResponse,
        tools
      };
    }

    console.log('Chat API: Fetching fresh MCP data');

    // Fetch fresh data in parallel
    const [prompts, mcpClientResult] = await Promise.all([
      getMcpPrompts(mcpUrl),
      createOptimizedMcpClient(mcpUrl, requestHeaders)
    ]);

    const { tools } = mcpClientResult;

    // Cache prompts only (tools are recreated each time for reliability)
    await kv.set(promptsCacheKey, prompts, { ex: CACHE_TTL });

    console.log(`Chat API: Cached prompts for ${CACHE_TTL} seconds`);

    return { prompts, tools };
  } catch (error) {
    console.error('Chat API: Cache error, falling back to fresh data:', error);

    // Fallback to fresh data if cache fails
    const [prompts, mcpClientResult] = await Promise.all([
      getMcpPrompts(mcpUrl),
      createOptimizedMcpClient(mcpUrl, requestHeaders)
    ]);

    const { tools } = mcpClientResult;

    return { prompts, tools };
  }
}

export async function POST(req: Request) {
  console.log('Chat API: POST request received');
  try {
    const { messages, sessionId }: { messages: UIMessage[], sessionId?: string } = await req.json();
    console.log('Chat API: Messages received:', messages);

    console.log('Chat API: Session ID:', sessionId);

    // TODO: remove the hardcoded API key
    const mcpUrl = `${DEPLOYMENT_URL}/mcp/73b54493-048d-4433-8687-fdf2dc1ebf4d`;

    const { prompts, tools } = await getCachedMcpData(mcpUrl, req.headers);

    // find system prompt  
    const systemPrompt = prompts.prompts.find((prompt: McpPrompt) => prompt.name === "system");

    const modelMessages = convertToModelMessages(messages);

    const stream = createUIMessageStream({
      execute: ({ writer }) => {

        let _sessionId = "";
        const result = streamText({
          system: systemPrompt?.content || "You are a helpful assistant.",
          model: "openai/gpt-4o",
          messages: modelMessages,
          tools,
          onStepFinish: async ({ toolResults, toolCalls, usage, finishReason }) => {
            toolResults.forEach(async (toolResult) => {
              if (toolResult.toolName === 'create_session') {
                const result = await generateObject({
                  model: "openai/gpt-4o-mini",
                  schema: z.object({
                    sessionId: z.string().min(1).describe("The session ID of the chat"),
                  }),
                  prompt: `Extract the session ID from this tool result. Return only the session ID value as a string: ${JSON.stringify(toolResult.output)}`,
                });

                // Stream the session ID back to the client
                writer.write({
                  type: 'data-session',
                  data: { sessionId: result.object.sessionId },
                });

                writer.write({
                  type: 'data-payment',
                  data: { paid: true },
                });

                _sessionId = result.object.sessionId;
              }
              if (toolResult.toolName === 'preview') {
                const result = await generateObject({
                  model: "openai/gpt-4o-mini",
                  schema: z.object({
                    url: z.string().min(1).describe("The URL of the preview")
                  }),
                  prompt: `Extract the preview URL from the tool result: ${JSON.stringify(toolResult.output, null, 2)}`,
                });

                writer.write({
                  type: 'data-preview',
                  data: { url: result.object.url },
                });

                writer.write({
                  type: 'data-payment',
                  data: { paid: true },
                });
              }
            });
          },
          stopWhen: ({ steps }) => {
            return steps.length === 10;
          },
          onFinish: async ({ toolResults, toolCalls, usage, finishReason }) => {
            console.log('Chat API: Finish reason:', finishReason);
            console.log('Chat API: Session ID:', _sessionId, sessionId);
            if (tools && tools["get_all_codebase"] && tools["get_all_codebase"].execute && (_sessionId || sessionId)) {
              const codebaseResult = await tools["get_all_codebase"].execute({
                sessionId: _sessionId || sessionId,
              }, { toolCallId: "", messages: [] });

              // Parse the codebase data from the content text
              if (codebaseResult.content && codebaseResult.content[0] && codebaseResult.content[0].text) {
                try {
                  const codebase = codebaseResult.content[0].text;
                  writer.write({
                    type: 'data-codebase',
                    data: { codebase },
                  });
                } catch (error) {
                  console.error('Error parsing codebase result:', error);
                }
              }
            }
          },
        });

        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}