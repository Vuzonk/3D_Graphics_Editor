# 六面体展开图训练器实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个完整的六面体展开图训练器，支持11种展开图结构、移面法交互、手绘系统和3D折叠验证。

**Architecture:** 单文件HTML应用，基于现有hexahedron.html扩展。使用Three.js渲染3D视图，原生Canvas实现手绘系统，GSAP控制动画，Tailwind CSS构建UI。

**Tech Stack:** HTML5, Three.js, GSAP, Tailwind CSS, 原生Canvas API

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `hexahedron.html` | 完全重写 | 主要实现文件，包含所有HTML/CSS/JS |
| `index.html` | 小修改 | 更新按钮链接 |
| `app.js` | 小修改 | 更新window.open目标 |

---

## Task 1: 基础HTML结构和UI布局

**Files:**
- Modify: `hexahedron.html` (完全重写)

**目标:** 创建基础HTML结构，包含三栏布局（左侧工具栏、中间编辑区、右侧预览区）。

- [ ] **Step 1: 创建HTML基础结构和头部**

在 `hexahedron.html` 中写入以下内容：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>六面体展开图训练器 - 公务员考试专用</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans SC', sans-serif;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            overflow: hidden;
        }

        .glass-panel {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .face-btn {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .face-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }

        .face-btn.active {
            border-color: #3b82f6 !important;
            transform: scale(1.05);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
        }

        .pattern-btn {
            transition: all 0.2s;
        }

        .pattern-btn:hover {
            transform: scale(1.1);
        }

        .pattern-btn.active {
            ring: 2px solid #3b82f6;
            background: rgba(59, 130, 246, 0.3) !important;
        }

        .tool-btn {
            transition: all 0.2s;
        }

        .tool-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .tool-btn.active {
            background: rgba(59, 130, 246, 0.5);
            border-color: #3b82f6;
        }

        #net-container {
            position: relative;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            overflow: hidden;
        }

        #net-container canvas {
            display: block;
        }

        .net-face {
            position: absolute;
            border: 2px solid #333;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .net-face:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .net-face.selected {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }

        .net-face.dragging {
            opacity: 0.7;
            z-index: 100;
        }

        .net-face .face-label {
            position: absolute;
            top: 4px;
            left: 4px;
            font-size: 12px;
            font-weight: bold;
            color: #666;
            pointer-events: none;
        }

        .move-hint {
            position: absolute;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: rgba(59, 130, 246, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 50;
        }

        .net-face:hover .move-hint {
            opacity: 1;
        }

        .move-hint:hover {
            background: rgba(59, 130, 246, 1);
            transform: scale(1.1);
        }

        .tooltip {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            pointer-events: none;
        }

        /* 滚动条样式 */
        ::-webkit-scrollbar {
            width: 6px;
        }

        ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }
    </style>
</head>
<body class="text-white min-h-screen flex flex-col">
```

- [ ] **Step 2: 创建Header区域**

在 `</style>` 后添加Header部分：

```html
    <!-- Header -->
    <header class="glass-panel sticky top-0 z-50 border-b border-white/10">
        <div class="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <button onclick="goBack()" class="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                    返回
                </button>
                <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-xl font-bold">六</div>
                <div>
                    <h1 class="text-xl font-bold text-white">六面体展开图训练器</h1>
                    <p class="text-xs text-gray-400">公务员考试专用 · 移面法训练工具</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="toggleAutoRotate()" id="autoRotateBtn" class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    自动旋转
                </button>
                <button onclick="resetView()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">
                    重置视角
                </button>
            </div>
        </div>
    </header>
```

- [ ] **Step 3: 创建主体三栏布局**

继续添加主体布局部分：

```html
    <div class="flex-1 flex flex-col lg:flex-row w-full p-4 gap-4" style="height: calc(100vh - 64px);">

        <!-- 左侧面板：展开图编辑 -->
        <div class="w-full lg:w-80 flex flex-col gap-4 order-2 lg:order-1">

            <!-- 展开图类型选择 -->
            <div class="glass-panel rounded-xl p-4">
                <h3 class="text-sm font-bold mb-3 text-blue-400 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path></svg>
                    展开图类型
                </h3>
                <select id="netType" onchange="changeNetType(this.value)" class="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
                    <optgroup label="1-4-1型 (6种)">
                        <option value="1-4-1-1">1-4-1型 变体1 (十字形)</option>
                        <option value="1-4-1-2">1-4-1型 变体2</option>
                        <option value="1-4-1-3">1-4-1型 变体3</option>
                        <option value="1-4-1-4">1-4-1型 变体4</option>
                        <option value="1-4-1-5">1-4-1型 变体5</option>
                        <option value="1-4-1-6">1-4-1型 变体6</option>
                    </optgroup>
                    <optgroup label="2-3-1型 (3种)">
                        <option value="2-3-1-1">2-3-1型 变体1</option>
                        <option value="2-3-1-2">2-3-1型 变体2</option>
                        <option value="2-3-1-3">2-3-1型 变体3</option>
                    </optgroup>
                    <optgroup label="其他类型">
                        <option value="3-3">3-3型</option>
                        <option value="2-2-2">2-2-2型</option>
                    </optgroup>
                </select>
            </div>

            <!-- 移面操作 -->
            <div class="glass-panel rounded-xl p-4">
                <h3 class="text-sm font-bold mb-3 text-blue-400 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                    移面操作
                </h3>
                <p class="text-xs text-gray-400 mb-3">拖拽面片边缘的箭头可进行移面操作</p>
                <div class="flex gap-2">
                    <button onclick="undoMove()" class="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition flex items-center justify-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                        撤销
                    </button>
                    <button onclick="redoMove()" class="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition flex items-center justify-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"></path></svg>
                        重做
                    </button>
                </div>
                <div class="mt-2 flex gap-2">
                    <button onclick="resetNet()" class="flex-1 px-3 py-2 bg-red-600/50 hover:bg-red-600/70 rounded-lg text-sm transition">
                        重置展开图
                    </button>
                </div>
            </div>

            <!-- 绘图工具 -->
            <div class="glass-panel rounded-xl p-4">
                <h3 class="text-sm font-bold mb-3 text-blue-400 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    绘图工具
                </h3>
                <div class="flex gap-2 mb-3">
                    <button onclick="setTool('brush')" id="tool-brush" class="tool-btn active flex-1 px-3 py-2 border border-white/20 rounded-lg text-sm transition flex items-center justify-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        画笔
                    </button>
                    <button onclick="setTool('eraser')" id="tool-eraser" class="tool-btn flex-1 px-3 py-2 border border-white/20 rounded-lg text-sm transition flex items-center justify-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        橡皮
                    </button>
                </div>
                <div class="mb-3">
                    <label class="text-xs text-gray-400 block mb-2">画笔颜色</label>
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="setBrushColor('#000000')" class="w-8 h-8 rounded-full bg-black border-2 border-white/20 hover:scale-110 transition brush-color active" data-color="#000000"></button>
                        <button onclick="setBrushColor('#ef4444')" class="w-8 h-8 rounded-full bg-red-500 border-2 border-white/20 hover:scale-110 transition brush-color" data-color="#ef4444"></button>
                        <button onclick="setBrushColor('#3b82f6')" class="w-8 h-8 rounded-full bg-blue-500 border-2 border-white/20 hover:scale-110 transition brush-color" data-color="#3b82f6"></button>
                        <button onclick="setBrushColor('#22c55e')" class="w-8 h-8 rounded-full bg-green-500 border-2 border-white/20 hover:scale-110 transition brush-color" data-color="#22c55e"></button>
                    </div>
                </div>
                <div>
                    <label class="text-xs text-gray-400 block mb-2">画笔大小: <span id="brushSizeValue">5</span>px</label>
                    <input type="range" id="brushSize" min="1" max="30" value="5" onchange="setBrushSize(this.value)" class="w-full">
                </div>
            </div>

            <!-- 图案库 -->
            <div class="glass-panel rounded-xl p-4 flex-1 overflow-y-auto">
                <h3 class="text-sm font-bold mb-3 text-blue-400 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    图案库
                </h3>

                <!-- 几何图形 -->
                <div class="mb-4">
                    <label class="text-xs text-gray-400 block mb-2">几何图形</label>
                    <div class="grid grid-cols-4 gap-2">
                        <button onclick="setPattern('circle')" class="pattern-btn aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-xl hover:bg-gray-600" title="实心圆">●</button>
                        <button onclick="setPattern('circle-hollow')" class="pattern-btn aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-xl hover:bg-gray-600" title="空心圆">○</button>
                        <button onclick="setPattern('triangle')" class="pattern-btn aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-xl hover:bg-gray-600" title="三角形">▲</button>
                        <button onclick="setPattern('square')" class="pattern-btn aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-xl hover:bg-gray-600" title="方形">■</button>
                        <button onclick="setPattern('diamond')" class="pattern-btn aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-xl hover:bg-gray-600" title="菱形">◆</button>
                        <button onclick="setPattern('cross')" class="pattern-btn aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-xl hover:bg-gray-600" title="十字">✚</button>
                        <button onclick="setPattern('star')" class="pattern-btn aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-xl hover:bg-gray-600" title="星形">★</button>
                        <button onclick="setPattern('none')" class="pattern-btn aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-sm hover:bg-gray-600" title="清除">清除</button>
                    </div>
                </div>

                <!-- 方向箭头 -->
                <div class="mb-4">
                    <label class="text-xs text-gray-400 block mb-2">方向箭头（高频考点）</label>
                    <div class="grid grid-cols-4 gap-2">
                        <button onclick="setPattern('arrow-up')" class="pattern-btn aspect-square bg-blue-900/50 border border-blue-500/30 rounded-lg flex items-center justify-center text-xl hover:bg-blue-900">↑</button>
                        <button onclick="setPattern('arrow-down')" class="pattern-btn aspect-square bg-blue-900/50 border border-blue-500/30 rounded-lg flex items-center justify-center text-xl hover:bg-blue-900">↓</button>
                        <button onclick="setPattern('arrow-left')" class="pattern-btn aspect-square bg-blue-900/50 border border-blue-500/30 rounded-lg flex items-center justify-center text-xl hover:bg-blue-900">←</button>
                        <button onclick="setPattern('arrow-right')" class="pattern-btn aspect-square bg-blue-900/50 border border-blue-500/30 rounded-lg flex items-center justify-center text-xl hover:bg-blue-900">→</button>
                    </div>
                </div>

                <!-- 骰子点数 -->
                <div class="mb-4">
                    <label class="text-xs text-gray-400 block mb-2">骰子点数</label>
                    <div class="grid grid-cols-6 gap-2">
                        <button onclick="setPattern('dot-1')" class="pattern-btn aspect-square bg-white text-black rounded-lg flex items-center justify-center font-bold hover:bg-gray-200 text-sm">1</button>
                        <button onclick="setPattern('dot-2')" class="pattern-btn aspect-square bg-white text-black rounded-lg flex items-center justify-center font-bold hover:bg-gray-200 text-sm">2</button>
                        <button onclick="setPattern('dot-3')" class="pattern-btn aspect-square bg-white text-black rounded-lg flex items-center justify-center font-bold hover:bg-gray-200 text-sm">3</button>
                        <button onclick="setPattern('dot-4')" class="pattern-btn aspect-square bg-white text-black rounded-lg flex items-center justify-center font-bold hover:bg-gray-200 text-sm">4</button>
                        <button onclick="setPattern('dot-5')" class="pattern-btn aspect-square bg-white text-black rounded-lg flex items-center justify-center font-bold hover:bg-gray-200 text-sm">5</button>
                        <button onclick="setPattern('dot-6')" class="pattern-btn aspect-square bg-white text-black rounded-lg flex items-center justify-center font-bold hover:bg-gray-200 text-sm">6</button>
                    </div>
                </div>

                <!-- 图案旋转 -->
                <div class="mb-4">
                    <label class="text-xs text-gray-400 block mb-2">图案旋转</label>
                    <div class="flex gap-2">
                        <button onclick="rotatePattern(-90)" class="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">-90°</button>
                        <button onclick="rotatePattern(0)" class="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">0°</button>
                        <button onclick="rotatePattern(90)" class="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">+90°</button>
                        <button onclick="rotatePattern(180)" class="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">180°</button>
                    </div>
                </div>

                <!-- 面背景色 -->
                <div>
                    <label class="text-xs text-gray-400 block mb-2">面背景颜色</label>
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="setFaceColor('#ffffff')" class="w-8 h-8 rounded-full bg-white border-2 border-white/20 hover:scale-110 transition face-color active" data-color="#ffffff"></button>
                        <button onclick="setFaceColor('#ef4444')" class="w-8 h-8 rounded-full bg-red-500 border-2 border-white/20 hover:scale-110 transition face-color" data-color="#ef4444"></button>
                        <button onclick="setFaceColor('#3b82f6')" class="w-8 h-8 rounded-full bg-blue-500 border-2 border-white/20 hover:scale-110 transition face-color" data-color="#3b82f6"></button>
                        <button onclick="setFaceColor('#22c55e')" class="w-8 h-8 rounded-full bg-green-500 border-2 border-white/20 hover:scale-110 transition face-color" data-color="#22c55e"></button>
                        <button onclick="setFaceColor('#eab308')" class="w-8 h-8 rounded-full bg-yellow-500 border-2 border-white/20 hover:scale-110 transition face-color" data-color="#eab308"></button>
                        <button onclick="setFaceColor('#a855f7')" class="w-8 h-8 rounded-full bg-purple-500 border-2 border-white/20 hover:scale-110 transition face-color" data-color="#a855f7"></button>
                        <button onclick="setFaceColor('#f97316')" class="w-8 h-8 rounded-full bg-orange-500 border-2 border-white/20 hover:scale-110 transition face-color" data-color="#f97316"></button>
                        <button onclick="setFaceColor('#1f2937')" class="w-8 h-8 rounded-full bg-gray-800 border-2 border-white/20 hover:scale-110 transition face-color" data-color="#1f2937"></button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 中间区域：2D展开图编辑 -->
        <div class="flex-1 flex flex-col gap-4 order-1 lg:order-2 min-h-[400px] lg:min-h-0">
            <div class="glass-panel rounded-xl p-4 flex-1 flex flex-col">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-bold text-blue-400 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg>
                        2D展开图编辑
                    </h3>
                    <div class="flex gap-2">
                        <button onclick="setViewMode('2d')" id="btn-2d" class="px-3 py-1 bg-blue-600 rounded text-sm">2D编辑</button>
                        <button onclick="setViewMode('3d')" id="btn-3d" class="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm">3D预览</button>
                    </div>
                </div>
                <div id="net-container" class="flex-1 relative">
                    <!-- 展开图面片将在此渲染 -->
                </div>
            </div>

            <!-- 考试技巧提示 -->
            <div class="glass-panel rounded-xl p-4 text-xs text-gray-400">
                <p class="font-bold text-gray-300 mb-2">💡 移面法技巧：</p>
                <div class="grid grid-cols-2 gap-2">
                    <div>• 垂直滚动：拖拽面片上下边缘</div>
                    <div>• 平行移面：拖拽四连排的首尾面</div>
                    <div>• 相对面不相邻</div>
                    <div>• Z字形两端是相对面</div>
                </div>
            </div>
        </div>

        <!-- 右侧面板：3D预览 -->
        <div class="w-full lg:w-80 flex flex-col gap-4 order-3">
            <div class="glass-panel rounded-xl p-4 flex-1 flex flex-col">
                <h3 class="text-sm font-bold mb-3 text-blue-400 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
                    3D立方体预览
                </h3>
                <div id="preview-container" class="flex-1 rounded-lg overflow-hidden bg-black/30 min-h-[300px]">
                    <canvas id="glCanvas" class="w-full h-full block"></canvas>
                </div>
                <div class="mt-3 flex gap-2">
                    <button onclick="toggleFold()" id="foldBtn" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        <span id="foldBtnText">展开立方体</span>
                    </button>
                </div>
            </div>

            <!-- 面选择器 -->
            <div class="glass-panel rounded-xl p-4">
                <h3 class="text-sm font-bold mb-3 text-blue-400">选择编辑的面</h3>
                <div class="grid grid-cols-3 gap-2" id="face-selector">
                    <button onclick="selectFace(0)" id="face-btn-0" class="face-btn aspect-square rounded-lg flex items-center justify-center text-lg font-bold border-2 border-transparent" style="background: #ef4444;">前</button>
                    <button onclick="selectFace(1)" id="face-btn-1" class="face-btn aspect-square rounded-lg flex items-center justify-center text-lg font-bold border-2 border-transparent" style="background: #3b82f6;">后</button>
                    <button onclick="selectFace(2)" id="face-btn-2" class="face-btn aspect-square rounded-lg flex items-center justify-center text-lg font-bold border-2 border-transparent" style="background: #22c55e;">右</button>
                    <button onclick="selectFace(3)" id="face-btn-3" class="face-btn aspect-square rounded-lg flex items-center justify-center text-lg font-bold border-2 border-transparent text-black" style="background: #eab308;">左</button>
                    <button onclick="selectFace(4)" id="face-btn-4" class="face-btn aspect-square rounded-lg flex items-center justify-center text-lg font-bold border-2 border-transparent" style="background: #a855f7;">上</button>
                    <button onclick="selectFace(5)" id="face-btn-5" class="face-btn aspect-square rounded-lg flex items-center justify-center text-lg font-bold border-2 border-transparent" style="background: #f97316;">下</button>
                </div>
                <div class="mt-3 p-3 bg-white/5 rounded-lg">
                    <div class="text-xs text-gray-400">当前编辑: <span id="current-face-name" class="text-blue-400 font-bold">前面</span></div>
                    <div id="current-face-preview" class="mt-2 w-full h-16 rounded flex items-center justify-center text-3xl border border-white/10" style="background: #ef4444;">?</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Tooltip -->
    <div id="tooltip" class="tooltip" style="display: none;"></div>
```

- [ ] **Step 4: 验证HTML结构**

在浏览器中打开 `hexahedron.html`，确认：
- 页面布局正确显示三栏结构
- Header和各面板正确渲染
- Tailwind CSS样式正常加载

预期：页面显示完整的UI骨架，但功能按钮暂无响应。

- [ ] **Step 5: 提交**

```bash
git add hexahedron.html
git commit -m "feat: 创建六面体展开图训练器基础HTML结构和UI布局"
```

---

## Task 2: 11种展开图数据结构和初始化

**Files:**
- Modify: `hexahedron.html` (在 `</body>` 前添加JavaScript)

**目标:** 定义11种展开图的数据结构，实现展开图初始化逻辑。

- [ ] **Step 1: 定义展开图数据结构**

在HTML的 `</body>` 标签前添加以下JavaScript：

```html
    <script>
        // ============================================
        // 全局状态
        // ============================================
        let scene, camera, renderer, controls;
        let cubeGroup, faces3D = [];
        let isAutoRotating = false;
        let isUnfolded = false;
        let viewMode = '2d'; // '2d' or '3d'
        let currentFaceIndex = 0;
        let currentTool = 'brush';
        let brushColor = '#000000';
        let brushSize = 5;
        let patternRotation = 0;

        // 面数据
        const faceNames = ['前', '后', '右', '左', '上', '下'];
        let faceData = [];

        // Canvas纹理
        let faceCanvases = [];
        let faceTextures = [];
        let faceContexts = [];

        // 2D展开图状态
        let netContainer = null;
        let netCanvas = null;
        let netCtx = null;
        let faceElements = []; // 2D面片DOM元素
        let currentNetLayout = null;
        let selectedFaceForEdit = null;

        // 历史记录
        let history = [];
        let historyIndex = -1;

        // ============================================
        // 11种展开图定义
        // ============================================
        const NET_STRUCTURES = {
            // 1-4-1型 (6种变体)
            '1-4-1-1': {
                name: '1-4-1型 十字形',
                type: '1-4-1',
                layout: [
                    { faceId: 4, gridX: 1, gridY: 0 }, // 上
                    { faceId: 3, gridX: 0, gridY: 1 }, // 左
                    { faceId: 0, gridX: 1, gridY: 1 }, // 前
                    { faceId: 2, gridX: 2, gridY: 1 }, // 右
                    { faceId: 1, gridX: 3, gridY: 1 }, // 后
                    { faceId: 5, gridX: 1, gridY: 2 }  // 下
                ],
                connections: [
                    { from: 4, to: 0, direction: 'down' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 1, to: 2, direction: 'left' },
                    { from: 5, to: 0, direction: 'up' }
                ]
            },
            '1-4-1-2': {
                name: '1-4-1型 变体2',
                type: '1-4-1',
                layout: [
                    { faceId: 4, gridX: 2, gridY: 0 },
                    { faceId: 3, gridX: 0, gridY: 1 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 1, gridX: 3, gridY: 1 },
                    { faceId: 5, gridX: 1, gridY: 2 }
                ],
                connections: [
                    { from: 4, to: 2, direction: 'down' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 1, to: 2, direction: 'left' },
                    { from: 5, to: 0, direction: 'up' }
                ]
            },
            '1-4-1-3': {
                name: '1-4-1型 变体3',
                type: '1-4-1',
                layout: [
                    { faceId: 5, gridX: 0, gridY: 0 },
                    { faceId: 3, gridX: 0, gridY: 1 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 1, gridX: 3, gridY: 1 },
                    { faceId: 4, gridX: 1, gridY: 2 }
                ],
                connections: [
                    { from: 5, to: 3, direction: 'down' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 1, to: 2, direction: 'left' },
                    { from: 4, to: 0, direction: 'up' }
                ]
            },
            '1-4-1-4': {
                name: '1-4-1型 变体4',
                type: '1-4-1',
                layout: [
                    { faceId: 4, gridX: 1, gridY: 0 },
                    { faceId: 3, gridX: 0, gridY: 1 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 1, gridX: 3, gridY: 1 },
                    { faceId: 5, gridX: 2, gridY: 2 }
                ],
                connections: [
                    { from: 4, to: 0, direction: 'down' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 1, to: 2, direction: 'left' },
                    { from: 5, to: 2, direction: 'up' }
                ]
            },
            '1-4-1-5': {
                name: '1-4-1型 变体5',
                type: '1-4-1',
                layout: [
                    { faceId: 4, gridX: 1, gridY: 0 },
                    { faceId: 1, gridX: 0, gridY: 1 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 3, gridX: 3, gridY: 1 },
                    { faceId: 5, gridX: 1, gridY: 2 }
                ],
                connections: [
                    { from: 4, to: 0, direction: 'down' },
                    { from: 1, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 3, to: 2, direction: 'left' },
                    { from: 5, to: 0, direction: 'up' }
                ]
            },
            '1-4-1-6': {
                name: '1-4-1型 变体6',
                type: '1-4-1',
                layout: [
                    { faceId: 4, gridX: 0, gridY: 0 },
                    { faceId: 3, gridX: 0, gridY: 1 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 1, gridX: 3, gridY: 1 },
                    { faceId: 5, gridX: 3, gridY: 2 }
                ],
                connections: [
                    { from: 4, to: 3, direction: 'down' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 1, to: 2, direction: 'left' },
                    { from: 5, to: 1, direction: 'up' }
                ]
            },
            // 2-3-1型 (3种变体)
            '2-3-1-1': {
                name: '2-3-1型 变体1',
                type: '2-3-1',
                layout: [
                    { faceId: 4, gridX: 0, gridY: 0 },
                    { faceId: 5, gridX: 1, gridY: 0 },
                    { faceId: 3, gridX: 0, gridY: 1 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 1, gridX: 1, gridY: 2 }
                ],
                connections: [
                    { from: 4, to: 5, direction: 'right' },
                    { from: 4, to: 3, direction: 'down' },
                    { from: 5, to: 0, direction: 'down' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 1, to: 0, direction: 'up' }
                ]
            },
            '2-3-1-2': {
                name: '2-3-1型 变体2',
                type: '2-3-1',
                layout: [
                    { faceId: 4, gridX: 1, gridY: 0 },
                    { faceId: 5, gridX: 2, gridY: 0 },
                    { faceId: 3, gridX: 0, gridY: 1 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 1, gridX: 3, gridY: 1 }
                ],
                connections: [
                    { from: 4, to: 5, direction: 'right' },
                    { from: 4, to: 0, direction: 'down' },
                    { from: 5, to: 2, direction: 'down' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 1, to: 2, direction: 'left' }
                ]
            },
            '2-3-1-3': {
                name: '2-3-1型 变体3',
                type: '2-3-1',
                layout: [
                    { faceId: 4, gridX: 0, gridY: 0 },
                    { faceId: 3, gridX: 0, gridY: 1 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 1, gridX: 3, gridY: 1 },
                    { faceId: 5, gridX: 3, gridY: 0 }
                ],
                connections: [
                    { from: 4, to: 3, direction: 'down' },
                    { from: 5, to: 1, direction: 'down' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 2, to: 0, direction: 'left' },
                    { from: 1, to: 2, direction: 'left' }
                ]
            },
            // 3-3型
            '3-3': {
                name: '3-3型',
                type: '3-3',
                layout: [
                    { faceId: 4, gridX: 0, gridY: 0 },
                    { faceId: 3, gridX: 1, gridY: 0 },
                    { faceId: 0, gridX: 2, gridY: 0 },
                    { faceId: 5, gridX: 0, gridY: 1 },
                    { faceId: 2, gridX: 1, gridY: 1 },
                    { faceId: 1, gridX: 2, gridY: 1 }
                ],
                connections: [
                    { from: 4, to: 3, direction: 'right' },
                    { from: 3, to: 0, direction: 'right' },
                    { from: 4, to: 5, direction: 'down' },
                    { from: 3, to: 2, direction: 'down' },
                    { from: 0, to: 1, direction: 'down' }
                ]
            },
            // 2-2-2型
            '2-2-2': {
                name: '2-2-2型',
                type: '2-2-2',
                layout: [
                    { faceId: 4, gridX: 0, gridY: 0 },
                    { faceId: 3, gridX: 1, gridY: 0 },
                    { faceId: 0, gridX: 1, gridY: 1 },
                    { faceId: 2, gridX: 2, gridY: 1 },
                    { faceId: 1, gridX: 2, gridY: 2 },
                    { faceId: 5, gridX: 3, gridY: 2 }
                ],
                connections: [
                    { from: 4, to: 3, direction: 'right' },
                    { from: 3, to: 0, direction: 'down' },
                    { from: 0, to: 2, direction: 'right' },
                    { from: 2, to: 1, direction: 'down' },
                    { from: 1, to: 5, direction: 'right' }
                ]
            }
        };

        // 面片默认颜色
        const DEFAULT_FACE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
```

- [ ] **Step 2: 初始化面数据和Canvas**

继续添加初始化函数：

```javascript
        // ============================================
        // 初始化函数
        // ============================================
        function initFaceData() {
            faceData = [];
            faceCanvases = [];
            faceContexts = [];
            faceTextures = [];

            for (let i = 0; i < 6; i++) {
                faceData.push({
                    name: faceNames[i],
                    color: DEFAULT_FACE_COLORS[i],
                    pattern: 'none',
                    rotation: 0,
                    gridX: 0,
                    gridY: 0
                });

                // 创建Canvas
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');

                faceCanvases.push(canvas);
                faceContexts.push(ctx);
            }
        }

        function init() {
            initFaceData();
            init3DScene();
            init2DNet();
            setupEventListeners();

            // 默认选择第一种展开图
            changeNetType('1-4-1-1');
            selectFace(0);

            showTooltip('欢迎使用六面体展开图训练器！', 2000);
        }
```

- [ ] **Step 3: 验证数据结构**

在浏览器控制台执行：
```javascript
console.log(NET_STRUCTURES);
console.log(Object.keys(NET_STRUCTURES).length); // 应输出 11
```

预期：控制台显示11种展开图定义。

- [ ] **Step 4: 提交**

```bash
git add hexahedron.html
git commit -m "feat: 添加11种展开图数据结构和全局状态初始化"
```

---

## Task 3: 2D展开图渲染系统

**Files:**
- Modify: `hexahedron.html` (继续添加JavaScript)

**目标:** 实现2D展开图的渲染，包括网格绘制和面片定位。

- [ ] **Step 1: 实现2D展开图初始化**

继续添加代码：

```javascript
        // ============================================
        // 2D展开图系统
        // ============================================
        const FACE_SIZE = 100; // 面片大小(像素)
        const NET_PADDING = 20;

        function init2DNet() {
            netContainer = document.getElementById('net-container');

            // 创建Canvas用于绘制网格和背景
            netCanvas = document.createElement('canvas');
            netCanvas.style.position = 'absolute';
            netCanvas.style.top = '0';
            netCanvas.style.left = '0';
            netCanvas.style.pointerEvents = 'none';
            netContainer.appendChild(netCanvas);
            netCtx = netCanvas.getContext('2d');

            // 创建面片容器
            faceElements = [];
            for (let i = 0; i < 6; i++) {
                const faceEl = createFaceElement(i);
                netContainer.appendChild(faceEl);
                faceElements.push(faceEl);
            }

            resizeNet();
            window.addEventListener('resize', resizeNet);
        }

        function createFaceElement(faceIndex) {
            const el = document.createElement('div');
            el.className = 'net-face';
            el.dataset.faceIndex = faceIndex;
            el.style.width = FACE_SIZE + 'px';
            el.style.height = FACE_SIZE + 'px';

            // 面标签
            const label = document.createElement('div');
            label.className = 'face-label';
            label.textContent = faceNames[faceIndex];
            el.appendChild(label);

            // 绘图Canvas
            const canvas = document.createElement('canvas');
            canvas.width = FACE_SIZE;
            canvas.height = FACE_SIZE;
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.pointerEvents = 'none';
            el.appendChild(canvas);

            el.faceCanvas = canvas;
            el.faceCtx = canvas.getContext('2d');

            // 点击选择面
            el.addEventListener('click', (e) => {
                if (!e.target.closest('.move-hint')) {
                    selectFace(faceIndex);
                }
            });

            return el;
        }

        function resizeNet() {
            const rect = netContainer.getBoundingClientRect();
            netCanvas.width = rect.width;
            netCanvas.height = rect.height;
            renderNet();
        }
```

- [ ] **Step 2: 实现展开图渲染**

继续添加渲染逻辑：

```javascript
        function renderNet() {
            if (!netCtx || !currentNetLayout) return;

            const rect = netContainer.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            // 清空Canvas
            netCtx.clearRect(0, 0, width, height);

            // 计算布局边界
            const layout = currentNetLayout;
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            layout.forEach(item => {
                minX = Math.min(minX, item.gridX);
                maxX = Math.max(maxX, item.gridX);
                minY = Math.min(minY, item.gridY);
                maxY = Math.max(maxY, item.gridY);
            });

            const gridWidth = (maxX - minX + 1) * FACE_SIZE;
            const gridHeight = (maxY - minY + 1) * FACE_SIZE;
            const offsetX = (width - gridWidth) / 2 - minX * FACE_SIZE;
            const offsetY = (height - gridHeight) / 2 - minY * FACE_SIZE;

            // 绘制网格背景
            netCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            netCtx.lineWidth = 1;

            for (let x = 0; x <= width; x += FACE_SIZE) {
                netCtx.beginPath();
                netCtx.moveTo(x, 0);
                netCtx.lineTo(x, height);
                netCtx.stroke();
            }

            for (let y = 0; y <= height; y += FACE_SIZE) {
                netCtx.beginPath();
                netCtx.moveTo(0, y);
                netCtx.lineTo(width, y);
                netCtx.stroke();
            }

            // 定位面片
            layout.forEach(item => {
                const faceIndex = item.faceId;
                const el = faceElements[faceIndex];
                const x = offsetX + item.gridX * FACE_SIZE;
                const y = offsetY + item.gridY * FACE_SIZE;

                el.style.left = x + 'px';
                el.style.top = y + 'px';
                el.style.display = 'block';

                // 更新面数据位置
                faceData[faceIndex].gridX = item.gridX;
                faceData[faceIndex].gridY = item.gridY;

                // 渲染面内容
                renderFaceContent(faceIndex);
            });

            // 隐藏未使用的面片（不应发生，但以防万一）
            for (let i = 0; i < 6; i++) {
                const inLayout = layout.find(item => item.faceId === i);
                if (!inLayout) {
                    faceElements[i].style.display = 'none';
                }
            }
        }

        function renderFaceContent(faceIndex) {
            const el = faceElements[faceIndex];
            const ctx = el.faceCtx;
            const data = faceData[faceIndex];

            // 清空并绘制背景
            ctx.fillStyle = data.color;
            ctx.fillRect(0, 0, FACE_SIZE, FACE_SIZE);

            // 绘制图案
            if (data.pattern !== 'none') {
                drawPattern(ctx, data.pattern, data.rotation, data.color);
            }

            // 更新3D纹理
            updateFaceTexture(faceIndex);
        }
```

- [ ] **Step 3: 实现图案绘制函数**

继续添加图案绘制逻辑：

```javascript
        function drawPattern(ctx, pattern, rotation, bgColor) {
            const cx = FACE_SIZE / 2;
            const cy = FACE_SIZE / 2;
            const size = FACE_SIZE * 0.4;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation * Math.PI / 180);

            // 根据背景色决定图案颜色
            const isLight = bgColor === '#ffffff' || bgColor === '#eab308';
            ctx.fillStyle = isLight ? '#000000' : '#ffffff';
            ctx.strokeStyle = isLight ? '#000000' : '#ffffff';
            ctx.lineWidth = 4;

            switch(pattern) {
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(0, 0, size/2, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'circle-hollow':
                    ctx.beginPath();
                    ctx.arc(0, 0, size/2, 0, Math.PI * 2);
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    break;

                case 'triangle':
                    ctx.beginPath();
                    ctx.moveTo(0, -size/2);
                    ctx.lineTo(size/2, size/2);
                    ctx.lineTo(-size/2, size/2);
                    ctx.closePath();
                    ctx.fill();
                    break;

                case 'square':
                    ctx.fillRect(-size/2, -size/2, size, size);
                    break;

                case 'diamond':
                    ctx.beginPath();
                    ctx.moveTo(0, -size/2);
                    ctx.lineTo(size/2, 0);
                    ctx.lineTo(0, size/2);
                    ctx.lineTo(-size/2, 0);
                    ctx.closePath();
                    ctx.fill();
                    break;

                case 'cross':
                    ctx.lineWidth = 10;
                    ctx.beginPath();
                    ctx.moveTo(0, -size/2);
                    ctx.lineTo(0, size/2);
                    ctx.moveTo(-size/2, 0);
                    ctx.lineTo(size/2, 0);
                    ctx.stroke();
                    break;

                case 'star':
                    drawStar(ctx, 0, 0, 5, size/2, size/4);
                    break;

                case 'arrow-up':
                    drawArrow(ctx, 0, size/2, 0, -size/2);
                    break;

                case 'arrow-down':
                    drawArrow(ctx, 0, -size/2, 0, size/2);
                    break;

                case 'arrow-left':
                    drawArrow(ctx, size/2, 0, -size/2, 0);
                    break;

                case 'arrow-right':
                    drawArrow(ctx, -size/2, 0, size/2, 0);
                    break;

                case 'dot-1':
                    drawDot(ctx, 0, 0);
                    break;

                case 'dot-2':
                    drawDot(ctx, -12, -12);
                    drawDot(ctx, 12, 12);
                    break;

                case 'dot-3':
                    drawDot(ctx, -12, -12);
                    drawDot(ctx, 0, 0);
                    drawDot(ctx, 12, 12);
                    break;

                case 'dot-4':
                    drawDot(ctx, -12, -12);
                    drawDot(ctx, 12, -12);
                    drawDot(ctx, -12, 12);
                    drawDot(ctx, 12, 12);
                    break;

                case 'dot-5':
                    drawDot(ctx, -12, -12);
                    drawDot(ctx, 12, -12);
                    drawDot(ctx, 0, 0);
                    drawDot(ctx, -12, 12);
                    drawDot(ctx, 12, 12);
                    break;

                case 'dot-6':
                    drawDot(ctx, -12, -15);
                    drawDot(ctx, 12, -15);
                    drawDot(ctx, -12, 0);
                    drawDot(ctx, 12, 0);
                    drawDot(ctx, -12, 15);
                    drawDot(ctx, 12, 15);
                    break;
            }

            ctx.restore();
        }

        function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
            let rot = Math.PI / 2 * 3;
            let x = cx;
            let y = cy;
            let step = Math.PI / spikes;

            ctx.beginPath();
            ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
                x = cx + Math.cos(rot) * outerRadius;
                y = cy + Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += step;
                x = cx + Math.cos(rot) * innerRadius;
                y = cy + Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += step;
            }
            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
            ctx.fill();
        }

        function drawArrow(ctx, fromX, fromY, toX, toY) {
            const headlen = 15;
            const angle = Math.atan2(toY - fromY, toX - fromX);

            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
        }

        function drawDot(ctx, x, y) {
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
```

- [ ] **Step 4: 验证2D渲染**

刷新页面，检查：
- 展开图正确显示在中间区域
- 面片位置正确
- 点击面片可选择（边框高亮）

预期：展开图显示为十字形布局，6个面片位置正确。

- [ ] **Step 5: 提交**

```bash
git add hexahedron.html
git commit -m "feat: 实现2D展开图渲染系统和图案绘制"
```

---

## Task 4: 3D立方体渲染和折叠动画

**Files:**
- Modify: `hexahedron.html` (继续添加JavaScript)

**目标:** 实现Three.js 3D场景，包括立方体渲染和GSAP折叠动画。

- [ ] **Step 1: 实现3D场景初始化**

继续添加代码：

```javascript
        // ============================================
        // 3D渲染系统
        // ============================================
        function init3DScene() {
            const container = document.getElementById('preview-container');
            const canvas = document.getElementById('glCanvas');

            // 场景
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0f172a);

            // 相机
            const rect = container.getBoundingClientRect();
            camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 1000);
            camera.position.set(5, 5, 8);

            // 渲染器
            renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
            renderer.setSize(rect.width, rect.height);
            renderer.setPixelRatio(window.devicePixelRatio);

            // 控制器
            controls = new THREE.OrbitControls(camera, canvas);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;

            // 光照
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight1.position.set(5, 10, 7);
            scene.add(dirLight1);

            const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
            dirLight2.position.set(-5, -5, -5);
            scene.add(dirLight2);

            // 创建立方体
            createCube();

            // 开始动画循环
            animate();
        }

        function createCube() {
            cubeGroup = new THREE.Group();
            scene.add(cubeGroup);

            faces3D = [];

            // 为每个面创建纹理
            for (let i = 0; i < 6; i++) {
                const texture = new THREE.CanvasTexture(faceCanvases[i]);
                faceTextures.push(texture);

                const material = new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0.3,
                    metalness: 0.1,
                    side: THREE.DoubleSide
                });

                const geometry = new THREE.PlaneGeometry(1.8, 1.8);
                const mesh = new THREE.Mesh(geometry, material);

                // 设置面的初始位置（立方体状态）
                setCubeFacePosition(mesh, i);

                mesh.userData.faceIndex = i;
                faces3D.push(mesh);
                cubeGroup.add(mesh);

                // 添加边框
                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
                mesh.add(line);
            }
        }

        function setCubeFacePosition(mesh, faceIndex) {
            // 0: 前(z+), 1: 后(z-), 2: 右(x+), 3: 左(x-), 4: 上(y+), 5: 下(y-)
            const offset = 0.9;

            switch(faceIndex) {
                case 0: // 前
                    mesh.position.set(0, 0, offset);
                    mesh.rotation.set(0, 0, 0);
                    break;
                case 1: // 后
                    mesh.position.set(0, 0, -offset);
                    mesh.rotation.set(0, Math.PI, 0);
                    break;
                case 2: // 右
                    mesh.position.set(offset, 0, 0);
                    mesh.rotation.set(0, Math.PI / 2, 0);
                    break;
                case 3: // 左
                    mesh.position.set(-offset, 0, 0);
                    mesh.rotation.set(0, -Math.PI / 2, 0);
                    break;
                case 4: // 上
                    mesh.position.set(0, offset, 0);
                    mesh.rotation.set(-Math.PI / 2, 0, 0);
                    break;
                case 5: // 下
                    mesh.position.set(0, -offset, 0);
                    mesh.rotation.set(Math.PI / 2, 0, 0);
                    break;
            }
        }

        function updateFaceTexture(faceIndex) {
            if (faceTextures[faceIndex]) {
                faceTextures[faceIndex].needsUpdate = true;
            }
        }

        function updateAllTextures() {
            for (let i = 0; i < 6; i++) {
                renderFaceContent(i);
            }
        }

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
```

- [ ] **Step 2: 实现展开/折叠动画**

继续添加动画逻辑：

```javascript
        function toggleFold() {
            isUnfolded = !isUnfolded;
            document.getElementById('foldBtnText').textContent = isUnfolded ? '折叠立方体' : '展开立方体';

            if (isUnfolded) {
                animateToNet();
            } else {
                animateToCube();
            }
        }

        function animateToNet() {
            const layout = currentNetLayout;
            if (!layout) return;

            // 计算布局边界
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            layout.forEach(item => {
                minX = Math.min(minX, item.gridX);
                maxX = Math.max(maxX, item.gridX);
                minY = Math.min(minY, item.gridY);
                maxY = Math.max(maxY, item.gridY);
            });

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const spacing = 2.0;

            layout.forEach(item => {
                const mesh = faces3D[item.faceId];
                const targetX = (item.gridX - centerX) * spacing;
                const targetY = -(item.gridY - centerY) * spacing;

                gsap.to(mesh.position, {
                    x: targetX,
                    y: targetY,
                    z: 0,
                    duration: 1,
                    ease: "power2.inOut"
                });

                gsap.to(mesh.rotation, {
                    x: 0,
                    y: 0,
                    z: 0,
                    duration: 1,
                    ease: "power2.inOut"
                });
            });
        }

        function animateToCube() {
            faces3D.forEach((mesh, i) => {
                const pos = getCubeFacePosition(i);
                const rot = getCubeFaceRotation(i);

                gsap.to(mesh.position, {
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    duration: 1,
                    ease: "power2.inOut"
                });

                gsap.to(mesh.rotation, {
                    x: rot.x,
                    y: rot.y,
                    z: rot.z,
                    duration: 1,
                    ease: "power2.inOut"
                });
            });
        }

        function getCubeFacePosition(faceIndex) {
            const offset = 0.9;
            switch(faceIndex) {
                case 0: return { x: 0, y: 0, z: offset };
                case 1: return { x: 0, y: 0, z: -offset };
                case 2: return { x: offset, y: 0, z: 0 };
                case 3: return { x: -offset, y: 0, z: 0 };
                case 4: return { x: 0, y: offset, z: 0 };
                case 5: return { x: 0, y: -offset, z: 0 };
            }
        }

        function getCubeFaceRotation(faceIndex) {
            switch(faceIndex) {
                case 0: return { x: 0, y: 0, z: 0 };
                case 1: return { x: 0, y: Math.PI, z: 0 };
                case 2: return { x: 0, y: Math.PI / 2, z: 0 };
                case 3: return { x: 0, y: -Math.PI / 2, z: 0 };
                case 4: return { x: -Math.PI / 2, y: 0, z: 0 };
                case 5: return { x: Math.PI / 2, y: 0, z: 0 };
            }
        }
