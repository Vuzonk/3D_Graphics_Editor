// 主模块加载文件
import * as THREE from './libs/three/three.module.js';
import { OrbitControls } from './libs/three/addons/controls/OrbitControls.js';
import { TransformControls } from './libs/three/addons/controls/TransformControls.js';

// 将 THREE 及其组件暴露到全局作用域，以便 app.js 使用
window.THREE = THREE;
window.OrbitControls = OrbitControls;
window.TransformControls = TransformControls;

// 为 Triangle 类添加 getInterpolation 静态方法（兼容 three-mesh-bvh）
if (!THREE.Triangle.getInterpolation) {
    THREE.Triangle.getInterpolation = function(point, p1, p2, p3, v1, v2, v3, target) {
        // 使用现有的 getUV 方法
        return this.getUV(point, p1, p2, p3, v1, v2, v3, target);
    };
}

// 导入 CSG 库（注意：导出名称为 ADDITION 而不是 UNION）
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION, DIFFERENCE, GridMaterial, computeMeshVolume } from './libs/three-bvh-csg/index.module.js';

// 将CSG库暴露到全局作用域
window.CSG = {
    Brush,
    Evaluator,
    SUBTRACTION,
    UNION: ADDITION, // 为了兼容性，将 ADDITION 映射为 UNION
    ADDITION,
    INTERSECTION,
    DIFFERENCE,
    GridMaterial,
    computeMeshVolume,
    isWaterTight: () => true // 提供一个默认的 isWaterTight 函数
};

console.log('Three.js 库加载成功:', THREE);
console.log('CSG 库加载成功:', window.CSG);

// 加载 app.js
const script = document.createElement('script');
script.src = 'app.js';
script.onload = function() {
    console.log('app.js 加载完成');
    // 标记库已加载
    window.modulesLoaded = true;
};
script.onerror = function() {
    console.error('app.js 加载失败');
};
document.head.appendChild(script);
