import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { spawn } from 'child_process';
import { getAccessToken } from './token.js';

const PORT = parseInt(process.env.PORT || '3000');
const SECRET_TOKEN = process.env.SECRET_TOKEN;

// MCP Server setup
function createMcpServer() {
  const server = new Server(
    {
      name: 'github-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'shell',
        description: `Run shell commands with gh CLI authenticated to GitHub.

Available commands:
- gh repo clone <owner/repo> -- clone a repository
- gh issue list/view/create -- manage issues
- gh pr list/view/create -- manage pull requests
- gh project list/view -- view projects
- ls, cat, grep, find, etc. -- inspect cloned code

Workspace: /workspace (use this for cloning repos)

Example workflow:
  gh repo clone facebook/react
  cd /workspace/react
  ls -la src/
  cat src/index.js`,
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute',
            },
            cwd: {
              type: 'string',
              description: 'Working directory (default: /workspace)',
            },
          },
          required: ['command'],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'shell') {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    const { command, cwd = '/workspace' } = request.params.arguments as {
      command: string;
      cwd?: string;
    };

    try {
      const token = await getAccessToken();
      const output = await executeCommand(command, cwd, token);
      return {
        content: [{ type: 'text', text: output }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function executeCommand(
  command: string,
  cwd: string,
  token: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      env: {
        ...process.env,
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
        HOME: '/workspace',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout || stderr);
      } else {
        resolve(stdout + stderr || `Command exited with code ${code}`);
      }
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      child.kill();
      reject(new Error('Command timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

// HTTP server for SSE transport
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathToken = url.pathname.slice(1); // Remove leading /

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }

  // Validate secret token
  if (SECRET_TOKEN && pathToken !== SECRET_TOKEN) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Handle SSE connection
  if (req.method === 'GET') {
    const server = createMcpServer();
    const transport = new SSEServerTransport(url.pathname, res);
    await server.connect(transport);
    return;
  }

  // Handle POST for messages
  if (req.method === 'POST') {
    // SSE transport handles this via the connection
    res.writeHead(200);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

httpServer.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`);
  if (SECRET_TOKEN) {
    console.log(`Access URL: http://localhost:${PORT}/${SECRET_TOKEN}`);
  }
});
