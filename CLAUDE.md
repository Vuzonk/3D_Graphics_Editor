# CLAUDE.md

请始终使用简体中文与我对话，并在回答时保持专业、简洁,注释请用中文,代码函数名保持英文风格。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **3D Graphics Editor** (3D图形编辑器) built with Three.js that provides advanced mesh editing capabilities including:
- Geometry creation (cube, sphere, cylinder, cone, pyramid, torus, dodecahedron, icosahedron)
- High-precision cutting with configurable accuracy (standard: 0.01, high: 0.001, ultra: 0.0001)
- Boolean operations (union, subtraction, intersection) using three-bvh-csg
- Vertex editing mode for direct vertex manipulation
- Bone system for skeletal deformation
- Anchor system for smooth local deformation
- Config save/load system with JSON files
- Undo/redo system (50-step history)

## Running the Project

This project requires a local web server to run due to ES module imports. No build step is required.

```bash
# Using Python 3
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

**Important:** Edge browser users should disable mouse gestures for better UX (settings → appearance → browser behavior → mouse gestures)

## Code Architecture

### Entry Point

- `index.html` - Main HTML with embedded UI controls and styling
- `load-modules.js` - Module loader that:
  - Imports Three.js and addons (OrbitControls, TransformControls)
  - Imports three-bvh-csg for boolean operations
  - Exposes libraries to global scope (`window.THREE`, `window.CSG`)
  - Loads `app.js` after dependencies are ready

### Main Application

- `app.js` (~8700 lines) - Single-file application containing `Shape3DViewer` class

**Key initialization flow:**
1. `constructor()` - Sets up all state properties, initializes mobile detection
2. `init()` - Creates scene, camera, renderer, lighting, controls, and initial shapes
3. `animate()` - Main render loop with FPS monitoring and adaptive quality

### Core Systems

**Shape Management:**
- `this.shapes` - Map storing all shape meshes by ID
- `createShape(type, position)` - Creates new geometry meshes
- `addShape(type)` - UI handler for adding shapes
- Shapes use `MeshStandardMaterial` with configurable properties (metalness, roughness, opacity, clearcoat, reflectivity)

**Transform System:**
- `OrbitControls` - Camera navigation (left-click rotate, right-click pan, scroll zoom)
- `TransformControls` - Object manipulation (translate, rotate, scale)
- `W/E/R` keys - Switch between move/rotate/scale modes
- Drag controls for interactive object movement

**Cutting System:**
Two cutting modes available:
1. **CSG Engine Cutting** (uses three-bvh-csg):
   - `performCSGCutting(cuttingPlane, capMode)` - True boolean subtraction
   - Recommended for post-boolean operation shapes
   - More accurate but slower

2. **Geometry Cutting** (native Three.js clipping):
   - `performGeometryCutting(mesh, cuttingPlane, capMode)` - Uses clipping planes
   - `capMode`: 'seal' (fills gaps), 'cut' (no fill)
   - Faster but less precise

**Cutting Plane Controls:**
- Precision modes: Ctrl+1 (standard), Ctrl+2 (high), Ctrl+3 (ultra)
- Position/normal sliders with real-time preview
- TransformControls for direct 3D manipulation
- Rotation buttons for X/Y/Z axis
- Auto-clear option after cutting

**Boolean Operations:**
- `performAdvancedCSGOperation(brushA, brushB, operation)` - Main CSG handler
- Uses three-bvh-csg library with Brush and Evaluator
- Operations: SUBTRACTION, ADDITION (union), INTERSECTION
- `window.CSG` global object exposed by load-modules.js

**Undo/Redo System:**
- `this.operationHistory` - Array storing operation history
- `this.historyIndex` - Current position in history
- Supports: create, remove, cut, transform operations
- Actions: Ctrl+Z (undo), Ctrl+Y (redo)
- History states save position, rotation, scale, color, geometry

**Vertex Editing:**
- `toggleVertexEdit()` - Enables vertex selection/manipulation
- Green spheres mark editable vertices
- Selected vertices turn red
- TransformControls used for vertex positioning
- Auto-recalculates vertex normals after moving

**Bone System:**
- `toggleBoneEdit()` - Enables bone creation/manipulation
- Bones affect vertices within 2.0 unit radius
- `this.bones` - Array storing bone objects
- `this.boneWeights` - Map of vertex-to-bone weights
- TransformControls for bone positioning

**Anchor System:**
- `toggleAnchorEdit()` - Enables anchor creation/manipulation
- Uses squared-distance attenuation for smooth deformation
- `this.anchors` - Array storing anchor objects
- Configurable influence radius (0.1-5.0)
- TransformControls for anchor positioning

**Configuration System:**
- `saveCurrentConfig()` - Exports scene state to JSON
- `loadConfigFromFile()` - Imports and applies config
- Supports overwrite/append modes
- Auto-name conflict resolution
- Configs stored in `./configs/` folder
- `config-index.json` lists available configs

## Important Dependencies

**Three.js ecosystem** (in `libs/`):
- `three/` - Core Three.js library
- `three/addons/controls/OrbitControls.js` - Camera navigation
- `three/addons/controls/TransformControls.js` - Object transforms
- `three-bvh-csg/` - Boolean operations (Brush, Evaluator, operations)
- `three-mesh-bvh/` - BVH acceleration structure (used by CSG)

**Module loading:**
- Uses ES6 import maps in HTML
- Libraries exposed to global scope for app.js access
- `window.modulesLoaded` flag set when initialization complete

## UI Structure

The UI is embedded in `index.html` with Chinese labels:
- Left panel (`#controls`) - All tool controls (minimizable)
- Right panel (`#info`) - Operation hints and shortcuts (minimizable)
- Help modal - Comprehensive feature guide
- Cutting preview window - Draggable floating preview

