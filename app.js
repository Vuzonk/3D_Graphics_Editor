// ==================== 变形历史记录系统 ====================

class DeformationHistoryEntry {
    constructor(shapeId, beforeVertices, afterVertices) {
        this.timestamp = Date.now();
        this.shapeId = shapeId;
        this.beforeVertices = beforeVertices;  // Map<index, Vector3>
        this.afterVertices = afterVertices;    // Map<index, Vector3>
    }
}

class DeformationHistory {
    constructor(maxSteps = 50) {
        this.entries = [];
        this.currentIndex = -1;
        this.maxSteps = maxSteps;
    }

    push(entry) {
        // 如果当前不在最新位置，删除后面的记录
        if (this.currentIndex < this.entries.length - 1) {
            this.entries = this.entries.slice(0, this.currentIndex + 1);
        }

        this.entries.push(entry);

        // 限制历史长度
        if (this.entries.length > this.maxSteps) {
            this.entries.shift();
        } else {
            this.currentIndex++;
        }
    }

    undo() {
        if (this.currentIndex < 0) return null;
        return this.entries[this.currentIndex--];
    }

    redo() {
        if (this.currentIndex >= this.entries.length - 1) return null;
        return this.entries[++this.currentIndex];
    }

    clear() {
        this.entries = [];
        this.currentIndex = -1;
    }

    canUndo() {
        return this.currentIndex >= 0;
    }

    canRedo() {
        return this.currentIndex < this.entries.length - 1;
    }
}

// ==================== 主应用类 ====================

class Shape3DViewer {
    constructor() {
        console.log('Shape3DViewer构造函数开始执行');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.shapes = new Map(); // 存储多个图形
        this.selectedShape = null;

        // 使用three-bvh-csg进行布尔运算
        this.csgEvaluator = null;
        this.brushObjects = new Map(); // 存储CSG刷对象

        // TransformControls - 用于改进的图形变换控制
        this.transformControls = null;
        // 切割平面TransformControls
        this.cuttingPlaneTransform = null;
        this.cuttingPlaneProxy = null;
        this.operationHistory = []; // 操作历史
        this.historyIndex = -1;
        this.shapeCounter = 0;
        this.cuttingMode = false;
        this.cuttingPlane = null;
        this.pendingCuttingPlane = null; // 待确认的切割平面
        this.cuttingConfirmMode = false; // 切割确认模式
        this.activeCuttingPlane = null; // 当前正在调整的切割平面
        this.cuttingPlaneAdjustMode = false; // 切割平面调整模式
        this.customClipPlanes = [];
        this.combinedShapes = new Map(); // 拼合后的图形组
        this.isLocked = false; // 拼合锁定状态
        this.dragControls = null; // 拖拽控制器
        this.isDragging = false; // 拖拽状态
        this.dragPlane = null; // 拖拽平面
        this.uniformScaleMode = false; // 等比缩放模式

        // 布尔运算相关
        this.booleanMode = false; // 布尔运算模式
        this.booleanMainShape = null; // 主体图形
        this.booleanToolShape = null; // 工具图形
        this.booleanOperation = 'subtract'; // 运算类型：subtract, union, intersect

        // 变形编辑系统（统一替代顶点/骨骼/锚点编辑）
        this.deformationMode = false;  // 变形模式开关
        this.deformationSelection = {
            mode: 'vertex',              // 'vertex' | 'edge' | 'face'
            softSelect: false,           // 软选择开关
            softRadius: 2.5,             // 软选择半径
            softCurve: 'smooth',         // 'linear' | 'smooth' | 'sharp'
            selectedVertices: new Set(), // 选中的顶点索引
            selectedEdges: new Set(),    // 选中的边ID (如 "0-1")
            selectedFaces: new Set(),    // 选中的面索引
            boxSelecting: false          // 是否正在框选
        };
        this.deformationHandles = null;     // 顶点控制点 (InstancedMesh)
        this.edgeLines = null;              // 边线段
        this.faceMarkers = [];              // 面标记数组
        this.softSelectVisual = null;       // 软选择范围可视化
        this.deformationHistory = null;     // 变形历史（在init中初始化）
        this.originalGeometry = null;       // 原始几何体备份
        this.deformTransformControls = null; // 变形专用的TransformControls
        this.edgeData = null;               // 边数据缓存
        this.faceData = null;               // 面数据缓存
        this.deformDummy = null;            // 变换用的虚拟对象

        // 移动设备检测和性能优化
        this.isMobile = this.detectMobileDevice();
        this.performanceMode = this.isMobile ? 'mobile' : 'desktop';

        // 性能监控相关
        this.frameCount = 0;
        this.lastFPSCheck = Date.now();
        this.currentFPS = 60;
        this.lowFPSCount = 0;
        this.adaptiveQuality = this.isMobile; // 移动设备启用自适应质量

        // 配置管理相关
        this.configFiles = new Map(); // 存储配置文件
        this.pendingConfig = null; // 待加载的配置
        this.defaultConfigPath = './configs/'; // 默认配置文件夹路径
        this.useDefaultConfigPath = true; // 是否使用默认配置路径

        // 切割预览相关
        this.cuttingPreviewMode = false;
        this.cuttingPreviewScene = null;
        this.cuttingPreviewCamera = null;
        this.cuttingPreviewRenderer = null;
        this.cuttingPreviewMeshes = []; // 预览中的图形副本
        this.cuttingPreviewGroup = null; // 预览内容的容器组
        this.cuttingPreviewRotation = 0; // 预览旋转角度（弧度）
        this.cuttingPreviewScale = 1; // 预览缩放比例
        this.cuttingPreviewDragging = false;
        this.cuttingPreviewStartAngle = 0;
        this.cuttingPreviewStartRotation = 0;

        // 图形类型中文名称映射
        this.shapeTypeNames = {
            cube: '立方体',
            sphere: '球体',
            cylinder: '圆柱体',
            cone: '圆锥体',
            pyramid: '棱锥体',
            torus: '圆环',
            dodecahedron: '十二面体',
            icosahedron: '二十面体'
        };

        // 配置文件列表分页
        this.configListPageSize = 10;
        this.configListCurrentPage = 1;
        this.configListCurrentPages = {};

        console.log('开始初始化...');
        this.init();
        console.log('开始设置事件监听器...');
        this.setupEventListeners();
        console.log('开始创建初始图形...');
        this.createShape('cube');
        console.log('Shape3DViewer构造函数执行完成');

        // 尝试自动加载配置文件夹
        this.autoLoadConfigFolder();
    }
    
    // 检测移动设备
    detectMobileDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        // 检测移动设备的用户代理字符串
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const isMobileUA = mobileRegex.test(userAgent);
        
        // 检测触摸屏
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // 检测屏幕尺寸
        const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
        
        // 检测设备内存（如果可用）
        const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
        
        // 检测硬件并发数（CPU核心数）
        const hasLowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
        
        // 综合判断
        const isMobile = isMobileUA || (isTouchDevice && isSmallScreen);
        const isLowPerformance = hasLowMemory || hasLowCPU;
        
        console.log('设备检测结果:', {
            userAgent: userAgent,
            isMobileUA: isMobileUA,
            isTouchDevice: isTouchDevice,
            isSmallScreen: isSmallScreen,
            hasLowMemory: hasLowMemory,
            hasLowCPU: hasLowCPU,
            finalResult: isMobile || isLowPerformance
        });
        