```

- [ ] **Step 3: 实现视图切换和其他3D控制**

继续添加：

```javascript
        function setViewMode(mode) {
            viewMode = mode;

            document.getElementById('btn-2d').className = mode === '2d'
                ? 'px-3 py-1 bg-blue-600 rounded text-sm'
                : 'px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm';
            document.getElementById('btn-3d').className = mode === '3d'
                ? 'px-3 py-1 bg-blue-600 rounded text-sm'
                : 'px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm';

            if (mode === '3d' && !isUnfolded) {
                toggleFold();
            } else if (mode === '2d' && isUnfolded) {
                toggleFold();
            }
        }

        function toggleAutoRotate() {
            isAutoRotating = !isAutoRotating;
            controls.autoRotate = isAutoRotating;
            controls.autoRotateSpeed = 2.0;

            const btn = document.getElementById('autoRotateBtn');
            btn.className = isAutoRotating
                ? 'px-4 py-2 bg-blue-600 rounded-lg text-sm transition flex items-center gap-2'
                : 'px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition flex items-center gap-2';
        }

        function resetView() {
            camera.position.set(5, 5, 8);
            camera.lookAt(0, 0, 0);
            controls.reset();
        }

        function onWindowResize() {
            const container = document.getElementById('preview-container');
            const rect = container.getBoundingClientRect();

            camera.aspect = rect.width / rect.height;
            camera.updateProjectionMatrix();
            renderer.setSize(rect.width, rect.height);
        }
