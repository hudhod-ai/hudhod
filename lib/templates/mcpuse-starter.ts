import type { FileSystemTree } from "@webcontainer/api";

const packageJson = `{
  "name": "my-mcpuse-server",
  "type": "module",
  "engines": {
    "node": ">=22.22.2"
  },
  "version": "1.0.0",
  "description": "an mcp-use server with React views for MCP Apps",
  "author": "mcp-use",
  "license": "MIT",
  "homepage": "https://github.com/mcp-use/mcp-use",
  "keywords": [
    "mcp",
    "mcp-server",
    "chatgpt plugins",
    "claude connector",
    "mcp-app",
    "mcp-use",
    "manufact"
  ],
  "scripts": {
    "build": "mcp-use build",
    "dev": "mcp-use dev",
    "start": "mcp-use start",
    "deploy": "mcp-use deploy",
    "typecheck": "mcp-use typecheck"
  },
  "dependencies": {
    "mcp-use": "2.3.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.20.0",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "typescript": "^7.0.2"
  }
}
`;

const indexTs = `import { MCPServer } from "mcp-use";
import { z } from "zod";

const server = new MCPServer({
  name: "my-mcpuse-server",
  title: "my-mcpuse-server", // Human readable name of the server
  version: "1.0.0",
  description: "an mcp-use app",
  instructions: "use show-app to open the app view", // Model-facing guidance — surfaced to the LLM by compatible clients.
  websiteUrl: "https://mcp-use.com",
  // Icons for your MCP Server, from public/ (or absolute URLs).
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],

  // The MCP server is by default served at /mcp, to customise
  // basePath: "/mcp",

  // mcp-use has 1 line adapter for OAuth, import from mcp-use/oauth/*
  // oauth: oauthClerkProvider(), // zero-config via MCP_USE_OAUTH_CLERK_FRONTEND_API_URL, import from mcp-use/oauth/*

  // When OAuth is on, the HTML landing page (/mcp) is protected by default, set to true to keep the landing page public while /mcp stays bearer-protected.
  // publicLandingPage: true,
});

// say-hello — plain tool (no view); used by the Say Hello button in my-view
const sayHelloInputSchema = z.object({
  name: z.string().describe("Name to greet"),
});

const sayHelloOutputSchema = z.object({
  greeting: z.string().describe("Greeting to display"),
});

export const sayHello = server.tool(
  {
    name: "say-hello",
    title: "Say hello",
    description: "Returns a greeting for the Say Hello button demo",
    inputSchema: sayHelloInputSchema,
    outputSchema: sayHelloOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ name }) => {
    const data = { greeting: \`Hello, \${name}!\` };
    return {
      content: [{ type: "text", text: data.greeting }],
      structuredContent: data,
    };
  },
);

export default server;
`;

const tsconfigJson = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true
  }
}
`;

export const mcpUseStarterTree: FileSystemTree = {
  "package.json": { file: { contents: packageJson } },
  "tsconfig.json": { file: { contents: tsconfigJson } },
  "index.ts": { file: { contents: indexTs } },
};
