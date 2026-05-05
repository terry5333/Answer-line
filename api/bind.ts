// 簡化邏輯範例
if (studentExists) {
  // 1. 更新 Firebase
  await db.ref(`users/${userId}`).set({ stuNo, boundAt: Date.now() });
  
  // 2. 切換圖文選單 (變臉)
  await axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${process.env.MENU_MAIN}`, {}, {
    headers: { 'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN}` }
  });
  
  return res.json({ success: true });
}
