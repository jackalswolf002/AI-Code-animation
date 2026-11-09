// timeline.js — Unified deterministic timeline for "粒子数反转 (Population Inversion)"
// Visual, Camera & Transition Reference: 《脑内擂台》你不用打赢它们，你可以改规则。

const TIMELINE = {
  title: "粒子数反转 · 改写光的规则",
  duration: 56.0,
  fps: 30,
  width: 1920,
  height: 1080,

  palette: {
    obsidianBg: "#080604",      // Deep warm obsidian arena void
    warmShadow: "#15100B",      // Dark warm brown-black vignette
    latticeLine: "#4A3824",     // Dim neural/atomic branching background lattice
    arenaRim: "#8C7355",        // Curved arena ring metallic-warm rim
    amberGold: "#FFD154",       // Signature glowing golden-amber character/photon color
    amberHot: "#FFFDF4",        // White-hot glowing core
    amberDeep: "#F59E0B",       // Deep amber aura
    cyanShield: "#58F2D8",      // Signature bioluminescent mint-cyan (E2 metastable shield & rule-change pump)
    cyanHot: "#E6FFFA",         // Mint-cyan bright core
    coralRed: "#FF5838",        // Signature spiky fiery coral-red (3000K agitation & unstable state)
    coralDeep: "#D92616",       // Deep crimson glow
    hudGlass: "rgba(16, 13, 10, 0.84)",
    hudBorder: "rgba(255, 209, 84, 0.26)",
    textWhite: "#FFFDF7",
    textMuted: "#A89882"
  },

  shots: [
    {
      id: "S1",
      name: "散乱微光 · 暗夜微丝",
      chapter: "ROUND 0 · SPONTANEOUS EMISSION",
      start: 0.0,
      end: 2.42,
      morphStart: 1.85,
      morphDesc: "暗夜晶格中孤立闪烁的微弱光点向中心坍缩蓄力，引爆RGB色散冲击波"
    },
    {
      id: "S2",
      name: "激光破晓 · 粒子数反转",
      chapter: "ROUND I · POPULATION INVERSION",
      start: 2.42,
      end: 7.55,
      morphStart: 6.75,
      morphDesc: "RGB色散光环与金色高能光束向下俯冲，直接化作一楼能级擂台的弧形地面"
    },
    {
      id: "S3",
      name: "慵懒一楼 · 玻尔兹曼分布",
      chapter: "ROUND II · BOLTZMANN DISTRIBUTION",
      start: 7.55,
      end: 15.85,
      morphStart: 15.05,
      morphDesc: "顶部HUD卡片中的玻尔兹曼指数曲线向下刺入擂台地面，引燃三千度赤红烈焰"
    },
    {
      id: "S4",
      name: "三千度炙烤 · 热辐射极限",
      chapter: "ROUND III · 3000K THERMAL LIMIT",
      start: 15.85,
      end: 20.05,
      morphStart: 19.30,
      morphDesc: "三千度赤红火球从地面弹跳升空，在抛物线顶点蜕变为光芒四射的金色太阳光子"
    },
    {
      id: "S5",
      name: "光子被吞噬 · 受激吸收",
      chapter: "ROUND IV · STIMULATED ABSORPTION",
      start: 20.05,
      end: 24.45,
      morphStart: 23.65,
      morphDesc: "吞噬光子后的黑洞涟漪向外扩张，化作双层同心旋转的能级天平圆环"
    },
    {
      id: "S6",
      name: "反转目标 · 颠倒能级擂台",
      chapter: "ROUND V · INVERTING THE ARENA",
      start: 24.45,
      end: 30.25,
      morphStart: 29.40,
      morphDesc: "180°翻转后的二楼弧形轨道向右倾斜拉伸，变形为陡峭不稳定的二楼能量斜坡"
    },
    {
      id: "S7",
      name: "站不住的二楼 · 二能级困境",
      chapter: "ROUND VI · UNSTABLE EXCITED STATE",
      start: 30.25,
      end: 35.80,
      morphStart: 34.90,
      morphDesc: "从二楼滑落的粒子重重砸向左侧擂台，激活青绿色的三能级规则改写能量泵"
    },
    {
      id: "S8",
      name: "改写规则 · 三楼抽运与二楼护盾",
      chapter: "ROUND VII · CHANGING THE RULES (E₁→E₃→E₂)",
      start: 35.80,
      end: 47.55,
      morphStart: 46.70,
      morphDesc: "二楼青色亚稳态护盾内蓄满金色粒子，镜头拉远化作光学谐振腔双镜阵列"
    },
    {
      id: "S9",
      name: "集体跃迁 · 无坚不摧的激光",
      chapter: "FINALE · STIMULATED EMISSION AVALANCHE",
      start: 47.55,
      end: 56.00,
      morphStart: 53.55,
      morphDesc: "贯穿全屏的色散激光束散作漫天璀璨星尘粒子，凝聚成《脑内擂台》同款发光图腾"
    }
  ],

  // Subtitles with inline highlighted keywords matching 《脑内擂台》 typography
  // segments: [{ text: "...", color: "white" | "gold" | "coral" | "cyan" }]
  subtitles: [
    {
      start: 0.30, end: 2.42,
      segments: [{ text: "为什么普通灯光", color: "white" }, { text: "散乱微弱，", color: "gold" }]
    },
    {
      start: 2.50, end: 4.25,
      segments: [{ text: "激光却", color: "white" }, { text: "威力无穷？", color: "coral" }]
    },
    {
      start: 4.40, end: 5.58,
      segments: [{ text: "秘密就在于——", color: "white" }]
    },
    {
      start: 5.62, end: 7.50,
      segments: [{ text: "粒子数反转。", color: "gold" }]
    },
    {
      start: 8.10, end: 10.65,
      segments: [{ text: "自然状态下，微观粒子", color: "white" }, { text: "非常“懒”。", color: "gold" }]
    },
    {
      start: 10.80, end: 12.30,
      segments: [{ text: "按照", color: "white" }, { text: "玻尔兹曼分布，", color: "cyan" }]
    },
    {
      start: 12.35, end: 14.15,
      segments: [{ text: "它们全挤在", color: "white" }, { text: "底层一楼，", color: "gold" }]
    },
    {
      start: 14.20, end: 15.85,
      segments: [{ text: "高层几乎", color: "white" }, { text: "空无一人。", color: "coral" }]
    },
    {
      start: 16.10, end: 17.70,
      segments: [{ text: "哪怕加热到", color: "white" }, { text: "三千度，", color: "coral" }]
    },
    {
      start: 17.75, end: 19.95,
      segments: [{ text: "高层粒子依然", color: "white" }, { text: "少得可怜。", color: "gold" }]
    },
    {
      start: 20.15, end: 21.25,
      segments: [{ text: "光子", color: "gold" }, { text: "一进来，", color: "white" }]
    },
    {
      start: 21.28, end: 23.00,
      segments: [{ text: "全被底层粒子", color: "white" }, { text: "“吃掉”，", color: "coral" }]
    },
    {
      start: 23.05, end: 24.45,
      segments: [{ text: "光根本", color: "white" }, { text: "亮不起来。", color: "gold" }]
    },
    {
      start: 24.65, end: 25.78,
      segments: [{ text: "想把光", color: "white" }, { text: "放大，", color: "gold" }]
    },
    {
      start: 25.80, end: 28.20,
      segments: [{ text: "就得让", color: "white" }, { text: "二楼的粒子", color: "cyan" }, { text: "远多于一楼，", color: "white" }]
    },
    {
      start: 28.25, end: 30.25,
      segments: [{ text: "实现", color: "white" }, { text: "“粒子数反转”。", color: "gold" }]
    },
    {
      start: 30.55, end: 32.35,
      segments: [{ text: "但直接把粒子", color: "white" }, { text: "推上二楼，", color: "gold" }]
    },
    {
      start: 32.38, end: 33.80,
      segments: [{ text: "它们根本", color: "white" }, { text: "待不住，", color: "coral" }]
    },
    {
      start: 33.85, end: 35.75,
      segments: [{ text: "瞬间就会", color: "white" }, { text: "掉回一楼。", color: "coral" }]
    },
    {
      start: 36.00, end: 38.20,
      segments: [{ text: "于是，激光器用", color: "white" }, { text: "能量泵，", color: "cyan" }]
    },
    {
      start: 38.30, end: 40.95,
      segments: [{ text: "先把一楼粒子一口气", color: "white" }, { text: "抽到三楼，", color: "gold" }]
    },
    {
      start: 41.00, end: 43.25,
      segments: [{ text: "再让它们悄悄", color: "white" }, { text: "滑落到二楼。", color: "cyan" }]
    },
    {
      start: 43.50, end: 45.30,
      segments: [{ text: "二楼粒子", color: "cyan" }, { text: "越攒越多，", color: "white" }]
    },
    {
      start: 45.35, end: 47.50,
      segments: [{ text: "终于——", color: "white" }, { text: "反超一楼！", color: "gold" }]
    },
    {
      start: 47.90, end: 50.40,
      segments: [{ text: "当高处粒子", color: "white" }, { text: "集体跃迁而下，", color: "cyan" }]
    },
    {
      start: 50.45, end: 51.90,
      segments: [{ text: "光就被", color: "white" }, { text: "瞬间放大，", color: "gold" }]
    },
    {
      start: 51.95, end: 55.60,
      segments: [{ text: "化作无坚不摧的", color: "white" }, { text: "激光！", color: "coral" }]
    }
  ]
};

if (typeof window !== "undefined") {
  window.TIMELINE = TIMELINE;
}
if (typeof globalThis !== "undefined") {
  globalThis.TIMELINE = TIMELINE;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = TIMELINE;
}
