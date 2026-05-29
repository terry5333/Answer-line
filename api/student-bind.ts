import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  
  const { action, seat, lineId } = req.body;

  // 🟢 動作 1：輸入座號後，查詢姓名
  if (action === 'check') {
    if (!seat) { res.status(400).json({ success: false, message: '請輸入座號' }); return; }

    db.ref(`students/${seat}`).once('value')
      .then(function(snapshot) {
        if (snapshot.exists()) {
          const studentData = snapshot.val();
          // 防呆：檢查是否已經被綁定過了
          if (studentData.lineId) {
            res.status(200).json({ success: false, message: '此座號已被綁定，請洽管理員' });
          } else {
            res.status(200).json({ success: true, name: studentData.name });
          }
        } else {
          res.status(200).json({ success: false, message: '查無此座號，請確認老師是否已建檔' });
        }
      })
      .catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
  } 
  
  // 🟢 動作 2：學生看到姓名無誤，按下確認綁定
  else if (action === 'confirm') {
    if (!seat || !lineId) { res.status(400).json({ success: false, message: '參數不完整' }); return; }

    db.ref(`students/${seat}`).once('value')
      .then(function(snapshot) {
        const studentData = snapshot.val();
        
        // 準備同時更新 students 表與 users 表
        const updates: any = {};
        updates[`students/${seat}/lineId`] = lineId;
        updates[`users/${lineId}`] = { 
          seat: seat, 
          name: studentData.name, 
          boundAt: new Date().toISOString() 
        };

        return db.ref().update(updates);
      })
      .then(function() {
        res.status(200).json({ success: true });
      })
      .catch(function(err) {
        res.status(500).json({ success: false, message: err.message });
      });
  }
}