## Common Modification Patterns

**Adding a new shape type:**
1. Add option to `<select id="shapeSelect">` in index.html
2. Add case in `createShape()` method
3. Update `this.shapeTypeNames` mapping for display

**Modifying material properties:**
- Material controls are in `#materialControls` section (hidden by default)
- Access via `selectedShape.material` property
- Key properties: metalness, roughness, opacity, clearcoat, reflectivity

**Working with cutting planes:**
- Active plane: `this.activeCuttingPlane` (THREE.Plane)
- Stored planes: `this.customClipPlanes` array
- Apply to mesh: `mesh.material.clippingPlanes = [plane]`
- Require `renderer.localClippingEnabled = true`

**Handling undo/redo for new actions:**
1. Save state with `saveShapeState(mesh)` before action
2. Execute action
3. Call `addToHistory({ type: 'actionType', beforeStates, afterStates, ... })`
4. Implement undo/redo cases in `undo()` and `redo()` methods

## Mobile Optimization

- `detectMobileDevice()` - Checks UA, touch, screen size, memory, CPU cores
- `getOptimizedRendererConfig()` - Returns device-specific renderer settings
- `performanceMode` - 'mobile' or 'desktop'
- Adaptive quality based on FPS monitoring

## File Organization

```
/
├── index.html              # Main HTML with UI
├── app.js                  # Single-file application (~8700 lines)
├── load-modules.js         # Module loader and global exports
├── favicon.ico / .svg      # Site icons
├── libs/                   # Third-party libraries
│   ├── three/              # Three.js core
│   ├── three-bvh-csg/      # Boolean operations
│   └── three-mesh-bvh/     # BVH structures
├── configs/                # Configuration files
│   ├── config-index.json   # Config file listing
│   └── *.json              # Saved scene configurations
└── CLAUDE.md               # This file
```

## Key Classes and Objects

**Shape3DViewer** - Main application class
- State properties prefixed with `this.` (300+ properties)
- Methods grouped by functionality (cutting, boolean, editing, config)
- Event handlers attached to DOM elements in `init()`

**THREE.Plane** - Cutting plane representation
- Defined by point (constant) and normal vector
- Used for clipping operations

**CSG.Brush** - Wrapper for geometry in CSG operations
- Created from mesh geometry
- Requires `prepareGeometry()` call before operations

**CSG.Evaluator** - Performs boolean operations
- Singleton: `this.csgEvaluator`
- Call `evaluate(brush1, brush2, operation)` to execute

## Browser Compatibility

Requires ES6 modules support:
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

## Debugging Tips

- Enable console logs (search for `console.log` in app.js)
- FPS counter in bottom-right corner
- `this.lowFPSCount` tracks performance issues
- CSG operations log execution time
- Shape states logged during undo/redo operations
