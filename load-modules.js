// 主模块加载文件 - 本地库优先，CDN后备
// ============================================
// CDN后备配置
const CDN_CONFIG = {
    three: {
        local: './libs/three/three.module.js',
        cdn: 'https://unpkg.com/three@0.160.0/build/three.module.js'
    },
    orbitControls: {
        local: './libs/three/addons/controls/OrbitControls.js',
        cdn: 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js'
    },
    transformControls: {
        local: './libs/three/addons/controls/TransformControls.js',
        cdn: 'https://unpkg.com/three@0.160.0/examples/jsm/controls/TransformControls.js'
    },
    csg: {
        local: './libs/three-bvh-csg/index.module.js',
        cdn: 'https://unpkg.com/three-bvh-csg@0.0.16/build/index.module.js'
    }
};

// 动态导入模块（支持CDN后备）
async function importModule(name, localPath, cdnPath) {
    // 先尝试本地路径
    try {
        console.log(`[库加载] ${name}: 尝试加载本地库...`);
        const module = await import(localPath);
        console.log(`[库加载] ${name}: ✓ 使用本地库`);
        return { module, source: 'local' };
    } catch (localError) {
        console.warn(`[库加载] ${name}: 本地加载失败，尝试CDN后备...`, localError.message);

        // 本地失败，尝试CDN
        try {
            const module = await import(cdnPath);
            console.log(`[库加载] ${name}: ✓ 使用CDN库`);
            return { module, source: 'cdn' };
        } catch (cdnError) {
            console.error(`[库加载] ${name}: ✗ 本地和CDN都加载失败`);
            throw new Error(`${name} 加载失败: 本地=${localError.message}, CDN=${cdnError.message}`);
        }
    }
}

// 主加载函数
async function loadAllModules() {
    console.log('=== 开始加载库文件 ===');

    try {
        // 加载 Three.js 核心
        const threeResult = await importModule('Three.js', CDN_CONFIG.three.local, CDN_CONFIG.three.cdn);
        const THREE = threeResult.module;
        window.THREE = THREE;

        // 加载 OrbitControls
        const orbitResult = await importModule('OrbitControls', CDN_CONFIG.orbitControls.local, CDN_CONFIG.orbitControls.cdn);
        window.OrbitControls = orbitResult.module.OrbitControls;

        // 加载 TransformControls
        const transformResult = await importModule('TransformControls', CDN_CONFIG.transformControls.local, CDN_CONFIG.transformControls.cdn);
        window.TransformControls = transformResult.module.TransformControls;

        // 为 Triangle 类添加 getInterpolation 静态方法（兼容 three-mesh-bvh）
        if (!THREE.Triangle.getInterpolation) {
            THREE.Triangle.getInterpolation = function(point, p1, p2, p3, v1, v2, v3, target) {
                return this.getUV(point, p1, p2, p3, v1, v2, v3, target);
            };
        }

        // 加载 CSG 库
        const csgResult = await importModule('three-bvh-csg', CDN_CONFIG.csg.local, CDN_CONFIG.csg.cdn);
        const { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION, DIFFERENCE, GridMaterial, computeMeshVolume } = csgResult.module;

        // 检查导入的常量值
        console.log('CSG 常量检查:', { ADDITION, SUBTRACTION, INTERSECTION, DIFFERENCE });

        // 将CSG库暴露到全局作用域
        window.CSG = {
            Brush,
            Evaluator,
            SUBTRACTION,
            UNION: ADDITION,
            ADDITION,
            INTERSECTION,
            DIFFERENCE,
            GridMaterial,
            computeMeshVolume,
            isWaterTight: () => true,
            UNION_NUM: 0,
            SUBTRACTION_NUM: 1,
            INTERSECTION_NUM: 3
        };

        console.log('Three.js 库加载成功:', THREE);
        console.log('CSG 库加载成功:', window.CSG);

        // 保护 window.CSG 对象
        try {
            Object.defineProperty(window, 'CSG', {
                value: window.CSG,
                writable: false,
                configurable: false
            });
            console.log('window.CSG 对象已保护');
        } catch (error) {
            console.warn('无法保护 window.CSG 对象:', error);
        }

        console.log('=== 库加载完成 ===');
        return true;

    } catch (error) {
        console.error('=== 库加载失败 ===', error);
        // 显示错误提示
        alert('库加载失败，请检查网络连接或刷新页面重试。\n错误: ' + error.message);
        return false;
    }
}

// 加载 app.js
function loadAppScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'app.js';
        script.onload = function() {
            console.log('app.js 加载完成');
            window.modulesLoaded = true;
            resolve();
        };
        script.onerror = function() {
            console.error('app.js 加载失败');
            reject(new Error('app.js 加载失败'));
        };
        document.head.appendChild(script);
    });
}

// 启动加载
loadAllModules().then(success => {
    if (success) {
        return loadAppScript();
    }
}).catch(error => {
    console.error('应用启动失败:', error);
});
