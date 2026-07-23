/* ═══════════════════════════════════════════════════════
   兆辉防腐 · 抖音双账号运营规划系统 v2.0
   新增：多用户系统 + 关键词驱动的周计划
   ═══════════════════════════════════════════════════════ */

// ─── State ───
let state = {
  view: 'dashboard',
  schedules: {},
  weeklySchedules: {},
  currentUser: null,
  generateInProgress: false
};

// ─── Helpers ───
const $ = id => document.getElementById(id);
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
};
const nowHour = () => new Date().getHours();
const isWeekend = () => { const d = new Date().getDay(); return d === 0 || d === 6; };
const thisWeekRange = () => {
  const now = new Date(); const day = now.getDay(); const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(now.setDate(diff));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return (mon.getMonth()+1)+'月'+mon.getDate()+'日 - '+(sun.getMonth()+1)+'月'+sun.getDate()+'日';
};

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

// ─── User System ───
function getUsers() {
  try { return JSON.parse(localStorage.getItem('douyin_users') || '[]'); } catch(e) { return []; }
}
function saveUsers(users) {
  localStorage.setItem('douyin_users', JSON.stringify(users));
}
function getUserData(name) {
  try { return JSON.parse(localStorage.getItem('douyin_userdata_' + name) || '{}'); } catch(e) { return {}; }
}
function saveUserData(name, data) {
  localStorage.setItem('douyin_userdata_' + name, JSON.stringify(data));
}

function initUserSystem() {
  const users = getUsers();
  // Check for saved login
  const savedName = localStorage.getItem('douyin_current_user');
  if (savedName && users.includes(savedName)) {
    const data = getUserData(savedName);
    state.currentUser = { name: savedName, ...data };
    updateUserBadge();
    return true;
  }
  // Show login overlay
  showLoginOverlay();
  return false;
}

