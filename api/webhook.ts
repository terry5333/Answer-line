import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  const events = req.body.events;
  if (!events || events.length === 0) {
    res.status(200).send('OK');
    return;
  }

  const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;

  events.forEach(function(event: any) {
    const replyToken = event.replyToken;
    const userId = event.source.userId;

    // 嚴格監聽使用者的「純文字」訊息
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();

      // 👉 切換圖文選單邏輯
      if (text === '社會' || text === '切換社會') {
        if (process.env.MENU_SOCIAL) {
          switchRichMenu(userId, process.env.MENU_SOCIAL, LINE_TOKEN)
            .then(function() { replyText(replyToken, LINE_TOKEN, '✅ 已進入「社會」選單'); })
            .catch(function(e) { console.error(e); });
        }
      } 
      else if (text === '課本' || text === '切換課本') {
        if (process.env.MENU_TEXTBOOK) {
          switchRichMenu(userId, process.env.MENU_TEXTBOOK, LINE_TOKEN)
            .then(function() { replyText(replyToken, LINE_TOKEN, '✅ 已進入「課本」選單'); })
            .catch(function(e) { console.error(e); });
        }
      } 
      else if (text === '主選單' || text === '回主選單') {
        if (process.env.MENU_MAIN) {
          switchRichMenu(userId, process.env.MENU_MAIN, LINE_TOKEN)
            .then(function() { replyText(replyToken, LINE_TOKEN, '🏠 已回到主選單'); })
            .catch(function(e) { console.error(e); });
        }
      } 
      // 👉 科目解答撈取邏輯 (全新科目清單)
      else {
        const subjects = ['國文', '英文', '數學', '歷史', '地理', '公民', '其他'];
        
        if (subjects.includes(text)) {
          db.ref(`answers/${text}`).once('value')
            .then(function(snapshot) {
              if (snapshot.exists()) {
                const ansData = snapshot.val();
                const answerList = Object.values(ansData);
                sendFlexMessage(replyToken, LINE_TOKEN, text, answerList);
              } else {
                replyText(replyToken, LINE_TOKEN, `目前「${text}」還沒有上傳任何解答檔案喔！`);
              }
            })
            .catch(function(error) {
              console.error('資料庫讀取失敗:', error);
            });
        }
      }
    }
  });

  res.status(200).send('OK');
}

// 動態生成圖文卡片
function sendFlexMessage(replyToken: string, token: string | undefined, subject: string, answers: any[]) {
  const buttons = answers.map(function(ans: any) {
    return {
      type: "button",
      style: "secondary",
      margin: "sm",
      height: "sm",
      action: { type: "uri", label: ans.title, uri: ans.url }
    };
  });

  const flexMessage = {
    type: "flex",
    altText: `${subject} 解答列表`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0f172a", // 旗艦深海藍
        contents: [
          { type: "text", text: `${subject} 解答專區`, weight: "bold", color: "#ffffff", size: "xl" },
          { type: "text", text: "請選擇對應的單元或課本", color: "#94a3b8", size: "xs", margin: "md" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: buttons
      }
    }
  };

  axios.post('https://api.line.me/v2/bot/message/reply', {
    replyToken: replyToken,
    messages: [flexMessage]
  }, { headers: { Authorization: `Bearer ${token}` } })
  .then(function() {})
  .catch(function(err) { console.error(err); });
}

// 傳送純文字
function replyText(replyToken: string, token: string | undefined, text: string) {
  axios.post('https://api.line.me/v2/bot/message/reply', {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  }, { headers: { Authorization: `Bearer ${token}` } })
  .then(function() {})
  .catch(function(err) { console.error(err); });
}

// 切換選單指令
function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
