import {
  DxfWriter,
  DxfObject,
  type Dxfier,
  type DxfBlock,
  point3d,
  Units,
  TextHorizontalAlignment,
  TextVerticalAlignment,
} from "@tarikjabiri/dxf";
import type { RCPlan } from "./plans";
// DXF R2007 layout objects: paper coordinates in millimetres, physical A4 landscape.
class PlanLayout extends DxfObject {
  constructor(
    readonly name: string,
    readonly block: DxfBlock,
    readonly order: number,
    owner: string,
  ) {
    super("LAYOUT");
    this.ownerObjecthandle = owner;
    block.blockRecord.layoutObject = this.handle;
  }
  dxfy(dx: Dxfier) {
    super.dxfy(dx);
    dx.subclassMarker("AcDbPlotSettings");
    for (const [code, value] of [
      [1, ""],
      [2, ""],
      [4, "ISO_A4_(297.00_x_210.00_MM)"],
      [6, ""],
      [40, 0],
      [41, 0],
      [42, 0],
      [43, 0],
      [44, 297],
      [45, 210],
      [46, 0],
      [47, 0],
      [48, 0],
      [49, 0],
      [140, 0],
      [141, 0],
      [142, 1],
      [143, 1],
      [70, 688],
      [72, 1],
      [73, 0],
      [74, 5],
      [7, ""],
      [75, 16],
      [76, 0],
      [77, 2],
      [78, 300],
      [147, 1],
      [148, 0],
      [149, 0],
    ] as [number, string | number][])
      dx.push(code, value);
    dx.subclassMarker("AcDbLayout");
    dx.push(1, this.name);
    dx.push(70, 1);
    dx.push(71, this.order);
    dx.point2d({ x: 0, y: 0 }, 0);
    dx.point2d({ x: 297, y: 210 }, 1);
    dx.point3d(point3d(0, 0, 0), 2);
    dx.point3d(point3d(0, 0, 0), 4);
    dx.point3d(point3d(297, 210, 0), 5);
    dx.push(146, 0);
    dx.point3d(point3d(), 3);
    dx.point3d(point3d(1, 0, 0), 6);
    dx.point3d(point3d(0, 1, 0), 7);
    dx.push(76, 0);
    dx.push(330, this.block.blockRecord.handle);
  }
}
export function planDxf(plan: RCPlan): string {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  dxf.header.setVariable("$MEASUREMENT", { 70: 1 });
  dxf.header.setVariable("$LWDISPLAY", { 290: 1 });
  dxf.header.setVariable("$LIMMIN", { 10: 0, 20: 0 });
  dxf.header.setVariable("$LIMMAX", { 10: 297, 20: 210 });
  dxf.addLType("DASHED", "Demand envelope", [2, -1]);
  const layers = [
    "CONCRETE",
    "STEEL",
    "STIRRUPS",
    "DIMENSIONS",
    "TEXT",
    "FRAME",
    "DEMAND",
    "CAPACITY",
  ];
  for (const name of layers)
    dxf.addLayer(name, 7, name === "DEMAND" ? "DASHED" : "CONTINUOUS");
  const dictionary = dxf.document.objects.addDictionary();
  dxf.document.objects.addEntryToRoot("ACAD_LAYOUT", dictionary.handle);
  const model = dxf.document.objects.addObject(
    new PlanLayout("Model", dxf.document.modelSpace, 0, dictionary.handle),
  );
  dictionary.addEntryObject("Model", model.handle);
  const paper = dxf.document.objects.addObject(
    new PlanLayout(
      "A4 Landscape",
      dxf.document.paperSpace,
      1,
      dictionary.handle,
    ),
  );
  dictionary.addEntryObject("A4 Landscape", paper.handle);
  // The title block and its annotations are native, editable CAD entities.
  for (const space of [dxf.document.modelSpace, dxf.document.paperSpace])
    for (const p of plan.items) {
      const options = { layerName: p.layer };
      if (p.kind === "line")
        for (let i = 1; i < p.points.length; i++)
          space.addLine(
            point3d(p.points[i - 1][0], 210 - p.points[i - 1][1]),
            point3d(p.points[i][0], 210 - p.points[i][1]),
            options,
          );
      else if (p.kind === "circle")
        space.addCircle(point3d(p.x, 210 - p.y), p.r, options);
      else {
        const point = point3d(p.x, 210 - p.y);
        space.addText(point, p.size, p.text, {
          ...options,
          horizontalAlignment:
            p.anchor === "center"
              ? TextHorizontalAlignment.Center
              : p.anchor === "right"
                ? TextHorizontalAlignment.Right
                : TextHorizontalAlignment.Left,
          verticalAlignment: TextVerticalAlignment.Middle,
          secondAlignmentPoint: point,
        });
      }
    }
  dxf.document.setViewCenter(point3d(148.5, 105));
  return dxf.stringify();
}
