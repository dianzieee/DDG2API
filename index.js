import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
import createError from 'http-errors';


dotenv.config();

const VERSION = '1.0.0';

// ===== 常量定义 =====
// 开放端口
const PORT = process.env.PORT || 3000;
// API 密钥
const API_KEYS = new Set(process.env.API_KEYS ? process.env.API_KEYS.split(',') : []);
// DEBUG 模式
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
// 模型映射
const MODELS = {
    'gpt-4o-mini': 'gpt-4o-mini',
    'claude-3-haiku-20240307': 'claude-3-haiku-20240307',
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    'mistralai/Mixtral-8x7B-Instruct-v0.1': 'mistralai/Mixtral-8x7B-Instruct-v0.1'
};
// DuckDuckGo 端点
const DDGAPI_ENDPOINTS = {
    STATUS: 'https://duckduckgo.com/duckchat/v1/status',  // 获取VQD令牌
    CHAT: 'https://duckduckgo.com/duckchat/v1/chat'       // 聊天API端点
};

// 用于向 DuckDuckGo 发送请求的默认头部
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

// ===== 工具函数 =====
// 获取当前时间 
function getFormattedTime() {
    return new Date().toISOString();
}
// 错误响应模板
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

// 格式化为 OpenAI 标准响应 [非流式]
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

// 格式化为 OpenAI 标准响应 [流式]
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

// 获取DuckDuckGo VQD令牌
async function getDuckVQDToken(requestHeaders) {
    const statusResponse = await fetch(DDGAPI_ENDPOINTS.STATUS, {headers: requestHeaders});
    if (!statusResponse.ok) {
        throw createError(500, `DuckDuckGo status API failed with ${statusResponse.status}`);
    }
    return statusResponse.headers.get('x-vqd-4');
}

// 将客户端发送的消息数组拼接为 DuckDuckGo 能处理的消息格式
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

// 统一响应处理函数
async function handleResponse(response, options = {}) {
    const {stream = false, res = null, modelName = null} = options;

    if (stream && res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for await (const chunk of response.body) {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (!line.trim() || !line.startsWith('data: ')) continue;

                const content = line.slice(6);
                if (content === '[DONE]') {
                    res.write(formatStreamingChunk('', true, modelName));
                    return res.end();
                }

                try {
                    const data = JSON.parse(content);
                    // 处理错误响应
                    if (data.action === 'error') {
                        const errorResponse = formatErrorResponse(data.status, `DuckDuckGo Error: ${data.type}`, "duck_error");
                        res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
                        return res.end();
                    }
                    if (data.message) {
                        res.write(formatStreamingChunk(data.message, false, modelName));
                    }
                } catch (error) {
                    if (DEBUG_MODE) {
                        console.error(`[${getFormattedTime()}] Error:`, error);
                    }
                }
            }
        }
    } else {
        const responseText = await response.text();
        const lines = responseText.split('\n');
        let fullMessage = '';
        let errorFound = false;
        
        for (const line of lines) {
            if (!line.trim() || !line.includes('data: ')) continue;
            try {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') continue;
                
                const data = JSON.parse(jsonStr);
                // 处理错误响应
                if (data.action === 'error') {
                    errorFound = true;
                    throw createError(data.status, `DuckDuckGo Error: ${data.type}`);
                }
                if (data.message) {
                    fullMessage += data.message; // 累积所有消息片段
                }
            } catch (e) {
                if (errorFound) throw e;
            }
        }
        return fullMessage || responseText; // 返回完整消息
    }
}

// 发送聊天消息到DuckDuckGo
async function sendDuckChatMessage(messages, modelName) {
    if (!messages?.length) {
        throw createError(400, "Messages array is required and cannot be empty");
    }

    const actualModelName = MODELS[modelName];

    if (!actualModelName) {
        throw createError(400, `Invalid model name: ${modelName}`);
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
        if (!error.status) {
            throw createError(500, `DuckDuckGo Error: ${error.message}`);
        }
        throw error;
    }
}

// API密钥验证中间件
const validateApiKey = (req, res, next) => {
    if (API_KEYS.size === 0) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        if (DEBUG_MODE) {
            console.error(`[${getFormattedTime()}] Error 401: Missing Authorization header`);
        }
        return res.status(401).json(formatErrorResponse(401, "Missing Authorization header", "auth_error"));
    }

    const [bearer, apiKey] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !apiKey || !API_KEYS.has(apiKey)) {
        if (DEBUG_MODE) {
            console.error(`[${getFormattedTime()}] Error 401: Invalid API key`);
        }
        return res.status(401).json(formatErrorResponse(401, "Invalid API key", "auth_error"));
    }

    next();
};

// Express 应用初始化
const app = express();
app.use(express.json());
//Cors 请求头
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: '*',  // 接受所有请求头
    exposedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
    preflightContinue: false,
}));
app.options('*', cors());

// v1/models 路由
app.get('/v1/models', validateApiKey, (req, res) => {
    res.json({
        object: "list",
        data: Object.keys(MODELS).map(modelName => ({
            id: modelName,
            object: "model",
            owned_by: "duckduckgo",
        }))
    });
});

// v1/chat/completions 路由
app.post('/v1/chat/completions', validateApiKey, async (req, res, next) => {
    const {messages, model, stream = false} = req.body;

    if (!messages?.length) {
        if (DEBUG_MODE) {
            console.error(`[${getFormattedTime()}] Error 400: Messages is required and must be a non-empty array`);
        }
        return res.status(400).json(formatErrorResponse(400, "Messages is required and must be a non-empty array", "invalid_request_error"));
    }

    if (!model || !MODELS.hasOwnProperty(model)) {
        const errorMsg = `Please select the correct model: ${Object.keys(MODELS).join(', ')}`;
        if (DEBUG_MODE) {
            console.error(`[${getFormattedTime()}] Error 400: ${errorMsg}`);
        }
        return res.status(400).json(formatErrorResponse(400, errorMsg, "invalid_request_error"));
    }

    try {
        const chatResponse = await sendDuckChatMessage(messages, model);

        if (stream) {
            await handleResponse(chatResponse, {stream: true, res, modelName: model});
        } else {
            const response = await handleResponse(chatResponse);
            res.json(formatOpenAIResponse(response, model));
        }
    } catch (error) {
        next(error);
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    
    if (DEBUG_MODE) {
        console.error(`[${getFormattedTime()}] Error ${status}: ${message}`);
    }
    
    res.status(status).json(formatErrorResponse(status, message));
});

// 导出 app 供 Vercel 使用
export default app;

// 如果不是在 Vercel 环境下运行，则启动独立服务器
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`[${getFormattedTime()}] DDG2API ${VERSION} is running at port ${PORT}`);
        if (DEBUG_MODE) {
            console.log(`[${getFormattedTime()}] Debug mode is enabled`);
        }
    });
}
