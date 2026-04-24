# 宴请宾朋

餐厅包间预订平台，当前采用：

- 微信小程序客户端：[`miniapp/`](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/miniapp)
- `NestJS` 后端：[`server/`](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/server)
- `Ant Design` Admin 管理台：[`admin/`](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/admin)
- `MySQL` 数据库

## 当前技术栈

### 后端

- `NestJS 10`
- `mysql2`
- 模块划分：
  - `auth`
  - `admin`
  - `public`
  - `merchants`
  - `merchant`（商家端鉴权 + 订单管理）
  - `bookings`
  - `database`

### Admin

- `React`
- `Vite`
- `Ant Design`

## 项目结构

- `server/`
  - 启动入口：[server/src/main.ts](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/server/src/main.ts)
  - 根模块：[server/src/app.module.ts](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/server/src/app.module.ts)
  - 数据库服务：[server/src/database/database.service.ts](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/server/src/database/database.service.ts)
  - 鉴权模块：[server/src/auth/](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/server/src/auth)
  - 后台接口：[server/src/admin/](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/server/src/admin)
  - 对外接口：[server/src/public/](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/server/src/public)
- `admin/`
  - 入口页面：[admin/src/App.tsx](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/admin/src/App.tsx)
  - 全局样式：[admin/src/index.css](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/admin/src/index.css)
  - 支持两种角色切换：平台管理员 / 商家
- `miniapp/`
  - 微信小程序业务页面和配置
  - 小程序页面：发现（rooms）、我的订单（bookings）、商户中心（merchant-center）
  - 商家入驻申请：`pages/apply/index`
- `infra/`
  - Server 镜像：[infra/Dockerfile.server](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/Dockerfile.server)
  - Admin 镜像：[infra/Dockerfile.admin](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/Dockerfile.admin)
  - Nginx 配置：[infra/nginx/nginx.admin.conf](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/nginx/nginx.admin.conf)
  - Docker Compose：[infra/docker-compose.production.yml](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/docker-compose.production.yml)

## 本地开发

### Node 版本

建议使用 `Node 20`。

当前机器已安装：

- `node v20.20.1`

### 安装依赖

```bash
npm install
```

### 启动本地 MySQL

```bash
docker compose -f infra/docker-compose.local.yml up -d
```

### 初始化环境变量

```bash
cp .env.example .env
```

### 启动 Nest 后端

```bash
npm run dev:server
```

如需 watch 模式：

```bash
npm run dev:server:watch
```

### 启动 Ant Design Admin

```bash
npm run dev:admin
```

默认地址：

- Admin：`http://localhost:5173`
- Server：`http://localhost:3001`

## 构建

构建后台：

```bash
npm run build:server
```

构建 Admin：

```bash
npm run build:admin
```

完整构建：

```bash
npm run build
```

## MySQL

默认连接参数见 [\.env.example](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/.env.example)。

后端启动时会自动：

- 创建数据库 `yanqing_binpeng`
- 创建核心表
- 不再自动插入任何演示数据、测试账号或默认业务记录

如需初始化后台管理员，可在 `.env` 中显式填写：

- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`

## 接口

### Admin

- `POST /api/admin/auth/login`
- `GET /api/admin/auth/me`
- `POST /api/admin/auth/logout`
- `GET /api/admin/dashboard`
- `GET /api/admin/merchant-applications`
- `PATCH /api/admin/merchant-applications/:id/status`
- `GET /api/admin/merchants`
- `GET /api/admin/merchants/:id`
- `POST /api/admin/merchants/:id/rooms`
- `GET /api/admin/bookings`
- `PATCH /api/admin/bookings/:id/status`

### Merchant

- `POST /api/merchant/auth/web-login`
- `POST /api/merchant/auth/wx-login`
- `GET /api/merchant/auth/me`
- `POST /api/merchant/auth/logout`
- `GET /api/merchant/bookings`
- `GET /api/merchant/bookings/:id`
- `PATCH /api/merchant/bookings/:id/status`

### Public

- `GET /api/health`
- `POST /api/public/merchant-applications`
- `GET /api/public/merchants`
- `GET /api/public/merchants/:id`
- `POST /api/public/bookings`
- `GET /api/public/bookings`

## 生产部署

- Server 镜像：[infra/Dockerfile.server](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/Dockerfile.server)
- Admin 镜像：[infra/Dockerfile.admin](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/Dockerfile.admin)
- Nginx 配置：[infra/nginx/nginx.admin.conf](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/nginx/nginx.admin.conf)
- Docker Compose：[infra/docker-compose.production.yml](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/docker-compose.production.yml)
- 镜像部署 Compose：[infra/docker-compose.images.yml](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/infra/docker-compose.images.yml)

### GitHub Actions 自动构建镜像

仓库已提供 GitHub Actions 工作流：[.github/workflows/docker-publish.yml](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/.github/workflows/docker-publish.yml)。

- 触发条件：`push` 到 `main` 或手动触发 `workflow_dispatch`
- 目标镜像：
  - `youhebukeer/yanqing-binpeng-server`
  - `youhebukeer/yanqing-binpeng-admin`
- 推送标签：
  - `latest`
  - `sha-<commit>`

首次启用前，请在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中配置：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

其中 `DOCKERHUB_TOKEN` 建议使用 Docker Hub Access Token，不要直接使用密码。

### 服务器拉镜像部署

1. 复制部署环境变量模板：

```bash
cp .env.deploy.example .env.deploy
```

2. 填写数据库、跨域和初始化管理员配置：

```env
MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=yanqing_binpeng
ALLOWED_ORIGINS=https://your-domain.com
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_PASSWORD=change-me
WECHAT_MINIAPP_APPID=
WECHAT_MINIAPP_SECRET=
```

3. 拉取最新镜像并启动：

```bash
docker compose -f infra/docker-compose.images.yml pull
docker compose -f infra/docker-compose.images.yml up -d
```

4. 更新代码后重复执行：

```bash
docker compose -f infra/docker-compose.images.yml pull
docker compose -f infra/docker-compose.images.yml up -d
```

如果需要固定到某个镜像版本，可通过环境变量指定 tag：

```bash
IMAGE_TAG=sha-<commit> docker compose -f infra/docker-compose.images.yml pull
IMAGE_TAG=sha-<commit> docker compose -f infra/docker-compose.images.yml up -d
```

### Caddy 接入示例

如果服务器上使用 `Caddy` 统一对外提供访问，推荐：

- 将 `admin` 容器暴露到 `8080`
- 将 `server` 容器暴露到 `3001`
- 由 `Caddy` 处理 HTTPS 和反向代理

参考配置：

```caddy
your-domain.com {
    encode gzip zstd

    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }

    handle {
        reverse_proxy 127.0.0.1:8080
    }
}
```

Admin 镜像默认按相对路径请求 `/api`，因此适合配合 `Caddy` 用同域名转发前台和后台接口。

### PM2 部署 Server

Server 支持通过 PM2 部署，配置入口为 [ecosystem.config.cjs](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/ecosystem.config.cjs)。

1. 安装依赖和 PM2：

```bash
npm ci
npm install -g pm2
```

2. 创建 PM2 环境文件：

```bash
cp .env.pm2.example .env.pm2
```

3. 创建 MySQL 容器后，填写 `.env.pm2` 中的连接信息：

```env
MYSQL_HOST=
MYSQL_PORT=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
```

4. 构建并启动 Server：

```bash
npm run pm2:start:server
```

5. 更新代码后重载：

```bash
npm run pm2:reload:server
```

6. 查看日志：

```bash
npm run pm2:logs:server
```

PM2 会通过 `APP_ENV_FILE=.env.pm2` 读取生产环境变量。`.env.pm2.example` 中的 MySQL 配置默认留空，等数据库容器创建后再填写容器网络可访问的 host、port、user、password 和 database。

## 小程序注意事项

把 [miniapp/config.js](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/miniapp/config.js) 的 `apiBaseUrl` 改成正式 HTTPS 域名，再去微信公众平台配置合法服务器域名。

商家端小程序入口在首页的“商家入口”。当前不再提供测试账号兜底登录，商家需使用已开通权限的微信手机号登录。

# orderRoom