```

- [ ] **Step 4: 验证3D渲染**

刷新页面，检查：
- 右侧3D预览区域显示立方体
- 点击"展开立方体"按钮，立方体展开为平面
- 可以用鼠标拖动旋转3D视图

预期：3D立方体正确渲染，展开/折叠动画流畅。

- [ ] **Step 5: 提交**

```bash
git add hexahedron.html
git commit -m "feat: 实现3D立方体渲染和GSAP折叠动画"
```

---

## Task 5: 面片手绘系统

**Files:**
- Modify: `hexahedron.html` (继续添加JavaScript)

**目标:** 实现面片上的手绘功能，包括画笔、橡皮擦和图案放置。

- [ ] **Step 1: 实现面片Canvas绑定和绘图事件**

继续添加代码：

```javascript
        // ============================================
        // 手绘系统
        // ============================================
        let isDrawing = false;
        let lastDrawPoint = null;
        let drawingFaceIndex = null;

        function setupFaceDrawing(faceIndex) {
            const el = faceElements[faceIndex];
            const canvas = el.faceCanvas;
            const ctx = el.faceCtx;

            // 移除之前的绘图Canvas
            const oldDrawCanvas = el.querySelector('.draw-canvas');
            if (oldDrawCanvas) oldDrawCanvas.remove();

            // 创建专用绘图层
            const drawCanvas = document.createElement('canvas');
            drawCanvas.width = FACE_SIZE;
            drawCanvas.height = FACE_SIZE;
            drawCanvas.className = 'draw-canvas';
            drawCanvas.style.position = 'absolute';
            drawCanvas.style.top = '0';
            drawCanvas.style.left = '0';
            drawCanvas.style.cursor = 'crosshair';
            drawCanvas.style.borderRadius = '2px';
            el.appendChild(drawCanvas);

            const drawCtx = drawCanvas.getContext('2d');
            el.drawCanvas = drawCanvas;
            el.drawCtx = drawCtx;

            // 鼠标事件
            drawCanvas.addEventListener('mousedown', (e) => {
                if (currentFaceIndex !== faceIndex) {
                    selectFace(faceIndex);
                }

                isDrawing = true;
                drawingFaceIndex = faceIndex;
                const rect = drawCanvas.getBoundingClientRect();
                lastDrawPoint = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };

                // 单点绘制
                if (currentTool === 'brush' || currentTool === 'eraser') {
                    drawDotAt(drawCtx, lastDrawPoint.x, lastDrawPoint.y);
                }
            });

            drawCanvas.addEventListener('mousemove', (e) => {
                if (!isDrawing || drawingFaceIndex !== faceIndex) return;

                const rect = drawCanvas.getBoundingClientRect();
                const point = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };

                if (currentTool === 'brush') {
                    drawLine(drawCtx, lastDrawPoint, point, brushColor, brushSize);
                } else if (currentTool === 'eraser') {
                    eraseAt(drawCtx, point.x, point.y, brushSize * 2);
                }

                lastDrawPoint = point;
            });

            drawCanvas.addEventListener('mouseup', finishDrawing);
            drawCanvas.addEventListener('mouseleave', finishDrawing);

            // 触摸事件支持
            drawCanvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                drawCanvas.dispatchEvent(mouseEvent);
            });

            drawCanvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                drawCanvas.dispatchEvent(mouseEvent);
            });

            drawCanvas.addEventListener('touchend', (e) => {
                const mouseEvent = new MouseEvent('mouseup', {});
                drawCanvas.dispatchEvent(mouseEvent);
            });
        }

        function finishDrawing() {
            if (isDrawing && drawingFaceIndex !== null) {
                // 合并绘图层到面片Canvas
                commitDrawing(drawingFaceIndex);
                saveHistory();
            }
            isDrawing = false;
            drawingFaceIndex = null;
            lastDrawPoint = null;
        }

        function drawDotAt(ctx, x, y) {
            ctx.fillStyle = currentTool === 'eraser' ? 'rgba(0,0,0,0)' : brushColor;
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawLine(ctx, from, to, color, size) {
            ctx.strokeStyle = color;
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }

        function eraseAt(ctx, x, y, size) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        function commitDrawing(faceIndex) {
            const el = faceElements[faceIndex];
            const drawCanvas = el.drawCanvas;
            const mainCanvas = el.faceCanvas;
            const mainCtx = el.faceCtx;

            // 将绘图层合并到主Canvas
            mainCtx.drawImage(drawCanvas, 0, 0);

            // 清空绘图层
            const drawCtx = el.drawCtx;
            drawCtx.clearRect(0, 0, FACE_SIZE, FACE_SIZE);

            // 更新3D纹理
            updateFaceTextureFromCanvas(faceIndex, mainCanvas);
        }

        function updateFaceTextureFromCanvas(faceIndex, sourceCanvas) {
            // 复制到大纹理Canvas
            const ctx = faceContexts[faceIndex];
            ctx.clearRect(0, 0, 256, 256);
            ctx.drawImage(sourceCanvas, 0, 0, 256, 256);

            // 更新纹理
            updateFaceTexture(faceIndex);
        }
```

- [ ] **Step 2: 实现工具切换和设置函数**

继续添加：

```javascript
        function setTool(tool) {
            currentTool = tool;

            document.getElementById('tool-brush').classList.toggle('active', tool === 'brush');
            document.getElementById('tool-eraser').classList.toggle('active', tool === 'eraser');

            // 更新光标
            faceElements.forEach(el => {
                const drawCanvas = el.querySelector('.draw-canvas');
                if (drawCanvas) {
                    drawCanvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
                }
            });

            showTooltip(`工具: ${tool === 'brush' ? '画笔' : '橡皮擦'}`, 1000);
        }

        function setBrushColor(color) {
            brushColor = color;

            // 更新UI
            document.querySelectorAll('.brush-color').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.color === color);
                btn.style.borderColor = btn.dataset.color === color ? '#3b82f6' : 'rgba(255,255,255,0.2)';
            });
        }

        function setBrushSize(size) {
            brushSize = parseInt(size);
            document.getElementById('brushSizeValue').textContent = size;
        }

        function setPattern(pattern) {
            faceData[currentFaceIndex].pattern = pattern;
            renderFaceContent(currentFaceIndex);
            updateFacePreview(currentFaceIndex);
            saveHistory();

            showTooltip(`已设置图案`, 1000);
        }

        function setFaceColor(color) {
            faceData[currentFaceIndex].color = color;
            renderFaceContent(currentFaceIndex);
            updateFacePreview(currentFaceIndex);
            updateFaceButton(currentFaceIndex);
            saveHistory();
        }

        function rotatePattern(angle) {
            faceData[currentFaceIndex].rotation = angle;
            renderFaceContent(currentFaceIndex);
            updateFacePreview(currentFaceIndex);
            saveHistory();
        }

        function clearCurrentFace() {
            if (currentFaceIndex === null) return;

            const el = faceElements[currentFaceIndex];
            const ctx = el.faceCtx;
            const drawCtx = el.drawCtx;

            ctx.fillStyle = faceData[currentFaceIndex].color;
            ctx.fillRect(0, 0, FACE_SIZE, FACE_SIZE);
            drawCtx.clearRect(0, 0, FACE_SIZE, FACE_SIZE);

            faceData[currentFaceIndex].pattern = 'none';
            renderFaceContent(currentFaceIndex);
            saveHistory();

            showTooltip('已清空当前面', 1500);
        }

        function clearAllFaces() {
            if (!confirm('确定要清空所有面吗？')) return;

            for (let i = 0; i < 6; i++) {
                const el = faceElements[i];
                const ctx = el.faceCtx;
                ctx.fillStyle = faceData[i].color;
                ctx.fillRect(0, 0, FACE_SIZE, FACE_SIZE);

                faceData[i].pattern = 'none';
                renderFaceContent(i);
            }

            saveHistory();
            showTooltip('已清空所有面', 1500);
        }
