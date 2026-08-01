declare module "roughjs/bundled/rough.esm.js" {
  import type { RoughSVG } from "roughjs/bin/svg";
  import type { RoughCanvas } from "roughjs/bin/canvas";
  import type { RoughGenerator } from "roughjs/bin/generator";
  import type { Config } from "roughjs/bin/core";
  const rough: {
    canvas(canvas: HTMLCanvasElement, config?: Config): RoughCanvas;
    svg(svg: SVGSVGElement, config?: Config): RoughSVG;
    generator(config?: Config): RoughGenerator;
    newSeed(): number;
  };
  export default rough;
}
