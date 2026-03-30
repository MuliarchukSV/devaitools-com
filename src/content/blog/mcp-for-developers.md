---
title: "MCP for Developers: Extending AI with Custom Tools"
description: "Learn how to build MCP servers that give AI models access to databases, APIs, and custom tools. Includes TypeScript examples and architecture patterns."
pubDate: "2026-03-30"
author: "FlipFactory Editorial Team"
tags: ["mcp", "model-context-protocol", "ai-tools", "typescript"]
aiDisclosure: true
faq:
  - q: "What is MCP and why should developers care?"
    a: "MCP (Model Context Protocol) is an open standard by Anthropic that lets AI models call external tools -- databases, APIs, file systems -- through a unified protocol. It replaces custom function-calling implementations with a standardized approach that works across AI clients."
  - q: "Can MCP servers work with models other than Claude?"
    a: "Yes. MCP is an open protocol. While Anthropic created it, any AI client can implement MCP support. Claude Code, Cursor, VS Code Copilot Chat, and several open-source clients already support MCP servers."
---

## TLDR

Model Context Protocol (MCP) is the most significant development in AI tooling since function calling. Released by Anthropic in late 2024 and now adopted by major AI clients, MCP provides a standardized way to give AI models access to external tools, data sources, and services. Instead of building custom integrations for each AI provider, developers build one MCP server and it works everywhere. Over 3,000 MCP servers have been published to npm and the Smithery registry as of March 2026. This guide covers the protocol architecture, shows how to build a production MCP server in TypeScript, and shares patterns we have learned from deploying MCP in real projects.

## How MCP Works

MCP follows a client-server architecture. The AI application (Claude Code, Cursor, etc.) acts as an MCP client. Your code is the MCP server. Communication happens over stdio or HTTP using JSON-RPC.

```
[AI Client] <--JSON-RPC--> [MCP Server] <---> [Database/API/Service]
```

An MCP server exposes three primitives:

- **Tools** -- functions the AI can call (query database, send email, create file)
- **Resources** -- data the AI can read (file contents, database schemas, documentation)
- **Prompts** -- reusable prompt templates with parameters

When an AI model needs data or wants to perform an action, it discovers available tools from the MCP server and calls them with structured parameters. The server executes the request and returns results.

## Building Your First MCP Server

Here is a complete MCP server that provides a PostgreSQL query tool:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const server = new McpServer({
  name: "postgres-query",
  version: "1.0.0",
});

server.tool(
  "query",
  "Execute a read-only SQL query against the database",
  {
    sql: z.string().describe("SQL SELECT query to execute"),
  },
  async ({ sql }) => {
    if (!sql.trim().toUpperCase().startsWith("SELECT")) {
      return {
        content: [{ type: "text", text: "Error: Only SELECT queries allowed" }],
      };
    }
    const result = await pool.query(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

Register it in your AI client's configuration (`.mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["tsx", "postgres-mcp.ts"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/mydb"
      }
    }
  }
}
```

Now the AI can query your database directly, using natural language that gets translated into SQL.

## Production Patterns

**Input validation is mandatory.** Every tool should validate inputs with Zod or similar. MCP servers are attack surfaces -- an AI model might pass unexpected inputs, especially when processing untrusted user prompts.

**Keep tools focused.** A tool that does one thing well is more useful than a Swiss Army knife. Instead of a single `database` tool, expose `query_users`, `query_orders`, `get_schema` as separate tools. AI models make better decisions when tool names and descriptions are specific.

**Add resource endpoints for context.** Tools alone are not enough. Expose resources that give the AI model context about what is available:

```typescript
server.resource("schema", "database://schema", async () => ({
  contents: [
    {
      uri: "database://schema",
      text: await getSchemaDescription(),
      mimeType: "text/plain",
    },
  ],
}));
```

**Error handling matters.** Return structured error messages that help the AI model recover:

```typescript
server.tool("query", "...", { sql: z.string() }, async ({ sql }) => {
  try {
    const result = await pool.query(sql);
    return { content: [{ type: "text", text: JSON.stringify(result.rows) }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: `SQL Error: ${error.message}` }],
      isError: true,
    };
  }
});
```

## Real-World MCP Servers

The MCP ecosystem has grown rapidly. Some notable servers:

- **@modelcontextprotocol/server-postgres** -- official PostgreSQL integration
- **@modelcontextprotocol/server-github** -- GitHub API access (issues, PRs, repos)
- **mcp-server-playwright** -- browser automation through AI
- **server-sentry** -- error monitoring and issue triage
- **server-cloudflare** -- manage Workers, KV, D1 from AI

Teams building internal tools are the biggest adopters. An MCP server wrapping your internal API lets any developer query systems using natural language through their AI assistant.

## Security Considerations

MCP servers run with the permissions of the user who starts them. This means:

- A database MCP server has whatever database access the connection string grants
- A file system MCP server can read/write whatever the process user can access
- Network-accessible MCP servers need authentication (the HTTP transport supports OAuth)

Best practice: run MCP servers with minimal permissions, use read-only database connections where possible, and never expose MCP servers to untrusted networks without authentication.

## Getting Started Today

The fastest path to a working MCP server is the official SDK. Install `@modelcontextprotocol/sdk`, define your tools, and connect via stdio. The entire setup takes under 30 minutes for a simple server. For teams evaluating MCP, start with a read-only tool that exposes existing data -- a database schema viewer, a log searcher, or a documentation index. Once the team sees AI models using these tools effectively, the use cases expand naturally.
