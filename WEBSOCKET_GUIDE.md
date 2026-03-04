# WebSocket 即時協作指南

## 概述

本系統使用 Socket.io 實現多人即時協作功能。當任何使用者對案件進行操作時，所有在線使用者的畫面都會自動同步更新，無需手動刷新。

## 架構設計

### 後端架構

**伺服器端 (server/_core/index.ts)**
- 使用 Socket.io 建立 WebSocket 伺服器
- 監聽客戶端連接與事件
- 廣播事件至所有連接的客戶端

**事件廣播 (server/routers.ts)**
- 在 tRPC 路由中發送 WebSocket 事件
- 新增案件時發送 `case:created` 事件
- 更新狀態時發送 `case:updated` 事件
- 刪除案件時發送 `case:deleted` 事件

### 前端架構

**WebSocket Hook (client/src/hooks/useWebSocket.ts)**
- 建立 Socket.io 客戶端連接
- 提供 `subscribe` 方法訂閱事件
- 提供 `emit` 方法發送事件
- 自動處理重連機制

**案件清單 (client/src/pages/CaseList.tsx)**
- 使用 `useWebSocket` hook 監聽事件
- 當接收到事件時自動重新查詢案件列表
- 顯示即時的操作通知

## 事件流程

### 新增案件流程

```
使用者輸入案號
    ↓
點擊「新增案件」按鈕
    ↓
前端調用 trpc.cases.create
    ↓
後端驗證並保存案件
    ↓
後端發送 case:created 事件
    ↓
所有客戶端接收事件
    ↓
所有客戶端自動重新查詢案件列表
    ↓
所有畫面同步更新
```

### 更新狀態流程

```
使用者選擇新狀態
    ↓
點擊「確認變更」按鈕
    ↓
前端調用 trpc.cases.updateStatus
    ↓
後端驗證並更新狀態
    ↓
後端發送 case:updated 事件
    ↓
所有客戶端接收事件
    ↓
所有客戶端自動重新查詢案件列表
    ↓
所有畫面同步更新
```

## WebSocket 事件定義

### case:created
**發送方**：後端（新增案件後）
**接收方**：所有客戶端
**數據結構**：
```typescript
{
  caseNumber: string;      // 案號，例如 "101815A00001"
  createdBy: number;       // 建檔者 user id
  createdAt: Date;         // 建檔時間
}
```

### case:updated
**發送方**：後端（更新狀態後）
**接收方**：所有客戶端
**數據結構**：
```typescript
{
  caseId: number;          // 案件 ID
  status: string;          // 新狀態
  operatorId: number;      // 操作人 user id
  reason?: string;         // 擲回原因（可選）
  updatedAt: Date;         // 更新時間
}
```

### case:deleted
**發送方**：後端（刪除案件後）
**接收方**：所有客戶端
**數據結構**：
```typescript
{
  caseId: number;          // 被刪除的案件 ID
}
```

## 使用方式

### 在組件中使用 WebSocket

```typescript
import { useWebSocket } from "@/hooks/useWebSocket";

export default function MyComponent() {
  const { subscribe, emit, isConnected } = useWebSocket();

  useEffect(() => {
    // 訂閱事件
    const unsubscribe = subscribe("case:created", (data) => {
      console.log("新增案件:", data);
      // 處理事件
    });

    // 清理
    return unsubscribe;
  }, [subscribe]);

  return (
    <div>
      {isConnected ? "已連接" : "未連接"}
    </div>
  );
}
```

## 連接參數

Socket.io 客戶端使用以下配置：
- **路徑**：`/socket.io`
- **重連延遲**：1000ms
- **最大重連延遲**：5000ms
- **重連嘗試次數**：5 次

## 故障排除

### 連接失敗

**症狀**：客戶端無法連接到 WebSocket 伺服器

**解決方案**：
1. 檢查伺服器是否正常運行
2. 檢查防火牆設置
3. 查看瀏覽器控制台的錯誤訊息
4. 確保 Socket.io 路由正確配置

### 事件未接收

**症狀**：其他客戶端的操作未在本客戶端顯示

**解決方案**：
1. 檢查事件監聽是否正確設置
2. 檢查後端是否正確發送事件
3. 查看瀏覽器網路標籤中的 WebSocket 訊息
4. 檢查是否有 JavaScript 錯誤

### 連接斷開

**症狀**：WebSocket 連接意外斷開

**解決方案**：
1. 檢查網路連接
2. 查看伺服器日誌
3. 檢查是否有超時設置
4. 確保重連機制正常工作

## 性能優化

### 推薦做法

1. **批量更新**：避免頻繁的小更新，考慮批量操作
2. **事件去重**：在客戶端檢查是否已處理相同事件
3. **連接管理**：在組件卸載時正確清理訂閱

### 不推薦做法

1. **頻繁發送事件**：避免每次鍵盤輸入都發送事件
2. **大量數據傳輸**：避免在事件中傳輸大型對象
3. **忽略連接狀態**：始終檢查連接狀態後再操作

## 安全考慮

1. **身份驗證**：Socket.io 連接使用現有的 HTTP 會話進行身份驗證
2. **授權**：後端在發送事件前驗證使用者權限
3. **數據驗證**：所有事件數據都在後端進行驗證
4. **速率限制**：建議實現事件發送的速率限制

## 監控與日誌

### 伺服器日誌

```
[WebSocket] User connected: socket_id
[WebSocket] Case created: case_number
[WebSocket] Case updated: case_id
[WebSocket] Case deleted: case_id
[WebSocket] User disconnected: socket_id
```

### 客戶端日誌

在瀏覽器控制台中查看：
- 連接狀態
- 接收的事件
- 連接錯誤

## 測試

### 單元測試

運行 WebSocket 測試：
```bash
pnpm test server/websocket.test.ts
```

### 集成測試

手動測試多人協作：
1. 打開多個瀏覽器標籤頁
2. 在一個標籤頁中新增或修改案件
3. 驗證其他標籤頁是否自動更新

## 未來改進

1. **離線支持**：實現本地緩存和離線同步
2. **衝突解決**：處理多人同時編輯的衝突
3. **事件持久化**：記錄所有事件以便審計
4. **實時通知**：添加聲音或桌面通知
5. **用戶在線狀態**：顯示當前在線使用者列表
