# AI-Code-Animation · 粒子数反转 (Population Inversion) 科普动画双版本工程

本项目使用确定性代码动画架构（`timeline.js` + `render(ctx, t, W, H)` + 原生 `CoreGraphics / JavaScriptCore` 渲染器 + Python 程序化音轨合成），围绕激光物理核心机制 **“粒子数反转（Population Inversion）”** 制作了两套不同美学风格的 1 分钟（56.0 秒）1080p 科普视频及完整可编辑源码。

## 目录结构

* **`v1-grand-budapest-style/` — 第一套：《布达佩斯大饭店》复古对称美学版**
  * [`粒子数反转_布达佩斯风格.mp4`](./v1-grand-budapest-style/粒子数反转_布达佩斯风格.mp4)：1920×1080 30fps 成片
  * [`index.html`](./v1-grand-budapest-style/index.html)：复古鎏金主题交互式网页预览播放器（暴露 `window.render(t)`）
  * [`timeline.js`](./v1-grand-budapest-style/timeline.js)：门德尔甜点粉/紫罗兰/黄铜金配色与 9 镜头元素丝滑形变（Match-Cut）时间轴
  * [`render.js`](./v1-grand-budapest-style/render.js)：三层复古饭店横截面、玻尔兹曼曲线变形水银温度计、水银球弹跳化作太阳光子、气动能量泵与螺旋滑梯动画引擎
  * [`build_audio.py`](./v1-grand-budapest-style/build_audio.py) & [`audio_mix.mp3`](./v1-grand-budapest-style/audio_mix.mp3)：巴拉莱卡琴/拨弦古钢琴轻快配乐 + 粒子音效与旁白自动闪避混音

* **`v2-quantum-arena-style/` — 第二套：《脑内擂台》暗黑曜石与霓虹辉光版（精修版）**
  * [`粒子数反转_脑内擂台风格.mp4`](./v2-quantum-arena-style/粒子数反转_脑内擂台风格.mp4)：1920×1080 30fps 精修成片
  * [`index.html`](./v2-quantum-arena-style/index.html)：暗黑曜石主题交互式网页预览播放器（暴露 `window.render(t)`）
  * [`timeline.js`](./v2-quantum-arena-style/timeline.js)：暗黑曜石/琥珀金/青绿护盾/赤红尖刺配色、连续摄影机运镜与分段高亮字幕时间轴
  * [`render.js`](./v2-quantum-arena-style/render.js)：弧形能级擂台、双环光晕小人、高对比度实验 HUD 面板、手部聚能核心与流线锥形激光束无缝衔接、真实牛顿力学斜面滑落与抛物线碰撞反弹引擎
  * [`build_audio_arena.py`](./v2-quantum-arena-style/build_audio_arena.py) & [`audio_mix.mp3`](./v2-quantum-arena-style/audio_mix.mp3)：深沉心跳 Sub-Bass 脉冲 + 模拟合成器铺底 + HUD 遥测滴答与 RGB 冲击波音效混音

* **`renderer/` — 原生高速确定性视频渲染器**
  * [`render_video.m`](./renderer/render_video.m)：基于 macOS `CoreGraphics` + `CoreText` + `JavaScriptCore` 的零依赖确定性渲染器，直接读取 `timeline.js` 与 `render.js` 并通过管道输出 1080p 帧流至 `ffmpeg` 合成 MP4。

* **原始素材与权威参考**
  * [`粒子数反转旁白.mp3`](./粒子数反转旁白.mp3)：原始人声旁白录音（53.97 秒）
  * [`什么叫粒子数的反转2.docx`](./什么叫粒子数的反转2.docx) & [`v2-84488589f0624282870fbe0b325ff191_1440w.jpg`](./v2-84488589f0624282870fbe0b325ff191_1440w.jpg)：玻尔兹曼分布公式与三能级激励抽运物理参考说明
