// timeline.js — Unified deterministic timeline for "粒子数反转 (Population Inversion)"
// Version 1: Wes Anderson's "The Grand Budapest Hotel" + Silky Match-Cut Morphing

const TIMELINE = {
  title: "粒子数反转 · THE GRAND BUDAPEST LASER",
  duration: 56.0,
  fps: 30,
  width: 1920,
  height: 1080,

  palette: {
    mendlsPink: "#F4D6CC",      // Main warm pastel pink wall
    mendlsLight: "#FDF6EC",     // Cream paper highlight
    blushPink: "#E8B4B8",       // Secondary architectural pink
    carpetRed: "#D9383A",       // Vibrant laser / Grand Budapest carpet crimson
    roseRed: "#C84B61",         // Excited state E2 particle rose
    lobbyPlum: "#4A2545",       // Deep violet structural line & E1 floor
    nightViolet: "#231326",     // Deep velvet plum dark background
    brassGold: "#E8A838",       // Vintage brass trim / thermometer / pump
    sunGold: "#FFD166",         // Bright photon / sun gold
    alpineMint: "#6B9AC4",      // Alpine blue / E3 attic level accent
    pistachio: "#88B09A",       // Mendl's box ribbon mint green
    inkDark: "#2A1528"          // Serif typography ink
  },

  shots: [
    {
      id: "S1",
      name: "散乱微光 · Ordinary Light",
      chapter: "PROLOGUE · THE DIM CHANDELIER",
      start: 0.0,
      end: 2.42,
      morphStart: 1.85,
      morphDesc: "吊灯灯泡向中心坍缩，周围散乱光子被吸入凝结为一条绷紧的水平红线"
    },
    {
      id: "S2",
      name: "激光破晓 · Secret of the Laser",
      chapter: "CHAPTER I · POPULATION INVERSION",
      start: 2.42,
      end: 7.55,
      morphStart: 6.75,
      morphDesc: "复古对称铭牌的上下黄铜边框向外推开拉伸，化作大饭店一楼与二楼的楼板"
    },
    {
      id: "S3",
      name: "慵懒一楼 · Boltzmann Distribution",
      chapter: "CHAPTER II · THE LAZY LOBBY (E₁)",
      start: 7.55,
      end: 15.85,
      morphStart: 15.05,
      morphDesc: "右侧陡峭的玻尔兹曼分布曲线旋转扶正，合拢变形为复古水银温度计玻璃管"
    },
    {
      id: "S4",
      name: "三千度炙烤 · 3000K Thermal Limit",
      chapter: "CHAPTER III · 3000 KELVIN FEVER",
      start: 15.85,
      end: 20.05,
      morphStart: 19.30,
      morphDesc: "温度计底部的圆形红水银球脱离玻璃管，向上弹跳膨胀为金黄色太阳光子"
    },
    {
      id: "S5",
      name: "光子被吞噬 · Stimulated Absorption",
      chapter: "CHAPTER IV · THE PHOTON DEVOURER",
      start: 20.05,
      end: 24.45,
      morphStart: 23.65,
      morphDesc: "吞下光子的底层粒子向上升起，分裂延展为复古黄铜天平的对称支点与横梁"
    },
    {
      id: "S6",
      name: "反转目标 · Inverting the Balance",
      chapter: "CHAPTER V · INVERTING THE HOTEL",
      start: 24.45,
      end: 30.25,
      morphStart: 29.40,
      morphDesc: "翻转后的二楼平台向右倾斜折叠，变形为一段陡峭光滑的二楼大理石滑坡"
    },
    {
      id: "S7",
      name: "站不住的二楼 · Unstable Two-Level",
      chapter: "CHAPTER VI · THE SLIPPERY SECOND FLOOR",
      start: 30.25,
      end: 35.80,
      morphStart: 34.90,
      morphDesc: "最后一颗从二楼滑落的小球重重砸向左侧地面，压出黄铜弹簧活塞能量泵"
    },
    {
      id: "S8",
      name: "三楼抽运与滑梯 · Three-Level Pumping",
      chapter: "CHAPTER VII · THE GRAND PNEUMATIC PUMP (E₁→E₃→E₂)",
      start: 35.80,
      end: 47.55,
      morphStart: 46.70,
      morphDesc: "二楼满载的发光粒子整齐列队，左右廊柱向内合拢变形为光学谐振腔反射镜"
    },
    {
      id: "S9",
      name: "集体跃迁与激光 · Stimulated Emission Avalanche",
      chapter: "FINALE · THE COHERENT AVALANCHE",
      start: 47.55,
      end: 56.00,
      morphStart: 53.55,
      morphDesc: "激光束贯穿全屏后收束为韦斯·安德森式对称纪念徽章定格"
    }
  ],

  holds: [
    { time: 6.20, duration: 0.85, label: "粒子数反转铭牌定格" },
    { time: 14.50, duration: 0.70, label: "玻尔兹曼公式定格" },
    { time: 28.60, duration: 0.75, label: "180°楼层反转定格" },
    { time: 46.25, duration: 0.85, label: "N₂ ≫ N₁ 反超一楼定格" },
    { time: 53.80, duration: 2.20, label: "片尾徽章定格" }
  ],

  subtitles: [
    { start: 0.30, end: 2.42, zh: "为什么普通灯光散乱微弱，", en: "Why is ordinary light scattered and faint," },
    { start: 2.50, end: 4.25, zh: "激光却威力无穷？", en: "while a LASER possesses boundless power?" },
    { start: 4.40, end: 5.58, zh: "秘密就在于：", en: "The secret lies within:" },
    { start: 5.62, end: 7.50, zh: "粒子数反转。", en: "POPULATION INVERSION." },
    { start: 8.10, end: 10.65, zh: "自然状态下，微观粒子非常“懒”。", en: "In nature, microscopic particles are remarkably 'lazy'." },
    { start: 10.80, end: 12.30, zh: "按照玻尔兹曼分布，", en: "Obeying the Boltzmann Distribution," },
    { start: 12.35, end: 14.15, zh: "它们全挤在底层一楼，", en: "they crowd onto the Ground Floor (E₁)," },
    { start: 14.20, end: 15.85, zh: "高层几乎空无一人。", en: "leaving the upper floors nearly deserted." },
    { start: 16.10, end: 17.70, zh: "哪怕加热到三千度，", en: "Even when heated to 3,000 Kelvin," },
    { start: 17.75, end: 19.95, zh: "高层粒子依然少得可怜。", en: "particles on the upper level remain pitifully scarce." },
    { start: 20.15, end: 21.25, zh: "光子一进来，", en: "The moment a photon enters," },
    { start: 21.28, end: 23.00, zh: "全被底层粒子“吃掉”，", en: "it is immediately 'swallowed' by ground-state particles—" },
    { start: 23.05, end: 24.45, zh: "光根本亮不起来。", en: "so the light can never grow bright." },
    { start: 24.65, end: 25.78, zh: "想把光放大，", en: "To amplify light," },
    { start: 25.80, end: 28.20, zh: "就得让二楼的粒子远多于一楼，", en: "the 2nd Floor (E₂) must hold far more particles than the 1st (E₁)," },
    { start: 28.25, end: 30.25, zh: "实现“粒子数反转”。", en: "achieving 'Population Inversion' (N₂ ≫ N₁)." },
    { start: 30.55, end: 32.35, zh: "但直接把粒子推上二楼，", en: "Yet if we push particles directly to the 2nd Floor," },
    { start: 32.38, end: 33.80, zh: "它们根本待不住，", en: "they cannot stay in that unstable state," },
    { start: 33.85, end: 35.75, zh: "瞬间就会掉回一楼。", en: "and tumble straight back down to the 1st Floor." },
    { start: 36.00, end: 38.20, zh: "于是，激光器用能量泵，", en: "So a laser uses an Energy Pump" },
    { start: 38.30, end: 40.95, zh: "先把一楼粒子一口气抽到三楼，", en: "to blast 1st-Floor particles all the way up to the 3rd Floor (E₃)," },
    { start: 41.00, end: 43.25, zh: "再让它们悄悄滑落到二楼。", en: "then lets them quietly slide down to the 2nd Floor (E₂)." },
    { start: 43.50, end: 45.30, zh: "二楼粒子越攒越多，", en: "Particles accumulate on the 2nd Floor more and more," },
    { start: 45.35, end: 47.50, zh: "终于反超一楼！", en: "until at last they outnumber the 1st Floor!" },
    { start: 47.90, end: 50.40, zh: "当高处粒子集体跃迁而下，", en: "When the upper particles leap downward in unison," },
    { start: 50.45, end: 51.90, zh: "光就被瞬间放大，", en: "light is amplified in an instant," },
    { start: 51.95, end: 55.60, zh: "化作无坚不摧的激光！", en: "forging an unstoppable beam of LASER light!" }
  ]
};

if (typeof window !== "undefined") window.TIMELINE = TIMELINE;
if (typeof globalThis !== "undefined") globalThis.TIMELINE = TIMELINE;
if (typeof module !== "undefined" && module.exports) module.exports = TIMELINE;
