import type { Email, ScheduleItem, SocialPost, Template } from '../types';
import { getWeekDates, toISODate } from '../utils/date';

// 示範模式資料(未連接 Gmail 時顯示);連接後由 useGmail 提供真實郵件。
export function initialEmails(): Email[] {
  return [
    {
      id: 'e1',
      initial: '換',
      sender: '換日線 Crossing 電子報',
      subject: '本週旅遊趨勢:小島慢活正夯',
      date: '07/12',
      tag: '電子報',
      suitable: true,
      snippet:
        '今年夏天,越來越多人選擇離島慢活取代traditional打卡行程,沖繩、澎湖的長住旅宿詢問度大幅上升……',
      fullBody:
        '嗨,小日:\n\n本週電子報想跟你分享一個有趣的趨勢——「離島慢活」正在取代傳統的打卡式旅遊。越來越多讀者留言詢問沖繩、澎湖的長住旅宿選擇,大家開始重視在一個地方待上一週以上的深度體驗,而不是趕行程。\n\n這對經營旅遊內容的創作者來說是很好的題材切角:可以聊聊「慢活行程規劃」、「長住旅宿推薦」、「當地生活步調」等角度。\n\n祝寫作順利!\n換日線 編輯團隊',
    },
    {
      id: 'e2',
      initial: '光',
      sender: '光影香氛 Studio',
      subject: '業配邀約:新品香氛蠟燭試用',
      date: '07/11',
      tag: '合作邀約',
      suitable: true,
      snippet:
        '我們即將推出秋季限定香氛系列,想邀請你試用並分享真實使用心得,提供三款香氛供你挑選……',
      fullBody:
        '小日,你好:\n\n我們是光影香氛 Studio,即將於下個月推出秋季限定香氛蠟燭系列(共三款:雪松、無花果、焦糖燕麥)。看了你過去分享的居家生活內容,覺得調性非常契合,想邀請你試用並分享真實使用心得。\n\n我們可以提供三款正貨讓你挑選,若有興趣歡迎回信討論合作細節與時程。\n\n期待你的回覆!\n光影香氛 商務合作窗口 敬上',
    },
    {
      id: 'e3',
      initial: '雯',
      sender: '讀者 Wenwen',
      subject: 'Re: 上次分享的沖繩行程好詳細!',
      date: '07/10',
      tag: '讀者來信',
      suitable: true,
      snippet:
        '看完你上次分享的沖繩7天行程整理超實用,想問問你推薦的那間民宿現在還有營業嗎……',
      fullBody:
        '小日你好~\n\n我是長期關注你帳號的讀者,上次你分享的沖繩7天慢活行程整理真的超實用,已經照著規劃了下個月的旅程!\n\n想請問你文中推薦的那間本部町民宿現在還有在營業嗎?另外也想知道你推薦的租車方式,想跟身邊朋友分享你的經驗~\n\n謝謝你的分享,期待你更多內容!',
    },
    {
      id: 'e4',
      initial: 'G',
      sender: 'Google 日曆通知',
      subject: '提醒:下週三「創作者線上分享會」',
      date: '07/09',
      tag: '活動通知',
      suitable: false,
      snippet:
        '你已報名參加下週三晚上8點的創作者線上分享會,活動連結將於當天寄出……',
      fullBody:
        '活動提醒:\n\n你已成功報名「創作者線上分享會」,時間為下週三晚間 20:00,講題為「如何用電子報累積忠實讀者」。活動連結將於活動當天上午寄出至你的信箱,請留意收信。',
    },
  ];
}

export function initialTemplates(): Template[] {
  return [
    { id: 't1', category: '節慶祝賀', title: '中秋節祝福', text: '中秋佳節將至 🌕\n感謝這一路上有你們的陪伴,祝大家闔家團圓、平安喜樂!' },
    { id: 't2', category: '節慶祝賀', title: '新年祝福文案', text: '新的一年,願我們都能持續分享生活裡的小美好 ✨\n謝謝你一直以來的支持,新年快樂!' },
    { id: 't3', category: '業配/產品促銷', title: '新品開箱通用文案', text: '最近入手了這個新品,用了兩週想跟大家分享真實心得——\n\n[使用情境] [優點] [使用小提醒]\n\n有興趣的朋友可以參考文末連結 🔗' },
    { id: 't4', category: '業配/產品促銷', title: '限時優惠通知', text: '📢 限時優惠通知\n即日起至本週日,輸入專屬折扣碼即可享優惠,數量有限、售完為止!' },
    { id: 't5', category: '粉絲互動', title: '每週提問互動', text: '這週想問問大家:\n最近生活中有沒有什麼讓你特別有感的小事?留言告訴我,我會挑幾則來回覆 💬' },
    { id: 't6', category: '粉絲互動', title: '感謝追蹤突破里程碑', text: '謝謝每一位一路上的支持 🙏\n我們一起走到了這個里程碑,接下來會持續分享更多用心的內容,敬請期待!' },
    { id: 't7', category: '常見問答', title: '如何提出合作邀約', text: '關於合作邀約,歡迎透過信箱與我聯繫,並附上品牌簡介與合作方向,我會在3個工作天內回覆你 📩' },
    { id: 't8', category: '常見問答', title: '拍攝器材推薦', text: '最近常被問到用什麼器材拍攝,這裡整理給大家:\n相機 / 鏡頭 / 燈光 / 後製軟體,細節可參考置頂貼文。' },
    { id: 't9', category: '感謝訊息', title: '感謝訂閱電子報', text: '謝謝你訂閱我的電子報 💌\n之後會固定與你分享生活觀察與幕後故事,有任何想聊的主題也歡迎回信告訴我!' },
    { id: 't10', category: '感謝訊息', title: '感謝留言互動', text: '看到大家的留言真的很開心,謝謝你們花時間分享想法 🩵\n有你們的參與,分享才更有意義。' },
  ];
}