```

- [ ] **Step 3: 在展开图渲染后初始化绘图功能**

修改 `renderNet` 函数，在面片定位后初始化绘图：

```javascript
        function renderNet() {
            // ... 之前的代码 ...

            // 定位面片后，初始化绘图功能
            layout.forEach(item => {
                const faceIndex = item.faceId;
                const el = faceElements[faceIndex];

                // 如果还没有绑定绘图事件，则绑定
                if (!el.drawCanvas) {
                    setupFaceDrawing(faceIndex);
                }
            });
        }
```

- [ ] **Step 4: 验证手绘功能**

刷新页面，测试：
- 选择画笔工具，在面片上绘制
- 选择橡皮擦工具，擦除绘制内容
- 调整画笔颜色和大小
- 放置图案（圆形、箭头、骰子点数等）

预期：绘制功能正常，图案正确显示。

- [ ] **Step 5: 提交**

```bash
git add hexahedron.html
git commit -m "feat: 实现面片手绘系统（画笔、橡皮擦、图案）"
```

---

## Task 6: 移面法交互系统

**Files:**
- Modify: `hexahedron.html` (继续添加JavaScript)

**目标:** 实现垂直滚动移面、平行移面和公共边移面功能。

- [ ] **Step 1: 定义移面规则和辅助函数**

继续添加代码：

```javascript
        // ============================================
        // 移面法系统
        // ============================================
        const MOVE_DIRECTIONS = {
            UP: 'up',
            DOWN: 'down',
            LEFT: 'left',
            RIGHT: 'right'
        };

        // 检查移面是否有效
        function isValidMove(faceIndex, direction) {
            const layout = currentNetLayout;
            const face = layout.find(f => f.faceId === faceIndex);
            if (!face) return false;

            const { gridX, gridY } = face;
            let targetX = gridX;
            let targetY = gridY;

            switch(direction) {
                case MOVE_DIRECTIONS.UP: targetY -= 1; break;
                case MOVE_DIRECTIONS.DOWN: targetY += 1; break;
                case MOVE_DIRECTIONS.LEFT: targetX -= 1; break;
                case MOVE_DIRECTIONS.RIGHT: targetX += 1; break;
            }

            // 检查目标位置是否为空
            const targetOccupied = layout.some(f => f.gridX === targetX && f.gridY === targetY);

            // 垂直移面（上下）：目标位置必须为空或超出边界
            if (direction === MOVE_DIRECTIONS.UP || direction === MOVE_DIRECTIONS.DOWN) {
                return !targetOccupied;
            }

            // 平行移面（左右）：检查是否是四连排的首尾
            if (direction === MOVE_DIRECTIONS.LEFT || direction === MOVE_DIRECTIONS.RIGHT) {
                // 找到当前行
                const row = layout.filter(f => f.gridY === gridY).sort((a, b) => a.gridX - b.gridX);

                // 必须是4个连续的面
                if (row.length !== 4) return false;

                // 检查是否连续
                let isConsecutive = true;
                for (let i = 1; i < row.length; i++) {
                    if (row[i].gridX !== row[i-1].gridX + 1) {
                        isConsecutive = false;
                        break;
                    }
                }

                if (!isConsecutive) return false;

                // 向左移：必须是行的第一个面
                if (direction === MOVE_DIRECTIONS.LEFT) {
                    return row[0].faceId === faceIndex && targetX < row[0].gridX;
                }

                // 向右移：必须是行的最后一个面
                if (direction === MOVE_DIRECTIONS.RIGHT) {
                    return row[row.length - 1].faceId === faceIndex && targetX > row[row.length - 1].gridX;
                }
            }

            return false;
        }

        // 执行移面
        function executeMove(faceIndex, direction) {
            if (!isValidMove(faceIndex, direction)) return false;

            const layout = currentNetLayout;
            const face = layout.find(f => f.faceId === faceIndex);
            if (!face) return false;

            const oldX = face.gridX;
            const oldY = face.gridY;
            let newX = oldX;
            let newY = oldY;
            let rotationChange = 0;

            switch(direction) {
                case MOVE_DIRECTIONS.UP:
                    newY -= 1;
                    rotationChange = 90; // 向上滚动，图案顺时针旋转90度
                    break;
                case MOVE_DIRECTIONS.DOWN:
                    newY += 1;
                    rotationChange = -90; // 向下滚动，图案逆时针旋转90度
                    break;
                case MOVE_DIRECTIONS.LEFT:
                    newX -= 1;
                    // 平行移面，图案方向不变
                    break;
                case MOVE_DIRECTIONS.RIGHT:
                    newX += 1;
                    // 平行移面，图案方向不变
                    break;
            }

            // 更新布局
            face.gridX = newX;
            face.gridY = newY;

            // 更新图案旋转
            faceData[faceIndex].rotation = (faceData[faceIndex].rotation + rotationChange + 360) % 360;

            // 动画效果
            animateFaceMove(faceIndex, oldX, oldY, newX, newY, rotationChange);

            // 保存历史
            saveHistory();

            // 检查是否形成有效的展开图
            const isValidNet = validateNetStructure();
            if (!isValidNet) {
                showTooltip('注意：当前不是有效的六面体展开图', 2000);
            }

            return true;
        }

        function validateNetStructure() {
            // 检查是否形成有效的展开图
            // 简化验证：检查所有面是否连通
            const layout = currentNetLayout;
            if (layout.length !== 6) return false;

            // BFS检查连通性
            const visited = new Set();
            const queue = [layout[0].faceId];
            visited.add(layout[0].faceId);

            while (queue.length > 0) {
                const currentFaceId = queue.shift();
                const currentFace = layout.find(f => f.faceId === currentFaceId);

                // 检查四个方向
                const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                for (const [dx, dy] of directions) {
                    const neighbor = layout.find(f =>
                        f.gridX === currentFace.gridX + dx &&
                        f.gridY === currentFace.gridY + dy
                    );
                    if (neighbor && !visited.has(neighbor.faceId)) {
                        visited.add(neighbor.faceId);
                        queue.push(neighbor.faceId);
                    }
                }
            }

            return visited.size === 6;
        }
