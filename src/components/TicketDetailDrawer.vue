<template>
  <el-drawer :visible.sync="visible" title="工单详情" size="50%">
    <el-row>
      <el-col :span="16">
        <el-descriptions border title="工单信息" :column="1" style="margin-bottom:8px;">
          <el-descriptions-item label="工单编号">{{ ticket?.ticketNo }}</el-descriptions-item>
          <el-descriptions-item label="标题">{{ ticket?.title }}</el-descriptions-item>
          <el-descriptions-item label="内容">{{ ticket?.content || '示例内容' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusLabel(ticket?.status) }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="ticket">
          <template v-if="ticket.status === 0">
            <el-form label-width="100px" class="mb-2">
              <el-form-item label="处理人">
                <el-select v-model="dispatchForm.dispatcherId" placeholder="选择处理人"></el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="doDispatch" :loading="dispatchLoading">派单</el-button>
              </el-form-item>
            </el-form>
          </template>
          <template v-else>
            <el-form label-width="100px" class="mb-2">
              <el-form-item label="处理意见">
                <el-input type="textarea" v-model="processForm.remark" rows="4"></el-input>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="doProcess" :loading="processLoading">提交进度</el-button>
              </el-form-item>
            </el-form>
          </template>
        </div>
      </el-col>
      <el-col :span="8">
        <el-timeline>
          <el-timeline-item v-for="log in logs" :key="log.id" :timestamp="log.createTime">
            {{ log.action }} - {{ log.remark }}
          </el-timeline-item>
        </el-timeline>
      </el-col>
    </el-row>
  </el-drawer>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps({ visible: Boolean, ticket: Object })
const emit = defineEmits(['update:visible'])
const visible = props.visible
const ticket = props.ticket
const logs = ref([
  { id: 1, action: '创建', remark: '工单创建成功', createTime: '2026-04-28 10:00' },
  { id: 2, action: '派发', remark: '派发给处理人', createTime: '2026-04-28 12:00' }
])
const dispatchForm = ref({ dispatcherId: null })
const dispatchLoading = ref(false)
const processForm = ref({ remark: '' })
const processLoading = ref(false)

function statusLabel(s){ switch (s){ case 0: return '待派发'; case 1: return '待处理'; case 2: return '处理中'; case 3: return '已解决'; default: return '未知' } }
function doDispatch(){ dispatchLoading.value = true; setTimeout(()=>{ dispatchLoading.value = false; alert('派单提交（静态演示）') }, 400) }
function doProcess(){ processLoading.value = true; setTimeout(()=>{ processLoading.value = false; alert('进度提交（静态演示）') }, 400) }
</script>