// 文管庫「文案管理」:完整社群貼文草稿範本,依內容企劃分類。
export function initialCopyTemplates(): Template[] {
  return [
    { id: 'c1', category: '日常分享', title: '週間生活紀錄', text: '這禮拜的日常紀錄 📷\n工作之餘,留了一點時間給自己慢慢喝咖啡、整理陽台的植物。\n\n你這週有沒有留一點時間給自己呢?' },
    { id: 'c2', category: '日常分享', title: '選物分享開場', text: '最近迷上的幾個生活選物,想整理成一篇分享給大家——\n這篇會聊聊挑選的原因跟實際使用心得,慢慢往下滑 👇' },
    { id: 'c3', category: '新品/業配', title: '業配貼文標準架構', text: '【業配】{{品牌名稱}} × 小日子生活誌\n這次和 {{品牌名稱}} 合作,體驗了 {{產品名稱}}。\n\n真實使用心得:\n[使用情境]\n[喜歡的地方]\n[小提醒]\n\n本篇為合作邀請,心得皆為真實使用感受。' },
    { id: 'c4', category: '新品/業配', title: '限定優惠貼文', text: '📣 限定優惠開跑\n這次合作品牌釋出專屬折扣碼給大家,即日起至本週日止,詳情請見貼文連結。' },
    { id: 'c5', category: '活動宣傳', title: '線上直播預告', text: '🔴 直播預告\n這週三晚上八點,我會在線上跟大家聊聊最近的創作心得,也會開放提問,記得先設提醒!' },
    { id: 'c6', category: '活動宣傳', title: '實體活動邀請', text: '📍 活動邀請\n這個月月底有一場小型見面會,想跟長期關注的你們當面聊聊,名額有限,詳情見置頂貼文連結。' },
    { id: 'c7', category: '品牌故事', title: '創作初衷分享', text: '常有人問我當初為什麼開始經營這個帳號——\n其實一開始只是想把生活中喜歡的小事記錄下來,慢慢地才發現有這麼多人也喜歡這樣的步調。謝謝你們的陪伴。' },
    { id: 'c8', category: '品牌故事', title: '年度回顧貼文', text: '回顧這一年 📖\n謝謝這一路上一起經歷的大小事,也謝謝每一位留言、分享的你們。明年會繼續帶來更多用心的內容!' },
  ];
}

// 社群媒體發文歷史(唯讀):正式環境應接各平台發文 API 或內部發文紀錄資料庫。
// 日期以「今天」為基準回推,讓 Dashboard「本月已發佈」等統計隨示範日期自然呈現。
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

export function initialSocialHistory(): SocialPost[] {
  return [
    { id: 'h1', platform: 'fb', title: '夏日離島慢活企劃上線', content: '這次企劃跑了三座離島,整理成一篇完整的慢活指南,連結在留言處 🏝️', date: daysAgo(3), time: '09:00' },
    { id: 'h2', platform: 'ig', title: '選物分享:桌面香氛小物', content: '最近辦公桌上的小確幸,幾款喜歡的香氛小物一次分享給大家 🕯️', date: daysAgo(5), time: '19:30' },
    { id: 'h3', platform: 'threads', title: '週間閒聊:慢慢來也是一種前進', content: '這句話最近很有感觸,想跟大家分享,也想聽聽你們最近的步調如何 🌿', date: daysAgo(8), time: '21:00' },
    { id: 'h4', platform: 'line', title: '本月電子報重點回顧', content: '整理了這個月分享過的幾篇重點內容,給還沒看過的你們一次補齊 📬', date: daysAgo(12), time: '08:00' },
    { id: 'h5', platform: 'fb', title: '讀者提問:如何規劃長住行程', content: '收到很多關於長住行程規劃的提問,這篇整理了我自己的排法給大家參考', date: daysAgo(21), time: '12:00' },
    { id: 'h6', platform: 'ig', title: '合作花絮:秋季香氛蠟燭試用', content: '拍攝花絮先偷偷曝光一點點,正式開箱文下週見 ✨', date: daysAgo(28), time: '20:00' },
  ];
}

// 以「本週」為基準產生示範排程,確保週曆上看得到資料。
export function initialSchedule(): ScheduleItem[] {
  const week = getWeekDates();
  return [
    { id: 's1', date: week[0], time: '09:00', platform: 'fb', title: '夏日離島慢活回顧', status: 'scheduled' },
    { id: 's2', date: week[1], time: '18:30', platform: 'ig', title: '生活好物開箱:秋季香氛蠟燭', status: 'scheduled' },
    { id: 's3', date: week[2], time: '12:00', platform: 'threads', title: '週三閒聊:最近的靈感來源', status: 'draft' },
    { id: 's4', date: week[3], time: '20:00', platform: 'line', title: '本週限定優惠通知', status: 'scheduled' },
    { id: 's5', date: week[5], time: '09:00', platform: 'fb', title: '讀者 Q&A:如何開始經營自媒體', status: 'scheduled' },
  ];
}
