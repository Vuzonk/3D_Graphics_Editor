/**
 * 六面体展开图编辑器
 * 允许用户在2D平面上绘制立方体的六个面，并实时预览3D效果
 */

// 等待Three.js加载完成
let THREE;
let OrbitControls;

async function loadThree() {
    if (typeof window.THREE !== 'undefined') {
        THREE = window.THREE;
        return;
    }

    const threeModule = await import('./libs/three/three.module.js');
    THREE = threeModule.default || threeModule;

    const { OrbitControls } = await import('./libs/three/addons/controls/OrbitControls.js');
    window.OrbitControls = OrbitControls;
    window.THREE = THREE;
}

/**
 * CubeNetEditor - 六面体展开图编辑器主类
 */
class CubeNetEditor {
    constructor() {
        // Konva相关
        this.stage = null;
        this.netLayer = null;      // 展开图图层
        this.gridLayer = null;     // 网格图层
        this.previewLayer = null;  // 预览图层

        // 状态管理
        this.currentTemplate = null;  // 当前展开模式
        this.faceSize = 120;          // 单面大小(像素)
        this.faces = new Map();       // 存储六个面的画布
        this.currentTool = 'brush';   // 当前工具: brush, eraser
        this.brushSize = 5;
        this.brushColor = '#000000';
        this.isDrawing = false;

        // 3D预览相关
        this.previewScene = null;
        this.previewCamera = null;
        this.previewRenderer = null;
        this.previewCube = null;
        this.cubeMaterials = [];      // 六个面的材质
        this.previewControls = null;

        // 撤销/重做
        this.history = [];
        this.historyIndex = -1;

        // 当前选中的面（用于清空操作）
        this.selectedFaceId = null;
    }

    /**
     * 初始化编辑器
     */
    async init() {
        await loadThree();

        this.initKonvaStage();
        this.init3DPreview();
        await this.loadTemplates();
        this.setupEventListeners();
        this.setupUI();

        // 默认选择十字形模式
        this.selectTemplate('cross');

        this.showTooltip('欢迎使用六面体展开图编辑器！', 2000);
    }

    /**
     * 初始化Konva舞台
     */
    initKonvaStage() {
        const container = document.getElementById('net-container');
        const width = container.offsetWidth;
        const height = container.offsetHeight;

        this.stage = new Konva.Stage({
            container: 'net-container',
            width: width,
            height: height
        });

        // 创建三个图层
        this.gridLayer = new Konva.Layer();
        this.netLayer = new Konva.Layer();
        this.previewLayer = new Konva.Layer();

        this.stage.add(this.gridLayer);
        this.stage.add(this.netLayer);
        this.stage.add(this.previewLayer);

        this.drawGrid();
    }

    /**
     * 绘制网格辅助线
     */
    drawGrid() {
        const gridSize = this.faceSize;
        const cols = Math.ceil(this.stage.width() / gridSize);
        const rows = Math.ceil(this.stage.height() / gridSize);

        for (let i = 0; i <= cols; i++) {
            this.gridLayer.add(new Konva.Line({
                points: [i * gridSize, 0, i * gridSize, this.stage.height()],
                stroke: '#e0e0e0',
                strokeWidth: 1,
                listening: false
            }));
        }

        for (let i = 0; i <= rows; i++) {
            this.gridLayer.add(new Konva.Line({
                points: [0, i * gridSize, this.stage.width(), i * gridSize],
                stroke: '#e0e0e0',
                strokeWidth: 1,
                listening: false
            }));
        }

        this.gridLayer.batchDraw();
    }

    /**
     * 初始化3D预览
     */
    init3DPreview() {
        const container = document.getElementById('preview-container');

        // 场景
        this.previewScene = new THREE.Scene();
        this.previewScene.background = new THREE.Color(0xf0f0f0);

        // 相机
        this.previewCamera = new THREE.PerspectiveCamera(
            50,
            container.offsetWidth / container.offsetHeight,
            0.1,
            1000
        );
        this.previewCamera.position.set(2.5, 2.5, 2.5);
        this.previewCamera.lookAt(0, 0, 0);

        // 渲染器
        this.previewRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.previewRenderer.setSize(container.offsetWidth, container.offsetHeight);
        this.previewRenderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.previewRenderer.domElement);

