// VERSION = 'v1.2.0';

// 模型映射表 - 自定义模型名字:实际模型名
const MODELS = {
    'gpt-4o-mini': 'gpt-4o-mini',
    'claude-3-haiku-20240307': 'claude-3-haiku-20240307',
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    'mistralai/Mixtral-8x7B-Instruct-v0.1': 'mistralai/Mixtral-8x7B-Instruct-v0.1'
};

// DuckDuckGo API 端点
const DDGAPI_ENDPOINTS = {
    STATUS: 'https://duckduckgo.com/duckchat/v1/status',  // 获取VQD令牌
    CHAT: 'https://duckduckgo.com/duckchat/v1/chat'       // 聊天API端点
};

// DuckDuckGo API 请求默认头部
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': 'https://duckduckgo.com/',
    'Cache-Control': 'no-store',
    'x-vqd-accept': '1',
    'Connection': 'keep-alive',
    'Cookie': 'dcm=3',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Priority': 'u=4',
    'Pragma': 'no-cache',
    'TE': 'trailers'
};

// ===== 错误处理 =====
// 自定义API错误类
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// 将错误信息模板
function formatErrorResponse(status, message, type = 'api_error') {
    return {
        error: {
            message: message,
            type: type,
            code: status,
            param: null,
        }
    };
}

// ===== 工具函数 =====
// 格式化响应为OpenAI API格式
function formatOpenAIResponse(assistantMessage, modelName) {
    return {
        id: 'chatcmpl-' + Math.random().toString(36).slice(2, 11),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: modelName,
        choices: [{
            index: 0,
            message: {role: 'assistant', content: assistantMessage},
            finish_reason: 'stop'
        }]
    };
}

// 格式化流式响应的数据块
function formatStreamingChunk(messageContent, isLastChunk = false, modelName) {
    const chunk = {
        id: 'chatcmpl-' + Math.random().toString(36).slice(2, 11),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelName,
        choices: [{
            index: 0,
            delta: isLastChunk ? {} : {content: messageContent},
            finish_reason: isLastChunk ? 'stop' : null
        }]
    };
    return `data: ${JSON.stringify(chunk)}\n\n`;
}

// ===== DuckDuckGo API 相关函数 =====
// 获取DuckDuckGo VQD令牌
async function getDuckVQDToken(requestHeaders) {
    const statusResponse = await fetch(DDGAPI_ENDPOINTS.STATUS, {headers: requestHeaders});
    if (!statusResponse.ok) {
        throw new ApiError(500, `DuckDuckGo status API failed with ${statusResponse.status}`);
    }
    return statusResponse.headers.get('x-vqd-4');
}

// ===== 处理和格式化消息 =====
function processMessages(messages) {
    const validRoles = new Set(['user', 'assistant', 'system']);
    const results = [];

    for (const msg of messages) {
        if (msg?.content && validRoles.has(msg.role)) {
            const content = Array.isArray(msg.content)
                ? msg.content.reduce((acc, item) => item?.text ? acc + item.text : acc, '')
                : msg.content;

            if (content.trim()) {
                results.push(`${msg.role === 'system' ? 'user' : msg.role}: ${content}`);
            }
        }
    }

    return results.join('\n');
}

