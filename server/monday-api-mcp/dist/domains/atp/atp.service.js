"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAtpMcpServer = runAtpMcpServer;
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const atp_consts_js_1 = require("./atp.consts.js");
// Dynamic imports required: ATP packages are ESM, this package is CJS
async function loadAtpDependencies() {
    const { createServer } = await import('@mondaydotcomorg/atp-server');
    const { AgentToolProtocolClient, ToolNames } = await import('@mondaydotcomorg/atp-client');
    const { registerToolsWithMCP } = await import('@mondaydotcomorg/atp-mcp-adapter');
    return { createServer, AgentToolProtocolClient, ToolNames, registerToolsWithMCP };
}
function getToolDescriptions(ToolNames) {
    return {
        [String(ToolNames.EXECUTE_CODE)]: atp_consts_js_1.TOOL_DESCRIPTIONS.execute_code,
        [String(ToolNames.EXPLORE_API)]: atp_consts_js_1.TOOL_DESCRIPTIONS.explore_api,
    };
}
function filterAndEnhanceTools(tools, toolDescriptions) {
    return tools
        .filter((tool) => tool.name in toolDescriptions)
        .map((tool) => ({
        ...tool,
        description: toolDescriptions[tool.name],
    }));
}
function initAtpServer(createServer) {
    return createServer({ logger: 'none' });
}
async function loadMondaySchema(server, token, version) {
    const apiVersion = version ?? atp_consts_js_1.DEFAULT_API_VERSION;
    await server.loadGraphQL((0, atp_consts_js_1.getMondaySchemaUrl)(apiVersion), {
        name: atp_consts_js_1.MONDAY_API_NAME,
        url: atp_consts_js_1.MONDAY_API_BASE_URL,
        headers: {
            Authorization: token,
            'API-Version': apiVersion,
        },
        queryDepthLimit: atp_consts_js_1.QUERY_DEPTH_LIMIT,
    });
}
async function initAtpClient(AgentToolProtocolClient, server) {
    const client = new AgentToolProtocolClient({ server });
    await client.init({ name: 'monday-api-mcp', version: '1.0.0' });
    return client;
}
function createMcpServer() {
    return new mcp_js_1.McpServer({
        name: atp_consts_js_1.ATP_SERVER_NAME,
        version: atp_consts_js_1.ATP_SERVER_VERSION,
    }, {
        capabilities: {
            tools: {},
        },
    });
}
async function runAtpMcpServer(config) {
    const { token, version } = config;
    const { createServer, AgentToolProtocolClient, ToolNames, registerToolsWithMCP } = await loadAtpDependencies();
    const server = initAtpServer(createServer);
    await loadMondaySchema(server, token, version);
    const client = await initAtpClient(AgentToolProtocolClient, server);
    const mcpServer = createMcpServer();
    const toolDescriptions = getToolDescriptions(ToolNames);
    const atpTools = filterAndEnhanceTools(client.getATPTools(), toolDescriptions);
    registerToolsWithMCP(atpTools, mcpServer);
    const transport = new stdio_js_1.StdioServerTransport();
    await mcpServer.connect(transport);
}
