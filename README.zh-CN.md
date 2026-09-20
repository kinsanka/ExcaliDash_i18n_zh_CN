<img src="readme-assets/logoExcaliDash.png" alt="ExcaliDash Logo" width="80" height="88">

# ExcaliDash 中文版

> 基于 [ZimengXiong/ExcaliDash](https://github.com/ZimengXiong/ExcaliDash) 的中文增强 fork，提供简体中文界面、更新后的 Excalidraw CJK 字体支持，以及可直接部署的 Docker 镜像配置。

[English README](./README.md)

## 这个 fork 做了什么

这个版本主要面向想直接使用中文界面的用户，而不是自己长期维护 patch。

- 主流程已支持简体中文
- 已同步上游正式版 `v0.6.0`
- Excalidraw 已升级到 `0.18.1`
- 已接入 Excalidraw 官方样式和 CJK 字体支持
- `docker-compose.prod.yml` 默认使用本 fork 的镜像名
- 保留了与上游接近的项目结构，便于后续同步

项目关系：

- 上游项目：[ZimengXiong/ExcaliDash](https://github.com/ZimengXiong/ExcaliDash)
- 当前 fork：`kinsanka/ExcaliDash_i18n_zh_CN`

## 功能概览

- 持久化保存 Excalidraw 图稿
- 集合管理、搜索、拖拽整理
- 图稿导出 / 导入备份
- 实时协作
- 可选本地认证与 OIDC
- 分享给内部用户或外部链接访问
- 集合共享与“分享给我的”隐藏功能
- 图片独立存储、保存冲突自动协调和离开页面前补发保存
- 主题、语言、排序、网格步长等用户偏好持久化
- 可选 SQLite 或 PostgreSQL 数据库

## 快速开始

前提：

- Docker
- Docker Compose v2

推荐直接使用 Docker Hub 镜像部署。

```bash
# 下载生产部署 compose 文件
curl -OL https://raw.githubusercontent.com/kinsanka/ExcaliDash_i18n_zh_CN/main/docker-compose.prod.yml

# 拉取镜像
docker compose -f docker-compose.prod.yml pull

# 启动
docker compose -f docker-compose.prod.yml up -d
```

启动后访问：

- `http://localhost:6767`

本 fork 默认镜像：

```yaml
backend: kinsanka/excalidash-backend:latest
frontend: kinsanka/excalidash-frontend:latest
```

如果你想固定版本，建议显式指定 tag：

```bash
APP_TAG=v0.6.0-zh.5 docker compose -f docker-compose.prod.yml pull
APP_TAG=v0.6.0-zh.5 docker compose -f docker-compose.prod.yml up -d
```

## 常用部署说明

### 1. Secrets

生产环境建议显式设置：

- `JWT_SECRET`
- `CSRF_SECRET`

否则单实例部署虽然可以自动生成，但迁移和多实例时不够稳。

### 2. 反向代理

如果你通过 Nginx、Traefik 或其他代理对外提供服务，重点关注：

- `FRONTEND_URL`
- `TRUST_PROXY`

只有在你确信请求一定经过可信代理，并且代理正确设置转发头时，才把 `TRUST_PROXY` 改成 `1` 或其他 hop 数。

### 3. 数据存储位置

当前默认使用 Docker volume 保存后端数据：

- 数据库路径：`/app/prisma/dev.db`
- Compose 挂载：`backend-data:/app/prisma`

也就是说图稿、缩略图、文件数据主要都保存在 SQLite 数据库里，不是默认散落在宿主机目录。

如果只是重建容器，数据通常不会丢；真正危险的是：

- `docker compose down -v`
- 手动删除 volume
- 把挂载路径切换到一个新的空目录

### 4. 数据库类型

支持 SQLite 和 PostgreSQL 两种数据库。默认配置仍使用 SQLite，已有部署升级后不需要改动：

```yaml
environment:
  - DATABASE_PROVIDER=sqlite
  - DATABASE_URL=file:/app/prisma/dev.db
```

如需使用 PostgreSQL，请在首次启动前改为：

```yaml
environment:
  - DATABASE_PROVIDER=postgresql
  - DATABASE_URL=postgresql://user:password@host:5432/excalidash
```

容器启动时会自动选择对应的 Prisma 迁移。切换数据库类型不会自动迁移旧数据，现有 SQLite 图稿需要另行导出和迁移。

## 升级

如果你使用的是 `docker-compose.prod.yml`，升级方式：

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

如果要更干净地重启：

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

注意：

- 不要随便加 `-v`，否则会删掉后端持久化数据
- 生产环境建议固定版本 tag，不建议长期只用 `latest`

## 备份

至少建议定期把当前 Docker volume 里的数据库备份出来。

例如：

```bash
docker compose down
mkdir D:\backup\excalidash
docker run --rm -v excalidash_backend-data:/from -v D:\backup\excalidash:/to alpine sh -c "cp -a /from/. /to/"
docker compose up -d
```

这样至少会把数据库和相关 secret 文件备份到本地目录。

## 本地开发

如果你想基于源码本地跑：

```bash
git clone https://github.com/kinsanka/ExcaliDash_i18n_zh_CN.git
cd ExcaliDash_i18n_zh_CN
docker compose up -d --build
```

或者分别启动前后端：

前端：

```bash
cd frontend
npm install
npm run dev
```

后端：

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## GitHub Actions

这个 fork 当前有两类 Actions：

- 测试流程：自动跑后端、前端、E2E 和安全测试
- Docker 发布流程：自动构建并发布 Docker Hub 镜像

如果你是仓库维护者，需要在 GitHub 仓库里配置：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

然后就可以手动触发镜像发布 workflow。

## 适合谁用

适合：

- 想直接部署中文界面的 ExcaliDash 用户
- 想用更新版 Excalidraw CJK 支持的用户
- 希望通过 Docker 镜像直接部署的用户

不适合：

- 只想使用原汁原味上游版本的用户
- 不希望维护 fork 差异的团队

如果你更在意和上游保持完全一致，请直接使用上游仓库。

## 致谢

- 原始项目：[ZimengXiong/ExcaliDash](https://github.com/ZimengXiong/ExcaliDash)
- Excalidraw 与其贡献者：[npm/@excalidraw/excalidraw](https://www.npmjs.com/package/@excalidraw/excalidraw)