// ===== 统一的响应处理函数 =====
async function handleResponse(response, options = {}) {
    const {stream = false, modelName = null} = options;

    if (stream) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    const reader = response.body.getReader();
                    let partialLine = '';
                    while (true) {
                        const {done, value} = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, {stream: true});
                        partialLine += chunk;

                        let lines = partialLine.split('\n');
                        partialLine = lines.pop(); // 保留未完成的行
                        for (const line of lines) {
                            if (!line.trim() || !line.startsWith('data: ')) continue;

                            const content = line.slice(6);
                            if (content === '[DONE]') {
                                controller.enqueue(encoder.encode(formatStreamingChunk('', true, modelName)));
                                controller.close();
                                return;
                            }

                            try {
                                const data = JSON.parse(content);
                                // 处理错误响应
                                if (data.action === 'error') {
                                    const errorResponse = formatErrorResponse(
                                        data.status, 
                                        `DuckDuckGo Error: ${data.type}`, 
                                        "duck_error"
                                    );
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorResponse)}\n\n`));
                                    controller.close();
                                    return;
                                }
                                if (data.message) {
                                    controller.enqueue(encoder.encode(formatStreamingChunk(data.message, false, modelName)));
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                    // 处理可能剩余的部分数据
                    if (partialLine && partialLine.startsWith('data: ')) {
                        const content = partialLine.slice(6);
                        if (content !== '[DONE]') {
                            try {
                                const data = JSON.parse(content);
                                if (data.message) {
                                    controller.enqueue(encoder.encode(formatStreamingChunk(data.message, false, modelName)));
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                    controller.enqueue(encoder.encode(formatStreamingChunk('', true, modelName)));
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            }
        });
        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });
    } else {
        const responseText = await response.text();
        const assistantMessages = responseText.split('\n')
            .map(line => {
                if (!line.trim() || !line.startsWith('data: ')) return '';
                try {
                    const jsonStr = line.slice(6);
                    if (jsonStr === '[DONE]') return '';
                    const data = JSON.parse(jsonStr);
                    return data.message || '';
                } catch {
                    return '';
                }
            })
            .filter(message => message)
            .join('');

        return formatOpenAIResponse(assistantMessages || responseText, modelName);
    }
}

// 发送聊天消息到DuckDuckGo
async function sendDuckChatMessage(messages, modelName) {
    if (!messages?.length) {
        throw new ApiError(400, "Messages array is required and cannot be empty");
    }

    const actualModelName = MODELS[modelName];

    if (!actualModelName) {
        throw new ApiError(400, `Invalid model name: ${modelName}`);
    }

    try {
        const headers = {
            ...DEFAULT_HEADERS,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'x-vqd-4': await getDuckVQDToken(DEFAULT_HEADERS)
        };

        const content = processMessages(messages);

        return await fetch(DDGAPI_ENDPOINTS.CHAT, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: actualModelName,
                messages: [{
                    role: 'user',
                    content
                }]
            })
        });

    } catch (error) {
        if (!(error instanceof ApiError)) {
            throw new ApiError(500, `Chat request failed: ${error.message}`);
        }
        throw error;
    }
}

// ===== 验证 API 密钥 =====
function validateApiKey(request, env) {
    const API_KEYS = new Set(env?.API_KEYS ? env?.API_KEYS.split(',') : []);

    if (API_KEYS.size === 0) return true;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return false;
    }

    const [bearer, apiKey] = authHeader.split(' ');
    return !(bearer !== 'Bearer' || !apiKey || !API_KEYS.has(apiKey));


}

// ===== 处理请求 =====
async function handleRequest(request, env) {
    const url = new URL(request.url);
    const {pathname} = url;

    // 更新 CORS 预检请求处理
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*',  // 允许所有请求头
                'Access-Control-Expose-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            },
            status: 204
        });
    }

    // 更新通用 CORS 头
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Expose-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
    };


    // 验证 API 密钥
    if (!validateApiKey(request, env)) {
        return new Response(
            JSON.stringify(formatErrorResponse(401, "Invalid API key", "auth_error")), 
            {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                }
            }
        );
    }

    try {
        if (request.method === 'GET' && pathname === '/v1/models') {
            // 获取可用模型列表
            const models = {
                object: 'list',
                data: Object.keys(MODELS).map(modelName => ({
                    id: modelName,
                    object: 'model',
                    owned_by: 'duckduckgo',
                }))
            };
            return new Response(JSON.stringify(models), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                }
            });
        } else if (request.method === 'POST' && pathname === '/v1/chat/completions') {
            const contentType = request.headers.get('Content-Type') || '';
            if (!contentType.includes('application/json')) {
                return new Response(
                    JSON.stringify(formatErrorResponse(400, "Content-Type must be application/json", "invalid_request_error")),
                    {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        }
                    }
                );
            }

            const body = await request.json();
            const {messages, model, stream = false} = body;

            if (!messages?.length) {
                return new Response(
                    JSON.stringify(formatErrorResponse(400, "Messages is required and must be a non-empty array", "invalid_request_error")),
                    {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        }
                    }
                );
            }

            if (!model || !MODELS.hasOwnProperty(model)) {
                const errorMsg = `Please select the correct model: ${Object.keys(MODELS).join(', ')}`;
                return new Response(
                    JSON.stringify(formatErrorResponse(400, errorMsg, "invalid_request_error")),
                    {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        }
                    }
                );
            }

            const chatResponse = await sendDuckChatMessage(messages, model);

            if (stream) {
                const response = await handleResponse(chatResponse, {stream: true, modelName: model});
                response.headers.set('Access-Control-Allow-Origin', '*');
                return response;
            } else {
                const responseData = await handleResponse(chatResponse, {modelName: model});
                return new Response(JSON.stringify(responseData), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    }
                });
            }
        } else {
            return new Response(JSON.stringify({error: 'Not Found'}), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                }
            });
        }
    } catch (error) {
        const status = error.status || 500;
        const message = error.message || 'Internal Server Error';
        
        return new Response(
            JSON.stringify(formatErrorResponse(status, message)),
            {
                status: status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                }
            }
        );
    }
}

// ===== 监听 Fetch 事件 =====
export default {
    async fetch(request, env, ctx) {
        return await handleRequest(request, env);
    }
};