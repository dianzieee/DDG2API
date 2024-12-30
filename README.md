<div align="center">
	<h1>DDG2API</h1>
	<p style="font-size: 16px">
		<b>DuckDuckGo AI to API</b>
		<br>
		Chatting with DuckDuckGo AI through API,Free to use gpt-4o-mini,
    <br>
    claude-3-haiku, llama-3.1-70b, mixtral-8x7b, etc.
		<br>
		Supports continuous dialogue, compatible with OpenAI API format.
	</p>
	<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/meethuhu/ddg2api/actions/workflows/workers-deploy.yml">
  	<img src="https://deploy.workers.cloudflare.com/button" style="height: 30px;"/></a>
	<span>&nbsp;</span>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmeethuhu%2FDDG2API">
  	<img src="https://vercel.com/button" style="height: 30px;"/></a>
	<br><br>

[中文](./doc/README_zh.md) | [English](./README.md)
</div>

## Supported Interfaces

- `GET - /v1/models`

- `POST - /v1/chat/completions`

## Available models

- `gpt-4o-mini`
- `claude-3-haiku-20240307`
- `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`
- `mistralai/Mixtral-8x7B-Instruct-v0.1`

## Environment variables

| Name          | Option   | Description                                                                                                                    |
|---------------|----------|--------------------------------------------------------------------------------------------------------------------------------|
| `PORT`        | Optional | Request port, default is 3000                                                                                                  |
| `API_KEYS`    | Optional | API key group, separate multiple values with `,`                                                                               |
| `PATH_PREFIX` | Optional | The actual endpoint URL should be prefixed with `PATH_PREFIX` after configuration, example: `/PATH_PREFIX/v1/chat/completions` |

## Deployment

- ### CloudFlare

  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/meethuhu/ddg2api/actions/workflows/workers-deploy.yml">
  	<img src="https://deploy.workers.cloudflare.com/button" style="height: 30px;"/></a>

  *suggest manually setting `API_KEYS`  
  *To deploy manually, go to the `cf` branch

- ### Vercel

  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmeethuhu%2FDDG2API">
  	<img src="https://vercel.com/button" style="height: 30px;"/></a>

  *suggest manually setting `API_KEYS`

- ### Docker

  ```shell
  docker run -d \
    --name ddg2api \
    -p 3000:3000 \
    -e API_KEYS=your_api_key1,your_api_key2 \
    -e TZ=Asia/Shanghai \
    --restart always \
    ghcr.io/meethuhu/ddg2api:main
  ```

- ### Docker Compose

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

- ### Nodejs

  ```shell
  git clone https://github.com/meethuhu/DDG2API.git

  cd DDG2API

  npm install

  node index.js
  ```

## Usage example

```shell
# Get model list
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer your_api_key"
```

```shell
# Send chat request
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

### Notes

1. This project is for learning and research purposes only
2. Please comply with DuckDuckGo's terms of use
3. Recommended for use in local or private environments
4. Please keep your keys secure

### Open Source License

MIT License

### Contributing

Welcome to submit Issues and Pull Requests!
