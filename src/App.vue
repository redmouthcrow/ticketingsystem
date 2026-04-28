<template>
  <el-container style="height:100vh;">
    <el-header style="background:#409EFF; color:white; display:flex; align-items:center; gap:16px; padding:0 20px;">
      <div style="font-weight:600;">OnlyUI Demo</div>
      <div style="flex:1"></div>
      <div @click="route='dashboard'" :class="{active: route==='dashboard'}" style="cursor:pointer; padding:6px 12px; border-radius:4px;">仪表盘</div>
      <div @click="route='tickets'" :class="{active: route==='tickets'}" style="cursor:pointer; padding:6px 12px; border-radius:4px;">工单列表</div>
    </el-header>
    <el-main style="padding:16px;">
      <component :is="routeComponent" :ticket="selectedTicket" @close="route='dashboard'"></component>
    </el-main>
  </el-container>
  </template>

<script setup>
import { ref, computed } from 'vue'
import LayoutDashboard from './pages/LayoutDashboard.vue'
import TicketList from './pages/TicketList.vue'

const route = ref('dashboard')
const routeComponent = computed(() => route.value === 'dashboard' ? LayoutDashboard : TicketList)
const selectedTicket = ref(null)

</script>
