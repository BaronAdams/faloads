"""Typed application adapter. Original skill engines remain byte-for-byte intact."""
import importlib.util
import json
import math
import os
from pathlib import Path
import sys

HERE=Path(__file__).resolve().parent
os.environ['EC2_SKILLS_ROOT']=str(HERE/'skills')

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

COL=load('column_skill',HERE/'skills/ec2-poteau-complet/scripts/poteau_complet_ec2.py')
from beam_design import run as beam_run

def column_input(m):
    geo=dict(m['geometry']);mode=geo.pop('effective')
    if mode=='lengths':
        geo.pop('end_conditions',None)
    else:
        geo.pop('l0y_m',None);geo.pop('l0z_m',None)
        if mode=='frame':geo.pop('end_conditions',None)
    det={k:v for k,v in m['detailing'].items() if k not in ('mode','bars','coverDev_mm')}
    if m['detailing']['mode']=='verify':det['bars']=m['detailing']['bars']
    loads=dict(m['loads'])
    if loads['mode']=='direct':
        direct=dict(loads['direct']);direct['self_weight']=loads['self_weight']
        if not direct.pop('qp_enabled'):direct.pop('qp',None)
        # A zero optional midpoint is not an imposed zero-moment section.
        for p in ['y','z']:
            direct[p]=dict(direct[p])
            if abs(direct[p]['M_mid_kNm'])<1e-12:direct[p].pop('M_mid_kNm')
        loads['direct']=direct
    return dict(section=m['section'],geometry=geo,materials=m['materials'],detailing=det,loads=loads,
                options={**m['options'],'min_eccentricity_check':True,'strict_level1_entry':True})

