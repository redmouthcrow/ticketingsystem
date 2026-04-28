# OnlyUI 静态页面演示

本目录提供一个独立的静态 UI 演示，可以在无后端服务的情况下直观查看页面效果。若需要在现有的 Docker Compose 环境中屏蔽后端并仅展示前端，可以使用 Docker Compose 覆盖配置。

快速开始
- 直接在本地运行前端：
  ```bash
  cd onlyui
  npm install
  npm run dev
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
