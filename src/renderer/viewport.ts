import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  GridHelper,
  HalfFloatType,
  HemisphereLight,
  LineBasicMaterial,
  LineLoop,
  LinearToneMapping,
  Mesh,
  NeutralToneMapping,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  SRGBColorSpace,
  ShadowMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type ToneMapping,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import type { Editor } from '../core/editor';
import { intersectFaces, type FaceHit } from '../core/picking';
import { pixelCorners, type SkinFace } from '../core/skin-layout';
import type { LightingPreset, ToneMappingId } from './lighting';
import { SkinObject, type Visibility } from './skin-object';

// everything that defines how the viewport looks, edit and studio differ only in this data
export interface ViewportLook {
  readonly lighting: LightingPreset;
  readonly fov: number;
  readonly transparent: boolean;
}

// numeric form of a look that can be interpolated for smooth mode transitions
interface LookValues {
  background: Color;
  ambient: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  lights: Array<{ color: Color; intensity: number; position: Vector3 }>;
  environment: number;
  exposure: number;
  shadow: number;
  ao: number;
  vignette: number;
  grid: number;
  fov: number;
}

// maps preset tone mapping names to three.js constants
const TONE_MAPPINGS: Record<ToneMappingId, ToneMapping> = {
  none: NoToneMapping,
  linear: LinearToneMapping,
  neutral: NeutralToneMapping,
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
};

// point the camera orbits around, roughly the character's chest
const ORBIT_TARGET = new Vector3(0, 16, 0);

// field of view the default camera distance is authored for
const REFERENCE_FOV = 35;

// camera distance that frames the whole character at the reference field of view
const REFERENCE_DISTANCE = 86;

// duration of the edit to studio transition in milliseconds
const TRANSITION_MS = 520;

// converts a look into interpolatable values
function toValues(look: ViewportLook): LookValues {
  const { lighting } = look;
  return {
    background: new Color(lighting.background),
    ambient: lighting.ambient,
    hemiSky: new Color(lighting.hemisphere.sky),
    hemiGround: new Color(lighting.hemisphere.ground),
    hemiIntensity: lighting.hemisphere.intensity,
    lights: [lighting.key, lighting.fill, lighting.rim].map((light) => ({
      color: new Color(light.color),
      intensity: light.intensity,
      position: new Vector3(...light.position),
    })),
    environment: lighting.environment,
    exposure: lighting.exposure,
    shadow: lighting.shadow,
    ao: lighting.ao,
    vignette: lighting.vignette,
    grid: lighting.grid ?? 0,
    fov: look.fov,
  };
}

// blends two looks, used every frame while a transition is running
function mixValues(a: LookValues, b: LookValues, t: number): LookValues {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    background: a.background.clone().lerp(b.background, t),
    ambient: mix(a.ambient, b.ambient),
    hemiSky: a.hemiSky.clone().lerp(b.hemiSky, t),
    hemiGround: a.hemiGround.clone().lerp(b.hemiGround, t),
    hemiIntensity: mix(a.hemiIntensity, b.hemiIntensity),
    lights: a.lights.map((light, i) => ({
      color: light.color.clone().lerp(b.lights[i]!.color, t),
      intensity: mix(light.intensity, b.lights[i]!.intensity),
      position: light.position.clone().lerp(b.lights[i]!.position, t),
    })),
    environment: mix(a.environment, b.environment),
    exposure: mix(a.exposure, b.exposure),
    shadow: mix(a.shadow, b.shadow),
    ao: mix(a.ao, b.ao),
    vignette: mix(a.vignette, b.vignette),
    grid: mix(a.grid, b.grid),
    fov: mix(a.fov, b.fov),
  };
}