def run_column(m):
    inp=column_input(m)
    if m['section']['type']=='circ':
        # The supplied complete-column engine is rectangular only. A circular
        # section therefore uses the supplied centred-compression engine only.
        if inp['loads']['mode']=='actions':
            for a in inp['loads']['actions']:
                if a['transverse'] or any(abs(v)>1e-10 for p in a['moments'].values() for v in p.values()) or any(abs(v)>1e-10 for v in a['eccentricity_m'].values()):
                    raise ValueError('Section circulaire : seuls les efforts normaux centrés sont pris en charge. Utilisez une section rectangulaire pour les moments ou le second ordre.')
        elif any(abs(v)>1e-10 for p in ['y','z'] for k,v in inp['loads']['direct'][p].items()):
            raise ValueError('Section circulaire : compression centrée uniquement, sans moment imposé.')
        diameter=m['section']['a_cm'];Ac=math.pi*diameter*diameter/4
        combos,qp=COL.build_combinations(inp['loads'],Ac,inp['geometry']['l_m'],[],[])
        N=max(c['eff']['N_base'] for c in combos)
        ci=dict(section={'type':'circ','a_cm':diameter},materials=inp['materials'],geometry=inp['geometry'],
                loads={'NEd_kN':N,'add_self_weight':False},detailing=inp['detailing'])
        if m['detailing']['mode']=='verify':ci['bars']={'n':m['detailing']['bars']['n'],'phi':m['detailing']['bars']['phi']}
        if m['geometry']['effective']=='lengths':
            # Circular inertia is identical in every plane; use the longer l0.
            l0=max(m['geometry']['l0y_m'],m['geometry']['l0z_m'])
            ci['geometry']={**ci['geometry'],'l0b_m':l0,'l0h_m':l0}
        r=COL.CS.compute(ci)
        if m['detailing']['mode']=='design':
            choices=[]
            from beam_sections import DIAMETERS
            for phi in DIAMETERS:
                if not m['detailing']['phi_l_min_mm']<=phi<=m['detailing']['phi_l_max_mm']:continue
                for candidate in COL.CS.propose_bars(r['longitudinal']['As_req_cm2'],phi):
                    layout=COL.CS.layout_check('circ',None,None,diameter,candidate['n'],phi,m['detailing']['phi_t_mm'],m['detailing']['cnom_mm'],m['detailing']['dg_mm'])
                    if layout['spacing_ok']:choices.append(candidate)
            if not choices:raise ValueError('Aucun ferraillage circulaire ne respecte la plage de diamètres et les espacements.')
            selected=min(choices,key=lambda c:(c['As_prov'],c['n']))
            ci['bars']={k:selected[k] for k in ['n','phi']};r=COL.CS.compute(ci)
        r['kind']='rc-column';r['circular']=True;r['final_stage']=1
        r['limits']=['Compression centrée uniquement ; flexion et second ordre non dimensionnés pour la section circulaire.','Durabilité, feu, ELS et dispositions de connexion au bâtiment à vérifier séparément.']
        r['scope_complete']=True
        r['combinations']=[dict(name=c['name'],N_base_kN=c['eff']['N_base'],N_top_kN=c['eff']['N_top']) for c in combos]
        r['cascade']=[];r['cases']=[]
        longitudinal=r['longitudinal']
        r['reinforcement']=dict(layout=dict(phi=longitudinal['phi_l_mm'],phi_i=longitudinal['phi_l_mm'],n=longitudinal['n_bars'],As_prov=longitudinal['As_prov_cm2'],e_mm=m['detailing']['cnom_mm']+m['detailing']['phi_t_mm']+longitudinal['phi_l_mm']/2),As_req_tot_cm2=longitudinal['As_req_cm2'],As_min_tot_cm2=longitudinal['As_min_cm2'],transverse=r['transverse'],lap=r.get('lap'),alternatives=[])
        r['checks'].append(dict(name='Enrobage nominal de liaison avec tolérance',value=m['detailing']['cnom_mm'],limit=longitudinal['phi_l_mm']+m['detailing']['coverDev_mm'],unit='mm',ok=m['detailing']['cnom_mm']>=longitudinal['phi_l_mm']+m['detailing']['coverDev_mm']))
        count=longitudinal['n_bars'];phi=longitudinal['phi_l_mm']
        radius=diameter*5-(m['detailing']['cnom_mm']+m['detailing']['phi_t_mm']+phi/2)
        clear=2*radius*math.sin(math.pi/count)-phi
        minimum=max(phi,m['detailing']['dg_mm']+5,20)
        r['checks'].append(dict(name='Espacement libre réel sur la corde',value=clear,limit=minimum,unit='mm',ok=clear>=minimum))
        r['all_ok']=all(c['ok'] for c in r['checks'])
        return r
    inp['section']=dict(inp['section'])
    inp['section']['dp_cm']=(m['detailing']['cnom_mm']+m['detailing']['phi_t_mm']+m['detailing']['phi_l_min_mm']/2)/10
    for iteration in range(8):
        r=COL.run(inp)
        actual=r['reinforcement']['layout']['e_mm']/10
        if actual<=inp['section']['dp_cm']+1e-8:break
        inp['section']['dp_cm']=actual
    else:raise ValueError('La géométrie réelle des armatures ne converge pas : revoir les dimensions.')
    r['kind']='rc-column';r['circular']=False
    r['notes'].insert(0,'Hauteur utile revérifiée sur les axes réels des barres retenues (d′ = %.2f cm).'%inp['section']['dp_cm'])
    lay=r['reinforcement']['layout'];det=m['detailing'];sec=m['section']
    minimum=max(lay['phi'],det['dg_mm']+5,20)
    r['checks'].append(dict(name='Espacement libre minimal des barres',value=min(lay['clear_b_mm'],lay['clear_h_mm']),limit=minimum,unit='mm',ok=min(lay['clear_b_mm'],lay['clear_h_mm'])>=minimum-1e-8))
    required_cover=lay['phi']+det['coverDev_mm']
    r['checks'].append(dict(name='Enrobage nominal de liaison avec tolérance',value=det['cnom_mm'],limit=required_cover,unit='mm',ok=det['cnom_mm']>=required_cover))
    if r['reinforcement'].get('lap'):
        for key in ['s_ok_0_6','gap_ok_0_6','s_ok_150','sum_Ast_ok']:
            lap=r['reinforcement']['lap']
            if key in lap:r['checks'].append(dict(name='Dispositions de recouvrement — '+key,ok=bool(lap[key])))
    # An out-of-scope short column must not acquire a green verdict merely
    # because the source engine emitted a warning instead of raising.
    slender_geom=inp['geometry']['l_m']*100/max(sec['b_cm'],sec['h_cm'])
    r['checks'].append(dict(name='Proportions de poteau : grande dimension < 4 × petite dimension',ok=max(sec['b_cm'],sec['h_cm'])<4*min(sec['b_cm'],sec['h_cm'])))
    r['checks'].append(dict(name='Domaine du poteau élancé : l/h ≥ 3',value=slender_geom,limit=3,ok=slender_geom>=3))
    biaxial=any(abs(c['Mmax'])>1e-7 for c in r['cases'] if c['plane']=='y') and any(abs(c['Mmax'])>1e-7 for c in r['cases'] if c['plane']=='z')
    convergence=all(s.get('converged',s.get('all_ok',True)) for s in r['cascade'] if s['stage']==3)
    r['checks'].append(dict(name='Convergence du calcul de second ordre',ok=convergence))
    for case in r['verification']['sections']:
        for section in case['sections']:
            info=section.get('second_order')
            if info:r['checks'].append(dict(name='Domaine stable de second ordre — %s / %s'%(case['combo'],case['plane']),ok=bool(info.get('stable',False))))
    for check in r['checks']:
        if check['name'].startswith('MRd'):check['unit']='kN·m'
        elif check['name'].startswith('As,min'):check['unit']='cm²'
    r['all_ok']=all(c['ok'] for c in r['checks'])
    r['scope_complete']=not biaxial
    r['limits']=['Les combinaisons automatiques retiennent les actions simultanées avec une action variable dominante ; actions favorables, omissions, alternances de vent et situations accidentelles à envelopper dans l’analyse et à saisir en efforts directs.',
                 'Vérifications séparées dans les deux plans ; la flexion déviée EC2 5.8.9 n’est pas vérifiée.','ELS, feu, séisme et formule particulière de l’annexe nationale française non calculés.','Ferraillage symétrique ; les barres intermédiaires ne contribuent pas à MRd et à Is.','Durabilité de l’enrobage à confirmer : le tableau des cmin,dur n’est pas embarqué.']
    if biaxial:r['warnings'].append('Des moments sont présents dans les deux plans : une vérification complémentaire de flexion déviée est nécessaire avant de conclure.')
    return r

def compute(m):
    if m.get('legacy') and not m['legacy'].get('reviewed'):
        raise ValueError('Vérifiez et confirmez les données provenant de l’ancienne étude avant de calculer.')
    if m['kind']=='rc-column':return run_column(m)
    if m['kind']=='rc-beam':return beam_run(m)
    raise ValueError('Type de dimensionnement inconnu.')

def compute_json(text):
    return json.dumps(compute(json.loads(text)),ensure_ascii=False,allow_nan=False)

if __name__=='__main__':
    source=json.load(open(sys.argv[1],encoding='utf8')) if len(sys.argv)>1 else json.load(sys.stdin)
    print(json.dumps(compute(source),ensure_ascii=False,allow_nan=False))