```

- [ ] **Step 2: 实现移面动画和UI指示器**

继续添加：

```javascript
        function animateFaceMove(faceIndex, fromX, fromY, toX, toY, rotationChange) {
            const el = faceElements[faceIndex];

            // 计算像素位置
            const layout = currentNetLayout;
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            layout.forEach(item => {
                minX = Math.min(minX, item.gridX);
                maxX = Math.max(maxX, item.gridX);
                minY = Math.min(minY, item.gridY);
                maxY = Math.max(maxY, item.gridY);
            });

            const rect = netContainer.getBoundingClientRect();
            const gridWidth = (maxX - minX + 1) * FACE_SIZE;
            const gridHeight = (maxY - minY + 1) * FACE_SIZE;
            const offsetX = (rect.width - gridWidth) / 2 - minX * FACE_SIZE;
            const offsetY = (rect.height - gridHeight) / 2 - minY * FACE_SIZE;

            const oldLeft = offsetX + fromX * FACE_SIZE;
            const oldTop = offsetY + fromY * FACE_SIZE;
            const newLeft = offsetX + toX * FACE_SIZE;
            const newTop = offsetY + toY * FACE_SIZE;

            // GSAP动画
            gsap.fromTo(el,
                { left: oldLeft, top: oldTop },
                {
                    left: newLeft,
                    top: newTop,
                    duration: 0.3,
                    ease: "power2.out",
                    onComplete: () => {
                        renderNet();
                        renderFaceContent(faceIndex);
                    }
                }
            );

            // 如果有旋转，添加旋转动画
            if (rotationChange !== 0) {
                const canvas = el.faceCanvas;
                gsap.fromTo(canvas,
                    { rotation: 0 },
                    {
                        rotation: rotationChange,
                        duration: 0.3,
                        ease: "power2.out",
                        onComplete: () => {
                            gsap.set(canvas, { rotation: 0 });
                        }
                    }
                );
            }
        }

        // 为面片添加移面指示器
        function addMoveIndicators(faceIndex) {
            const el = faceElements[faceIndex];

            // 移除现有指示器
            el.querySelectorAll('.move-hint').forEach(h => h.remove());

            // 检查各方向是否可移
            const directions = [
                { dir: MOVE_DIRECTIONS.UP, symbol: '↑', style: 'top: -15px; left: 50%; transform: translateX(-50%);' },
                { dir: MOVE_DIRECTIONS.DOWN, symbol: '↓', style: 'bottom: -15px; left: 50%; transform: translateX(-50%);' },
                { dir: MOVE_DIRECTIONS.LEFT, symbol: '←', style: 'left: -15px; top: 50%; transform: translateY(-50%);' },
                { dir: MOVE_DIRECTIONS.RIGHT, symbol: '→', style: 'right: -15px; top: 50%; transform: translateY(-50%);' }
            ];

            directions.forEach(({ dir, symbol, style }) => {
                if (isValidMove(faceIndex, dir)) {
                    const hint = document.createElement('div');
                    hint.className = 'move-hint';
                    hint.innerHTML = symbol;
                    hint.style.cssText = style;
                    hint.addEventListener('click', (e) => {
                        e.stopPropagation();
                        executeMove(faceIndex, dir);
                    });
                    el.appendChild(hint);
                }
            });
        }

        function updateAllMoveIndicators() {
            for (let i = 0; i < 6; i++) {
                addMoveIndicators(i);
            }
        }
