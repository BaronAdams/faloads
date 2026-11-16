import 'dart:convert';
import 'dart:io';
import '../legacy/flutter/lib/src/domain/domain.dart';
void main() {
 final cases=<Map<String,dynamic>>[];
 for(final n in [100.0,800.0,3000.0]) {
  for(final reg in Reglement.values) {
   final p=predimPoteau(nEluKn:n,beton:'C25/30',reglement:reg);
   cases.add({'type':'column','input':{'n':n,'code':reg.name},'result':{'side':p.sideCm,'area':p.aminCm2}});
   final v=predimVoile(nEluKn:n,beton:'C25/30',reglement:reg,longueurM:2.5);
   cases.add({'type':'wall','input':{'n':n,'code':reg.name,'length':2.5},'result':{'e':v.eMinCm,'area':v.aminCm2}});
  }
 }
 for(final type in AppuiType.values) {
  final r=predimPoutre(lM:5.0,qEluKnM:25.0,appui:type);
  cases.add({'type':'beam','input':{'length':5,'q':25,'support':type.name},'result':{'b':r.bCm,'h':r.hCm,'moment':r.mMaxKnM}});
 }
 for(final len in [3.5,4.5,6.5]) {
  for(final full in [true,false]) {
   final r=predimPlancher(porteeM:len,pleine:full);
   cases.add({'type':'slab','input':{'length':len,'full':full},'result':{'e':r.epaisseurCm,'label':r.label}});
  }
 }
 final s=predimEscalier(hauteurM:2.7,longueurProjeteeM:4.2);
 cases.add({'type':'stairs','input':{'height':2.7,'length':4.2},'result':{'steps':s.nMarches,'riser':s.hMarcheCm,'tread':s.gironCm,'blondel':s.blondelCm,'e':s.epaisseurCm}});
 final b=predimBalcon(porteeM:1.2,gKnM2:3,qKnM2:1.5);
 cases.add({'type':'balcony','input':{'length':1.2,'g':3,'q':1.5},'result':{'e':b.epaisseurCm,'moment':b.muKnM}});
 for(final type in SemelleType.values) {
  final r=predimSemelle(type:type,nElsKn:500,solBearingKnM2:200,supportCm:30);
  cases.add({'type':'footing','input':{'kind':type.name,'n':500,'bearing':200,'support':30},'result':{'width':r.widthCm,'depth':r.heightCm,'area':r.areaM2}});
 }
 final m=predimMurSoutenement(hauteurM:2.5,gammaSolKnM3:18,phiDeg:30);
 cases.add({'type':'retaining','input':{'height':2.5,'gamma':18,'phi':30},'result':{'thrust':m.activeThrustKnM,'ka':m.kaCoeff,'width':m.baseWidthCm,'stem':m.stemThicknessCm}});
 File('src/domain/legacy-fixtures.json').writeAsStringSync(const JsonEncoder.withIndent('  ').convert(cases));
}
