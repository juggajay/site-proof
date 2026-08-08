/**
 * Wave 5b — ThatOpen fragments viewer adapter.
 *
 * The ONLY module (with ModelViewerCanvas) allowed to import the 3D stack
 * (three / @thatopen / web-ifc / camera-controls) — productionReadiness.spec.ts
 * enforces the boundary so the ~2 MB vendor-3d chunk never leaks into eager
 * code. Mechanics are ported from the proven Wave 0 spike harness
 * (siteproof-test-plans/spatial-spike/src/main.ts); do not rediscover them:
 *
 *  - Never serve this app with COOP/COEP headers: crossOriginIsolated flips
 *    web-ifc to its multithreaded build whose pthread worker URL resolves to
 *    /undefined under Vite and Init() never returns.
 *  - The fragments worker is fetched and re-wrapped as a blob File (mirroring
 *    OBC.FragmentsManager.getWorker() without its unpkg fetch) — never hand
 *    ThatOpen the raw URL.
 *  - Camera fit is a requirement, not polish: SimpleCamera defaults to
 *    far=1000 and a 5.6 km corridor clips to an empty viewport. Every load
 *    recomputes near/far from the model's bounding box and fits to it.
 */
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { RenderedFaces } from '@thatopen/fragments';
import type * as FRAGS from '@thatopen/fragments';

import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { openingBoxAndAzimuth } from './openingFit';
import { flattenPsets, type PickedElementData } from './psets';
import type { PaintLayer } from './playbackPaint';

export interface PickedElement extends PickedElementData {
  localId: number;
}

export interface FragmentsViewer {
  loadModel(buffer: ArrayBuffer, modelId: string): Promise<void>;
  resetView(): Promise<void>;
  pickAt(clientX: number, clientY: number): Promise<PickedElement | null>;
  /** ifcGuid → localId for every element with geometry (4D playback's join). */
  getElementGuidIndex(): Promise<Map<string, number>>;
  /** Apply playback paint layers in order (ghost-all first, then buckets). */
  applyPaint(layers: PaintLayer[]): Promise<void>;
  /** Restore original materials (leaving playback). */
  clearPaint(): Promise<void>;
  dispose(): void;
}

const WORKER_URL = '/wasm/frag-worker.mjs';
const BACKGROUND = 0xf4f4f5; // zinc-100 — quiet canvas under the office shell

export async function createFragmentsViewer(container: HTMLElement): Promise<FragmentsViewer> {
  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.SimpleCamera(components);
  components.init();
  world.scene.setup();
  world.scene.three.background = new THREE.Color(BACKGROUND);
  // Documented white-label opt-out (MIT) — CIVOS is a customer-branded surface.
  world.renderer.showLogo = false;

  const fragments = components.get(OBC.FragmentsManager);
  const workerBlob = await fetchWithTimeout(WORKER_URL).then((response) => {
    if (!response.ok) throw new Error(`Viewer worker fetch failed (${response.status})`);
    return response.blob();
  });
  const workerObjectUrl = URL.createObjectURL(
    new File([workerBlob], 'worker.mjs', { type: 'text/javascript' }),
  );
  fragments.init(workerObjectUrl);

  const onCameraUpdate = () => fragments.core.update();
  world.camera.controls.addEventListener('update', onCameraUpdate);

  let model: FRAGS.FragmentsModel | null = null;
  let modelBox: THREE.Box3 | null = null;

  const paintFrame = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

  async function frameModel(animate: boolean): Promise<void> {
    if (!modelBox || modelBox.isEmpty()) return;
    const diag = modelBox.min.distanceTo(modelBox.max);
    const camera = world.camera.three as THREE.PerspectiveCamera;
    camera.near = Math.max(0.1, diag / 10000);
    camera.far = diag * 6;
    camera.updateProjectionMatrix();
    const { fit, azimuth } = openingBoxAndAzimuth(modelBox);
    await world.camera.controls.rotateTo(azimuth, Math.PI / 3.2, animate);
    await world.camera.controls.fitToBox(fit, animate);
    await fragments.core.update(true);
    await paintFrame();
  }

  return {
    async loadModel(buffer: ArrayBuffer, modelId: string): Promise<void> {
      model = await fragments.core.load(buffer, { modelId });
      model.useCamera(world.camera.three);
      world.scene.three.add(model.object);
      await fragments.core.update(true);
      await paintFrame();
      modelBox = model.box ?? new THREE.Box3().setFromObject(model.object);
      await frameModel(false);
    },

    async resetView(): Promise<void> {
      await frameModel(true);
    },

    async getElementGuidIndex(): Promise<Map<string, number>> {
      const index = new Map<string, number>();
      if (!model) return index;
      const localIds = await model.getItemsIdsWithGeometry();
      const guids = await model.getGuidsByLocalIds(localIds);
      guids.forEach((guid, i) => {
        if (guid) index.set(guid, localIds[i]);
      });
      return index;
    },

    async applyPaint(layers: PaintLayer[]): Promise<void> {
      if (!model) return;
      // Reset first so a repaint (date change) never stacks on stale buckets.
      await model.resetHighlight();
      for (const layer of layers) {
        if (layer.localIds && layer.localIds.length === 0) continue;
        await model.highlight(layer.localIds, {
          color: new THREE.Color(layer.color),
          renderedFaces: RenderedFaces.ONE,
          opacity: layer.opacity,
          transparent: layer.opacity < 1,
        });
      }
      await fragments.core.update(true);
      await paintFrame();
    },

    async clearPaint(): Promise<void> {
      if (!model) return;
      await model.resetHighlight();
      await fragments.core.update(true);
      await paintFrame();
    },

    async pickAt(clientX: number, clientY: number): Promise<PickedElement | null> {
      if (!model || !world.renderer) return null;
      const dom = world.renderer.three.domElement;
      const hit = await model.raycast({
        camera: world.camera.three,
        mouse: new THREE.Vector2(clientX, clientY),
        dom,
      });
      if (!hit) return null;
      const [data] = await model.getItemsData([hit.localId], {
        attributesDefault: true,
        relations: { IsDefinedBy: { attributes: true, relations: true } },
      });
      return { localId: hit.localId, ...flattenPsets(data) };
    },

    dispose(): void {
      world.camera.controls.removeEventListener('update', onCameraUpdate);
      model = null;
      modelBox = null;
      components.dispose();
      URL.revokeObjectURL(workerObjectUrl);
    },
  };
}
