/* ============================================================
   分镜阁 StoryDeck — 主逻辑
   模块：设置存取 / 内置分镜引擎（免费）/ 文案 API / 生图（免费+自建）
        / 分镜编辑 / 预览台 / 导出
   ============================================================ */
"use strict";

/* ---------------- 工具 ---------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function toast(msg, kind = "info") {
  const el = document.createElement("div");
  el.className = "toast";
  el.dataset.kind = kind;
  el.textContent = msg;
  $("#toast-wrap").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; }, 2400);
  setTimeout(() => el.remove(), 2900);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 全局状态 ---------------- */
const LS_KEY = "storydeck.settings.v1";

const state = {
  settings: {
    textUrl: "https://api.deepseek.com/v1",
    textModel: "deepseek-chat",
    textKey: "",
    imgProvider: "free", // free | custom
    imgUrl: "https://api.siliconflow.cn/v1",
    imgModel: "Kwai-Kolors/Kolors",
    imgKey: "",
  },
  shots: [], // {id, caption, prompt, status, src, seed}
  previewIndex: 0,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) Object.assign(state.settings, JSON.parse(raw));
  } catch { /* 忽略损坏数据 */ }
}
function saveSettings() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.settings));
}

/* ---------------- 设置弹层 ---------------- */
const dialog = $("#settings-dialog");

function openSettings() {
  const s = state.settings;
  $("#s-text-url").value = s.textUrl;
  $("#s-text-model").value = s.textModel;
  $("#s-text-key").value = s.textKey;
  $(`input[name="img-provider"][value="${s.imgProvider}"]`).checked = true;
  $("#s-img-url").value = s.imgUrl;
  $("#s-img-model").value = s.imgModel;
  $("#s-img-key").value = s.imgKey;
  syncCustomImgFields();
  dialog.showModal();
}
function syncCustomImgFields() {
  const mode = $(`input[name="img-provider"]:checked`).value;
  $("#custom-img-fields").style.display = mode === "custom" ? "block" : "none";
}

$("#btn-open-settings").addEventListener("click", openSettings);
$("#btn-hero-settings").addEventListener("click", openSettings);
$("#btn-close-settings").addEventListener("click", () => dialog.close());
$$(`input[name="img-provider"]`).forEach((r) => r.addEventListener("change", syncCustomImgFields));

$("#btn-save-settings").addEventListener("click", () => {
  Object.assign(state.settings, {
    textUrl: $("#s-text-url").value.trim(),
    textModel: $("#s-text-model").value.trim(),
    textKey: $("#s-text-key").value.trim(),
    imgProvider: $(`input[name="img-provider"]:checked`).value,
    imgUrl: $("#s-img-url").value.trim(),
    imgModel: $("#s-img-model").value.trim(),
    imgKey: $("#s-img-key").value.trim(),
  });
  saveSettings();
  dialog.close();
  toast("设置已保存（仅存在本机浏览器）");
});

$("#btn-clear-settings").addEventListener("click", () => {
  localStorage.removeItem(LS_KEY);
  state.settings = { ...state.settings, textKey: "", imgKey: "" };
  openSettings();
  toast("已清空本地配置");
});

/* ============================================================
   内置分镜引擎（免费，无需任何 API）
   思路：按题材的叙事弧线（入场→规则→异常→危机→反转→钩子）
   从措辞池抽卡填槽，产出 {caption 独白, prompt 画面描述}
   ============================================================ */
