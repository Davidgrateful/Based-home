// Bloom post-processing: makes the rift, shards, eyes and fire glow.

import type * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Vector2 } from "three";

export function makePost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, low: boolean) {
  if (low) {
    return { render: () => renderer.render(scene, camera), setSize: (_w: number, _h: number) => {} };
  }
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(innerWidth / 2, innerHeight / 2), 0.7, 0.55, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setSize: (w: number, h: number) => {
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
    },
  };
}
