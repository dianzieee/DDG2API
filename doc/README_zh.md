<div align="center">
	<h1>DDG2API</h1>
	<p style="font-size: 16px">
		<b>DuckDuckGo AI To API</b>
		<br>
		通过 API 与 DuckDuckGo AI 对话，免费使用 gpt-4o-mini、
    <br>
    claude-3-haiku、llama-3.1-70b、mixtral-8x7b 等模型。
		<br>
		支持连续对话，兼容 OpenAI API 格式。
	</p>
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/meethuhu/ddg2api/actions/workflows/workers-deploy.yml">
    <img src="https://deploy.workers.cloudflare.com/button" style="height: 30px;" />
  </a>
  <span>&nbsp;</span>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmeethuhu%2FDDG2API">
    <img src="https://vercel.com/button" style="height: 30px;" />
  </a>
  <br><br>
  
  [中文](./doc/README_zh.md) | [English](./README_en.md)
</div>

## 支持的接口

- `GET - /v1/models` - 获取可用模型列表
- `POST - /v1/chat/completions` - 发送对话请求

## 可用模型

- `gpt-4o-mini`
- `claude-3-haiku-20240307`
- `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`
- `mistralai/Mixtral-8x7B-Instruct-v0.1`

## 环境变量

| 名称       | 是否必需 | 描述                                                                   |
| ---------- | -------- |----------------------------------------------------------------------|
| `PORT`     | 可选     | 服务端口，默认为 3000                                                        |
| `API_KEYS` | 可选     | API密钥组，多个值用逗号(,)分隔                                                   |
| `PATH_PREFIX` | 可选     | 配置后，实际端点 URL 应以“PATH_PREFIX”为前缀，例如：`/PATH_PREFIX/v1/chat/completions` |

## 部署方式

- ### CloudFlare 部署

  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/meethuhu/ddg2api/actions/workflows/workers-deploy.yml">
  	<img src="https://deploy.workers.cloudflare.com/button" style="height: 30px;" /></a>
  
  *建议手动设置 `API_KEYS`  
  *需要手动部署请前往 `cf` 分支

- ### Vercel 部署

  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmeethuhu%2FDDG2API">
  	<img src="https://vercel.com/button" style="height: 30px;" /></a>
  
  *建议手动设置 `API_KEYS`

- ### Docker 部署

  ```shell
  docker run -d \
    --name ddg2api \
    -p 3000:3000 \
    -e API_KEYS=your_api_key1,your_api_key2 \
    -e TZ=Asia/Shanghai \
    --restart always \
    ghcr.io/meethuhu/ddg2api:main
  ```

- ### Docker Compose 部署

  ```docker-compose
  services:
    ddg2api:
      image: ghcr.io/meethuhu/ddg2api:latest
      container_name: ddg2api
      ports:
        - '3000:3000'
      environment:
        - API_KEYS=your_api_key1,your_api_key2
        - TZ=Asia/Shanghai
      restart: always
  ```

- ### Node.js 部署

  ```shell
  git clone https://github.com/meethuhu/DDG2API.git

  cd DDG2API

  npm install

  node index.js
  ```

## 使用示例

```shell
# 获取模型列表
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer your_api_key"
```

```shell
# 发送对话请求
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

### 注意事项

1. 本项目仅供学习和研究使用
2. 请遵守 DuckDuckGo 的使用条款
3. 建议在本地或私有环境中使用
4. 请妥善保管你的密钥

### 开源协议

MIT License

### 贡献

欢迎提交 Issues 和 Pull Requests！