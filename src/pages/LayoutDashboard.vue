<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="card in cards" :key="card.title">
        <el-card shadow="hover" style="min-height:110px;">
          <div style="color:#888; font-size:14px;">{{ card.title }}</div>
          <div style="font-size:28px; font-weight:700; margin-top:8px;">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-divider></el-divider>
    <el-table :data="logs" style="width:100%">
      <el-table-column prop="time" label="最新动态时间" width="180"></el-table-column>
      <el-table-column prop="content" label="动态内容"></el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const cards = ref([
  { title: '总需求', value: 120 },
  { title: '待派发', value: 25 },
  { title: '处理中', value: 40 },
  { title: '已解决', value: 55 }
])
const logs = ref([
  { time: '2026-04-28 10:00', content: '系统初始化完成' },
  { time: '2026-04-28 10:30', content: '工单 TKT-20260428-0001 派发' }
])
</script>