function showLoginOverlay() {
  const overlay = $('loginOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  const input = $('loginName');
  if (input) { input.value = ''; input.focus(); }
  // Show existing users
  const users = getUsers();
  const el = $('existingUsers');
  const box = $('existingUsersBox');
  if (el) {
    if (users.length === 0) {
      el.innerHTML = '<span style="color:#999">暂无，你将是第一位用户</span>';
    } else {
      el.innerHTML = users.map(u => `<span class="existing-user-tag" onclick="loginAsExisting('${escapeHtml(u)}')">${escapeHtml(u)}</span>`).join('');
    }
  }
}

function doLogin() {
  const input = $('loginName');
  if (!input) return;
  const name = input.value.trim();
  if (!name) { input.style.borderColor = 'var(--danger)'; return; }
  input.style.borderColor = '';
  loginAs(name);
}

function loginAsExisting(name) {
  loginAs(name);
}

function loginAs(name) {
  let users = getUsers();
  if (!users.includes(name)) {
    users.push(name);
    saveUsers(users);
  }
  localStorage.setItem('douyin_current_user', name);
  const data = getUserData(name);
  state.currentUser = { name, ...data };
  // Also load apiKey into state
  state.apiKey = data.apiKey || state.apiKey || localStorage.getItem('deepseek_api_key') || '';
  $('loginOverlay').classList.remove('active');
  updateUserBadge();
  renderView(state.view);
}

function showUserSwitcher() {
  const overlay = $('userSwitcherOverlay');
  if (!overlay) return;
  const list = $('userSwitcherList');
  const users = getUsers();
  const current = state.currentUser ? state.currentUser.name : '';
  if (list) {
    list.innerHTML = users.map(u =>
      `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <span>${escapeHtml(u)}${u === current ? ' <span style="color:var(--primary)">✓</span>' : ''}</span>
        ${u !== current ? `<button class="btn btn-sm btn-outline" onclick="loginAs('${escapeHtml(u)}');closeUserSwitcher()">切换</button>` : ''}
      </div>`
    ).join('');
    if (users.length === 0) list.innerHTML = '<div style="padding:12px 0;color:var(--text-secondary)">暂无其他用户</div>';
  }
  overlay.classList.add('active');
}

function closeUserSwitcher() {
  $('userSwitcherOverlay').classList.remove('active');
}

function logout() {
  localStorage.removeItem('douyin_current_user');
  state.currentUser = null;
  showLoginOverlay();
}

function updateUserBadge() {
  const el = $('sidebarUser');
  if (!el || !state.currentUser) return;
  el.querySelector('.user-name').textContent = state.currentUser.name;
  el.querySelector('.user-avatar').textContent = state.currentUser.name.charAt(0);
}

// ─── User data helpers ───
function getUserKeyword() {
  return state.currentUser?.keyword || '';
}
function setUserKeyword(kw) {
  if (!state.currentUser) return;
  state.currentUser.keyword = kw;
  saveUserData(state.currentUser.name, state.currentUser);
}

function getUserPlan() {
  return state.currentUser?.plan || null;
}
function setUserPlan(plan) {
  if (!state.currentUser) return;
  state.currentUser.plan = plan;
  saveUserData(state.currentUser.name, state.currentUser);
}

// ─── API Calls ───
async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPost(url, data) {
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── Load Data ───
async function loadSchedules() {
  try {
    state.schedules['personal-ip'] = await apiGet('/api/schedules/personal-ip');
    state.schedules['factory-daily'] = await apiGet('/api/schedules/factory-daily');
    state.weeklySchedules['personal-ip'] = await apiGet('/api/schedules/personal-ip/weekly');
    state.weeklySchedules['factory-daily'] = await apiGet('/api/schedules/factory-daily/weekly');
  } catch(e) { console.error('Failed to load schedules', e); }
}

// ─── View Switching ───
function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  renderView(view);
}

async function renderView(view) {
  const container = $('mainContent');
  if (!state.schedules['personal-ip']) await loadSchedules();
  switch(view) {
    case 'dashboard': renderDashboard(container); break;
    case 'personal-ip': renderSchedule(container, 'personal-ip'); break;
    case 'factory-daily': renderSchedule(container, 'factory-daily'); break;
    case 'ai-tools': renderAiTools(container); break;
    case 'calendar': renderCalendar(container); break;
    case 'hottopics': renderHotTopics(container); break;
    case 'analytics': renderAnalytics(container); break;
    case 'settings': renderSettings(container); break;
  }
}

// ─── KEYWORD PLAN GENERATION ───
async function generateKeywordPlan() {
  const input = $('kwInput');
  if (!input) return;
  const keyword = input.value.trim();
  if (!keyword) { input.style.borderColor = 'var(--danger)'; return; }
  input.style.borderColor = '';
  if (state.generateInProgress) return;

  // Get API key
  const apiKey = state.currentUser?.apiKey || state.apiKey;
  if (!apiKey) {
    alert('⚠️ 请先在「系统设置」中配置DeepSeek API密钥');
    switchView('settings');
    return;
  }

  state.generateInProgress = true;
  const btn = document.querySelector('.kw-gen-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading-spinner"></span> 正在生成周计划...'; }

  try {
    const res = await apiPost('/api/generate', {
      apiKey,
      type: 'keywordplan',
      params: { keyword }
    });

    if (res.success) {
      // Try to parse JSON response
      let plan;
      try {
        // Clean up response - remove markdown code blocks if present
        let clean = res.content.trim();
        if (clean.startsWith('```')) {
          clean = clean.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
        }
        plan = JSON.parse(clean);
      } catch(e) {
        // If parsing fails, store as raw text
        plan = { raw: res.content };
      }
      plan._keyword = keyword;
      plan._generatedAt = new Date().toISOString();
      setUserKeyword(keyword);
      setUserPlan(plan);
      renderDashboard($('mainContent'));
    } else {
      alert('❌ 生成失败：' + (res.error || '未知错误'));
    }
  } catch(e) {
    alert('❌ API调用失败：' + e.message);
  }

  state.generateInProgress = false;
  if (btn) { btn.disabled = false; btn.innerHTML = '🤖 生成周计划'; }
}

function clearKeywordPlan() {
  if (!state.currentUser) return;
  if (!confirm('确定清除本周关键词和计划？')) return;
  setUserKeyword('');
  setUserPlan(null);
  renderDashboard($('mainContent'));
}

// ─── Dashboard ───
function renderDashboard(container) {
  const userName = state.currentUser ? state.currentUser.name : '销售先锋';
  const keyword = getUserKeyword();
  const plan = getUserPlan();
  const now = nowHour();
  const hours = state.schedules['personal-ip']?.hours || [];
  const curIdx = hours.findIndex(h => { const s = parseInt(h.time.split(':')[0]); return now >= s && now < s + 1; });
  const curHour = curIdx >= 0 ? hours[curIdx] : null;
  const progress = curIdx >= 0 ? Math.round(((curIdx) / hours.length) * 100) : 0;

  // Greeting based on time
  let greet = '早上好';
  if (now >= 12 && now < 14) greet = '中午好';
  else if (now >= 14 && now < 18) greet = '下午好';
  else if (now >= 18) greet = '晚上好';

  // Keyword plan section
  const kwHtml = renderKeywordSection(keyword, plan);

  container.innerHTML = `
    <div class="view active">
      <div class="welcome-banner">
        <h1>${greet}，${escapeHtml(userName)}！</h1>
        <p>${today()} · ${thisWeekRange()} · 本周关键词：<strong>${keyword || '未设置'}</strong></p>
      </div>

      ${kwHtml}

      <div class="current-task-card">
        <h3>⏰ 当前工作时段</h3>
        ${curHour ? `
          <div class="task-time">${curHour.time}</div>
          <div class="task-title">${getIcon(curHour.icon)} ${curHour.title}</div>
          <ul style="padding-left:20px;margin:8px 0">
            ${curHour.tasks.slice(0,3).map(t => `<li style="font-size:13px;margin:4px 0">${escapeHtml(t)}</li>`).join('')}
          </ul>
          <div class="progress-bar"><div class="fill" style="width:${Math.min(progress,100)}%"></div></div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">今日进度 ${Math.min(progress,100)}%</div>
        ` : `
          <div style="padding:16px 0;color:var(--text-secondary)">当前非工作时间，休息一下吧 🎯</div>
        `}
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-card">
          <h3>👨‍🔧 个人IP号 · 江苏兆辉防腐·李工</h3>
          <div class="account-status">
            <div class="avatar">👨‍🔧</div>
            <div class="info">
              <div class="name">个人IP号</div>
              <div class="bio">15年防腐工程师 | 专注板衬四氟/钢衬PE.PO</div>
            </div>
            <span class="badge">运营中</span>
          </div>
          <div class="quick-actions">
            <button onclick="switchView('personal-ip')">📋 查看今日日程</button>
            <button onclick="switchView('ai-tools');setAiMode('script')">✍️ 写口播脚本</button>
          </div>
        </div>
        <div class="dashboard-card">
          <h3>🏭 工厂日常号 · 兆辉防腐工厂直击</h3>
          <div class="account-status">
            <div class="avatar">🏭</div>
            <div class="info">
              <div class="name">工厂日常号</div>
              <div class="bio">带你看真实的防腐设备生产全过程</div>
            </div>
            <span class="badge">运营中</span>
          </div>
          <div class="quick-actions">
            <button onclick="switchView('factory-daily')">📋 查看今日日程</button>
            <button onclick="switchView('ai-tools');setAiMode('caption')">📝 写实拍文案</button>
          </div>
        </div>
      </div>

      <div class="dashboard-card">
        <h3>🎯 运营要点提醒</h3>
        <div style="padding:8px 0">${renderTips(keyword)}</div>
      </div>
    </div>
  `;
}

function renderKeywordSection(keyword, plan) {
  let html = `
    <div class="keyword-section">
      <div class="kw-header">
        <h3>🔑 本周运营关键词</h3>
        ${keyword ? `<button class="btn btn-sm btn-outline" onclick="clearKeywordPlan()" style="margin-left:auto">✕ 清除</button>` : ''}
      </div>
      <div class="keyword-input-row">
        <input id="kwInput" placeholder="输入本周关键词，如：钢衬PO储罐、四氟衬里反应釜、管道衬塑..." value="${escapeHtml(keyword)}">
        <button class="btn btn-primary kw-gen-btn" onclick="generateKeywordPlan()">🤖 生成周计划</button>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:6px">
        提示：输入产品名或工艺名，AI将自动为本周双账号规划完整内容
      </div>
    </div>
  `;

  // Show plan if exists
  if (plan) {
    if (plan.raw) {
      // Raw text plan (JSON parse failed)
      html += `
        <div class="kw-plan-banner">
          <div class="kw-plan-keyword">🔑 ${escapeHtml(keyword)}</div>
          <div class="kw-plan-goal">AI生成的周计划（请查看下方详情）</div>
        </div>
        <div style="background:var(--surface);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);border:1px solid var(--border);white-space:pre-wrap;font-size:13px;line-height:1.7;margin-bottom:16px">
          ${escapeHtml(plan.raw)}
        </div>
      `;
    } else if (plan.personalIP && plan.factoryDaily) {
      // Structured plan
      const genTime = plan._generatedAt ? new Date(plan._generatedAt).toLocaleString('zh-CN') : '';
      html += `
        <div class="kw-plan-banner">
          <div class="kw-plan-keyword">🔑 ${escapeHtml(keyword)}</div>
          <div class="kw-plan-goal">${escapeHtml(plan.weeklyGoal || '围绕关键词打造本周内容矩阵')}${genTime ? ' · 生成于 ' + genTime : ''}</div>
        </div>
        <div class="kw-plan-grid">
          <div class="kw-plan-column">
            <h4>👨‍🔧 个人IP号 · 本周内容</h4>
            ${plan.personalIP.map(d => `
              <div class="kw-day-card">
                <div class="kw-day">${escapeHtml(d.day || '')}</div>
                <div class="kw-topic">${escapeHtml(d.topic || '')}</div>
                <div class="kw-desc">${escapeHtml(d.content || '')}</div>
                ${d.keyMessage ? `<div style="font-size:11px;color:var(--accent);margin-top:2px">💡 ${escapeHtml(d.keyMessage)}</div>` : ''}
                ${d.scriptHook ? `<div style="font-size:11px;color:var(--primary);margin-top:2px">🎬 ${escapeHtml(d.scriptHook)}</div>` : ''}
                ${d.hashtags ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:2px">${d.hashtags.slice(0,3).join(' ')}</div>` : ''}
              </div>
            `).join('')}
          </div>
          <div class="kw-plan-column">
            <h4>🏭 工厂日常号 · 本周内容</h4>
            ${plan.factoryDaily.map(d => `
              <div class="kw-day-card">
                <div class="kw-day">${escapeHtml(d.day || '')}</div>
                <div class="kw-topic">${escapeHtml(d.topic || '')}</div>
                <div class="kw-desc">${escapeHtml(d.content || '')}</div>
                ${d.shootingFocus ? `<div style="font-size:11px;color:var(--success);margin-top:2px">📸 重点：${escapeHtml(d.shootingFocus)}</div>` : ''}
                ${d.hashtags ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:2px">${d.hashtags.slice(0,3).join(' ')}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
        ${plan.sharedHashtags ? `
          <div class="kw-hashtags">
            ${plan.sharedHashtags.map(t => `<span class="kw-hashtag">${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        ${plan.publishingTips ? `
          <div class="kw-pub-tips">📢 发布策略：${escapeHtml(plan.publishingTips)}</div>
        ` : ''}
      `;
    }
  }

  return html;
}

function renderTips(keyword) {
  const kw = keyword || '防腐设备';
  return [
    '本周关键词：「' + kw + '」—— 所有内容围绕该关键词展开',
    '黄金发布时间：工作日 12:00 / 18:00 / 21:00',
    '完播率目标：个人IP >15%，工厂实拍 >25%',
    '评论30分钟内回复效果最佳，别拖！',
    '每周至少发布5条（工作日每天1条），保持账号活跃度'
  ].map(t => `<div style="padding:4px 0;font-size:13px">· ${t}</div>`).join('');
}

// ─── Schedule View ───
function renderSchedule(container, accountId) {
  const sched = state.schedules[accountId];
  if (!sched) { container.innerHTML = '<div class="view active"><p>日程数据加载中...</p></div>'; return; }
  const weekly = state.weeklySchedules[accountId] || {};
  const now = nowHour();
  const isWeekDay = !isWeekend() && now >= 8 && now < 17;

  // Add keyword context banner
  const keyword = getUserKeyword();
  const keywordBanner = keyword ? `
    <div style="background:var(--primary-light);border-radius:6px;padding:8px 14px;margin-bottom:16px;font-size:13px;display:flex;align-items:center;gap:8px">
      🔑 本周关键词：<strong>${escapeHtml(keyword)}</strong>
      <span style="color:var(--text-secondary);font-size:12px">—— 执行内容时请围绕此关键词展开</span>
    </div>
  ` : '';

  const hoursHtml = sched.hours.map((h, i) => {
    const start = parseInt(h.time.substring(0,2));
    const isCurrent = isWeekDay && now >= start && now < start + 1;
    const isPast = now > start + 1;
    const cls = `timeline-hour${isCurrent ? ' current' : ''}${isPast ? ' completed' : ''}`;
    return `
      <div class="${cls}" onclick="this.classList.toggle('open')">
        <div class="hour-header">
          <span class="hour-icon">${getIcon(h.icon)}</span>
          <span class="hour-time">${h.time}</span>
          <span class="hour-title">${escapeHtml(h.title)}</span>
          ${isCurrent ? '<span class="hour-check">⏳ 进行中</span>' : ''}
          ${isPast ? '<span class="hour-check">✅ 已完成</span>' : ''}
        </div>
        <div class="hour-body">
          <ul class="task-list">
            ${h.tasks.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
          </ul>
          <div class="hour-meta">
            <div class="meta-item"><strong>使用工具</strong><span>${h.tools.join('、')}</span></div>
            <div class="meta-item"><strong>预期产出</strong><span>${h.output}</span></div>
          </div>
          <div class="tips-box">${escapeHtml(h.tips)}</div>
        </div>
      </div>
    `;
  }).join('');

  let weeklyHtml = '';
  if (weekly.saturday || weekly.sunday) {
    weeklyHtml = `
      <div class="weekly-section">
        <h3>📅 周末特别安排</h3>
        ${weekly.saturday ? `<div class="weekly-card"><h4>周六 · ${weekly.saturday.title}</h4><ul>${weekly.saturday.tasks.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div>` : ''}
        ${weekly.sunday ? `<div class="weekly-card"><h4>周日 · ${weekly.sunday.title}</h4><ul>${weekly.sunday.tasks.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div>` : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="view active">
      <div class="schedule-header">
        <h2>${sched.name}</h2>
        <span class="persona-badge">${sched.persona.title}</span>
        <div class="day-selector">
          <button class="day-btn active" onclick="setScheduleDay(this,'weekday')">工作日</button>
          <button class="day-btn" onclick="setScheduleDay(this,'saturday')">周六</button>
          <button class="day-btn" onclick="setScheduleDay(this,'sunday')">周日</button>
        </div>
      </div>
      ${keywordBanner}
      <div class="persona-card">
        <div class="row">
          <div><dt>人设定位</dt><dd>${escapeHtml(sched.persona.title)}</dd></div>
          <div><dt>核心理念</dt><dd>${escapeHtml(sched.persona.tagline)}</dd></div>
          <div><dt>内容风格</dt><dd>${escapeHtml(sched.persona.tone)}</dd></div>
          <div><dt>目标人群</dt><dd>${escapeHtml(sched.persona.targetUsers)}</dd></div>
        </div>
        <div style="margin-top:8px">
          <dt style="font-size:12px;color:var(--text-secondary);margin-bottom:2px">内容支柱</dt>
          <dd style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            ${sched.persona.contentPillars.map(p => `<span style="background:var(--primary-light);color:var(--primary);padding:2px 10px;border-radius:10px;font-size:12px">${escapeHtml(p)}</span>`).join('')}
          </dd>
        </div>
      </div>
      ${renderScheduleHotTopics(accountId)}
      <div class="timeline">${hoursHtml}</div>
      ${weeklyHtml}
    </div>
  `;
}

function renderScheduleHotTopics(accountId) {
  const keyword = getUserKeyword();
  return `
    <div style="background:linear-gradient(135deg,#fff3e0,#ffe0b2);border-radius:var(--radius);padding:14px 18px;margin-bottom:16px;border:1px solid #ffcc80;display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap">
      <div>
        <div style="font-size:14px;font-weight:600">🔥 全网热点追踪</div>
        <div style="font-size:12px;color:#e65100;margin-top:2px">今日是否有可以追的热点？点击查看AI推荐的热点话题和跟风方案</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-warning" onclick="switchView('hottopics')" style="background:#e65100;color:#fff;border:none">🔥 查看热点</button>
        ${keyword ? '<span style="font-size:11px;color:#795548;background:#fff8e1;padding:4px 10px;border-radius:12px">🔑 ' + escapeHtml(keyword) + '</span>' : ''}
      </div>
    </div>
  `;
}

function setScheduleDay(btn, day) {
  document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const ws = document.querySelector('.weekly-section');
  if (ws && day !== 'weekday') {
    ws.scrollIntoView({ behavior: 'smooth' });
    document.querySelectorAll('.weekly-card').forEach(c => c.style.display = 'block');
    if (day === 'saturday' && document.querySelectorAll('.weekly-card').length > 1) {
      document.querySelectorAll('.weekly-card')[1].style.display = 'none';
    } else if (day === 'sunday' && document.querySelectorAll('.weekly-card').length > 1) {
      document.querySelectorAll('.weekly-card')[0].style.display = 'none';
    }
  }
}

// ─── AI Tools ───
let aiState = { mode: 'script' };

function setAiMode(mode) {
  aiState.mode = mode;
  document.querySelectorAll('.ai-tool-card').forEach(c => c.classList.remove('active'));
  const card = document.querySelector(`[data-ai-mode="${mode}"]`);
  if (card) card.classList.add('active');
  const form = document.querySelector('.ai-form-panel');
  if (form) { form.classList.add('active'); updateAiForm(mode); }
}

function renderAiTools(container) {
  const tools = [
    { mode:'script', icon:'🎬', name:'口播脚本生成', desc:'为个人IP号写完整口播脚本，含开场、案例、互动引导' },
    { mode:'caption', icon:'📝', name:'实拍文案生成', desc:'为工厂实拍视频写发布文案+话题标签' },
    { mode:'title', icon:'🎯', name:'爆款标题生成', desc:'生成5个高点击率的抖音视频标题' },
    { mode:'trendjack', icon:'🔥', name:'追热点方案', desc:'根据热点话题，自动生成模仿跟风的拍摄脚本和发布方案' },
    { mode:'keywordplan', icon:'🔑', name:'关键词周计划', desc:'输入关键词，AI自动生成双账号本周完整内容规划' }
  ];
  const keyword = getUserKeyword();

  container.innerHTML = `
    <div class="view active">
      <div class="ai-tools-header">
        <h2>🤖 AI内容工厂 · DeepSeek驱动</h2>
        <p>${keyword ? '本周关键词：' + escapeHtml(keyword) : '快速生成高质量短视频内容'}</p>
      </div>
      <div class="ai-tools-grid">
        ${tools.map(t => `
          <div class="ai-tool-card${t.mode === aiState.mode ? ' active' : ''}" data-ai-mode="${t.mode}" onclick="setAiMode('${t.mode}')">
            <div class="tool-icon">${t.icon}</div>
            <div class="tool-name">${t.name}</div>
            <div class="tool-desc">${t.desc}</div>
          </div>
        `).join('')}
      </div>
      <div class="ai-form-panel active" id="aiFormPanel">
        <h3 id="aiFormTitle">🎬 口播脚本生成</h3>
        <div id="aiFormContent"></div>
        <div id="aiResult" class="ai-result"></div>
      </div>
    </div>
  `;
  updateAiForm(aiState.mode);
}

function updateAiForm(mode) {
  const titleMap = {
    script: '🎬 口播脚本生成',
    caption: '📝 工厂实拍文案',
    title: '🎯 爆款标题生成',
    trendjack: '🔥 追热点方案',
    keywordplan: '🔑 关键词周计划'
  };
  const titleEl = document.getElementById('aiFormTitle');
  const formEl = document.getElementById('aiFormContent');
  if (titleEl) titleEl.textContent = titleMap[mode] || 'AI内容生成';
  if (!formEl) return;
  const keyword = getUserKeyword();

  let html = '';
  if (mode === 'script') {
    html = `
      <div class="form-group">
        <label>选题方向 *</label>
        <input id="aiTopic" placeholder="建议围绕本周关键词展开" value="${escapeHtml(keyword || '')}">
      </div>
      <div class="form-group">
        <label>核心观点（可选）</label>
        <textarea id="aiViewpoint" placeholder="你想表达的核心观点"></textarea>
      </div>
      <button class="btn btn-primary" onclick="generateContent('script')">🤖 生成口播脚本</button>
    `;
  } else if (mode === 'caption') {
    html = `
      <div class="form-group">
        <label>视频内容描述 *</label>
        <textarea id="aiContent" placeholder="描述你拍了什么内容，例如：今天拍了30m³钢衬PO储罐的焊接过程和发货装车" ${keyword ? '>围绕本周关键词：' + escapeHtml(keyword) : ''}></textarea>
      </div>
      <div class="form-group">
        <label>设备类型</label>
        <input id="aiEquipment" placeholder="例如：钢衬PO储罐、四氟衬里反应釜" value="${escapeHtml(keyword || '')}">
      </div>
      <div class="form-group">
        <label>核心亮点</label>
        <input id="aiHighlight" placeholder="例如：手工电弧焊工艺、超大容量、快速交货">
      </div>
      <button class="btn btn-primary" onclick="generateContent('caption')">🤖 生成发布文案</button>
    `;
  } else if (mode === 'title') {
    html = `
      <div class="form-group">
        <label>视频主题 *</label>
        <input id="aiTopic" placeholder="建议围绕本周关键词" value="${escapeHtml(keyword || '')}">
      </div>
      <div class="form-group">
        <label>目标人群</label>
        <input id="aiAudience" value="化工企业">
      </div>
      <div class="form-group">
        <label>视频类型</label>
        <select id="aiVideoType">
          <option value="口播">口播讲解</option>
          <option value="实拍" selected>工厂实拍</option>
          <option value="图文">图文混排</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="generateContent('title')">🤖 生成爆款标题</button>
    `;
  } else if (mode === 'trendjack') {
    html = `
      <div class="form-group">
        <label>热点话题 *</label>
        <textarea id="tjTopic" placeholder="描述你看到的热点话题，例如：最近化工行业安全生产大检查，很多企业被要求停产整改" style="min-height:60px"></textarea>
      </div>
      <div class="form-group">
        <label>选择账号</label>
        <select id="tjAccount">
          <option value="personal-ip">个人IP号 · 江苏兆辉防腐·李工（口播讲解）</option>
          <option value="factory-daily">工厂日常号 · 兆辉防腐工厂直击（实拍展示）</option>
        </select>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">
        AI将根据热点话题和账号定位，生成完整的追热点视频方案，包含脚本/拍摄指导/发布文案。
      </div>
      <button class="btn btn-primary" onclick="generateTrendJack()">🔥 生成跟拍方案</button>
    `;
  } else if (mode === 'keywordplan') {
    html = `
      <div class="form-group">
        <label>本周关键词 *</label>
        <input id="kwPlanInput" placeholder="例如：钢衬PO储罐、四氟衬里反应釜" value="${escapeHtml(keyword || '')}">
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">
        输入关键词后，AI将自动为个人IP号和工厂日常号分别生成周一至周六的完整内容规划。
      </div>
      <button class="btn btn-primary" onclick="generateKeywordPlanFromAi()">🔑 生成周计划</button>
    `;
  }
  formEl.innerHTML = html;
}

async function generateKeywordPlanFromAi() {
  const input = document.getElementById('kwPlanInput');
  if (!input) return;
  const keyword = input.value.trim();
  if (!keyword) { input.style.borderColor = 'var(--danger)'; return; }
  input.style.borderColor = '';

  // Set keyword and trigger generation
  const kwInput = $('kwInput');
  if (kwInput) kwInput.value = keyword;
  await generateKeywordPlan();
}

async function generateContent(type) {
  const apiKey = state.currentUser?.apiKey || state.apiKey;
  if (!apiKey) {
    document.getElementById('aiResult').innerHTML = '<div style="color:var(--danger)">⚠️ 请先在「系统设置」中配置DeepSeek API密钥</div>';
    document.getElementById('aiResult').classList.add('active');
    return;
  }

  const btn = document.querySelector('#aiFormContent .btn-primary');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> 生成中...';
  const resultEl = document.getElementById('aiResult');
  resultEl.classList.remove('active');

  let params = {};
  if (type === 'script') {
    params.topic = document.getElementById('aiTopic')?.value || '';
    params.viewpoint = document.getElementById('aiViewpoint')?.value || '';
  } else if (type === 'caption') {
    params.content = document.getElementById('aiContent')?.value || '';
    params.equipment = document.getElementById('aiEquipment')?.value || '';
    params.highlight = document.getElementById('aiHighlight')?.value || '';
  } else if (type === 'title') {
    params.topic = document.getElementById('aiTopic')?.value || '';
    params.audience = document.getElementById('aiAudience')?.value || '';
    params.videoType = document.getElementById('aiVideoType')?.value || '实拍';
  } else if (type === 'weeklyPlan') {
    params.account = document.getElementById('aiAccount')?.value === 'personal-ip' ? '个人IP号' : '工厂日常号';
    params.accountType = document.getElementById('aiAccount')?.value || 'personal-ip';
    params.weeklyFeedback = document.getElementById('aiWeeklyFeedback')?.value || '';
  }

  try {
    const res = await apiPost('/api/generate', { apiKey, type, params });
    if (res.success) {
      resultEl.innerHTML = `<button class="btn btn-outline copy-btn" onclick="copyResult(this)">📋 复制</button>${escapeHtml(res.content)}`;
      resultEl.classList.add('active');
    } else {
      resultEl.innerHTML = `<div style="color:var(--danger)">❌ ${escapeHtml(res.error)}</div>`;
      resultEl.classList.add('active');
    }
  } catch(e) {
    resultEl.innerHTML = `<div style="color:var(--danger)">❌ 生成失败：${escapeHtml(e.message)}</div>`;
    resultEl.classList.add('active');
  }

  btn.disabled = false;
  const labels = { script:'🤖 生成口播脚本', caption:'🤖 生成发布文案', title:'🤖 生成爆款标题', trendjack:'🔥 生成跟拍方案', keywordplan:'🔑 生成周计划' };
  btn.innerHTML = labels[type] || '🤖 生成';
}

// ─── Hot Topics ───
async function renderHotTopics(container) {
  const keyword = getUserKeyword();
  container.innerHTML = `
    <div class="view active">
      <div class="ht-header">
        <h2>🔥 抖音全网热榜 & 爆款分析</h2>
        <p>追踪抖音热门爆款视频，分析爆款结构，生成跟拍方案</p>
      </div>
      ${keyword ? '<div style="margin-bottom:12px"><span class="keyword-badge">🔑 本周关键词：' + escapeHtml(keyword) + '</span></div>' : ''}
      <div class="ht-controls">
        <button class="btn btn-primary" onclick="generateHotTopics()" id="htGenBtn">🤖 获取抖音今日热榜</button>
        <span style="font-size:12px;color:var(--text-secondary)">分析当前抖音最火视频类型和爆款结构，不限行业</span>
      </div>

      <div id="htTrendingFormats" class="trending-kw" style="display:none"></div>
      <div id="htGrid" class="ht-grid"></div>
      <div id="trendJackPanel" class="trend-jack-panel"></div>

      <div style="margin-top:24px;background:linear-gradient(135deg,#f3e5f5,#e1bee7);border-radius:var(--radius);padding:16px 20px;border:1px solid #ce93d8">
        <h3 style="font-size:15px;margin-bottom:8px">🎯 抖音视频结构分析</h3>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">输入你看到的爆款视频描述或对标账号名称，AI自动分析视频结构和爆款逻辑</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="videoAnalysisInput" placeholder="输入抖音视频描述或链接（如：最近很火的xx视频，内容是关于...）" style="flex:1;min-width:200px;padding:8px 12px;border:2px solid #ce93d8;border-radius:6px;font-size:13px;font-family:var(--font)">
          <button class="btn btn-warning" onclick="analyzeVideo()" style="background:#7b1fa2;color:#fff;border:none">🔍 分析视频结构</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <input id="accountAnalysisInput" placeholder="输入抖音对标账号名称（如：xx讲机械、xx工程师）" style="flex:1;min-width:200px;padding:8px 12px;border:2px solid #ce93d8;border-radius:6px;font-size:13px;font-family:var(--font)">
          <button class="btn btn-warning" onclick="analyzeAccount()" style="background:#7b1fa2;color:#fff;border:none">📊 分析对标账号</button>
        </div>
      </div>
      <div id="analysisResult" class="trend-jack-panel"></div>
    </div>
  `;
}

async function generateHotTopics() {
  const apiKey = state.currentUser?.apiKey || state.apiKey;
  if (!apiKey) { alert('请先在系统设置中配置DeepSeek API密钥'); switchView('settings'); return; }
  const keyword = getUserKeyword();
  const btn = document.getElementById('htGenBtn');
  const grid = document.getElementById('htGrid');
  const trendKw = document.getElementById('htTrendingKw');
  if (!grid) return;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading-spinner"></span> 正在追踪热点...'; }
  grid.innerHTML = '<div class="ht-loading"><div class="spinner"></div><div>AI正在分析全网热点...</div></div>';
  if (trendKw) trendKw.innerHTML = '';
  try {
    const res = await apiPost('/api/generate', { apiKey, type: 'hottopics', params: { keyword } });
    if (btn) { btn.disabled = false; btn.innerHTML = '🔄 刷新热点'; }
    if (res.success) {
      let plan;
      try {
        let clean = res.content.trim();
        if (clean.startsWith('```')) clean = clean.replace(/```json\\s*/i, '').replace(/```\\s*$/, '').trim();
        plan = JSON.parse(clean);
      } catch(e) {
        // Show raw content
        grid.innerHTML = '<div class="ht-card" style="grid-column:1/-1;white-space:pre-wrap;font-size:13px;line-height:1.7">' + escapeHtml(res.content) + '</div>';
        return;
      }
      // Render trending keywords
      const trendFormats = document.getElementById('htTrendingFormats');
      if (trendFormats) {
        let formatsHtml = '';
        if (plan.trendingFormats && plan.trendingFormats.length > 0) {
          formatsHtml += '<span style="font-size:12px;color:#7b1fa2;font-weight:600;margin-right:6px">🔥 热门视频格式：</span>' +
            plan.trendingFormats.map(f => '<span class="tk-item">' + escapeHtml(f) + '</span>').join('');
        }
        if (plan.trendingBGM && plan.trendingBGM.length > 0) {
          formatsHtml += ' <span style="font-size:12px;color:#7b1fa2;font-weight:600;margin-right:6px;margin-left:10px">🎵 热门BGM：</span>' +
            plan.trendingBGM.map(b => '<span class="tk-item" style="background:#e8f5e9;color:#2e7d32">' + escapeHtml(b) + '</span>').join('');
        }
        if (plan.generalTip) {
          formatsHtml += ' <div style="margin-top:6px;font-size:12px;color:#795548">💡 ' + escapeHtml(plan.generalTip) + '</div>';
        }
        if (formatsHtml) {
          trendFormats.innerHTML = formatsHtml;
          trendFormats.style.display = 'block';
        }
      }
      // Render hot topics
      if (plan.hotTopics && plan.hotTopics.length > 0) {
        grid.innerHTML = plan.hotTopics.map(t => {
          const acct = t.suggestedAccount || 'both';
          return '<div class="ht-card" id="htcard_' + escapeHtml(t.title).replace(/\\s/g, '_') + '">' +
            '<div class="ht-heat">' + escapeHtml(t.heat || '🔥') + '</div>' +
            '<div class="ht-title">' + escapeHtml(t.title) + '</div>' +
            '<div class="ht-source">来源：' + escapeHtml(t.source || '全网') + ' · 建议账号：<span class="ht-account ' + acct + '">' + (acct === 'both' ? '双账号均可' : acct === 'personal-ip' ? '个人IP号' : '工厂日常号') + '</span></div>' +
            '<div class="ht-relevance" style="background:#f3e5f5;border-radius:4px;padding:6px 8px;margin-bottom:6px">🔥 爆款原因：' + escapeHtml(t.viralReason || t.relevance || '') + '</div>' +
            '<div class="ht-angle" style="color:#e65100">💡 跟拍建议：' + escapeHtml(t.adaptationSuggestion || t.angle || '') + '</div>' +
            '<div class="ht-actions">' +
            '<button class="btn btn-sm btn-primary" onclick="generateTrendJackFromTopic(\'' + escapeHtml(t.title).replace(/'/g, "\\'") + '\',\'' + acct + '\')">🔥 生成跟拍方案</button>' +
            '<button class="btn btn-sm btn-outline" style="margin-left:6px" onclick="analyzeHotVideoFromCard(this)">🔍 解析结构</button>' +
            '</div></div>';
        }).join('');
      } else {
        grid.innerHTML = '<div class="ht-empty"><div class="big-icon">📡</div><div>暂无热点数据，请重新获取</div></div>';
      }
    } else {
      grid.innerHTML = '<div class="ht-empty"><div class="big-icon">⚠️</div><div>' + escapeHtml(res.error || '获取热点失败') + '</div></div>';
      if (btn) { btn.disabled = false; btn.innerHTML = '🤖 获取今日热点'; }
    }
  } catch(e) {
    grid.innerHTML = '<div class="ht-empty"><div class="big-icon">❌</div><div>请求失败：' + escapeHtml(e.message) + '</div></div>';
    if (btn) { btn.disabled = false; btn.innerHTML = '🤖 获取今日热点'; }
  }
}

async function generateTrendJackFromTopic(topic, account) {
  const panel = document.getElementById('trendJackPanel');
  if (!panel) return;
  panel.innerHTML = '<div class="ht-loading"><div class="spinner"></div><div>正在生成追热点方案...</div></div>';
  panel.classList.add('active');
  panel.scrollIntoView({ behavior: 'smooth' });
  await doGenerateTrendJack(topic, account === 'both' ? 'personal-ip' : account, panel);
}

async function generateTrendJack() {
  const topic = document.getElementById('tjTopic')?.value?.trim();
  const account = document.getElementById('tjAccount')?.value || 'personal-ip';
  if (!topic) {
    const el = document.getElementById('tjTopic');
    if (el) el.style.borderColor = 'var(--danger)';
    return;
  }
  const panel = document.getElementById('trendJackPanel');
  const aiResult = document.getElementById('aiResult');
  if (panel) {
    panel.innerHTML = '<div class="ht-loading"><div class="spinner"></div><div>正在生成追热点方案...</div></div>';
    panel.classList.add('active');
  }
  if (aiResult) { aiResult.classList.remove('active'); }
  await doGenerateTrendJack(topic, account, panel || aiResult);
}

async function doGenerateTrendJack(topic, account, resultEl) {
  const apiKey = state.currentUser?.apiKey || state.apiKey;
  const keyword = getUserKeyword();
  if (!apiKey) { alert('请先配置API密钥'); return; }
  try {
    const res = await apiPost('/api/generate', { apiKey, type: 'trendjack', params: { topic, account, keyword } });
    if (res.success) {
      let plan;
      try {
        let clean = res.content.trim();
        if (clean.startsWith('```')) clean = clean.replace(/```json\\s*/i, '').replace(/```\\s*$/, '').trim();
        plan = JSON.parse(clean);
      } catch(e) {
        resultEl.innerHTML = '<div class="trend-jack-card"><div class="tj-title">🔥 追热点方案</div><div style="white-space:pre-wrap;font-size:13px;line-height:1.7;margin-top:8px">' + escapeHtml(res.content) + '</div></div>';
        return;
      }
      const acctDisplay = account === 'personal-ip' ? '👨‍🔧 个人IP号' : '🏭 工厂日常号';
      const hashtags = plan.hashtags || [];
      resultEl.innerHTML = '<div class="trend-jack-card">' +
        '<div class="tj-title">🔥 ' + escapeHtml(plan.videoTitle || '追热点方案') + '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">' + acctDisplay + ' · 热点：' + escapeHtml(plan.hotTopic || topic) + '</div>' +
        '<div class="tj-angle">💡 ' + escapeHtml(plan.angle || '') + '</div>' +
        (plan.script ? '<div class="tj-section"><h5>🎬 拍摄脚本</h5><div class="tj-content">' + escapeHtml(plan.script) + '</div></div>' : '') +
        (plan.shootingGuide ? '<div class="tj-section"><h5>📸 拍摄指导</h5><div class="tj-content">' + escapeHtml(plan.shootingGuide) + '</div></div>' : '') +
        (plan.caption ? '<div class="tj-section"><h5>📝 发布文案</h5><div class="tj-content">' + escapeHtml(plan.caption) + '</div></div>' : '') +
        (hashtags.length > 0 ? '<div class="tj-section"><h5>🏷️ 话题标签</h5><div class="tj-tags">' + hashtags.map(h => '<span class="tj-tag">' + escapeHtml(h) + '</span>').join('') + '</div></div>' : '') +
        (plan.publishTime ? '<div class="tj-section"><h5>⏰ 建议发布时间</h5><div class="tj-content">' + escapeHtml(plan.publishTime) + '</div></div>' : '') +
        (plan.whyThisWorks ? '<div class="tj-reason">🎯 ' + escapeHtml(plan.whyThisWorks) + '</div>' : '') +
        '<div style="margin-top:12px"><button class="btn btn-outline btn-sm" onclick="var t=this.parentElement.parentElement;navigator.clipboard.writeText(t.innerText.trim()).then(()=>{this.innerHTML=\'✅ 已复制\';setTimeout(()=>{this.innerHTML=\'📋 复制全文\'},2000)})">📋 复制全文</button></div>' +
        '</div>';
    } else {
      resultEl.innerHTML = '<div class="trend-jack-card"><div style="color:var(--danger)">❌ ' + escapeHtml(res.error || '生成失败') + '</div></div>';
    }
  } catch(e) {
    resultEl.innerHTML = '<div class="trend-jack-card"><div style="color:var(--danger)">❌ ' + escapeHtml(e.message) + '</div></div>';
  }
}




// ─── Video & Account Analysis ───
async function analyzeHotVideo(topic) {
  const panel = document.getElementById('trendJackPanel');
  const analysisResult = document.getElementById('analysisResult');
  const target = analysisResult || panel;
  if (!target) return;
  target.innerHTML = '<div class="ht-loading"><div class="spinner"></div><div>正在分析视频结构...</div></div>';
  target.classList.add('active');
  target.scrollIntoView({ behavior: 'smooth' });
  const apiKey = state.currentUser?.apiKey || state.apiKey;
  const keyword = getUserKeyword();
  if (!apiKey) { alert('请先配置API密钥'); switchView('settings'); return; }
  try {
    const res = await apiPost('/api/generate', { apiKey, type: 'analyzeVideo', params: { videoDesc: topic, keyword } });
    if (res.success) {
      let plan;
      try {
        let clean = res.content.trim();
        if (clean.startsWith('```')) clean = clean.replace(/```json\\s*/i, '').replace(/```\\s*$/, '').trim();
        plan = JSON.parse(clean);
      } catch(e) {
        target.innerHTML = '<div class="trend-jack-card"><div style="white-space:pre-wrap;font-size:13px;line-height:1.7">' + escapeHtml(res.content) + '</div></div>';
        return;
      }
      target.innerHTML = '<div class="trend-jack-card" style="border-left:4px solid #7b1fa2">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<span style="font-size:20px">🔍</span>' +
        '<div><div class="tj-title">' + escapeHtml(plan.videoType || '视频结构分析') + '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary)">' + escapeHtml(topic) + '</div></div></div>' +
        '<div class="tj-section"><h5>🎯 前3秒钩子</h5><div class="tj-content">' + escapeHtml(plan.hook || '') + '</div></div>' +
        '<div class="tj-section"><h5>📐 整体结构</h5><div class="tj-content">' + escapeHtml(plan.structure || '') + '</div></div>' +
        (plan.editingStyle ? '<div class="tj-section"><h5>✂️ 剪辑风格</h5><div class="tj-content">' + escapeHtml(plan.editingStyle) + '</div></div>' : '') +
        (plan.scriptHighlights ? '<div class="tj-section"><h5>💬 文案亮点</h5><div class="tj-content">' + escapeHtml(plan.scriptHighlights) + '</div></div>' : '') +
        '<div class="tj-section"><h5>🔥 为什么能火</h5><div class="tj-content">' + escapeHtml(plan.whyViral || '') + '</div></div>' +
        (plan.keyFormula ? '<div class="tj-section" style="background:#f3e5f5;border-radius:6px;padding:10px 12px;margin:8px 0"><strong>💡 核心公式：</strong>' + escapeHtml(plan.keyFormula) + '</div>' : '') +
        (plan.adaptation ? '<div class="tj-section" style="background:#fff8e1;border-radius:6px;padding:10px 12px"><strong>🏭 防腐账号借鉴：</strong><br>' + escapeHtml(plan.adaptation) + '</div>' : '') +
        '<div style="margin-top:8px"><button class="btn btn-outline btn-sm" onclick="var t=this.parentElement.parentElement;navigator.clipboard.writeText(t.innerText.trim()).then(()=>{this.innerHTML=\'✅ 已复制\';setTimeout(()=>{this.innerHTML=\'📋 复制\'},2000)})">📋 复制</button></div>' +
        '</div>';
    } else {
      target.innerHTML = '<div class="trend-jack-card"><div style="color:var(--danger)">❌ ' + escapeHtml(res.error || '分析失败') + '</div></div>';
    }
  } catch(e) {
    target.innerHTML = '<div class="trend-jack-card"><div style="color:var(--danger)">❌ ' + escapeHtml(e.message) + '</div></div>';
  }
}

async function analyzeVideo() {
  const input = document.getElementById('videoAnalysisInput');
  if (!input || !input.value.trim()) { if (input) input.style.borderColor = 'var(--danger)'; return; }
  if (input) input.style.borderColor = '';
  await analyzeHotVideo(input.value.trim());
}

async function analyzeAccount() {
  const input = document.getElementById('accountAnalysisInput');
  if (!input || !input.value.trim()) { if (input) input.style.borderColor = 'var(--danger)'; return; }
  if (input) input.style.borderColor = '';
  const name = input.value.trim();
  const resultEl = document.getElementById('analysisResult') || document.getElementById('trendJackPanel');
  if (!resultEl) return;
  const apiKey = state.currentUser?.apiKey || state.apiKey;
  const keyword = getUserKeyword();
  if (!apiKey) { alert('请先配置API密钥'); switchView('settings'); return; }
  resultEl.innerHTML = '<div class="ht-loading"><div class="spinner"></div><div>正在分析对标账号...</div></div>';
  resultEl.classList.add('active');
  resultEl.scrollIntoView({ behavior: 'smooth' });
  try {
    const res = await apiPost('/api/generate', { apiKey, type: 'analyzeAccount', params: { accountName: name, keyword } });
    if (res.success) {
      let plan;
      try {
        let clean = res.content.trim();
        if (clean.startsWith('```')) clean = clean.replace(/```json\\s*/i, '').replace(/```\\s*$/, '').trim();
        plan = JSON.parse(clean);
      } catch(e) {
        resultEl.innerHTML = '<div class="trend-jack-card"><div style="white-space:pre-wrap;font-size:13px;line-height:1.7">' + escapeHtml(res.content) + '</div></div>';
        return;
      }
      resultEl.innerHTML = '<div class="trend-jack-card" style="border-left:4px solid #7b1fa2">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<span style="font-size:20px">📊</span>' +
        '<div><div class="tj-title">' + escapeHtml(plan.accountName || name) + ' · 账号分析</div></div></div>' +
        '<div class="tj-section"><h5>🎭 账号定位</h5><div class="tj-content">' + escapeHtml(plan.positioning || '') + '</div></div>' +
        (plan.contentPillars && plan.contentPillars.length > 0 ? '<div class="tj-section"><h5>📋 内容支柱</h5><div class="tj-tags">' + plan.contentPillars.map(p => '<span class="tj-tag">' + escapeHtml(p) + '</span>').join('') + '</div></div>' : '') +
        '<div class="tj-section"><h5>🎬 视频风格</h5><div class="tj-content">' + escapeHtml(plan.videoStyle || '') + '</div></div>' +
        '<div class="tj-section"><h5>📅 发布策略</h5><div class="tj-content">' + escapeHtml(plan.postingStrategy || '') + '</div></div>' +
        '<div class="tj-section"><h5>💬 互动策略</h5><div class="tj-content">' + escapeHtml(plan.engagementTactics || '') + '</div></div>' +
        (plan.successFactors && plan.successFactors.length > 0 ? '<div class="tj-section" style="background:#e8f5e9;border-radius:6px;padding:10px 12px;margin:8px 0"><strong>✅ 成功因素：</strong><ul style="margin:6px 0 0 16px">' + plan.successFactors.map(f => '<li style="font-size:12px">' + escapeHtml(f) + '</li>').join('') + '</ul></div>' : '') +
        (plan.learnableAspects ? '<div class="tj-section" style="background:#fff8e1;border-radius:6px;padding:10px 12px"><strong>🏭 值得借鉴：</strong><br>' + escapeHtml(plan.learnableAspects) + '</div>' : '') +
        '<div style="margin-top:8px"><button class="btn btn-outline btn-sm" onclick="var t=this.parentElement.parentElement;navigator.clipboard.writeText(t.innerText.trim()).then(()=>{this.innerHTML=\'✅ 已复制\';setTimeout(()=>{this.innerHTML=\'📋 复制\'},2000)})">📋 复制</button></div>' +
        '</div>';
    } else {
      resultEl.innerHTML = '<div class="trend-jack-card"><div style="color:var(--danger)">❌ ' + escapeHtml(res.error || '分析失败') + '</div></div>';
    }
  } catch(e) {
    resultEl.innerHTML = '<div class="trend-jack-card"><div style="color:var(--danger)">❌ ' + escapeHtml(e.message) + '</div></div>';
  }
}

function copyResult(btn) {
  const text = btn.parentElement.textContent.replace('📋 复制','').trim();
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ 已复制';
    setTimeout(() => { btn.innerHTML = '📋 复制'; }, 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = '✅ 已复制';
    setTimeout(() => { btn.innerHTML = '📋 复制'; }, 2000);
  });
}

// ─── Calendar ───
function renderCalendar(container) {
  const keyword = getUserKeyword();
  const plan = getUserPlan();

  let planEvents = '';
  if (plan && plan.personalIP && plan.factoryDaily) {
    plan.personalIP.forEach((d, i) => {
      const fd = plan.factoryDaily[i];
      planEvents += `
        <div class="calendar-event">
          <span class="event-account ip">个人IP</span>
          <span class="event-title">${escapeHtml(d.day)}：${escapeHtml(d.topic || '')}</span>
          <span class="event-status">📅 待发布</span>
        </div>
      `;
      if (fd) {
        planEvents += `
          <div class="calendar-event">
            <span class="event-account factory">工厂号</span>
            <span class="event-title">${escapeHtml(fd.day)}：${escapeHtml(fd.topic || '')}</span>
            <span class="event-status">📅 待拍摄</span>
          </div>
        `;
      }
    });
  }
  if (!planEvents) {
    planEvents = '<div style="padding:16px 0;color:var(--text-secondary);text-align:center">请先在「工作台」设置本周关键词并生成周计划</div>';
  }

  container.innerHTML = `
    <div class="view active">
      <div class="calendar-header">
        <h2>📅 内容日历</h2>
        ${keyword ? `<span style="font-size:13px;color:var(--text-secondary)">本周关键词：<strong>${escapeHtml(keyword)}</strong></span>` : ''}
        <button class="btn btn-outline" onclick="refreshCalendar()" style="margin-left:auto">🔄 刷新</button>
      </div>
      <div id="calendarGrid" class="calendar-grid">
        <div class="cal-weekday">一</div><div class="cal-weekday">二</div><div class="cal-weekday">三</div>
        <div class="cal-weekday">四</div><div class="cal-weekday">五</div><div class="cal-weekday">六</div>
        <div class="cal-weekday">日</div>
      </div>
      <div class="calendar-list">
        <h4>📋 本周内容排期</h4>
        <div id="calendarEvents">${planEvents}</div>
      </div>
    </div>
  `;
  buildCalendarGrid();
}

function buildCalendarGrid() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  // Keep weekday headers
  const headerCount = 7;
  const existingHeaders = grid.querySelectorAll('.cal-weekday');
  if (existingHeaders.length === 7) {
    // Only replace day cells
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayNum = now.getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const prevMonthDays = new Date(year, month, 0).getDate();

    let cells = [];
    for (let i = startOffset - 1; i >= 0; i--) cells.push(`<div class="cal-day other-month">${prevMonthDays - i}</div>`);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`<div class="cal-day${d === todayNum ? ' today' : ''}">${d}</div>`);
    const total = startOffset + daysInMonth;
    const remaining = (7 - (total % 7)) % 7;
    for (let d = 1; d <= remaining; d++) cells.push(`<div class="cal-day other-month">${d}</div>`);

    // Remove old day cells (keep weekday headers)
    while (grid.children.length > 7) grid.removeChild(grid.lastElementChild);
    cells.forEach(h => grid.insertAdjacentHTML('beforeend', h));
  }
}

function refreshCalendar() { buildCalendarGrid(); }

// ─── Analytics ───
function renderAnalytics(container) {
  container.innerHTML = `
    <div class="view active">
      <div class="analytics-header">
        <h2>📈 数据看板</h2>
        ${state.currentUser ? `<span style="font-size:13px;color:var(--text-secondary)">用户：${escapeHtml(state.currentUser.name)}</span>` : ''}
      </div>
      <div class="analytics-grid">
        <div class="stat-card"><div class="stat-value" id="statVideos">0</div><div class="stat-label">本周发布视频</div></div>
        <div class="stat-card"><div class="stat-value" id="statViews">0</div><div class="stat-label">本周总播放</div></div>
        <div class="stat-card"><div class="stat-value" id="statInquiries">0</div><div class="stat-label">本周询盘</div></div>
        <div class="stat-card"><div class="stat-value" id="statFollowers">0</div><div class="stat-label">本周涨粉</div></div>
        <div class="stat-card"><div class="stat-value">${Math.floor(Math.random()*30+10)}%</div><div class="stat-label">平均完播率</div></div>
        <div class="stat-card"><div class="stat-value">${Math.floor(Math.random()*5+2)}%</div><div class="stat-label">互动率</div></div>
      </div>
      <div class="analytics-table">
        <h4 style="margin-bottom:12px">📊 数据记录表</h4>
        <table>
          <thead><tr><th>日期</th><th>账号</th><th>视频标题</th><th>播放量</th><th>点赞</th><th>评论</th><th>分享</th></tr></thead>
          <tbody id="analyticsTableBody">
            <tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:24px">暂无数据，点击下方添加示例数据</td></tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top:16px"><button class="btn btn-outline" onclick="addTestData()">📝 添加示例数据</button></div>
    </div>
  `;
}

function addTestData() {
  const tbody = document.getElementById('analyticsTableBody');
  if (!tbody) return;
  const keyword = getUserKeyword() || '防腐设备';
  const data = [
    { date:'2026-07-21', acct:'个人IP号', title:'钢衬储罐选型的3个关键点', views:Math.floor(Math.random()*5000+1000), likes:Math.floor(Math.random()*500+50), comments:Math.floor(Math.random()*80+10), shares:Math.floor(Math.random()*30+5) },
    { date:'2026-07-21', acct:'工厂日常号', title:'30m³钢衬PO储罐发货实拍', views:Math.floor(Math.random()*8000+2000), likes:Math.floor(Math.random()*600+80), comments:Math.floor(Math.random()*100+15), shares:Math.floor(Math.random()*50+10) },
    { date:'2026-07-22', acct:'个人IP号', title:'四氟衬里为什么比PE更耐高温？', views:Math.floor(Math.random()*4000+800), likes:Math.floor(Math.random()*400+40), comments:Math.floor(Math.random()*60+8), shares:Math.floor(Math.random()*25+3) },
    { date:'2026-07-22', acct:'工厂日常号', title:'焊接工艺细节展示：手工电弧焊', views:Math.floor(Math.random()*6000+1500), likes:Math.floor(Math.random()*500+60), comments:Math.floor(Math.random()*70+12), shares:Math.floor(Math.random()*40+8) },
  ];
  tbody.innerHTML = data.map(d => `
    <tr>
      <td>${d.date}</td>
      <td><span style="background:${d.acct === '个人IP号' ? 'var(--primary-light)' : '#fff3e0'};padding:2px 8px;border-radius:4px;font-size:12px">${d.acct}</span></td>
      <td>${escapeHtml(d.title)}</td>
      <td><strong>${d.views.toLocaleString()}</strong></td>
      <td>${d.likes.toLocaleString()}</td>
      <td>${d.comments}</td>
      <td>${d.shares}</td>
    </tr>
  `).join('');
  document.getElementById('statVideos').textContent = data.length;
  document.getElementById('statViews').textContent = data.reduce((s, d) => s + d.views, 0).toLocaleString();
  document.getElementById('statInquiries').textContent = Math.floor(Math.random() * 8 + 2);
  document.getElementById('statFollowers').textContent = '+' + Math.floor(Math.random() * 50 + 10);
}

// ─── Settings ───
function renderSettings(container) {
  const apiKey = state.currentUser?.apiKey || state.apiKey || '';
  container.innerHTML = `
    <div class="view active">
      <div class="settings-section">
        <h2>⚙️ 系统设置</h2>
        <div class="setting-card">
          <h3>👤 当前用户</h3>
          <p>姓名：<strong>${state.currentUser ? escapeHtml(state.currentUser.name) : '未登录'}</strong></p>
          <button class="btn btn-outline" onclick="showUserSwitcher()">🔄 切换用户</button>
          <button class="btn btn-outline" onclick="logout()" style="margin-left:8px">🚪 退出登录</button>
        </div>
        <div class="setting-card">
          <h3>🔑 DeepSeek API 配置（个人密钥）</h3>
          <p>每个员工可独立配置自己的API密钥，互不干扰。</p>
          <div class="api-key-input">
            <input type="password" id="apiKeyInput" placeholder="sk-..." value="${escapeHtml(apiKey)}">
            <button class="btn btn-primary" onclick="saveApiKey()">💾 保存</button>
          </div>
          <div class="api-status" id="apiStatus">
            <span class="dot ${apiKey ? 'green' : 'gray'}"></span>
            ${apiKey ? '✅ 已配置个人密钥' : '⏸️ 未配置'}
          </div>
        </div>
        <div class="setting-card">
          <h3>🔑 本周关键词</h3>
          <p>当前关键词：<strong>${escapeHtml(getUserKeyword()) || '未设置'}</strong></p>
          <button class="btn btn-outline" onclick="switchView('dashboard')">📊 去工作台设置</button>
          ${getUserPlan() ? '<button class="btn btn-outline" onclick="clearKeywordPlan()" style="margin-left:8px">🗑️ 清除计划</button>' : ''}
        </div>
        <div class="setting-card">
          <h3>📱 账号信息</h3>
          <div style="padding:8px 0">
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0"><span style="font-size:24px">👨‍🔧</span><div><strong>个人IP号</strong><br><span style="font-size:12px;color:var(--text-secondary)">江苏兆辉防腐·李工</span></div></div>
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0"><span style="font-size:24px">🏭</span><div><strong>工厂日常号</strong><br><span style="font-size:12px;color:var(--text-secondary)">兆辉防腐工厂直击</span></div></div>
          </div>
        </div>
        <div class="setting-card">
          <h3>ℹ️ 系统信息</h3>
          <div style="font-size:13px;line-height:2">
            <div>系统版本：v2.0（多用户 + 关键词周计划）</div>
            <div>本地存储：每个员工数据独立保存至浏览器</div>
            <div>AI引擎：DeepSeek Chat</div>
            <div>适用：江苏兆辉防腐科技有限公司 · 抖音双账号运营</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function saveApiKey() {
  const input = document.getElementById('apiKeyInput');
  const key = input.value.trim();
  state.apiKey = key;
  if (state.currentUser) {
    state.currentUser.apiKey = key;
    saveUserData(state.currentUser.name, state.currentUser);
  } else {
    localStorage.setItem('deepseek_api_key', key);
  }
  const status = document.getElementById('apiStatus');
  status.innerHTML = key
    ? '<span class="dot green"></span> ✅ 个人密钥已保存'
    : '<span class="dot gray"></span> ⏸️ 未配置';
  const btn = document.querySelector('.api-key-input .btn');
  const orig = btn.innerHTML;
  btn.innerHTML = '✅ 已保存';
  setTimeout(() => { btn.innerHTML = orig; }, 2000);
}

// ─── Icon Mapping ───
function getIcon(name) {
  const map = { 'target':'🎯','edit':'✍️','camera':'📸','scissors':'✂️','music':'🎵','image':'🖼️','chart':'📊','message':'💬','folder':'🗂️','film':'🎬','send':'🚀','calendar':'📋' };
  return map[name] || '📌';
}

// ─── Time Update ───
function updateTime() {
  const now = new Date();
  const timeEl = document.getElementById('timeDisplay');
  const dateEl = document.getElementById('dateDisplay');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' });
  if (dateEl) dateEl.textContent = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日';
}

// ─── Hot Topics: Parse card title and analyze ───
function analyzeHotVideoFromCard(btn) {
  const card = btn.closest('.ht-card');
  if (!card) return;
  const titleEl = card.querySelector('.ht-title');
  if (!titleEl) return;
  const title = titleEl.textContent.trim();
  if (!title) return;
  analyzeHotVideo(title);
}

// ─── Init ───
(async function init() {
  await loadSchedules();
  updateTime();
  setInterval(updateTime, 10000);
  // Show login or proceed
  if (!initUserSystem()) return;
  renderView('dashboard');
})();
