# 构建阶段
FROM node:18-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 只复制依赖相关文件
COPY package*.json pnpm-lock.yaml ./

# 安装依赖，添加 --prod 来排除开发依赖
RUN pnpm install --prod --frozen-lockfile

# 运行阶段 - 使用更小的基础镜像
FROM alpine:3.19

# 安装 Node.js 运行环境
RUN apk add --no-cache nodejs

# 设置工作目录
WORKDIR /app

# 创建非 root 用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 从构建阶段复制依赖
COPY --from=builder /app/node_modules ./node_modules

# 只复制必要的应用代码
COPY index.js ./
COPY package.json ./

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "index.js"]