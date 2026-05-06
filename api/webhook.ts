import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

const subjectMap: Record<string, string> = {
  'chinese': '國文', 'math': '數學', 'english': '英文',
  'history': '歷史', 'geography': '地理', 'civics': '公民', 'others': '其他'
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }
  const events = req.body.events;
  if (!events || events.length === 0) { res.status(200).send('OK'); return; }

  const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;

  const tasks = events.map(function(event: any) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId; 

    // 🟢 監聽圖文選單按下去的 Postback 隱藏指令
    if (event.type === 'postback') {
      const data = event.postback.data;
      
      // 我們手動精準解析資料，避免任何格式相容性問題
      let action = '';
      let target = '';
      let subject = '';
      let type = '';

      // 把 "action=switchMenu&target=social" 切開來
      data.split('&').forEach(function(pair: string) {
        const parts = pair.split('=');
        if (parts[0] === 'action') action = parts[1];
        if (parts[0] === 'target') target = parts[1];
        if (parts[0] === 'subject') subject = parts[1];
        if (parts[0] === 'type') type = parts[1];
      });

      // 🎯 動作 A：切換選單
      if (action === 'switchMenu' || action === 'switch') {
        let targetMenuId = '';
        let menuName = '';

        if (target === 'social') { targetMenuId = process.env.MENU_SOCIAL || ''; menuName = '社會'; }
        else if (target === 'textbook') { targetMenuId = process.env.MENU_TEXTBOOK || ''; menuName = '課本'; }
        else if (target === 'main') { targetMenuId = process.env.MENU_MAIN || ''; menuName = '主選單'; }

        // 如果金鑰有填好，就執行切換
        if (targetMenuId && userId) {
          return switchRichMenu(userId, targetMenuId, LINE_TOKEN)
            .then(function() { 
              // 切換成功，安靜不說話
              return Promise.resolve(); 
            })
            .catch(function(err) {
              return replyText(replyToken, LINE_TOKEN, `❌ 切換失敗，LINE 官方報錯: ${err.message}`);
            });
        } else {
          // ⚠️ 抓到了！如果是金鑰沒填，立刻告訴組長！
          return replyText(replyToken, LINE_TOKEN, `⚠️ 系統錯誤：Vercel 裡面沒有設定 MENU_${target.toUpperCase()} 的金鑰 ID！`);
        }
      } 
      
      // 🎯 動作 B：查詢解答
      else if (action === 'listAnswers' || action === 'list') {
        const dbSubject = subjectMap[subject] || subject; 
        if (!dbSubject) return replyText(replyToken, LINE_TOKEN, `⚠️ 指令缺少科目名稱: ${data}`);
        
        return fetchData('answers', dbSubject, replyToken, LINE_TOKEN, `${dbSubject} 解答專區`);
      }

      // 🎯 動作 C：查詢課本
      else if (action === 'view') {
        const dbSubject = subjectMap[subject] || subject;
        if (type === 'textbook') {
          return fetchData('textbooks', dbSubject, replyToken, LINE_TOKEN, `${dbSubject} 課本專區`);
        }
      }

      // ⚠️ 抓到了！如果指令完全對不上，把指令印出來給組長看！
      else {
        return replyText(replyToken, LINE_TOKEN, `⚠️ 收到未識別的選單指令: [ ${data} ]，請檢查 JSON 設定。`);
      }
    }
    
    // 如果是傳送純文字
    else if (event.type === 'message' && event.message.type === 'text') {
       const text = event.message.text.trim();
       if (text === '主選單' || text === '回主選單') {
          const mainId = process.env.MENU_MAIN || '';
          if (mainId && userId) return switchRichMenu(userId, mainId, LINE_TOKEN);
          else return replyText(replyToken, LINE_TOKEN, `⚠️ 尚未設定 MENU_MAIN 金鑰`);
       }
    }

    return Promise.resolve();
  });

  Promise.all(tasks)
    .then(function() { res.status(200).send('OK'); })
    .catch(function() { res.status(500).send('Error'); });
}

// === 去 Firebase 抓資料的模組 ===
function fetchData(dbNode: string, subject: string, replyToken: string, token: string | undefined, titlePrefix: string) {
  return db.ref(`${dbNode}/${subject}`).once('value')
    .then(function(snapshot) {
      if (snapshot.exists()) {
        const dataList = Object.values(snapshot.val());
        return sendFilesMessage(replyToken, token, titlePrefix, dataList);
      } else {
        // ⚠️ 抓到了！如果 Firebase 裡面沒這個科目的資料，就誠實說！
        return replyText(replyToken, token, `❌ Firebase 資料庫的 [ ${dbNode}/${subject} ] 目前沒有任何檔案喔！請先去網頁後台上傳。`);
      }
    });
}

// === 傳送 LINE 動態卡片 ===
function sendFilesMessage(replyToken: string, token: string | undefined, titleText: string, items: any[]) {
  const buttons = items.map(function(item: any) {
    return { type: "button", style: "secondary", margin: "sm", height: "sm", action: { type: "uri", label: item.title, uri: item.url } };
  });

  const flexMessage = {
    type: "flex", altText: titleText,
    contents: {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#111111",
        contents: [
          { type: "text", text: titleText, weight: "bold", color: "#ffffff", size: "xl" },
          { type: "text", text: "點擊下方按鈕開啟檔案", color: "#aaaaaa", size: "xs", margin: "md" }
        ]
      },
      body: { type: "box", layout: "vertical", spacing: "md", contents: buttons }
    }
  };

  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } });
}

function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
}

function replyText(replyToken: string, token: string | undefined, text: string) {
  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [{ type: 'text', text: text }] }, { headers: { Authorization: `Bearer ${token}` } });
}
