import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

const subjectMap: Record<string, string> = {
  'chinese': '國文',
  'math': '數學',
  'english': '英文',
  'others': '其他'
};

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

    // 處理圖文選單按下去的 Postback 事件
    if (event.type === 'postback') {
      const data = event.postback.data;
      const params = new URLSearchParams(data);
      const action = params.get('action');

      if (action === 'listAnswers') {
        const subjectKey = params.get('subject') || '';
        const dbSubject = subjectMap[subjectKey] || subjectKey;

        // 嚴格使用 Callback 讀取資料庫
        db.ref(`answers/${dbSubject}`).once('value')
          .then(function(snapshot) {
            if (snapshot.exists()) {
              const ansData = snapshot.val();
              const answerList = Object.values(ansData);
              sendFlexMessage(replyToken, LINE_TOKEN, dbSubject, answerList);
            } else {
              replyText(replyToken, LINE_TOKEN, `目前「${dbSubject}」還沒有上傳任何解答喔！`);
            }
          })
          .catch(function(error) {
            console.error('資料庫讀取失敗:', error);
          });
      } 
      else if (action === 'switchMenu') {
        const target = params.get('target');
        let targetMenuId = '';
        let menuName = '';

        if (target === 'social') {
          targetMenuId = process.env.MENU_SOCIAL || '';
          menuName = '社會';
        } else if (target === 'textbook') {
          targetMenuId = process.env.MENU_TEXTBOOK || '';
          menuName = '課本';
        }

        if (targetMenuId) {
          switchRichMenu(userId, targetMenuId, LINE_TOKEN)
            .then(function() {
              replyText(replyToken, LINE_TOKEN, `✅ 已為您切換至「${menuName}」選單`);
            })
            .catch(function(err) {
              console.error('切換選單失敗', err);
            });
        } else {
          replyText(replyToken, LINE_TOKEN, `⚠️ 系統尚未在 Vercel 設定「${menuName}」選單的 ID (MENU_SOCIAL / MENU_TEXTBOOK)`);
        }
      }
    }
    // 備用：支援手動輸入文字
    else if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const subjects = ['國文', '英文', '數學', '社會', '自然', '其他'];

      if (subjects.includes(text)) {
        db.ref(`answers/${text}`).once('value')
          .then(function(snapshot) {
            if (snapshot.exists()) {
              const ansData = snapshot.val();
              const answerList = Object.values(ansData);
              sendFlexMessage(replyToken, LINE_TOKEN, text, answerList);
            } else {
              replyText(replyToken, LINE_TOKEN, `目前「${text}」還沒有上傳任何解答喔！`);
            }
          })
          .catch(function(error) {
            console.error('資料庫讀取失敗:', error);
          });
      }
    }
  });

  res.status(200).send('OK');
}

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
        backgroundColor: "#111111",
        contents: [
          { type: "text", text: `${subject} 專區`, weight: "bold", color: "#ffffff", size: "xl" },
          { type: "text", text: "點擊下方按鈕開啟解答檔案", color: "#aaaaaa", size: "xs", margin: "md" }
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

function replyText(replyToken: string, token: string | undefined, text: string) {
  axios.post('https://api.line.me/v2/bot/message/reply', {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  }, { headers: { Authorization: `Bearer ${token}` } })
  .then(function() {})
  .catch(function(err) { console.error(err); });
}

function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
