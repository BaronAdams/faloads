import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:structcalc/src/theme/app_colors.dart';
import 'package:structcalc/src/theme/app_theme.dart';
import 'package:structcalc/src/widgets/struct_icon.dart';
const icons = [
 ('01C',StructIconKind.beamUdl,StructIconAnnotation.none),
 ('02B',StructIconKind.portalFrame,StructIconAnnotation.none),
 ('03C',StructIconKind.column,StructIconAnnotation.load),
 ('04B',StructIconKind.wall,StructIconAnnotation.load),
 ('05B',StructIconKind.building,StructIconAnnotation.load),
 ('06C',StructIconKind.column,StructIconAnnotation.rebar),
 ('07B',StructIconKind.beam,StructIconAnnotation.rebar),
 ('08C',StructIconKind.wall,StructIconAnnotation.rebar),
 ('09A',StructIconKind.stairs,StructIconAnnotation.rebar),
 ('10C',StructIconKind.balcony,StructIconAnnotation.rebar),
 ('11C',StructIconKind.slab,StructIconAnnotation.rebar),
 ('12B',StructIconKind.retainingWall,StructIconAnnotation.rebar),
 ('13C',StructIconKind.footing,StructIconAnnotation.rebar),
];
void main() {
 testWidgets('Export the exact approved Flutter drawings without redesign', (tester) async {
  for(final brightness in Brightness.values) {
   AppColors.setBrightness(brightness);
   for(final (id,kind,annotation) in icons) {
    await tester.pumpWidget(Theme(data: brightness==Brightness.dark?AppTheme.dark:AppTheme.light,
     child: const Directionality(textDirection: TextDirection.ltr,child:SizedBox())));
    await tester.pumpWidget(Theme(data: brightness==Brightness.dark?AppTheme.dark:AppTheme.light,
     child: Directionality(textDirection: TextDirection.ltr,child:Center(child:RepaintBoundary(key:const ValueKey('icon'),
       child:StructIcon(kind:kind,annotation:annotation,size:88))))));
    await tester.pump();
    final boundary=tester.renderObject<RenderRepaintBoundary>(find.byKey(const ValueKey('icon')));
    await tester.runAsync(() async {
     final img=await boundary.toImage(pixelRatio:4);
     final bytes=(await img.toByteData(format:ui.ImageByteFormat.png))!;
     File('../../public/project-icons/$id-${brightness.name}.png').writeAsBytesSync(bytes.buffer.asUint8List());
     img.dispose();
    });
   }
  }
 });
}
