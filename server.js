const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

// Load data files
let SCHEDULES = {};
let WEEKLY_SCHEDULES = {};
try { SCHEDULES = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'schedules.json'), 'utf8')); } catch(e) { console.error('schedules.json load error'); }
try { WEEKLY_SCHEDULES = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'weekly.json'), 'utf8')); } catch(e) { console.error('weekly.json load error'); }

// In-memory store
let store = { accounts: [
  { id:'personal-ip', name:'个人IP号', displayName:'江苏兆辉防腐·李工', type:'personal-ip', avatar:'👨‍🔧', followers:0, status:'active', bio:'15年防腐工程师 | 专注板衬四氟/钢衬PE.PO | 分享真实防腐知识' },
  { id:'factory-daily', name:'工厂日常号', displayName:'兆辉防腐工厂直击', type:'factory-daily', avatar:'🏭', followers:0, status:'active', bio:'江苏兆辉防腐科技 | 带你看真实的防腐设备生产全过程' }
], dailyTasks:{}, contentCalendar:[], analytics:{} };

// Load saved store
const STORE_PATH = path.join(DATA_DIR, 'store.json');
try { if (fs.existsSync(STORE_PATH)) { const s = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); store = { ...store, ...s }; } } catch(e) {}

function saveStore() {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2)); } catch(e) { console.error('save error'); }
}

// MIME types
const MIME = {
  '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8', '.js':'application/javascript;charset=utf-8',
  '.json':'application/json;charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.txt':'text/plain;charset=utf-8'
};

// DeepSeek API call
function callDeepSeek(apiKey, systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 4000
    });
    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.choices && result.choices[0]) {
            resolve({ success:true, content: result.choices[0].message.content, model: result.model });
          } else {
            resolve({ success:false, error: result.error?.message || 'API返回异常' });
          }
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch(e) { resolve({}); }
    });
  });
}

