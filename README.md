# 宴请宾朋

餐厅包间预订平台，当前采用：

- 微信小程序客户端：[`miniprogram/`](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/miniprogram)
- `NestJS` 后端：[`backend/src/`](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/backend/src)
- `Ant Design` Admin 管理台：[`src/`](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/src)
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
  - `bookings`
  - `database`

### Admin

- `React`
- `Vite`
- `Ant Design`

## 后端目录

- 启动入口：[backend/src/main.ts](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/backend/src/main.ts)
- 根模块：[backend/src/app.module.ts](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/backend/src/app.module.ts)
- 数据库服务：[backend/src/database/database.service.ts](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/backend/src/database/database.service.ts)
- 鉴权模块：[backend/src/auth/](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/backend/src/auth)
- 后台接口：[backend/src/admin/](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/backend/src/admin)
- 对外接口：[backend/src/public/](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/backend/src/public)

## Admin 目录

- 入口页面：[src/App.tsx](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/src/App.tsx)
- 全局样式：[src/index.css](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/src/index.css)

## 本地开发

### Node 版本

建议使用 `Node 20`。

当前机器已安装：

- `node v20.20.1`

### 安装依赖

```bash
npm install
```

### 启动 Nest 后端

```bash
npm run dev:backend
```

### 启动 Ant Design Admin

```bash
npm run dev:admin
```

默认地址：

- Admin：`http://localhost:5173`
- Backend：`http://localhost:3001`

## 构建

构建后台：

```bash
npm run build:backend
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
- 从 [backend/data/db.json](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/backend/data/db.json) 导入种子数据
- 初始化默认管理员账号

默认后台账号：

- 用户名：`admin`
- 密码：`Admin@123456`

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

### Public

- `GET /api/health`
- `POST /api/public/merchant-applications`
- `GET /api/public/merchants`
- `GET /api/public/merchants/:id`
- `POST /api/public/bookings`
- `GET /api/public/bookings`

## 生产部署

- 后端镜像：[Dockerfile.backend](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/Dockerfile.backend)
- Admin 镜像：[Dockerfile.admin](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/Dockerfile.admin)
- Nginx 配置：[deploy/nginx.admin.conf](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/deploy/nginx.admin.conf)
- Docker Compose：[docker-compose.production.yml](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/docker-compose.production.yml)

## 小程序注意事项

把 [miniprogram/config.js](/Users/zhangjohn/Documents/yanqing-binpeng-miniprogram/miniprogram/config.js) 的 `apiBaseUrl` 改成正式 HTTPS 域名，再去微信公众平台配置合法服务器域名。

# orderRoom