```

- [ ] **Step 3: 集成移面指示器到渲染流程**

修改 `renderNet` 函数，在渲染后更新移面指示器：

```javascript
        function renderNet() {
            // ... 之前的代码 ...

            // 更新移面指示器
            setTimeout(updateAllMoveIndicators, 50);
        }
```

- [ ] **Step 4: 实现撤销/重做功能**

继续添加：

```javascript
        function saveHistory() {
            const state = {
                layout: JSON.parse(JSON.stringify(currentNetLayout)),
                faceData: JSON.parse(JSON.stringify(faceData)),
                netType: document.getElementById('netType').value
            };

            // 移除当前位置之后的历史
            history = history.slice(0, historyIndex + 1);

            // 添加新状态
            history.push(state);
            historyIndex++;

            // 限制历史记录数量
            if (history.length > 50) {
                history.shift();
                historyIndex--;
            }
        }

        function undoMove() {
            if (historyIndex > 0) {
                historyIndex--;
                restoreState(history[historyIndex]);
                showTooltip('撤销', 1000);
            } else {
                showTooltip('无法撤销', 1000);
            }
        }

        function redoMove() {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                restoreState(history[historyIndex]);
                showTooltip('重做', 1000);
            } else {
                showTooltip('无法重做', 1000);
            }
        }

        function restoreState(state) {
            currentNetLayout = state.layout;

            for (let i = 0; i < 6; i++) {
                Object.assign(faceData[i], state.faceData[i]);
            }

            document.getElementById('netType').value = state.netType;

            renderNet();
            updateAllTextures();
        }

        function resetNet() {
            const netType = document.getElementById('netType').value;
            changeNetType(netType);
            showTooltip('已重置展开图', 1500);
        }