const GENRES = {
  guize: {
    label: "规则怪谈",
    slots: {
      place: "这栋楼", role: "新来的住客", item: "铜钥匙",
      npc: "戴白手套的管事", weird: "没有影子的客人",
    },
    stages: [
      {
        weight: 1, key: "入场",
        caps: [
          "明明是白天，{place}里却亮着灯。我数了数，走廊尽头的灯，比昨天少了一盏。",
          "搬进来的第一天我就发现，{place}的住户从不走正门。",
          "{npc}递给我一把{item}，说：到了半夜，别用它开任何一扇门。",
        ],
        prompts: [
          "昏暗的老式公寓走廊，一排闪烁的钨丝灯泡，尽头一盏熄灭，阴影拉长，压抑构图",
          "深夜老公寓正门，门缝透出微光，一位年轻人站在门外犹豫，逆光剪影",
          "老式前台，穿白手套的管事递出一把古铜钥匙，烛光暖黄，面部半明半暗",
        ],
      },
      {
        weight: 2, key: "规则",
        caps: [
          "墙上贴着新的规则：第七条——『不要回应敲门声』。可我的房间，根本没有门。",
          "规则一共九条，第八条被撕掉了。撕口很新。",
          "『请在午夜前回到房间。』我看了眼表，现在是十二点零一分。",
        ],
        prompts: [
          "斑驳墙面贴着泛黄告示，密密麻麻的手写规则，其中一条被撕去，侧光强调撕裂处",
          "老式机械挂钟指向午夜十二点，指针特写，背景昏暗走廊虚化",
          "狭长走廊尽头一扇不存在的门洞，墙面规则告示发光，诡异氛围",
        ],
      },
      {
        weight: 2, key: "异常",
        caps: [
          "对面房间搬来一位{weird}。我盯着看了很久——灯下，他没有影子。",
          "每到凌晨三点，楼道里会响起拖鞋声。这栋楼，明明只有我一个住户。",
          "镜子里的我，比我慢了半秒。",
        ],
        prompts: [
          "老式楼道，一位着装怪异的客人立于灯下却没有影子，恐怖片布光",
          "凌晨楼道视角，一双老式拖鞋的模糊残影，长曝光拖影感",
          "斑驳浴室镜子，镜中人表情与真实略有偏差，冷光惊悚",
        ],
      },
      {
        weight: 2, key: "危机",
        caps: [
          "对面的人违反了第七条。现在，整层楼的门，都在敲。",
          "灯灭了。黑暗里，有什么东西在挨个房间摸索门牌。",
          "我躲进通风管道，心脏快跳出喉咙——管道壁上，刻满了抓痕。",
        ],
        prompts: [
          "黑暗走廊，无数扇老木门同时震颤，门牌晃动，强压迫感构图",
          "完全黑暗中一束手电光扫过门牌，尘埃浮动，惊悚氛围",
          "狭窄生锈的通风管道内部，爬行的第一人称视角，尽头微光",
        ],
      },
      {
        weight: 2, key: "反转",
        caps: [
          "我翻开{item}的铭牌，背面刻着一行小字：上一个用钥匙的人，是我。",
          "原来这栋楼真正的规则只有一条——住进来的人，都会变成规则本身。",
          "我在登记簿上看到了自己的名字。签名日期，是三十年前。",
        ],
        prompts: [
          "特写手捧古铜钥匙，铭牌背面刻字，烛光摇曳，悬念构图",
          "泛黄的住户登记簿，毛笔字迹写着一个熟悉的名字，昏黄台灯",
          "老宅档案室，堆积的旧照片与卷宗，一束顶光打在摊开的册页上",
        ],
      },
      {
        weight: 1, key: "钩子",
        caps: [
          "如果这一集你有看懂的地方，评论区告诉我。下一集，轮到我给别人立规则了。",
          "我把{item}塞回了口袋。下章比较精彩，明天更新。",
          "门外安静了。但我总觉得，这只是它换了一种敲门方式。",
        ],
        prompts: [
          "主角立于黑暗走廊尽头回望镜头，手中攥着钥匙，钩子式构图，留白",
        ],
      },
    ],
  },

  minguo: {
    label: "民国奇幻",
    slots: {
      place: "众生楼", role: "赌楼荷官", item: "晶核",
      npc: "穿马褂的管事", weird: "戴白手套的女士",
    },
    stages: [
      {
        weight: 1, key: "入场",
        caps: [
          "百乐门式的旋梯，鎏金的灯，众生楼的牌匾下挂着一块幕布。",
          "我端着托盘穿过赌厅，袖口里藏着{(item)}。",
        ],
        prompts: [
          "民国赌场大厅全景，鎏金水晶吊灯，红木赌桌，穿旗袍与马褂的宾客，烛光华丽",
          "穿深色旗袍的荷官端着银托盘穿过金碧辉煌的赌厅，跟拍视角，浅景深",
        ],
      },
      {
        weight: 2, key: "赌局",
        caps: [
          "{npc}敲了敲桌沿：今晚的局，赌{(npc)}会偷多少颗{item}。",
          "屏幕侧边，赫然显示：【本场赌局命题】。下方的数字与赔率，密密麻麻。",
        ],
        prompts: [
          "民国赌局现场，赌桌特写，筹码与骰盏，众人屏息，暖金色调",
          "青蓝色全息感的老式屏幕显示赔率榜单，旗袍女子背影，赛博民国混搭",
        ],
      },
      {
        weight: 2, key: "直播",
        caps: [
          "画面里，我把一颗{item}塞进口袋，自以为隐秘的每一个瞬间，全部被直播。",
          "我第一次看懂了：他们在玩一场活人游戏。",
        ],
        prompts: [
          "巨大的监控屏幕墙前人群仰望，屏幕里是偷藏东西的女子画面，剧场式构图",
          "赌场包厢内众人举杯大笑，前景赌盘旋转，暗金奢华光影",
        ],
      },
      {
        weight: 2, key: "危机",
        caps: [
          "{weird}朝我走来，手套在桌沿敲了三下。三下，是处决的信号。",
          "我躲进衣柜般的密室，屏住呼吸。心底下还侥幸以为，没人发现我正躲在这里。",
        ],
        prompts: [
          "戴白手套的神秘女士穿过赌厅直视镜头，身后人群虚化，压迫构图",
          "密室衣柜缝隙中向外窥视的第一人称视角，门缝透光，惊惧氛围",
        ],
      },
      {
        weight: 2, key: "反转",
        caps: [
          "赌局的结果从来不看输赢——看的是，谁敢在直播里演戏给他们看。",
          "我把最后一颗{item}放回原位。今晚，我自己坐上了庄家位。",
        ],
        prompts: [
          "女子立于赌桌主位身后，双手撑桌，灯光自下而上，气场全开",
          "特写：一颗发光的晶核被轻轻放回丝绒台面，烛光反射，戏剧张力",
        ],
      },
      {
        weight: 1, key: "钩子",
        caps: [
          "下章比较精彩，明天更新。",
          "散场时，{npc}在我耳边说：下一场，赌的是你的名字。",
        ],
        prompts: [
          "空荡赌厅，一盏吊灯熄灭，主角背影立于门口，钩子式留白构图",
        ],
      },
    ],
  },

  fuchou: {
    label: "悬疑复仇",
    slots: {
      place: "沈家", role: "刚回城的养女", item: "半张照片",
      npc: "大伯", weird: "继母",
    },
    stages: [
      {
        weight: 1, key: "重生",
        caps: [
          "我死过一次。所以这一次，我清楚地知道，{npc}会在雨夜动手。",
          "葬礼上所有人都哭了，只有我在数，谁没来。",
        ],
        prompts: [
          "雨夜老宅 exterior，一道闪电照亮雕花窗棂，冷蓝调悬疑",
          "灵堂白烛与遗像，黑衣女子平静抬眼，与周遭恸哭形成反差",
        ],
      },
      {
        weight: 2, key: "隐忍",
        caps: [
          "继母把汤端到我面前，笑着说趁热喝。我笑着接过来——原样泼在了花盆里。",
          "全家福拍摄那天，我攥着{item}站在最边上。",
        ],
        prompts: [
          "民国式餐厅长桌，继母递汤的特写，两人笑容下暗流涌动",
          "老宅全家福合影场景，摄影棚灯光，边缘站立的女子攥紧照片",
        ],
      },
      {
        weight: 2, key: "布局",
        caps: [
          "我花了三个月，把他们每个人做过的账，一笔一笔抄了下来。",
          "今晚的家族宴，请帖是我发的。",
        ],
        prompts: [
          "深夜书房，台灯下摊满账本与剪报，女子伏案执笔，暖光私密氛围",
          "宴厅请柬特写，火漆封印，背景人影忙碌，山雨欲来",
        ],
      },
      {
        weight: 2, key: "反击",
        caps: [
          "投影亮起的那一刻，满桌的人脸色，比墙还白。",
          "『大伯，这笔钱，是替我父亲收的。』",
        ],
        prompts: [
          "宴厅投影幕布亮起刺目白光，宾客惊愕回望，戏剧性顶光",
          "女子立于长桌尽头直视众人，单侧打光，气场压迫构图",
        ],
      },
      {
        weight: 1, key: "钩子",
        caps: [
          "以为这就完了？{place}的地契上，还有第三个名字。明天更新。",
        ],
        prompts: ["泛黄地契特写，两个名字被红笔划去，第三个名字未干，悬念构图"],
      },
    ],
  },
};