        return isMobile || isLowPerformance;
    }
    
    // 获取优化的渲染器配置
    getOptimizedRendererConfig() {
        if (this.isMobile) {
            // 移动设备优化配置
            return {
                antialias: true, // 移动设备也启用抗锯齿，提升视觉效果
                alpha: false,
                powerPreference: "default", // 使用默认功耗模式
                stencil: true, // 启用模板缓冲，改善裁剪平面效果
                depth: true,
                logarithmicDepthBuffer: true, // 启用对数深度缓冲，改善裁剪平面的深度精度
                preserveDrawingBuffer: false
            };
        } else {
            // 桌面设备高质量配置
            return {
                antialias: true, // 启用抗锯齿
                alpha: true,
                powerPreference: "high-performance",
                stencil: true, // 启用模板缓冲，改善裁剪平面效果
                depth: true,
                logarithmicDepthBuffer: false,
                preserveDrawingBuffer: false,
                physicallyCorrectLights: true, // 使用物理正确光照
                toneMapping: THREE.ACESFilmicToneMapping, // 电影级色调映射
                toneMappingExposure: 1.0
            };
        }
    }
    
    // 设置阴影
    setupShadows() {
        if (this.isMobile) {
            // 移动设备关闭阴影
            this.renderer.shadowMap.enabled = false;
        } else {
            // 桌面设备启用高质量阴影
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = true;
        }
    }
    
    init() {
        console.log('init方法开始执行');
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff); // 白色背景
        
        // 创建相机
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(8, 8, 8);
        
        // 根据设备类型创建优化的渲染器
        const rendererConfig = this.getOptimizedRendererConfig();
        this.renderer = new THREE.WebGLRenderer(rendererConfig);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // 根据设备类型设置像素比（提高桌面设备的渲染质量）
        const pixelRatio = this.isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2.5);
        this.renderer.setPixelRatio(pixelRatio);
        
        // 根据性能模式设置阴影
        this.setupShadows();
        
        // 渲染质量设置
        this.renderer.localClippingEnabled = true;
        if (!this.isMobile) {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.0;
            this.renderer.useLegacyLights = false;
        }
        
        // 清除颜色设置
        this.renderer.setClearColor(0xf0f0f0, 1.0);
        
        document.getElementById('container').appendChild(this.renderer.domElement);

        // 初始化变形历史
        this.deformationHistory = new DeformationHistory(50);

        // 创建轨道控制器
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        // 移动设备使用更高的阻尼系数以减少闪烁
        this.controls.dampingFactor = this.isMobile ? 0.1 : 0.05;
        this.controls.target.set(10, 0, 10); // 设置控制器目标为网格中心

        // 初始化TransformControls - 使用Three.js内置的TransformControls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.setMode('translate'); // 设置为移动模式，显示箭头手柄
        this.transformControls.setTranslationSnap(0.1); // 设置移动步长为0.1
        this.transformStartState = null; // 用于保存变换前的状态

        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value; // 拖拽时禁用轨道控制器

            // 拖拽开始时保存状态
            if (event.value && this.selectedShape) {
                this.transformStartState = this.saveShapeState(this.selectedShape);
            }
            // 拖拽结束时记录历史
            else if (!event.value && this.selectedShape && this.transformStartState) {
                const endState = this.saveShapeState(this.selectedShape);
                // 只有状态真正改变时才记录
                if (JSON.stringify(this.transformStartState) !== JSON.stringify(endState)) {
                    this.addToHistory('transform', {
                        shapeId: this.selectedShape.userData.id,
                        oldState: this.transformStartState,
                        newState: endState
                    });
                }
                this.transformStartState = null;
            }
        });
        this.transformControls.addEventListener('objectChange', () => {
            // 对象变换时更新选择框
            if (this.selectedShape) {
                // 限制图形位置，确保不低于网格
                this.constrainShapePosition(this.selectedShape);

                const selectionBox = this.scene.getObjectByName('selectionBox');
                if (selectionBox) {
                    selectionBox.update();
                }

                // 同步更新位置滑块
                ['posX', 'posY', 'posZ'].forEach(id => {
                    const slider = document.getElementById(id);
                    const valueDisplay = document.getElementById(id + 'Value');
                    if (slider && valueDisplay) {
                        const axis = { 'posX': 'x', 'posY': 'y', 'posZ': 'z' }[id];
                        slider.value = this.selectedShape.position[axis];
                        valueDisplay.textContent = this.selectedShape.position[axis].toFixed(1);
                    }
                });

                // 更新图形信息显示
                this.updateShapeInfo(this.selectedShape);
            }
        });
        this.transformControls.setSize(0.75); // 设置控制手柄大小
        this.scene.add(this.transformControls);

        // 初始化顶点编辑TransformControls
        this.initVertexTransformControls();

        // 初始化骨骼TransformControls
        this.initBoneTransformControls();

        // 初始化锚点TransformControls
        this.initAnchorTransformControls();

        // 初始化切割平面TransformControls
        this.initCuttingPlaneTransform();
        
        // 移动设备优化设置
        if (this.isMobile) {
            this.controls.enablePan = true;
            this.controls.enableZoom = true;
            this.controls.enableRotate = true;
            this.controls.rotateSpeed = 0.5;
            this.controls.zoomSpeed = 0.8;
            this.controls.panSpeed = 0.8;
            this.controls.maxPolarAngle = Math.PI;
            this.controls.minDistance = 5;
            this.controls.maxDistance = 50;
        }
        
        // 移除了截面控制功能
        
        // 初始化自定义切割平面
        this.customClipPlanes = [];
        
        // 添加光照
        this.setupLighting();
        
        // 添加网格
        this.addGrid();
        
        // 设置鼠标拾取
        this.setupRaycaster();
        
        // 设置拖拽控制器
        this.setupDragControls();
        
        // 开始渲染循环
        this.animate();

        // 处理窗口大小变化
        window.addEventListener('resize', () => this.onWindowResize());

        // 初始化CSG库（如果已加载）
        // 延迟检查以确保module脚本有时间执行
        setTimeout(() => {
            if (window.CSG && window.CSG.Evaluator) {
                this.initCSGLibrary();
            } else {
                // 继续检查（最多检查10次）
                let checkCount = 0;
                const checkInterval = setInterval(() => {
                    checkCount++;
                    if (window.CSG && window.CSG.Evaluator) {
                        clearInterval(checkInterval);
                        this.initCSGLibrary();
                    } else if (checkCount >= 10) {
                        clearInterval(checkInterval);
                        console.warn('CSG库未加载，布尔运算功能将不可用');
                        this.showTooltip('CSG库加载超时，请检查网络连接', 5000);
                    }
                }, 100);
            }
        }, 100);
    }

    // 初始化CSG库
    initCSGLibrary() {
        try {
            if (!window.CSG || !window.CSG.Evaluator) {
                console.error('CSG库不可用');
                return;
            }

            this.csgEvaluator = new window.CSG.Evaluator();
            this.csgEvaluator.useGroups = true;
            this.csgEvaluator.attributes = ['position', 'normal'];

            console.log('CSG库初始化成功');
            this.showTooltip('高级CSG库已加载，布尔运算速度提升100倍+', 3000);
        } catch (error) {
            console.error('CSG库初始化失败:', error);
        }
    }

    // 使用three-bvh-csg执行高效的布尔运算
    performAdvancedCSGOperation(brushA, brushB, operation) {
        console.log('performAdvancedCSGOperation 调用:', {
            hasEvaluator: !!this.csgEvaluator,
            hasWindowCSG: !!window.CSG,
            operation
        });

        // 确保使用正确的常量值
        if (typeof operation === 'undefined' || operation === null) {
            console.error('CSG操作类型无效:', operation);
            this.showTooltip('CSG操作类型无效', 1500);
            return null;
        }

        // 确保 CSG 库已加载
        if (!window.CSG) {
            console.error('CSG库未加载');
            this.showTooltip('CSG库未加载，无法执行布尔运算', 1500);
            return null;
        }

        // 确保 Evaluator 已初始化
        if (!this.csgEvaluator) {
            console.warn('CSG Evaluator未初始化，尝试重新初始化...');
            try {
                if (window.CSG.Evaluator) {
                    this.csgEvaluator = new window.CSG.Evaluator();
                    this.csgEvaluator.useGroups = true;
                    this.csgEvaluator.attributes = ['position', 'normal'];
                    console.log('CSG Evaluator 重新初始化成功');
                } else {
                    console.error('CSG Evaluator类不存在');
                    this.showTooltip('CSG Evaluator类不存在', 1500);
                    return null;
                }
            } catch (error) {
                console.error('CSG Evaluator 初始化失败:', error);
                this.showTooltip('CSG Evaluator初始化失败', 1500);
                return null;
            }
        }

        if (!brushA || !brushB || !brushA.geometry || !brushB.geometry) {
            console.error('无效的输入几何体:', { brushA, brushB });
            this.showTooltip('图形数据无效', 2000);
            return null;
        }

        try {
            // 克隆几何体以避免修改原始几何体
            const geom1 = brushA.geometry.clone();
            const geom2 = brushB.geometry.clone();

            // 应用变换到几何体顶点
            geom1.applyMatrix4(brushA.matrixWorld);
            geom2.applyMatrix4(brushB.matrixWorld);

            console.log('几何体变换完成:', {
                geom1Vertices: geom1.attributes.position.count,
                geom2Vertices: geom2.attributes.position.count
            });

            // 创建Brush对象，位置设置为原点
            const brush1 = new window.CSG.Brush(geom1);
            brush1.position.set(0, 0, 0);
            brush1.rotation.set(0, 0, 0);
            brush1.scale.set(1, 1, 1);
            brush1.updateMatrixWorld();

            const brush2 = new window.CSG.Brush(geom2);
            brush2.position.set(0, 0, 0);
            brush2.rotation.set(0, 0, 0);
            brush2.scale.set(1, 1, 1);
            brush2.updateMatrixWorld();

            console.log('Brush对象创建完成');

            // 设置材质
            brush1.material = brushA.material.clone();
            brush2.material = brushB.material.clone();

            // 准备几何体
            brush1.prepareGeometry();
            brush2.prepareGeometry();

            console.log('几何体准备完成，开始执行CSG运算...');

            // 执行CSG运算（不传targetMesh参数，让库自动创建结果Brush）
            const result = this.csgEvaluator.evaluate(brush1, brush2, operation);

            if (result) {
                // console.log('CSG运算成功完成，耗时:', this.csgEvaluator.lastTime || '未知');
            }

            return result;
        } catch (error) {
            console.error('CSG运算失败:', error);
            this.showTooltip('布尔运算失败，请检查几何体', 2000);
            return null;
        }
    }
    
    setupLighting() {
        // 环境光 - 提供基础照明
        const ambientIntensity = this.isMobile ? 0.6 : 0.5;
        const ambientLight = new THREE.AmbientLight(0x404040, ambientIntensity);
        this.scene.add(ambientLight);
        
        // 主光源 - 方向光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(15, 15, 10);
        
        // 根据设备类型设置阴影
        if (this.performanceMode !== 'mobile') {
            directionalLight.castShadow = true;
            // 高质量阴影设置
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.1;
            directionalLight.shadow.camera.far = 50;
            directionalLight.shadow.camera.left = -25;
            directionalLight.shadow.camera.right = 25;
            directionalLight.shadow.camera.top = 25;
            directionalLight.shadow.camera.bottom = -25;
            directionalLight.shadow.bias = -0.0001;
            directionalLight.shadow.normalBias = 0.02;
            directionalLight.shadow.radius = 2; // 柔化阴影边缘
        }
        
        this.scene.add(directionalLight);
        
        // 补充光源 - 点光源（移动设备上简化）
        if (!this.isMobile) {
            const pointLight1 = new THREE.PointLight(0x4a90e2, 0.5, 30);
            pointLight1.position.set(5, 10, 5);
            pointLight1.castShadow = true;
            pointLight1.shadow.mapSize.width = 1024;
            pointLight1.shadow.mapSize.height = 1024;
            this.scene.add(pointLight1);
            
            // 添加第二个点光源，从不同方向照射
            const pointLight2 = new THREE.PointLight(0xff6b6b, 0.3, 30);
            pointLight2.position.set(-5, 8, -5);
            this.scene.add(pointLight2);
        }
        
        // 添加半球光以获得更自然的照明
        const hemisphereIntensity = this.isMobile ? 0.5 : 0.4;
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, hemisphereIntensity);
        this.scene.add(hemisphereLight);
    }
    
    addGrid() {
        this.gridHelper = new THREE.GridHelper(20, 40, 0x444444, 0x222222);
        this.gridHelper.position.set(10, 0, 10); // 将网格移动到正值范围中心
        this.scene.add(this.gridHelper);
        
        this.axesHelper = new THREE.AxesHelper(5);
        this.scene.add(this.axesHelper);
        
        // 网格显示状态
        this.gridVisible = true;
    }
    
    setupRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.renderer.domElement.addEventListener('click', (event) => {
            this.handleMouseClick(event);
        });
    }
    
    setupDragControls() {
        // 添加鼠标事件监听器用于拖拽
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            this.handleMouseDown(event);
        });
        
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.handleMouseMove(event);
        });
        
        this.renderer.domElement.addEventListener('mouseup', (event) => {
            this.handleMouseUp(event);
        });
        
        // 添加触摸事件支持（移动设备）
        if (this.isMobile) {
            this.setupTouchControls();
        }
    }
    
    setupTouchControls() {
        let touchStartTime = 0;
        let lastTouchMove = 0;
        const touchMoveThrottle = 16; // 约60fps，减少触摸移动事件频率
        
        this.renderer.domElement.addEventListener('touchstart', (event) => {
            event.preventDefault();
            touchStartTime = Date.now();
            
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0
                });
                this.handleMouseDown(mouseEvent);
            }
        }, { passive: false });
        
        this.renderer.domElement.addEventListener('touchmove', (event) => {
            event.preventDefault();
            
            const now = Date.now();
            if (now - lastTouchMove < touchMoveThrottle) {
                return; // 节流处理，减少触摸移动事件频率
            }
            lastTouchMove = now;
            
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.handleMouseMove(mouseEvent);
            }
        }, { passive: false });
        
        this.renderer.domElement.addEventListener('touchend', (event) => {
            event.preventDefault();
            
            const touchDuration = Date.now() - touchStartTime;
            
            const mouseEvent = new MouseEvent('mouseup', {
                button: 0
            });
            this.handleMouseUp(mouseEvent);
            
            // 如果是短触摸（小于200ms），触发点击事件
            if (touchDuration < 200 && event.changedTouches.length === 1) {
                const touch = event.changedTouches[0];
                const clickEvent = new MouseEvent('click', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0
                });
                this.handleMouseClick(clickEvent);
            }
        }, { passive: false });
    }

    initVertexTransformControls() {
        this.vertexTransformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.vertexTransformControls.setMode('translate');
        this.vertexTransformControls.setSize(0.5);
        this.vertexTransformControls.visible = false;
        this.vertexTransformControls.enabled = false;

        this.vertexTransformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });

        this.vertexTransformControls.addEventListener('objectChange', () => {
            this.updateVertexFromTransform();
        });

        this.scene.add(this.vertexTransformControls);
    }

    initBoneTransformControls() {
        this.boneTransformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.boneTransformControls.setMode('translate');
        this.boneTransformControls.setSize(0.6);
        this.boneTransformControls.visible = false;
        this.boneTransformControls.enabled = false;

        this.boneTransformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });

        this.boneTransformControls.addEventListener('objectChange', () => {
            this.updateBoneFromTransform();
        });

        this.scene.add(this.boneTransformControls);
    }

    initAnchorTransformControls() {
        this.anchorTransformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.anchorTransformControls.setMode('translate');
        this.anchorTransformControls.setSize(0.5);
        this.anchorTransformControls.visible = false;
        this.anchorTransformControls.enabled = false;

        this.anchorTransformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });

        this.anchorTransformControls.addEventListener('objectChange', () => {
            this.updateAnchorFromTransform();
        });

        this.scene.add(this.anchorTransformControls);
    }

    initCuttingPlaneTransform() {
        // 创建切割平面代理对象
        this.cuttingPlaneProxy = new THREE.Object3D();
        this.cuttingPlaneProxy.name = 'cuttingPlaneProxy';
        this.cuttingPlaneProxy.visible = false;
        this.scene.add(this.cuttingPlaneProxy);
        
        // 创建切割平面的TransformControls
        this.cuttingPlaneTransform = new TransformControls(this.camera, this.renderer.domElement);
        this.cuttingPlaneTransform.setMode('rotate'); // 默认设置为旋转模式
        this.cuttingPlaneTransform.setSize(1.0);
        this.cuttingPlaneTransform.visible = false;
        
        // 变换开始时
        this.cuttingPlaneTransform.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });
        
        this.scene.add(this.cuttingPlaneTransform);
    }
    
    updateCuttingPlaneFromTransform() {
        if (!this.cuttingPlaneProxy || !this.cuttingPlaneAdjustMode) return;
        
        // 从代理对象的旋转计算新的法向量
        const defaultNormal = new THREE.Vector3(1, 0, 0);
        const newNormal = defaultNormal.clone().applyQuaternion(this.cuttingPlaneProxy.quaternion);
        newNormal.normalize();
        
        // 更新切割平面的法向量
        if (this.activeCuttingPlane) {
            this.activeCuttingPlane.normal.copy(newNormal);
            
            // 更新切割平面的常量（保持平面位置不变）
            const currentPoint = this.cuttingPlaneProxy.position;
            this.activeCuttingPlane.constant = -newNormal.dot(currentPoint);
            
            // 更新控制器的值
            document.getElementById('cuttingNormalX').value = newNormal.x.toFixed(2);
            document.getElementById('cuttingNormalY').value = newNormal.y.toFixed(2);
            document.getElementById('cuttingNormalZ').value = newNormal.z.toFixed(2);
            
            // 更新显示值和数值输入框
            const precisionMode = document.getElementById('precisionMode').value;
            let precision = 2;
            switch(precisionMode) {
                case 'high': precision = 3; break;
                case 'ultra': precision = 4; break;
                default: precision = 2;
            }
            
            document.getElementById('cuttingNormalXValue').textContent = newNormal.x.toFixed(precision);
            document.getElementById('cuttingNormalYValue').textContent = newNormal.y.toFixed(precision);
            document.getElementById('cuttingNormalZValue').textContent = newNormal.z.toFixed(precision);
            
            document.getElementById('cuttingNormalXInput').value = newNormal.x.toFixed(precision);
            document.getElementById('cuttingNormalYInput').value = newNormal.y.toFixed(precision);
            document.getElementById('cuttingNormalZInput').value = newNormal.z.toFixed(precision);
            
            // 更新可视化
            this.updateCuttingPlaneVisualization();
            
            // 应用切割预览
            this.previewActiveCuttingPlane();
        }
    }
    
    enableCuttingPlaneTransform() {
        if (!this.cuttingPlaneTransform || !this.cuttingPlaneProxy) return;
        
        // 显示代理对象和TransformControls
        this.cuttingPlaneProxy.visible = true;
        this.cuttingPlaneTransform.visible = true;
        
        // 将TransformControls绑定到代理对象
        this.cuttingPlaneTransform.attach(this.cuttingPlaneProxy);
        
        // 设置代理对象位置到切割平面中心
        if (this.activeCuttingPlane) {
            const point = this.activeCuttingPlane.normal.clone().multiplyScalar(-this.activeCuttingPlane.constant);
            this.cuttingPlaneProxy.position.copy(point);
            
            // 设置代理对象旋转与切割平面法向量对齐
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.activeCuttingPlane.normal);
            this.cuttingPlaneProxy.setRotationFromQuaternion(quaternion);
        }
    }
    
    disableCuttingPlaneTransform() {
        if (!this.cuttingPlaneTransform || !this.cuttingPlaneProxy) return;
        
        // 隐藏代理对象和TransformControls
        this.cuttingPlaneProxy.visible = false;
        this.cuttingPlaneTransform.visible = false;
        
        // 解除绑定
        this.cuttingPlaneTransform.detach();
    }
    
    setCuttingPlaneTransformMode(mode) {
        if (!this.cuttingPlaneTransform) return;
        
        // 移除旧的监听器
        this.cuttingPlaneTransform.removeEventListener('objectChange', this.updateCuttingPlanePositionFromTransformHandler);
        this.cuttingPlaneTransform.removeEventListener('objectChange', this.updateCuttingPlaneFromTransformHandler);
        
        this.cuttingPlaneTransform.setMode(mode);
        
        // 根据模式设置不同的行为
        if (mode === 'translate') {
            // 移动模式：更新切割平面位置
            if (!this.updateCuttingPlanePositionFromTransformHandler) {
                this.updateCuttingPlanePositionFromTransformHandler = () => this.updateCuttingPlanePositionFromTransform();
            }
            this.cuttingPlaneTransform.addEventListener('objectChange', this.updateCuttingPlanePositionFromTransformHandler);
        } else if (mode === 'rotate') {
            // 旋转模式：更新切割平面法向量
            if (!this.updateCuttingPlaneFromTransformHandler) {
                this.updateCuttingPlaneFromTransformHandler = () => this.updateCuttingPlaneFromTransform();
            }
            this.cuttingPlaneTransform.addEventListener('objectChange', this.updateCuttingPlaneFromTransformHandler);
        }
    }
    
    updateCuttingPlanePositionFromTransform() {
        if (!this.cuttingPlaneProxy || !this.cuttingPlaneAdjustMode || !this.activeCuttingPlane) return;
        
        // 从代理对象的位置更新切割平面
        const position = this.cuttingPlaneProxy.position;
        
        // 更新切割平面的常量
        this.activeCuttingPlane.constant = -this.activeCuttingPlane.normal.dot(position);
        
        // 更新控制器的值
        document.getElementById('cuttingPosX').value = position.x.toFixed(2);
        document.getElementById('cuttingPosY').value = position.y.toFixed(2);
        document.getElementById('cuttingPosZ').value = position.z.toFixed(2);
        
        // 更新显示值和数值输入框
        const precisionMode = document.getElementById('precisionMode').value;
        let precision = 2;
        switch(precisionMode) {
            case 'high': precision = 3; break;
            case 'ultra': precision = 4; break;
            default: precision = 2;
        }
        
        document.getElementById('cuttingPosXValue').textContent = position.x.toFixed(precision);
        document.getElementById('cuttingPosYValue').textContent = position.y.toFixed(precision);
        document.getElementById('cuttingPosZValue').textContent = position.z.toFixed(precision);
        
        document.getElementById('cuttingPosXInput').value = position.x.toFixed(precision);
        document.getElementById('cuttingPosYInput').value = position.y.toFixed(precision);
        document.getElementById('cuttingPosZInput').value = position.z.toFixed(precision);
        
        // 更新可视化
        this.updateCuttingPlaneVisualization();
        
        // 应用切割预览
        this.previewActiveCuttingPlane();
    }
    
    initializeCuttingPlane() {
        // 创建初始切割平面
        const position = new THREE.Vector3(0, 0, 0);
        const normal = new THREE.Vector3(1, 0, 0);

        this.activeCuttingPlane = new THREE.Plane(normal, -normal.dot(position));

        // console.log('初始化切割平面:', this.activeCuttingPlane);

        // 创建切割平面可视化
        this.createCuttingPlaneVisualization();

        // 启用切割平面TransformControls
        this.enableCuttingPlaneTransform();

        // 应用切割预览
        this.updateCuttingPlaneFromControls();
    }
    
    createCuttingPlaneVisualization() {
        // 移除现有的切割平面可视化
        const existingPlane = this.scene.getObjectByName('activeCuttingPlaneHelper');
        if (existingPlane) {
            this.scene.remove(existingPlane);
        }
        
        // 创建新的平面可视化
        const planeGeometry = new THREE.PlaneGeometry(25, 25);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.name = 'activeCuttingPlaneHelper';
        
        this.scene.add(planeMesh);
        this.updateCuttingPlaneVisualization();
    }
    
    updateCuttingPlaneVisualization() {
        const planeMesh = this.scene.getObjectByName('activeCuttingPlaneHelper');
        if (!planeMesh || !this.activeCuttingPlane) return;
        
        // 获取平面上的一个点
        const point = this.activeCuttingPlane.normal.clone().multiplyScalar(-this.activeCuttingPlane.constant);
        
        // 设置平面位置
        planeMesh.position.copy(point);
        
        // 设置平面方向
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.activeCuttingPlane.normal);
        planeMesh.setRotationFromQuaternion(quaternion);
    }
    
    updateCuttingPlaneFromControls() {
        if (!this.cuttingPlaneAdjustMode) return;
        
        // 获取精度设置
        const precisionMode = document.getElementById('precisionMode').value;
        let precision = 2;
        switch(precisionMode) {
            case 'high': precision = 3; break;
            case 'ultra': precision = 4; break;
            default: precision = 2;
        }
        
        // 获取控制值
        const posX = parseFloat(document.getElementById('cuttingPosX').value);
        const posY = parseFloat(document.getElementById('cuttingPosY').value);
        const posZ = parseFloat(document.getElementById('cuttingPosZ').value);
        
        const normalX = parseFloat(document.getElementById('cuttingNormalX').value);
        const normalY = parseFloat(document.getElementById('cuttingNormalY').value);
        const normalZ = parseFloat(document.getElementById('cuttingNormalZ').value);
        
        // 更新显示值和数值输入框
        document.getElementById('cuttingPosXValue').textContent = posX.toFixed(precision);
        document.getElementById('cuttingPosYValue').textContent = posY.toFixed(precision);
        document.getElementById('cuttingPosZValue').textContent = posZ.toFixed(precision);
        document.getElementById('cuttingNormalXValue').textContent = normalX.toFixed(precision);
        document.getElementById('cuttingNormalYValue').textContent = normalY.toFixed(precision);
        document.getElementById('cuttingNormalZValue').textContent = normalZ.toFixed(precision);
        
        // 同步数值输入框
        document.getElementById('cuttingPosXInput').value = posX.toFixed(precision);
        document.getElementById('cuttingPosYInput').value = posY.toFixed(precision);
        document.getElementById('cuttingPosZInput').value = posZ.toFixed(precision);
        document.getElementById('cuttingNormalXInput').value = normalX.toFixed(precision);
        document.getElementById('cuttingNormalYInput').value = normalY.toFixed(precision);
        document.getElementById('cuttingNormalZInput').value = normalZ.toFixed(precision);
        
        // 创建新的切割平面
        const position = new THREE.Vector3(posX, posY, posZ);
        const normal = new THREE.Vector3(normalX, normalY, normalZ);
        
        // 标准化法向量（如果不为零向量）
        if (normal.length() > 0.001) {
            normal.normalize();
        } else {
            // 如果法向量太小，使用默认的 X 轴法向量
            normal.set(1, 0, 0);
        }
        
        this.activeCuttingPlane = new THREE.Plane(normal, -normal.dot(position));
        
        // 更新可视化
        this.updateCuttingPlaneVisualization();
        
        // 同步更新TransformControls的代理对象
        if (this.cuttingPlaneProxy && this.cuttingPlaneTransform && this.cuttingPlaneTransform.visible) {
            // 更新代理对象位置
            this.cuttingPlaneProxy.position.copy(position);
            
            // 计算旋转四元数
            const defaultNormal = new THREE.Vector3(1, 0, 0);
            const currentNormal = normal.clone();
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(defaultNormal, currentNormal);
            this.cuttingPlaneProxy.setRotationFromQuaternion(quaternion);
        }
        
        // 应用切割预览
        this.previewActiveCuttingPlane();
    }
    
    previewActiveCuttingPlane() {
        if (!this.activeCuttingPlane) return;

        // 临时应用切割平面到所有图形
        this.shapes.forEach(mesh => {
            if (mesh.material) {
                const allPlanes = [...this.customClipPlanes, this.activeCuttingPlane];
                mesh.material.clippingPlanes = allPlanes;
                mesh.material.needsUpdate = true;
            }
        });

        // 临时应用切割平面到拼合组
        this.combinedShapes.forEach(group => {
            group.traverse(child => {
                if (child.isMesh && child.material) {
                    const allPlanes = [...this.clipPlanes, ...this.customClipPlanes, this.activeCuttingPlane];
                    child.material.clippingPlanes = allPlanes;
                    child.material.needsUpdate = true;
                }
            });
        });

        // 更新切割预览窗口
        if (this.cuttingPreviewMode && this.cuttingPreviewScene) {
            this.updateCuttingPreview();
        }
    }

    applyCuttingPlaneFromControls() {
         if (!this.activeCuttingPlane) return;

         // 保存所有图形的切割前状态
         const beforeStates = new Map();
         this.shapes.forEach((mesh, id) => {
             beforeStates.set(id, this.saveShapeState(mesh));
         });

         // 获取切割模式
         const capMode = document.getElementById('capMode') ? document.getElementById('capMode').value : 'seal';
         const useCSG = document.getElementById('useCSG') ? document.getElementById('useCSG').checked : false;

         if (useCSG && window.CSG && window.CSG.Evaluator) {
             // 使用CSG库进行真正的布尔切割
             this.performCSGCutting(this.activeCuttingPlane, capMode);
         } else {
             // 使用几何体切割
             this.shapes.forEach((mesh, id) => {
                 this.performGeometryCutting(mesh, this.activeCuttingPlane, capMode);
             });

             // 对拼合组进行切割
             this.combinedShapes.forEach(group => {
                 group.traverse(child => {
                     if (child.isMesh) {
                         this.performGeometryCutting(child, this.activeCuttingPlane, capMode);
                     }
                 });
             });
         }

         // 保存所有图形的切割后状态并记录历史
         const afterStates = new Map();
         this.shapes.forEach((mesh, id) => {
             afterStates.set(id, this.saveShapeState(mesh));
         });

         this.addToHistory({
             type: 'cutting',
             beforeStates: beforeStates,
             afterStates: afterStates,
             cuttingPlane: this.activeCuttingPlane.clone()
         });

         // 将切割平面添加到历史记录（用于撤销功能）
         this.customClipPlanes.push(this.activeCuttingPlane.clone());

         this.updateCuttingPlanesList();

         // 检查是否需要自动清除切割平面
         const autoClearCheckbox = document.getElementById('autoClearCuttingPlane');
         if (autoClearCheckbox && autoClearCheckbox.checked) {
             // 延迟清除，让用户看到切割完成的提示
             setTimeout(() => {
                 this.clearCuttingPlanesAuto();
             }, 1000);
             this.showTooltip('几何切割已完成，切割平面将自动清除', 2000);
         } else {
             const modeText = capMode === 'seal' ? '并封闭缺口' : '（不封闭缺口）';
             this.showTooltip(`几何切割已完成${modeText}`, 1500);
         }
     }
    
    resetCuttingPlaneControls() {
        // 重置控制值
        document.getElementById('cuttingPosX').value = 0;
        document.getElementById('cuttingPosY').value = 0;
        document.getElementById('cuttingPosZ').value = 0;
        document.getElementById('cuttingNormalX').value = 1;
        document.getElementById('cuttingNormalY').value = 0;
        document.getElementById('cuttingNormalZ').value = 0;
        
        // 更新切割平面
        this.updateCuttingPlaneFromControls();
    }
    
    // 快速设置切割方向
    setQuickCuttingDirection(axis) {
        if (!this.cuttingPlaneAdjustMode) {
            this.showTooltip('请先启用切割工具', 1500);
            return;
        }
        
        // 重置位置到原点
        document.getElementById('cuttingPosX').value = 0;
        document.getElementById('cuttingPosY').value = 0;
        document.getElementById('cuttingPosZ').value = 0;
        
        // 设置法向量
        switch(axis) {
            case 'x':
                document.getElementById('cuttingNormalX').value = 1;
                document.getElementById('cuttingNormalY').value = 0;
                document.getElementById('cuttingNormalZ').value = 0;
                this.showTooltip('已设置为X轴切割', 1000);
                break;
            case 'y':
                document.getElementById('cuttingNormalX').value = 0;
                document.getElementById('cuttingNormalY').value = 1;
                document.getElementById('cuttingNormalZ').value = 0;
                this.showTooltip('已设置为Y轴切割', 1000);
                break;
            case 'z':
                document.getElementById('cuttingNormalX').value = 0;
                document.getElementById('cuttingNormalY').value = 0;
                document.getElementById('cuttingNormalZ').value = 1;
                this.showTooltip('已设置为Z轴切割', 1000);
                break;
        }
        
        // 同步数值输入框
        document.getElementById('cuttingPosXInput').value = 0;
        document.getElementById('cuttingPosYInput').value = 0;
        document.getElementById('cuttingPosZInput').value = 0;
        document.getElementById('cuttingNormalXInput').value = document.getElementById('cuttingNormalX').value;
        document.getElementById('cuttingNormalYInput').value = document.getElementById('cuttingNormalY').value;
        document.getElementById('cuttingNormalZInput').value = document.getElementById('cuttingNormalZ').value;
        
        // 更新切割平面
        this.updateCuttingPlaneFromControls();
    }
    
    // 切割平面旋转功能
    rotateCuttingPlane(axis, angle) {
        if (!this.cuttingPlaneAdjustMode || !this.activeCuttingPlane) return;
        
        // 获取当前法向量
        const normal = this.activeCuttingPlane.normal.clone();
        
        // 创建旋转矩阵
        const rotationMatrix = new THREE.Matrix4();
        switch(axis) {
            case 'x':
                rotationMatrix.makeRotationX(angle);
                break;
            case 'y':
                rotationMatrix.makeRotationY(angle);
                break;
            case 'z':
                rotationMatrix.makeRotationZ(angle);
                break;
        }
        
        // 应用旋转到法向量
        normal.applyMatrix4(rotationMatrix);
        normal.normalize();
        
        // 更新控制器的值
        document.getElementById('cuttingNormalX').value = normal.x.toFixed(2);
        document.getElementById('cuttingNormalY').value = normal.y.toFixed(2);
        document.getElementById('cuttingNormalZ').value = normal.z.toFixed(2);
        
        // 更新切割平面
        this.updateCuttingPlaneFromControls();
    }
    
    // 初始化旋转按钮事件
    initRotationButtons() {
        const rotationSpeed = 0.05; // 旋转速度（弧度）
        const rotationInterval = 50; // 旋转间隔（毫秒）
        
        ['X', 'Y', 'Z'].forEach(axis => {
            const button = document.getElementById(`rotateCuttingPlane${axis}`);
            if (!button) return;
            
            let rotationTimer = null;
            let isRotating = false;
            
            // 鼠标按下开始旋转
            const startRotation = () => {
                if (isRotating) return;
                isRotating = true;
                
                rotationTimer = setInterval(() => {
                    this.rotateCuttingPlane(axis.toLowerCase(), rotationSpeed);
                }, rotationInterval);
                
                button.style.transform = 'scale(0.95)';
                button.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
            };
            
            // 停止旋转
            const stopRotation = () => {
                if (!isRotating) return;
                isRotating = false;
                
                if (rotationTimer) {
                    clearInterval(rotationTimer);
                    rotationTimer = null;
                }
                
                button.style.transform = 'scale(1)';
                button.style.boxShadow = 'none';
            };
            
            // 绑定事件
            button.addEventListener('mousedown', startRotation);
            button.addEventListener('mouseup', stopRotation);
            button.addEventListener('mouseleave', stopRotation);
            button.addEventListener('touchstart', startRotation);
            button.addEventListener('touchend', stopRotation);
            
            // 防止按钮获得焦点时的默认行为
            button.addEventListener('focus', (e) => e.target.blur());
        });
    }
    
    // 初始化精度控制
    initPrecisionControls() {
        // 精度模式切换
        const precisionMode = document.getElementById('precisionMode');
        if (precisionMode) {
            precisionMode.addEventListener('change', () => {
                this.updateSliderSteps();
                this.updateCuttingPlaneFromControls();
            });
        }
        
        // 数值输入框与滑块同步
        const controls = [
            { slider: 'cuttingPosX', input: 'cuttingPosXInput' },
            { slider: 'cuttingPosY', input: 'cuttingPosYInput' },
            { slider: 'cuttingPosZ', input: 'cuttingPosZInput' },
            { slider: 'cuttingNormalX', input: 'cuttingNormalXInput' },
            { slider: 'cuttingNormalY', input: 'cuttingNormalYInput' },
            { slider: 'cuttingNormalZ', input: 'cuttingNormalZInput' }
        ];
        
        controls.forEach(control => {
            const slider = document.getElementById(control.slider);
            const input = document.getElementById(control.input);
            
            if (slider && input) {
                // 滑块变化时更新输入框
                slider.addEventListener('input', () => {
                    input.value = slider.value;
                    this.updateCuttingPlaneFromControls();
                });
                
                // 输入框变化时更新滑块
                input.addEventListener('input', () => {
                    const value = parseFloat(input.value);
                    if (!isNaN(value)) {
                        const min = parseFloat(slider.min);
                        const max = parseFloat(slider.max);
                        if (value >= min && value <= max) {
                            slider.value = value;
                            this.updateCuttingPlaneFromControls();
                        }
                    }
                });
                
                // 输入框失去焦点时验证范围
                input.addEventListener('blur', () => {
                    const value = parseFloat(input.value);
                    const min = parseFloat(slider.min);
                    const max = parseFloat(slider.max);
                    if (isNaN(value) || value < min || value > max) {
                        input.value = slider.value;
                    }
                });
            }
        });
    }
    
    // 更新滑块步长
    updateSliderSteps() {
        const precisionMode = document.getElementById('precisionMode').value;
        let step = '0.01';
        switch(precisionMode) {
            case 'high': step = '0.001'; break;
            case 'ultra': step = '0.0001'; break;
            default: step = '0.01';
        }
        
        // 更新所有滑块的步长
        const sliders = [
            'cuttingPosX', 'cuttingPosY', 'cuttingPosZ',
            'cuttingNormalX', 'cuttingNormalY', 'cuttingNormalZ'
        ];
        
        sliders.forEach(sliderId => {
            const slider = document.getElementById(sliderId);
            if (slider) {
                slider.step = step;
            }
        });
        
        // 更新数值输入框的步长
        const inputs = [
            'cuttingPosXInput', 'cuttingPosYInput', 'cuttingPosZInput',
            'cuttingNormalXInput', 'cuttingNormalYInput', 'cuttingNormalZInput'
        ];
        
        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.step = step;
            }
        });
    }
    
    // 初始化帮助系统
    initHelpSystem() {
        const helpButton = document.getElementById('headerHelpBtn');
        const helpModal = document.getElementById('helpModal');
        const closeHelp = document.getElementById('closeHelp');

        if (helpButton && helpModal && closeHelp) {
            // 帮助按钮点击事件
            helpButton.addEventListener('click', () => {
                helpModal.style.display = 'flex';
                document.body.style.overflow = 'hidden'; // 防止背景滚动
            });
            
            // 关闭按钮点击事件
            closeHelp.addEventListener('click', () => {
                helpModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
            
            // 点击背景关闭弹窗
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    helpModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            });
            
            // ESC键关闭弹窗
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && helpModal.style.display === 'block') {
                    helpModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            });
            
            // 帮助按钮悬停效果
            helpButton.addEventListener('mouseenter', () => {
                helpButton.style.transform = 'scale(1.1)';
                helpButton.style.boxShadow = '0 4px 15px rgba(0,123,255,0.4)';
            });
            
            helpButton.addEventListener('mouseleave', () => {
                helpButton.style.transform = 'scale(1)';
                helpButton.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            });
        }
    }

    // 初始化标签页
    initTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        const sidebarIcons = document.querySelectorAll('.sidebar-icons .icon-btn');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.switchTab(tabId, tabBtns, tabPanels);
            });
        });

        sidebarIcons.forEach(icon => {
            icon.addEventListener('click', () => {
                const tabId = icon.dataset.tab;
                // 展开侧边栏并切换标签
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.remove('collapsed');
                    const toggleSpan = document.querySelector('.sidebar-toggle span');
                    if (toggleSpan) toggleSpan.textContent = '◀';
                }
                this.switchTab(tabId, tabBtns, tabPanels);
            });
        });
    }

    switchTab(tabId, tabBtns, tabPanels) {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        const activePanel = document.getElementById(`tab-${tabId}`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activePanel) activePanel.classList.add('active');
    }

    // 初始化侧边栏收起
    initSidebar() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                const toggleSpan = sidebarToggle.querySelector('span');
                if (toggleSpan) {
                    toggleSpan.textContent = isCollapsed ? '▶' : '◀';
                }
            });
        }
    }

    exitCuttingAdjustMode() {
        // 禁用切割平面TransformControls
        this.disableCuttingPlaneTransform();
        
        // 移除切割平面可视化
        const planeMesh = this.scene.getObjectByName('activeCuttingPlaneHelper');
        if (planeMesh) {
            this.scene.remove(planeMesh);
        }
        
        // 恢复原始材质（移除预览效果）
        this.shapes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.clippingPlanes = this.customClipPlanes;
                mesh.material.needsUpdate = true;
            }
        });
        
        this.activeCuttingPlane = null;
         this.cuttingPlaneAdjustMode = false;
     }
     
     addShape(shapeType) {
         if (!shapeType) {
             shapeType = document.getElementById('shapeSelect').value;
         }
         this.createShape(shapeType);
         this.showTooltip(`已添加${this.getShapeTypeName(shapeType)}`, 1500);
     }
     
     getShapeTypeName(shapeType) {
         const names = {
             'cube': '立方体',
             'sphere': '球体',
             'cylinder': '圆柱体',
             'cone': '圆锥体',
             'pyramid': '四角锥',
             'torus': '环形体',
             'dodecahedron': '十二面体',
             'icosahedron': '二十面体'
         };
         return names[shapeType] || '图形';
     }
     
     lockCombination() {
         if (this.shapes.size < 2) {
             this.showTooltip('至少需要2个图形才能进行拼合锁定', 2000);
             return;
         }
         
         if (this.isLocked) {
             this.unlockCombination();
             return;
         }
         
         // 创建拼合组
         const combinedGroup = new THREE.Group();
         combinedGroup.name = 'combinedShapes';
         
         // 将所有图形添加到组中
         const shapesToCombine = Array.from(this.shapes.values());
         shapesToCombine.forEach(shape => {
             // 保存原始位置
             shape.userData.originalPosition = shape.position.clone();
             shape.userData.originalRotation = shape.rotation.clone();
             
             // 从场景中移除并添加到组中
             this.scene.remove(shape);
             combinedGroup.add(shape);
         });
         
         // 将组添加到场景
         this.scene.add(combinedGroup);
         
         // 更新状态
         this.isLocked = true;
         this.combinedShapes.set('main', combinedGroup);
         
         // 更新按钮文本
         const btn = document.getElementById('lockCombination');
         if (btn) {
             btn.textContent = '解除锁定';
             btn.style.background = 'linear-gradient(45deg, #ff4757, #ff3838)';
         }
         
         // 应用截面和切割效果到拼合组
         this.applyCuttingToGroup(combinedGroup);
         
         this.showTooltip('图形已拼合锁定，现在作为一个整体受到截面和切割影响', 3000);
         this.updateShapesList();
     }
     
     unlockCombination() {
         const combinedGroup = this.scene.getObjectByName('combinedShapes');
         if (!combinedGroup) return;
         
         // 将图形从组中移除并重新添加到场景
         const shapesToRestore = [];
         combinedGroup.children.forEach(shape => {
             shapesToRestore.push(shape);
         });
         
         shapesToRestore.forEach(shape => {
             combinedGroup.remove(shape);
             this.scene.add(shape);
             
             // 恢复原始变换（如果需要）
             if (shape.userData.originalPosition) {
                 // 可以选择是否恢复原始位置
                 // shape.position.copy(shape.userData.originalPosition);
                 // shape.rotation.copy(shape.userData.originalRotation);
             }
         });
         
         // 移除组
         this.scene.remove(combinedGroup);
         this.combinedShapes.delete('main');
         
         // 更新状态
         this.isLocked = false;
         
         // 更新按钮文本
         const btn = document.getElementById('lockCombination');
         if (btn) {
             btn.textContent = '拼合锁定';
             btn.style.background = 'linear-gradient(45deg, #ffa502, #ff6348)';
         }
         
         this.showTooltip('拼合锁定已解除，图形恢复独立状态', 2000);
         this.updateShapesList();
     }
     
     applyCuttingToGroup(group) {
         // 为拼合组中的所有图形应用切割平面
         group.traverse((child) => {
             if (child.isMesh && child.material) {
                 child.material.clippingPlanes = this.customClipPlanes;
                 child.material.needsUpdate = true;
             }
         });
     }
     
     // ... existing code ...
     
     updateMousePosition(event) {
         // 获取渲染器画布的边界
         const rect = this.renderer.domElement.getBoundingClientRect();
         
         // 计算相对于画布的鼠标位置
         this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
         this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
     }
     
       handleMouseDown(event) {
           if (event.button !== 0) return; // 只处理左键

           this.updateMousePosition(event);
           this.raycaster.setFromCamera(this.mouse, this.camera);

           // 获取所有可拖拽的对象
            const draggableObjects = [];
            this.shapes.forEach(mesh => {
                draggableObjects.push(mesh);
            });

            // 添加拼合组到可拖拽对象
            this.combinedShapes.forEach(group => {
                draggableObjects.push(group);
            });

           const intersects = this.raycaster.intersectObjects(draggableObjects);

           if (intersects.length > 0) {
               const selectedObject = intersects[0].object;

               // 检查图形是否被锁定
               if (selectedObject.userData.locked) {
                   this.showTooltip('该图形已锁定，无法移动或变换', 2000);
                   return;
               }

               // 启用拖拽功能（不是TransformControls的直接拖拽）
               if (selectedObject !== this.selectedShape) {
                   this.isDragging = true;
                   this.selectedShape = selectedObject;

                  // 保存拖拽开始时的状态
                  this.dragStartState = this.saveShapeState(selectedObject);

                  // 禁用轨道控制器
                  this.controls.enabled = false;

                  // 保存原始缩放值
                  if (!selectedObject.userData.originalScale) {
                      selectedObject.userData.originalScale = selectedObject.scale.clone();
                  }

                  // 计算拖拽平面
                  const objectCenter = selectedObject.position.clone();
                  const cameraDirection = new THREE.Vector3();
                  this.camera.getWorldDirection(cameraDirection);
                  this.dragPlane = new THREE.Plane(cameraDirection, -cameraDirection.dot(objectCenter));

                  // 记录初始拖拽点和图形位置的偏移
                  const intersectionPoint = intersects[0].point;
                  this.dragOffset = objectCenter.clone().sub(intersectionPoint);

                  // 选中图形（显示TransformControls）
                  this.selectShape(selectedObject);

                  event.preventDefault();
                  return;
              }
          }
      }
     
      handleMouseMove(event) {
          // 直接拖拽逻辑
          if (!this.isDragging || !this.selectedShape) return;

          this.updateMousePosition(event);
          this.raycaster.setFromCamera(this.mouse, this.camera);

          // 计算与拖拽平面的交点
          const intersectionPoint = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint)) {
              // 使用偏移量来计算新位置
              const newPosition = intersectionPoint.clone().add(this.dragOffset);

              // 计算图形的边界框以确保完全在网格范围内
              const box = new THREE.Box3().setFromObject(this.selectedShape);
              const size = box.getSize(new THREE.Vector3());

              // 计算安全的移动范围
              const halfSizeX = size.x / 2;
              const halfSizeZ = size.z / 2;
              const gridSize = 20;
              const margin = 0.5;

               // 限制图形在网格范围内移动
               newPosition.x = Math.max(halfSizeX + margin, Math.min(gridSize - halfSizeX - margin, newPosition.x));
               const minY = size.y / 2;
               const maxY = gridSize;
               newPosition.y = Math.max(minY, Math.min(maxY - size.y / 2, newPosition.y));
               newPosition.z = Math.max(halfSizeZ + margin, Math.min(gridSize - halfSizeZ - margin, newPosition.z));

               this.selectedShape.position.copy(newPosition);

               // 限制图形位置，确保不低于网格
               this.constrainShapePosition(this.selectedShape);

              // 确保图形的缩放不变
              if (this.selectedShape.userData.originalScale) {
                  this.selectedShape.scale.copy(this.selectedShape.userData.originalScale);
              } else {
                  this.selectedShape.userData.originalScale = this.selectedShape.scale.clone();
              }

              // 更新选择框
              const selectionBox = this.scene.getObjectByName('selectionBox');
              if (selectionBox) {
                  this.scene.remove(selectionBox);
                  const newBox = new THREE.BoxHelper(this.selectedShape, 0xffff00);
                  newBox.name = 'selectionBox';
                  this.scene.add(newBox);
              }

              // 更新图形信息显示
              this.updateShapeInfo(this.selectedShape);

              // 同步更新位置滑块
              ['posX', 'posY', 'posZ'].forEach(id => {
                  const slider = document.getElementById(id);
                  const valueDisplay = document.getElementById(id + 'Value');
                  if (slider && valueDisplay) {
                      const axis = { 'posX': 'x', 'posY': 'y', 'posZ': 'z' }[id];
                      slider.value = this.selectedShape.position[axis];
                      valueDisplay.textContent = this.selectedShape.position[axis].toFixed(1);
                  }
              });
          }

          event.preventDefault();
      }
     
      handleMouseUp(event) {
          if (this.isDragging) {
              // 记录移动操作到历史
              if (this.selectedShape && this.dragStartState) {
                  const endState = this.saveShapeState(this.selectedShape);
                  this.addToHistory({
                      type: 'move',
                      shapeId: this.selectedShape.userData.id,
                      beforeState: this.dragStartState,
                      afterState: endState
                  });
              }

              this.isDragging = false;
              this.dragPlane = null;
              this.dragOffset = null;
              this.dragStartState = null;

              // 重新启用轨道控制器（但在拖动TransformControls时会被禁用）
              this.controls.enabled = true;
          }
      }
     
      handleMouseClick(event) {
           // 如果刚刚完成拖拽，不处理点击事件
           if (this.isDragging) return;

           // 变形模式下，由 handleDeformationClick 处理点击
           if (this.deformationMode) return;

           this.updateMousePosition(event);
           this.raycaster.setFromCamera(this.mouse, this.camera);
           const intersects = this.raycaster.intersectObjects(Array.from(this.shapes.values()));

           if (intersects.length > 0) {
               // 检查图形是否被锁定
               if (intersects[0].object.userData.locked) {
                   this.showTooltip('该图形已锁定，无法选中或修改', 2000);
                   return;
               }

               if (this.cuttingMode) {
                   this.handleCuttingClick(intersects);
               } else {
                   // 如果点击的不是已选中的图形，则选中它
                   if (intersects[0].object !== this.selectedShape) {
                       this.selectShape(intersects[0].object);
                   }
               }
           } else {
               // 点击空白区域，取消选择（但检查是否点击了TransformControls）
               // TransformControls会自己处理点击，所以这里不需要额外处理
               if (!this.cuttingMode) {
                   this.deselectShape();
               }
           }
       }

    selectShape(mesh) {
        // 检查图形是否被锁定
        if (mesh.userData.locked) {
            this.showTooltip('该图形已锁定，无法选中或修改', 2000);
            return;
        }

        // 取消之前的选择
        this.deselectShape();

        this.selectedShape = mesh;

        // 确保图形有保存的原始缩放值
        if (!mesh.userData.originalScale) {
            mesh.userData.originalScale = mesh.scale.clone();
        }

        // 添加选择框
        const box = new THREE.BoxHelper(mesh, 0xffff00);
        box.name = 'selectionBox';
        this.scene.add(box);

        // 使用TransformControls附加到选中图形并设置为平移模式
        if (this.transformControls) {
            // 先分离之前的对象（如果有）
            this.transformControls.detach();
            // 附加到新对象
            this.transformControls.attach(mesh);
            this.transformControls.setMode('translate');
            this.transformControls.enabled = true;
            this.transformControls.visible = true;
        }

        // 更新UI显示选中的图形信息
        this.updateShapeInfo(mesh);

        // 显示位置控制面板并更新滑块值
        this.showShapePositionControls(mesh);

        // 显示大小控制面板并更新滑块值
        this.showShapeSizeControls(mesh);

        // 显示材质控制面板
        this.showMaterialControls(mesh);

        // 显示几何参数控制面板
        this.showGeometryControls();
    }
    
    deselectShape() {
        if (this.selectedShape) {
            // 如果在变形编辑模式下，退出变形编辑模式
            if (this.deformationMode) {
                this.exitDeformationMode();
            }

            // 移除选择框
            const selectionBox = this.scene.getObjectByName('selectionBox');
            if (selectionBox) this.scene.remove(selectionBox);

            // 分离TransformControls并隐藏
            if (this.transformControls) {
                this.transformControls.detach();
                this.transformControls.enabled = false;
                this.transformControls.visible = false;
            }

            // 隐藏位置和大小控制面板
            this.hideShapePositionControls();
            this.hideShapeSizeControls();

            // 隐藏材质控制和几何参数控制面板
            this.hideMaterialControls();
            this.hideGeometryControls();

            this.selectedShape = null;

            // 隐藏位置控制面板
            this.hideShapePositionControls();

            // 隐藏大小控制面板
            this.hideShapeSizeControls();
        }
    }
    
    updateShapeInfo(mesh) {
        const info = document.getElementById('shapeInfo');
        if (info) {
            info.innerHTML = `
                <strong>选中图形:</strong> ${mesh.userData.type}<br>
                <strong>位置:</strong> (${mesh.position.x.toFixed(1)}, ${mesh.position.y.toFixed(1)}, ${mesh.position.z.toFixed(1)})<br>
                <strong>ID:</strong> ${mesh.userData.id}
            `;
        }
    }
    
    showTooltip(message, duration = 2000) {
        // 移除现有的提示
        const existingTooltip = document.getElementById('tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // 创建新的提示
        const tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.textContent = message;
        tooltip.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            pointer-events: none;
            animation: fadeInOut ${duration}ms ease-in-out;
        `;
        
        // 添加CSS动画
        if (!document.getElementById('tooltip-style')) {
            const style = document.createElement('style');
            style.id = 'tooltip-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(tooltip);
        
        // 自动移除
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.remove();
            }
        }, duration);
    }
    
    handleCuttingClick(intersects) {
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const normal = intersects[0].face.normal.clone();
            normal.transformDirection(intersects[0].object.matrixWorld);
            
            this.createCuttingPlane(point, normal);
            this.enterCuttingConfirmMode();
        } else {
            // 如果没有点击到图形，显示提示
            this.showTooltip('请点击图形表面来创建切割平面', 2000);
        }
    }
    

    createCuttingPlane(point, normal) {
        // 标准化法向量
        normal.normalize();
        
        // 创建切割平面
        const plane = new THREE.Plane(normal, -normal.dot(point));
        this.cuttingPlane = plane;
        
        // 创建平面可视化
        const planeGeometry = new THREE.PlaneGeometry(25, 25);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.name = `cuttingPlaneHelper_${this.customClipPlanes.length}`;
        
        // 正确设置平面位置和方向
        planeMesh.position.copy(point);
        
        // 使用四元数来正确设置平面方向
        const up = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(up, normal);
        planeMesh.setRotationFromQuaternion(quaternion);
        
        // 为待确认的切割平面设置特殊名称
        planeMesh.name = `cuttingPlaneHelper_pending`;
        
        this.scene.add(planeMesh);
    }
    
    enterCuttingConfirmMode() {
        if (!this.cuttingPlane) return;
        
        this.pendingCuttingPlane = this.cuttingPlane;
        this.cuttingConfirmMode = true;
        this.cuttingMode = false; // 退出切割模式
        
        // 更新UI显示确认按钮
        this.showCuttingConfirmDialog();
        
        // 临时应用切割预览
        this.previewCutting();
    }
    
    previewCutting() {
        if (!this.pendingCuttingPlane) return;
        
        // 临时应用切割平面到所有图形
        this.shapes.forEach(mesh => {
            if (mesh.material) {
                const allPlanes = [...this.customClipPlanes, this.pendingCuttingPlane];
                mesh.material.clippingPlanes = allPlanes;
                mesh.material.needsUpdate = true;
            }
        });
        
        // 临时应用切割平面到拼合组
        this.combinedShapes.forEach(group => {
            group.traverse(child => {
                if (child.isMesh && child.material) {
                    const allPlanes = [...this.customClipPlanes, this.pendingCuttingPlane];
                    child.material.clippingPlanes = allPlanes;
                    child.material.needsUpdate = true;
                }
            });
        });
    }
    
    // 保留原有的applyCutting方法以兼容其他调用
    applyCutting() {
        this.applyCuttingWithDirection(false);
    }
    
    cancelCutting() {
        // 移除切割平面预览
        if (this.pendingCuttingPlane) {
            // 移除切割平面可视化
            const planeMesh = this.scene.getObjectByName(`cuttingPlaneHelper_pending`);
            if (planeMesh) {
                this.scene.remove(planeMesh);
            }
            
            // 恢复原始材质
            this.shapes.forEach(mesh => {
                if (mesh.material) {
                    mesh.material.clippingPlanes = this.customClipPlanes;
                    mesh.material.needsUpdate = true;
                }
            });
        }
        
        this.exitCuttingConfirmMode();
    }
    
    exitCuttingConfirmMode() {
        this.pendingCuttingPlane = null;
        this.cuttingPlane = null;
        this.cuttingConfirmMode = false;
        this.hideCuttingConfirmDialog();
        
        // 更新切割按钮状态
        const btn = document.getElementById('toggleCutting');
        if (btn) {
            btn.classList.remove('mode-active');
            btn.textContent = '切割工具';
        }
        
        // 恢复鼠标指针
        this.renderer.domElement.style.cursor = 'default';
    }
    
    showCuttingConfirmDialog() {
        // 移除现有的对话框
        this.hideCuttingConfirmDialog();
        
        // 创建确认对话框
        const dialog = document.createElement('div');
        dialog.id = 'cuttingConfirmDialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #007bff;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            min-width: 300px;
            text-align: center;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #333;">切割确认</h3>
            <p style="margin: 0 0 20px 0; color: #666;">请选择要保留的部分：</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="keepFrontPart" style="
                    padding: 10px 20px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">保留前半部分</button>
                <button id="keepBackPart" style="
                    padding: 10px 20px;
                    background: #17a2b8;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">保留后半部分</button>
                <button id="cancelCutting" style="
                    padding: 10px 20px;
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">取消</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 添加事件监听器
        document.getElementById('keepFrontPart').addEventListener('click', () => {
            this.applyCuttingWithDirection(false); // 保留前半部分（不翻转平面）
        });
        
        document.getElementById('keepBackPart').addEventListener('click', () => {
            this.applyCuttingWithDirection(true); // 保留后半部分（翻转平面）
        });
        
        document.getElementById('cancelCutting').addEventListener('click', () => {
            this.cancelCutting();
        });
    }
    
    hideCuttingConfirmDialog() {
        const dialog = document.getElementById('cuttingConfirmDialog');
        if (dialog) {
            dialog.remove();
        }
    }
    
    applyCuttingWithDirection(flipPlane) {
        if (!this.pendingCuttingPlane) return;
        
        let finalPlane = this.pendingCuttingPlane.clone();
        
        if (flipPlane) {
            // 翻转平面法向量以保留另一半
            finalPlane.normal.negate();
            finalPlane.constant = -finalPlane.constant;
        }
        
        // 保存所有图形的切割前状态
        const beforeStates = new Map();
        this.shapes.forEach((mesh, id) => {
            beforeStates.set(id, this.saveShapeState(mesh));
        });
        
        // 对所有图形进行真正的几何切割
        this.shapes.forEach((mesh, id) => {
            this.performGeometryCutting(mesh, finalPlane);
        });
        
        // 对拼合组进行切割
        this.combinedShapes.forEach(group => {
            group.traverse(child => {
                if (child.isMesh) {
                    this.performGeometryCutting(child, finalPlane);
                }
            });
        });
        
        // 保存所有图形的切割后状态并记录历史
        const afterStates = new Map();
        this.shapes.forEach((mesh, id) => {
            afterStates.set(id, this.saveShapeState(mesh));
        });
        
        this.addToHistory({
            type: 'cutting',
            beforeStates: beforeStates,
            afterStates: afterStates,
            cuttingPlane: finalPlane.clone()
        });
        
        // 将切割平面添加到历史记录（用于撤销功能）
        this.customClipPlanes.push(finalPlane);
        
        this.updateCuttingPlanesList();
        this.exitCuttingConfirmMode();
        
        // 检查是否需要自动清除切割平面
        const autoClearCheckbox = document.getElementById('autoClearCuttingPlane');
        if (autoClearCheckbox && autoClearCheckbox.checked) {
            // 延迟清除，让用户看到切割完成的提示
            setTimeout(() => {
                this.clearCuttingPlanesAuto();
            }, 1000);
            this.showTooltip('几何切割已完成，切割平面将自动清除', 2000);
        } else {
            this.showTooltip('几何切割已完成', 1500);
        }
    }

    toggleCuttingMode() {
        // 检查是否有图形存在
        if (!this.cuttingPlaneAdjustMode && this.shapes.size === 0) {
            this.showTooltip('请先创建一些图形再使用切割工具', 2000);
            return;
        }

        this.cuttingPlaneAdjustMode = !this.cuttingPlaneAdjustMode;
        this.cuttingMode = false; // 禁用点击切割模式

        const btn = document.getElementById('toggleCutting');
        const controls = document.getElementById('cuttingPlaneControls');

        if (btn && controls) {
            if (this.cuttingPlaneAdjustMode) {
                btn.classList.add('mode-active');
                btn.textContent = '退出切割调整';
                controls.style.display = 'block';
                this.initializeCuttingPlane();
                this.showTooltip('切割平面调整模式已激活', 2000);
            } else {
                btn.classList.remove('mode-active');
                btn.textContent = '切割工具';
                controls.style.display = 'none';
                this.exitCuttingAdjustMode();
            }
        }
    }

    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        
        if (this.gridHelper) {
            this.gridHelper.visible = this.gridVisible;
        }
        
        if (this.axesHelper) {
            this.axesHelper.visible = this.gridVisible;
        }
        
        const btn = document.getElementById('toggleGrid');
        if (btn) {
            btn.textContent = this.gridVisible ? '隐藏网格' : '显示网格';
        }
        
        this.showTooltip(this.gridVisible ? '网格已显示' : '网格已隐藏', 1500);
    }
    
    updateModeButtons() {
        // 更新切割模式按钮
        const cuttingBtn = document.getElementById('toggleCutting');
        if (cuttingBtn && !this.cuttingMode) {
            cuttingBtn.classList.remove('mode-active');
            cuttingBtn.textContent = '切割工具';
        }
    }
    
    clearCuttingPlanes() {
        // 显示警告信息
        if (this.customClipPlanes.length > 0) {
            const confirmed = confirm('注意：已应用的几何切割是永久性的，清除切割平面记录不会恢复已被切割的图形。是否继续？');
            if (!confirmed) {
                return;
            }
        }
        
        // 移除所有自定义切割平面记录
        this.customClipPlanes = [];
        this.cuttingPlane = null;
        
        // 移除所有切割平面可视化
        const objectsToRemove = [];
        this.scene.traverse((child) => {
            if (child.name && child.name.startsWith('cuttingPlaneHelper')) {
                objectsToRemove.push(child);
            }
        });
        objectsToRemove.forEach(obj => this.scene.remove(obj));
        
        this.updateCuttingPlanesList();
        this.showTooltip('切割平面记录已清除（已切割的几何体保持不变）', 2000);
    }
    
    clearCuttingPlanesAuto() {
        // 自动清除切割平面，不显示确认对话框
        // 移除所有自定义切割平面记录
        this.customClipPlanes = [];
        this.cuttingPlane = null;
        
        // 移除所有切割平面可视化
        const objectsToRemove = [];
        this.scene.traverse((child) => {
            if (child.name && child.name.startsWith('cuttingPlaneHelper')) {
                objectsToRemove.push(child);
            }
        });
        objectsToRemove.forEach(obj => this.scene.remove(obj));
        
        this.updateCuttingPlanesList();
        this.showTooltip('切割平面已自动清除', 1000);
    }

    // 计算网格体积（使用three-bvh-csg的computeMeshVolume函数）
    computeMeshVolume(mesh) {
        if (window.CSG && window.CSG.computeMeshVolume) {
            try {
                mesh.updateMatrixWorld(); // 确保世界矩阵是最新的
                const volume = window.CSG.computeMeshVolume(mesh);
                return Math.abs(volume);
            } catch (error) {
                console.error('计算体积失败:', error);
                return 0;
            }
        } else {
            // 备用方法：使用包围盒近似计算
            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3());
            return size.x * size.y * size.z;
        }
    }

    // 计算所有图形的总体积
    computeTotalVolume() {
        let totalVolume = 0;
        this.shapes.forEach((mesh) => {
            const volume = this.computeMeshVolume(mesh);
            totalVolume += volume;
        });
        return totalVolume;
    }
     
     // 重新居中几何体，使其位置与几何体中心对齐
     recenterGeometry(mesh) {
         if (!mesh || !mesh.geometry) return;

         // 计算几何体的边界框
         mesh.geometry.computeBoundingBox();
         const boundingBox = mesh.geometry.boundingBox;
         const center = new THREE.Vector3();
         boundingBox.getCenter(center);

         // 如果中心不在原点，需要调整
         if (center.length() > 0.001) {
             // 将几何体的所有顶点平移，使中心位于原点
             const positions = mesh.geometry.attributes.position;
             for (let i = 0; i < positions.count; i++) {
                 const x = positions.getX(i) - center.x;
                 const y = positions.getY(i) - center.y;
                 const z = positions.getZ(i) - center.z;
                 positions.setXYZ(i, x, y, z);
             }

             // 更新几何体的边界框和包围球
             mesh.geometry.computeBoundingBox();
             mesh.geometry.computeBoundingSphere();

             // 更新mesh的position，使其保持在原来的世界位置
             mesh.position.add(center);

             // 更新矩阵
             mesh.updateMatrix();
             mesh.updateMatrixWorld();
         }
     }
     
     // 优化BufferGeometry
    optimizeGeometry(geometry) {
        try {
            // 转换为非索引几何体（如果有必要）
            if (geometry.index) {
                const nonIndexed = geometry.toNonIndexed();
                geometry.copy(nonIndexed);
                nonIndexed.dispose();
            }

            // 清理不需要的属性
            const attributes = geometry.attributes;
            const requiredAttributes = ['position', 'normal'];

            for (let i = attributes.length - 1; i >= 0; i--) {
                const attributeName = attributes[i].name;
                if (!requiredAttributes.includes(attributeName)) {
                    geometry.deleteAttribute(attributeName);
                }
            }

            // 合并相近顶点（Three.js r150+ 使用 BufferGeometryUtils.mergeVertices）
            // 如果 BufferGeometryUtils 不可用，跳过此步骤
            if (typeof THREE.BufferGeometryUtils !== 'undefined' && THREE.BufferGeometryUtils.mergeVertices) {
                geometry = THREE.BufferGeometryUtils.mergeVertices(geometry);
            }

            // 重新计算法线
            geometry.computeVertexNormals();

            // 更新包围盒和球
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();

            return geometry;
        } catch (error) {
            console.error('几何体优化失败:', error);
            return geometry;
        }
    }

    // 验证几何体是否为water-tight（无孔洞，两面性）
    isGeometryWatertight(geometry) {
        if (window.CSG && window.CSG.isWaterTight) {
            try {
                return window.CSG.isWaterTight(geometry);
            } catch (error) {
                console.warn('water-tight检查失败:', error);
                return false;
            }
        }
        return true;
    }

    // 更新图形信息（包含体积信息）
    updateShapeInfo(mesh) {
        const info = document.getElementById('shapeInfo');
        if (info) {
            const volume = this.computeMeshVolume(mesh);
            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3());

            info.innerHTML = `
                <strong>选中图形:</strong> ${mesh.userData.type}<br>
                <strong>位置:</strong> (${mesh.position.x.toFixed(1)}, ${mesh.position.y.toFixed(1)}, ${mesh.position.z.toFixed(1)})<br>
                <strong>ID:</strong> ${mesh.userData.id}<br>
                <strong>尺寸:</strong> ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}<br>
                <strong>体积:</strong> ${volume.toFixed(3)} 立方单位
            `;
        }
    }
    
    updateCuttingPlanesList() {
        const list = document.getElementById('cuttingPlanesList');
        if (list) {
            list.innerHTML = '';
            this.customClipPlanes.forEach((plane, index) => {
                const item = document.createElement('div');
                item.className = 'cutting-plane-item';
                item.innerHTML = `
                    <span>切割平面 #${index + 1}</span>
                    <button onclick="viewer.removeCuttingPlane(${index})">删除</button>
                `;
                list.appendChild(item);
            });
        }
    }
    
    removeCuttingPlane(index) {
        if (index >= 0 && index < this.customClipPlanes.length) {
            const confirmed = confirm('注意：删除切割平面记录不会恢复已被切割的图形几何体。是否继续？');
            if (!confirmed) {
                return;
            }
            
            this.customClipPlanes.splice(index, 1);
            this.updateCuttingPlanesList();
            this.showTooltip('切割平面记录已删除（已切割的几何体保持不变）', 2000);
        }
    }

    // 限制图形位置，确保图形不会低于网格线（y=0）
    constrainShapePosition(mesh) {
        if (!mesh || !mesh.geometry) return;

        // 计算几何体的边界框
        const box = new THREE.Box3().setFromObject(mesh);
        const minY = box.min.y;

        // 如果图形底部低于网格线（y=0），调整位置
        if (minY < 0) {
            const offset = -minY;
            mesh.position.y += offset;
        }
    }
    
    createShape(shapeType, position = null) {
        // console.log('createShape被调用，类型:', shapeType);
        let geometry;
        let shapeHeight = 2; // 默认高度
        
        switch (shapeType) {
            case 'cube':
                geometry = new THREE.BoxGeometry(2, 2, 2);
                shapeHeight = 2;
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(1.5, 32, 32);
                shapeHeight = 3; // 直径
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(1, 1, 3, 32);
                shapeHeight = 3;
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(1.5, 3, 32);
                shapeHeight = 3;
                break;
            case 'pyramid':
                geometry = new THREE.ConeGeometry(1.5, 3, 4);
                shapeHeight = 3;
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(1.5, 0.5, 16, 100);
                shapeHeight = 1; // 环面高度较小
                break;
            case 'dodecahedron':
                geometry = new THREE.DodecahedronGeometry(1.5);
                shapeHeight = 3; // 近似高度
                break;
            case 'icosahedron':
                geometry = new THREE.IcosahedronGeometry(1.5);
                shapeHeight = 3; // 近似高度
                break;
            default:
                geometry = new THREE.BoxGeometry(2, 2, 2);
                shapeHeight = 2;
        }
        
        // 如果没有指定位置，计算安全的默认位置
        if (!position) {
            // 确保图形底部不低于网格，顶部不超出合理范围
            const safeY = Math.max(shapeHeight / 2, 1); // 至少离地面1单位
            // 在网格中心附近随机放置，避免重叠
            const offsetX = (Math.random() - 0.5) * 6; // -3到3的随机偏移
            const offsetZ = (Math.random() - 0.5) * 6; // -3到3的随机偏移
            position = new THREE.Vector3(10 + offsetX, safeY, 10 + offsetZ);
            
            // 确保位置在网格范围内（留出边距）
            position.x = Math.max(2, Math.min(18, position.x));
            position.z = Math.max(2, Math.min(18, position.z));
        }
        
        const material = this.createMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // 优化几何体以提高性能
        const optimizedGeometry = this.optimizeGeometry(geometry);
        mesh.geometry = optimizedGeometry;

        // 重新居中几何体，确保TransformControls正确显示
        this.recenterGeometry(mesh);

        // 添加用户数据
        mesh.userData = {
            id: ++this.shapeCounter,
            type: shapeType,
            name: this.generateUniqueName(shapeType),
            created: new Date().toLocaleTimeString(),
            originalScale: mesh.scale.clone(), // 保存原始缩放值
            isRainbow: material.userData && material.userData.isRainbow, // 标记是否为彩虹颜色
            ownMaterial: true, // 标记为拥有独立材质
            locked: false // 默认为未锁定状态
        };

        // 应用所有切割平面
        mesh.material.clippingPlanes = this.customClipPlanes;

        this.shapes.set(mesh.userData.id, mesh);
        this.scene.add(mesh);

        // 限制图形位置，确保不低于网格
        this.constrainShapePosition(mesh);

        // 记录操作历史
        this.addToHistory('create', { shapeId: mesh.userData.id, type: shapeType, position });

        this.updateShapesList();
        return mesh;
    }

    getChineseTypeName(type) {
        return this.shapeTypeNames[type] || type;
    }

    generateUniqueName(baseType) {
        const chineseName = this.getChineseTypeName(baseType);
        const existingNames = new Set();

        this.shapes.forEach((mesh) => {
            if (mesh.userData.name) {
                existingNames.add(mesh.userData.name);
            }
        });

        let counter = 1;
        let uniqueName;

        do {
            uniqueName = `${chineseName}${counter}`;
            counter++;
        } while (existingNames.has(uniqueName));

        return uniqueName;
    }

    renameShape(id) {
        const mesh = this.shapes.get(id);
        if (!mesh) return;

        const currentName = mesh.userData.name || this.getChineseTypeName(mesh.userData.type);
        const newName = prompt('请输入新的图形名称：', currentName);

        if (newName === null) return;

        if (!newName || newName.trim() === '') {
            alert('名称不能为空！');
            return;
        }

        const trimmedName = newName.trim();

        const existingNames = new Set();
        this.shapes.forEach((mesh, meshId) => {
            if (meshId !== id && mesh.userData.name) {
                existingNames.add(mesh.userData.name);
            }
        });

        if (existingNames.has(trimmedName)) {
            const resolvedName = this.resolveNameConflict(trimmedName);
            if (confirm(`名称 "${trimmedName}" 已存在。是否使用 "${resolvedName}" 作为新名称？`)) {
                mesh.userData.name = resolvedName;
                this.updateShapesList();
                this.showTooltip(`图形已重命名为 "${resolvedName}"`, 1500);
            }
        } else {
            mesh.userData.name = trimmedName;
            this.updateShapesList();
            this.showTooltip(`图形已重命名为 "${trimmedName}"`, 1500);
        }
    }

    resolveNameConflict(baseName) {
        const existingNames = new Set();
        this.shapes.forEach((mesh) => {
            if (mesh.userData.name) {
                existingNames.add(mesh.userData.name);
            }
        });

        let counter = 1;
        let uniqueName;

        do {
            uniqueName = `${baseName}${counter}`;
            counter++;
        } while (existingNames.has(uniqueName));

        return uniqueName;
    }

    createMaterial() {
        const colorSelect = document.getElementById('colorSelect');
        const selectedColor = colorSelect.value;

        let color;
        switch (selectedColor) {
            case 'red': color = 0xff4757; break;
            case 'green': color = 0x2ed573; break;
            case 'purple': color = 0x5352ed; break;
            case 'orange': color = 0xff6348; break;
            case 'rainbow': color = 0x00d2d3; break;
            default: color = 0x3742fa;
        }

        let material;

        if (this.isMobile) {
            // 移动设备使用优化的材质，但启用双面渲染以支持裁剪平面
            material = new THREE.MeshPhongMaterial({
                color: color,
                transparent: false,
                opacity: 1.0,
                side: THREE.DoubleSide, // 双面渲染，确保裁剪平面显示完整
                flatShading: false,
                shininess: 60, // 增加光泽度
                specular: 0x444444,
                clipShadows: true, // 启用阴影裁剪
                shadowSide: THREE.DoubleSide // 阴影也使用双面
            });
        } else {
            // 桌面设备使用高质量材质
            material = new THREE.MeshPhysicalMaterial({
                color: color,
                metalness: 0.15, // 轻微金属感
                roughness: 0.25, // 较光滑的表面
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide,
                flatShading: false,
                clearcoat: 0.3, // 清漆层，增加真实感
                clearcoatRoughness: 0.25,
                reflectivity: 0.5,
                envMapIntensity: 1.0,
                clipShadows: true, // 启用阴影裁剪
                shadowSide: THREE.DoubleSide // 阴影也使用双面
            });
        }

        if (selectedColor === 'rainbow') {
            material.color = new THREE.Color().setHSL(Math.random(), 0.7, 0.6);
            material.userData = { isRainbow: true };
        }

        return material;
    }
    
    // 批量更新所有图形颜色的方法
    updateAllShapesColor(colorValue) {
        const colorHex = parseInt(colorValue.replace('#', '0x'));
        let count = 0;
        this.shapes.forEach((mesh, id) => {
            if (mesh && mesh.material) {
                // 保存裁剪平面设置
                const savedClippingPlanes = mesh.material.clippingPlanes;

                // 确保每个图形使用独立的材质实例
                if (!mesh.userData.ownMaterial) {
                    mesh.material = mesh.material.clone();
                    mesh.userData.ownMaterial = true;
                }
                mesh.material.color.setHex(colorHex);
                mesh.userData.isRainbow = false;

                // 恢复裁剪平面设置
                mesh.material.clippingPlanes = savedClippingPlanes;

                count++;
            }
        });
        this.showTooltip(`已更新 ${count} 个图形的颜色`, 1500);
        this.updateShapesList();
    }
    
    // 移除了截面控制功能
    
    updateShapeColor(shapeId, colorValue) {
        const mesh = this.shapes.get(shapeId);
        if (mesh && mesh.material) {
            // 保存裁剪平面设置
            const savedClippingPlanes = mesh.material.clippingPlanes;

            // 将颜色值转换为THREE.Color
            mesh.material.color.setHex(parseInt(colorValue.replace('#', '0x')));

            // 清除彩虹标记，因为用户手动设置了颜色
            mesh.userData.isRainbow = false;

            // 恢复裁剪平面设置
            mesh.material.clippingPlanes = savedClippingPlanes;
            
            // 如果是选中的图形，显示提示
            if (this.selectedShape === mesh) {
                this.showTooltip(`已更新图形 #${shapeId} 的颜色`, 1500);
            }
            
            // 更新图形列表显示
            this.updateShapesList();
        }
    }
    
    setShapeRainbow(shapeId) {
        const mesh = this.shapes.get(shapeId);
        if (mesh && mesh.material) {
            // 切换彩虹状态
            mesh.userData.isRainbow = !mesh.userData.isRainbow;
            
            if (mesh.userData.isRainbow) {
                // 设置为彩虹颜色，初始化一个随机的HSL颜色
                mesh.material.color.setHSL(Math.random(), 0.7, 0.6);
                this.showTooltip(`图形 #${shapeId} 已设置为彩虹颜色`, 1500);
            } else {
                // 取消彩虹，设置为默认蓝色
                mesh.material.color.setHex(0x3742fa);
                this.showTooltip(`图形 #${shapeId} 已取消彩虹颜色`, 1500);
            }
            
            // 更新图形列表显示
            this.updateShapesList();
        }
    }
    
    removeShape(shapeId) {
        const mesh = this.shapes.get(shapeId);
        if (mesh) {
            this.scene.remove(mesh);
            this.shapes.delete(shapeId);
            
            if (this.selectedShape === mesh) {
                this.deselectShape();
            }
            
            // 记录操作历史
            this.addToHistory('remove', { shapeId, mesh: mesh.clone() });
            this.updateShapesList();
        }
    }
    
    duplicateShape() {
        if (this.selectedShape) {
            // 计算原图形的边界框
            const originalBox = new THREE.Box3().setFromObject(this.selectedShape);
            const originalSize = originalBox.getSize(new THREE.Vector3());
            
            // 尝试在右侧放置，如果空间不够则尝试其他方向
            const gridSize = 20;
            const margin = 0.5;
            let offset = new THREE.Vector3(originalSize.x + 1, 0, 0); // 右侧
            let newPosition = this.selectedShape.position.clone().add(offset);
            
            // 检查右侧是否有足够空间
            if (newPosition.x + originalSize.x/2 + margin > gridSize) {
                // 尝试左侧
                offset = new THREE.Vector3(-(originalSize.x + 1), 0, 0);
                newPosition = this.selectedShape.position.clone().add(offset);
                
                if (newPosition.x - originalSize.x/2 - margin < 0) {
                    // 尝试前方
                    offset = new THREE.Vector3(0, 0, originalSize.z + 1);
                    newPosition = this.selectedShape.position.clone().add(offset);
                    
                    if (newPosition.z + originalSize.z/2 + margin > gridSize) {
                        // 尝试后方
                        offset = new THREE.Vector3(0, 0, -(originalSize.z + 1));
                        newPosition = this.selectedShape.position.clone().add(offset);
                        
                        if (newPosition.z - originalSize.z/2 - margin < 0) {
                            // 如果所有方向都不够，就在中心附近随机放置
                            const randomX = (Math.random() - 0.5) * 6;
                            const randomZ = (Math.random() - 0.5) * 6;
                            newPosition = new THREE.Vector3(10 + randomX, this.selectedShape.position.y, 10 + randomZ);
                        }
                    }
                }
            }
            
            // 最终边界检查，确保图形完全在网格范围内
            const halfSizeX = originalSize.x / 2;
            const halfSizeZ = originalSize.z / 2;
            newPosition.x = Math.max(halfSizeX + margin, Math.min(gridSize - halfSizeX - margin, newPosition.x));
            newPosition.y = Math.max(originalSize.y / 2, newPosition.y);
            newPosition.z = Math.max(halfSizeZ + margin, Math.min(gridSize - halfSizeZ - margin, newPosition.z));
            
            // 直接克隆当前图形（包括切割后的几何体）
            const newShape = this.selectedShape.clone();
            newShape.material = this.selectedShape.material.clone();
            newShape.geometry = this.selectedShape.geometry.clone();

            // 标记为拥有独立材质
            newShape.userData.ownMaterial = true;

            // 设置新位置
            newShape.position.copy(newPosition);

            // 重新居中几何体
            this.recenterGeometry(newShape);

            // 生成新的ID和名称
            this.shapeCounter++;
            const newShapeId = `shape_${this.shapeCounter}`;
            newShape.userData.id = newShapeId;
            newShape.userData.name = this.generateUniqueName(newShape.userData.type || 'cube');

            // 添加到场景和shapes映射
            this.scene.add(newShape);
            this.shapes.set(newShapeId, newShape);

            // 限制图形位置，确保不低于网格
            this.constrainShapePosition(newShape);

            // 记录到历史
            this.addToHistory('create', {
                shapeId: newShapeId,
                type: newShape.userData.type,
                position: newPosition.clone()
            });

            // 更新图形列表
            this.updateShapesList();

            this.showTooltip('图形已复制（包含所有修改）', 1500);
        }
    }
    
    addToHistory(action, data) {
        // 清除当前位置之后的历史
        this.operationHistory = this.operationHistory.slice(0, this.historyIndex + 1);
        this.operationHistory.push({ action, data, timestamp: Date.now() });
        this.historyIndex++;
        
        // 限制历史记录数量
        if (this.operationHistory.length > 50) {
            this.operationHistory.shift();
            this.historyIndex--;
        }
    }
    
    // 保存图形状态的辅助方法
    saveShapeState(mesh) {
        return {
            position: mesh.position.clone(),
            rotation: mesh.rotation.clone(),
            scale: mesh.scale.clone(),
            color: mesh.material.color.getHex(),
            geometry: mesh.geometry.clone(),
            userData: JSON.parse(JSON.stringify(mesh.userData))
        };
    }
    
    // 恢复图形状态的辅助方法
    restoreShapeState(mesh, state) {
        mesh.position.copy(state.position);
        mesh.rotation.copy(state.rotation);
        mesh.scale.copy(state.scale);
        mesh.material.color.setHex(state.color);
        mesh.geometry = state.geometry;
        mesh.userData = state.userData;

        // 限制图形位置，确保不低于网格
        this.constrainShapePosition(mesh);
    }
    
    undo() {
        if (this.historyIndex >= 0) {
            const operation = this.operationHistory[this.historyIndex];
            
            switch (operation.action) {
                case 'create':
                    // 删除创建的图形（不记录到历史中）
                    const mesh = this.shapes.get(operation.data.shapeId);
                    if (mesh) {
                        this.scene.remove(mesh);
                        this.shapes.delete(operation.data.shapeId);
                        if (this.selectedShape === mesh) {
                            this.deselectShape();
                        }
                    }
                    break;
                    
                case 'remove':
                    const restoredMesh = operation.data.mesh.clone();
                    restoredMesh.material = restoredMesh.material.clone();
                    this.scene.add(restoredMesh);
                    this.shapes.set(operation.data.shapeId, restoredMesh);
                    break;

                case 'cut':
                    const cutMesh = this.shapes.get(operation.data.shapeId);
                    if (cutMesh && operation.data.oldGeometry) {
                        cutMesh.geometry = operation.data.oldGeometry.clone();
                    }
                    break;

                case 'transform':
                    const transformMesh = this.shapes.get(operation.data.shapeId);
                    if (transformMesh) {
                        this.restoreShapeState(transformMesh, operation.data.oldState);
                    }
                    break;
            }
            
            this.historyIndex--;
            this.updateShapesList();
            this.showTooltip('已撤销操作', 1000);
        } else {
            this.showTooltip('没有可撤销的操作', 1000);
        }
    }
    
    redo() {
        if (this.historyIndex < this.operationHistory.length - 1) {
            this.historyIndex++;
            const operation = this.operationHistory[this.historyIndex];
            
            switch (operation.action) {
                case 'create':
                    // 重新创建图形
                    const newMesh = this.createShape(operation.data.type, operation.data.position);
                    // 恢复原始ID
                    newMesh.userData.id = operation.data.shapeId;
                    this.shapes.delete(newMesh.userData.id);
                    this.shapes.set(operation.data.shapeId, newMesh);
                    break;
                    
                case 'remove':
                    const mesh = this.shapes.get(operation.data.shapeId);
                    if (mesh) {
                        this.scene.remove(mesh);
                        this.shapes.delete(operation.data.shapeId);
                        if (this.selectedShape === mesh) {
                            this.deselectShape();
                        }
                    }
                    break;

                case 'cut':
                    const cutMesh = this.shapes.get(operation.data.shapeId);
                    if (cutMesh && operation.data.newGeometry) {
                        cutMesh.geometry = operation.data.newGeometry.clone();
                    }
                    break;

                case 'transform':
                    const transformMesh = this.shapes.get(operation.data.shapeId);
                    if (transformMesh) {
                        this.restoreShapeState(transformMesh, operation.data.newState);
                    }
                    break;
            }
            
            this.updateShapesList();
            this.showTooltip('已重做操作', 1000);
        } else {
            this.showTooltip('没有可重做的操作', 1000);
        }
    }
    
    updateShapesList() {
        const list = document.getElementById('shapesList');
        if (list) {
            list.innerHTML = '';
            this.shapes.forEach((mesh, id) => {
                const item = document.createElement('div');
                item.className = 'shape-item';

                // 获取当前图形的颜色
                const currentColor = mesh.material.color.getHexString();

                // 检查是否为彩虹颜色
                const isRainbow = mesh.userData.isRainbow;
                const rainbowButtonStyle = isRainbow ?
                    'background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080); color: white;' :
                    'background: #ddd; color: #666;';

                // 检查是否锁定
                const isLocked = mesh.userData.locked || false;
                const lockButtonStyle = isLocked ?
                    'background: #ff4757; color: white;' :
                    'background: #6c757d; color: white;';
                const lockButtonText = isLocked ? '🔒' : '🔓';
                const lockButtonTitle = isLocked ? '解锁图形' : '锁定图形';

                const displayName = mesh.userData.name || this.getChineseTypeName(mesh.userData.type);

                item.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 3px; ${isLocked ? 'background: #fff3e0;' : ''}">
                        <span style="cursor: pointer; flex: 1;" title="点击选中图形">${displayName}</span>
                        <div style="display: flex; align-items: center; gap: 3px;">
                            <button
                                    style="padding: 2px 4px; font-size: 10px; border: none; border-radius: 3px; cursor: pointer; background: #3742fa; color: white;"
                                    title="重命名">✏️</button>
                            <button
                                    style="padding: 2px 4px; font-size: 10px; border: none; border-radius: 3px; cursor: pointer; ${lockButtonStyle}"
                                    title="${lockButtonTitle}">${lockButtonText}</button>
                            <input type="color" value="#${currentColor}"
                                   style="width: 25px; height: 20px; border: none; border-radius: 3px; cursor: pointer;"
                                   title="选择颜色">
                            <button
                                    style="padding: 2px 4px; font-size: 10px; border: none; border-radius: 3px; cursor: pointer; ${rainbowButtonStyle}"
                                    title="${isRainbow ? '取消彩虹' : '设为彩虹'}">🌈</button>
                            <button
                                    style="padding: 2px 6px; font-size: 12px; background: #ff4757; color: white; border: none; border-radius: 3px; cursor: pointer;"
                                    title="删除图形">删除</button>
                        </div>
                    </div>
                `;

                // 使用 addEventListener 而不是内联事件
                const shapeSpan = item.querySelector('span');
                shapeSpan.addEventListener('click', () => {
                    this.selectShape(mesh);
                });

                const buttons = item.querySelectorAll('button');
                const renameButton = buttons[0];
                const lockButton = buttons[1];
                const colorInput = item.querySelector('input[type="color"]');
                const rainbowButton = buttons[2];
                const deleteButton = buttons[3];

                renameButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.renameShape(id);
                });

                lockButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleShapeLock(id);
                });

                colorInput.addEventListener('change', (e) => {
                    this.updateShapeColor(id, e.target.value);
                });

                rainbowButton.addEventListener('click', () => {
                    this.setShapeRainbow(id);
                });

                deleteButton.addEventListener('click', () => {
                    this.removeShape(id);
                });

                list.appendChild(item);
            });
        }
    }

    toggleShapeLock(id) {
        const mesh = this.shapes.get(id);
        if (!mesh) return;

        const isLocked = mesh.userData.locked || false;
        mesh.userData.locked = !isLocked;

        if (mesh.userData.locked) {
            // 如果图形被锁定，先取消选择
            if (this.selectedShape === mesh) {
                this.deselectShape();
            }
            this.showTooltip(`图形 #${id} 已锁定`, 1500);
        } else {
            this.showTooltip(`图形 #${id} 已解锁`, 1500);
        }

        // 更新图形列表显示
        this.updateShapesList();
    }

    setupEventListeners() {
        // 图形选择 - 移除自动创建，只在点击添加按钮时创建
        // document.getElementById('shapeSelect').addEventListener('change', (e) => {
        //     this.createShape(e.target.value);
        // });
        
        // 移除了截面控制功能
        
        // 初始化旋转按钮
        this.initRotationButtons();
        
        // 初始化精度控制
        this.initPrecisionControls();
        
        // 添加精度模式和TransformControls的快捷键
        document.addEventListener('keydown', (e) => {
            // 精度模式快捷键
            if (e.ctrlKey && e.key >= '1' && e.key <= '3') {
                e.preventDefault();
                const precisionMode = document.getElementById('precisionMode');
                if (precisionMode) {
                    const modes = ['standard', 'high', 'ultra'];
                    const modeIndex = parseInt(e.key) - 1;
                    if (modeIndex < modes.length) {
                        precisionMode.value = modes[modeIndex];
                        this.updateSliderSteps();
                        this.updateCuttingPlaneFromControls();
                        const modeNames = ['标准精度', '高精度', '超高精度'];
                         this.showTooltip(`已切换到${modeNames[modeIndex]}模式`, 1500);
                     }
                 }
             }

            // TransformControls模式快捷键
            if (this.selectedShape && this.transformControls) {
                switch(e.key.toLowerCase()) {
                    case 'w':
                        this.transformControls.setMode('translate');
                        this.showTooltip('平移模式 (W)', 1000);
                        break;
                    case 'e':
                        this.transformControls.setMode('rotate');
                        this.showTooltip('旋转模式 (E)', 1000);
                        break;
                    case 'r':
                        this.transformControls.setMode('scale');
                        this.showTooltip('缩放模式 (R)', 1000);
                        break;
                }
            }
         });
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key >= '1' && e.key <= '3') {
                e.preventDefault();
                const precisionMode = document.getElementById('precisionMode');
                if (precisionMode) {
                    const modes = ['standard', 'high', 'ultra'];
                    const modeIndex = parseInt(e.key) - 1;
                    if (modeIndex < modes.length) {
                        precisionMode.value = modes[modeIndex];
                        this.updateSliderSteps();
                        this.updateCuttingPlaneFromControls();
                        const modeNames = ['标准精度', '高精度', '超高精度'];
                         this.showTooltip(`已切换到${modeNames[modeIndex]}模式`, 1500);
                     }
                 }
             }
         });
        
        // 初始化帮助按钮
        this.initHelpSystem();

        // 初始化标签页
        this.initTabs();

        // 初始化侧边栏收起
        this.initSidebar();

        
        // 复制图形
        document.getElementById('duplicateShape').addEventListener('click', () => {
            this.duplicateShape();
        });
        
        // 撤销重做
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });
        
        document.getElementById('redoBtn').addEventListener('click', () => {
            this.redo();
        });
        
        // 清空所有
        document.getElementById('clearAll').addEventListener('click', () => {
            this.shapes.forEach((mesh, id) => {
                this.scene.remove(mesh);
            });
            this.shapes.clear();
            this.deselectShape();
            this.updateShapesList();
        });
        
        // 添加图形
        document.getElementById('addShape').addEventListener('click', () => {
            // console.log('添加图形按钮被点击');
            const shapeType = document.getElementById('shapeSelect').value;
            // console.log('选择的图形类型:', shapeType);
            this.addShape(shapeType);
        });
        
        // 拼合锁定
        document.getElementById('lockCombination').addEventListener('click', () => {
            if (this.isLocked) {
                this.unlockCombination();
            } else {
                this.lockCombination();
            }
        });
        
        // 切割工具
        document.getElementById('toggleCutting').addEventListener('click', () => {
            this.toggleCuttingMode();
        });

        // 清除切割平面
        document.getElementById('clearCutting').addEventListener('click', () => {
            this.clearCuttingPlanes();
        });
        
        // 网格显示/隐藏切换
        document.getElementById('toggleGrid').addEventListener('click', () => {
            this.toggleGrid();
        });
        
        // 颜色变化
        document.getElementById('colorSelect').addEventListener('change', () => {
            if (this.selectedShape) {
                const beforeState = this.saveShapeState(this.selectedShape);
                const newMaterial = this.createMaterial();
                this.selectedShape.material = newMaterial;
                
                // 更新图形的彩虹状态
                const colorSelect = document.getElementById('colorSelect');
                this.selectedShape.userData.isRainbow = (colorSelect.value === 'rainbow');
                
                const afterState = this.saveShapeState(this.selectedShape);
                
                this.addToHistory({
                    type: 'color',
                    shapeId: this.selectedShape.userData.id,
                    beforeState: beforeState,
                    afterState: afterState
                });
                
                // 更新图形列表显示
                this.updateShapesList();
            }
        });
        
        // 切割平面控制面板事件监听器
        ['cuttingPosX', 'cuttingPosY', 'cuttingPosZ', 'cuttingNormalX', 'cuttingNormalY', 'cuttingNormalZ'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    this.updateCuttingPlaneFromControls();
                });
            }
        });
        
        // 应用切割按钮
        const applyCuttingBtn = document.getElementById('applyCuttingPlane');
        if (applyCuttingBtn) {
            applyCuttingBtn.addEventListener('click', () => {
                this.applyCuttingPlaneFromControls();
            });
        }
        
        // 重置切割平面按钮
        const resetCuttingBtn = document.getElementById('resetCuttingPlane');
        if (resetCuttingBtn) {
            resetCuttingBtn.addEventListener('click', () => {
                this.resetCuttingPlaneControls();
            });
        }
        
        // TransformControls模式切换按钮
        const toggleTransformBtn = document.getElementById('toggleCuttingTransform');
        if (toggleTransformBtn) {
            toggleTransformBtn.addEventListener('click', () => {
                if (!this.cuttingPlaneAdjustMode) {
                    this.showTooltip('请先启用切割工具', 1500);
                    return;
                }
                
                if (this.cuttingPlaneTransform) {
                    if (this.cuttingPlaneTransform.visible) {
                        this.disableCuttingPlaneTransform();
                        toggleTransformBtn.textContent = '显示控制器';
                        toggleTransformBtn.style.background = '#007bff';
                        this.showTooltip('已隐藏3D控制器', 1500);
                    } else {
                        this.enableCuttingPlaneTransform();
                        toggleTransformBtn.textContent = '隐藏控制器';
                        toggleTransformBtn.style.background = '#dc3545';
                        this.showTooltip('已显示3D控制器', 1500);
                    }
                }
            });
        }
        
        // 旋转模式按钮
        const rotateModeBtn = document.getElementById('setCuttingTransformModeRotate');
        if (rotateModeBtn) {
            rotateModeBtn.addEventListener('click', () => {
                if (!this.cuttingPlaneAdjustMode) {
                    this.showTooltip('请先启用切割工具', 1500);
                    return;
                }
                
                this.setCuttingPlaneTransformMode('rotate');
                if (this.cuttingPlaneTransform && !this.cuttingPlaneTransform.visible) {
                    this.enableCuttingPlaneTransform();
                    const toggleBtn = document.getElementById('toggleCuttingTransform');
                    if (toggleBtn) {
                        toggleBtn.textContent = '隐藏控制器';
                        toggleBtn.style.background = '#dc3545';
                    }
                }
                this.showTooltip('已切换到旋转模式 - 拖拽圆环旋转平面', 2000);
            });
        }
        
        // 移动模式按钮
        const translateModeBtn = document.getElementById('setCuttingTransformModeTranslate');
        if (translateModeBtn) {
            translateModeBtn.addEventListener('click', () => {
                if (!this.cuttingPlaneAdjustMode) {
                    this.showTooltip('请先启用切割工具', 1500);
                    return;
                }
                
                this.setCuttingPlaneTransformMode('translate');
                if (this.cuttingPlaneTransform && !this.cuttingPlaneTransform.visible) {
                    this.enableCuttingPlaneTransform();
                    const toggleBtn = document.getElementById('toggleCuttingTransform');
                    if (toggleBtn) {
                        toggleBtn.textContent = '隐藏控制器';
                        toggleBtn.style.background = '#dc3545';
                    }
                }
                this.showTooltip('已切换到移动模式 - 拖拽箭头移动平面', 2000);
            });
        }
        
        // 图形变换模式按钮
        const setTranslateModeBtn = document.getElementById('setTranslateMode');
        if (setTranslateModeBtn) {
            setTranslateModeBtn.addEventListener('click', () => {
                if (this.transformControls) {
                    this.transformControls.setMode('translate');
                    this.showTooltip('平移模式 (W)', 1000);
                }
            });
        }
        
        const setRotateModeBtn = document.getElementById('setRotateMode');
        if (setRotateModeBtn) {
            setRotateModeBtn.addEventListener('click', () => {
                if (this.transformControls) {
                    this.transformControls.setMode('rotate');
                    this.showTooltip('旋转模式 (E)', 1000);
                }
            });
        }
        
        const setScaleModeBtn = document.getElementById('setScaleMode');
        if (setScaleModeBtn) {
            setScaleModeBtn.addEventListener('click', () => {
                if (this.transformControls) {
                    this.transformControls.setMode('scale');
                    this.showTooltip('缩放模式 (R)', 1000);
                }
            });
        }
        
        // 快速设置切割方向按钮
        const quickCuttingXBtn = document.getElementById('setNormalX');
        if (quickCuttingXBtn) {
            quickCuttingXBtn.addEventListener('click', () => {
                this.setQuickCuttingDirection('x');
            });
        }
        
        const quickCuttingYBtn = document.getElementById('setNormalY');
        if (quickCuttingYBtn) {
            quickCuttingYBtn.addEventListener('click', () => {
                this.setQuickCuttingDirection('y');
            });
        }
        
        const quickCuttingZBtn = document.getElementById('setNormalZ');
        if (quickCuttingZBtn) {
            quickCuttingZBtn.addEventListener('click', () => {
                this.setQuickCuttingDirection('z');
            });
        }
        
        // 图形位置控制事件监听器
        ['posX', 'posY', 'posZ'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                let positionStartState = null;
                let positionTimeout = null;

                element.addEventListener('mousedown', () => {
                    if (this.selectedShape) {
                        positionStartState = this.saveShapeState(this.selectedShape);
                    }
                });

                element.addEventListener('input', (e) => {
                    this.updateShapePosition(id, parseFloat(e.target.value));
                    document.getElementById(id + 'Value').textContent = parseFloat(e.target.value).toFixed(1);

                    if (positionTimeout) {
                        clearTimeout(positionTimeout);
                    }
                    positionTimeout = setTimeout(() => {
                        if (this.selectedShape && positionStartState) {
                            const endState = this.saveShapeState(this.selectedShape);
                            this.addToHistory('transform', {
                                shapeId: this.selectedShape.userData.id,
                                oldState: positionStartState,
                                newState: endState
                            });
                            positionStartState = null;
                        }
                    }, 500);
                });
            }
        });

        // 重置位置按钮
        const resetPositionBtn = document.getElementById('resetPosition');
        if (resetPositionBtn) {
            resetPositionBtn.addEventListener('click', () => {
                this.resetShapePosition();
            });
        }

        // 图形大小控制事件监听器
        ['scaleX', 'scaleY', 'scaleZ'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                let scaleStartState = null;
                let scaleTimeout = null;
                
                element.addEventListener('mousedown', () => {
                    if (this.selectedShape) {
                        scaleStartState = this.saveShapeState(this.selectedShape);
                    }
                });
                
                element.addEventListener('input', (e) => {
                    this.updateShapeScale(id, parseFloat(e.target.value));
                    document.getElementById(id + 'Value').textContent = parseFloat(e.target.value).toFixed(1);
                    
                    // 使用防抖技术，在用户停止拖拽500ms后记录历史
                    if (scaleTimeout) {
                        clearTimeout(scaleTimeout);
                    }
                    scaleTimeout = setTimeout(() => {
                        if (this.selectedShape && scaleStartState) {
                            const endState = this.saveShapeState(this.selectedShape);
                            this.addToHistory('transform', {
                                shapeId: this.selectedShape.userData.id,
                                oldState: scaleStartState,
                                newState: endState
                            });
                            scaleStartState = null;
                        }
                    }, 500);
                });
            }
        });
        
        // 重置大小按钮
        const resetScaleBtn = document.getElementById('resetScale');
        if (resetScaleBtn) {
            resetScaleBtn.addEventListener('click', () => {
                this.resetShapeScale();
            });
        }
        
        // 等比缩放按钮
        const uniformScaleBtn = document.getElementById('uniformScale');
        if (uniformScaleBtn) {
            uniformScaleBtn.addEventListener('click', () => {
                this.toggleUniformScale();
            });
        }
        
        // 全局颜色控制器
        const applyGlobalColorBtn = document.getElementById('applyGlobalColor');
        if (applyGlobalColorBtn) {
            applyGlobalColorBtn.addEventListener('click', () => {
                const colorPicker = document.getElementById('globalColorPicker');
                if (colorPicker) {
                    this.updateAllShapesColor(colorPicker.value);
                }
            });
        }

        // 材质参数控制
        ['metalness', 'roughness', 'opacity', 'clearcoat', 'reflectivity'].forEach(param => {
            const slider = document.getElementById(param);
            const valueDisplay = document.getElementById(param + 'Value');
            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    const value = parseFloat(slider.value);
                    valueDisplay.textContent = value.toFixed(2);
                    this.updateSelectedShapeMaterial(param, value);
                });
            }
        });

        const resetMaterialBtn = document.getElementById('resetMaterial');
        if (resetMaterialBtn) {
            resetMaterialBtn.addEventListener('click', () => {
                this.resetSelectedShapeMaterial();
            });
        }

        // 光照系统控制
        const mainLightIntensity = document.getElementById('mainLightIntensity');
        const mainLightIntensityValue = document.getElementById('mainLightIntensityValue');
        if (mainLightIntensity && mainLightIntensityValue) {
            mainLightIntensity.addEventListener('input', () => {
                const value = parseFloat(mainLightIntensity.value);
                mainLightIntensityValue.textContent = value.toFixed(1);
                this.updateMainLightIntensity(value);
            });
        }

        const ambientLightIntensity = document.getElementById('ambientLightIntensity');
        const ambientLightIntensityValue = document.getElementById('ambientLightIntensityValue');
        if (ambientLightIntensity && ambientLightIntensityValue) {
            ambientLightIntensity.addEventListener('input', () => {
                const value = parseFloat(ambientLightIntensity.value);
                ambientLightIntensityValue.textContent = value.toFixed(1);
                this.updateAmbientLightIntensity(value);
            });
        }

        const mainLightColor = document.getElementById('mainLightColor');
        const mainLightColorValue = document.getElementById('mainLightColorValue');
        if (mainLightColor && mainLightColorValue) {
            mainLightColor.addEventListener('input', () => {
                mainLightColorValue.textContent = mainLightColor.value;
                this.updateMainLightColor(mainLightColor.value);
            });
        }

        ['lightPositionX', 'lightPositionY', 'lightPositionZ'].forEach(param => {
            const slider = document.getElementById(param);
            const valueDisplay = document.getElementById(param + 'Value');
            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    const value = parseFloat(slider.value);
                    valueDisplay.textContent = value;
                    this.updateLightPosition();
                });
            }
        });

        const resetLightingBtn = document.getElementById('resetLighting');
        if (resetLightingBtn) {
            resetLightingBtn.addEventListener('click', () => {
                this.resetLighting();
            });
        }

        // 光照系统展开/折叠按钮
        const toggleLightingBtn = document.getElementById('toggleLighting');
        if (toggleLightingBtn) {
            toggleLightingBtn.addEventListener('click', () => {
                const lightingSettings = document.getElementById('lightingSettings');
                if (lightingSettings) {
                    const isVisible = lightingSettings.style.display !== 'none';
                    lightingSettings.style.display = isVisible ? 'none' : 'block';
                    toggleLightingBtn.textContent = isVisible ? '展开' : '折叠';
                }
            });
        }

        // 环境设置
        const backgroundColor = document.getElementById('backgroundColor');
        const backgroundColorValue = document.getElementById('backgroundColorValue');
        if (backgroundColor && backgroundColorValue) {
            backgroundColor.addEventListener('input', () => {
                backgroundColorValue.textContent = backgroundColor.value;
                this.updateBackgroundColor(backgroundColor.value);
            });
        }

        const gridColor = document.getElementById('gridColor');
        const gridColorValue = document.getElementById('gridColorValue');
        if (gridColor && gridColorValue) {
            gridColor.addEventListener('input', () => {
                gridColorValue.textContent = gridColor.value;
                this.updateGridColor(gridColor.value);
            });
        }

        const gridSize = document.getElementById('gridSize');
        const gridSizeValue = document.getElementById('gridSizeValue');
        if (gridSize && gridSizeValue) {
            gridSize.addEventListener('input', () => {
                const value = parseInt(gridSize.value);
                gridSizeValue.textContent = value;
                this.updateGridSize(value);
            });
        }

        const resetEnvironmentBtn = document.getElementById('resetEnvironment');
        if (resetEnvironmentBtn) {
            resetEnvironmentBtn.addEventListener('click', () => {
                this.resetEnvironment();
            });
        }

        // 环境设置展开/折叠按钮
        const toggleEnvironmentBtn = document.getElementById('toggleEnvironment');
        if (toggleEnvironmentBtn) {
            toggleEnvironmentBtn.addEventListener('click', () => {
                const environmentSettings = document.getElementById('environmentSettings');
                if (environmentSettings) {
                    const isVisible = environmentSettings.style.display !== 'none';
                    environmentSettings.style.display = isVisible ? 'none' : 'block';
                    toggleEnvironmentBtn.textContent = isVisible ? '展开' : '折叠';
                }
            });
        }

        // 图形尺寸参数
        const applyGeometryBtn = document.getElementById('applyGeometryChanges');
        if (applyGeometryBtn) {
            applyGeometryBtn.addEventListener('click', () => {
                this.applyGeometryChanges();
            });
        }

        // 几何参数滑块事件监听（动态生成，需要通过事件委托）
        document.addEventListener('input', (e) => {
            if (e.target.id && e.target.id.startsWith('geo')) {
                const valueDisplay = document.getElementById(e.target.id + 'Value');
                if (valueDisplay) {
                    valueDisplay.textContent = parseFloat(e.target.value).toFixed(1);
                }
            }
        });

        // 配置管理事件监听器
        const saveConfigBtn = document.getElementById('saveConfig');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => {
                this.showSaveConfigDialog();
            });
        }

        // 保存配置对话框事件
        const confirmSaveConfig = document.getElementById('confirmSaveConfig');
        if (confirmSaveConfig) {
            confirmSaveConfig.addEventListener('click', () => {
                this.saveConfigurationWithCustomName();
            });
        }

        const cancelSaveConfig = document.getElementById('cancelSaveConfig');
        if (cancelSaveConfig) {
            cancelSaveConfig.addEventListener('click', () => {
                this.hideSaveConfigDialog();
            });
        }

        // 配置名称输入框的键盘事件
        const configNameInput = document.getElementById('configNameInput');
        if (configNameInput) {
            configNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveConfigurationWithCustomName();
                } else if (e.key === 'Escape') {
                    this.hideSaveConfigDialog();
                }
            });
        }

        // 单个配置文件选择
        const loadSingleConfigBtn = document.getElementById('loadSingleConfig');
        const singleConfigInput = document.getElementById('singleConfigInput');
        if (loadSingleConfigBtn && singleConfigInput) {
            loadSingleConfigBtn.addEventListener('click', () => {
                singleConfigInput.click();
            });

            singleConfigInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.loadSingleConfigurationFileWithDialog(e.target.files[0]);
                }
            });
        }

        // 配置文件夹选择
        const loadConfigFolderBtn = document.getElementById('loadConfigFolder');
        const configFolderInput = document.getElementById('configFolderInput');
        if (loadConfigFolderBtn && configFolderInput) {
            loadConfigFolderBtn.addEventListener('click', () => {
                configFolderInput.click();
            });

            configFolderInput.addEventListener('change', (e) => {
                this.loadConfigurationFiles(e.target.files);
            });
        }

        // 加载配置对话框事件
        const confirmLoadConfig = document.getElementById('confirmLoadConfig');
        if (confirmLoadConfig) {
            confirmLoadConfig.addEventListener('click', () => {
                this.confirmLoadConfiguration();
            });
        }

        const cancelLoadConfig = document.getElementById('cancelLoadConfig');
        if (cancelLoadConfig) {
            cancelLoadConfig.addEventListener('click', () => {
                this.hideLoadConfigDialog();
            });
        }

        // 清空配置列表
        const clearConfigListBtn = document.getElementById('clearConfigList');
        if (clearConfigListBtn) {
            clearConfigListBtn.addEventListener('click', () => {
                this.clearConfigList();
            });
        }

        // 重置到默认配置
        const resetToDefaultConfigBtn = document.getElementById('resetToDefaultConfig');
        if (resetToDefaultConfigBtn) {
            resetToDefaultConfigBtn.addEventListener('click', () => {
                this.resetToDefaultConfigFolder();
            });
        }

        // 刷新配置
        const refreshConfigsBtn = document.getElementById('refreshConfigs');
        if (refreshConfigsBtn) {
            refreshConfigsBtn.addEventListener('click', () => {
                this.refreshConfigs();
            });
        }

        // 配置文件搜索
        const configSearchInput = document.getElementById('configSearchInput');
        if (configSearchInput) {
            configSearchInput.addEventListener('input', (e) => {
                this.filterConfigsByKeyword(e.target.value);
            });
        }

        // 键盘事件支持
        document.addEventListener('keydown', (e) => {
            // Escape键关闭对话框
            if (e.key === 'Escape') {
                const saveModal = document.getElementById('saveConfigModal');
                const loadModal = document.getElementById('loadConfigModal');
                if (saveModal.style.display === 'flex') {
                    this.hideSaveConfigDialog();
                }
                if (loadModal.style.display === 'flex') {
                    this.hideLoadConfigDialog();
                }
            }
        });

        // 布尔运算事件监听器
        const toggleBooleanBtn = document.getElementById('toggleBoolean');
        if (toggleBooleanBtn) {
            toggleBooleanBtn.addEventListener('click', () => {
                this.toggleBooleanMode();
            });
        }

        const executeBooleanBtn = document.getElementById('executeBoolean');
        if (executeBooleanBtn) {
            executeBooleanBtn.addEventListener('click', () => {
                this.executeBooleanOperation();
            });
        }

        const cancelBooleanBtn = document.getElementById('cancelBoolean');
        if (cancelBooleanBtn) {
            cancelBooleanBtn.addEventListener('click', () => {
                this.cancelBooleanOperation();
            });
        }

        // ==================== 变形编辑工具事件绑定 ====================

        const toggleDeformationBtn = document.getElementById('toggleDeformation');
        if (toggleDeformationBtn) {
            toggleDeformationBtn.addEventListener('click', () => {
                this.toggleDeformationMode();
            });
        }

        const selectVertexBtn = document.getElementById('selectVertex');
        if (selectVertexBtn) {
            selectVertexBtn.addEventListener('click', () => {
                this.setDeformSelectionMode('vertex');
            });
        }

        const selectEdgeBtn = document.getElementById('selectEdge');
        if (selectEdgeBtn) {
            selectEdgeBtn.addEventListener('click', () => {
                this.setDeformSelectionMode('edge');
            });
        }

        const selectFaceBtn = document.getElementById('selectFace');
        if (selectFaceBtn) {
            selectFaceBtn.addEventListener('click', () => {
                this.setDeformSelectionMode('face');
            });
        }

        const toggleBoxSelectBtn = document.getElementById('toggleBoxSelect');
        if (toggleBoxSelectBtn) {
            toggleBoxSelectBtn.addEventListener('click', () => {
                this.toggleBoxSelectMode();
            });
        }

        const softSelectEnabled = document.getElementById('softSelectEnabled');
        if (softSelectEnabled) {
            softSelectEnabled.addEventListener('change', (e) => {
                this.deformationSelection.softSelect = e.target.checked;
                this.createSoftSelectVisual();
                this.updateDeformStatus();
            });
        }

        const softSelectRadiusSlider = document.getElementById('softSelectRadius');
        if (softSelectRadiusSlider) {
            softSelectRadiusSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.deformationSelection.softRadius = value;
                const valueDisplay = document.getElementById('softSelectRadiusValue');
                if (valueDisplay) {
                    valueDisplay.textContent = value.toFixed(1);
                }
                this.updateSoftSelectVisual();
            });
        }

        const softSelectCurveSelect = document.getElementById('softSelectCurve');
        if (softSelectCurveSelect) {
            softSelectCurveSelect.addEventListener('change', (e) => {
                this.deformationSelection.softCurve = e.target.value;
            });
        }

        const deformTranslateBtn = document.getElementById('deformTranslate');
        if (deformTranslateBtn) {
            deformTranslateBtn.addEventListener('click', () => {
                this.setDeformTransformMode('translate');
            });
        }

        const deformRotateBtn = document.getElementById('deformRotate');
        if (deformRotateBtn) {
            deformRotateBtn.addEventListener('click', () => {
                this.setDeformTransformMode('rotate');
            });
        }

        const deformScaleBtn = document.getElementById('deformScale');
        if (deformScaleBtn) {
            deformScaleBtn.addEventListener('click', () => {
                this.setDeformTransformMode('scale');
            });
        }

        const undoDeformBtn = document.getElementById('undoDeform');
        if (undoDeformBtn) {
            undoDeformBtn.addEventListener('click', () => {
                this.undoDeformation();
            });
        }

        const redoDeformBtn = document.getElementById('redoDeform');
        if (redoDeformBtn) {
            redoDeformBtn.addEventListener('click', () => {
                this.redoDeformation();
            });
        }

        const resetShapeBtn = document.getElementById('resetShape');
        if (resetShapeBtn) {
            resetShapeBtn.addEventListener('click', () => {
                this.resetDeformationShape();
            });
        }

        // 变形模式的鼠标事件
        this.renderer.domElement.addEventListener('click', (e) => {
            if (this.deformationMode) {
                this.handleDeformationClick(e);
            }
        });

        // 六面体展开图编辑器事件监听器
        const openCubeNetEditorBtn = document.getElementById('openCubeNetEditor');
        if (openCubeNetEditorBtn) {
            openCubeNetEditorBtn.addEventListener('click', () => {
                window.open('hexahedron.html', '_blank');
            });
        }

        // 切割预览窗口事件监听器
        const toggleCuttingPreviewBtn = document.getElementById('toggleCuttingPreview');
        if (toggleCuttingPreviewBtn) {
            toggleCuttingPreviewBtn.addEventListener('click', () => {
                this.toggleCuttingPreviewMode();
            });
        }

        const closeCuttingPreviewBtn = document.getElementById('closeCuttingPreview');
        if (closeCuttingPreviewBtn) {
            closeCuttingPreviewBtn.addEventListener('click', () => {
                this.closeCuttingPreview();
            });
        }

        const resetCuttingPreviewViewBtn = document.getElementById('resetCuttingPreviewView');
        if (resetCuttingPreviewViewBtn) {
            resetCuttingPreviewViewBtn.addEventListener('click', () => {
                this.resetCuttingPreviewView();
            });
        }

        const mirrorCuttingPreviewBtn = document.getElementById('mirrorCuttingPreview');
        if (mirrorCuttingPreviewBtn) {
            mirrorCuttingPreviewBtn.addEventListener('click', () => {
                this.mirrorCuttingPreview();
            });
        }

        // 最小化按钮事件监听器
        this.setupMinimizeButtons();

        // 切割预览窗口拖拽功能
        this.setupDraggableWindow('cuttingPreviewWindow');

    }

    setupDraggableWindow(windowId) {
        const windowElement = document.getElementById(windowId);
        if (!windowElement) return;

        const header = windowElement.querySelector('div[style*="cursor: move"], div.draggable-header');
        if (!header) return;

        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = windowElement.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            header.style.cursor = 'grabbing';
            windowElement.style.transform = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const newX = e.clientX - offsetX;
            const newY = e.clientY - offsetY;

            windowElement.style.left = newX + 'px';
            windowElement.style.top = newY + 'px';
            windowElement.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'move';
            }
        });
    }
    
    // 设置最小化按钮功能
    setupMinimizeButtons() {
        // 控制面板最小化按钮
        const controlsMinimizeBtn = document.getElementById('controlsMinimizeBtn');
        const controlsPanel = document.getElementById('controls');
        
        if (controlsMinimizeBtn && controlsPanel) {
            controlsMinimizeBtn.addEventListener('click', () => {
                controlsPanel.classList.toggle('minimized');
                controlsMinimizeBtn.textContent = controlsPanel.classList.contains('minimized') ? '+' : '−';
                controlsMinimizeBtn.title = controlsPanel.classList.contains('minimized') ? '展开工具栏' : '最小化工具栏';
            });
        }
        
        // 信息面板最小化按钮
        const infoMinimizeBtn = document.getElementById('infoMinimizeBtn');
        const infoPanel = document.getElementById('info');
        
        if (infoMinimizeBtn && infoPanel) {
            infoMinimizeBtn.addEventListener('click', () => {
                infoPanel.classList.toggle('minimized');
                infoMinimizeBtn.textContent = infoPanel.classList.contains('minimized') ? '+' : '−';
                infoMinimizeBtn.title = infoPanel.classList.contains('minimized') ? '展开操作提示' : '最小化操作提示';
            });
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 性能监控（仅在移动设备上）
        if (this.isMobile && this.adaptiveQuality) {
            this.monitorPerformance();
        }
        
        // 移动设备上减少不必要的更新以提高性能
        if (this.isMobile) {
            // 只在控制器需要更新时才更新
            if (this.controls.enabled && this.controls.autoRotate) {
                this.controls.update();
            }
            
            // 减少彩虹动画频率 - 应用到所有彩虹颜色的图形
        if (!this.rainbowFrameCounter) this.rainbowFrameCounter = 0;
        this.rainbowFrameCounter++;
        if (this.rainbowFrameCounter % 10 === 0) {
            const time = Date.now() * 0.001;
            // 更新所有彩虹颜色的图形
            this.shapes.forEach((mesh) => {
                if (mesh && mesh.material && mesh.userData.isRainbow) {
                    mesh.material.color.setHSL((time * 0.05) % 1, 0.7, 0.6);
                }
            });
        }
            
            // 减少选择框更新频率
            const box = this.scene.getObjectByName('selectionBox');
            if (box && this.selectedShape) {
                if (!this.selectionBoxFrameCounter) this.selectionBoxFrameCounter = 0;
                this.selectionBoxFrameCounter++;
                if (this.selectionBoxFrameCounter % 5 === 0) {
                    box.update();
                }
            }
        } else {
            // 桌面设备保持原有的高频率更新
            this.controls.update();
            
            // 彩虹模式的颜色动画 - 应用到所有彩虹颜色的图形
            const time = Date.now() * 0.001;
            this.shapes.forEach((mesh) => {
                if (mesh && mesh.material && mesh.userData.isRainbow) {
                    mesh.material.color.setHSL((time * 0.1) % 1, 0.7, 0.6);
                }
            });
            
            // 更新选择框
            const box = this.scene.getObjectByName('selectionBox');
            if (box && this.selectedShape) {
                box.update();
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
    
    // 性能监控函数
    monitorPerformance() {
        this.frameCount++;
        const now = Date.now();
        
        // 每秒检查一次FPS
        if (now - this.lastFPSCheck >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.lastFPSCheck = now;

            // 更新 FPS 显示
            const fpsCounter = document.getElementById('fpsCounter');
            if (fpsCounter) {
                fpsCounter.textContent = `FPS: ${this.currentFPS}`;
            }

            // 如果FPS低于30，增加低FPS计数
            if (this.currentFPS < 30) {
                this.lowFPSCount++;
                // console.log(`低FPS检测: ${this.currentFPS}fps, 连续次数: ${this.lowFPSCount}`);
                
                // 连续3次低FPS，自动降低渲染质量
                if (this.lowFPSCount >= 3) {
                    this.adaptRenderingQuality();
                    this.lowFPSCount = 0; // 重置计数
                }
            } else {
                this.lowFPSCount = 0; // 重置低FPS计数
            }
        }
    }
    
    // 自适应渲染质量调整
    adaptRenderingQuality() {
        // console.log('检测到性能问题，自动降低渲染质量');

        // 降低像素比
        const currentPixelRatio = this.renderer.getPixelRatio();
        if (currentPixelRatio > 1) {
            this.renderer.setPixelRatio(Math.max(1, currentPixelRatio * 0.8));
            // console.log(`像素比降低至: ${this.renderer.getPixelRatio()}`);
        }

        // 禁用阴影（如果还未禁用）
        if (this.renderer.shadowMap.enabled) {
            this.renderer.shadowMap.enabled = false;
            // console.log('已禁用阴影以提高性能');
        }
        
        // 简化材质
        this.shapes.forEach((mesh) => {
            if (mesh.material && mesh.material.type === 'MeshStandardMaterial') {
                const color = mesh.material.color.clone();
                mesh.material = new THREE.MeshLambertMaterial({
                    color: color,
                    transparent: false,
                    side: THREE.FrontSide,
                    flatShading: true
                });
            }
        });
        
        // 显示性能优化提示
        this.showTooltip('检测到性能问题，已自动优化渲染设置', 3000);
    }

    // 配置管理功能
    saveCurrentConfiguration() {
        try {
            const config = {
                timestamp: new Date().toISOString(),
                shapes: [],
                camera: {
                    position: this.camera.position.toArray(),
                    rotation: this.camera.rotation.toArray(),
                    zoom: this.camera.zoom
                },
                controls: {
                    target: this.controls.target.toArray()
                },
                settings: {
                    gridVisible: this.gridHelper.visible,
                    shadowsEnabled: this.renderer.shadowMap.enabled
                }
            };

            // 保存所有图形的信息
            this.shapes.forEach((mesh, id) => {
                const shapeData = {
                    id: id,
                    type: mesh.userData.type,
                    position: mesh.position.toArray(),
                    rotation: mesh.rotation.toArray(),
                    scale: mesh.scale.toArray(),
                    color: mesh.material.color.getHex(),
                    visible: mesh.visible,
                    parameters: mesh.userData.parameters || {},
                    locked: mesh.userData.locked || false
                };
                config.shapes.push(shapeData);
            });

            return config;
        } catch (error) {
            console.error('保存配置失败:', error);
            return null;
        }
    }

    // 显示保存配置对话框
    showSaveConfigDialog() {
        const modal = document.getElementById('saveConfigModal');
        const nameInput = document.getElementById('configNameInput');
        const timestamp = new Date().toLocaleString('zh-CN').replace(/[\/:]/g, '-');
        nameInput.value = `3D配置_${timestamp}`;
        nameInput.focus();
        nameInput.select();
        modal.style.display = 'flex';
    }

    // 隐藏保存配置对话框
    hideSaveConfigDialog() {
        const modal = document.getElementById('saveConfigModal');
        modal.style.display = 'none';
    }

    // 使用自定义名称保存配置
    saveConfigurationWithCustomName() {
        const nameInput = document.getElementById('configNameInput');
        const configName = nameInput.value.trim();

        if (!configName) {
            this.showTooltip('请输入配置名称', 1500);
            return;
        }

        const config = this.saveCurrentConfiguration();
        if (!config) {
            this.showTooltip('保存配置失败，请重试', 2000);
            return;
        }

        // 生成文件名
        const filename = `${configName}.json`;

        // 创建下载链接
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);

        // 将保存的配置添加到配置列表中
        this.configFiles.set(filename, config);
        const configList = document.getElementById('configList');
        const configListGroup = document.getElementById('configListGroup');
        if (configList && configListGroup) {
            this.addConfigToList(filename, config, '', filename);
            configListGroup.style.display = 'block';
        }

        this.hideSaveConfigDialog();
        this.showTooltip(`配置已保存为: ${filename}`, 2000);
    }

    // 加载单个配置文件
    loadSingleConfigurationFile(file) {
        if (!file) return;

        const configList = document.getElementById('configList');
        const configListGroup = document.getElementById('configListGroup');
        if (!configList || !configListGroup) return;

        // 清空现有列表
        configList.innerHTML = '';
        this.configFiles.clear();

        if (!file.name.endsWith('.json')) {
            this.showTooltip('请选择JSON格式的配置文件', 1500);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                this.configFiles.set(file.name, config);
                this.addConfigToList(file.name, config, '');
                configListGroup.style.display = 'block';
                this.showTooltip(`成功加载配置文件: ${file.name}`, 2000);
            } catch (error) {
                console.error(`解析配置文件 ${file.name} 失败:`, error);
                this.showTooltip('配置文件格式错误，请检查文件内容', 2000);
            }
        };
        reader.readAsText(file);
    }

    // 加载单个配置文件并显示对话框
    loadSingleConfigurationFileWithDialog(file) {
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            this.showTooltip('请选择JSON格式的配置文件', 1500);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                this.pendingConfig = {
                    filename: file.name,
                    config: config
                };
                this.showLoadConfigDialog(config);
                this.showTooltip(`成功加载配置文件: ${file.name}`, 2000);
            } catch (error) {
                console.error(`解析配置文件 ${file.name} 失败:`, error);
                this.showTooltip('配置文件格式错误，请检查文件内容', 2000);
            }
        };
        reader.readAsText(file);
    }

    // 显示加载配置对话框
    showLoadConfigDialog(config) {
        const modal = document.getElementById('loadConfigModal');
        const infoDiv = document.getElementById('loadConfigInfo');

        const timestamp = config.timestamp ? new Date(config.timestamp).toLocaleString('zh-CN') : '未知时间';
        const shapeCount = config.shapes ? config.shapes.length : 0;
        const currentShapeCount = this.shapes.size;

        infoDiv.innerHTML = `
            <div><strong>配置文件:</strong> ${this.pendingConfig.filename}</div>
            <div><strong>图形数量:</strong> ${shapeCount}</div>
            <div><strong>创建时间:</strong> ${timestamp}</div>
            <div><strong>当前场景:</strong> ${currentShapeCount} 个图形</div>
        `;
        infoDiv.style.display = 'block';

        modal.style.display = 'flex';
    }

    // 隐藏加载配置对话框
    hideLoadConfigDialog() {
        const modal = document.getElementById('loadConfigModal');
        modal.style.display = 'none';
        this.pendingConfig = null;
    }

    // 确认加载配置
    confirmLoadConfiguration() {
        if (!this.pendingConfig) {
            this.showTooltip('没有待加载的配置', 1500);
            return;
        }

        const loadMode = document.querySelector('input[name="loadMode"]:checked').value;

        if (loadMode === 'overwrite') {
            this.loadConfiguration(this.pendingConfig.filename, this.pendingConfig.config, true);
        } else {
            this.appendConfiguration(this.pendingConfig.config);
        }

        this.hideLoadConfigDialog();
    }

    // 加载配置文件夹（支持子文件夹结构）
    loadConfigurationFiles(files) {
        if (!files || files.length === 0) return;

        const configList = document.getElementById('configList');
        const configListGroup = document.getElementById('configListGroup');
        if (!configList || !configListGroup) return;

        // 清空现有列表
        configList.innerHTML = '';
        this.configFiles.clear();

        // 清空搜索框
        const configSearchInput = document.getElementById('configSearchInput');
        if (configSearchInput) {
            configSearchInput.value = '';
        }

        // 切换到自定义配置文件夹模式
        this.useDefaultConfigPath = false;
        console.log('已切换到自定义配置文件夹模式');

        // 处理每个文件，按文件夹结构组织
        let loadedCount = 0;
        const jsonFiles = Array.from(files).filter(file => file.name.endsWith('.json'));

        if (jsonFiles.length === 0) {
            this.showTooltip('未找到JSON配置文件', 1500);
            return;
        }

        // 按文件夹路径分组
        const filesByFolder = new Map();
        jsonFiles.forEach(file => {
            const pathParts = file.webkitRelativePath.split('/');
            const folderPath = pathParts.slice(0, -1).join('/') || '根目录';

            if (!filesByFolder.has(folderPath)) {
                filesByFolder.set(folderPath, []);
            }
            filesByFolder.get(folderPath).push(file);
        });

        // 存储所有配置数据，用于分组显示
        const allConfigs = [];

        // 按文件夹分组加载
        filesByFolder.forEach((files, folderPath) => {
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const config = JSON.parse(e.target.result);
                        const uniqueKey = folderPath !== '根目录' ? `${folderPath}/${file.name}` : file.name;
                        this.configFiles.set(uniqueKey, config);

                        allConfigs.push({
                            filename: file.name,
                            config: config,
                            folderPath: folderPath,
                            uniqueKey: uniqueKey
                        });

                        loadedCount++;

                        // 当所有文件都加载完成时按文件夹分组显示
                        if (loadedCount === jsonFiles.length) {
                            this.displayConfigsByFolder(allConfigs, filesByFolder);

                            // 保存配置文件夹路径（保存第一个文件夹的路径）
                            if (filesByFolder.size > 0) {
                                const firstFolder = Array.from(filesByFolder.keys())[0];
                                if (firstFolder !== '根目录') {
                                    localStorage.setItem('autoConfigPath', firstFolder);
                                    console.log('配置文件夹路径已保存:', firstFolder);
                                }
                            }

                            configListGroup.style.display = 'block';
                            this.showTooltip(`成功加载 ${loadedCount} 个配置文件，来自 ${filesByFolder.size} 个文件夹（自定义模式）`, 2000);
                        }
                    } catch (error) {
                        console.error(`解析配置文件 ${file.name} 失败:`, error);
                        loadedCount++;
                        if (loadedCount === jsonFiles.length && this.configFiles.size > 0) {
                            configListGroup.style.display = 'block';
                        }
                    }
                };
                reader.readAsText(file);
            });
        });

        this.showTooltip(`正在加载 ${jsonFiles.length} 个配置文件...`, 1500);
    }

    // 按文件夹分组显示配置文件
    displayConfigsByFolder(allConfigs, filesByFolder) {
        const configList = document.getElementById('configList');
        if (!configList) return;

        // 按文件夹路径排序
        const sortedFolders = Array.from(filesByFolder.keys()).sort();

        sortedFolders.forEach((folderPath, folderIndex) => {
            const folderConfigs = allConfigs.filter(item => item.folderPath === folderPath);
            folderConfigs.sort((a, b) => a.filename.localeCompare(b.filename));

            // 添加文件夹标题
            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-header';
            folderHeader.style.cssText = `
                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                padding: 6px 10px;
                margin: 8px 0 4px 0;
                border-radius: 4px;
                border-left: 3px solid #2196f3;
                font-weight: bold;
                color: #1565c0;
                font-size: 11px;
                display: flex;
                align-items: center;
                gap: 6px;
            `;

            const folderIcon = folderPath === '根目录' ? '🏠' : '📁';
            const displayPath = folderPath === '根目录' ? '根目录' : folderPath;
            const fileCount = filesByFolder.get(folderPath).length;

            folderHeader.innerHTML = `${folderIcon} ${displayPath} <span style="color: #666; font-weight: normal;">(${fileCount} 个文件)</span>`;
            configList.appendChild(folderHeader);

            // 添加该文件夹下的配置文件（带分页）
            this.displayConfigsPageWithFolder(folderConfigs, folderPath, folderIndex);
        });
    }

    displayConfigsPageWithFolder(configs, folderPath, folderIndex) {
        const configList = document.getElementById('configList');
        const pageKey = `folder_${folderIndex}`;
        const currentPage = this.configListCurrentPages?.[pageKey] || 1;

        const startIndex = (currentPage - 1) * this.configListPageSize;
        const endIndex = Math.min(startIndex + this.configListPageSize, configs.length);
        const pageConfigs = configs.slice(startIndex, endIndex);

        pageConfigs.forEach(item => {
            this.addConfigToList(item.filename, item.config, item.folderPath, item.uniqueKey);
        });

        if (configs.length > this.configListPageSize) {
            this.addFolderPaginationControls(configs, folderPath, pageKey);
        }
    }

    addFolderPaginationControls(configs, folderPath, pageKey) {
        const configList = document.getElementById('configList');
        const totalPages = Math.ceil(configs.length / this.configListPageSize);
        const currentPage = this.configListCurrentPages?.[pageKey] || 1;

        const paginationDiv = document.createElement('div');
        paginationDiv.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 6px;
            padding: 6px;
            margin-top: 4px;
            border-top: 1px solid #f0f0f0;
        `;

        const prevButton = document.createElement('button');
        prevButton.textContent = '上一页';
        prevButton.disabled = currentPage === 1;
        prevButton.style.cssText = `
            padding: 3px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            background: ${prevButton.disabled ? '#f5f5f5' : '#fff'};
            color: ${prevButton.disabled ? '#ccc' : '#333'};
            cursor: ${prevButton.disabled ? 'not-allowed' : 'pointer'};
            font-size: 10px;
        `;

        const pageInfo = document.createElement('div');
        pageInfo.textContent = `${currentPage} / ${totalPages}`;
        pageInfo.style.cssText = `
            font-size: 10px;
            color: #666;
            min-width: 35px;
            text-align: center;
        `;

        const nextButton = document.createElement('button');
        nextButton.textContent = '下一页';
        nextButton.disabled = currentPage === totalPages;
        nextButton.style.cssText = `
            padding: 3px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            background: ${nextButton.disabled ? '#f5f5f5' : '#fff'};
            color: ${nextButton.disabled ? '#ccc' : '#333'};
            cursor: ${nextButton.disabled ? 'not-allowed' : 'pointer'};
            font-size: 10px;
        `;

        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                if (!this.configListCurrentPages) this.configListCurrentPages = {};
                this.configListCurrentPages[pageKey] = currentPage - 1;
                this.refreshConfigListDisplay();
            }
        });

        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                if (!this.configListCurrentPages) this.configListCurrentPages = {};
                this.configListCurrentPages[pageKey] = currentPage + 1;
                this.refreshConfigListDisplay();
            }
        });

        paginationDiv.appendChild(prevButton);
        paginationDiv.appendChild(pageInfo);
        paginationDiv.appendChild(nextButton);

        configList.appendChild(paginationDiv);
    }

    addConfigToList(filename, config, folderPath = '', uniqueKey = null) {
        const configList = document.getElementById('configList');
        if (!configList) return;

        const listItem = document.createElement('div');
        listItem.className = 'config-item file-item';
        listItem.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 6px 8px;
            margin: 3px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s ease;
            min-height: 32px;
        `;

        listItem.addEventListener('mouseenter', () => {
            listItem.style.background = '#e3f2fd';
            listItem.style.borderColor = '#2196f3';
        });
        listItem.addEventListener('mouseleave', () => {
            listItem.style.background = '#f8f9fa';
            listItem.style.borderColor = '#e9ecef';
        });

        const shapeCount = config.shapes ? config.shapes.length : 0;

        const configKey = uniqueKey || (folderPath && folderPath !== '根目录' ? `${folderPath}/${filename}` : filename);

        const configInfo = document.createElement('div');
        configInfo.className = 'config-info';
        configInfo.style.flex = '1';
        configInfo.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            overflow: hidden;
        `;

        const timestamp = config.timestamp ? new Date(config.timestamp).toLocaleString('zh-CN') : '未知时间';

        const configName = document.createElement('div');
        configName.className = 'config-name';
        configName.style.cssText = `
            font-size: 12px;
            font-weight: 500;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
        `;
        configName.textContent = filename;
        configName.title = `${filename}\n图形数量: ${shapeCount}\n创建时间: ${timestamp}`;

        configInfo.appendChild(configName);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
        `;

        const loadButton = document.createElement('button');
        loadButton.className = 'load-config-btn';
        loadButton.textContent = '加载';
        loadButton.style.cssText = `
            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.2s ease;
            min-width: 40px;
        `;

        loadButton.addEventListener('mouseenter', () => {
            loadButton.style.background = 'linear-gradient(135deg, #45a049 0%, #3d8b40 100%)';
        });
        loadButton.addEventListener('mouseleave', () => {
            loadButton.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
        });

        loadButton.onclick = () => this.loadConfigurationWithDialog(configKey, config);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-config-btn';
        deleteButton.textContent = '×';
        deleteButton.style.cssText = `
            background: linear-gradient(135deg, #ff4757 0%, #ff3838 100%);
            color: white;
            border: none;
            padding: 2px 6px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            line-height: 1;
            min-width: 20px;
        `;

        deleteButton.addEventListener('mouseenter', () => {
            deleteButton.style.background = 'linear-gradient(135deg, #ff3838 0%, #d32f2f 100%)';
        });
        deleteButton.addEventListener('mouseleave', () => {
            deleteButton.style.background = 'linear-gradient(135deg, #ff4757 0%, #ff3838 100%)';
        });

        deleteButton.onclick = (e) => {
            e.stopPropagation();
            this.deleteConfigFromList(configKey, listItem);
        };

        buttonsDiv.appendChild(loadButton);
        buttonsDiv.appendChild(deleteButton);

        listItem.appendChild(configInfo);
        listItem.appendChild(buttonsDiv);
        configList.appendChild(listItem);
    }

    // 从列表中删除配置
    deleteConfigFromList(configKey, listItem) {
        const confirmed = confirm(`确定要从列表中删除配置 "${configKey}" 吗？`);
        if (confirmed) {
            this.configFiles.delete(configKey);
            listItem.remove();

            // 如果列表为空，隐藏列表组
            if (this.configFiles.size === 0) {
                const configListGroup = document.getElementById('configListGroup');
                if (configListGroup) {
                    configListGroup.style.display = 'none';
                }
            }

            this.showTooltip(`配置 "${configKey}" 已从列表中删除`, 2000);
        }
    }

    // 清空配置列表
    clearConfigList() {
        if (this.configFiles.size === 0) {
            this.showTooltip('配置列表已经是空的了', 1500);
            return;
        }

        const confirmed = confirm('确定要清空所有配置列表吗？\n\n这将恢复到默认配置文件夹模式。');
        if (confirmed) {
            this.configFiles.clear();

            const configList = document.getElementById('configList');
            const configListGroup = document.getElementById('configListGroup');
            if (configList) {
                configList.innerHTML = '';
            }
            if (configListGroup) {
                configListGroup.style.display = 'block';
            }

            localStorage.removeItem('autoConfigPath');

            // 恢复到默认配置文件夹模式
            this.useDefaultConfigPath = true;
            localStorage.removeItem('autoConfigPath');

            // 显示占位符
            this.updateConfigListPlaceholder('empty');

            // 尝试重新加载默认配置文件夹
            this.loadConfigsFromDefaultFolder().then(configs => {
                if (configs && configs.length > 0) {
                    this.showTooltip(`已清空列表并重新加载了 ${configs.length} 个默认配置`, 2000);
                } else {
                    this.showTooltip('配置列表已清空，未找到默认配置', 2000);
                }
            });
        }
    }

    // 重置到默认配置文件夹模式
    resetToDefaultConfigFolder() {
        const confirmed = confirm('确定要重置到默认配置文件夹吗？\n\n这将清除自定义配置，重新加载 ./configs/ 文件夹下的配置。');
        if (confirmed) {
            this.configFiles.clear();

            const configList = document.getElementById('configList');
            const configListGroup = document.getElementById('configListGroup');
            if (configList) {
                configList.innerHTML = '';
            }

            // 恢复到默认配置文件夹模式
            this.useDefaultConfigPath = true;
            localStorage.removeItem('autoConfigPath');

            // 重新加载默认配置文件夹
            this.loadConfigsFromDefaultFolder().then(configs => {
                if (configs && configs.length > 0) {
                    this.showTooltip(`已重置，加载了 ${configs.length} 个默认配置`, 2000);
                } else {
                    this.showTooltip('已重置，未找到默认配置文件', 2000);
                    configListGroup.style.display = 'none';
                }
            });
        }
    }

    // 显示对话框加载配置
    loadConfigurationWithDialog(filename, config) {
        this.pendingConfig = {
            filename: filename,
            config: config
        };
        this.showLoadConfigDialog(config);
    }

    loadConfiguration(filename, config = null, overwrite = true) {
        const configToLoad = config || this.configFiles.get(filename);
        if (!configToLoad) {
            this.showTooltip('配置文件不存在', 1500);
            return;
        }

        try {
            // 清空当前场景（如果是覆盖模式）
            if (overwrite) {
                this.shapes.forEach((mesh) => {
                    this.scene.remove(mesh);
                });
                this.shapes.clear();
                this.deselectShape();
            }

            // 恢复相机位置
            if (configToLoad.camera && overwrite) {
                this.camera.position.fromArray(configToLoad.camera.position);
                this.camera.rotation.fromArray(configToLoad.camera.rotation);
                if (configToLoad.camera.zoom) {
                    this.camera.zoom = configToLoad.camera.zoom;
                    this.camera.updateProjectionMatrix();
                }
            }

            // 恢复控制器目标
            if (configToLoad.controls && configToLoad.controls.target && overwrite) {
                this.controls.target.fromArray(configToLoad.controls.target);
            }

            // 恢复设置
            if (configToLoad.settings && overwrite) {
                if (configToLoad.settings.gridVisible !== undefined) {
                    this.gridHelper.visible = configToLoad.settings.gridVisible;
                }
                if (configToLoad.settings.shadowsEnabled !== undefined) {
                    this.renderer.shadowMap.enabled = configToLoad.settings.shadowsEnabled;
                }
            }

            // 重建图形
            if (configToLoad.shapes) {
                configToLoad.shapes.forEach(shapeData => {
                    this.loadShapeFromConfig(shapeData, overwrite);
                });
            }

            // 更新UI
            this.updateShapesList();
            this.controls.update();

            const modeText = overwrite ? '覆盖' : '追加';
            this.showTooltip(`配置 "${filename}" ${modeText}加载成功`, 2000);
        } catch (error) {
            console.error('加载配置失败:', error);
            this.showTooltip('加载配置失败，请检查文件格式', 2000);
        }
    }

    // 追加配置（不覆盖已有图形）
    appendConfiguration(config) {
        if (!config) {
            this.showTooltip('配置文件不存在', 1500);
            return;
        }

        try {
            // 重建图形
            if (config.shapes) {
                config.shapes.forEach(shapeData => {
                    this.loadShapeFromConfig(shapeData, false);
                });
            }

            // 更新UI
            this.updateShapesList();

            this.showTooltip(`配置追加成功，新增 ${config.shapes.length} 个图形`, 2000);
        } catch (error) {
            console.error('追加配置失败:', error);
            this.showTooltip('追加配置失败，请检查文件格式', 2000);
        }
    }

    loadShapeFromConfig(shapeData, overwrite = true) {
        try {
            // 创建几何体
            let geometry;
            const params = shapeData.parameters || {};

            switch (shapeData.type) {
                case 'cube':
                    geometry = new THREE.BoxGeometry(
                        params.width || 1,
                        params.height || 1,
                        params.depth || 1
                    );
                    break;
                case 'sphere':
                    geometry = new THREE.SphereGeometry(
                        params.radius || 0.5,
                        params.widthSegments || 32,
                        params.heightSegments || 16
                    );
                    break;
                case 'cylinder':
                    geometry = new THREE.CylinderGeometry(
                        params.radiusTop || 0.5,
                        params.radiusBottom || 0.5,
                        params.height || 1,
                        params.radialSegments || 32
                    );
                    break;
                case 'cone':
                    geometry = new THREE.ConeGeometry(
                        params.radius || 0.5,
                        params.height || 1,
                        params.radialSegments || 32
                    );
                    break;
                case 'torus':
                    geometry = new THREE.TorusGeometry(
                        params.radius || 0.5,
                        params.tube || 0.2,
                        params.radialSegments || 16,
                        params.tubularSegments || 100
                    );
                    break;
                default:
                    geometry = new THREE.BoxGeometry(1, 1, 1);
            }

            // 创建材质
            const material = this.createMaterial();
            material.color.setHex(shapeData.color || 0x00ff00);

            // 创建网格
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.fromArray(shapeData.position || [0, 0, 0]);
            mesh.rotation.fromArray(shapeData.rotation || [0, 0, 0]);
            mesh.scale.fromArray(shapeData.scale || [1, 1, 1]);
            mesh.visible = shapeData.visible !== undefined ? shapeData.visible : true;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // 设置用户数据 - 自动适配重名图形
            let shapeId = shapeData.id || this.generateShapeId();

            if (!overwrite) {
                // 追加模式下，检查是否重名
                while (this.shapes.has(shapeId)) {
                    // 如果重名，在ID后添加后缀
                    if (!shapeId.includes('_copy')) {
                        shapeId = shapeId + '_copy';
                    } else {
                        // 如果已经有_copy后缀，增加编号
                        const match = shapeId.match(/^(.*)_copy(\d*)$/);
                        if (match) {
                            const num = match[2] ? parseInt(match[2]) + 1 : 2;
                            shapeId = match[1] + '_copy' + num;
                        } else {
                            shapeId = shapeId + '_copy';
                        }
                    }
                }
            }

            mesh.userData = {
                id: shapeId,
                type: shapeData.type,
                parameters: params,
                originalScale: mesh.scale.clone(),
                isRainbow: false,
                ownMaterial: true,
                locked: shapeData.locked || false
            };

            // 重新居中几何体
            this.recenterGeometry(mesh);

            // 添加到场景和管理器
            this.scene.add(mesh);
            this.shapes.set(shapeId, mesh);

            // 限制图形位置，确保不低于网格
            this.constrainShapePosition(mesh);

            // 设置阴影
            mesh.castShadow = true;
            mesh.receiveShadow = true;

        } catch (error) {
            console.error('加载图形失败:', error);
        }
    }

    generateShapeId() {
        return 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 自动加载配置文件夹
    async autoLoadConfigFolder() {
        console.log('开始自动加载配置文件夹...');

        // 优先尝试读取默认的configs文件夹
        if (this.useDefaultConfigPath) {
            try {
                const configs = await this.loadConfigsFromDefaultFolder();
                if (configs && configs.length > 0) {
                    console.log('成功从默认配置文件夹加载', configs.length, '个配置文件');
                    this.showTooltip(`自动加载了 ${configs.length} 个配置文件`, 3000);
                    return;
                }
            } catch (error) {
                console.log('无法加载默认配置文件夹:', error);
            }
        }

        // 检查localStorage中是否有保存的配置文件夹信息
        const savedConfigPath = localStorage.getItem('autoConfigPath');
        if (savedConfigPath) {
            console.log('检测到上次使用的配置文件夹路径:', savedConfigPath);
            // 显示提示，让用户确认是否自动加载
            setTimeout(() => {
                const shouldLoad = confirm(`检测到上次使用的配置文件夹，是否自动加载配置文件？\n\n路径: ${savedConfigPath}`);
                if (shouldLoad) {
                    // 由于浏览器安全限制，无法直接读取文件夹路径
                    // 只能让用户重新选择文件夹
                    this.showTooltip('由于浏览器安全限制，请重新选择配置文件夹', 3000);
                    const configFolderInput = document.getElementById('configFolderInput');
                    if (configFolderInput) {
                        configFolderInput.click();
                    }
                } else {
                    // 清除保存的路径
                    localStorage.removeItem('autoConfigPath');
                }
            }, 1000);
        } else {
            console.log('没有找到保存的配置文件夹路径');
        }
    }

    // 从默认配置文件夹加载配置
    async loadConfigsFromDefaultFolder() {
        try {
            console.log('尝试从默认配置文件夹加载:', this.defaultConfigPath);

            // 清空搜索框
            const configSearchInput = document.getElementById('configSearchInput');
            if (configSearchInput) {
                configSearchInput.value = '';
            }

            this.updateConfigListPlaceholder('loading');

            // 尝试获取configs文件夹下的文件列表
            // 注意：这需要静态服务器支持，或者需要配置服务器返回文件列表
            // 这里我们尝试加载一个可能存在的配置索引文件

            const indexResponse = await fetch(`${this.defaultConfigPath}config-index.json`);
            if (indexResponse.ok) {
                const indexData = await indexResponse.json();
                console.log('找到配置索引文件:', indexData);

                if (indexData.files && indexData.files.length > 0) {
                    const loadedConfigs = [];

                    for (const fileName of indexData.files) {
                        try {
                            const fileResponse = await fetch(`${this.defaultConfigPath}${fileName}`);
                            if (fileResponse.ok) {
                                const config = await fileResponse.json();
                                this.configFiles.set(fileName, config);
                                loadedConfigs.push({ filename: fileName, config: config });
                            }
                        } catch (error) {
                            console.warn(`配置文件 ${fileName} 不存在或加载失败，跳过`);
                        }
                    }

                    // 显示配置列表
                    if (loadedConfigs.length > 0) {
                        this.displayConfigsFromList(loadedConfigs, '默认配置文件夹');
                        return loadedConfigs;
                    }
                }
            } else {
                console.log('未找到配置索引文件，尝试加载常见配置文件');
            }

            // 如果没有索引文件或没有文件列表，尝试加载常见的配置文件名
            const commonConfigNames = [
                'default-config.json',
                'my-config.json',
                'config.json',
                'scene-config.json',
                '3d-config.json'
            ];

            const loadedConfigs = [];
            for (const fileName of commonConfigNames) {
                try {
                    const fileResponse = await fetch(`${this.defaultConfigPath}${fileName}`);
                    if (fileResponse.ok) {
                        const config = await fileResponse.json();
                        this.configFiles.set(fileName, config);
                        loadedConfigs.push({ filename: fileName, config: config });
                        console.log('找到配置文件:', fileName);
                    }
                } catch (error) {
                    // 文件不存在，继续尝试下一个（不输出到控制台，避免大量404错误）
                }
            }

            // 显示配置列表
            if (loadedConfigs.length > 0) {
                this.displayConfigsFromList(loadedConfigs, '默认配置文件夹');
                return loadedConfigs;
            } else {
                console.log('未找到任何配置文件');
                this.updateConfigListPlaceholder('empty');
                return [];
            }
        } catch (error) {
            console.error('加载默认配置文件夹失败:', error);
            this.updateConfigListPlaceholder('error');
            // 不显示错误提示，因为这是正常的（用户可能没有创建configs文件夹）
            return [];
        }
    }

    // 更新配置列表占位符
    updateConfigListPlaceholder(status) {
        const placeholder = document.getElementById('configListPlaceholder');
        if (!placeholder) return;

        switch (status) {
            case 'loading':
                placeholder.innerHTML = `
                    <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
                    <div>正在加载配置文件...</div>
                `;
                placeholder.style.display = 'block';
                break;
            case 'empty':
                placeholder.innerHTML = `
                    <div style="font-size: 24px; margin-bottom: 8px;">📁</div>
                    <div>配置列表为空</div>
                    <div style="font-size: 11px; margin-top: 4px;">请在 ./configs/ 文件夹中添加配置文件</div>
                `;
                placeholder.style.display = 'block';
                break;
            case 'error':
                placeholder.innerHTML = `
                    <div style="font-size: 24px; margin-bottom: 8px;">❌</div>
                    <div>加载配置文件失败</div>
                    <div style="font-size: 11px; margin-top: 4px;">请检查网络连接或文件路径</div>
                `;
                placeholder.style.display = 'block';
                break;
            case 'hidden':
                placeholder.style.display = 'none';
                break;
        }
    }

    // 从配置列表显示配置文件
    displayConfigsFromList(configs, folderName) {
        const configList = document.getElementById('configList');
        const placeholder = document.getElementById('configListPlaceholder');
        if (!configList) return;

        this.configListCurrentPage = 1;

        // 清空现有列表
        configList.innerHTML = '';

        // 添加文件夹标题
        if (configs.length > 0) {
            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-header';
            folderHeader.style.cssText = `
                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                padding: 6px 10px;
                margin: 8px 0 4px 0;
                border-radius: 4px;
                border-left: 3px solid #2196f3;
                font-weight: bold;
                color: #1565c0;
                font-size: 11px;
                display: flex;
                align-items: center;
                gap: 6px;
            `;

            folderHeader.innerHTML = `📁 ${folderName} <span style="color: #666; font-weight: normal;">(${configs.length} 个文件)</span>`;
            configList.appendChild(folderHeader);
        }

        // 添加配置文件（带分页）
        this.displayConfigsPage(configs, folderName);

        // 添加分页控制
        if (configs.length > this.configListPageSize) {
            this.addPaginationControls(configs, folderName);
        }

        // 隐藏占位符
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }

    displayConfigsPage(configs, folderName) {
        const configList = document.getElementById('configList');

        const startIndex = (this.configListCurrentPage - 1) * this.configListPageSize;
        const endIndex = Math.min(startIndex + this.configListPageSize, configs.length);
        const pageConfigs = configs.slice(startIndex, endIndex);

        pageConfigs.sort((a, b) => a.filename.localeCompare(b.filename)).forEach(item => {
            this.addConfigToList(item.filename, item.config, folderName, item.filename);
        });
    }

    addPaginationControls(configs, folderName) {
        const configList = document.getElementById('configList');
        const totalPages = Math.ceil(configs.length / this.configListPageSize);

        const paginationDiv = document.createElement('div');
        paginationDiv.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            padding: 8px;
            margin-top: 8px;
            border-top: 1px solid #e9ecef;
        `;

        const prevButton = document.createElement('button');
        prevButton.textContent = '上一页';
        prevButton.disabled = this.configListCurrentPage === 1;
        prevButton.style.cssText = `
            padding: 4px 10px;
            border: 1px solid #ddd;
            border-radius: 3px;
            background: ${prevButton.disabled ? '#f5f5f5' : '#fff'};
            color: ${prevButton.disabled ? '#ccc' : '#333'};
            cursor: ${prevButton.disabled ? 'not-allowed' : 'pointer'};
            font-size: 11px;
        `;

        const pageInfo = document.createElement('div');
        pageInfo.textContent = `${this.configListCurrentPage} / ${totalPages}`;
        pageInfo.style.cssText = `
            font-size: 11px;
            color: #666;
            min-width: 40px;
            text-align: center;
        `;

        const nextButton = document.createElement('button');
        nextButton.textContent = '下一页';
        nextButton.disabled = this.configListCurrentPage === totalPages;
        nextButton.style.cssText = `
            padding: 4px 10px;
            border: 1px solid #ddd;
            border-radius: 3px;
            background: ${nextButton.disabled ? '#f5f5f5' : '#fff'};
            color: ${nextButton.disabled ? '#ccc' : '#333'};
            cursor: ${nextButton.disabled ? 'not-allowed' : 'pointer'};
            font-size: 11px;
        `;

        prevButton.addEventListener('click', () => {
            if (this.configListCurrentPage > 1) {
                this.configListCurrentPage--;
                this.refreshConfigListPage(configs, folderName);
            }
        });

        nextButton.addEventListener('click', () => {
            if (this.configListCurrentPage < totalPages) {
                this.configListCurrentPage++;
                this.refreshConfigListPage(configs, folderName);
            }
        });

        paginationDiv.appendChild(prevButton);
        paginationDiv.appendChild(pageInfo);
        paginationDiv.appendChild(nextButton);

        configList.appendChild(paginationDiv);
    }

    refreshConfigListPage(configs, folderName) {
        const configList = document.getElementById('configList');
        const placeholder = document.getElementById('configListPlaceholder');
        if (!configList) return;

        // 保存文件夹标题
        const folderHeader = configList.querySelector('.folder-header');
        const oldPagination = configList.querySelector('div[style*="display: flex; justify-content: center"]');

        configList.innerHTML = '';

        if (folderHeader) {
            configList.appendChild(folderHeader);
        }

        this.displayConfigsPage(configs, folderName);

        if (configs.length > this.configListPageSize) {
            this.addPaginationControls(configs, folderName);
        }

        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }

    // 根据关键字过滤配置文件
    filterConfigsByKeyword(keyword) {
        const configList = document.getElementById('configList');
        if (!configList) return;

        // 如果关键字为空，显示所有配置
        if (!keyword || keyword.trim() === '') {
            this.refreshConfigListDisplay();
            return;
        }

        // 转换为小写以便不区分大小写搜索
        const searchKeyword = keyword.toLowerCase().trim();

        // 过滤配置文件
        const filteredConfigs = [];
        this.configFiles.forEach((config, key) => {
            // 获取文件名（去掉路径）
            const filename = key.split('/').pop();

            // 检查文件名是否匹配关键字
            if (filename.toLowerCase().includes(searchKeyword)) {
                filteredConfigs.push({
                    filename: filename,
                    config: config,
                    folderPath: key.includes('/') ? key.substring(0, key.lastIndexOf('/')) : '',
                    uniqueKey: key
                });
            }

            // 也可以搜索配置中的图形类型
            if (config.shapes && config.shapes.length > 0) {
                const shapeTypes = config.shapes.map(s => s.type || '').join(' ');
                if (shapeTypes.toLowerCase().includes(searchKeyword)) {
                    if (!filteredConfigs.find(f => f.uniqueKey === key)) {
                        filteredConfigs.push({
                            filename: filename,
                            config: config,
                            folderPath: key.includes('/') ? key.substring(0, key.lastIndexOf('/')) : '',
                            uniqueKey: key
                        });
                    }
                }
            }
        });

        // 清空列表
        configList.innerHTML = '';

        // 显示过滤后的配置
        if (filteredConfigs.length > 0) {
            // 按文件夹分组显示
            const filesByFolder = new Map();
            filteredConfigs.forEach(item => {
                const folderPath = item.folderPath || '根目录';
                if (!filesByFolder.has(folderPath)) {
                    filesByFolder.set(folderPath, []);
                }
                filesByFolder.get(folderPath).push(item);
            });

            // 按文件夹分组显示
            filesByFolder.forEach((configs, folderPath) => {
                // 添加文件夹标题
                const folderHeader = document.createElement('div');
                folderHeader.className = 'folder-header';
                folderHeader.style.cssText = `
                    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                    padding: 8px 12px;
                    margin: 10px 0 5px 0;
                    border-radius: 5px;
                    border-left: 4px solid #ff9800;
                    font-weight: bold;
                    color: #e65100;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                `;

                const folderIcon = folderPath === '根目录' ? '🔍' : '🔍';
                const displayPath = folderPath === '根目录' ? '根目录' : folderPath;
                const fileCount = configs.length;

                folderHeader.innerHTML = `${folderIcon} ${displayPath} (搜索结果: ${fileCount} 个文件)`;
                configList.appendChild(folderHeader);

                // 添加该文件夹下的配置文件
                configs.sort((a, b) => a.filename.localeCompare(b.filename));
                configs.forEach(item => {
                    this.addConfigToList(item.filename, item.config, item.folderPath, item.uniqueKey);
                });
            });
        } else {
            // 显示没有搜索结果
            const noResults = document.createElement('div');
            noResults.style.cssText = `
                padding: 20px;
                text-align: center;
                color: #999;
                font-size: 13px;
            `;
            noResults.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
                <div>未找到匹配的配置文件</div>
                <div style="font-size: 11px; margin-top: 4px;">请尝试其他关键字</div>
            `;
            configList.appendChild(noResults);
        }
    }

    // 刷新配置列表显示（不重新加载）
    refreshConfigListDisplay() {
        if (this.useDefaultConfigPath) {
            // 如果使用默认路径，重新加载并显示
            this.loadConfigsFromDefaultFolder().then(configs => {
                if (configs && configs.length > 0) {
                    // 已经在loadConfigsFromDefaultFolder中调用了displayConfigsFromList
                }
            });
        } else {
            // 如果使用自定义路径，重新遍历configFiles并显示
            const configList = document.getElementById('configList');
            if (configList) {
                configList.innerHTML = '';
            }

            const allConfigs = [];
            this.configFiles.forEach((config, key) => {
                const filename = key.split('/').pop();
                const folderPath = key.includes('/') ? key.substring(0, key.lastIndexOf('/')) : '';
                allConfigs.push({
                    filename: filename,
                    config: config,
                    folderPath: folderPath,
                    uniqueKey: key
                });
            });

            // 按文件夹分组显示
            const filesByFolder = new Map();
            allConfigs.forEach(item => {
                const folderPath = item.folderPath || '根目录';
                if (!filesByFolder.has(folderPath)) {
                    filesByFolder.set(folderPath, []);
                }
                filesByFolder.get(folderPath).push(item);
            });

            this.displayConfigsByFolder(allConfigs, filesByFolder);
        }
    }

    // 手动刷新配置
    async refreshConfigs() {
        console.log('手动刷新配置...');
        this.configFiles.clear();

        const configList = document.getElementById('configList');
        if (configList) {
            configList.innerHTML = '';
        }

        // 清空搜索框
        const configSearchInput = document.getElementById('configSearchInput');
        if (configSearchInput) {
            configSearchInput.value = '';
        }

        const configs = await this.loadConfigsFromDefaultFolder();
        if (configs && configs.length > 0) {
            this.showTooltip(`刷新成功，加载了 ${configs.length} 个配置文件`, 2000);
        } else {
            this.showTooltip('未找到配置文件', 2000);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // 图形大小控制方法
    updateShapeScale(axis, value) {
         if (!this.selectedShape) return;
         
         const axisMap = {
             'scaleX': 'x',
             'scaleY': 'y', 
             'scaleZ': 'z'
         };
         
         const scaleAxis = axisMap[axis];
         if (scaleAxis) {
             this.selectedShape.scale[scaleAxis] = value;
             
             // 如果启用了等比缩放模式，同步其他轴
             if (this.uniformScaleMode) {
                 this.selectedShape.scale.x = value;
                 this.selectedShape.scale.y = value;
                 this.selectedShape.scale.z = value;
                 
                 // 更新所有滑块的值
                 ['scaleX', 'scaleY', 'scaleZ'].forEach(id => {
                     const slider = document.getElementById(id);
                     const valueDisplay = document.getElementById(id + 'Value');
                     if (slider && valueDisplay) {
                         slider.value = value;
                         valueDisplay.textContent = value.toFixed(1);
                     }
                 });
             }
             
              // 检查图形是否超出网格边界并动态调整网格
              this.checkAndUpdateGrid();
              
              // 更新保存的缩放值，确保移动和复制时保持当前大小
              this.selectedShape.userData.originalScale = this.selectedShape.scale.clone();
          }
      }
    
    resetShapeScale() {
         if (!this.selectedShape) return;
         
         // 重置图形缩放为1
         this.selectedShape.scale.set(1, 1, 1);
         
         // 更新保存的缩放值
         this.selectedShape.userData.originalScale = this.selectedShape.scale.clone();
         
          // 更新滑块值
          ['scaleX', 'scaleY', 'scaleZ'].forEach(id => {
              const slider = document.getElementById(id);
              const valueDisplay = document.getElementById(id + 'Value');
              if (slider && valueDisplay) {
                  slider.value = 1;
                  valueDisplay.textContent = '1.0';
              }
          });
      }
    
    toggleUniformScale() {
        this.uniformScaleMode = !this.uniformScaleMode;
        
        const btn = document.getElementById('uniformScale');
        if (btn) {
            if (this.uniformScaleMode) {
                btn.style.background = '#28a745';
                btn.textContent = '等比模式';
                
                // 如果有选中的图形，将所有轴设置为X轴的值
                if (this.selectedShape) {
                    const currentScale = this.selectedShape.scale.x;
                    this.selectedShape.scale.set(currentScale, currentScale, currentScale);
                    
                    ['scaleX', 'scaleY', 'scaleZ'].forEach(id => {
                        const slider = document.getElementById(id);
                        const valueDisplay = document.getElementById(id + 'Value');
                        if (slider && valueDisplay) {
                            slider.value = currentScale;
                            valueDisplay.textContent = currentScale.toFixed(1);
                        }
                    });
                }
            } else {
                btn.style.background = '#17a2b8';
                btn.textContent = '等比缩放';
            }
         }
     }
     
      // 显示图形位置控制面板
      showShapePositionControls(mesh) {
          const controls = document.getElementById('shapePositionControls');
          if (controls) {
              controls.style.display = 'block';
              
              // 同时显示变换模式控制组
              this.showTransformModeControls();

              // 更新滑块值为当前图形的位置值
              const positionValues = {
                  'posX': mesh.position.x,
                  'posY': mesh.position.y,
                  'posZ': mesh.position.z
              };

              Object.entries(positionValues).forEach(([id, value]) => {
                  const slider = document.getElementById(id);
                  const valueDisplay = document.getElementById(id + 'Value');
                  if (slider && valueDisplay) {
                      slider.value = value;
                      valueDisplay.textContent = value.toFixed(1);
                  }
              });
          }
      }

      // 隐藏图形位置控制面板
      hideShapePositionControls() {
          const controls = document.getElementById('shapePositionControls');
          if (controls) {
              controls.style.display = 'none';
          }
          
          // 同时隐藏变换模式控制组
          const transformModeControls = document.getElementById('transformModeControls');
          if (transformModeControls) {
              transformModeControls.style.display = 'none';
          }
      }
      
      // 显示变换模式控制组
      showTransformModeControls() {
          const controls = document.getElementById('transformModeControls');
          if (controls) {
              controls.style.display = 'block';
          }
      }
      
      // 隐藏变换模式控制组
      hideTransformModeControls() {
          const controls = document.getElementById('transformModeControls');
          if (controls) {
              controls.style.display = 'none';
          }
      }

     // 更新图形位置
     updateShapePosition(axis, value) {
         if (!this.selectedShape) return;

         const axisMap = {
             'posX': 'x',
             'posY': 'y',
             'posZ': 'z'
         };

         const positionAxis = axisMap[axis];
         if (positionAxis) {
             this.selectedShape.position[positionAxis] = value;

             // 限制图形位置，确保不低于网格
             this.constrainShapePosition(this.selectedShape);

             // 更新图形信息显示
             this.updateShapeInfo(this.selectedShape);

             // 更新选择框
             const selectionBox = this.scene.getObjectByName('selectionBox');
             if (selectionBox) {
                 selectionBox.update();
             }
         }
     }

      // 重置图形位置
      resetShapePosition() {
          if (!this.selectedShape) return;

          const defaultPosition = { x: 10, y: 5, z: 10 };

          this.selectedShape.position.set(defaultPosition.x, defaultPosition.y, defaultPosition.z);

          // 限制图形位置，确保不低于网格
          this.constrainShapePosition(this.selectedShape);

          // 更新滑块值
         ['posX', 'posY', 'posZ'].forEach(id => {
             const slider = document.getElementById(id);
             const valueDisplay = document.getElementById(id + 'Value');
             if (slider && valueDisplay) {
                 const axis = { 'posX': 'x', 'posY': 'y', 'posZ': 'z' }[id];
                 slider.value = defaultPosition[axis];
                 valueDisplay.textContent = defaultPosition[axis].toFixed(1);
             }
         });

         // 更新图形信息显示
         this.updateShapeInfo(this.selectedShape);

         // 更新选择框
         const selectionBox = this.scene.getObjectByName('selectionBox');
         if (selectionBox) {
             selectionBox.update();
         }
     }

     // 显示图形大小控制面板
     showShapeSizeControls(mesh) {
         const controls = document.getElementById('shapeSizeControls');
         if (controls) {
             controls.style.display = 'block';
             
             // 更新滑块值为当前图形的缩放值
             const scaleValues = {
                 'scaleX': mesh.scale.x,
                 'scaleY': mesh.scale.y,
                 'scaleZ': mesh.scale.z
             };
             
             Object.entries(scaleValues).forEach(([id, value]) => {
                 const slider = document.getElementById(id);
                 const valueDisplay = document.getElementById(id + 'Value');
                 if (slider && valueDisplay) {
                     slider.value = value;
                     valueDisplay.textContent = value.toFixed(1);
                 }
             });
         }
     }
     
      // 隐藏图形大小控制面板
      hideShapeSizeControls() {
          const controls = document.getElementById('shapeSizeControls');
          if (controls) {
              controls.style.display = 'none';
          }
      }

      // 显示材质控制面板
      showMaterialControls(mesh) {
          const controls = document.getElementById('materialControls');
          if (controls) {
              controls.style.display = 'block';

              // 更新滑块值为当前图形的材质值
              if (mesh.material) {
                  document.getElementById('metalness').value = mesh.material.metalness || 0.15;
                  document.getElementById('metalnessValue').textContent = (mesh.material.metalness || 0.15).toFixed(2);

                  document.getElementById('roughness').value = mesh.material.roughness || 0.25;
                  document.getElementById('roughnessValue').textContent = (mesh.material.roughness || 0.25).toFixed(2);

                  document.getElementById('opacity').value = mesh.material.opacity || 0.95;
                  document.getElementById('opacityValue').textContent = (mesh.material.opacity || 0.95).toFixed(2);

                  document.getElementById('clearcoat').value = mesh.material.clearcoat || 0.3;
                  document.getElementById('clearcoatValue').textContent = (mesh.material.clearcoat || 0.3).toFixed(2);

                  document.getElementById('reflectivity').value = mesh.material.reflectivity || 0.5;
                  document.getElementById('reflectivityValue').textContent = (mesh.material.reflectivity || 0.5).toFixed(2);
              }
          }
      }

      // 隐藏材质控制面板
      hideMaterialControls() {
          const controls = document.getElementById('materialControls');
          if (controls) {
              controls.style.display = 'none';
          }
      }

      // 检查图形边界并动态调整网格大小
     checkAndUpdateGrid() {
         if (!this.selectedShape) return;
         
         // 计算图形的实际边界框
         const box = new THREE.Box3().setFromObject(this.selectedShape);
         const size = box.getSize(new THREE.Vector3());
         const center = box.getCenter(new THREE.Vector3());
         
         // 计算需要的最小网格大小（添加一些边距）
         const margin = 5;
         const maxX = Math.max(Math.abs(center.x) + size.x/2 + margin, 20);
         const maxZ = Math.max(Math.abs(center.z) + size.z/2 + margin, 20);
         const requiredGridSize = Math.max(maxX, maxZ) * 2;
         
         // 获取当前网格
         const currentGrid = this.scene.children.find(child => child.type === 'GridHelper');
         if (currentGrid) {
             const currentSize = currentGrid.geometry.parameters ? currentGrid.geometry.parameters.size : 20;
             
             // 如果需要更大的网格，则更新
             if (requiredGridSize > currentSize) {
                 this.updateGridSize(requiredGridSize);
             }
         }
     }
     
      // 更新网格大小
      updateGridSize(newSize) {
          // 移除现有网格
          const existingGrid = this.scene.children.find(child => child.type === 'GridHelper');
          if (existingGrid) {
              this.scene.remove(existingGrid);
          }

          // 获取当前网格颜色
          const gridColorInput = document.getElementById('gridColor');
          const gridColorHex = gridColorInput ? parseInt(gridColorInput.value.replace('#', '0x')) : 0x444444;

          // 创建新的更大网格
          const divisions = Math.max(40, Math.floor(newSize / 0.5));
          const gridHelper = new THREE.GridHelper(newSize, divisions, gridColorHex, 0x222222);
          gridHelper.position.set(newSize/2, 0, newSize/2);
          this.scene.add(gridHelper);

          // 显示提示信息
           this.showTooltip(`网格已扩大至 ${newSize.toFixed(0)}x${newSize.toFixed(0)} 以适应图形大小`, 2000);
       }

      // 材质参数控制方法
      updateSelectedShapeMaterial(param, value) {
          if (!this.selectedShape || !this.selectedShape.material) return;

          // 确保材质是独立的
          if (!this.selectedShape.userData.ownMaterial) {
              this.selectedShape.material = this.selectedShape.material.clone();
              this.selectedShape.userData.ownMaterial = true;
          }

          switch(param) {
              case 'metalness':
                  this.selectedShape.material.metalness = value;
                  break;
              case 'roughness':
                  this.selectedShape.material.roughness = value;
                  break;
              case 'opacity':
                  this.selectedShape.material.opacity = value;
                  this.selectedShape.material.transparent = value < 1;
                  break;
              case 'clearcoat':
                  this.selectedShape.material.clearcoat = value;
                  break;
              case 'reflectivity':
                  this.selectedShape.material.reflectivity = value;
                  break;
          }
      }

      resetSelectedShapeMaterial() {
          if (!this.selectedShape || !this.selectedShape.material) return;

          // 重置为默认值
          document.getElementById('metalness').value = 0.15;
          document.getElementById('metalnessValue').textContent = '0.15';
          this.updateSelectedShapeMaterial('metalness', 0.15);

          document.getElementById('roughness').value = 0.25;
          document.getElementById('roughnessValue').textContent = '0.25';
          this.updateSelectedShapeMaterial('roughness', 0.25);

          document.getElementById('opacity').value = 0.95;
          document.getElementById('opacityValue').textContent = '0.95';
          this.updateSelectedShapeMaterial('opacity', 0.95);

          document.getElementById('clearcoat').value = 0.3;
          document.getElementById('clearcoatValue').textContent = '0.30';
          this.updateSelectedShapeMaterial('clearcoat', 0.3);

          document.getElementById('reflectivity').value = 0.5;
          document.getElementById('reflectivityValue').textContent = '0.50';
          this.updateSelectedShapeMaterial('reflectivity', 0.5);

          this.showTooltip('材质参数已重置', 1500);
      }

      // 光照系统控制方法
      updateMainLightIntensity(value) {
          const directionalLight = this.scene.children.find(child => child.type === 'DirectionalLight');
          if (directionalLight) {
              directionalLight.intensity = value;
          }
      }

      updateAmbientLightIntensity(value) {
          const ambientLight = this.scene.children.find(child => child.type === 'AmbientLight');
          if (ambientLight) {
              ambientLight.intensity = value;
          }
      }

      updateMainLightColor(colorHex) {
          const color = parseInt(colorHex.replace('#', '0x'));
          const directionalLight = this.scene.children.find(child => child.type === 'DirectionalLight');
          if (directionalLight) {
              directionalLight.color.setHex(color);
          }
      }

      updateLightPosition() {
          const x = parseFloat(document.getElementById('lightPositionX').value);
          const y = parseFloat(document.getElementById('lightPositionY').value);
          const z = parseFloat(document.getElementById('lightPositionZ').value);

          const directionalLight = this.scene.children.find(child => child.type === 'DirectionalLight');
          if (directionalLight) {
              directionalLight.position.set(x, y, z);
          }
      }

      resetLighting() {
          // 重置主光源
          document.getElementById('mainLightIntensity').value = 1.2;
          document.getElementById('mainLightIntensityValue').textContent = '1.2';
          this.updateMainLightIntensity(1.2);

          document.getElementById('ambientLightIntensity').value = 0.5;
          document.getElementById('ambientLightIntensityValue').textContent = '0.5';
          this.updateAmbientLightIntensity(0.5);

          document.getElementById('mainLightColor').value = '#ffffff';
          document.getElementById('mainLightColorValue').textContent = '#ffffff';
          this.updateMainLightColor('#ffffff');

          document.getElementById('lightPositionX').value = 15;
          document.getElementById('lightPositionXValue').textContent = '15';
          document.getElementById('lightPositionY').value = 15;
          document.getElementById('lightPositionYValue').textContent = '15';
          document.getElementById('lightPositionZ').value = 10;
          document.getElementById('lightPositionZValue').textContent = '10';
          this.updateLightPosition();

          this.showTooltip('光照设置已重置', 1500);
      }

      // 环境设置方法
      updateBackgroundColor(colorHex) {
          const color = parseInt(colorHex.replace('#', '0x'));
          this.scene.background = new THREE.Color(color);
      }

      updateGridColor(colorHex) {
          const color = parseInt(colorHex.replace('#', '0x'));
          const grid = this.scene.children.find(child => child.type === 'GridHelper');
          if (grid) {
              const size = grid.geometry.parameters ? grid.geometry.parameters.size : 20;
              const divisions = grid.geometry.parameters ? grid.geometry.parameters.divisions : 40;
              this.scene.remove(grid);

              const newGrid = new THREE.GridHelper(size, divisions, color, 0x222222);
              newGrid.position.copy(grid.position);
              this.scene.add(newGrid);
          }
      }

      resetEnvironment() {
          document.getElementById('backgroundColor').value = '#f0f0f0';
          document.getElementById('backgroundColorValue').textContent = '#f0f0f0';
          this.updateBackgroundColor('#f0f0f0');

          document.getElementById('gridColor').value = '#444444';
          document.getElementById('gridColorValue').textContent = '#444444';
          this.updateGridColor('#444444');

          document.getElementById('gridSize').value = 20;
          document.getElementById('gridSizeValue').textContent = '20';
          this.updateGridSize(20);

          this.showTooltip('环境设置已重置', 1500);
      }

      // 图形尺寸参数方法
      showGeometryControls() {
          const controls = document.getElementById('geometryControls');
          const geometryParams = document.getElementById('geometryParams');
          const geometrySliders = document.getElementById('geometrySliders');

          if (controls) {
              controls.style.display = 'block';

              if (this.selectedShape) {
                  const type = this.selectedShape.userData.type;
                  let paramsHtml = '';

                  switch(type) {
                      case 'cube':
                          paramsHtml = '立方体参数: 宽度、高度、深度';
                          break;
                      case 'sphere':
                          paramsHtml = '球体参数: 半径';
                          break;
                      case 'cylinder':
                          paramsHtml = '圆柱体参数: 半径、高度';
                          break;
                      case 'cone':
                          paramsHtml = '圆锥体参数: 半径、高度';
                          break;
                      case 'pyramid':
                          paramsHtml = '四角锥参数: 半径、高度';
                          break;
                      case 'torus':
                          paramsHtml = '环形体参数: 半径、管道半径';
                          break;
                      case 'dodecahedron':
                          paramsHtml = '十二面体参数: 半径';
                          break;
                      case 'icosahedron':
                          paramsHtml = '二十面体参数: 半径';
                          break;
                      default:
                          paramsHtml = '未知图形类型';
                  }

                  geometryParams.innerHTML = `<strong>图形类型:</strong> ${this.selectedShape.userData.type}<br><strong>可用参数:</strong> ${paramsHtml}`;

                  // 生成对应的滑块
                  geometrySliders.innerHTML = this.generateGeometrySliders(type);
              }
          }
      }

      hideGeometryControls() {
          const controls = document.getElementById('geometryControls');
          if (controls) {
              controls.style.display = 'none';
          }
      }

      generateGeometrySliders(type) {
          let slidersHtml = '';

          switch(type) {
              case 'cube':
                  slidersHtml = `
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">宽度:</label>
                          <div class="slider-container">
                              <input type="range" id="geoWidth" min="0.5" max="5" step="0.1" value="2" style="width: 100%;">
                              <span class="slider-value" id="geoWidthValue">2.0</span>
                          </div>
                      </div>
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">高度:</label>
                          <div class="slider-container">
                              <input type="range" id="geoHeight" min="0.5" max="5" step="0.1" value="2" style="width: 100%;">
                              <span class="slider-value" id="geoHeightValue">2.0</span>
                          </div>
                      </div>
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">深度:</label>
                          <div class="slider-container">
                              <input type="range" id="geoDepth" min="0.5" max="5" step="0.1" value="2" style="width: 100%;">
                              <span class="slider-value" id="geoDepthValue">2.0</span>
                          </div>
                      </div>
                  `;
                  break;
              case 'sphere':
                  slidersHtml = `
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">半径:</label>
                          <div class="slider-container">
                              <input type="range" id="geoRadius" min="0.5" max="3" step="0.1" value="1.5" style="width: 100%;">
                              <span class="slider-value" id="geoRadiusValue">1.5</span>
                          </div>
                      </div>
                  `;
                  break;
              case 'cylinder':
              case 'cone':
              case 'pyramid':
                  slidersHtml = `
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">半径:</label>
                          <div class="slider-container">
                              <input type="range" id="geoRadius" min="0.5" max="3" step="0.1" value="1" style="width: 100%;">
                              <span class="slider-value" id="geoRadiusValue">1.0</span>
                          </div>
                      </div>
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">高度:</label>
                          <div class="slider-container">
                              <input type="range" id="geoHeight" min="0.5" max="6" step="0.1" value="3" style="width: 100%;">
                              <span class="slider-value" id="geoHeightValue">3.0</span>
                          </div>
                      </div>
                  `;
                  break;
              case 'torus':
                  slidersHtml = `
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">半径:</label>
                          <div class="slider-container">
                              <input type="range" id="geoRadius" min="0.5" max="3" step="0.1" value="1.5" style="width: 100%;">
                              <span class="slider-value" id="geoRadiusValue">1.5</span>
                          </div>
                      </div>
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">管道半径:</label>
                          <div class="slider-container">
                              <input type="range" id="geoTube" min="0.1" max="1" step="0.05" value="0.5" style="width: 100%;">
                              <span class="slider-value" id="geoTubeValue">0.5</span>
                          </div>
                      </div>
                  `;
                  break;
              case 'dodecahedron':
              case 'icosahedron':
                  slidersHtml = `
                      <div style="margin-bottom: 8px;">
                          <label style="font-size: 12px;">半径:</label>
                          <div class="slider-container">
                              <input type="range" id="geoRadius" min="0.5" max="3" step="0.1" value="1.5" style="width: 100%;">
                              <span class="slider-value" id="geoRadiusValue">1.5</span>
                          </div>
                      </div>
                  `;
                  break;
          }

          return slidersHtml;
      }

      applyGeometryChanges() {
          if (!this.selectedShape) return;

          const type = this.selectedShape.userData.type;
          let newGeometry;

          switch(type) {
              case 'cube':
                  const width = parseFloat(document.getElementById('geoWidth').value);
                  const height = parseFloat(document.getElementById('geoHeight').value);
                  const depth = parseFloat(document.getElementById('geoDepth').value);
                  newGeometry = new THREE.BoxGeometry(width, height, depth);
                  break;
              case 'sphere':
                  const radius = parseFloat(document.getElementById('geoRadius').value);
                  newGeometry = new THREE.SphereGeometry(radius, 32, 32);
                  break;
              case 'cylinder':
                  const cylRadius = parseFloat(document.getElementById('geoRadius').value);
                  const cylHeight = parseFloat(document.getElementById('geoHeight').value);
                  newGeometry = new THREE.CylinderGeometry(cylRadius, cylRadius, cylHeight, 32);
                  break;
              case 'cone':
              case 'pyramid':
                  const coneRadius = parseFloat(document.getElementById('geoRadius').value);
                  const coneHeight = parseFloat(document.getElementById('geoHeight').value);
                  const segments = type === 'pyramid' ? 4 : 32;
                  newGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, segments);
                  break;
              case 'torus':
                  const torusRadius = parseFloat(document.getElementById('geoRadius').value);
                  const tubeRadius = parseFloat(document.getElementById('geoTube').value);
                  newGeometry = new THREE.TorusGeometry(torusRadius, tubeRadius, 16, 100);
                  break;
              case 'dodecahedron':
                  const dodecaRadius = parseFloat(document.getElementById('geoRadius').value);
                  newGeometry = new THREE.DodecahedronGeometry(dodecaRadius);
                  break;
              case 'icosahedron':
                  const icosaRadius = parseFloat(document.getElementById('geoRadius').value);
                  newGeometry = new THREE.IcosahedronGeometry(icosaRadius);
                  break;
          }

          if (newGeometry) {
              // 优化新几何体
              newGeometry = this.optimizeGeometry(newGeometry);

              // 更新图形的几何体
              this.selectedShape.geometry.dispose();
              this.selectedShape.geometry = newGeometry;

              // 重新居中几何体
              this.recenterGeometry(this.selectedShape);

              // 限制位置确保不低于网格
              this.constrainShapePosition(this.selectedShape);

              // 更新信息显示
              this.updateShapeInfo(this.selectedShape);

              this.showTooltip('图形尺寸已更新', 1500);
          }
      }

       // 执行真正的几何切割
       performGeometryCutting(mesh, cuttingPlane, capMode = 'seal') {
         if (!mesh || !mesh.geometry || !cuttingPlane) return;

         // 获取几何体的顶点
         const geometry = mesh.geometry;
         const positionAttribute = geometry.getAttribute('position');
         if (!positionAttribute) return;

         // 将切割平面转换到物体的本地坐标系
         const localPlane = cuttingPlane.clone();
         const worldToLocal = mesh.matrixWorld.clone().invert();
         localPlane.applyMatrix4(worldToLocal);

         // 创建新的几何体用于存储切割后的结果
         const vertices = [];
         const indices = [];
         const normals = [];
         const uvs = [];

         // 获取原始数据
         const positions = positionAttribute.array;
         const originalNormals = geometry.getAttribute('normal')?.array;
         const originalUVs = geometry.getAttribute('uv')?.array;
         const indexAttribute = geometry.getIndex();

         // 顶点映射表，用于避免重复顶点
         const vertexMap = new Map();
         let vertexIndex = 0;

         const addVertex = (pos, normal, uv) => {
             const key = `${pos.x.toFixed(6)},${pos.y.toFixed(6)},${pos.z.toFixed(6)}`;
             if (vertexMap.has(key)) {
                 return vertexMap.get(key);
             }

             vertices.push(pos.x, pos.y, pos.z);
             normals.push(normal.x, normal.y, normal.z);
             uvs.push(uv.x, uv.y);

             vertexMap.set(key, vertexIndex);
             return vertexIndex++;
         };

         if (!indexAttribute) {
             // 处理非索引几何体
             for (let i = 0; i < positions.length; i += 9) {
                 const triangle = [
                     new THREE.Vector3(positions[i], positions[i+1], positions[i+2]),
                     new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5]),
                     new THREE.Vector3(positions[i+6], positions[i+7], positions[i+8])
                 ];

                 // 获取原始法向量和UV
                 const triangleNormals = originalNormals ? [
                     new THREE.Vector3(originalNormals[i], originalNormals[i+1], originalNormals[i+2]),
                     new THREE.Vector3(originalNormals[i+3], originalNormals[i+4], originalNormals[i+5]),
                     new THREE.Vector3(originalNormals[i+6], originalNormals[i+7], originalNormals[i+8])
                 ] : null;

                 const triangleUVs = originalUVs ? [
                     new THREE.Vector2(originalUVs[i/3*2], originalUVs[i/3*2+1]),
                     new THREE.Vector2(originalUVs[i/3*2+2], originalUVs[i/3*2+3]),
                     new THREE.Vector2(originalUVs[i/3*2+4], originalUVs[i/3*2+5])
                 ] : null;

                 const clippedTriangles = this.clipTriangleByPlaneAdvanced(triangle, localPlane, triangleNormals, triangleUVs);

                 clippedTriangles.forEach(tri => {
                     const idx0 = addVertex(tri.vertices[0], tri.normals[0], tri.uvs[0]);
                     const idx1 = addVertex(tri.vertices[1], tri.normals[1], tri.uvs[1]);
                     const idx2 = addVertex(tri.vertices[2], tri.normals[2], tri.uvs[2]);
                     indices.push(idx0, idx1, idx2);
                 });
             }
         } else {
             // 处理索引几何体
             const indexArray = indexAttribute.array;

             for (let i = 0; i < indexArray.length; i += 3) {
                 const i1 = indexArray[i];
                 const i2 = indexArray[i + 1];
                 const i3 = indexArray[i + 2];

                 const triangle = [
                     new THREE.Vector3(positions[i1*3], positions[i1*3+1], positions[i1*3+2]),
                     new THREE.Vector3(positions[i2*3], positions[i2*3+1], positions[i2*3+2]),
                     new THREE.Vector3(positions[i3*3], positions[i3*3+1], positions[i3*3+2])
                 ];

                 // 获取原始法向量和UV
                 const triangleNormals = originalNormals ? [
                     new THREE.Vector3(originalNormals[(i1)*3], originalNormals[(i1)*3+1], originalNormals[(i1)*3+2]),
                     new THREE.Vector3(originalNormals[(i2)*3], originalNormals[(i2)*3+1], originalNormals[(i2)*3+2]),
                     new THREE.Vector3(originalNormals[(i3)*3], originalNormals[(i3)*3+1], originalNormals[(i3)*3+2])
                 ] : null;

                 const triangleUVs = originalUVs ? [
                     new THREE.Vector2(originalUVs[i1*2], originalUVs[i1*2+1]),
                     new THREE.Vector2(originalUVs[i2*2], originalUVs[i2*2+1]),
                     new THREE.Vector2(originalUVs[i3*2], originalUVs[i3*2+1])
                 ] : null;

                 const clippedTriangles = this.clipTriangleByPlaneAdvanced(triangle, localPlane, triangleNormals, triangleUVs);

                 clippedTriangles.forEach(tri => {
                     const idx0 = addVertex(tri.vertices[0], tri.normals[0], tri.uvs[0]);
                     const idx1 = addVertex(tri.vertices[1], tri.normals[1], tri.uvs[1]);
                     const idx2 = addVertex(tri.vertices[2], tri.normals[2], tri.uvs[2]);
                     indices.push(idx0, idx1, idx2);
                 });
             }
         }

         // 根据切割模式决定是否生成切割面
         if (capMode === 'seal') {
             // 生成切割面
             const capVertices = [];
             const capIndices = [];
             const capNormals = [];
             const capUVs = [];

             // 收集所有在切割平面上的边
             const edgesOnPlane = [];

             // 重新遍历原始三角形，找到与平面相交的边
             if (!indexAttribute) {
                 for (let i = 0; i < positions.length; i += 9) {
                     const triangle = [
                         new THREE.Vector3(positions[i], positions[i+1], positions[i+2]),
                         new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5]),
                         new THREE.Vector3(positions[i+6], positions[i+7], positions[i+8])
                     ];

                     this.findPlaneIntersectionEdges(triangle, localPlane, edgesOnPlane);
                 }
             } else {
                 const indexArray = indexAttribute.array;
                 for (let i = 0; i < indexArray.length; i += 3) {
                     const i1 = indexArray[i];
                     const i2 = indexArray[i + 1];
                     const i3 = indexArray[i + 2];

                     const triangle = [
                         new THREE.Vector3(positions[i1*3], positions[i1*3+1], positions[i1*3+2]),
                         new THREE.Vector3(positions[i2*3], positions[i2*3+1], positions[i2*3+2]),
                         new THREE.Vector3(positions[i3*3], positions[i3*3+1], positions[i3*3+2])
                     ];

                     this.findPlaneIntersectionEdges(triangle, localPlane, edgesOnPlane);
                 }
             }

             // 如果有足够的边，尝试生成切割面
             if (edgesOnPlane.length >= 3) {
                 const capGeometry = this.generateCapGeometry(edgesOnPlane, localPlane);
                 if (capGeometry.vertices.length > 0) {
                     const capStartIndex = vertices.length / 3;

                     // 添加切割面顶点
                     capGeometry.vertices.forEach(vertex => {
                         vertices.push(vertex.x, vertex.y, vertex.z);
                     });

                     // 添加切割面法向量
                     capGeometry.normals.forEach(normal => {
                         normals.push(normal.x, normal.y, normal.z);
                     });

                     // 添加切割面UV
                     capGeometry.uvs.forEach(uv => {
                         uvs.push(uv.x, uv.y);
                     });

                     // 添加切割面索引
                     capGeometry.indices.forEach(index => {
                         indices.push(capStartIndex + index);
                     });
                 }
             }
         }

         // 创建新的几何体
         if (vertices.length > 0) {
             const newGeometry = new THREE.BufferGeometry();
             newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
             newGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
             newGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

             if (indices.length > 0) {
                 newGeometry.setIndex(indices);
             }

             // 重新计算法向量以获得更平滑的效果
             newGeometry.computeVertexNormals();

             // 更新几何体
             mesh.geometry.dispose();
             mesh.geometry = newGeometry;
             mesh.geometry.computeBoundingBox();
             mesh.geometry.computeBoundingSphere();

             // 重新居中几何体
             this.recenterGeometry(mesh);
         } else {
             // 如果切割后没有剩余顶点，隐藏图形
             mesh.visible = false;
             console.warn('切割后图形没有剩余顶点，已隐藏');
         }
     }

     // 使用CSG库进行切割（适用于布尔运算后的图形）
     performCSGCutting(cuttingPlane, capMode = 'seal') {
          if (!window.CSG || !window.CSG.Evaluator) {
              this.showTooltip('CSG库未加载，使用几何体切割', 1500);
              return;
          }

          const cutBoxSize = 100; // 足够大以覆盖场景

          // 创建半空间Box：顶部在z=0，底部在z=-cutBoxSize
          // 顶点顺序调整为使法向量指向上方（正Z方向）
          const halfSpaceGeometry = new THREE.BoxGeometry(cutBoxSize, cutBoxSize, cutBoxSize);
          halfSpaceGeometry.translate(0, 0, -cutBoxSize / 2);

          // 对每个图形进行CSG交集切割
          this.shapes.forEach((mesh, id) => {
              if (!mesh.visible) return;

              try {
                  const brush = new window.CSG.Brush(mesh.geometry);
                  brush.position.copy(mesh.position);
                  brush.rotation.copy(mesh.rotation);
                  brush.scale.copy(mesh.scale);
                  brush.updateMatrixWorld();

                  const cutterBrush = new window.CSG.Brush(halfSpaceGeometry);

                  const up = new THREE.Vector3(0, 0, 1);
                  const quaternion = new THREE.Quaternion();
                  quaternion.setFromUnitVectors(up, cuttingPlane.normal.clone());

                  cutterBrush.rotation.setFromQuaternion(quaternion);
                  cutterBrush.position.copy(cuttingPlane.normal.clone().multiplyScalar(-cuttingPlane.constant));

                  cutterBrush.updateMatrixWorld();

                  brush.prepareGeometry();
                  cutterBrush.prepareGeometry();

                  const result = this.csgEvaluator.evaluate(brush, cutterBrush, window.CSG.INTERSECTION);

                   if (result) {
                       const resultMesh = result.isMesh ? result : result.mesh;

                       if (resultMesh && resultMesh.geometry) {
                           mesh.geometry.dispose();
                           mesh.geometry = resultMesh.geometry.clone();
                           mesh.material = mesh.material.clone();

                           mesh.geometry.computeBoundingBox();
                           mesh.geometry.computeBoundingSphere();

                           this.recenterGeometry(mesh);
                       } else {
                           mesh.visible = false;
                       }
                   }
               } catch (error) {
                   console.error(`图形 ${id} CSG切割失败:`, error);
               }
           });
       }

      
      // 高级平面裁剪三角形，支持法向量和UV插值
    clipTriangleByPlaneAdvanced(triangle, plane, normals, uvs) {
        const result = [];
        const distances = triangle.map(vertex => plane.distanceToPoint(vertex));
        
        // 根据精度模式动态调整epsilon值
        const precisionMode = document.getElementById('precisionMode')?.value || 'standard';
        let epsilon;
        switch(precisionMode) {
            case 'high': epsilon = 0.00001; break;
            case 'ultra': epsilon = 0.000001; break;
            default: epsilon = 0.0001;
        }
        
        // 检查三角形与平面的关系
        const positiveCount = distances.filter(d => d > epsilon).length;
        const negativeCount = distances.filter(d => d < -epsilon).length;
        
        // 如果三角形完全在平面正面，保留
        if (negativeCount === 0) {
            const triangleNormals = normals || [
                this.calculateTriangleNormal(triangle),
                this.calculateTriangleNormal(triangle),
                this.calculateTriangleNormal(triangle)
            ];
            const triangleUVs = uvs || [
                new THREE.Vector2(0, 0),
                new THREE.Vector2(1, 0),
                new THREE.Vector2(0.5, 1)
            ];
            
            result.push({
                vertices: triangle,
                normals: triangleNormals,
                uvs: triangleUVs
            });
            return result;
        }
        
        // 如果三角形完全在平面负面，丢弃
        if (positiveCount === 0) {
            return result;
        }
        
        // 三角形跨越平面，需要切割
        const positiveVertices = [];
        const positiveNormals = [];
        const positiveUVs = [];
        
        for (let i = 0; i < 3; i++) {
            const current = triangle[i];
            const next = triangle[(i + 1) % 3];
            const currentDist = distances[i];
            const nextDist = distances[(i + 1) % 3];
            
            const currentNormal = normals ? normals[i] : this.calculateTriangleNormal(triangle);
            const nextNormal = normals ? normals[(i + 1) % 3] : this.calculateTriangleNormal(triangle);
            
            const currentUV = uvs ? uvs[i] : new THREE.Vector2(i === 0 ? 0 : i === 1 ? 1 : 0.5, i === 2 ? 1 : 0);
            const nextUV = uvs ? uvs[(i + 1) % 3] : new THREE.Vector2((i + 1) % 3 === 0 ? 0 : (i + 1) % 3 === 1 ? 1 : 0.5, (i + 1) % 3 === 2 ? 1 : 0);
            
            // 如果当前顶点在正面，保留
            if (currentDist >= -epsilon) {
                positiveVertices.push(current.clone());
                positiveNormals.push(currentNormal.clone());
                positiveUVs.push(currentUV.clone());
            }
            
            // 如果边跨越平面，计算交点
            if ((currentDist > epsilon && nextDist < -epsilon) || (currentDist < -epsilon && nextDist > epsilon)) {
                const t = Math.abs(currentDist) / (Math.abs(currentDist) + Math.abs(nextDist));
                
                // 插值顶点
                const intersection = current.clone().lerp(next, t);
                
                // 插值法向量
                const interpolatedNormal = currentNormal.clone().lerp(nextNormal, t).normalize();
                
                // 插值UV
                const interpolatedUV = currentUV.clone().lerp(nextUV, t);
                
                positiveVertices.push(intersection);
                positiveNormals.push(interpolatedNormal);
                positiveUVs.push(interpolatedUV);
            }
        }
        
        // 根据保留的顶点重新构建三角形
        if (positiveVertices.length >= 3) {
            // 三角化多边形
            for (let i = 1; i < positiveVertices.length - 1; i++) {
                result.push({
                    vertices: [
                        positiveVertices[0],
                        positiveVertices[i],
                        positiveVertices[i + 1]
                    ],
                    normals: [
                        positiveNormals[0],
                        positiveNormals[i],
                        positiveNormals[i + 1]
                    ],
                    uvs: [
                        positiveUVs[0],
                        positiveUVs[i],
                        positiveUVs[i + 1]
                    ]
                });
            }
        }
        
        return result;
    }
    
    // 使用平面裁剪三角形（保留旧方法以兼容）
    clipTriangleByPlane(triangle, plane) {
        const advanced = this.clipTriangleByPlaneAdvanced(triangle, plane, null, null);
        return advanced.map(tri => tri.vertices);
    }
      
      // 计算三角形法向量
      calculateTriangleNormal(triangle) {
          const v1 = triangle[1].clone().sub(triangle[0]);
          const v2 = triangle[2].clone().sub(triangle[0]);
          return v1.cross(v2).normalize();
      }
      
      // 找到三角形与平面相交的边
      findPlaneIntersectionEdges(triangle, plane, edgesOnPlane) {
          const epsilon = 0.0001;
          const distances = triangle.map(vertex => plane.distanceToPoint(vertex));
          
          for (let i = 0; i < 3; i++) {
              const current = triangle[i];
              const next = triangle[(i + 1) % 3];
              const currentDist = distances[i];
              const nextDist = distances[(i + 1) % 3];
              
              // 如果边跨越平面，计算交点
              if ((currentDist > epsilon && nextDist < -epsilon) || (currentDist < -epsilon && nextDist > epsilon)) {
                  const t = Math.abs(currentDist) / (Math.abs(currentDist) + Math.abs(nextDist));
                  const intersection = current.clone().lerp(next, t);
                  edgesOnPlane.push(intersection);
              }
          }
      }
      
      // 生成切割面几何体
      generateCapGeometry(edgePoints, plane) {
          if (edgePoints.length < 3) {
              return { vertices: [], normals: [], uvs: [], indices: [] };
          }
          
          // 移除重复点
          const uniquePoints = [];
          const epsilon = 0.001;
          
          edgePoints.forEach(point => {
              let isDuplicate = false;
              for (let existing of uniquePoints) {
                  if (point.distanceTo(existing) < epsilon) {
                      isDuplicate = true;
                      break;
                  }
              }
              if (!isDuplicate) {
                  uniquePoints.push(point.clone());
              }
          });
          
          if (uniquePoints.length < 3) {
              return { vertices: [], normals: [], uvs: [], indices: [] };
          }
          
          // 计算切割面的中心点
          const center = new THREE.Vector3();
          uniquePoints.forEach(point => center.add(point));
          center.divideScalar(uniquePoints.length);
          
          // 将点投影到平面上并排序
          const planeNormal = plane.normal.clone();
          const u = new THREE.Vector3();
          const v = new THREE.Vector3();
          
          // 创建平面的局部坐标系
          if (Math.abs(planeNormal.x) < 0.9) {
              u.set(1, 0, 0).cross(planeNormal).normalize();
          } else {
              u.set(0, 1, 0).cross(planeNormal).normalize();
          }
          v.crossVectors(planeNormal, u);
          
          // 将3D点转换为2D点并按角度排序
          const points2D = uniquePoints.map(point => {
              const relative = point.clone().sub(center);
              const x = relative.dot(u);
              const y = relative.dot(v);
              const angle = Math.atan2(y, x);
              return { point3D: point, x, y, angle };
          });
          
          points2D.sort((a, b) => a.angle - b.angle);
          
          // 生成三角形扇形
          const vertices = [];
          const normals = [];
          const uvs = [];
          const indices = [];
          
          // 添加中心点
          vertices.push(center);
          normals.push(planeNormal.clone());
          uvs.push(new THREE.Vector2(0.5, 0.5));
          
          // 添加边界点
          points2D.forEach((point2D, index) => {
              vertices.push(point2D.point3D);
              normals.push(planeNormal.clone());
              
              // 生成UV坐标
              const u = (point2D.x + 1) * 0.5;
              const v = (point2D.y + 1) * 0.5;
              uvs.push(new THREE.Vector2(u, v));
          });
          
          // 生成三角形索引
          for (let i = 0; i < points2D.length; i++) {
              const next = (i + 1) % points2D.length;
              indices.push(0, i + 1, next + 1);
          }
          
          return {
              vertices,
              normals,
              uvs,
              indices
          };
      }
      
      // 布尔运算相关方法
      toggleBooleanMode() {
          this.booleanMode = !this.booleanMode;
          const toggleBtn = document.getElementById('toggleBoolean');
          const booleanPanel = document.getElementById('booleanPanel');
          
          if (this.booleanMode) {
              toggleBtn.textContent = '退出布尔运算';
              toggleBtn.style.backgroundColor = '#dc3545';
              booleanPanel.style.display = 'block';
              this.updateBooleanShapesList();
              this.showTooltip('布尔运算模式已启用，请选择两个图形进行运算', 3000);
          } else {
              toggleBtn.textContent = '布尔运算';
              toggleBtn.style.backgroundColor = '#007bff';
              booleanPanel.style.display = 'none';
              this.cancelBooleanOperation();
              this.showTooltip('布尔运算模式已关闭', 1500);
          }
      }
      
      updateBooleanShapesList() {
          const mainShapeSelect = document.getElementById('booleanMainShape');
          const toolShapeSelect = document.getElementById('booleanToolShape');
          
          if (!mainShapeSelect || !toolShapeSelect) return;
          
          // 清空现有选项
          mainShapeSelect.innerHTML = '<option value="">选择主体图形</option>';
          toolShapeSelect.innerHTML = '<option value="">选择工具图形</option>';
          
          // 添加所有图形到选项中
          this.shapes.forEach((mesh, id) => {
              const option1 = document.createElement('option');
              option1.value = id;
              option1.textContent = `图形 ${id} (${mesh.userData.type})`;
              mainShapeSelect.appendChild(option1);
              
              const option2 = document.createElement('option');
              option2.value = id;
              option2.textContent = `图形 ${id} (${mesh.userData.type})`;
              toolShapeSelect.appendChild(option2);
          });
      }
      
        executeBooleanOperation() {
            const mainShapeId = document.getElementById('booleanMainShape')?.value;
            const toolShapeId = document.getElementById('booleanToolShape')?.value;
            const operation = document.getElementById('booleanOperation')?.value || 'subtract';

            if (!mainShapeId || !toolShapeId) {
                this.showTooltip('请选择主体图形和工具图形', 2000);
                return;
            }

            if (mainShapeId === toolShapeId) {
                this.showTooltip('主体图形和工具图形不能是同一个', 2000);
                return;
            }

            // 将字符串ID转换为数字，因为shapes Map使用数字作为键
            const mainShapeNumId = parseInt(mainShapeId);
            const toolShapeNumId = parseInt(toolShapeId);

            const mainShape = this.shapes.get(mainShapeNumId);
            const toolShape = this.shapes.get(toolShapeNumId);

            if (!mainShape || !toolShape) {
                this.showTooltip('选择的图形不存在', 2000);
                return;
            }

            // 确保 CSG 库已加载
            if (!this.csgEvaluator && window.CSG && window.CSG.Evaluator) {
                console.log('重新初始化 CSG Evaluator...');
                try {
                    this.csgEvaluator = new window.CSG.Evaluator();
                    this.csgEvaluator.useGroups = true;
                    this.csgEvaluator.attributes = ['position', 'normal'];
                } catch (error) {
                    console.error('CSG Evaluator 重新初始化失败:', error);
                }
            }

            try {
                // 使用three-bvh-csg进行高效的布尔运算
                let csgOperation;
                const startTime = performance.now();

                // 映射操作类型到three-bvh-csg常量
                switch(operation) {
                    case 'subtract':
                        csgOperation = window.CSG?.SUBTRACTION ?? window.CSG?.SUBTRACTION_NUM ?? 1;
                        break;
                    case 'union':
                        csgOperation = window.CSG?.UNION ?? window.CSG?.ADDITION ?? window.CSG?.UNION_NUM ?? 0;
                        break;
                    case 'intersect':
                        csgOperation = window.CSG?.INTERSECTION ?? window.CSG?.INTERSECTION_NUM ?? 3;
                        break;
                    default:
                        csgOperation = window.CSG?.SUBTRACTION ?? 1;
                }

                console.log('布尔运算调试:', {
                    operation,
                    csgOperation,
                    windowCSG: !!window.CSG,
                    hasEvaluator: !!this.csgEvaluator,
                    ADDITION: window.CSG?.ADDITION,
                    UNION: window.CSG?.UNION,
                    SUBTRACTION: window.CSG?.SUBTRACTION,
                    INTERSECTION: window.CSG?.INTERSECTION
                });

                if (csgOperation === null || csgOperation === undefined || !window.CSG) {
                    this.showTooltip('CSG库未加载，无法执行布尔运算', 2000);
                    return;
                }

                // 使用three-bvh-csg进行运算
                const resultBrush = this.performAdvancedCSGOperation(mainShape, toolShape, csgOperation);

                if (resultBrush) {
                    const endTime = performance.now();
                    const duration = (endTime - startTime).toFixed(2);

                    // 调试日志
                    // console.log('布尔运算 - resultBrush信息:', {
                    //     position: resultBrush.position,
                    //     rotation: resultBrush.rotation,
                    //     scale: resultBrush.scale,
                    //     matrixWorld: resultBrush.matrixWorld
                    // });
                    // console.log('布尔运算 - mainShape信息:', {
                    //     position: mainShape.position,
                    //     rotation: mainShape.rotation,
                    //     scale: mainShape.scale,
                    //     matrixWorld: mainShape.matrixWorld
                    // });

                    // 克隆几何体和材质
                    const resultGeometry = resultBrush.geometry.clone();
                    const resultMaterial = mainShape.material.clone();

                    // 创建新的 Mesh
                    const resultMesh = new THREE.Mesh(resultGeometry, resultMaterial);

                    // 使用 resultBrush 的变换（因为它是CSG运算的结果）
                    resultMesh.position.copy(resultBrush.position);
                    resultMesh.rotation.copy(resultBrush.rotation);
                    resultMesh.scale.copy(resultBrush.scale);

                    resultMesh.castShadow = true;
                    resultMesh.receiveShadow = true;

                    // 优化几何体（在应用变换之前）
                    const optimizedGeometry = this.optimizeGeometry(resultGeometry);
                    resultMesh.geometry = optimizedGeometry;

                    // 更新矩阵以应用变换
                    resultMesh.updateMatrix();
                    resultMesh.updateMatrixWorld();

                    // 重新居中几何体，使其位置与几何体中心对齐
                    this.recenterGeometry(resultMesh);

                    // 添加更多调试日志
                    // console.log('布尔运算 - resultMesh创建后信息:', {
                    //     position: resultMesh.position,
                    //     rotation: resultMesh.rotation,
                    //     scale: resultMesh.scale,
                    //     matrixWorld: resultMesh.matrixWorld
                    // });

                    // 设置用户数据
                    resultMesh.userData = {
                        id: `boolean_${Date.now()}`,
                        type: `${operation}_result`,
                        originalMainShape: mainShapeNumId,
                        originalToolShape: toolShapeNumId,
                        created: new Date().toLocaleTimeString(),
                        originalScale: resultMesh.scale.clone()
                    };

                    // 添加到场景
                    this.scene.add(resultMesh);
                    this.shapes.set(resultMesh.userData.id, resultMesh);

                    // 移除原始图形
                    this.scene.remove(mainShape);
                    this.scene.remove(toolShape);
                    this.shapes.delete(mainShapeNumId);
                    this.shapes.delete(toolShapeNumId);

                    // 选择新图形
                    this.selectShape(resultMesh);

                    // 更新界面
                    this.updateShapesList();
                    this.updateBooleanShapesList();

                    const operationNames = {
                        'subtract': '减法',
                        'union': '并集',
                        'intersect': '交集'
                    };

                    this.showTooltip(`布尔${operationNames[operation]}运算完成 (耗时${duration}ms)`, 2500);

                    // console.log(`布尔运算完成 - 类型: ${operation}, 耗时: ${duration}ms`);
                } else {
                    this.showTooltip('布尔运算失败，请检查图形是否相交或封闭', 2500);
                }
            } catch (error) {
                console.error('布尔运算错误:', error);
                this.showTooltip('布尔运算出现错误，请查看控制台', 2500);
            }
        }
      
      performBooleanOperation(geometry1, geometry2, operation) {
          // 简化的布尔运算实现
          // 注意：这是一个基础实现，真正的CSG需要更复杂的算法
          
          try {
              // 获取几何体的顶点
              const vertices1 = this.getGeometryVertices(geometry1);
              const vertices2 = this.getGeometryVertices(geometry2);
              
              if (vertices1.length === 0 || vertices2.length === 0) {
                  return null;
              }
              
              let resultVertices = [];
              
              switch (operation) {
                  case 'subtract':
                      // 减法：保留geometry1中不在geometry2内部的部分
                      resultVertices = this.subtractGeometry(vertices1, vertices2);
                      break;
                  case 'union':
                      // 并集：合并两个几何体
                      resultVertices = this.unionGeometry(vertices1, vertices2);
                      break;
                  case 'intersect':
                      // 交集：保留两个几何体重叠的部分
                      resultVertices = this.intersectGeometry(vertices1, vertices2);
                      break;
                  default:
                      return null;
              }
              
              if (resultVertices.length < 9) { // 至少需要3个三角形
                  return null;
              }
              
              // 创建新的几何体
              const resultGeometry = new THREE.BufferGeometry();
              resultGeometry.setAttribute('position', new THREE.Float32BufferAttribute(resultVertices, 3));
              resultGeometry.computeVertexNormals();
              resultGeometry.computeBoundingBox();
              resultGeometry.computeBoundingSphere();
              
              return resultGeometry;
          } catch (error) {
              console.error('布尔运算处理错误:', error);
              return null;
          }
      }
      
      getGeometryVertices(geometry) {
          const vertices = [];
          const position = geometry.attributes.position;
          
          if (position) {
              for (let i = 0; i < position.count; i++) {
                  vertices.push(
                      position.getX(i),
                      position.getY(i),
                      position.getZ(i)
                  );
              }
          }
          
          return vertices;
      }
      
      subtractGeometry(vertices1, vertices2) {
          // 简化的减法实现：移除vertices1中接近vertices2的顶点
          const threshold = 0.5;
          const result = [];
          
          for (let i = 0; i < vertices1.length; i += 9) { // 每个三角形9个值
              const triangle = [
                  new THREE.Vector3(vertices1[i], vertices1[i+1], vertices1[i+2]),
                  new THREE.Vector3(vertices1[i+3], vertices1[i+4], vertices1[i+5]),
                  new THREE.Vector3(vertices1[i+6], vertices1[i+7], vertices1[i+8])
              ];
              
              // 检查三角形中心是否在第二个几何体内部
              const center = triangle[0].clone().add(triangle[1]).add(triangle[2]).divideScalar(3);
              
              let isInside = false;
              for (let j = 0; j < vertices2.length; j += 9) {
                  const center2 = new THREE.Vector3(
                      (vertices2[j] + vertices2[j+3] + vertices2[j+6]) / 3,
                      (vertices2[j+1] + vertices2[j+4] + vertices2[j+7]) / 3,
                      (vertices2[j+2] + vertices2[j+5] + vertices2[j+8]) / 3
                  );
                  
                  if (center.distanceTo(center2) < threshold) {
                      isInside = true;
                      break;
                  }
              }
              
              if (!isInside) {
                  result.push(...vertices1.slice(i, i + 9));
              }
          }
          
          return result;
      }
      
      unionGeometry(vertices1, vertices2) {
          // 简化的并集实现：合并两个几何体的顶点
          return [...vertices1, ...vertices2];
      }
      
      intersectGeometry(vertices1, vertices2) {
          // 简化的交集实现：保留接近的三角形
          const threshold = 0.5;
          const result = [];
          
          for (let i = 0; i < vertices1.length; i += 9) {
              const center1 = new THREE.Vector3(
                  (vertices1[i] + vertices1[i+3] + vertices1[i+6]) / 3,
                  (vertices1[i+1] + vertices1[i+4] + vertices1[i+7]) / 3,
                  (vertices1[i+2] + vertices1[i+5] + vertices1[i+8]) / 3
              );
              
              for (let j = 0; j < vertices2.length; j += 9) {
                  const center2 = new THREE.Vector3(
                      (vertices2[j] + vertices2[j+3] + vertices2[j+6]) / 3,
                      (vertices2[j+1] + vertices2[j+4] + vertices2[j+7]) / 3,
                      (vertices2[j+2] + vertices2[j+5] + vertices2[j+8]) / 3
                  );
                  
                  if (center1.distanceTo(center2) < threshold) {
                      result.push(...vertices1.slice(i, i + 9));
                      break;
                  }
              }
          }
          
          return result;
      }
      
      cancelBooleanOperation() {
          this.booleanMainShape = null;
          this.booleanToolShape = null;

          // 重置选择
          const mainShapeSelect = document.getElementById('booleanMainShape');
          const toolShapeSelect = document.getElementById('booleanToolShape');

          if (mainShapeSelect) mainShapeSelect.value = '';
          if (toolShapeSelect) toolShapeSelect.value = '';
      }

      // ==================== 变形编辑系统（替代原来的骨骼/锚点/顶点编辑） ====================

      toggleDeformationMode() {
          if (!this.selectedShape) {
              this.showTooltip('请先选择一个图形', 2000);
              return;
          }

          this.deformationMode = !this.deformationMode;

          if (this.deformationMode) {
              this.enterDeformationMode();
          } else {
              this.exitDeformationMode();
          }
      }

      enterDeformationMode() {
          this.showTooltip('进入变形编辑模式', 1500);

          // 保存原始几何体（用于重置）
          this.originalGeometry = this.selectedShape.geometry.clone();

          // 隐藏图形TransformControls
          if (this.transformControls) {
              this.transformControls.detach();
              this.transformControls.enabled = false;
          }

          // 提取边和面数据
          this.extractEdgeData();
          this.extractFaceData();

          // 创建可视化
          this.createDeformationVisuals();

          // 创建变形专用的TransformControls
          if (!this.deformTransformControls) {
              this.deformTransformControls = new THREE.TransformControls(
                  this.camera,
                  this.renderer.domElement
              );
              this.deformTransformControls.addEventListener('objectChange', () => {
                  this.onDeformTransformChange();
              });
              this.scene.add(this.deformTransformControls);
          }

          // 创建虚拟变换对象
          this.createDeformDummy();

          // 清空历史
          this.deformationHistory.clear();

          // 更新UI
          const btn = document.getElementById('toggleDeformation');
          if (btn) {
              btn.classList.add('mode-active');
              btn.textContent = '✕ 退出变形编辑';
          }

          const panel = document.getElementById('deformationPanel');
          if (panel) {
              panel.style.display = 'block';
          }

          this.updateDeformStatus();
      }

      exitDeformationMode() {
          this.showTooltip('退出变形编辑模式', 1500);

          // 重置状态
          this.deformationMode = false;

          // 清除可视化
          this.clearDeformationVisuals();

          // 隐藏变形TransformControls
          if (this.deformTransformControls) {
              this.deformTransformControls.detach();
          }

          // 删除虚拟对象
          if (this.deformDummy) {
              this.scene.remove(this.deformDummy);
              this.deformDummy = null;
          }

          // 恢复图形TransformControls
          if (this.selectedShape && this.transformControls) {
              this.transformControls.attach(this.selectedShape);
              this.transformControls.setMode('translate');
              this.transformControls.enabled = true;
          }

          // 清空选择
          this.clearDeformationSelection();

          // 清空数据缓存
          this.edgeData = null;
          this.faceData = null;

          // 更新UI
          const btn = document.getElementById('toggleDeformation');
          if (btn) {
              btn.classList.remove('mode-active');
              btn.textContent = '🔧 变形编辑工具';
          }

          const panel = document.getElementById('deformationPanel');
          if (panel) {
              panel.style.display = 'none';
          }
      }

      clearDeformationSelection() {
          this.deformationSelection.selectedVertices.clear();
          this.deformationSelection.selectedEdges.clear();
          this.deformationSelection.selectedFaces.clear();
          this.deformationSelection.boxSelecting = false;
      }

      createDeformDummy() {
          this.deformDummy = new THREE.Object3D();
          this.deformDummy.name = 'deformDummy';
          this.scene.add(this.deformDummy);
      }

      createDeformationVisuals() {
          if (!this.selectedShape || !this.selectedShape.geometry) return;
          this.createVertexHandles();
          this.createEdgeVisuals();
          this.createFaceMarkers();
          this.createSoftSelectVisual();
      }

      createVertexHandles() {
          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          if (!pos) return;

          if (this.deformationHandles) {
              this.scene.remove(this.deformationHandles);
              this.deformationHandles.geometry.dispose();
              this.deformationHandles.material.dispose();
          }

          const sphereGeo = new THREE.SphereGeometry(0.06, 8, 8);
          const material = new THREE.MeshBasicMaterial({
              vertexColors: true,
              transparent: true,
              opacity: 0.7
          });

          this.deformationHandles = new THREE.InstancedMesh(sphereGeo, material, pos.count);
          this.deformationHandles.userData.isDeformationHandles = true;

          const matrix = new THREE.Matrix4();
          const color = new THREE.Color(0x00ff00);

          for (let i = 0; i < pos.count; i++) {
              const v = new THREE.Vector3().fromBufferAttribute(pos, i);
              v.applyMatrix4(this.selectedShape.matrixWorld);
              matrix.setPosition(v);
              this.deformationHandles.setMatrixAt(i, matrix);
              this.deformationHandles.setColorAt(i, color);
          }

          this.deformationHandles.instanceMatrix.needsUpdate = true;
          this.deformationHandles.instanceColor.needsUpdate = true;
          this.scene.add(this.deformationHandles);
      }

      updateVertexHandleColors() {
          if (!this.deformationHandles) return;

          const color = new THREE.Color();
          const selectedColor = new THREE.Color(0xff0000);
          const softColor = new THREE.Color(0xffaa00);
          const defaultColor = new THREE.Color(0x00ff00);

          const softAffected = new Set();
          if (this.deformationSelection.softSelect && this.deformationSelection.selectedVertices.size > 0) {
              this.calculateSoftAffectedVertices(softAffected);
          }

          for (let i = 0; i < this.deformationHandles.count; i++) {
              if (this.deformationSelection.selectedVertices.has(i)) {
                  color.copy(selectedColor);
              } else if (softAffected.has(i)) {
                  color.copy(softColor);
              } else {
                  color.copy(defaultColor);
              }
              this.deformationHandles.setColorAt(i, color);
          }

          this.deformationHandles.instanceColor.needsUpdate = true;
      }

      clearDeformationVisuals() {
          if (this.deformationHandles) {
              this.scene.remove(this.deformationHandles);
              this.deformationHandles.geometry.dispose();
              this.deformationHandles.material.dispose();
              this.deformationHandles = null;
          }

          if (this.edgeLines) {
              this.scene.remove(this.edgeLines);
              this.edgeLines.geometry.dispose();
              this.edgeLines.material.dispose();
              this.edgeLines = null;
          }

          this.faceMarkers.forEach(marker => {
              this.scene.remove(marker);
              marker.geometry.dispose();
              marker.material.dispose();
          });
          this.faceMarkers = [];

          if (this.softSelectVisual) {
              this.scene.remove(this.softSelectVisual);
              this.softSelectVisual.geometry.dispose();
              this.softSelectVisual.material.dispose();
              this.softSelectVisual = null;
          }
      }

      updateDeformationVisuals() {
          if (!this.deformationMode) return;
          this.updateVertexHandlePositions();
          this.updateEdgeVisuals();
          this.updateFaceMarkers();
      }

      updateVertexHandlePositions() {
          if (!this.deformationHandles || !this.selectedShape) return;

          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const matrix = new THREE.Matrix4();

          for (let i = 0; i < pos.count; i++) {
              const v = new THREE.Vector3().fromBufferAttribute(pos, i);
              v.applyMatrix4(this.selectedShape.matrixWorld);
              matrix.setPosition(v);
              this.deformationHandles.setMatrixAt(i, matrix);
          }

          this.deformationHandles.instanceMatrix.needsUpdate = true;
      }

      handleDeformationClick(event) {
          if (!this.deformationMode) return;

          const mode = this.deformationSelection.mode;
          if (mode === 'vertex') {
              this.handleVertexSelect(event);
          } else if (mode === 'edge') {
              this.handleEdgeSelect(event);
          } else if (mode === 'face') {
              this.handleFaceSelect(event);
          }
      }

      handleVertexSelect(event) {
          if (!this.deformationHandles) return;

          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

          raycaster.setFromCamera(mouse, this.camera);
          const intersects = raycaster.intersectObject(this.deformationHandles, false);

          if (intersects.length > 0) {
              const instanceId = intersects[0].instanceId;

              if (event.shiftKey) {
                  if (this.deformationSelection.selectedVertices.has(instanceId)) {
                      this.deformationSelection.selectedVertices.delete(instanceId);
                  } else {
                      this.deformationSelection.selectedVertices.add(instanceId);
                  }
              } else if (event.ctrlKey) {
                  this.deformationSelection.selectedVertices.delete(instanceId);
              } else {
                  this.deformationSelection.selectedVertices.clear();
                  this.deformationSelection.selectedVertices.add(instanceId);
              }

              this.updateVertexHandleColors();
              this.updateDeformDummyAndAttach();
              this.updateDeformStatus();
          } else if (!event.shiftKey && !event.ctrlKey) {
              this.deformationSelection.selectedVertices.clear();
              this.updateVertexHandleColors();
              if (this.deformTransformControls) {
                  this.deformTransformControls.detach();
              }
              this.updateDeformStatus();
          }
      }

      updateDeformDummyAndAttach() {
          if (!this.deformDummy) return;
          const center = this.getSelectionCenter();
          this.deformDummy.position.copy(center);

          // 保存选中中心，用于变换计算
          this.lastSelectionCenter = center.clone();

          if (this.deformTransformControls) {
              this.deformTransformControls.attach(this.deformDummy);
          }
      }

      getSelectionCenter() {
          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const center = new THREE.Vector3();
          const selectedVertices = this.deformationSelection.selectedVertices;

          if (selectedVertices.size === 0) {
              return this.selectedShape.position.clone();
          }

          for (const index of selectedVertices) {
              const v = new THREE.Vector3().fromBufferAttribute(pos, index);
              v.applyMatrix4(this.selectedShape.matrixWorld);
              center.add(v);
          }
          center.divideScalar(selectedVertices.size);
          return center;
      }

      setDeformSelectionMode(mode) {
          this.deformationSelection.mode = mode;
          this.clearDeformationSelection();

          const modes = ['vertex', 'edge', 'face'];
          modes.forEach(m => {
              const btn = document.getElementById('select' + m.charAt(0).toUpperCase() + m.slice(1));
              if (btn) {
                  if (m === mode) {
                      btn.classList.add('active');
                  } else {
                      btn.classList.remove('active');
                  }
              }
          });

          this.updateVisualsByMode();
          this.updateDeformStatus();
          this.showTooltip(`切换到${mode === 'vertex' ? '顶点' : mode === 'edge' ? '边' : '面'}选择模式`, 1500);
      }

      updateVisualsByMode() {
          const mode = this.deformationSelection.mode;
          if (this.deformationHandles) {
              this.deformationHandles.visible = (mode === 'vertex');
          }
          if (this.edgeLines) {
              this.edgeLines.visible = (mode === 'edge');
          }
          this.faceMarkers.forEach(marker => {
              marker.visible = (mode === 'face');
          });
      }

      toggleBoxSelectMode() {
          this.deformationSelection.boxSelecting = !this.deformationSelection.boxSelecting;
          const btn = document.getElementById('toggleBoxSelect');
          if (btn) {
              if (this.deformationSelection.boxSelecting) {
                  btn.classList.add('active');
                  this.showTooltip('框选模式已启用，拖拽选择区域', 2000);
              } else {
                  btn.classList.remove('active');
                  this.showTooltip('框选模式已关闭', 1500);
              }
          }
      }

      updateDeformStatus() {
          const statusEl = document.getElementById('deformStatus');
          if (!statusEl) return;

          const mode = this.deformationSelection.mode;
          const selectedCount = this.deformationSelection.selectedVertices.size +
                                this.deformationSelection.selectedEdges.size +
                                this.deformationSelection.selectedFaces.size;
          const modeName = mode === 'vertex' ? '顶点' : mode === 'edge' ? '边' : '面';

          let status = `模式: ${modeName}选择`;
          if (selectedCount > 0) {
              status += ` | 已选中: ${selectedCount}个`;
          }
          if (this.deformationSelection.softSelect) {
              status += ` | 软选择: ${this.deformationSelection.softRadius.toFixed(1)}`;
          }
          statusEl.textContent = status;
      }

      setDeformTransformMode(mode) {
          if (this.deformTransformControls) {
              this.deformTransformControls.setMode(mode);
          }

          const modes = ['translate', 'rotate', 'scale'];
          const btnIds = ['deformTranslate', 'deformRotate', 'deformScale'];
          modes.forEach((m, i) => {
              const btn = document.getElementById(btnIds[i]);
              if (btn) {
                  if (m === mode) {
                      btn.classList.add('active');
                  } else {
                      btn.classList.remove('active');
                  }
              }
          });
          this.showTooltip(`${mode === 'translate' ? '移动' : mode === 'rotate' ? '旋转' : '缩放'}模式`, 1500);
      }

      onDeformTransformChange() {
          if (!this.deformTransformControls.object || !this.selectedShape) return;
          if (this.deformationSelection.selectedVertices.size === 0 &&
              this.deformationSelection.selectedEdges.size === 0 &&
              this.deformationSelection.selectedFaces.size === 0) return;

          const transformObject = this.deformTransformControls.object;
          const mode = this.deformTransformControls.mode;

          const affectedVertices = this.getAffectedVertices();
          const beforeState = this.saveVertexState(affectedVertices);

          // 使用保存的选中中心计算位移
          const center = this.lastSelectionCenter ? this.lastSelectionCenter.clone() : new THREE.Vector3();

          switch (mode) {
              case 'translate':
                  this.applyTranslationToSelection(transformObject, center);
                  break;
              case 'rotate':
                  this.showTooltip('旋转功能开发中', 1500);
                  break;
              case 'scale':
                  this.showTooltip('缩放功能开发中', 1500);
                  break;
          }

          const afterState = this.saveVertexState(affectedVertices);
          const entry = new DeformationHistoryEntry(
              this.selectedShape.userData.id,
              beforeState,
              afterState
          );
          this.deformationHistory.push(entry);

          // 更新选中中心为新位置
          this.lastSelectionCenter = transformObject.position.clone();

          this.updateDeformationVisuals();
      }

      getAffectedVertices() {
          const affected = new Set();
          const mode = this.deformationSelection.mode;

          if (mode === 'vertex') {
              for (const index of this.deformationSelection.selectedVertices) {
                  affected.add(index);
              }
              if (this.deformationSelection.softSelect) {
                  this.calculateSoftAffectedVertices(affected);
              }
          } else if (mode === 'edge') {
              for (const edgeId of this.deformationSelection.selectedEdges) {
                  const [v1, v2] = edgeId.split('-').map(Number);
                  affected.add(v1);
                  affected.add(v2);
              }
          } else if (mode === 'face') {
              for (const faceIndex of this.deformationSelection.selectedFaces) {
                  const face = this.faceData[faceIndex];
                  if (face) {
                      for (const vi of face.vertices) {
                          affected.add(vi);
                      }
                  }
              }
          }
          return affected;
      }

      calculateSoftAffectedVertices(affectedSet) {
          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const radius = this.deformationSelection.softRadius;
          const selectedVerts = Array.from(this.deformationSelection.selectedVertices);

          if (selectedVerts.length === 0) return;

          const center = new THREE.Vector3();
          for (const index of selectedVerts) {
              const v = new THREE.Vector3().fromBufferAttribute(pos, index);
              v.applyMatrix4(this.selectedShape.matrixWorld);
              center.add(v);
          }
          center.divideScalar(selectedVerts.length);

          for (let i = 0; i < pos.count; i++) {
              if (affectedSet.has(i)) continue;
              const v = new THREE.Vector3().fromBufferAttribute(pos, i);
              v.applyMatrix4(this.selectedShape.matrixWorld);
              const distance = v.distanceTo(center);
              if (distance < radius) {
                  affectedSet.add(i);
              }
          }
      }

      saveVertexState(indices) {
          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const state = new Map();
          for (const index of indices) {
              const v = new THREE.Vector3().fromBufferAttribute(pos, index);
              state.set(index, v.clone());
          }
          return state;
      }

      applyTranslationToSelection(dummy, center) {
          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const affected = this.getAffectedVertices();

          // 计算世界坐标位移
          const deltaWorld = dummy.position.clone().sub(center);

          // 转换到局部坐标位移
          const invMatrix = this.selectedShape.matrixWorld.clone().invert();
          const deltaLocal = deltaWorld.clone().transformDirection(invMatrix);

          for (const index of affected) {
              const v = new THREE.Vector3().fromBufferAttribute(pos, index);

              let weight = 1.0;
              if (this.deformationSelection.softSelect && !this.deformationSelection.selectedVertices.has(index)) {
                  weight = this.getSoftSelectWeight(v, center);
              }

              v.add(deltaLocal.clone().multiplyScalar(weight));
              pos.setXYZ(index, v.x, v.y, v.z);
          }

          pos.needsUpdate = true;
          geometry.computeVertexNormals();
      }

      getSoftSelectWeight(vertex, center) {
          const worldV = vertex.clone().applyMatrix4(this.selectedShape.matrixWorld);
          const distance = worldV.distanceTo(center);
          const radius = this.deformationSelection.softRadius;
          const curve = this.deformationSelection.softCurve;

          if (distance >= radius) return 0;
          const t = distance / radius;

          switch (curve) {
              case 'linear':
                  return 1 - t;
              case 'smooth':
                  return Math.cos(t * Math.PI / 2);
              case 'sharp':
                  return Math.pow(1 - t, 2);
              default:
                  return 1 - t;
          }
      }

      undoDeformation() {
          const entry = this.deformationHistory.undo();
          if (!entry) {
              this.showTooltip('没有可撤销的操作', 1500);
              return;
          }
          this.applyVertexState(entry.beforeVertices);
          this.updateDeformationVisuals();
          this.updateVertexHandleColors();
          this.updateDeformStatus();
          this.showTooltip('已撤销', 1000);
      }

      redoDeformation() {
          const entry = this.deformationHistory.redo();
          if (!entry) {
              this.showTooltip('没有可重做的操作', 1500);
              return;
          }
          this.applyVertexState(entry.afterVertices);
          this.updateDeformationVisuals();
          this.updateVertexHandleColors();
          this.updateDeformStatus();
          this.showTooltip('已重做', 1000);
      }

      applyVertexState(vertexMap) {
          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;

          for (const [index, vertex] of vertexMap) {
              pos.setXYZ(index, vertex.x, vertex.y, vertex.z);
          }

          pos.needsUpdate = true;
          geometry.computeVertexNormals();
          geometry.computeBoundingSphere();
          geometry.computeBoundingBox();
      }

      resetDeformationShape() {
          if (!this.originalGeometry) {
              this.showTooltip('没有原始形状数据', 1500);
              return;
          }

          this.selectedShape.geometry.dispose();
          this.selectedShape.geometry = this.originalGeometry.clone();
          this.deformationHistory.clear();
          this.clearDeformationSelection();
          this.extractEdgeData();
          this.extractFaceData();
          this.clearDeformationVisuals();
          this.createDeformationVisuals();
          this.updateVertexHandleColors();
          this.updateDeformStatus();
          this.showTooltip('形状已重置', 1500);
      }

      extractEdgeData() {
          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const indices = geometry.index;

          this.edgeData = [];
          const edgeSet = new Set();

          const addEdge = (v1, v2) => {
              const minV = Math.min(v1, v2);
              const maxV = Math.max(v1, v2);
              const edgeId = `${minV}-${maxV}`;
              if (!edgeSet.has(edgeId)) {
                  edgeSet.add(edgeId);
                  this.edgeData.push({ v1: minV, v2: maxV, id: edgeId });
              }
          };

          if (indices) {
              for (let i = 0; i < indices.count; i += 3) {
                  const a = indices.getX(i);
                  const b = indices.getX(i + 1);
                  const c = indices.getX(i + 2);
                  addEdge(a, b);
                  addEdge(b, c);
                  addEdge(c, a);
              }
          } else {
              for (let i = 0; i < pos.count; i += 3) {
                  addEdge(i, i + 1);
                  addEdge(i + 1, i + 2);
                  addEdge(i + 2, i);
              }
          }
      }

      extractFaceData() {
          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const indices = geometry.index;

          this.faceData = [];

          if (indices) {
              for (let i = 0; i < indices.count; i += 3) {
                  const a = indices.getX(i);
                  const b = indices.getX(i + 1);
                  const c = indices.getX(i + 2);
                  this.faceData.push({ index: i / 3, vertices: [a, b, c] });
              }
          } else {
              for (let i = 0; i < pos.count; i += 3) {
                  this.faceData.push({ index: i / 3, vertices: [i, i + 1, i + 2] });
              }
          }
      }

      createEdgeVisuals() {
          if (!this.edgeData || this.edgeData.length === 0) return;

          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const vertices = [];

          for (const edge of this.edgeData) {
              const v1 = new THREE.Vector3().fromBufferAttribute(pos, edge.v1);
              v1.applyMatrix4(this.selectedShape.matrixWorld);
              const v2 = new THREE.Vector3().fromBufferAttribute(pos, edge.v2);
              v2.applyMatrix4(this.selectedShape.matrixWorld);
              vertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
          }

          const lineGeo = new THREE.BufferGeometry();
          lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

          const lineMat = new THREE.LineBasicMaterial({
              color: 0x888888,
              transparent: true,
              opacity: 0.4
          });

          this.edgeLines = new THREE.LineSegments(lineGeo, lineMat);
          this.edgeLines.visible = (this.deformationSelection.mode === 'edge');
          this.scene.add(this.edgeLines);
      }

      updateEdgeVisuals() {
          if (!this.edgeLines || !this.selectedShape) return;

          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;
          const positions = this.edgeLines.geometry.attributes.position;

          let idx = 0;
          for (const edge of this.edgeData) {
              const v1 = new THREE.Vector3().fromBufferAttribute(pos, edge.v1);
              v1.applyMatrix4(this.selectedShape.matrixWorld);
              const v2 = new THREE.Vector3().fromBufferAttribute(pos, edge.v2);
              v2.applyMatrix4(this.selectedShape.matrixWorld);
              positions.setXYZ(idx++, v1.x, v1.y, v1.z);
              positions.setXYZ(idx++, v2.x, v2.y, v2.z);
          }
          positions.needsUpdate = true;
      }

      createFaceMarkers() {
          if (!this.faceData || this.faceData.length === 0) return;

          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;

          this.faceMarkers.forEach(marker => {
              this.scene.remove(marker);
              marker.geometry.dispose();
              marker.material.dispose();
          });
          this.faceMarkers = [];

          for (const face of this.faceData) {
              const center = new THREE.Vector3();
              for (const vi of face.vertices) {
                  const v = new THREE.Vector3().fromBufferAttribute(pos, vi);
                  center.add(v);
              }
              center.divideScalar(3);
              center.applyMatrix4(this.selectedShape.matrixWorld);

              const marker = new THREE.Mesh(
                  new THREE.BoxGeometry(0.1, 0.1, 0.1),
                  new THREE.MeshBasicMaterial({
                      color: 0xffff00,
                      transparent: true,
                      opacity: 0.7
                  })
              );
              marker.position.copy(center);
              marker.userData.isFaceMarker = true;
              marker.userData.faceIndex = face.index;
              marker.userData.vertexIndices = face.vertices;
              marker.visible = (this.deformationSelection.mode === 'face');

              this.faceMarkers.push(marker);
              this.scene.add(marker);
          }
      }

      updateFaceMarkers() {
          if (this.faceMarkers.length === 0 || !this.selectedShape) return;

          const geometry = this.selectedShape.geometry;
          const pos = geometry.attributes.position;

          for (const marker of this.faceMarkers) {
              const center = new THREE.Vector3();
              for (const vi of marker.userData.vertexIndices) {
                  const v = new THREE.Vector3().fromBufferAttribute(pos, vi);
                  center.add(v);
              }
              center.divideScalar(3);
              center.applyMatrix4(this.selectedShape.matrixWorld);
              marker.position.copy(center);
          }
      }

      handleEdgeSelect(event) {
          if (!this.edgeLines) return;

          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

          raycaster.setFromCamera(mouse, this.camera);
          raycaster.params.Line.threshold = 0.1;

          const intersects = raycaster.intersectObject(this.edgeLines);

          if (intersects.length > 0) {
              const lineIndex = Math.floor(intersects[0].index / 2);
              const edge = this.edgeData[lineIndex];

              if (event.shiftKey) {
                  if (this.deformationSelection.selectedEdges.has(edge.id)) {
                      this.deformationSelection.selectedEdges.delete(edge.id);
                  } else {
                      this.deformationSelection.selectedEdges.add(edge.id);
                  }
              } else if (event.ctrlKey) {
                  this.deformationSelection.selectedEdges.delete(edge.id);
              } else {
                  this.deformationSelection.selectedEdges.clear();
                  this.deformationSelection.selectedEdges.add(edge.id);
              }

              this.updateEdgeLineColors();
              this.updateDeformStatus();
          } else if (!event.shiftKey && !event.ctrlKey) {
              this.deformationSelection.selectedEdges.clear();
              this.updateEdgeLineColors();
              this.updateDeformStatus();
          }
      }

      updateEdgeLineColors() {
          if (!this.edgeLines) return;

          const selectedColor = new THREE.Color(0xff8800);
          const defaultColor = new THREE.Color(0x888888);

          const colors = [];
          for (const edge of this.edgeData) {
              const isSelected = this.deformationSelection.selectedEdges.has(edge.id);
              const color = isSelected ? selectedColor : defaultColor;
              colors.push(color.r, color.g, color.b);
              colors.push(color.r, color.g, color.b);
          }

          this.edgeLines.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
          this.edgeLines.material.vertexColors = true;
          this.edgeLines.material.needsUpdate = true;
      }

      handleFaceSelect(event) {
          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

          raycaster.setFromCamera(mouse, this.camera);
          const intersects = raycaster.intersectObjects(this.faceMarkers);

          if (intersects.length > 0) {
              const marker = intersects[0].object;
              const faceIndex = marker.userData.faceIndex;

              if (event.shiftKey) {
                  if (this.deformationSelection.selectedFaces.has(faceIndex)) {
                      this.deformationSelection.selectedFaces.delete(faceIndex);
                  } else {
                      this.deformationSelection.selectedFaces.add(faceIndex);
                  }
              } else if (event.ctrlKey) {
                  this.deformationSelection.selectedFaces.delete(faceIndex);
              } else {
                  this.deformationSelection.selectedFaces.clear();
                  this.deformationSelection.selectedFaces.add(faceIndex);
              }

              this.updateFaceMarkerColors();
              this.updateDeformStatus();
          } else if (!event.shiftKey && !event.ctrlKey) {
              this.deformationSelection.selectedFaces.clear();
              this.updateFaceMarkerColors();
              this.updateDeformStatus();
          }
      }

      updateFaceMarkerColors() {
          const selectedColor = 0xff0000;
          const defaultColor = 0xffff00;

          for (const marker of this.faceMarkers) {
              const isSelected = this.deformationSelection.selectedFaces.has(marker.userData.faceIndex);
              marker.material.color.setHex(isSelected ? selectedColor : defaultColor);
          }
      }

      createSoftSelectVisual() {
          if (this.softSelectVisual) {
              this.scene.remove(this.softSelectVisual);
              this.softSelectVisual.geometry.dispose();
              this.softSelectVisual.material.dispose();
          }

          if (!this.deformationSelection.softSelect) {
              this.softSelectVisual = null;
              return;
          }

          const geometry = new THREE.SphereGeometry(1, 32, 32);
          const material = new THREE.MeshBasicMaterial({
              color: 0x00aaff,
              transparent: true,
              opacity: 0.15,
              side: THREE.DoubleSide
          });

          this.softSelectVisual = new THREE.Mesh(geometry, material);

          const wireframe = new THREE.LineSegments(
              new THREE.WireframeGeometry(geometry),
              new THREE.LineBasicMaterial({ color: 0x00aaff, opacity: 0.3, transparent: true })
          );
          this.softSelectVisual.add(wireframe);

          this.scene.add(this.softSelectVisual);
          this.updateSoftSelectVisual();
      }

      updateSoftSelectVisual() {
          if (!this.softSelectVisual) return;

          if (!this.deformationSelection.softSelect ||
              this.deformationSelection.selectedVertices.size === 0) {
              this.softSelectVisual.visible = false;
              return;
          }

          const center = this.getSelectionCenter();
          this.softSelectVisual.position.copy(center);
          this.softSelectVisual.scale.setScalar(this.deformationSelection.softRadius);
          this.softSelectVisual.visible = true;
      }

      selectAllInCurrentMode() {
          const mode = this.deformationSelection.mode;

          if (mode === 'vertex' && this.selectedShape) {
              const pos = this.selectedShape.geometry.attributes.position;
              for (let i = 0; i < pos.count; i++) {
                  this.deformationSelection.selectedVertices.add(i);
              }
              this.updateVertexHandleColors();
          } else if (mode === 'edge' && this.edgeData) {
              for (const edge of this.edgeData) {
                  this.deformationSelection.selectedEdges.add(edge.id);
              }
              this.updateEdgeLineColors();
          } else if (mode === 'face' && this.faceData) {
              for (const face of this.faceData) {
                  this.deformationSelection.selectedFaces.add(face.index);
              }
              this.updateFaceMarkerColors();
          }

          this.updateDeformDummyAndAttach();
          this.updateDeformStatus();
          this.showTooltip('已全选', 1000);
      }
  }

// 全局变量
let viewer;

// 初始化应用
if (window.modulesLoaded) {
    // 如果库已经加载完成，直接初始化
    console.log('库文件已加载，正在初始化应用...');
    viewer = new Shape3DViewer();
    console.log('应用初始化完成');
} else {
    // 等待库文件加载完成
    const checkLibraries = () => {
        if (window.THREE && window.CSG) {
            console.log('库文件加载完成，正在初始化应用...');
            viewer = new Shape3DViewer();
            console.log('应用初始化完成');
        } else {
            console.log('等待库文件加载...');
            setTimeout(checkLibraries, 100);
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkLibraries);
    } else {
        checkLibraries();
    }
}

// 添加一些有趣的键盘快捷键
document.addEventListener('keydown', (event) => {
    // 变形模式快捷键
    if (viewer && viewer.deformationMode) {
        switch(event.key.toLowerCase()) {
            case 'w':
                viewer.setDeformTransformMode('translate');
                event.preventDefault();
                return;
            case 'e':
                viewer.setDeformTransformMode('rotate');
                event.preventDefault();
                return;
            case 's':
                if (!event.ctrlKey) {
                    viewer.setDeformTransformMode('scale');
                    event.preventDefault();
                    return;
                }
                break;
            case 'escape':
                viewer.clearDeformationSelection();
                viewer.updateVertexHandleColors();
                if (viewer.deformTransformControls) {
                    viewer.deformTransformControls.detach();
                }
                viewer.updateDeformStatus();
                event.preventDefault();
                return;
            case 'a':
                if (event.ctrlKey) {
                    event.preventDefault();
                    viewer.selectAllInCurrentMode();
                    return;
                }
                break;
            case 'z':
                if (event.ctrlKey) {
                    event.preventDefault();
                    viewer.undoDeformation();
                    return;
                }
                break;
            case 'y':
                if (event.ctrlKey) {
                    event.preventDefault();
                    viewer.redoDeformation();
                    return;
                }
                break;
        }
    }

    switch(event.key) {
        case '1': document.getElementById('shapeSelect').value = 'cube'; break;
        case '2': document.getElementById('shapeSelect').value = 'sphere'; break;
        case '3': document.getElementById('shapeSelect').value = 'cylinder'; break;
        case '4': document.getElementById('shapeSelect').value = 'cone'; break;
        case '5': document.getElementById('shapeSelect').value = 'pyramid'; break;
        case '6': document.getElementById('shapeSelect').value = 'torus'; break;
        case '7': document.getElementById('shapeSelect').value = 'dodecahedron'; break;
        case '8': document.getElementById('shapeSelect').value = 'icosahedron'; break;
        case 'r': case 'R':
            const resetClip = document.getElementById('resetClip');
            if (resetClip) {
                resetClip.click();
            }
            break;
        case 'Delete':
            if (viewer && viewer.selectedShape) {
                viewer.removeShape(viewer.selectedShape.userData.id);
            }
            break;
        case 'c': case 'C':
            if (event.ctrlKey && viewer) {
                event.preventDefault();
                viewer.duplicateShape();
            }
            break;
    }

    // 触发change事件
    if (event.key >= '1' && event.key <= '8') {
        document.getElementById('shapeSelect').dispatchEvent(new Event('change'));
    }
});

// ==================== 切割预览功能 ====================

Shape3DViewer.prototype.setupCuttingPreviewControls = function(container) {
    let isDragging = false;
    let startAngle = 0;
    let startRotation = 0;

    // 计算鼠标相对于容器中心的角度
    function getMouseAngle(event, container) {
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        return Math.atan2(dy, dx);
    }

    // 鼠标按下
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        startAngle = getMouseAngle(e, container);
        startRotation = this.cuttingPreviewRotation;
    });

    // 鼠标移动
    container.addEventListener('mousemove', (e) => {
        if (!isDragging || !this.cuttingPreviewGroup) return;

        // 计算当前鼠标角度
        const currentAngle = getMouseAngle(e, container);

        // 计算角度差（考虑最小角度路径）
        let angleDelta = currentAngle - startAngle;

        // 处理角度跨越PI/-PI的情况
        if (angleDelta > Math.PI) {
            angleDelta -= 2 * Math.PI;
        } else if (angleDelta < -Math.PI) {
            angleDelta += 2 * Math.PI;
        }

        // 取反角度差，使旋转方向与鼠标移动方向一致
        this.cuttingPreviewRotation = startRotation - angleDelta;

        // 应用旋转
        this.cuttingPreviewGroup.rotation.z = this.cuttingPreviewRotation;
    });

    // 鼠标释放
    container.addEventListener('mouseup', () => {
        isDragging = false;
    });

    container.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    // 滚轮缩放
    container.addEventListener('wheel', (e) => {
        e.preventDefault();

        if (!this.cuttingPreviewGroup) return;

        // 根据滚轮方向调整缩放
        const scaleSpeed = 0.1;
        if (e.deltaY > 0) {
            // 向下滚动，缩小
            this.cuttingPreviewScale = Math.max(0.1, this.cuttingPreviewScale - scaleSpeed);
        } else {
            // 向上滚动，放大
            this.cuttingPreviewScale = Math.min(10, this.cuttingPreviewScale + scaleSpeed);
        }

        // 应用缩放
        this.cuttingPreviewGroup.scale.set(this.cuttingPreviewScale, this.cuttingPreviewScale, 1);
    }, { passive: false });
};

Shape3DViewer.prototype.resetCuttingPreviewView = function() {
    if (!this.cuttingPreviewGroup) return;

    // 重置旋转和缩放
    this.cuttingPreviewRotation = 0;
    this.cuttingPreviewScale = 1;
    this.cuttingPreviewGroup.rotation.z = 0;
    this.cuttingPreviewGroup.scale.set(1, 1, 1);

    this.showTooltip('已重置预览视图', 1500);
};

Shape3DViewer.prototype.mirrorCuttingPreview = function() {
    if (!this.cuttingPreviewGroup) return;

    // 水平镜像翻转：将X轴缩放取反
    this.cuttingPreviewGroup.scale.x = -this.cuttingPreviewGroup.scale.x;

    this.showTooltip('已水平镜像翻转', 1500);
};

Shape3DViewer.prototype.toggleCuttingPreviewMode = function() {
    this.cuttingPreviewMode = !this.cuttingPreviewMode;
    const window = document.getElementById('cuttingPreviewWindow');
    const btn = document.getElementById('toggleCuttingPreview');

    if (this.cuttingPreviewMode) {
        window.style.display = 'block';
        btn.classList.add('mode-active');
        this.initCuttingPreviewWindow();
        this.updateCuttingPreview();
        this.showTooltip('切割预览窗口已打开', 1500);
    } else {
        window.style.display = 'none';
        btn.classList.remove('mode-active');
    }
};

Shape3DViewer.prototype.closeCuttingPreview = function() {
    const window = document.getElementById('cuttingPreviewWindow');
    window.style.display = 'none';
    this.cuttingPreviewMode = false;
    document.getElementById('toggleCuttingPreview').classList.remove('mode-active');
};

Shape3DViewer.prototype.initCuttingPreviewWindow = function() {
    const canvasContainer = document.getElementById('cuttingPreviewCanvas');

    if (!this.cuttingPreviewScene) {
        this.cuttingPreviewScene = new THREE.Scene();
        this.cuttingPreviewScene.background = new THREE.Color(0xffffff);

        // 创建容器组用于旋转和缩放
        this.cuttingPreviewGroup = new THREE.Group();
        this.cuttingPreviewScene.add(this.cuttingPreviewGroup);

        // 使用正交相机实现2D截面视图
        const frustumSize = 20;
        const aspect = 400 / 360;
        this.cuttingPreviewCamera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );
        this.cuttingPreviewCamera.position.set(0, 0, 20);
        this.cuttingPreviewCamera.lookAt(0, 0, 0);

        this.cuttingPreviewRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.cuttingPreviewRenderer.setSize(400, 360);
        canvasContainer.appendChild(this.cuttingPreviewRenderer.domElement);

        // 添加2D坐标轴
        const axesHelper = new THREE.AxesHelper(10);
        this.cuttingPreviewScene.add(axesHelper);

        // 添加网格背景
        const gridHelper = new THREE.GridHelper(20, 20, 0xcccccc, 0xeeeeee);
        gridHelper.rotation.x = Math.PI / 2;
        this.cuttingPreviewScene.add(gridHelper);

        // 添加标题文本
        const titleText = document.createElement('div');
        titleText.id = 'cuttingPreviewTitle';
        titleText.style.position = 'absolute';
        titleText.style.top = '10px';
        titleText.style.left = '10px';
        titleText.style.background = 'rgba(0,0,0,0.7)';
        titleText.style.color = 'white';
        titleText.style.padding = '5px 10px';
        titleText.style.borderRadius = '3px';
        titleText.style.fontSize = '12px';
        titleText.style.fontWeight = 'bold';
        titleText.style.zIndex = '10';
        titleText.textContent = '2D截面预览';
        canvasContainer.appendChild(titleText);

        // 添加控制提示
        const hintText = document.createElement('div');
        hintText.id = 'cuttingPreviewHint';
        hintText.style.position = 'absolute';
        hintText.style.bottom = '10px';
        hintText.style.left = '10px';
        hintText.style.background = 'rgba(0,0,0,0.5)';
        hintText.style.color = 'white';
        hintText.style.padding = '3px 8px';
        hintText.style.borderRadius = '3px';
        hintText.style.fontSize = '10px';
        hintText.style.zIndex = '10';
        hintText.textContent = '拖拽旋转 | 滚轮缩放';
        canvasContainer.appendChild(hintText);

        // 添加鼠标事件
        this.setupCuttingPreviewControls(canvasContainer);
    }

    // 立即更新预览
    this.updateCuttingPreview();
    this.renderCuttingPreview();
};

Shape3DViewer.prototype.updateCuttingPreview = function() {
    if (!this.cuttingPreviewScene || !this.cuttingPreviewRenderer) {
        // console.log('更新切割预览: 场景或渲染器未初始化');
        return;
    }

    const width = 400;
    const height = 360;

    // console.log('更新切割预览: shapes数量 =', this.shapes.size);

    // 清除预览组中的所有子对象
    if (this.cuttingPreviewGroup) {
        // 从后往前删除，避免索引问题
        for (let i = this.cuttingPreviewGroup.children.length - 1; i >= 0; i--) {
            const child = this.cuttingPreviewGroup.children[i];
            this.cuttingPreviewGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
    }

    // 清除现有的预览内容记录
    this.cuttingPreviewMeshes.forEach(mesh => {
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
    });
    this.cuttingPreviewMeshes = [];

    // 如果没有激活的切割平面，显示提示文本
    if (!this.activeCuttingPlane) {
        // console.log('更新切割预览: 没有激活的切割平面');
        return;
    }

    // console.log('更新切割预览: 切割平面存在', this.activeCuttingPlane);

    // 重置容器的变换
    if (this.cuttingPreviewGroup) {
        this.cuttingPreviewGroup.rotation.set(0, 0, this.cuttingPreviewRotation);
        this.cuttingPreviewGroup.scale.set(this.cuttingPreviewScale, this.cuttingPreviewScale, 1);
    }

    // 计算所有图形的截面
    const allContours = [];
    let hasValidContour = false;

    this.shapes.forEach((mesh, index) => {
        if (!mesh.geometry) {
            // console.log('Mesh', index, '没有几何体');
            return;
        }

        mesh.updateMatrixWorld();

        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);

        // 计算截面线段
        const lineSegments = this.computeCrossSectionSegments(geometry, this.activeCuttingPlane);
        // console.log('Mesh', index, '截面线段数:', lineSegments.length);

        // 将线段连接成轮廓
        const contours = this.connectLineSegmentsToContours(lineSegments);
        // console.log('Mesh', index, '轮廓数:', contours.length);

        if (contours && contours.length > 0) {
            allContours.push({ contours, color: mesh.material.color });
            hasValidContour = true;
        }
    });

    // console.log('总共轮廓数:', allContours.length);

    // 如果没有有效轮廓，清除后返回
    if (!hasValidContour) {
        // console.log('没有有效的截面轮廓');
        return;
    }

    // 将3D截面投影到2D平面并绘制
    const planeBasis = this.getPlaneBasis(this.activeCuttingPlane);

    // 收集所有2D点用于计算边界框
    let allPoints2d = [];
    const allShapes2d = [];

    allContours.forEach(shape => {
        shape.contours.forEach(contour => {
            if (contour.length < 3) return;

            // 投影3D点到2D
            const points2d = contour.map(p => {
                const planePoint = this.activeCuttingPlane.normal.clone().multiplyScalar(-this.activeCuttingPlane.constant);
                const local = p.clone().sub(planePoint);
                return {
                    x: local.dot(planeBasis.u),
                    y: local.dot(planeBasis.v)
                };
            });

            allPoints2d = allPoints2d.concat(points2d);
            allShapes2d.push({ points: points2d, color: shape.color });
        });
    });

    // 计算边界框
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    allPoints2d.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });

    // console.log('边界框: minX =', minX, ', maxX =', maxX, ', minY =', minY, ', maxY =', maxY);

    // 计算中心点
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // console.log('中心点: (', centerX, ',', centerY, ')');

    // 调整相机以适应图形大小
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const maxSize = Math.max(boundsWidth, boundsHeight);

    if (maxSize > 0 && maxSize !== Infinity) {
        // 设置相机视口大小，让图形占据约80%的视图
        const frustumSize = maxSize * 1.25;
        const aspect = 400 / 360;
        this.cuttingPreviewCamera.left = frustumSize * aspect / -2;
        this.cuttingPreviewCamera.right = frustumSize * aspect / 2;
        this.cuttingPreviewCamera.top = frustumSize / 2;
        this.cuttingPreviewCamera.bottom = frustumSize / -2;
        this.cuttingPreviewCamera.updateProjectionMatrix();
        // console.log('相机视口大小调整为:', frustumSize);
    }

    // 将所有图形居中
    allShapes2d.forEach(shapeData => {
        const points = shapeData.points;

        // 创建截面轮廓形状
        const shape2d = new THREE.Shape();

        // 将点平移到中心
        const centeredPoints = points.map(p => ({
            x: p.x - centerX,
            y: p.y - centerY
        }));

        shape2d.moveTo(centeredPoints[0].x, centeredPoints[0].y);
        for (let i = 1; i < centeredPoints.length; i++) {
            shape2d.lineTo(centeredPoints[i].x, centeredPoints[i].y);
        }
        shape2d.closePath();

        const geometry = new THREE.ShapeGeometry(shape2d);
        const material = new THREE.MeshBasicMaterial({
            color: shapeData.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = 0;
        this.cuttingPreviewGroup.add(mesh);
        this.cuttingPreviewMeshes.push(mesh);

        // 添加边框线 - 使用轮廓线而不是EdgesGeometry
        const lineGeometry = new THREE.BufferGeometry();
        const linePositions = [];

        // 将轮廓点转换为线段（首尾相连）
        for (let i = 0; i < centeredPoints.length; i++) {
            const p1 = centeredPoints[i];
            const p2 = centeredPoints[(i + 1) % centeredPoints.length];
            linePositions.push(p1.x, p1.y, 0.01);
            linePositions.push(p2.x, p2.y, 0.01);
        }

        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const borderLines = new THREE.LineSegments(lineGeometry, lineMaterial);
        this.cuttingPreviewGroup.add(borderLines);
        this.cuttingPreviewMeshes.push(borderLines);
    });

    // console.log('渲染的网格数:', this.cuttingPreviewMeshes.length);
};

Shape3DViewer.prototype.computeCrossSectionSegments = function(geometry, plane) {
    const segments = [];
    const positions = geometry.attributes.position.array;
    const epsilon = 0.001;

    // console.log('computeCrossSectionSegments: 顶点数 =', positions.length / 3);

    // 遍历三角形面
    let triangleCount = 0;
    for (let i = 0; i < positions.length; i += 9) {
        triangleCount++;

        const v1 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        const v2 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
        const v3 = new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

        const d1 = plane.distanceToPoint(v1);
        const d2 = plane.distanceToPoint(v2);
        const d3 = plane.distanceToPoint(v3);

        // 判断顶点在平面的哪一侧
        const s1 = Math.sign(d1);
        const s2 = Math.sign(d2);
        const s3 = Math.sign(d3);

        // 处理顶点在平面上的情况
        const onPlane1 = Math.abs(d1) < epsilon;
        const onPlane2 = Math.abs(d2) < epsilon;
        const onPlane3 = Math.abs(d3) < epsilon;

        const intersections = [];

        // 如果顶点在平面上，添加到交点列表
        if (onPlane1) intersections.push(v1.clone());
        if (onPlane2) intersections.push(v2.clone());
        if (onPlane3) intersections.push(v3.clone());

        // 计算边与平面的交点
        if (s1 !== s2 && !onPlane1 && !onPlane2) {
            const t = d1 / (d1 - d2);
            intersections.push(v1.clone().lerp(v2, t));
        }
        if (s2 !== s3 && !onPlane2 && !onPlane3) {
            const t = d2 / (d2 - d3);
            intersections.push(v2.clone().lerp(v3, t));
        }
        if (s3 !== s1 && !onPlane3 && !onPlane1) {
            const t = d3 / (d3 - d1);
            intersections.push(v3.clone().lerp(v1, t));
        }

        // 去重：合并非常接近的点
        const uniqueIntersections = [];
        for (const p of intersections) {
            let isDuplicate = false;
            for (const existing of uniqueIntersections) {
                if (p.distanceTo(existing) < epsilon) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueIntersections.push(p);
            }
        }

        // 如果有两个交点，形成一个线段
        if (uniqueIntersections.length === 2) {
            segments.push({ p1: uniqueIntersections[0], p2: uniqueIntersections[1] });
        }
    }

    // console.log('computeCrossSectionSegments: 三角形数 =', triangleCount, ', 线段数 =', segments.length);

    return segments;
};

Shape3DViewer.prototype.connectLineSegmentsToContours = function(segments) {
    if (segments.length === 0) return [];

    const epsilon = 0.001;
    const contours = [];
    const usedSegments = new Set();

    // console.log('connectLineSegmentsToContours: 输入线段数 =', segments.length);

    // 为每个端点创建一个邻接表
    const adjacency = new Map();

    function getPointKey(point) {
        return `${point.x.toFixed(6)},${point.y.toFixed(6)},${point.z.toFixed(6)}`;
    }

    function findOrMergePoint(point, points) {
        const key = getPointKey(point);
        if (points.has(key)) {
            return points.get(key);
        }
        const newPoint = point.clone();
        points.set(key, newPoint);
        return newPoint;
    }

    // 合并重复的端点并构建邻接表
    const uniquePoints = new Map();
    segments.forEach((seg, index) => {
        const p1 = findOrMergePoint(seg.p1, uniquePoints);
        const p2 = findOrMergePoint(seg.p2, uniquePoints);

        const key1 = getPointKey(p1);
        const key2 = getPointKey(p2);

        if (!adjacency.has(key1)) adjacency.set(key1, []);
        if (!adjacency.has(key2)) adjacency.set(key2, []);

        adjacency.get(key1).push({ point: p2, segmentIndex: index, end: 'p2' });
        adjacency.get(key2).push({ point: p1, segmentIndex: index, end: 'p1' });
    });

    // console.log('connectLineSegmentsToContours: 邻接表节点数 =', adjacency.size);

    // 从未使用的线段开始，构建轮廓
    for (let i = 0; i < segments.length; i++) {
        if (usedSegments.has(i)) continue;

        const startSeg = segments[i];
        const startKey = getPointKey(findOrMergePoint(startSeg.p1, uniquePoints));

        const contour = [];
        let currentKey = startKey;
        let prevSegIndex = i;
        let visitedPoints = new Set();
        visitedPoints.add(startKey);

        // 添加第一个线段的两个端点
        const p1 = findOrMergePoint(startSeg.p1, uniquePoints);
        const p2 = findOrMergePoint(startSeg.p2, uniquePoints);
        contour.push(p1);
        contour.push(p2);
        usedSegments.add(i);
        visitedPoints.add(getPointKey(p2));
        currentKey = getPointKey(p2);

        // 沿着相邻线段追踪
        while (true) {
            const neighbors = adjacency.get(currentKey);
            if (!neighbors || neighbors.length === 0) break;

            // 查找下一个未使用的线段
            let found = false;
            for (const neighbor of neighbors) {
                if (!usedSegments.has(neighbor.segmentIndex)) {
                    const nextKey = getPointKey(neighbor.point);

                    // 避免重复访问同一点
                    if (visitedPoints.has(nextKey) && nextKey !== startKey) {
                        continue;
                    }

                    contour.push(neighbor.point);
                    usedSegments.add(neighbor.segmentIndex);
                    visitedPoints.add(nextKey);
                    prevSegIndex = neighbor.segmentIndex;
                    currentKey = nextKey;

                    // 检查是否回到了起点
                    if (currentKey === startKey) {
                        found = 'closed';
                        break;
                    }
                    found = true;
                    break;
                }
            }

            if (found === 'closed') {
                break;
            }
            if (!found) {
                break;
            }
        }

        // 检查轮廓是否有效
        if (contour.length >= 3) {
            const firstKey = getPointKey(contour[0]);
            const lastKey = getPointKey(contour[contour.length - 1]);

            if (firstKey === lastKey) {
                contour.pop();
            }

            if (contour.length >= 3) {
                contours.push(contour);
                // console.log('connectLineSegmentsToContours: 创建轮廓，顶点数 =', contour.length);
            }
        }
    }

    // console.log('connectLineSegmentsToContours: 输出轮廓数 =', contours.length);

    return contours;
};

Shape3DViewer.prototype.getPlaneBasis = function(plane) {
    const normal = plane.normal.clone();
    const u = new THREE.Vector3();
    const v = new THREE.Vector3();

    if (Math.abs(normal.x) > 0.9) {
        u.set(0, 1, 0);
    } else {
        u.set(1, 0, 0);
    }

    v.crossVectors(normal, u).normalize();
    u.crossVectors(v, normal).normalize();

    return { u, v };
};

Shape3DViewer.prototype.renderCuttingPreview = function() {
    if (this.cuttingPreviewMode && this.cuttingPreviewRenderer) {
        this.cuttingPreviewRenderer.render(this.cuttingPreviewScene, this.cuttingPreviewCamera);
        requestAnimationFrame(() => this.renderCuttingPreview());
    }
};