        // 光照
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.previewScene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        this.previewScene.add(directionalLight);

        // 控制器
        this.previewControls = new OrbitControls(
            this.previewCamera,
            this.previewRenderer.domElement
        );
        this.previewControls.enableDamping = true;
        this.previewControls.dampingFactor = 0.05;

        // 创建立方体
        this.createPreviewCube();

        // 动画循环
        this.animatePreview();
    }

    /**
     * 创建预览立方体
     */
    createPreviewCube() {
        const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);

        // 创建六个面的材质
        this.cubeMaterials = [];
        for (let i = 0; i < 6; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            // 白色背景
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 256, 256);

            const texture = new THREE.CanvasTexture(canvas);
            this.cubeMaterials.push(new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.5,
                metalness: 0.1
            }));
        }

        this.previewCube = new THREE.Mesh(geometry, this.cubeMaterials);
        this.previewScene.add(this.previewCube);
    }

    /**
     * 加载展开模板
     */
    async loadTemplates() {
        try {
            const response = await fetch('./cube-nets/templates.json');
            const data = await response.json();
            this.templates = data.templates;
            this.populateTemplateSelector();
        } catch (error) {
            console.error('加载模板失败:', error);
            this.showTooltip('加载模板失败', 2000);
        }
    }

    /**
     * 选择展开模式
     */
    selectTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        this.currentTemplate = template;
        this.clearNetLayer();
        this.createFaces();
        this.updatePreview();
        this.saveHistory();

        this.showTooltip(`已选择: ${template.name}`, 1500);
    }

    /**
     * 清除展开图层
     */
    clearNetLayer() {
        this.netLayer.destroyChildren();
        this.faces.clear();
    }

    /**
     * 创建六个面的画布
     */
    createFaces() {
        const layout = this.currentTemplate.layout;
        const facePositions = this.currentTemplate.facePositions;

        // 计算偏移量使图形居中
        const rows = layout.length;
        const cols = Math.max(...layout.map(row => row ? row.length : 0));
        const offsetX = (this.stage.width() - cols * this.faceSize) / 2;
        const offsetY = (this.stage.height() - rows * this.faceSize) / 2;

        // 遍历每个面
        Object.keys(facePositions).forEach(faceId => {
            const faceInfo = facePositions[faceId];
            const row = faceInfo.row;
            const col = faceInfo.col;
            const faceName = faceInfo.face;

            const x = col * this.faceSize + offsetX;
            const y = row * this.faceSize + offsetY;

            // 创建画布容器组
            const group = new Konva.Group({
                x: x,
                y: y,
                draggable: false
            });

            // 创建背景矩形
            const rect = new Konva.Rect({
                width: this.faceSize,
                height: this.faceSize,
                fill: '#ffffff',
                stroke: '#333333',
                strokeWidth: 2,
                cornerRadius: 4,
                listening: false
            });
            group.add(rect);

            // 创建绘图层
            const drawingLayer = new Konva.Layer();

            // 创建画布
            const canvas = document.createElement('canvas');
            canvas.width = this.faceSize;
            canvas.height = this.faceSize;
            const ctx = canvas.getContext('2d');

            // 白色背景
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, this.faceSize, this.faceSize);

            // 创建Konva.Image显示画布内容
            const image = new Konva.Image({
                image: canvas,
                width: this.faceSize,
                height: this.faceSize
            });

            drawingLayer.add(image);
            group.add(drawingLayer);

            // 添加面标签
            const label = new Konva.Text({
                text: this.getFaceLabel(faceName),
                x: 5,
                y: 5,
                fontSize: 14,
                fontFamily: 'Arial, Microsoft YaHei',
                fill: '#666666',
                fontStyle: 'bold',
                listening: false
            });
            group.add(label);

            this.netLayer.add(group);

            // 存储面信息
            this.faces.set(faceId, {
                group: group,
                canvas: canvas,
                ctx: ctx,
                image: image,
                drawingLayer: drawingLayer,
                faceName: faceName,
                materialIndex: this.getMaterialIndex(faceName)
            });

            // 启用该面的绘图功能
            this.enableDrawingOnFace(faceId, group, drawingLayer, canvas, ctx, image);
        });

        this.netLayer.batchDraw();
    }

    /**
     * 在面上启用绘图
     */
    enableDrawingOnFace(faceId, group, layer, canvas, ctx, image) {
        let isDrawing = false;
        let lastPoint = null;

        // 获取相对于group的鼠标位置
        const getLocalPos = (pos) => {
            const transform = group.getAbsoluteTransform().getMatrix();
            const x = (pos.x - transform[4]) / transform[0];
            const y = (pos.y - transform[5]) / transform[5];
            return { x, y };
        };

        // 鼠标按下
        layer.on('mousedown', (e) => {
            isDrawing = true;
            this.selectedFaceId = faceId;

            const pos = this.stage.getPointerPosition();
            lastPoint = getLocalPos(pos);

            if (this.currentTool === 'brush') {
                ctx.beginPath();
                ctx.moveTo(lastPoint.x, lastPoint.y);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = this.brushColor;
                ctx.lineWidth = this.brushSize;
            }
        });

        // 鼠标移动
        layer.on('mousemove', () => {
            if (!isDrawing) return;

            const pos = this.stage.getPointerPosition();
            const localPos = getLocalPos(pos);

            if (this.currentTool === 'brush') {
                ctx.lineTo(localPos.x, localPos.y);
                ctx.stroke();
                layer.batchDraw();
            } else if (this.currentTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(localPos.x, localPos.y, this.brushSize * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
                layer.batchDraw();
            }

            lastPoint = localPos;
        });

        // 鼠标抬起/离开
        const endDrawing = () => {
            if (isDrawing) {
                isDrawing = false;
                this.saveHistory();
                this.updatePreview();
            }
        };

        layer.on('mouseup', endDrawing);
        layer.on('mouseleave', endDrawing);
    }

    /**
     * 获取面标签
     */
    getFaceLabel(faceName) {
        const labels = {
            'front': '前',
            'back': '后',
            'left': '左',
            'right': '右',
            'top': '上',
            'bottom': '下'
        };
        return labels[faceName] || faceName;
    }

    /**
     * 获取材质索引 (Three.js BoxGeometry的面顺序)
     */
    getMaterialIndex(faceName) {
        const mapping = {
            'right': 0,
            'left': 1,
            'top': 2,
            'bottom': 3,
            'front': 4,
            'back': 5
        };
        return mapping[faceName] || 0;
    }

    /**
     * 更新3D预览
     */
    updatePreview() {
        this.faces.forEach((faceData) => {
            const materialIndex = faceData.materialIndex;
            const canvas = faceData.canvas;

            // 更新材质纹理
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            this.cubeMaterials[materialIndex].map = texture;
            this.cubeMaterials[materialIndex].needsUpdate = true;
        });
    }

    /**
     * 预览动画循环
     */
    animatePreview() {
        requestAnimationFrame(() => this.animatePreview());

        if (this.previewControls) {
            this.previewControls.update();
        }

        if (this.previewRenderer && this.previewScene && this.previewCamera) {
            this.previewRenderer.render(this.previewScene, this.previewCamera);
        }
    }

    /**
     * 保存历史记录
     */
    saveHistory() {
        // 保存所有面的当前状态
        const state = {};
        this.faces.forEach((faceData, faceId) => {
            state[faceId] = faceData.canvas.toDataURL();
        });

        // 移除当前索引之后的历史
        this.history = this.history.slice(0, this.historyIndex + 1);

        // 添加新状态
        this.history.push(state);
        this.historyIndex++;

        // 限制历史记录数量
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * 撤销
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            this.showTooltip('撤销', 1000);
        } else {
            this.showTooltip('无法撤销', 1000);
        }
    }

    /**
     * 重做
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.showTooltip('重做', 1000);
        } else {
            this.showTooltip('无法重做', 1000);
        }
    }

    /**
     * 恢复状态
     */
    restoreState(state) {
        const promises = [];

        Object.keys(state).forEach(faceId => {
            const faceData = this.faces.get(faceId);
            if (faceData) {
                const promise = new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        faceData.ctx.clearRect(0, 0, faceData.canvas.width, faceData.canvas.height);
                        faceData.ctx.drawImage(img, 0, 0);
                        faceData.image.getLayer().batchDraw();
                        resolve();
                    };
                    img.src = state[faceId];
                });
                promises.push(promise);
            }
        });

        Promise.all(promises).then(() => {
            this.updatePreview();
        });
    }

    /**
     * 清空当前面
     */
    clearCurrentFace() {
        if (this.selectedFaceId && this.faces.has(this.selectedFaceId)) {
            const faceData = this.faces.get(this.selectedFaceId);
            faceData.ctx.fillStyle = '#ffffff';
            faceData.ctx.fillRect(0, 0, faceData.canvas.width, faceData.canvas.height);
            faceData.image.getLayer().batchDraw();
            this.saveHistory();
            this.updatePreview();
            this.showTooltip('已清空当前面', 1500);
        } else {
            this.showTooltip('请先选择一个面', 1500);
        }
    }

    /**
     * 清空所有面
     */
    clearAllFaces() {
        if (confirm('确定要清空所有面吗？')) {
            this.faces.forEach((faceData) => {
                faceData.ctx.fillStyle = '#ffffff';
                faceData.ctx.fillRect(0, 0, faceData.canvas.width, faceData.canvas.height);
                faceData.image.getLayer().batchDraw();
            });
            this.saveHistory();
            this.updatePreview();
            this.showTooltip('已清空所有面', 1500);
        }
    }

    /**
     * 导出配置
     */
    exportConfig() {
        const config = {
            template: this.currentTemplate.id,
            templateName: this.currentTemplate.name,
            faceSize: this.faceSize,
            timestamp: new Date().toISOString(),
            faces: {}
        };

        // 保存每个面的图像数据
        this.faces.forEach((faceData, faceId) => {
            config.faces[faceId] = {
                faceName: faceData.faceName,
                imageData: faceData.canvas.toDataURL('image/png')
            };
        });

        // 生成文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `cube-net-${timestamp}.json`;

        // 下载文件
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);

        this.showTooltip(`配置已导出: ${filename}`, 2500);
    }

    /**
     * 导入配置
     */
    async importConfig(file) {
        try {
            const text = await file.text();
            const config = JSON.parse(text);

            // 验证配置格式
            if (!config.template || !config.faces) {
                throw new Error('配置格式错误');
            }

            // 选择对应的模板
            this.selectTemplate(config.template);

            // 等待模板加载
            await new Promise(resolve => setTimeout(resolve, 200));

            // 恢复每个面的图像
            const promises = [];
            Object.keys(config.faces).forEach(faceId => {
                const faceConfig = config.faces[faceId];
                const faceData = this.faces.get(faceId);

                if (faceData && faceConfig.imageData) {
                    const promise = new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            faceData.ctx.drawImage(img, 0, 0);
                            faceData.image.getLayer().batchDraw();
                            resolve();
                        };
                        img.src = faceConfig.imageData;
                    });
                    promises.push(promise);
                }
            });

            await Promise.all(promises);
            this.saveHistory();
            this.updatePreview();

            this.showTooltip(`配置已导入: ${file.name}`, 2500);
        } catch (error) {
            console.error('导入配置失败:', error);
            this.showTooltip('导入配置失败，请检查文件格式', 2500);
        }
    }

    /**
     * 导出为PNG图片
     */
    exportToPNG() {
        // 导出展开图
        const dataURL = this.netLayer.toDataURL({ pixelRatio: 2 });

        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `cube-net-${Date.now()}.png`;
        link.click();

        this.showTooltip('展开图已导出为PNG', 2000);
    }

    /**
     * 设置工具
     */
    setTool(tool) {
        this.currentTool = tool;
        const toolName = tool === 'brush' ? '画笔' : '橡皮擦';
        this.showTooltip(`工具: ${toolName}`, 1000);
    }

    /**
     * 设置画笔颜色
     */
    setBrushColor(color) {
        this.brushColor = color;
    }

    /**
     * 设置画笔大小
     */
    setBrushSize(size) {
        this.brushSize = parseInt(size);
        document.getElementById('brush-size-value').textContent = size;
    }

    /**
     * 填充模板选择器
     */
    populateTemplateSelector() {
        const selector = document.getElementById('template-select');
        if (!selector) return;

        selector.innerHTML = '';

        this.templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            selector.appendChild(option);
        });

        selector.addEventListener('change', (e) => {
            this.selectTemplate(e.target.value);
        });
    }

    /**
     * 设置UI事件
     */
    setupUI() {
        // 展开模式选择器已在 populateTemplateSelector 中设置

        // 工具按钮
        const brushBtn = document.getElementById('brush-tool');
        const eraserBtn = document.getElementById('eraser-tool');

        brushBtn?.addEventListener('click', () => {
            this.setTool('brush');
            brushBtn.classList.add('active');
            eraserBtn?.classList.remove('active');
        });

        eraserBtn?.addEventListener('click', () => {
            this.setTool('eraser');
            eraserBtn.classList.add('active');
            brushBtn?.classList.remove('active');
        });

        // 颜色选择器
        document.getElementById('color-picker')?.addEventListener('change', (e) => {
            this.setBrushColor(e.target.value);
        });

        // 画笔大小
        document.getElementById('brush-size')?.addEventListener('input', (e) => {
            this.setBrushSize(e.target.value);
        });

        // 清空按钮
        document.getElementById('clear-current')?.addEventListener('click', () => {
            this.clearCurrentFace();
        });

        document.getElementById('clear-all')?.addEventListener('click', () => {
            this.clearAllFaces();
        });

        // 导出/导入
        document.getElementById('export-config')?.addEventListener('click', () => {
            this.exportConfig();
        });

        const importInput = document.getElementById('import-config');
        document.getElementById('import-config-btn')?.addEventListener('click', () => {
            importInput?.click();
        });

        importInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importConfig(file);
            }
        });

        document.getElementById('export-png')?.addEventListener('click', () => {
            this.exportToPNG();
        });

        // 撤销/重做
        document.getElementById('undo')?.addEventListener('click', () => {
            this.undo();
        });

        document.getElementById('redo')?.addEventListener('click', () => {
            this.redo();
        });

        // 返回主编辑器
        document.getElementById('back-to-main')?.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    /**
     * 设置键盘快捷键
     */
    setupEventListeners() {
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            } else if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                this.redo();
            } else if (e.key === 'b' || e.key === 'B') {
                this.setTool('brush');
                document.getElementById('brush-tool')?.classList.add('active');
                document.getElementById('eraser-tool')?.classList.remove('active');
            } else if (e.key === 'e' || e.key === 'E') {
                this.setTool('eraser');
                document.getElementById('eraser-tool')?.classList.add('active');
                document.getElementById('brush-tool')?.classList.remove('active');
            }
        });

        // 窗口大小调整
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * 处理窗口大小调整
     */
    handleResize() {
        // 更新Konva舞台大小
        const container = document.getElementById('net-container');
        if (container && this.stage) {
            this.stage.width(container.offsetWidth);
            this.stage.height(container.offsetHeight);
            this.drawGrid();
            // 重新创建面以适应新尺寸
            if (this.currentTemplate) {
                this.selectTemplate(this.currentTemplate.id);
            }
        }

        // 更新3D预览大小
        const previewContainer = document.getElementById('preview-container');
        if (previewContainer && this.previewCamera && this.previewRenderer) {
            this.previewCamera.aspect = previewContainer.offsetWidth / previewContainer.offsetHeight;
            this.previewCamera.updateProjectionMatrix();
            this.previewRenderer.setSize(previewContainer.offsetWidth, previewContainer.offsetHeight);
        }
    }

    /**
     * 显示提示信息
     */
    showTooltip(message, duration = 1500) {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.textContent = message;
            tooltip.style.display = 'block';

            setTimeout(() => {
                tooltip.style.display = 'none';
            }, duration);
        }
    }
}

// 初始化编辑器
let cubeNetEditor;

window.addEventListener('load', async () => {
    cubeNetEditor = new CubeNetEditor();
    await cubeNetEditor.init();
});