/* 填槽：{place} {role} {item} {npc} {weird} */
function fillTemplate(str, slots) {
  return str
    .replaceAll("{place}", slots.place)
    .replaceAll("{role}", slots.role)
    .replaceAll("{item}", slots.item)
    .replaceAll("{npc}", slots.npc)
    .replaceAll("{weird}", slots.weird)
    .replaceAll("{(", "("); // 兜底清理
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function builtinGenerate({ genre, title, role, premise, count }) {
  const g = GENRES[genre];
  const slots = { ...g.slots };
  if (title) slots.place = genre === "guize" ? `「${title}」这栋楼` : `「${title}」`;
  if (role) slots.role = role;
  if (premise) {
    // 从设定里提取名词式关键词填入场景（取前 30 字做点缀）
    slots.premise = premise.slice(0, 30);
  }

  // 按权重铺满 count 格：先各阶段抽 1，再循环补
  const stages = [];
  for (const st of g.stages) stages.push(st);
  while (stages.length < count) {
    stages.push(g.stages[1 + Math.floor(Math.random() * (g.stages.length - 1))]);
  }
  const chosen = stages.slice(0, count);

  return chosen.map((st, i) => {
    const capT = pick(st.caps);
    const proT = pick(st.prompts);
    return {
      id: `shot-${Date.now()}-${i}`,
      caption: fillTemplate(capT, slots),
      prompt: fillTemplate(proT, slots),
      status: "pending",
      src: null,
      seed: null,
    };
  });
}

/* ---------------- 文案 API 生成（OpenAI 兼容） ---------------- */
async function apiGenerateScript({ genre, title, role, premise, count }) {
  const { textUrl, textModel, textKey } = state.settings;
  if (!textUrl || !textKey) throw new Error("请先在「接口设置」里填写文案 API 地址与密钥");
  const genreLabel = GENRES[genre]?.label || "悬疑";

  const system = `你是顶级抖音「AI 剧情图文」编剧，擅长${genreLabel}题材。输出严格的 JSON 数组，不要多余文字。`;
  const user = `请为一集剧情图文写分镜脚本，共 ${count} 格。
故事名：${title || "未命名"}
主角身份：${role || "普通人"}
副本设定：${premise || "自拟一个有钩子的设定"}

要求：
1. 每格是一个对象：{"caption":"第一人称独白，不超过42字，口语化有悬念","prompt":"画面描述，中文，含场景/人物/服装/光线/构图，供AI绘画使用，25-60字"}
2. 叙事弧线：开场钩子→展开→危机→反转→结尾留强钩子
3. 最后两格必须是钩子，驱动追更
4. 只输出 JSON 数组，形如 [{"caption":"…","prompt":"…"},…]`;

  const resp = await fetch(`${textUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${textKey}` },
    body: JSON.stringify({
      model: textModel || "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.95,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`文案 API 返回 ${resp.status}：${t.slice(0, 160)}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("API 返回里没找到 JSON 数组");
  const arr = JSON.parse(m[0]);
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("API 返回的分镜为空");
  return arr.slice(0, count).map((it, i) => ({
    id: `shot-${Date.now()}-${i}`,
    caption: String(it.caption || "").slice(0, 80),
    prompt: String(it.prompt || it.caption || "").slice(0, 200),
    status: "pending",
    src: null,
    seed: null,
  }));
}

/* ---------------- 剧本表单 ---------------- */
$("#f-count").addEventListener("input", (e) => {
  $("#f-count-out").textContent = e.target.value;
});

$("#script-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const mode = $(`input[name="script-mode"]:checked`).value;
  const opts = {
    genre: $("#f-genre").value,
    title: $("#f-title").value.trim(),
    role: $("#f-role").value.trim(),
    premise: $("#f-premise").value.trim(),
    count: Number($("#f-count").value),
  };

  const btn = $("#btn-gen-script");
  btn.disabled = true;
  btn.textContent = mode === "api" ? "正在调用文案 API……" : "正在生成分镜……";
  try {
    const shots = mode === "api" ? await apiGenerateScript(opts) : builtinGenerate(opts);
    state.shots = shots;
    state.previewIndex = 0;
    renderShots();
    renderPreview();
    toast(`已生成 ${shots.length} 格分镜`);
  } catch (err) {
    toast(err.message || "生成失败", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "生成这一集的分镜";
  }
});

/* ---------------- 分镜列表渲染与编辑 ---------------- */
function renderShots() {
  const list = $("#shot-list");
  list.innerHTML = "";
  if (state.shots.length === 0) {
    list.innerHTML = `<div class="empty-state" id="shot-empty">
      <p class="display">还没有分镜</p>
      <p>在左侧填好设定，选「内置引擎」不配任何 API 也能生成。</p></div>`;
    return;
  }

  state.shots.forEach((shot, i) => {
    const card = document.createElement("div");
    card.className = "shot-card";
    card.innerHTML = `
      <div class="shot-num">${String(i + 1).padStart(2, "0")}</div>
      <div class="shot-body">
        <input class="shot-caption-input" value="${escapeAttr(shot.caption)}" placeholder="独白（画面上的字幕）" aria-label="第${i + 1}格独白" />
        <textarea class="shot-prompt-input" placeholder="画面描述（给生图模型的指令）" aria-label="第${i + 1}格画面描述">${escapeHtml(shot.prompt)}</textarea>
        <div class="shot-foot">
          <span class="shot-status" data-state="${shot.status}">${statusText(shot.status)}</span>
          <button class="btn btn-sm" type="button" data-act="redo">重绘</button>
          <button class="btn btn-sm btn-ghost" type="button" data-act="del">删除</button>
          ${shot.src ? `<img class="shot-thumb" src="${shot.src}" alt="第${i + 1}格缩略图" />` : ""}
        </div>
      </div>`;

    card.querySelector(".shot-caption-input").addEventListener("input", (e) => {
      shot.caption = e.target.value;
      renderPreview();
    });
    card.querySelector(".shot-prompt-input").addEventListener("input", (e) => {
      shot.prompt = e.target.value;
    });
    card.querySelector('[data-act="redo"]').addEventListener("click", () => genOne(i));
    card.querySelector('[data-act="del"]').addEventListener("click", () => {
      state.shots.splice(i, 1);
      renderShots();
      renderPreview();
    });
    const thumb = card.querySelector(".shot-thumb");
    if (thumb) {
      thumb.addEventListener("click", () => {
        state.previewIndex = i;
        renderPreview();
        $("#stage-preview").scrollIntoView({ behavior: "smooth" });
      });
    }
    list.appendChild(card);
  });
}

function statusText(s) {
  return { pending: "○ 待生成", running: "◐ 生成中", done: "● 已成图", error: "✕ 失败" }[s] || s;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}

/* ---------------- 生图 ---------------- */
const STYLE_SUFFIX = {
  "minguo-fantasy": "Republican-era Chinese fantasy, ornate golden interiors, candlelight, qipao, cinematic lighting, film grain, ultra detailed",
  cinematic: "cinematic film still, photorealistic, dramatic rim light, 35mm, moody color grading, shallow depth of field",
  noir: "dark thriller, high contrast noir lighting, fog, rain, dramatic shadows, tense atmosphere",
  guofeng: "Chinese ink painting fused with dark fantasy, mist, ethereal glow, oriental architecture, painterly",
};

function buildFullPrompt(shot, style) {
  return `${shot.prompt}，${STYLE_SUFFIX[style] || STYLE_LOOKUP_DEFAULT}，vertical composition, 9:16`;
}
const STYLE_LOOKUP_DEFAULT = "cinematic lighting, ultra detailed";

function freeImageUrl(fullPrompt, seed) {
  const base = "https://image.pollinations.ai/prompt/";
  // 注：公共通道为尽力而为，失败时自动降级为内置字幕卡
  const params = new URLSearchParams({ width: "768", height: "1344", seed: String(seed) });
  return `${base}${encodeURIComponent(fullPrompt)}?${params}`;
}

/* 内置字幕卡：Canvas 绘制电影感深色底 + 鎏金边框 + 独白文字（离线兜底，100% 可用） */
function makeCaptionCard(shot, index) {
  const W = 768, H = 1344;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 背景渐变（暖炭黑）
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1c1610");
  grad.addColorStop(0.55, "#0f0d0a");
  grad.addColorStop(1, "#221a10");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 鎏金内边框
  ctx.strokeStyle = "rgba(216, 169, 78, 0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = "rgba(216, 169, 78, 0.2)";
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // 底部辉光
  const glow = ctx.createRadialGradient(W / 2, H + 120, 60, W / 2, H + 120, W);
  glow.addColorStop(0, "rgba(216,169,78,0.28)");
  glow.addColorStop(1, "rgba(216,169,78,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 顶部编号
  ctx.fillStyle = "rgba(216, 169, 78, 0.9)";
  ctx.font = "italic 600 34px 'Cormorant Garamond', 'Noto Serif SC', serif";
  ctx.fillText(String(index + 1).padStart(2, "0"), 76, 116);
  ctx.font = "22px 'Noto Sans SC', sans-serif";
  ctx.fillStyle = "rgba(163, 151, 127, 0.9)";
  ctx.fillText("分镜阁 · 本集字幕卡", 76, 152);

  // 独白正文（自动换行）
  const text = shot.caption || "";
  ctx.fillStyle = "#f2ead9";
  ctx.font = "600 40px 'Noto Serif SC', serif";
  const maxChars = 12;
  const lines = [];
  for (let p = 0; p < text.length; p += maxChars) lines.push(text.slice(p, p + maxChars));
  const lineHeight = 72;
  const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, li) => {
    ctx.fillStyle = li === 0 ? "#f7f0df" : "#e4d9c2";
    ctx.fillText(line, 76, startY + li * lineHeight);
  });

  // 页码徽标
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  roundRect(ctx, W - 190, H - 120, 130, 52, 26);
  ctx.fill();
  ctx.fillStyle = "rgba(242, 234, 217, 0.9)";
  ctx.font = "24px 'Noto Sans SC', sans-serif";
  ctx.fillText("图文卡", W - 162, H - 86);

  return canvas.toDataURL("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function customImageUrl(fullPrompt) {
  const { imgUrl, imgModel, imgKey } = state.settings;
  if (!imgUrl || !imgKey) throw new Error("请先在「接口设置」配置自建图像接口");
  const resp = await fetch(`${imgUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${imgKey}` },
    body: JSON.stringify({ model: imgModel || "Kwai-Kolors/Kolors", prompt: fullPrompt, size: "768x1344" }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`图像 API 返回 ${resp.status}：${t.slice(0, 140)}`);
  }
  const data = await resp.json();
  const item = data.data?.[0];
  if (item?.b64_json) {
    const blob = await (await fetch(`data:image/png;base64,${item.b64_json}`)).blob();
    return URL.createObjectURL(blob);
  }
  if (item?.url) return item.url;
  throw new Error("图像 API 未返回图片");
}

async function genOne(i, seedOverride) {
  const shot = state.shots[i];
  if (!shot) return;
  const style = $("#f-style").value;
  const mode = $(`input[name="image-mode"]:checked`).value;
  const seed = seedOverride ?? (shot.seed ?? Math.floor(Math.random() * 1e6));

  shot.status = "running";
  updateShotStatus(i);
  try {
    const fullPrompt = buildFullPrompt(shot, style);
    let src;
    if (mode === "free") {
      src = freeImageUrl(fullPrompt, seed);
      // 公共通道不稳定：尝试两次，仍失败则降级为内置字幕卡
      let ok = false;
      try {
        await preloadImage(src);
        ok = true;
      } catch {
        await sleep(2500);
        try {
          src = freeImageUrl(fullPrompt, seed + 1);
          await preloadImage(src);
          ok = true;
        } catch { /* 走降级 */ }
      }
      if (!ok) {
        src = makeCaptionCard(shot, i);
        toast(`第 ${i + 1} 格公共通道不可用，已用内置字幕卡代替`);
      }
    } else {
      src = await customImageUrl(fullPrompt);
    }
    shot.src = src;
    shot.seed = seed;
    shot.status = "done";
  } catch (err) {
    shot.status = "error";
    updateShotStatus(i);
    toast(`第 ${i + 1} 格生图失败：${err.message}`, "error");
    return false;
  }
  updateShotStatus(i, true);
  renderPreview();
  return true;
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
    setTimeout(() => reject(new Error("加载超时")), 90_000);
  });
}

