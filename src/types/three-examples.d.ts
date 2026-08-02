declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher } from 'three';

  import { Vector3 } from 'three';
  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    update(): void;
    dispose(): void;
    enableDamping: boolean;
    dampingFactor: number;
    screenSpacePanning: boolean;
    target: Vector3;
  }

  export default OrbitControls;
}
