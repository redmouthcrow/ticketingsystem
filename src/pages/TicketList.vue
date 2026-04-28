<template>
  <div class="ticket-list">
    <el-form inline label-width="60px" class="mb-4">
      <el-form-item label="标题">
        <el-input v-model="filters.title" placeholder="搜索标题" size="small" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" placeholder="全部" size="small" clearable>
          <el-option label="待派发" :value="0"></el-option>
          <el-option label="待处理" :value="1"></el-option>
          <el-option label="处理中" :value="2"></el-option>
          <el-option label="已解决" :value="3"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="时间">
        <el-date-picker v-model="filters.range" type="daterange" size="small"></el-date-picker>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="small" @click="applyFilters">查询</el-button>
        <el-button size="small" @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="actions" style="margin:12px 0;">
      <el-button type="primary" size="small">发起工单</el-button>
      <el-button size="small">导出 Excel</el-button>
    </div>

    <el-table :data="tickets" style="width:100%">
      <el-table-column prop="ticketNo" label="工单编号" width="180"></el-table-column>
      <el-table-column prop="title" label="标题"></el-table-column>
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="tagType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="180"></el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button type="text" size="small" @click="openDetail(row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const filters = ref({ title: '', status: null, range: null })
const tickets = ref([
  { id: 1, ticketNo: 'TKT-20260428-0001', title: '新增需求 A', status: 0, createTime: '2026-04-28 10:00' },
  { id: 2, ticketNo: 'TKT-20260428-0002', title: '修复问题 B', status: 2, createTime: '2026-04-28 11:20' },
  { id: 3, ticketNo: 'TKT-20260427-0003', title: '改进功能 C', status: 3, createTime: '2026-04-27 15:30' }
])

function statusText(s){ switch(s){ case 0: return '待派发'; case 1: return '待处理'; case 2: return '处理中'; case 3: return '已解决'; default: return '未知' } }
function tagType(s){ switch(s){ case 0: return 'danger'; case 1: return 'warning'; case 2: return 'info'; case 3: return 'success'; default: return 'default' } }
function applyFilters(){ /* mock */ }
function resetFilters(){ filters.value = { title: '', status: null, range: null } }
function openDetail(row){ alert('查看工单：' + row.ticketNo); }
</script>
