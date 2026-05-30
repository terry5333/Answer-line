import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const action = req.body?.action || req.query?.action;
  const seat = req.body?.seat;
  const lineId = req.body?.lineId;

  if (action === 'check') {
    if (!seat) { res.status(400).json({ success: false, message: '請輸入座號' }); return; }
    db.ref(`students/${seat}`).once('value').then(function(snapshot) {
      if (snapshot.exists()) {
        const sData = snapshot.val();
        if (sData.lineId) { res.status(200).json({ success: false, message: '此座號已被綁定！' }); }
        else { res.status(200).json({ success: true, name: sData.name }); }
      } else { res.status(200).json({ success: false, message: '查無此座號，請確認老師是否建檔' }); }
    }).catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  } 

  if (action === 'confirm') {
    if (!seat || !lineId) { res.status(400).json({ success: false, message: '參數不完整' }); return; }
    db.ref(`students/${seat}`).once('value').then(function(snapshot) {
      const sData = snapshot.val();
      const updates: any = {};
      updates[`students/${seat}/lineId`] = lineId;
      updates[`users/${lineId}`] = { seat: seat, name: sData.name, boundAt: new Date().toISOString() };
      return db.ref().update(updates);
    })
    .then(function() {
      // 🏆 核心秘密武器：在後端直接調用 LINE API 把 6 宮格主選單綁定給這個學生的 LINE ID
      const menuId = process.env.MENU_MAIN || '';
      const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;
      if (menuId && LINE_TOKEN) {
        return axios.post(`https://api.line.me/v2/bot/user/${lineId}/richmenu/${menuId}`, {}, { 
          headers: { Authorization: `Bearer ${LINE_TOKEN}` } 
        })
        // 💡 關鍵修復：統一回傳 Promise.resolve() 讓 TypeScript 閉嘴
        .then(function() {
          return Promise.resolve();
        })
        .catch(function(e) {
          console.error('綁定選單失敗', e);
          return Promise.resolve();
        });
      }
      return Promise.resolve();
    })
    .then(function() { res.status(200).json({ success: true }); })
    .catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  }
  
  res.status(400).json({ success: false, message: '無效的操作' });
}
