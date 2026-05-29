import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // 處理跨域請求
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // 接收前端傳來的動作指令 (GET 或 POST)
  const action = req.body?.action || req.query?.action;

  // 🟢 動作 1：讀取所有學生名單 (對應前端的 loadStudents)
  if (req.method === 'GET' || action === 'list') {
    db.ref('students').once('value')
      .then(function(snapshot) {
        res.status(200).json({ success: true, students: snapshot.val() || {} });
      })
      .catch(function(err) {
        res.status(500).json({ success: false, message: err.message });
      });
    return;
  }

  // 🟢 動作 2：新增學生建檔 (對應前端的 addStudent)
  if (action === 'add') {
    const seat = req.body.seat;
    const name = req.body.name;
    
    if (!seat || !name) { 
      res.status(400).json({ success: false, message: '座號與姓名不得為空' }); 
      return; 
    }

    // 寫入 Firebase 資料庫 (預設 lineId 為 null，等待學生綁定)
    db.ref(`students/${seat}`).set({ name: name, lineId: null })
      .then(function() { 
        res.status(200).json({ success: true }); 
      })
      .catch(function(err) { 
        res.status(500).json({ success: false, message: err.message }); 
      });
    return;
  }

  // 🟢 動作 3：強行解除綁定 (對應前端的 unbindStudent)
  if (action === 'unbind') {
    const seat = req.body.seat;
    const lineId = req.body.lineId;
    
    if (!seat || !lineId) { 
      res.status(400).json({ success: false, message: '缺少座號或 LINE ID' }); 
      return; 
    }

    // 同時清除 students 節點的認證狀態，與 users 節點的紀錄
    const updates: any = {};
    updates[`students/${seat}/lineId`] = null;
    updates[`users/${lineId}`] = null;

    db.ref().update(updates)
      .then(function() { 
        res.status(200).json({ success: true }); 
      })
      .catch(function(err) { 
        res.status(500).json({ success: false, message: err.message }); 
      });
    return;
  }

  // 防呆：如果傳了看不懂的指令
  res.status(400).json({ success: false, message: '無效的系統操作' });
}