// realtime 3d view of the skin document, used for both editing and studio rendering
export class SkinViewport {
  readonly canvas = document.createElement('canvas');
  readonly controls: OrbitControls;
  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly gtao: GTAOPass;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(REFERENCE_FOV, 1, 2, 800);
  private readonly skinObject: SkinObject;
  private readonly ambient = new AmbientLight(0xffffff, 1);
  private readonly hemisphere = new HemisphereLight(0xffffff, 0xffffff, 0);
  private readonly lights = [new DirectionalLight(), new DirectionalLight(), new DirectionalLight()];
  private readonly ground: Mesh;
  private readonly grid = new GridHelper(64, 16, 0x5c6577, 0x3c4350);
  private readonly hover: LineLoop[];
  private readonly background = new Color();
  private readonly backdropCanvas = document.createElement('canvas');
  private readonly backdropTexture = new CanvasTexture(this.backdropCanvas);
  private backdropKey = '';
  private readonly raycaster = new Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribe: () => void;
  private values: LookValues;
  private transition: { from: LookValues; to: LookValues; start: number } | null = null;
  private transparent = false;
  private dirty = true;
  private frame = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly editor: Editor,
    look: ViewportLook,
  ) {
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
    container.appendChild(this.canvas);

    this.skinObject = new SkinObject(editor.skin);
    this.scene.add(this.skinObject.group, this.ambient, this.hemisphere);

    const [key] = this.lights as [DirectionalLight, DirectionalLight, DirectionalLight];
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -28;
    key.shadow.camera.right = key.shadow.camera.top = 28;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 140;
    key.shadow.radius = 5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.06;
    for (const light of this.lights) {
      light.target.position.copy(ORBIT_TARGET);
      this.scene.add(light, light.target);
    }

    this.ground = new Mesh(new PlaneGeometry(600, 600), new ShadowMaterial({ opacity: 1 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.grid.position.y = -0.02;
    this.grid.material.transparent = true;
    this.grid.material.depthWrite = false;
    this.scene.add(this.grid);

    this.hover = [0x000000, 0xffffff].map((color) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
      const line = new LineLoop(
        geometry,
        new LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }),
      );
      line.visible = false;
      line.frustumCulled = false;
      line.renderOrder = 10;
      this.scene.add(line);
      return line;
    });

    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();

    this.composer = new EffectComposer(
      this.renderer,
      new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType }),
    );
    this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.gtao.updateGtaoMaterial({
      radius: 3,
      distanceExponent: 1.4,
      thickness: 1.2,
      scale: 1.15,
      samples: 16,
    });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 14;
    this.controls.maxDistance = 420;
    this.controls.target.copy(ORBIT_TARGET);

    this.values = toValues(look);
    this.transparent = look.transparent;
    this.renderer.toneMapping = TONE_MAPPINGS[look.lighting.toneMapping];
    this.camera.fov = look.fov;
    this.resetCamera();
    this.applyValues(this.values);

    this.unsubscribe = editor.subscribeDocument((change) => {
      if (change === 'model') this.skinObject.rebuild();
      if (change === 'pixels') this.skinObject.refreshPixels();
      this.dirty = true;
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.frame = requestAnimationFrame(this.tick);
  }

  // switches to another look, animating so edit and studio feel like one continuous scene
  setLook(look: ViewportLook, animate: boolean): void {
    this.renderer.toneMapping = TONE_MAPPINGS[look.lighting.toneMapping];
    this.transparent = look.transparent;
    const to = toValues(look);
    if (animate) {
      this.transition = { from: this.values, to, start: performance.now() };
    } else {
      this.transition = null;
      this.applyValues(to);
    }
    this.dirty = true;
  }

  // applies layer and part visibility from the layers panel
  setVisibility(visibility: Visibility): void {
    this.skinObject.setVisibility(visibility);
    this.dirty = true;
  }

  // outlines the pixel under the cursor so painting stays pixel accurate in 3d
  setHover(target: { face: SkinFace; x: number; y: number } | null): void {
    for (const [i, line] of this.hover.entries()) {
      line.visible = target !== null;
      if (!target) continue;
      const lift = 0.02 + i * 0.01;
      const grow = i === 0 ? 0.07 : 0;
      const corners = pixelCorners(target.face, target.x, target.y);
      const center = corners
        .reduce((sum, c) => sum.add(new Vector3(...c)), new Vector3())
        .multiplyScalar(0.25);
      const position = line.geometry.getAttribute('position') as BufferAttribute;
      corners.forEach((corner, index) => {
        const point = new Vector3(...corner);
        point.add(point.clone().sub(center).normalize().multiplyScalar(grow));
        point.add(new Vector3(...target.face.normal).multiplyScalar(lift));
        position.setXYZ(index, point.x, point.y, point.z);
      });
      position.needsUpdate = true;
    }
    this.dirty = true;
  }

  // returns every skin face under a screen position, nearest first
  pick(clientX: number, clientY: number): FaceHit[] {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    return intersectFaces(
      { origin: [origin.x, origin.y, origin.z], direction: [direction.x, direction.y, direction.z] },
      this.skinObject.pickableFaces(this.editor.skin.model),
    );
  }

  // returns the camera to the default three-quarter framing
  resetCamera(): void {
    const distance =
      (REFERENCE_DISTANCE * Math.tan((REFERENCE_FOV * Math.PI) / 360)) /
      Math.tan((this.camera.fov * Math.PI) / 360);
    this.controls.target.copy(ORBIT_TARGET);
    this.camera.position
      .copy(ORBIT_TARGET)
      .add(new Vector3(0.42, 0.2, 1).normalize().multiplyScalar(distance));
    this.controls.update();
    this.dirty = true;
  }

  // output size in pixels for a given export scale, capped to what the gpu can allocate
  exportSize(scale: number): { width: number; height: number } {
    const { clientWidth, clientHeight } = this.container;
    const limit = Math.min(this.renderer.capabilities.maxTextureSize, 8192);
    const k = Math.min(scale, limit / Math.max(clientWidth, clientHeight, 1));
    return { width: Math.round(clientWidth * k), height: Math.round(clientHeight * k) };
  }

  // renders the current view offscreen-sized and returns it as a png
  async exportPng(scale: number): Promise<Blob> {
    const { width, height } = this.exportSize(scale);
    const hoverVisible = this.hover.map((line) => line.visible);
    for (const line of this.hover) line.visible = false;
    const gridVisible = this.grid.visible;
    this.grid.visible = false;
    this.setRenderSize(width, height, 1);
    this.composer.render();
    const blob = await new Promise<Blob | null>((resolve) => this.canvas.toBlob(resolve, 'image/png'));
    this.hover.forEach((line, i) => (line.visible = hoverVisible[i]!));
    this.grid.visible = gridVisible;
    this.resize();
    if (!blob) throw new Error('The browser could not encode the render.');
    return blob;
  }

  // stops rendering and frees gpu resources
  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.unsubscribe();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.skinObject.dispose();
    this.grid.dispose();
    this.scene.environment?.dispose();
    this.gtao.dispose();
    this.composer.dispose();
    this.backdropTexture.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }

  // frame loop that only renders when the camera, a transition or the document changed
  private tick = (now: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    if (this.transition) {
      const t = Math.min(1, (now - this.transition.start) / TRANSITION_MS);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.applyValues(mixValues(this.transition.from, this.transition.to, eased));
      if (t >= 1) this.transition = null;
      this.dirty = true;
    }
    if (this.controls.update() || this.dirty) {
      this.dirty = false;
      this.composer.render();
    }
  };

  // pushes interpolated look values into lights, passes and the camera
  private applyValues(values: LookValues): void {
    this.values = values;
    this.background.copy(values.background);
    this.scene.background = this.transparent
      ? null
      : values.vignette > 0.01
        ? this.backdrop(values.vignette)
        : this.background;
    this.ambient.intensity = values.ambient;
    this.hemisphere.color.copy(values.hemiSky);
    this.hemisphere.groundColor.copy(values.hemiGround);
    this.hemisphere.intensity = values.hemiIntensity;
    this.lights.forEach((light, i) => {
      const source = values.lights[i]!;
      light.color.copy(source.color);
      light.intensity = source.intensity;
      light.position.copy(ORBIT_TARGET).add(source.position);
    });
    this.scene.environmentIntensity = values.environment;
    this.renderer.toneMappingExposure = values.exposure;
    const shadows = values.shadow > 0.001;
    this.lights[0]!.castShadow = shadows;
    this.lights[0]!.shadow.intensity = values.shadow;
    this.ground.visible = shadows;
    this.grid.visible = values.grid > 0.01;
    this.grid.material.opacity = values.grid;
    this.gtao.enabled = values.ao > 0.01;
    this.gtao.blendIntensity = values.ao;
    if (this.camera.fov !== values.fov) {
      const scale = Math.tan((this.camera.fov * Math.PI) / 360) / Math.tan((values.fov * Math.PI) / 360);
      this.camera.position.sub(this.controls.target).multiplyScalar(scale).add(this.controls.target);
      this.camera.fov = values.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  // paints a dithered radial studio backdrop so flat colors gain depth without banding
  private backdrop(vignette: number): CanvasTexture {
    const key = `${this.background.getHexString()}:${vignette.toFixed(2)}`;
    if (key === this.backdropKey) return this.backdropTexture;
    this.backdropKey = key;
    const size = 160;
    this.backdropCanvas.width = this.backdropCanvas.height = size;
    const ctx = this.backdropCanvas.getContext('2d')!;
    const base = this.background;
    const tone = (target: number, amount: number) =>
      `#${base.clone().lerp(new Color(target), amount).getHexString()}`;
    const gradient = ctx.createRadialGradient(size / 2, size * 0.46, 0, size / 2, size * 0.46, size * 0.74);
    gradient.addColorStop(0, tone(0xffffff, 0.1 * vignette));
    gradient.addColorStop(0.45, tone(0x000000, 0.06 * vignette));
    gradient.addColorStop(1, tone(0x000000, 0.4 * vignette));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const image = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const noise = Math.round(Math.random() * 2 - 1);
      image.data[i]! += noise;
      image.data[i + 1]! += noise;
      image.data[i + 2]! += noise;
    }
    ctx.putImageData(image, 0, 0);
    this.backdropTexture.colorSpace = SRGBColorSpace;
    this.backdropTexture.needsUpdate = true;
    return this.backdropTexture;
  }

  // matches the drawing buffer to the container whenever the layout changes
  private resize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.setRenderSize(clientWidth, clientHeight, Math.min(window.devicePixelRatio, 2));
  }

  // sets renderer and post-processing buffers to one size, shared by resize and export
  private setRenderSize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
}