function updateShotStatus(i, withThumb = false) {
  const shot = state.shots[i];
  const cards = $$("#shot-list .shot-card");
  const card = cards[i];
  if (!card || !shot) return;
  const badge = card.querySelector(".shot-status");
  badge.dataset.state = shot.status;
  badge.textContent = statusText(shot.status);
  if (withThumb && shot.src && !card.querySelector(".shot-thumb")) {
    const img = document.createElement("img");
    img.className = "shot-thumb";
    img.src = shot.src;
    img.alt = `第${i + 1}格缩略图`;
    img.addEventListener("click", () => {
      state.previewIndex = i;
      renderPreview();
      $("#stage-preview").scrollIntoView({ behavior: "smooth" });
    });
    card.querySelector(".shot-foot").appendChild(img);
  }
  updateImageProgress();
}

function updateImageProgress() {
  const total = state.shots.length;
  const done = state.shots.filter((s) => s.status === "done").length;
  const running = state.shots.filter((s) => s.status === "running").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("#img-progress").style.width = `${pct}%`;
  $("#img-progress-text").textContent = total
    ? `已成图 ${done} / ${total} 格${running ? `，正在渲染 ${running} 格……` : done === total ? "，全部完成 ✓" : ""}`
    : "等待开始……";
}

$("#image-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.shots.length === 0) {
    toast("请先生成分镜", "error");
    return;
  }
  const btn = $("#btn-gen-images");
  btn.disabled = true;
  btn.textContent = "渲染中……";

  // 全局种子：填了就统一用，保证构图风格一致
  const globalSeed = $("#f-seed").value ? Number($("#f-seed").value) : null;

  const targets = state.shots.map((s, i) => i).filter((i) => state.shots[i].status !== "done");
  for (const i of targets) {
    await genOne(i, globalSeed !== null ? globalSeed + i : undefined);
  }
  btn.disabled = false;
  btn.textContent = "给全部分镜生图";
  updateImageProgress();
});

