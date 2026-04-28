(() => {
  const { createApp, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } = Vue;

  const StorageKey = "saasmanager.servers.v1";
  const AlertRulesKey = "saasmanager.alertRules.v1";

  /** @returns {number} */
  function clamp01(n){ return Math.max(0, Math.min(1, n)); }
  function pct(n){ return Math.round(clamp01(n) * 100); }
  function nowStr(){
    const d = new Date();
    const p = (x)=> String(x).padStart(2,"0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function uid(prefix="srv"){
    return `${prefix}_${Math.random().toString(16).slice(2,8)}${Date.now().toString(16).slice(-4)}`;
  }
  function isValidIp(ip){
    const s = String(ip||"").trim();
    const parts = s.split(".");
    if(parts.length !== 4) return false;
    return parts.every(p => /^\d+$/.test(p) && +p >= 0 && +p <= 255);
  }
  function safeParse(json, fallback){
    try{ return JSON.parse(json); }catch{ return fallback; }
  }

  function seedServers(){
    return [
      {
        id: "srv-001",
        ip: "10.10.1.21",
        status: "online",
        cpuCores: 64,
        cpuUsage: 0.42,
        memGB: 256,
        memUsedGB: 168,
        gpuModel: "A100",
        gpuCount: 8,
        gpuUsage: 0.66,
        diskGB: 4096,
        diskUsedGB: 2510,
        region: "cn-beijing",
        os: "Ubuntu 22.04",
        tags: ["训练", "核心池"],
        lastSeenAt: nowStr(),
      },
      {
        id: "srv-002",
        ip: "10.10.1.22",
        status: "online",
        cpuCores: 32,
        cpuUsage: 0.18,
        memGB: 128,
        memUsedGB: 44,
        gpuModel: "L40S",
        gpuCount: 4,
        gpuUsage: 0.28,
        diskGB: 2048,
        diskUsedGB: 980,
        region: "cn-beijing",
        os: "Ubuntu 20.04",
        tags: ["推理"],
        lastSeenAt: nowStr(),
      },
      {
        id: "srv-003",
        ip: "10.10.2.15",
        status: "degraded",
        cpuCores: 48,
        cpuUsage: 0.82,
        memGB: 192,
        memUsedGB: 170,
        gpuModel: "V100",
        gpuCount: 8,
        gpuUsage: 0.91,
        diskGB: 3072,
        diskUsedGB: 2920,
        region: "cn-shanghai",
        os: "Ubuntu 22.04",
        tags: ["训练", "高占用"],
        lastSeenAt: nowStr(),
      },
      {
        id: "srv-004",
        ip: "10.10.3.9",
        status: "offline",
        cpuCores: 16,
        cpuUsage: 0.0,
        memGB: 64,
        memUsedGB: 0,
        gpuModel: "",
        gpuCount: 0,
        gpuUsage: 0.0,
        diskGB: 1024,
        diskUsedGB: 0,
        region: "cn-guangzhou",
        os: "Rocky 9",
        tags: ["维护"],
        lastSeenAt: "2026-04-01 03:12",
      },
    ];
  }

  function loadServers(){
    const raw = localStorage.getItem(StorageKey);
    if(!raw){
      const seeded = seedServers();
      localStorage.setItem(StorageKey, JSON.stringify(seeded));
      return seeded;
    }
    const arr = safeParse(raw, []);
    return Array.isArray(arr) ? arr : [];
  }
  function saveServers(servers){
    localStorage.setItem(StorageKey, JSON.stringify(servers));
  }
  function loadAlertRules(){
    const raw = localStorage.getItem(AlertRulesKey);
    if(!raw){
      const rules = [
        { id: uid("rule"), name: "CPU 使用率过高", metric: "cpu", op: ">=", threshold: 85, severity: "warn", enabled: true },
        { id: uid("rule"), name: "内存使用率过高", metric: "mem", op: ">=", threshold: 85, severity: "warn", enabled: true },
        { id: uid("rule"), name: "GPU 使用率过高", metric: "gpu", op: ">=", threshold: 90, severity: "bad", enabled: true },
        { id: uid("rule"), name: "磁盘使用率过高", metric: "disk", op: ">=", threshold: 90, severity: "warn", enabled: true },
      ];
      localStorage.setItem(AlertRulesKey, JSON.stringify(rules));
      return rules;
    }
    const arr = safeParse(raw, []);
    return Array.isArray(arr) ? arr : [];
  }
  function saveAlertRules(rules){
    localStorage.setItem(AlertRulesKey, JSON.stringify(rules));
  }

  function usageRate(server, metric){
    const s = server;
    if(metric === "cpu") return clamp01(Number(s.cpuUsage) || 0);
    if(metric === "gpu") return clamp01(Number(s.gpuUsage) || 0);
    if(metric === "mem"){
      const total = Number(s.memGB) || 0;
      const used = Number(s.memUsedGB) || 0;
      if(total <= 0) return 0;
      return clamp01(used / total);
    }
    if(metric === "disk"){
      const total = Number(s.diskGB) || 0;
      const used = Number(s.diskUsedGB) || 0;
      if(total <= 0) return 0;
      return clamp01(used / total);
    }
    return 0;
  }
  function evalRuleHit(rate, op, thresholdPct){
    const v = pct(rate);
    const t = Number(thresholdPct) || 0;
    if(op === ">=") return v >= t;
    if(op === ">") return v > t;
    if(op === "<=") return v <= t;
    if(op === "<") return v < t;
    return false;
  }

  const App = {
    setup(){
      const state = reactive({
        route: "leader",
        servers: loadServers(),
        rules: loadAlertRules(),
        query: "",
        statusFilter: "all",
        regionFilter: "all",
        modalOpen: false,
        modalMode: "create", // create | edit
        editingId: "",
        form: {
          id: "",
          ip: "",
          cpuCores: 32,
          cpuUsage: 20,
          memGB: 128,
          memUsedGB: 64,
          gpuModel: "",
          gpuCount: 0,
          gpuUsage: 0,
          diskGB: 1024,
          diskUsedGB: 200,
          region: "cn-beijing",
          os: "Ubuntu 22.04",
          tags: "",
          status: "online",
        },
        toast: null, // { type, msg }
        ruleModalOpen: false,
        ruleForm: {
          id: "",
          name: "",
          metric: "cpu",
          op: ">=",
          threshold: 85,
          severity: "warn",
          enabled: true,
        }
        ,
        mapError: ""
        ,
        selectedProvince: "",
        screenFull: false
      });

      watch(() => state.servers, (v) => saveServers(v), { deep: true });
      watch(() => state.rules, (v) => saveAlertRules(v), { deep: true });

      function navTo(route){ state.route = route; }

      const menus = [
        { key: "leader", title: "展示大屏", desc: "地图分布 / 一眼看全局" },
        { key: "overview", title: "总览", desc: "运行态势 / 资源占用" },
        { key: "servers", title: "服务器信息列表", desc: "录入 / 编辑 / 分组" },
        { key: "alerts", title: "资源预警", desc: "规则 / 告警概览" },
        { key: "monitor", title: "状态监控", desc: "心跳 / 在线状态" },
        { key: "settings", title: "系统设置", desc: "占位：权限/日志/配置" },
      ];

      const pageTitle = computed(() => {
        const m = menus.find(x => x.key === state.route);
        return m ? m.title : "控制台";
      });

      const serverRegions = computed(() => {
        const set = new Set(state.servers.map(s => s.region).filter(Boolean));
        return Array.from(set).sort();
      });

      const filteredServers = computed(() => {
        const q = state.query.trim().toLowerCase();
        return state.servers.filter(s => {
          const okStatus = state.statusFilter === "all" ? true : s.status === state.statusFilter;
          const okRegion = state.regionFilter === "all" ? true : s.region === state.regionFilter;
          const okQ = !q ? true : (
            String(s.id||"").toLowerCase().includes(q) ||
            String(s.ip||"").toLowerCase().includes(q) ||
            String(s.gpuModel||"").toLowerCase().includes(q) ||
            String((s.tags||[]).join(",")).toLowerCase().includes(q)
          );
          return okStatus && okRegion && okQ;
        });
      });

      const totals = computed(() => {
        const list = state.servers;
        const total = list.length;
        const online = list.filter(s => s.status === "online").length;
        const degraded = list.filter(s => s.status === "degraded").length;
        const offline = list.filter(s => s.status === "offline").length;
        const cpuCores = list.reduce((a,s)=>a+(Number(s.cpuCores)||0),0);
        const memGB = list.reduce((a,s)=>a+(Number(s.memGB)||0),0);
        const gpuCount = list.reduce((a,s)=>a+(Number(s.gpuCount)||0),0);
        return { total, online, degraded, offline, cpuCores, memGB, gpuCount };
      });

      const avgUsage = computed(() => {
        const online = state.servers.filter(s => s.status !== "offline");
        const n = online.length || 1;
        const cpu = online.reduce((a,s)=>a+clamp01(Number(s.cpuUsage)||0),0) / n;
        const gpu = online.reduce((a,s)=>a+clamp01(Number(s.gpuUsage)||0),0) / n;
        const mem = online.reduce((a,s)=>a+usageRate(s,"mem"),0) / n;
        const disk = online.reduce((a,s)=>a+usageRate(s,"disk"),0) / n;
        return { cpu, mem, gpu, disk };
      });

      const health = computed(() => {
        const { offline, degraded } = totals.value;
        if(offline > 0) return { level: "bad", text: "存在离线服务器" };
        if(degraded > 0) return { level: "warn", text: "存在异常服务器" };
        return { level: "good", text: "整体运行良好" };
      });

      // --- 展示大屏：省份分布（基于 region/标签推断） ---
      const normalizeProvinceName = (name) => {
        const s = String(name || "").trim();
        if(!s) return "";
        return s
          .replace(/特别行政区$/,"")
          .replace(/维吾尔自治区$/,"")
          .replace(/壮族自治区$/,"")
          .replace(/回族自治区$/,"")
          .replace(/自治区$/,"")
          .replace(/省$/,"")
          .replace(/市$/,"");
      };
      const regionToProvince = (region) => {
        const r = String(region || "").trim().toLowerCase();
        // 常见：cn-beijing / cn-shanghai / cn-guangzhou / cn-shenzhen
        if(r.includes("beijing") || r.includes("北京")) return "北京";
        if(r.includes("tianjin") || r.includes("天津")) return "天津";
        if(r.includes("shanghai") || r.includes("上海")) return "上海";
        if(r.includes("chongqing") || r.includes("重庆")) return "重庆";

        if(r.includes("hebei") || r.includes("河北")) return "河北";
        if(r.includes("shanxi") || r.includes("山西")) return "山西";
        if(r.includes("liaoning") || r.includes("辽宁")) return "辽宁";
        if(r.includes("jilin") || r.includes("吉林")) return "吉林";
        if(r.includes("heilongjiang") || r.includes("黑龙江")) return "黑龙江";

        if(r.includes("jiangsu") || r.includes("江苏")) return "江苏";
        if(r.includes("zhejiang") || r.includes("浙江")) return "浙江";
        if(r.includes("anhui") || r.includes("安徽")) return "安徽";
        if(r.includes("fujian") || r.includes("福建")) return "福建";
        if(r.includes("jiangxi") || r.includes("江西")) return "江西";
        if(r.includes("shandong") || r.includes("山东")) return "山东";

        if(r.includes("henan") || r.includes("河南")) return "河南";
        if(r.includes("hubei") || r.includes("湖北")) return "湖北";
        if(r.includes("hunan") || r.includes("湖南")) return "湖南";
        if(r.includes("guangdong") || r.includes("广东") || r.includes("guangzhou") || r.includes("shenzhen")) return "广东";
        if(r.includes("guangxi") || r.includes("广西")) return "广西";
        if(r.includes("hainan") || r.includes("海南")) return "海南";

        if(r.includes("sichuan") || r.includes("四川")) return "四川";
        if(r.includes("guizhou") || r.includes("贵州")) return "贵州";
        if(r.includes("yunnan") || r.includes("云南")) return "云南";
        if(r.includes("xizang") || r.includes("tibet") || r.includes("西藏")) return "西藏";

        if(r.includes("shanxi") || r.includes("陕西")) return "陕西";
        if(r.includes("gansu") || r.includes("甘肃")) return "甘肃";
        if(r.includes("qinghai") || r.includes("青海")) return "青海";
        if(r.includes("ningxia") || r.includes("宁夏")) return "宁夏";
        if(r.includes("xinjiang") || r.includes("新疆")) return "新疆";

        if(r.includes("neimenggu") || r.includes("inner mongolia") || r.includes("内蒙古")) return "内蒙古";
        if(r.includes("hongkong") || r.includes("hk") || r.includes("香港")) return "香港";
        if(r.includes("macau") || r.includes("mo") || r.includes("澳门")) return "澳门";
        if(r.includes("taiwan") || r.includes("台湾")) return "台湾";
        return "其他";
      };

      const provinceCounts = computed(() => {
        /** @type {Record<string, number>} */
        const m = {};
        for(const s of state.servers){
          const p = regionToProvince(s.region);
          m[p] = (m[p] || 0) + 1;
        }
        return m;
      });

      const topProvinces = computed(() => {
        const entries = Object.entries(provinceCounts.value)
          .filter(([k]) => k !== "其他")
          .sort((a,b) => (b[1] - a[1]));
        return entries.slice(0, 8).map(([name, value]) => ({ name, value }));
      });

      const selectedProvinceName = computed(() => normalizeProvinceName(state.selectedProvince));
      const selectedProvinceServers = computed(() => {
        const p = selectedProvinceName.value;
        if(!p) return [];
        return state.servers.filter(s => regionToProvince(s.region) === p);
      });
      const selectedProvinceStats = computed(() => {
        const list = selectedProvinceServers.value;
        const total = list.length;
        const online = list.filter(s => s.status === "online").length;
        const degraded = list.filter(s => s.status === "degraded").length;
        const offline = list.filter(s => s.status === "offline").length;
        const alertCount = activeAlerts.value.filter(a => normalizeProvinceName(a && a.serverId ? regionToProvince((state.servers.find(x=>x.id===a.serverId)||{}).region) : "") === selectedProvinceName.value).length;
        return { total, online, degraded, offline, alertCount };
      });
      function clearProvinceSelection(){ state.selectedProvince = ""; }
      function selectProvince(name){
        const n = normalizeProvinceName(name);
        state.selectedProvince = n;
      }

      function isFullscreen(){
        try{
          return !!(document.fullscreenElement || document.webkitFullscreenElement);
        }catch{
          return false;
        }
      }
      async function enterFullscreen(){
        const el = document.documentElement;
        try{
          if(el.requestFullscreen) await el.requestFullscreen();
          else if(el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        }catch{}
      }
      async function exitFullscreen(){
        try{
          if(document.exitFullscreen) await document.exitFullscreen();
          else if(document.webkitExitFullscreen) await document.webkitExitFullscreen();
        }catch{}
      }
      async function toggleScreenFull(){
        if(state.route !== "leader") state.route = "leader";
        if(isFullscreen()) await exitFullscreen();
        else await enterFullscreen();
      }

      let leaderChart = null;
      function disposeLeaderChart(){
        try{
          if(leaderChart){
            leaderChart.dispose();
            leaderChart = null;
          }
        }catch{}
      }

      function getSchematicChinaGeoJSON(){
        // 轻量“示意中国地图”：用粗略矩形代表各省级区域，保证离线可展示“分布 + 柱状”
        // 坐标为经纬度（WGS84 近似），不追求真实边界，仅用于领导一眼看趋势/分布
        const box = (name, x1, y1, x2, y2) => ({
          type: "Feature",
          properties: { name },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [x1, y1],[x2, y1],[x2, y2],[x1, y2],[x1, y1]
            ]]
          }
        });
        return {
          type: "FeatureCollection",
          features: [
            box("新疆", 73.5, 34.0, 96.0, 49.5),
            box("西藏", 78.0, 27.5, 92.5, 36.5),
            box("青海", 89.0, 32.0, 103.0, 39.5),
            box("甘肃", 92.0, 33.0, 108.5, 42.0),
            box("内蒙古", 97.0, 39.5, 126.0, 49.5),
            box("宁夏", 104.0, 35.0, 107.5, 39.5),
            box("陕西", 105.0, 32.0, 111.5, 37.5),
            box("四川", 97.5, 26.5, 107.5, 34.0),
            box("重庆", 105.0, 28.5, 108.5, 32.0),
            box("云南", 97.5, 21.0, 106.5, 27.8),
            box("贵州", 104.5, 24.0, 109.5, 28.8),
            box("广西", 105.0, 20.5, 112.5, 25.5),
            box("广东", 110.5, 20.0, 117.5, 25.6),
            box("海南", 108.5, 18.0, 112.0, 20.8),
            box("湖南", 108.0, 25.0, 113.5, 29.8),
            box("湖北", 109.0, 28.0, 115.0, 33.3),
            box("河南", 111.0, 32.5, 116.8, 36.8),
            box("河北", 113.5, 36.0, 119.8, 41.3),
            box("北京", 115.8, 39.3, 117.2, 40.8),
            box("天津", 116.7, 38.6, 118.2, 40.2),
            box("山西", 110.0, 36.0, 113.8, 40.2),
            box("山东", 116.0, 35.0, 122.7, 38.6),
            box("江苏", 118.0, 31.0, 122.0, 35.5),
            box("上海", 121.0, 30.8, 122.3, 31.8),
            box("浙江", 118.7, 27.8, 122.8, 31.8),
            box("安徽", 116.0, 29.5, 119.8, 33.8),
            box("江西", 114.5, 24.5, 117.8, 29.8),
            box("福建", 117.0, 23.0, 120.8, 28.0),
            box("辽宁", 120.0, 39.5, 125.5, 43.8),
            box("吉林", 124.0, 41.0, 131.0, 45.5),
            box("黑龙江", 124.0, 44.0, 134.8, 53.5),
            box("台湾", 120.0, 21.5, 122.2, 25.8),
            box("香港", 113.8, 22.1, 114.6, 22.6),
            box("澳门", 113.4, 22.1, 113.7, 22.4),
          ]
        };
      }

      async function ensureChinaMapLoaded(){
        if(typeof echarts === "undefined") return false;
        if(typeof echarts.getMap === "function" && echarts.getMap("china")) return true;
        const urls = [
          "map/china.json",
          "https://unpkg.com/echarts@5/map/json/china.json",
          "https://cdn.jsdelivr.net/npm/echarts@5/map/json/china.json",
        ];
        for(const url of urls){
          try{
            const res = await fetch(url, { cache: "no-store" });
            if(!res.ok) continue;
            const geoJson = await res.json();
            echarts.registerMap("china", geoJson);
            return true;
          }catch{}
        }
        // 离线/内网兜底：注册轻量示意地图
        try{
          echarts.registerMap("china", getSchematicChinaGeoJSON());
          if(typeof location !== "undefined" && location.protocol === "file:"){
            state.mapError = "当前使用离线示意地图：浏览器禁止 file:// 下读取本地 map/china.json。请运行项目根目录的 start.bat 再打开（离线可用）。";
          }else{
            state.mapError = "当前使用离线示意地图（未找到标准省界数据）。";
          }
          return true;
        }catch{}
        return false;
      }

      async function renderLeaderMap(){
        state.mapError = "";
        if(typeof echarts === "undefined"){
          state.mapError = "地图组件未加载（ECharts 不可用）。请检查网络/CDN，或改为本地引入。";
          return;
        }
        const ok = await ensureChinaMapLoaded();
        if(!ok){
          state.mapError = "中国地图数据未加载（china.json 拉取失败）。请检查网络/CDN，或改为本地引入地图数据。";
          return;
        }
        const el = document.getElementById("leader-map");
        if(!el) return;
        // 从其他菜单切回时 leader-map DOM 会重建；若实例仍绑定旧 DOM，需要重建实例
        try{
          if(leaderChart && leaderChart.getDom && leaderChart.getDom() !== el){
            disposeLeaderChart();
          }
        }catch{}
        leaderChart = leaderChart || echarts.init(el, null, { renderer: "canvas" });
        // 点击省份查看
        try{
          leaderChart.off("click");
          leaderChart.on("click", (params) => {
            const name = params && params.name ? params.name : "";
            if(!name) return;
            selectProvince(name);
          });
        }catch{}
        const provinceCoord = {
          "北京":[116.405285,39.904989],
          "天津":[117.190182,39.125596],
          "上海":[121.472644,31.231706],
          "重庆":[106.504962,29.533155],
          "河北":[114.502461,38.045474],
          "山西":[112.549248,37.857014],
          "辽宁":[123.429096,41.796767],
          "吉林":[125.3245,43.886841],
          "黑龙江":[126.642464,45.756967],
          "江苏":[118.767413,32.041544],
          "浙江":[120.153576,30.287459],
          "安徽":[117.283042,31.86119],
          "福建":[119.306239,26.075302],
          "江西":[115.892151,28.676493],
          "山东":[117.000923,36.675807],
          "河南":[113.665412,34.757975],
          "湖北":[114.298572,30.584355],
          "湖南":[112.982279,28.19409],
          "广东":[113.280637,23.125178],
          "广西":[108.320004,22.82402],
          "海南":[110.33119,20.031971],
          "四川":[104.065735,30.659462],
          "贵州":[106.713478,26.578343],
          "云南":[102.712251,25.040609],
          "西藏":[91.132212,29.660361],
          "陕西":[108.948024,34.263161],
          "甘肃":[103.823557,36.058039],
          "青海":[101.778916,36.623178],
          "宁夏":[106.278179,38.46637],
          "新疆":[87.617733,43.792818],
          "内蒙古":[111.670801,40.818311],
          "香港":[114.173355,22.320048],
          "澳门":[113.54909,22.198951],
          "台湾":[121.509062,25.044332],
          // 直辖/省份常见缺省补齐
          "贵州省":[106.713478,26.578343],
        };

        const provinceValue = Object.entries(provinceCounts.value)
          .filter(([name]) => name !== "其他")
          .map(([name, value]) => ({ name, value }));

        const bars = provinceValue
          .filter(p => p.value > 0 && provinceCoord[p.name])
          .map(p => ({ name: p.name, value: [...provinceCoord[p.name], p.value] }));

        const max = provinceValue.reduce((m, x) => Math.max(m, x.value), 0) || 1;
        const heightScale = (v) => {
          // 柱子像素高度（适配 1~max）
          const minH = 10;
          const maxH = 84;
          if(max <= 1) return 46;
          return Math.round(minH + (maxH - minH) * (v / max));
        };

        leaderChart.setOption({
          backgroundColor: "transparent",
          tooltip: {
            trigger: "item",
            formatter: (p) => {
              if(!p) return "";
              const name = p.name || "";
              const v = Array.isArray(p.value) ? (p.value[2] || 0) : (p.value != null ? p.value : 0);
              return `${name}<br/>服务器数量：<b>${v}</b>`;
            }
          },
          geo: {
            map: "china",
            roam: false,
            zoom: 1.08,
            label: {
              show: true,
              color: "rgba(255,255,255,.55)",
              fontSize: 10
            },
            itemStyle: {
              areaColor: "rgba(255,255,255,.04)",
              borderColor: "rgba(255,255,255,.12)",
              borderWidth: 1
            },
            emphasis: {
              label: { color: "rgba(255,255,255,.86)" },
              itemStyle: { areaColor: "rgba(110,231,255,.22)" }
            }
          },
          series: [
            {
              name: "中国地图",
              type: "map",
              geoIndex: 0,
              data: [], // 底图仅展示轮廓，不做填色
              itemStyle: {
                areaColor: "rgba(255,255,255,.035)",
                borderColor: "rgba(255,255,255,.14)",
                borderWidth: 1
              },
              emphasis: {
                itemStyle: { areaColor: "rgba(110,231,255,.12)" }
              }
            },
            {
              name: "柱状",
              type: "custom",
              coordinateSystem: "geo",
              data: bars,
              renderItem: (params, api) => {
                const v = api.value(2) || 0;
                const pt = api.coord([api.value(0), api.value(1)]);
                const h = heightScale(v);
                const w = 10;
                const x = pt[0] - w/2;
                const y = pt[1] - h;
                const color = "rgba(110,231,255,.75)";
                return {
                  type: "group",
                  children: [
                    {
                      type: "rect",
                      shape: { x, y, width: w, height: h, r: 2 },
                      style: { fill: color, stroke: "rgba(255,255,255,.20)", lineWidth: 1, shadowBlur: 10, shadowColor: "rgba(110,231,255,.25)" }
                    },
                    {
                      type: "text",
                      style: {
                        x: pt[0],
                        y: y - 6,
                        text: String(v),
                        fill: "rgba(255,255,255,.82)",
                        font: "12px ui-monospace, Menlo, Consolas, monospace",
                        align: "center",
                        verticalAlign: "bottom"
                      }
                    }
                  ]
                };
              },
              zlevel: 2,
            }
          ]
        }, { notMerge: true });

        leaderChart.resize();
      }

      const activeAlerts = computed(() => {
        const hits = [];
        for(const s of state.servers){
          if(s.status === "offline") continue;
          for(const r of state.rules){
            if(!r.enabled) continue;
            const rate = usageRate(s, r.metric);
            if(evalRuleHit(rate, r.op, r.threshold)){
              hits.push({
                serverId: s.id,
                ip: s.ip,
                ruleName: r.name,
                severity: r.severity,
                metric: r.metric,
                current: pct(rate),
                threshold: r.threshold,
              });
            }
          }
        }
        // more severe first
        const rank = (sev)=> sev === "bad" ? 2 : sev === "warn" ? 1 : 0;
        hits.sort((a,b)=> rank(b.severity) - rank(a.severity));
        return hits;
      });

      const leaderSummary = computed(() => {
        const total = totals.value.total;
        const online = totals.value.online;
        const degraded = totals.value.degraded;
        const offline = totals.value.offline;
        const alertCount = activeAlerts.value.length;
        const cover = Object.keys(provinceCounts.value).filter(k => k !== "其他" && provinceCounts.value[k] > 0).length;
        return { total, online, degraded, offline, alertCount, cover };
      });

      function toast(type, msg){
        state.toast = { type, msg };
        setTimeout(() => { state.toast = null; }, 2400);
      }

      function resetForm(){
        state.form = {
          id: "",
          ip: "",
          cpuCores: 32,
          cpuUsage: 20,
          memGB: 128,
          memUsedGB: 64,
          gpuModel: "",
          gpuCount: 0,
          gpuUsage: 0,
          diskGB: 1024,
          diskUsedGB: 200,
          region: "cn-beijing",
          os: "Ubuntu 22.04",
          tags: "",
          status: "online",
        };
      }

      function openCreate(){
        state.modalMode = "create";
        state.editingId = "";
        resetForm();
        state.modalOpen = true;
      }
      function openEdit(server){
        state.modalMode = "edit";
        state.editingId = server.id;
        state.form = {
          id: server.id,
          ip: server.ip,
          cpuCores: server.cpuCores,
          cpuUsage: pct(server.cpuUsage),
          memGB: server.memGB,
          memUsedGB: server.memUsedGB,
          gpuModel: server.gpuModel || "",
          gpuCount: server.gpuCount || 0,
          gpuUsage: pct(server.gpuUsage),
          diskGB: server.diskGB,
          diskUsedGB: server.diskUsedGB,
          region: server.region || "cn-beijing",
          os: server.os || "Ubuntu 22.04",
          tags: (server.tags || []).join(","),
          status: server.status || "online",
        };
        state.modalOpen = true;
      }
      function closeModal(){ state.modalOpen = false; }

      function normalizeForm(){
        const f = state.form;
        const tags = String(f.tags||"")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 12);
        return {
          id: String(f.id||"").trim(),
          ip: String(f.ip||"").trim(),
          status: f.status,
          cpuCores: Math.max(0, Number(f.cpuCores)||0),
          cpuUsage: clamp01((Number(f.cpuUsage)||0) / 100),
          memGB: Math.max(0, Number(f.memGB)||0),
          memUsedGB: Math.max(0, Number(f.memUsedGB)||0),
          gpuModel: String(f.gpuModel||"").trim(),
          gpuCount: Math.max(0, Number(f.gpuCount)||0),
          gpuUsage: clamp01((Number(f.gpuUsage)||0) / 100),
          diskGB: Math.max(0, Number(f.diskGB)||0),
          diskUsedGB: Math.max(0, Number(f.diskUsedGB)||0),
          region: String(f.region||"").trim(),
          os: String(f.os||"").trim(),
          tags,
          lastSeenAt: nowStr(),
        };
      }

      function validateServer(s){
        if(!s.id) return "请填写服务器ID";
        if(!s.ip) return "请填写IP";
        if(!isValidIp(s.ip)) return "IP格式不正确";
        if(s.memGB <= 0) return "内存(GB)需要大于0";
        if(s.cpuCores <= 0) return "CPU核数需要大于0";
        if(s.gpuCount < 0) return "GPU数量不能为负";
        if(s.memUsedGB > s.memGB) return "已用内存不能大于总内存";
        if(s.diskUsedGB > s.diskGB) return "已用磁盘不能大于总磁盘";
        return "";
      }

      function submitServer(){
        const s = normalizeForm();
        const err = validateServer(s);
        if(err){ toast("bad", err); return; }

        const exists = state.servers.some(x => x.id === s.id);
        if(state.modalMode === "create"){
          if(exists){ toast("bad", "服务器ID已存在"); return; }
          state.servers.unshift(s);
          toast("good", "已新增服务器");
          state.modalOpen = false;
          state.route = "servers";
          return;
        }
        // edit
        const idx = state.servers.findIndex(x => x.id === state.editingId);
        if(idx < 0){ toast("bad", "未找到要编辑的服务器"); return; }
        if(s.id !== state.editingId && exists){ toast("bad", "服务器ID已存在"); return; }
        state.servers[idx] = { ...state.servers[idx], ...s };
        toast("good", "已保存修改");
        state.modalOpen = false;
      }

      function removeServer(server){
        const ok = confirm(`确认删除服务器：${server.id}（${server.ip}）？`);
        if(!ok) return;
        state.servers = state.servers.filter(s => s.id !== server.id);
        toast("good", "已删除");
      }

      function statusBadge(status){
        if(status === "online") return { cls: "good", text: "在线" };
        if(status === "degraded") return { cls: "warn", text: "异常" };
        if(status === "offline") return { cls: "bad", text: "离线" };
        return { cls: "", text: status || "-" };
      }

      function metricName(metric){
        if(metric === "cpu") return "CPU";
        if(metric === "mem") return "内存";
        if(metric === "gpu") return "GPU";
        if(metric === "disk") return "磁盘";
        return metric;
      }

      function openRuleCreate(){
        state.ruleForm = { id: "", name: "", metric: "cpu", op: ">=", threshold: 85, severity: "warn", enabled: true };
        state.ruleModalOpen = true;
      }
      function openRuleEdit(rule){
        state.ruleForm = { ...rule };
        state.ruleModalOpen = true;
      }
      function closeRuleModal(){ state.ruleModalOpen = false; }
      function submitRule(){
        const r = { ...state.ruleForm };
        r.name = String(r.name||"").trim();
        r.threshold = Math.max(0, Math.min(100, Number(r.threshold)||0));
        if(!r.name){ toast("bad", "请填写规则名称"); return; }
        if(!r.metric){ toast("bad", "请选择指标"); return; }
        if(!r.op){ toast("bad", "请选择运算符"); return; }
        if(!r.severity){ toast("bad", "请选择等级"); return; }

        if(!r.id){
          r.id = uid("rule");
          state.rules.unshift(r);
          toast("good", "已新增规则");
          state.ruleModalOpen = false;
          return;
        }
        const idx = state.rules.findIndex(x => x.id === r.id);
        if(idx < 0){ toast("bad", "未找到要编辑的规则"); return; }
        state.rules[idx] = r;
        toast("good", "已保存规则");
        state.ruleModalOpen = false;
      }
      function removeRule(rule){
        const ok = confirm(`确认删除规则：${rule.name}？`);
        if(!ok) return;
        state.rules = state.rules.filter(r => r.id !== rule.id);
        toast("good", "已删除规则");
      }

      // Simulate lastSeen updates in monitor page
      onMounted(() => {
        setInterval(() => {
          const changed = state.servers.map(s => {
            if(s.status === "offline") return s;
            // jitter usage a bit
            const jitter = (x, amp) => clamp01((Number(x)||0) + (Math.random()-0.5)*amp);
            return {
              ...s,
              cpuUsage: jitter(s.cpuUsage, 0.08),
              gpuUsage: jitter(s.gpuUsage, 0.10),
              memUsedGB: Math.max(0, Math.min(s.memGB, (Number(s.memUsedGB)||0) + (Math.random()-0.5)*4)),
              diskUsedGB: Math.max(0, Math.min(s.diskGB, (Number(s.diskUsedGB)||0) + Math.random()*1.2)),
              lastSeenAt: nowStr(),
            };
          });
          state.servers = changed;
        }, 6500);
      });

      // 初次进入 leader 时也需要渲染一次（watch(route) 不会立即触发）
      onMounted(async () => {
        if(state.route !== "leader") return;
        await nextTick();
        await renderLeaderMap();
      });

      onMounted(() => {
        const onResize = () => { try{ leaderChart && leaderChart.resize(); }catch{} };
        window.addEventListener("resize", onResize);
        onBeforeUnmount(() => {
          window.removeEventListener("resize", onResize);
          disposeLeaderChart();
        });
      });

      onMounted(() => {
        const sync = () => {
          const on = isFullscreen();
          state.screenFull = on;
          try{
            document.body.classList.toggle("screen-full", on && state.route === "leader");
          }catch{}
          setTimeout(() => { try{ leaderChart && leaderChart.resize(); }catch{} }, 0);
        };
        document.addEventListener("fullscreenchange", sync);
        document.addEventListener("webkitfullscreenchange", sync);
        sync();
        onBeforeUnmount(() => {
          document.removeEventListener("fullscreenchange", sync);
          document.removeEventListener("webkitfullscreenchange", sync);
          try{ document.body.classList.remove("screen-full"); }catch{}
        });
      });

      watch(() => state.route, async (r) => {
        if(r === "leader"){
          await nextTick();
          await renderLeaderMap();
          // 视图刚显示出来时再 resize 一次，避免宽高为 0
          setTimeout(() => { try{ leaderChart && leaderChart.resize(); }catch{} }, 0);
          try{
            document.body.classList.toggle("screen-full", state.screenFull);
          }catch{}
          return;
        }
        // 离开展示大屏时释放实例，避免绑旧 DOM
        disposeLeaderChart();
        try{ document.body.classList.remove("screen-full"); }catch{}
      });
      watch(() => state.servers, async () => {
        if(state.route !== "leader") return;
        await nextTick();
        await renderLeaderMap();
      }, { deep: true });

      function resetDemo(){
        const ok = confirm("将重置演示数据（覆盖本地录入）？");
        if(!ok) return;
        state.servers = seedServers();
        state.rules = loadAlertRules(); // reload defaults
        toast("good", "已重置演示数据");
      }

      return {
        state,
        menus,
        pageTitle,
        navTo,
        totals,
        avgUsage,
        health,
        serverRegions,
        filteredServers,
        activeAlerts,
        openCreate,
        openEdit,
        closeModal,
        submitServer,
        removeServer,
        statusBadge,
        metricName,
        openRuleCreate,
        openRuleEdit,
        closeRuleModal,
        submitRule,
        removeRule,
        resetDemo,
        pct,
        usageRate,
        topProvinces,
        leaderSummary,
        selectedProvinceName,
        selectedProvinceServers,
        selectedProvinceStats,
        clearProvinceSelection,
        selectProvince,
        toggleScreenFull,
      };
    },
    template: `
      <div class="app">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-badge"></div>
            <div>
              <div class="brand-title">SaaSManager</div>
              <div class="brand-sub">服务器资源管理控制台</div>
            </div>
          </div>
          <nav class="nav">
            <div v-for="m in menus" :key="m.key" class="nav-item" :class="{active: state.route===m.key}" @click="navTo(m.key)">
              <div class="nav-dot"></div>
              <div class="nav-text">
                <div class="nav-title">{{ m.title }}</div>
                <div class="nav-desc">{{ m.desc }}</div>
              </div>
            </div>
          </nav>
          <div style="margin-top:14px; padding:10px 10px 0; color: rgba(255,255,255,.55); font-size:12px;">
            <div class="pill" style="width:100%; justify-content:space-between;">
              <span>演示数据</span>
              <button class="btn ghost" style="height:26px; padding:0 10px;" @click="resetDemo">重置</button>
            </div>
          </div>
        </aside>

        <main class="main">
          <header class="topbar">
            <div class="topbar-left">
              <div class="topbar-title">{{ pageTitle }}</div>
              <div class="topbar-meta">
                <span class="pill"><span class="dot" :class="health.level"></span>健康度：<b>{{ health.text }}</b></span>
                <span class="pill">服务器：<b>{{ totals.total }}</b>（在线 <b>{{ totals.online }}</b> / 异常 <b>{{ totals.degraded }}</b> / 离线 <b>{{ totals.offline }}</b>）</span>
                <span class="pill">活跃告警：<b>{{ activeAlerts.length }}</b></span>
              </div>
            </div>
            <div class="topbar-right" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <span class="pill">CPU均值 <b>{{ pct(avgUsage.cpu) }}%</b></span>
              <span class="pill">内存均值 <b>{{ pct(avgUsage.mem) }}%</b></span>
              <span class="pill">GPU均值 <b>{{ pct(avgUsage.gpu) }}%</b></span>
            </div>
          </header>

          <section class="content" v-if="state.route==='overview'">
            <div class="grid">
              <div class="card" style="grid-column: span 4;">
                <div class="card-header">
                  <div>
                    <div class="card-title">资源池规模</div>
                    <div class="card-subtitle">来自“服务器信息列表”的汇总</div>
                  </div>
                </div>
                <div class="card-body">
                  <div class="stat-row">
                    <div class="stat" style="min-width: 120px;">
                      <div class="stat-value">{{ totals.cpuCores }}</div>
                      <div class="stat-label">CPU 核</div>
                    </div>
                    <div class="stat" style="min-width: 120px;">
                      <div class="stat-value">{{ totals.memGB }}</div>
                      <div class="stat-label">内存 GB</div>
                    </div>
                    <div class="stat" style="min-width: 120px;">
                      <div class="stat-value">{{ totals.gpuCount }}</div>
                      <div class="stat-label">GPU 张</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card" style="grid-column: span 4;">
                <div class="card-header">
                  <div>
                    <div class="card-title">平均占用</div>
                    <div class="card-subtitle">按非离线服务器计算</div>
                  </div>
                </div>
                <div class="card-body kpi">
                  <div class="kpi-item">
                    <div class="name">CPU 使用率</div>
                    <div class="val">{{ pct(avgUsage.cpu) }}%</div>
                  </div>
                  <div class="progress"><i :style="{width: pct(avgUsage.cpu)+'%'}"></i></div>
                  <div class="kpi-item">
                    <div class="name">内存 使用率</div>
                    <div class="val">{{ pct(avgUsage.mem) }}%</div>
                  </div>
                  <div class="progress"><i :style="{width: pct(avgUsage.mem)+'%'}"></i></div>
                  <div class="kpi-item">
                    <div class="name">GPU 使用率</div>
                    <div class="val">{{ pct(avgUsage.gpu) }}%</div>
                  </div>
                  <div class="progress"><i :style="{width: pct(avgUsage.gpu)+'%'}"></i></div>
                </div>
              </div>

              <div class="card" style="grid-column: span 4;">
                <div class="card-header">
                  <div>
                    <div class="card-title">实时告警（Top）</div>
                    <div class="card-subtitle">基于“资源预警”规则计算</div>
                  </div>
                  <button class="btn primary" @click="navTo('alerts')">查看全部</button>
                </div>
                <div class="card-body">
                  <div v-if="activeAlerts.length===0" class="muted">当前无命中规则的告警。</div>
                  <div v-else style="display:flex; flex-direction:column; gap:10px;">
                    <div v-for="(a,i) in activeAlerts.slice(0,4)" :key="i" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                      <div>
                        <div style="font-weight:700;">{{ a.ruleName }}</div>
                        <div class="muted" style="font-size:12px;"><span class="mono">{{ a.serverId }}</span> · <span class="mono">{{ a.ip }}</span></div>
                      </div>
                      <span class="badge" :class="a.severity">{{ a.current }}% / {{ a.threshold }}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card" style="grid-column: span 12;">
                <div class="card-header">
                  <div>
                    <div class="card-title">服务器概览</div>
                    <div class="card-subtitle">快速查看状态与资源占用</div>
                  </div>
                  <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn" @click="navTo('servers')">进入列表</button>
                    <button class="btn primary" @click="openCreate">新增服务器</button>
                  </div>
                </div>
                <div class="card-body" style="padding:0;">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>状态</th>
                        <th>ID</th>
                        <th>IP</th>
                        <th>CPU</th>
                        <th>内存</th>
                        <th>GPU</th>
                        <th>磁盘</th>
                        <th>区域</th>
                        <th>最近心跳</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="s in state.servers.slice(0,6)" :key="s.id">
                        <td><span class="badge" :class="statusBadge(s.status).cls">{{ statusBadge(s.status).text }}</span></td>
                        <td class="mono">{{ s.id }}</td>
                        <td class="mono">{{ s.ip }}</td>
                        <td>{{ pct(s.cpuUsage) }}% · {{ s.cpuCores }}核</td>
                        <td>{{ Math.round((s.memUsedGB/s.memGB)*100) || 0 }}% · {{ s.memUsedGB }}/{{ s.memGB }}GB</td>
                        <td>{{ s.gpuCount ? (pct(s.gpuUsage)+'% · '+s.gpuCount+'x '+(s.gpuModel||'-')) : '-' }}</td>
                        <td>{{ Math.round((s.diskUsedGB/s.diskGB)*100) || 0 }}% · {{ Math.round(s.diskUsedGB) }}/{{ s.diskGB }}GB</td>
                        <td class="mono">{{ s.region }}</td>
                        <td class="mono">{{ s.lastSeenAt }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section class="content" v-else-if="state.route==='leader'">
            <div class="card screen">
              <div class="screen-header">
                <div>
                  <div class="screen-title">展示大屏 · 服务器资源态势</div>
                  <div class="screen-sub">一屏掌握：分布在哪些省、共有多少台、当前使用与告警情况</div>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                  <span class="pill">覆盖省份 <b>{{ leaderSummary.cover }}</b></span>
                  <span class="pill">总服务器 <b>{{ leaderSummary.total }}</b></span>
                  <span class="pill">活跃告警 <b>{{ leaderSummary.alertCount }}</b></span>
                  <button class="btn primary" @click="toggleScreenFull">{{ state.screenFull ? '退出全屏' : '全屏' }}</button>
                </div>
              </div>
              <div class="screen-body">
                <div class="leader-layout">
                  <div class="leader-col">
                    <div class="card" style="box-shadow:none;">
                      <div class="card-header">
                        <div>
                          <div class="card-title">关键指标</div>
                          <div class="card-subtitle">核心数字（来自服务器录入 + 规则命中）</div>
                        </div>
                      </div>
                      <div class="card-body leader-kpi">
                        <div class="k">
                          <div class="t">总服务器</div>
                          <div class="v">{{ leaderSummary.total }}</div>
                          <div class="s">资源池规模</div>
                        </div>
                        <div class="k">
                          <div class="t">覆盖省份</div>
                          <div class="v">{{ leaderSummary.cover }}</div>
                          <div class="s">分布广度</div>
                        </div>
                        <div class="k">
                          <div class="t">在线</div>
                          <div class="v">{{ leaderSummary.online }}</div>
                          <div class="s">运行中</div>
                        </div>
                        <div class="k">
                          <div class="t">异常/离线</div>
                          <div class="v">{{ leaderSummary.degraded + leaderSummary.offline }}</div>
                          <div class="s">需要关注</div>
                        </div>
                        <div class="k">
                          <div class="t">CPU 均值</div>
                          <div class="v">{{ pct(avgUsage.cpu) }}%</div>
                          <div class="s">非离线</div>
                        </div>
                        <div class="k">
                          <div class="t">GPU 均值</div>
                          <div class="v">{{ pct(avgUsage.gpu) }}%</div>
                          <div class="s">非离线</div>
                        </div>
                      </div>
                    </div>

                    <div class="card" style="box-shadow:none;">
                      <div class="card-header">
                        <div>
                          <div class="card-title">使用概览</div>
                          <div class="card-subtitle">平均占用（用于快速判断“忙不忙”）</div>
                        </div>
                      </div>
                      <div class="card-body kpi" style="gap:12px;">
                        <div class="kpi-item"><div class="name">CPU 使用率</div><div class="val">{{ pct(avgUsage.cpu) }}%</div></div>
                        <div class="progress"><i :style="{width: pct(avgUsage.cpu)+'%'}"></i></div>
                        <div class="kpi-item"><div class="name">内存 使用率</div><div class="val">{{ pct(avgUsage.mem) }}%</div></div>
                        <div class="progress"><i :style="{width: pct(avgUsage.mem)+'%'}"></i></div>
                        <div class="kpi-item"><div class="name">GPU 使用率</div><div class="val">{{ pct(avgUsage.gpu) }}%</div></div>
                        <div class="progress"><i :style="{width: pct(avgUsage.gpu)+'%'}"></i></div>
                      </div>
                    </div>
                  </div>

                  <div class="card" style="box-shadow:none; padding:12px;">
                    <div id="leader-map" class="leader-map"></div>
                    <div v-if="state.mapError" class="badge bad" style="margin-top:10px; width:100%; justify-content:flex-start;">
                      {{ state.mapError }}
                    </div>
                    <div class="muted" style="font-size:12px; margin-top:10px; line-height:1.6;">
                      说明：省份数量基于服务器字段 <span class="mono">region</span> 推断（例如 <span class="mono">cn-beijing</span> → 北京）。后续你接入真实采集/CMDB 时，可直接用省份字段精确统计。
                    </div>
                  </div>

                  <div class="leader-col">
                    <div class="card" style="box-shadow:none;">
                      <div class="card-header">
                        <div>
                          <div class="card-title">省份查看</div>
                          <div class="card-subtitle">点击地图省份或 Top 列表，查看该省明细</div>
                        </div>
                        <button v-if="selectedProvinceName" class="btn" @click="clearProvinceSelection">清除选择</button>
                      </div>
                      <div class="card-body">
                        <div v-if="!selectedProvinceName" class="muted" style="line-height:1.8;">
                          当前：<b>全国视角</b>。请点击地图上的省份进行查看。
                        </div>
                        <div v-else>
                          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                            <span class="leader-chip">省份 <b>{{ selectedProvinceName }}</b></span>
                            <span class="leader-chip">服务器 <b>{{ selectedProvinceStats.total }}</b></span>
                            <span class="leader-chip">在线 <b>{{ selectedProvinceStats.online }}</b></span>
                            <span class="leader-chip">异常 <b>{{ selectedProvinceStats.degraded }}</b></span>
                            <span class="leader-chip">离线 <b>{{ selectedProvinceStats.offline }}</b></span>
                          </div>
                          <div class="leader-scroll" style="margin-top:12px;">
                            <table class="table" style="margin:0;">
                              <thead>
                                <tr>
                                  <th>状态</th>
                                  <th>ID</th>
                                  <th>IP</th>
                                  <th>CPU</th>
                                  <th>内存</th>
                                  <th>GPU</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-for="s in selectedProvinceServers" :key="s.id">
                                  <td><span class="badge" :class="statusBadge(s.status).cls">{{ statusBadge(s.status).text }}</span></td>
                                  <td class="mono">{{ s.id }}</td>
                                  <td class="mono">{{ s.ip }}</td>
                                  <td class="mono">{{ pct(s.cpuUsage) }}%</td>
                                  <td class="mono">{{ Math.round((s.memUsedGB/s.memGB)*100) || 0 }}%</td>
                                  <td class="mono">{{ s.gpuCount ? (pct(s.gpuUsage)+'%') : '-' }}</td>
                                </tr>
                                <tr v-if="selectedProvinceServers.length===0">
                                  <td colspan="6" class="muted" style="padding:12px;">该省暂无服务器。</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="card" style="box-shadow:none;">
                      <div class="card-header">
                        <div>
                          <div class="card-title">Top 省份（服务器数量）</div>
                          <div class="card-subtitle">点击可联动右侧省份查看</div>
                        </div>
                      </div>
                      <div class="card-body leader-list">
                        <div v-if="topProvinces.length===0" class="muted">暂无可展示数据。</div>
                        <div v-for="p in topProvinces" :key="p.name" class="row" style="cursor:pointer;" @click="selectProvince(p.name)">
                          <div class="name">{{ p.name }}</div>
                          <div class="val">{{ p.value }}</div>
                        </div>
                      </div>
                    </div>

                    <div class="card" style="box-shadow:none;">
                      <div class="card-header">
                        <div>
                          <div class="card-title">告警概览</div>
                          <div class="card-subtitle">最需要领导关注的风险点</div>
                        </div>
                        <button class="btn primary" @click="navTo('alerts')">去看详情</button>
                      </div>
                      <div class="card-body">
                        <div class="pill" style="width:100%; justify-content:space-between;">
                          <span>活跃告警</span><b>{{ activeAlerts.length }}</b>
                        </div>
                        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
                          <div v-for="(a,i) in activeAlerts.slice(0,4)" :key="i" class="row" style="padding:10px 10px;">
                            <div style="display:flex; flex-direction:column; gap:2px;">
                              <div style="font-weight:800;">{{ a.ruleName }}</div>
                              <div class="muted" style="font-size:12px;"><span class="mono">{{ a.serverId }}</span> · <span class="mono">{{ a.ip }}</span></div>
                            </div>
                            <span class="badge" :class="a.severity">{{ a.current }}%</span>
                          </div>
                          <div v-if="activeAlerts.length===0" class="muted">当前无告警命中。</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="leader-foot">
                  <div class="card" style="box-shadow:none;">
                    <div class="card-header">
                      <div>
                        <div class="card-title">服务器状态</div>
                        <div class="card-subtitle">在线 / 异常 / 离线</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <span class="badge good">在线 {{ totals.online }}</span>
                        <span class="badge warn">异常 {{ totals.degraded }}</span>
                        <span class="badge bad">离线 {{ totals.offline }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="card" style="box-shadow:none;">
                    <div class="card-header">
                      <div>
                        <div class="card-title">资源池容量</div>
                        <div class="card-subtitle">总核数 / 内存 / GPU</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <span class="pill">CPU <b>{{ totals.cpuCores }}</b> 核</span>
                        <span class="pill">内存 <b>{{ totals.memGB }}</b> GB</span>
                        <span class="pill">GPU <b>{{ totals.gpuCount }}</b> 张</span>
                      </div>
                    </div>
                  </div>

                  <div class="card" style="box-shadow:none;">
                    <div class="card-header">
                      <div>
                        <div class="card-title">快速入口</div>
                        <div class="card-subtitle">维护数据 / 查看明细</div>
                      </div>
                    </div>
                    <div class="card-body" style="display:flex; gap:10px; flex-wrap:wrap;">
                      <button class="btn primary" @click="navTo('servers')">维护服务器</button>
                      <button class="btn" @click="navTo('monitor')">状态监控</button>
                      <button class="btn" @click="navTo('overview')">总览</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="content" v-else-if="state.route==='servers'">
            <div class="toolbar">
              <div class="left">
                <button class="btn primary" @click="openCreate">新增服务器</button>
                <input class="input" style="width:260px;" v-model="state.query" placeholder="搜索 ID / IP / GPU / 标签" />
                <select class="input select" v-model="state.statusFilter">
                  <option value="all">全部状态</option>
                  <option value="online">在线</option>
                  <option value="degraded">异常</option>
                  <option value="offline">离线</option>
                </select>
                <select class="input select" v-model="state.regionFilter">
                  <option value="all">全部区域</option>
                  <option v-for="r in serverRegions" :key="r" :value="r">{{ r }}</option>
                </select>
              </div>
              <div class="right">
                <span class="pill">当前结果 <b>{{ filteredServers.length }}</b></span>
              </div>
            </div>

            <div class="card" style="margin-top:12px;">
              <div class="card-header">
                <div>
                  <div class="card-title">服务器信息列表</div>
                  <div class="card-subtitle">录入基础信息（ID / IP / CPU / 内存 / GPU）并用于总览与预警</div>
                </div>
              </div>
              <div class="card-body" style="padding:0;">
                <table class="table">
                  <thead>
                    <tr>
                      <th>状态</th>
                      <th>ID</th>
                      <th>IP</th>
                      <th>CPU</th>
                      <th>内存</th>
                      <th>GPU</th>
                      <th>磁盘</th>
                      <th>标签</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in filteredServers" :key="s.id">
                      <td><span class="badge" :class="statusBadge(s.status).cls">{{ statusBadge(s.status).text }}</span></td>
                      <td class="mono">{{ s.id }}</td>
                      <td class="mono">{{ s.ip }}</td>
                      <td>{{ pct(s.cpuUsage) }}% · {{ s.cpuCores }}核</td>
                      <td>{{ Math.round((s.memUsedGB/s.memGB)*100) || 0 }}% · {{ s.memUsedGB }}/{{ s.memGB }}GB</td>
                      <td>{{ s.gpuCount ? (pct(s.gpuUsage)+'% · '+s.gpuCount+'x '+(s.gpuModel||'-')) : '-' }}</td>
                      <td>{{ Math.round((s.diskUsedGB/s.diskGB)*100) || 0 }}% · {{ Math.round(s.diskUsedGB) }}/{{ s.diskGB }}GB</td>
                      <td class="muted">{{ (s.tags||[]).join(", ") || "-" }}</td>
                      <td style="white-space:nowrap;">
                        <button class="btn" @click="openEdit(s)">编辑</button>
                        <button class="btn danger" @click="removeServer(s)">删除</button>
                      </td>
                    </tr>
                    <tr v-if="filteredServers.length===0">
                      <td colspan="9" class="muted" style="padding:16px;">暂无数据。点击“新增服务器”开始录入。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="content" v-else-if="state.route==='alerts'">
            <div class="grid">
              <div class="card" style="grid-column: span 7;">
                <div class="card-header">
                  <div>
                    <div class="card-title">告警命中列表</div>
                    <div class="card-subtitle">按规则实时计算（演示：每 6.5 秒轻微波动）</div>
                  </div>
                </div>
                <div class="card-body" style="padding:0;">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>等级</th>
                        <th>规则</th>
                        <th>服务器</th>
                        <th>指标</th>
                        <th>当前/阈值</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(a,i) in activeAlerts" :key="i">
                        <td><span class="badge" :class="a.severity">{{ a.severity==='bad'?'严重':(a.severity==='warn'?'警告':'提示') }}</span></td>
                        <td style="font-weight:700;">{{ a.ruleName }}</td>
                        <td class="mono">{{ a.serverId }} · {{ a.ip }}</td>
                        <td>{{ metricName(a.metric) }}</td>
                        <td class="mono">{{ a.current }}% / {{ a.threshold }}%</td>
                      </tr>
                      <tr v-if="activeAlerts.length===0">
                        <td colspan="5" class="muted" style="padding:16px;">当前无告警命中。你可以在右侧调整规则阈值进行验证。</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card" style="grid-column: span 5;">
                <div class="card-header">
                  <div>
                    <div class="card-title">预警规则</div>
                    <div class="card-subtitle">支持启停、阈值与等级</div>
                  </div>
                  <button class="btn primary" @click="openRuleCreate">新增规则</button>
                </div>
                <div class="card-body" style="padding:0;">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>启用</th>
                        <th>规则</th>
                        <th>条件</th>
                        <th>等级</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="r in state.rules" :key="r.id">
                        <td>
                          <input type="checkbox" v-model="r.enabled" />
                        </td>
                        <td style="font-weight:700;">{{ r.name }}</td>
                        <td class="mono">{{ metricName(r.metric) }} {{ r.op }} {{ r.threshold }}%</td>
                        <td><span class="badge" :class="r.severity">{{ r.severity==='bad'?'严重':(r.severity==='warn'?'警告':'提示') }}</span></td>
                        <td style="white-space:nowrap;">
                          <button class="btn" @click="openRuleEdit(r)">编辑</button>
                          <button class="btn danger" @click="removeRule(r)">删除</button>
                        </td>
                      </tr>
                      <tr v-if="state.rules.length===0">
                        <td colspan="5" class="muted" style="padding:16px;">暂无规则。点击“新增规则”。</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section class="content" v-else-if="state.route==='monitor'">
            <div class="card">
              <div class="card-header">
                <div>
                  <div class="card-title">状态监控</div>
                  <div class="card-subtitle">心跳 / 在线状态 / 关键指标（演示用）</div>
                </div>
                <button class="btn" @click="navTo('servers')">去维护服务器信息</button>
              </div>
              <div class="card-body" style="padding:0;">
                <table class="table">
                  <thead>
                    <tr>
                      <th>状态</th>
                      <th>ID</th>
                      <th>IP</th>
                      <th>CPU</th>
                      <th>内存</th>
                      <th>GPU</th>
                      <th>磁盘</th>
                      <th>最近心跳</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in state.servers" :key="s.id">
                      <td><span class="badge" :class="statusBadge(s.status).cls">{{ statusBadge(s.status).text }}</span></td>
                      <td class="mono">{{ s.id }}</td>
                      <td class="mono">{{ s.ip }}</td>
                      <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                          <span class="mono" style="min-width:54px;">{{ pct(s.cpuUsage) }}%</span>
                          <div class="progress" style="flex:1;"><i :style="{width: pct(s.cpuUsage)+'%'}"></i></div>
                        </div>
                      </td>
                      <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                          <span class="mono" style="min-width:54px;">{{ pct(usageRate(s,'mem')) }}%</span>
                          <div class="progress" style="flex:1;"><i :style="{width: pct(usageRate(s,'mem'))+'%'}"></i></div>
                        </div>
                      </td>
                      <td>
                        <div v-if="s.gpuCount" style="display:flex; align-items:center; gap:10px;">
                          <span class="mono" style="min-width:54px;">{{ pct(s.gpuUsage) }}%</span>
                          <div class="progress" style="flex:1;"><i :style="{width: pct(s.gpuUsage)+'%'}"></i></div>
                        </div>
                        <span v-else class="muted">-</span>
                      </td>
                      <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                          <span class="mono" style="min-width:54px;">{{ pct(usageRate(s,'disk')) }}%</span>
                          <div class="progress" style="flex:1;"><i :style="{width: pct(usageRate(s,'disk'))+'%'}"></i></div>
                        </div>
                      </td>
                      <td class="mono">{{ s.lastSeenAt }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="content" v-else>
            <div class="card">
              <div class="card-header">
                <div>
                  <div class="card-title">系统设置（占位）</div>
                  <div class="card-subtitle">建议菜单：用户/权限、通知渠道、标签/分组、审计日志、配置中心、维护计划</div>
                </div>
              </div>
              <div class="card-body">
                <div class="muted" style="line-height:1.8;">
                  这是初版 UI 骨架。下一步可以把“用户与权限、通知（邮件/钉钉/企业微信）、审计日志、标签分组、维护窗口、工单/审批、成本核算/用量统计”等模块逐步补齐，并对接后端 API。
                </div>
              </div>
            </div>
          </section>

          <!-- Server modal -->
          <div v-if="state.modalOpen" class="overlay" @click.self="closeModal">
            <div class="modal">
              <div class="modal-header">
                <div class="modal-title">{{ state.modalMode==='create' ? '新增服务器' : '编辑服务器' }}</div>
                <button class="btn ghost" @click="closeModal">关闭</button>
              </div>
              <div class="modal-body">
                <div class="form">
                  <div class="field">
                    <div class="label">服务器ID *</div>
                    <input class="input" v-model="state.form.id" placeholder="例如：srv-005" />
                    <div class="hint">用于唯一标识、统计聚合、告警关联。</div>
                  </div>
                  <div class="field">
                    <div class="label">IP *</div>
                    <input class="input" v-model="state.form.ip" placeholder="例如：10.10.3.10" />
                    <div class="hint">支持后续对接心跳检测与远程采集。</div>
                  </div>

                  <div class="field small">
                    <div class="label">CPU 核数 *</div>
                    <input class="input" type="number" min="0" v-model="state.form.cpuCores" />
                  </div>
                  <div class="field small">
                    <div class="label">CPU 使用率(%)</div>
                    <input class="input" type="number" min="0" max="100" v-model="state.form.cpuUsage" />
                  </div>
                  <div class="field small">
                    <div class="label">状态</div>
                    <select class="input select" v-model="state.form.status">
                      <option value="online">在线</option>
                      <option value="degraded">异常</option>
                      <option value="offline">离线</option>
                    </select>
                  </div>

                  <div class="field small">
                    <div class="label">内存(GB) *</div>
                    <input class="input" type="number" min="0" v-model="state.form.memGB" />
                  </div>
                  <div class="field small">
                    <div class="label">已用内存(GB)</div>
                    <input class="input" type="number" min="0" v-model="state.form.memUsedGB" />
                  </div>
                  <div class="field small">
                    <div class="label">区域</div>
                    <input class="input" v-model="state.form.region" placeholder="例如：cn-beijing" />
                  </div>

                  <div class="field small">
                    <div class="label">GPU 型号</div>
                    <input class="input" v-model="state.form.gpuModel" placeholder="例如：A100 / L40S" />
                  </div>
                  <div class="field small">
                    <div class="label">GPU 数量 *</div>
                    <input class="input" type="number" min="0" v-model="state.form.gpuCount" />
                  </div>
                  <div class="field small">
                    <div class="label">GPU 使用率(%)</div>
                    <input class="input" type="number" min="0" max="100" v-model="state.form.gpuUsage" />
                  </div>

                  <div class="field small">
                    <div class="label">磁盘(GB)</div>
                    <input class="input" type="number" min="0" v-model="state.form.diskGB" />
                  </div>
                  <div class="field small">
                    <div class="label">已用磁盘(GB)</div>
                    <input class="input" type="number" min="0" v-model="state.form.diskUsedGB" />
                  </div>
                  <div class="field small">
                    <div class="label">操作系统</div>
                    <input class="input" v-model="state.form.os" placeholder="例如：Ubuntu 22.04" />
                  </div>

                  <div class="field full">
                    <div class="label">标签（逗号分隔）</div>
                    <input class="input" v-model="state.form.tags" placeholder="例如：训练,核心池" />
                    <div class="hint">用于分组、筛选、权限隔离、成本分摊等（后续可扩展）。</div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn" @click="closeModal">取消</button>
                <button class="btn primary" @click="submitServer">{{ state.modalMode==='create' ? '确认新增' : '保存修改' }}</button>
              </div>
            </div>
          </div>

          <!-- Rule modal -->
          <div v-if="state.ruleModalOpen" class="overlay" @click.self="closeRuleModal">
            <div class="modal" style="width:min(720px,100%);">
              <div class="modal-header">
                <div class="modal-title">{{ state.ruleForm.id ? '编辑规则' : '新增规则' }}</div>
                <button class="btn ghost" @click="closeRuleModal">关闭</button>
              </div>
              <div class="modal-body">
                <div class="form">
                  <div class="field full">
                    <div class="label">规则名称 *</div>
                    <input class="input" v-model="state.ruleForm.name" placeholder="例如：GPU 使用率过高" />
                  </div>
                  <div class="field small">
                    <div class="label">指标 *</div>
                    <select class="input select" v-model="state.ruleForm.metric">
                      <option value="cpu">CPU</option>
                      <option value="mem">内存</option>
                      <option value="gpu">GPU</option>
                      <option value="disk">磁盘</option>
                    </select>
                  </div>
                  <div class="field small">
                    <div class="label">运算符 *</div>
                    <select class="input select" v-model="state.ruleForm.op">
                      <option value=">=">&gt;=</option>
                      <option value=">">&gt;</option>
                      <option value="<=">&lt;=</option>
                      <option value="<">&lt;</option>
                    </select>
                  </div>
                  <div class="field small">
                    <div class="label">阈值(%) *</div>
                    <input class="input" type="number" min="0" max="100" v-model="state.ruleForm.threshold" />
                  </div>
                  <div class="field small">
                    <div class="label">等级 *</div>
                    <select class="input select" v-model="state.ruleForm.severity">
                      <option value="good">提示</option>
                      <option value="warn">警告</option>
                      <option value="bad">严重</option>
                    </select>
                  </div>
                  <div class="field small">
                    <div class="label">启用</div>
                    <label class="pill" style="height:34px; gap:10px;">
                      <input type="checkbox" v-model="state.ruleForm.enabled" />
                      <span>{{ state.ruleForm.enabled ? '启用' : '停用' }}</span>
                    </label>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn" @click="closeRuleModal">取消</button>
                <button class="btn primary" @click="submitRule">保存</button>
              </div>
            </div>
          </div>

          <div v-if="state.toast" class="overlay" style="background: transparent; pointer-events:none; align-items:flex-start; padding-top: 18px;">
            <div class="pill" style="pointer-events:none; border-color: rgba(255,255,255,.16); background: rgba(10,14,26,.85);">
              <span class="dot" :class="state.toast.type==='good'?'good':(state.toast.type==='warn'?'warn':'bad')"></span>
              <span>{{ state.toast.msg }}</span>
            </div>
          </div>
        </main>
      </div>
    `
  };

  createApp(App).mount("#app");
})();