```

- [ ] **Step 5: 验证移面功能**

刷新页面，测试：
- 悬停面片时，显示可移方向的箭头指示器
- 点击箭头执行移面操作
- 点击撤销/重做按钮
- 图案在垂直滚动时旋转

预期：移面功能正常，动画流畅。

- [ ] **Step 6: 提交**

```bash
git add hexahedron.html
git commit -m "feat: 实现移面法交互系统（垂直滚动、平行移面）"
```

---

## Task 7: UI事件绑定和辅助功能

**Files:**
- Modify: `hexahedron.html` (继续添加JavaScript)

**目标:** 完成所有UI事件绑定，包括面选择、展开图切换、快捷键等。

- [ ] **Step 1: 实现事件监听器绑定**

继续添加代码：

```javascript
        // ============================================
        // UI事件绑定
        // ============================================
        function setupEventListeners() {
            // 展开/折叠按钮
            document.getElementById('foldBtn').addEventListener('click', toggleFold);

            // 重置视角
            document.querySelector('[onclick="resetView()"]').addEventListener('click', resetView);

            // 自动旋转
            document.querySelector('[onclick="toggleAutoRotate()"]').addEventListener('click', toggleAutoRotate);

            // 返回按钮
            document.querySelector('[onclick="goBack()"]')?.addEventListener('click', goBack);

            // 画笔大小滑块
            document.getElementById('brushSize').addEventListener('input', (e) => {
                setBrushSize(e.target.value);
            });

            // 键盘快捷键
            document.addEventListener('keydown', (e) => {
                // Ctrl+Z 撤销
                if (e.ctrlKey && e.key === 'z') {
                    e.preventDefault();
                    undoMove();
                }
                // Ctrl+Y 重做
                else if (e.ctrlKey && e.key === 'y') {
                    e.preventDefault();
                    redoMove();
                }
                // B 画笔
                else if (e.key === 'b' || e.key === 'B') {
                    setTool('brush');
                }
                // E 橡皮擦
                else if (e.key === 'e' || e.key === 'E') {
                    setTool('eraser');
                }
                // Delete 清空当前面
                else if (e.key === 'Delete') {
                    clearCurrentFace();
                }
            });

            // 窗口大小调整
            window.addEventListener('resize', () => {
                resizeNet();
                onWindowResize();
            });
        }
