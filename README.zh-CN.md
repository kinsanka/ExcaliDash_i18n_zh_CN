# ExcaliDash 中文版

基于 [ZimengXiong/ExcaliDash](https://github.com/ZimengXiong/ExcaliDash) 的中文增强版，当前同步上游正式版 **v0.6.7**，中文发布版本为 **v0.6.7-zh.1**。

## 本版更新

- 同步官方 v0.6.7，以及此前的图片保存、协作同步、历史恢复、备份和安全修复。
- 使用集中式语言文件，完整覆盖应用界面；设置中可选择简体中文、English 或 Français。
- 保留 Excalidraw 官方中文、缺失文案补全和官方 Excalifont CJK 字体资源。
- 保留中文版更新检查、GitHub API 限流回退和上游正式版进度显示。
- 保留已有迁移文件的内容，新增上游迁移；SQLite 为默认数据库，继续支持 PostgreSQL。
- Docker 镜像支持 linux/amd64 和 linux/arm64，两端镜像验证通过后一起更新 latest。

## 安装

需要 Docker 和 Docker Compose v2。

```bash
curl -OL https://raw.githubusercontent.com/kinsanka/ExcaliDash_i18n_zh_CN/main/docker-compose.prod.yml
APP_TAG=v0.6.7-zh.1 docker compose -f docker-compose.prod.yml pull
APP_TAG=v0.6.7-zh.1 docker compose -f docker-compose.prod.yml up -d
```

访问 `http://localhost:6767`。默认镜像为：

- `kinsanka/excalidash-backend:v0.6.7-zh.1`
- `kinsanka/excalidash-frontend:v0.6.7-zh.1`

Compose 支持原有 `APP_TAG`、`BACKEND_IMAGE`、`FRONTEND_IMAGE`，也支持上游 `EXCALIDASH_TAG`（APP_TAG 优先）。需要持续固定版本时，在部署目录的 `.env` 中设置 `APP_TAG=v0.6.7-zh.1`。

## 从 v0.6.0 中文版升级

1. 记录当前镜像版本，保留原有 Compose、环境变量和数据库连接配置。
2. 在应用设置中导出 `.excalidash` 备份；备份生产数据库或后端数据卷，包含持久化密钥。使用外部对象存储时也应保留对应文件。
3. 优先使用备份副本在独立实例中演练升级，再更新正式实例。
4. 拉取两个组件的同一固定版本，并重建容器。容器启动会应用新增数据库迁移。
5. 确认健康检查、旧图稿中的图片、历史版本、分享访问和中文设置正常。

```bash
APP_TAG=v0.6.7-zh.1 docker compose -f docker-compose.prod.yml pull
APP_TAG=v0.6.7-zh.1 docker compose -f docker-compose.prod.yml up -d
APP_TAG=v0.6.7-zh.1 docker compose -f docker-compose.prod.yml logs backend --tail=100
```

保持原有项目名、后端数据卷和挂载目录。不要在升级时执行 `docker compose down -v`。

本次升级包含数据库结构更新。回退时应恢复升级前的数据库/文件备份，并恢复旧镜像，不能只切回旧镜像后继续使用已升级的数据库。

如果旧数据卷由 root 拥有，新的非 root 容器可能无法写入；请在备份后确保挂载目录可由 UID 1001 读写。不要使用删除数据卷的方式解决权限问题。

## 配置和开发

继续沿用原有的 JWT_SECRET、CSRF_SECRET、FRONTEND_URL、AUTH_MODE 和数据库配置。SQLite 和 PostgreSQL 之间的切换不会自动搬迁已有数据。

上游部署文档位于 [Docker 部署](https://excalidash.xyz/deploy/docker)和[配置参考](https://excalidash.xyz/reference/environment)。其中的官方镜像名应替换为本仓库的镜像名和中文发布标签。

使用 Node.js 24.22.1 或更新的兼容版本和 npm：

```bash
npm ci
npm run install:all
npm run build
npm run check
npm --prefix frontend run test:unit
npm --prefix backend test
```

## 发布

`VERSION` 保持上游基础版本 `0.6.7`，中文修订号通过 `v0.6.7-zh.N` 标签和镜像构建标识注入。中文发布仅使用本仓库的 Docker Hub 镜像，不向上游命名空间推送。

仓库需要已有的 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN` Actions secrets。CI 检查通过后推送中文发布标签，即可构建并验证镜像。GitHub 发布说明在镜像发布成功后发布。

## 致谢

感谢原项目和 Excalidraw 的贡献者，以及 @3zmana 的集中式 i18n 工作。本中文版在该翻译框架基础上补全简体中文。
