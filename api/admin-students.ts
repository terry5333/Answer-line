import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const action = req.body?.action || req.query?.action;

  // 🟢 動作 1：讀取所有學生名單
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

  // 🟢 動作 2：新增學生建檔
  if (action === 'add') {
    const seat = req.body.seat;
    const name = req.body.name;
    
    if (!seat || !name) { 
      res.status(400).json({ success: false, message: '座號與姓名不得為空' }); 
      return; 
    }

    db.ref(`students/${seat}`).set({ name: name, lineId: null })
      .then(function() { 
        res.status(200).json({ success: true }); 
      })
      .catch(function(err) { 
        res.status(500).json({ success: false, message: err.message }); 
      });
    return;
  }

  // 🟢 動作 3：強行解除綁定
  if (action === 'unbind') {
    const seat = req.body.seat;
    const lineId = req.body.lineId;
    
    if (!seat || !lineId) { 
      res.status(400).json({ success: false, message: '缺少座號或 LINE ID' }); 
      return; 
    }

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

  res.status(400).json({ success: false, message: '無效的操作' });
}