$("#btn-roll-seed").addEventListener("click", () => {
  $("#f-seed").value = Math.floor(Math.random() * 1e6);
  toast("已掷出新种子");
});

/* ---------------- 预览台 ---------------- */
function renderPreview() {
  const img = $("#pf-img");
  const placeholder = $("#pf-placeholder");
  const caption = $("#pf-caption");
  const page = $("#pf-page");
  const doneShots = state.shots.map((s) => s).filter((s) => s.src);

  if (doneShots.length === 0) {
    img.hidden = true;
    placeholder.hidden = false;
    caption.textContent = "";
    caption.hidden = false;
    page.hidden = true;
    $("#preview-progress").style.width = "0";
    $("#preview-tip").textContent = state.shots.length
      ? `${state.shots.length} 格分镜已就绪，去「生图工坊」渲染画面。`
      : "当前显示第 1 格。";
    return;
  }
  if (state.previewIndex >= doneShots.length) state.previewIndex = 0;
  const shot = doneShots[state.previewIndex];
  placeholder.hidden = true;
  img.hidden = false;
  img.src = shot.src;
  // 兜底字幕卡已把独白画进图里，隐藏叠加层避免文字重复
  caption.hidden = shot.src.startsWith("data:image/png");
  caption.textContent = shot.caption;
  page.hidden = false;
  page.textContent = `${state.previewIndex + 1} / ${doneShots.length}`;
  $("#preview-progress").style.width = `${((state.previewIndex + 1) / doneShots.length) * 100}%`;
  $("#preview-tip").textContent = `当前显示第 ${state.previewIndex + 1} 格，共 ${doneShots.length} 格已成图。`;
}