// Route handler
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API routes
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json;charset=utf-8');

    try {
      // GET /api/schedules/:accountId
      const schedMatch = pathname.match(/^\/api\/schedules\/([^\/]+)$/);
      if (schedMatch && method === 'GET') {
        const s = SCHEDULES[schedMatch[1]];
        if (!s) { res.writeHead(404); res.end(JSON.stringify({error:'Not found'})); return; }
        res.writeHead(200); res.end(JSON.stringify(s));
        return;
      }

      // GET /api/schedules/:accountId/weekly
      const weeklyMatch = pathname.match(/^\/api\/schedules\/([^\/]+)\/weekly$/);
      if (weeklyMatch && method === 'GET') {
        const w = WEEKLY_SCHEDULES[weeklyMatch[1]];
        if (!w) { res.writeHead(404); res.end(JSON.stringify({error:'Not found'})); return; }
        res.writeHead(200); res.end(JSON.stringify(w));
        return;
      }

      // GET /api/accounts
      if (pathname === '/api/accounts' && method === 'GET') {
        res.writeHead(200); res.end(JSON.stringify(store.accounts));
        return;
      }

      // POST /api/generate
      if (pathname === '/api/generate' && method === 'POST') {
        const body = await parseBody(req);
        const { apiKey, type, params } = body;
        if (!apiKey) { res.writeHead(400); res.end(JSON.stringify({error:'请先配置DeepSeek API密钥'})); return; }

        let systemPrompt, userPrompt;
        if (type === 'script') {
          systemPrompt = '你是江苏兆辉防腐科技有限公司的资深防腐工程师，有15年行业经验。你在抖音上做个人IP账号，分享防腐技术知识。你的风格：专业但不枯燥，用通俗易懂的语言讲透防腐技术。你的目标受众：化工企业老板、采购经理、设备工程师。重要：内容要真实、专业、有实用价值，不做虚假宣传。';
          userPrompt = '请帮我写一篇抖音口播短视频脚本，时长1-2分钟（300-500字）。选题方向：' + (params.topic||'防腐设备选型') + '\n核心观点：' + (params.viewpoint||'') + '\n脚本要求：1.前3秒要抓人眼球 2.中间用真实案例或技术逻辑支撑观点 3.结尾引导互动 4.语言口语化，适合口播 5.标注重点强调的地方和语气变化\n\n请直接输出完整的口播脚本。';
        } else if (type === 'caption') {
          systemPrompt = '你是抖音工厂实拍账号的运营者，专注于展示防腐设备制造全流程。你的风格：简洁有力、真实接地气。';
          userPrompt = '请为以下工厂实拍视频写发布文案和话题标签。\n视频内容：' + (params.content||'工厂生产/设备展示') + '\n设备类型：' + (params.equipment||'') + '\n核心亮点：' + (params.highlight||'') + '\n\n文案要求：1.一句话亮点（15字以内）2.详细描述（30-50字）3.5-8个精准话题标签 4.如有需要可配一句引导互动\n\n请直接输出完整的发布文案。';
        } else if (type === 'title') {
          systemPrompt = '你是短视频爆款标题专家，擅长写高点击率的抖音视频标题。';
          userPrompt = '请为以下主题生成5个爆款标题：\n主题：' + (params.topic||'防腐设备') + '\n目标人群：' + (params.audience||'化工企业') + '\n视频类型：' + (params.videoType||'口播/实拍') + '\n\n要求：1.每个标题前5个字必须抓眼球 2.包含数字或强烈情绪词 3.包含目标人群关键词 4.参考抖音爆款标题公式\n\n每行一个标题。';
        } else if (type === 'weeklyPlan') {
          systemPrompt = '你是短视频运营专家，擅长为工业品抖音账号做内容规划。';
          userPrompt = '请为江苏兆辉防腐科技有限公司的抖音账号做下周5天的内容选题规划。\n账号类型：' + (params.accountType === 'personal-ip' ? '个人技术IP号' : '工厂实拍日常号') + '\n本周数据反馈：' + (params.weeklyFeedback||'无特殊数据') + '\n\n请输出：1.周一至周五每天1条选题 2.每条选题的核心观点/拍摄思路 3.为什么选这个话题 4.预期数据目标';
        } else if (type === 'keywordplan') {
          systemPrompt = '你是江苏兆辉防腐科技有限公司的抖音运营专家。你需要为一个双账号运营团队做本周内容规划。公司主营：板衬四氟、钢衬PE、钢衬PO储罐、反应釜、塔器、管道管件等防腐设备。\n\n两个账号：\n1. 个人IP号（江苏兆辉防腐·李工）：资深防腐工程师，技术专家形象，内容专业但不枯燥\n2. 工厂日常号（兆辉防腐工厂直击）：工厂一线视角，展示真实生产全过程\n\n请围绕用户指定的本周关键词，为两个账号分别规划周一至周五每天的内容。';
          userPrompt = '本周关键词：' + (params.keyword || '防腐设备') + '\n\n请按以下JSON格式输出，不要加markdown代码块，只输出纯JSON：\n{\n  "keyword": "本周关键词",\n  "personalIP": [\n    { "day": "周一", "topic": "选题", "content": "内容描述", "keyMessage": "核心信息", "scriptHook": "开场钩子", "hashtags": ["#标签1","#标签2"] }\n  ],\n  "factoryDaily": [\n    { "day": "周一", "topic": "选题", "content": "拍摄内容", "shootingFocus": "拍摄重点", "hashtags": ["#标签1","#标签2"] }\n  ],\n  "sharedHashtags": ["#通用标签"],\n  "weeklyGoal": "本周运营目标",\n  "publishingTips": "发布策略建议"\n}\n\n注意：personalIP和factoryDaily各5条（周一至周五），每条内容要具体、可执行、紧扣关键词。';
                } else if (type === 'hottopics') {
          systemPrompt = '你是抖音内容分析专家，每天都在追踪抖音全网热门爆款视频。你的任务是分析当前抖音上最火的视频/话题，并为账号提供跟拍模仿建议。\n\n公司背景：江苏兆辉防腐科技（板衬四氟/钢衬PE/钢衬PO储罐/反应釜/塔器/管道管件）\n\n两个账号：\n1. 个人IP号「江苏兆辉防腐·李工」：资深防腐工程师技术IP，口播为主，需要追热点拍视频吸粉\n2. 工厂日常号「兆辉防腐工厂直击」：工厂实拍账号\n\n注意：热点不需要局限在工业/化工行业！可以是任何抖音上爆火的视频类型（搞笑、情感、知识、生活等），只要能够改编成与防腐设备行业相关的内容即可。重点是分析爆款视频的结构和公式，让他们可以模仿跟拍。';
          userPrompt = '本周关键词：' + (params.keyword || '防腐设备') + '\n\n请列出当前抖音上最火的6-8个热点话题/爆款视频类型（不限于任何行业），每个包含：\n1. 热点标题（如"xx话题登上热搜""xx类型视频爆火"）\n2. 热度等级（🔥🔥🔥高/🔥🔥中/🔥低）\n3. 话题来源（抖音热搜/抖音推荐流/热门BGM/热门挑战等）\n4. 爆款原因分析（这个视频为什么火？前3秒是什么？结构是什么？）\n5. 改编建议（如果我们的防腐设备账号要跟拍这个热点，应该怎么改编？）\n6. 推荐跟拍账号（personal-ip个人IP号 / factory-daily工厂号 / both双账号）\n\n只输出纯JSON，不要markdown：\n{\n  "hotTopics": [\n    {\n      "title":"热点标题",\n      "heat":"🔥🔥🔥",\n      "source":"来源",\n      "viralReason":"爆款原因分析（详细）",\n      "adaptationSuggestion":"改编建议",\n      "suggestedAccount":"both"\n    }\n  ],\n  "trendingFormats":["当前流行的视频格式1","格式2"],\n  "trendingBGM":["热门BGM1"],\n  "generalTip":"整体追热点策略建议"\n}';
        } else if (type === 'trendjack') {
          systemPrompt = '你是抖音工业品短视频爆款策划专家。根据一个热点话题，为一个特定账号策划"蹭热点"的完整内容方案。\n\n公司：江苏兆辉防腐科技\n\n账号：personal-ip=防腐工程师技术IP（口播为主），factory-daily=工厂一线视角（实拍为主）\n\n要求：内容必须与账号定位高度匹配，提供可执行的拍摄方案，24小时内能落地。';
          userPrompt = '本周关键词：' + (params.keyword || '防腐设备') + '\n\n热点话题：' + (params.topic || '') + '\n目标账号：' + (params.account || 'personal-ip') + '\n\n只输出纯JSON，不要markdown：\n{\n  "hotTopic":"热点",\n  "account":"账号id",\n  "videoTitle":"视频标题",\n  "angle":"蹭热点角度",\n  "script":"完整拍摄脚本/口播文案（200-400字）",\n  "shootingGuide":"拍摄指导",\n  "caption":"发布文案",\n  "hashtags":["#标签1"],\n  "publishTime":"建议时间",\n  "whyThisWorks":"为什么能蹭到流量"\n}';
                } else if (type === 'analyzeVideo') {
          systemPrompt = '你是抖音爆款视频分析专家。你的任务是分析一个抖音视频的结构和爆款公式，让用户能够理解和模仿。\n\n你需要分析：\n1. 视频的整体结构（前3秒钩子→内容展开→互动引导）\n2. 拍摄手法（镜头运用、画面风格）\n3. 文案和脚本技巧\n4. 为什么会火（爆款逻辑分析）\n5. 如果工业品/防腐设备账号要借鉴，应该怎么做\n\n输出要具体、可执行，不要泛泛而谈。';
          userPrompt = '视频描述/账号：' + (params.videoDesc || '') + '\n\n请按以下JSON格式输出，不要markdown：\n{\n  "videoType":"视频类型",\n  "hook":"前3秒钩子分析（具体说了什么/做了什么让人想看下去）",\n  "structure":"整体结构拆解（分步骤说明）",\n  "editingStyle":"剪辑风格（节奏、转场、特效、字幕等）",\n  "scriptHighlights":"文案亮点（金句、痛点、情绪点）",\n  "whyViral":"爆款原因（为什么这个视频能火）",\n  "keyFormula":"核心公式（一句话总结这个视频的爆款公式）",\n  "adaptation":"防腐设备账号如何借鉴（具体的跟拍方案）"\n}';
        } else if (type === 'analyzeAccount') {
          systemPrompt = '你是抖音账号深度分析专家。你的任务是分析一个抖音账号的内容策略和运营方法，为同类型账号提供借鉴。\n\n分析维度：\n1. 账号定位和人设\n2. 内容支柱和选题方向\n3. 视频风格和制作水平\n4. 发布频率和互动策略\n5. 粉丝画像和变现路径\n6. 值得学习的地方和可以改进的地方';
          userPrompt = '对标账号名称/描述：' + (params.accountName || '') + '\n\n请按以下JSON格式输出，不要markdown：\n{\n  "accountName":"账号名称",\n  "positioning":"账号定位和人设",\n  "contentPillars":["内容支柱1","内容支柱2","内容支柱3"],\n  "videoStyle":"视频风格描述（画面、剪辑、语言风格等）",\n  "postingStrategy":"发布策略（频率、时间、选题规律）",\n  "engagementTactics":"互动策略（评论引导、私信转化等）",\n  "successFactors":["成功因素1","成功因素2"],\n  "learnableAspects":"值得借鉴的具体做法和模仿建议"\n}';
        } else {
          res.writeHead(400); res.end(JSON.stringify({error:'未知生成类型'})); return;
        }

        try {
          const result = await callDeepSeek(apiKey, systemPrompt, userPrompt);
          res.writeHead(result.success ? 200 : 500);
          res.end(JSON.stringify(result));
        } catch(e) {
          res.writeHead(500); res.end(JSON.stringify({error:'API调用失败', detail: e.message}));
        }
        return;
      }

      // Tasks routes
      const tasksGetMatch = pathname.match(/^\/api\/tasks\/([^\/]+)$/);
      if (tasksGetMatch && method === 'GET') {
        const date = tasksGetMatch[1];
        res.writeHead(200); res.end(JSON.stringify(store.dailyTasks[date] || []));
        return;
      }
      if (tasksGetMatch && method === 'POST') {
        const date = tasksGetMatch[1];
        const body = await parseBody(req);
        if (!store.dailyTasks[date]) store.dailyTasks[date] = [];
        const task = { id: Date.now().toString(), ...body, createdAt: new Date().toISOString() };
        store.dailyTasks[date].push(task);
        saveStore();
        res.writeHead(200); res.end(JSON.stringify(task));
        return;
      }

      const tasksPatchMatch = pathname.match(/^\/api\/tasks\/([^\/]+)\/([^\/]+)$/);
      if (tasksPatchMatch && method === 'PATCH') {
        const date = tasksPatchMatch[1], taskId = tasksPatchMatch[2];
        const tasks = store.dailyTasks[date] || [];
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx === -1) { res.writeHead(404); res.end(JSON.stringify({error:'Not found'})); return; }
        const body = await parseBody(req);
        tasks[idx] = { ...tasks[idx], ...body };
        saveStore();
        res.writeHead(200); res.end(JSON.stringify(tasks[idx]));
        return;
      }

      // Calendar routes
      if (pathname === '/api/calendar' && method === 'GET') {
        res.writeHead(200); res.end(JSON.stringify(store.contentCalendar));
        return;
      }
      if (pathname === '/api/calendar' && method === 'POST') {
        const body = await parseBody(req);
        const entry = { id: Date.now().toString(), ...body, createdAt: new Date().toISOString() };
        store.contentCalendar.push(entry);
        saveStore();
        res.writeHead(200); res.end(JSON.stringify(entry));
        return;
      }

      // Analytics routes
      if (pathname === '/api/analytics' && method === 'GET') {
        res.writeHead(200); res.end(JSON.stringify(store.analytics));
        return;
      }
      if (pathname === '/api/analytics' && method === 'POST') {
        const body = await parseBody(req);
        const { date, accountId, data } = body;
        if (!store.analytics[date]) store.analytics[date] = {};
        store.analytics[date][accountId] = data;
        saveStore();
        res.writeHead(200); res.end(JSON.stringify({success:true}));
        return;
      }

      res.writeHead(404); res.end(JSON.stringify({error:'API not found'}));
      return;
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({error:e.message}));
    }
    return;
  }

  // Serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html for SPA
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
    res.end(data);
  });
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log('\n  \x1b[1m\x1b[36m抖音双账号运营规划系统\x1b[0m');
  console.log('  ' + '='.repeat(30));
  console.log('  \x1b[33m地址:\x1b[0m http://localhost:' + PORT);
  console.log('  \x1b[33m数据:\x1b[0m ' + DATA_DIR);
  console.log('\n  系统就绪，打开浏览器访问\n');
});