```

- [ ] **Step 2: 实现辅助函数**

继续添加：

```javascript
        function selectFace(index) {
            currentFaceIndex = index;

            // 更新按钮状态
            for (let i = 0; i < 6; i++) {
                const btn = document.getElementById(`face-btn-${i}`);
                btn.classList.toggle('active', i === index);
            }

            // 更新预览
            updateFacePreview(index);

            showTooltip(`已选择: ${faceNames[index]}面`, 1000);
        }

        function updateFacePreview(index) {
            const nameEl = document.getElementById('current-face-name');
            const previewEl = document.getElementById('current-face-preview');

            nameEl.textContent = faceNames[index] + '面';
            previewEl.style.backgroundColor = faceData[index].color;
            previewEl.style.color = faceData[index].color === '#ffffff' || faceData[index].color === '#eab308'
                ? '#000' : '#fff';

            // 显示图案符号
            const patternSymbols = {
                'none': '?',
                'circle': '●',
                'circle-hollow': '○',
                'triangle': '▲',
                'square': '■',
                'diamond': '◆',
                'cross': '✚',
                'star': '★',
                'arrow-up': '↑',
                'arrow-down': '↓',
                'arrow-left': '←',
                'arrow-right': '→',
                'dot-1': '1',
                'dot-2': '2',
                'dot-3': '3',
                'dot-4': '4',
                'dot-5': '5',
                'dot-6': '6'
            };

            previewEl.textContent = patternSymbols[faceData[index].pattern] || '?';
        }

        function updateFaceButton(index) {
            const btn = document.getElementById(`face-btn-${index}`);
            btn.style.backgroundColor = faceData[index].color;
            btn.style.color = faceData[index].color === '#ffffff' || faceData[index].color === '#eab308'
                ? '#000' : '#fff';
        }

        function changeNetType(netType) {
            const structure = NET_STRUCTURES[netType];
            if (!structure) return;

            currentNetLayout = JSON.parse(JSON.stringify(structure.layout));

            // 更新面位置
            currentNetLayout.forEach(item => {
                faceData[item.faceId].gridX = item.gridX;
                faceData[item.faceId].gridY = item.gridY;
            });

            renderNet();
            updateAllTextures();
            saveHistory();

            // 如果在展开状态，更新3D视图
            if (isUnfolded) {
                animateToNet();
            }

            showTooltip(`已切换: ${structure.name}`, 1500);
        }

        function goBack() {
            window.location.href = 'index.html';
        }

        function showTooltip(message, duration = 1500) {
            const tooltip = document.getElementById('tooltip');
            tooltip.textContent = message;
            tooltip.style.display = 'block';

            setTimeout(() => {
                tooltip.style.display = 'none';
            }, duration);
        }
```

- [ ] **Step 3: 添加页面加载初始化**

在JavaScript末尾添加：

```javascript
        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', init);
    </script>
</body>
</html>
```

- [ ] **Step 4: 验证所有UI功能**

刷新页面，测试：
- 点击面选择按钮切换当前编辑面
- 切换展开图类型下拉菜单
- 点击图案库按钮设置图案
- 点击颜色按钮更改面颜色
- 快捷键 B/E/ctrl+Z/ctrl+Y 正常工作

预期：所有UI交互正常。

- [ ] **Step 5: 提交**

```bash
git add hexahedron.html
git commit -m "feat: 完成UI事件绑定和辅助功能"
```

---

## Task 8: 更新主编辑器链接

**Files:**
- Modify: `index.html:735`
- Modify: `app.js:3992`

**目标:** 更新主编辑器中的链接，指向新的 `hexahedron.html`。

- [ ] **Step 1: 修改 index.html 中的按钮**

找到第735行附近的按钮代码，修改为：

```html
<button id="openCubeNetEditor" style="background: linear-gradient(45deg, #f0932b, #ff6b6b); color: white; width: 100%; padding: 8px; font-weight: bold;" onclick="window.open('hexahedron.html', '_blank');">🎲 六面体展开图编辑器</button>
```

或者保持原有按钮ID，只修改 `app.js` 中的处理逻辑。

- [ ] **Step 2: 修改 app.js 中的事件处理**

找到第3988-3994行，修改为：

```javascript
        // 六面体展开图编辑器事件监听器
        const openCubeNetEditorBtn = document.getElementById('openCubeNetEditor');
        if (openCubeNetEditorBtn) {
            openCubeNetEditorBtn.addEventListener('click', () => {
                window.open('hexahedron.html', '_blank');
            });
        }
```

- [ ] **Step 3: 验证链接跳转**

从 `index.html` 点击"六面体展开图编辑器"按钮，确认：
- 正确打开 `hexahedron.html`
- 返回按钮能正确返回主编辑器

- [ ] **Step 4: 提交**

```bash
git add index.html app.js
git commit -m "feat: 更新主编辑器链接指向hexahedron.html"
```

---

## Task 9: 最终集成测试

**Files:**
- None (测试任务)

**目标:** 全面测试所有功能，确保系统正常工作。

- [ ] **Step 1: 测试展开图切换**

测试所有11种展开图类型：
- [ ] 1-4-1型 6种变体
- [ ] 2-3-1型 3种变体
- [ ] 3-3型
- [ ] 2-2-2型

预期：每种类型正确显示，面片位置正确。

- [ ] **Step 2: 测试移面功能**

测试不同展开图的移面：
- [ ] 十字形展开图的垂直移面
- [ ] 四连排的平行移面
- [ ] 移面后图案旋转
- [ ] 撤销/重做

预期：移面操作正确，动画流畅。

- [ ] **Step 3: 测试手绘系统**

测试绘图工具：
- [ ] 画笔绘制
- [ ] 橡皮擦擦除
- [ ] 颜色切换
- [ ] 大小调节
- [ ] 图案放置
- [ ] 图案旋转

预期：绘制流畅，图案正确显示。

- [ ] **Step 4: 测试3D预览**

测试3D功能：
- [ ] 立方体渲染
- [ ] 展开/折叠动画
- [ ] 视角旋转
- [ ] 自动旋转
- [ ] 面纹理同步

预期：3D渲染正确，动画流畅。

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: 完成六面体展开图训练器核心功能"
```

---

## 执行计划总结

| Task | 描述 | 预计时间 |
|------|------|----------|
| 1 | 基础HTML结构和UI布局 | 30分钟 |
| 2 | 11种展开图数据结构和初始化 | 20分钟 |
| 3 | 2D展开图渲染系统 | 30分钟 |
| 4 | 3D立方体渲染和折叠动画 | 30分钟 |
| 5 | 面片手绘系统 | 40分钟 |
| 6 | 移面法交互系统 | 40分钟 |
| 7 | UI事件绑定和辅助功能 | 20分钟 |
| 8 | 更新主编辑器链接 | 10分钟 |
| 9 | 最终集成测试 | 30分钟 |

**总计：约4小时**
