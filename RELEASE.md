# ExcaliDash 中文版 v0.6.0-zh.1

发布日期：待定

## 上游更新

- 同步上游正式版 ExcaliDash v0.6.0（提交 `1988ca5`）。
- 保存流程支持版本冲突协调、失败重试和离开页面前补发，连续失败时显示“存在未保存的更改”。
- 图稿图片改为独立文件存储，并支持重新加载缺失文件。
- 主题、语言、仪表盘排序、图片压缩、编辑器自动隐藏和网格步长保存为用户偏好。
- 新增集合共享、“分享给我的”隐藏、API 密钥和图稿存储管理。
- SQLite 仍为默认数据库，同时支持 PostgreSQL。

## 中文版改动

- 应用界面新增集中式简体中文词典和动态翻译桥，适配 v0.6.0 拆分后的组件结构。
- Excalidraw 使用官方中文，并继续补全右键菜单、属性面板、箭头端点和快捷键等缺失文案。
- 保留 Excalifont CJK 手绘字体支持。
- 语言选择接入服务端用户偏好，可在登录后跨会话保存。
- 生产 Compose 默认使用 `kinsanka/excalidash-backend` 和 `kinsanka/excalidash-frontend`。

## 升级

升级前请备份后端 volume。v0.6.0 包含数据库迁移和图片存储结构调整。

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs backend --tail=200
```

固定使用本版本：

```bash
APP_TAG=v0.6.0-zh.1 docker compose -f docker-compose.prod.yml pull
APP_TAG=v0.6.0-zh.1 docker compose -f docker-compose.prod.yml up -d
```

不要在升级时执行 `docker compose down -v`，否则会删除持久化数据。
