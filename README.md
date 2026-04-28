# OnlyUI 静态页面演示

本目录提供一个独立的静态 UI 演示，可以在无后端服务的情况下直观查看页面效果。若需要在现有的 Docker Compose 环境中屏蔽后端并仅展示前端，可以使用 Docker Compose 覆盖配置。

- 快速开始（本地开发）
- 直接在本地运行前端：
  ```bash
  cd onlyui
  npm install
  npm run dev

- GitHub Pages 部署（静态站点）
  1) 在 GitHub 上创建一个新的空仓库，或使用现有仓库。
  2) 将 onlyui 目录的内容作为一个独立前端应用推送到该仓库，或将整个仓库结构保持不变。
  3) 安装 gh-pages 并配置部署：
     npm install -D gh-pages
     在 package.json 增加 staging/deploy 脚本：
       "scripts": {
         "predeploy": "npm run build",
         "deploy": "gh-pages -d dist"
       }
     然后执行：
       npm run deploy
  4) 若使用子路径部署，请在部署前设置环境变量 VITE_BASE_PATH，例如：
     VITE_BASE_PATH=/repo/ npm run deploy
  5) 在 GitHub 的仓库设置中，将 Pages 选择分支 gh-pages（root）或 /docs 目录，视你的 gh-pages 配置而定。
  6) 部署完成后，访问 https://<your-username>.github.io/<repo-name>/ 来查看页面。
  ```
- 使用 Docker Compose 屏蔽后端并仅部署前端：
  docker-compose -f docker-compose.yml -f docker-compose.onlyui.yml up -d
- 访问地址（本地）: http://localhost:5173（开发模式）或 http://localhost:8081（静态 Docker 方式）

页面结构
- LayoutDashboard.vue: 仪表盘，4 个统计卡片与最新动态表格
- TicketList.vue: 工单列表页，包含搜索/筛选和表格展示
- TicketDetailDrawer.vue: 静态的工单详情抽屉（演示流转日志）

集成说明
- 该静态 UI 使用 Element Plus 风格控件，数据为静态演示数据，便于你快速验证 UI 设计与交互效果。
- 如要接入真实后端，请将静态数据替换为 API 调用，并可在现有后端项目中逐步接入。
