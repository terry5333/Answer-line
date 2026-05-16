import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  
  const { action, seat, lineId, avatarUrl } = req.body;

  // 動作 1：查詢學生姓名 (防呆：檢查該座號是否存在)
  if (action === 'check') {
    db.ref(`students/${seat}`).once('value')
      .then(function(snapshot) {
        if (snapshot.exists()) {
          const studentData = snapshot.val();
          res.status(200).json({ success: true, name: studentData.name, isBound: !!studentData.lineId });
        } else {
          res.status(200).json({ success: false, message: '查無此座號，請先請管理員新增' });
        }
      })
      .catch(function(err) { res.status(500).json({ success: false, message: err.toString() }); });
  } 
  
  // 動作 2：正式執行綁定
  else if (action === 'bind') {
    // 同時更新 students 表與 users 表
    const updates: any = {};
    updates[`students/${seat}/lineId`] = lineId;
    updates[`students/${seat}/avatarUrl`] = avatarUrl || '';
    updates[`users/${lineId}`] = { seat: seat, boundAt: new Date().toISOString() };

    db.ref().update(updates)
      .then(function() { res.status(200).json({ success: true }); })
      .catch(function(err) { res.status(500).json({ success: false, message: err.toString() }); });
  } 
  else {
    res.status(400).json({ success: false, message: '無效的操作' });
  }
}