$("#phone-frame").addEventListener("click", () => {
  const total = state.shots.filter((s) => s.src).length;
  if (!total) return;
  state.previewIndex = (state.previewIndex + 1) % total;
  renderPreview();
});
$("#phone-frame").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    $("#phone-frame").click();
  }
});
document.addEventListener("keydown", (e) => {
  if (dialog.open) return;
  const total = state.shots.filter((s) => s.src).length;
  if (!total) return;
  if (e.key === "ArrowRight") {
    state.previewIndex = (state.previewIndex + 1) % total;
    renderPreview();
  } else if (e.key === "ArrowLeft") {
    state.previewIndex = (state.previewIndex - 1 + total) % total;
    renderPreview();
  }
});

/* ---------------- 导出 ---------------- */
$("#btn-copy-captions").addEventListener("click", async () => {
  if (!state.shots.length) return toast("还没有分镜", "error");
  const text = state.shots
    .map((s, i) => `【${i + 1}】${s.caption}`)
    .join("\n\n");
  await navigator.clipboard.writeText(text);
  toast("全部独白已复制到剪贴板");
});

$("#btn-export-md").addEventListener("click", () => {
  if (!state.shots.length) return toast("还没有分镜", "error");
  const title = $("#f-title").value.trim() || "未命名故事";
  const lines = [
    `# ${title} · 第 1 集`,
    `> 由 分镜阁 StoryDeck 生成 · ${new Date().toLocaleString("zh-CN")}`,
    "",
    ...state.shots.map((s, i) =>
      `## ${String(i + 1).padStart(2, "0")}\n\n**独白**：${s.caption}\n\n**画面**：${s.prompt}\n${s.src ? `\n![${i + 1}](${s.src.startsWith("blob:") ? "（本地图片，请逐张下载）" : s.src})\n` : ""}`
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title}-第1集-分镜脚本.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Markdown 已导出");
});

$("#btn-download-current").addEventListener("click", () => {
  const img = $("#pf-img");
  if (img.hidden || !img.src) return toast("当前没有可下载的图", "error");
  downloadImage(img.src, `分镜-${state.previewIndex + 1}.png`);
});

$("#btn-download-all").addEventListener("click", async () => {
  const done = state.shots.filter((s) => s.src);
  if (!done.length) return toast("还没有成图", "error");
  toast(`开始逐张下载 ${done.length} 张（浏览器可能询问是否允许多文件下载）`);
  for (let i = 0; i < done.length; i++) {
    await downloadImage(done[i].src, `分镜-${String(i + 1).padStart(2, "0")}.png`);
    await sleep(400); // 避免触发浏览器拦截
  }
  toast("全部下载完成 ✓");
});

async function downloadImage(src, filename) {
  try {
    const resp = await fetch(src);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(src, "_blank"); // 跨域兜底：新窗口打开手动保存
  }
}

/* ---------------- 入场动效编排 ---------------- */
function setupReveals() {
  const els = $$(".reveal");
  els.forEach((el, i) => {
    el.style.transitionDelay = `${i * 90}ms`;
  });
  requestAnimationFrame(() => els.forEach((el) => el.classList.add("in")));
}

/* ---------------- 启动 ---------------- */
loadSettings();
setupReveals();
renderPreview();
updateImageProgress();
