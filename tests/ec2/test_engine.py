"""Numerical acceptance checks from the supplied skills and independent statics."""
import copy
import hashlib
import json
import math
from pathlib import Path
import random
import sys
import unittest
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'public/ec2-engine'))
from beam_sections import materials,flexure,shear,anchorage,area,design_section
from beam_design import moments,reactions,peak,value,elastic_cases,plastic_case,demand_minimum_margin,run
from bridge import compute,load

class EC2(unittest.TestCase):
    def setUp(self):
        self.beam=json.loads((ROOT/'tests/ec2/default-beam.json').read_text())
        self.mat=materials(dict(fck=25,fyk=500,steelClass='B',diagram='horizontal'))
    def test_original_skill_engines_are_unchanged(self):
        provenance=json.loads((ROOT/'public/ec2-engine/provenance.json').read_text())
        for file,digest in provenance['files'].items():
            self.assertEqual(hashlib.sha256((ROOT/'public/ec2-engine'/file).read_bytes()).hexdigest(),digest)
    def test_simply_supported_and_fixed_end_exact_solutions(self):
        q,L=20,6
        self.assertEqual(moments([L],[q]),[0,0])
        self.assertAlmostEqual(peak(q,L,0,0)[0],q*L*L/8)
        mm=moments([L],[q],'fixed','fixed')
        for v in mm:self.assertAlmostEqual(v,-q*L*L/12)
        self.assertAlmostEqual(peak(q,L,*mm)[0],q*L*L/24)
        mm=moments([L],[q],'fixed','simple')
        self.assertAlmostEqual(mm[0],-q*L*L/8)
        self.assertAlmostEqual(mm[1],0)
    def test_two_equal_spans_use_general_system_not_infinite_span_shortcut(self):
        mm=moments([6,6],[20,20]);self.assertAlmostEqual(mm[1],-90)
        self.assertNotAlmostEqual(mm[1],-20*36/12)
    def test_unequal_span_book_cases_and_patterns(self):
        L=[5,4]
        expected=[([15.735,15.735],-41.2885),([15.735,8.235],-34.6218),([8.235,15.735],-28.2677)]
        for q,M in expected:self.assertAlmostEqual(moments(L,q)[1],M,delta=.025)
        q=[15.735,8.235];mm=moments(L,q)
        self.assertAlmostEqual(peak(q[0],L[0],*mm[:2])[0],33.38,delta=.02)
    def test_random_beams_satisfy_vertical_and_moment_equilibrium(self):
        rng=random.Random(19)
        for n in range(1,9):
            L=[rng.uniform(2,10) for _ in range(n)];q=[rng.uniform(1,80) for _ in range(n)]
            for left,right in [('simple','simple'),('fixed','simple'),('fixed','fixed')]:
                M=moments(L,q,left,right);R=reactions(L,q,M)
                self.assertAlmostEqual(sum(R),sum(a*b for a,b in zip(L,q)),places=8)
                loads_m=sum(q[i]*L[i]*(sum(L[:i])+L[i]/2) for i in range(n))
                reaction_m=sum(R[i]*sum(L[:i]) for i in range(n+1))
                self.assertAlmostEqual(reaction_m-loads_m,M[0]-M[-1],places=7)
    def test_flexure_reference_and_mandatory_compression_steel(self):
        sec=dict(type='rect',bw_cm=18,h_cm=60)
        mat=materials(dict(fck=25,fyk=500,steelClass='A',diagram='horizontal',exposure='XD2',alpha_e=15))
        low=flexure(sec,mat,204.8,146.3,550,50)
        self.assertAlmostEqual(low['mu'],.2252,delta=.0005)
        self.assertAlmostEqual(low['As1_calc_mm2']/100,9.82,delta=.06)
        high=flexure(sec,mat,250,250/1.4,550,50)
        self.assertGreater(high['As2_calc_mm2'],0)
        self.assertAlmostEqual(high['As2_calc_mm2']/100,3.58,delta=.12)
        self.assertAlmostEqual(high['As1_calc_mm2']/100,11.93,delta=.12)
    def test_T_section_reference_bending_and_negative_moment_web(self):
        sec=dict(type='t',bw_cm=22,h_cm=85,beff_cm=266,hf_cm=15)
        r=flexure(sec,self.mat,777,550,800,50)
        self.assertAlmostEqual(r['MT_kNm'],4821.25,delta=.001) # exact fcd=25/1.5; book rounds to 16.7
        self.assertAlmostEqual(r['As1_calc_mm2']/100,22.70,delta=.1)
        negative=flexure(sec,self.mat,100,70,800,50,True)
        rect=flexure(dict(type='rect',bw_cm=22,h_cm=85),self.mat,100,70,800,50,True)
        self.assertAlmostEqual(negative['As1_req_mm2'],rect['As1_req_mm2'])
    def test_transverse_reference_variable_and_standard_methods(self):
        variable=shear(220,800,self.mat,269.47,222.62,1608,8,2)
        standard=shear(220,800,self.mat,269.47,222.62,1608,8,2,method='standard')
        self.assertAlmostEqual(variable['VRdc_kN'],89,delta=1)
        self.assertEqual(variable['cot_theta'],2.5)
        self.assertEqual(variable['spacing_mm'],350)
        self.assertEqual(standard['spacing_mm'],140)
        close=shear(350,1580,self.mat,1980.77,1551.47,4020,12,4)
        self.assertLessEqual(close['cot_theta'],1.668)
        self.assertTrue(close['all_ok'])
    def test_actual_layers_reduce_effective_depth_and_ELS_use_provided_bars(self):
        m=self.beam;sec=m['section'];det=m['detailing']
        low=design_section(sec,self.mat,det,100,70)
        high=design_section(sec,self.mat,det,260,185)
        self.assertGreaterEqual(high['tension']['count'],low['tension']['count'])
        self.assertLessEqual(high['d_mm'],high['actual_d_mm']+1e-8)
        self.assertLessEqual(high['d_mm'],low['d_mm'])
        self.assertGreater(high['service']['sigma_s_MPa'],0)
    def test_full_default_result_anchors_and_bar_lengths(self):
        r=compute(self.beam);self.assertTrue(r['all_ok'])
        bars=r['bars'][0]['bottom'];self.assertTrue(bars['left_end']['fits'])
        self.assertGreaterEqual(bars['margin_kNm'],-1e-5)
        self.assertAlmostEqual(bars['groups'][0]['length_m'],4.5+(bars['left_end']['lbd_mm']+bars['right_end']['lbd_mm'])/1000)
        self.assertEqual(sum(z['count'] for z in r['shear'][0]['zones']),r['shear'][0]['count'])
    def test_missing_construction_and_unsupported_internal_fixity_fail_explicitly(self):
        self.beam['analysis']['construction']='unspecified'
        with self.assertRaisesRegex(ValueError,'Précisez'):compute(self.beam)
        self.beam['analysis']['construction']='posed';self.beam['spans']*=2;self.beam['supports'].append(dict(width_m=.3,condition='simple'));self.beam['supports'][1]['condition']='fixed'
        with self.assertRaisesRegex(ValueError,'intermédiaires'):compute(self.beam)
    def test_overstressed_strut_is_not_validated_by_a_tighter_spacing(self):
        sh=shear(200,350,self.mat,2000,1900,400,8,2)
        self.assertFalse(sh['all_ok'])
        self.assertTrue(any(not c['ok'] and 'bielles' in c['name'] for c in sh['checks']))
    def test_T_longitudinal_shear_is_checked_and_joint_changes_demand(self):
        self.beam['section'].update(type='t',beff_cm=120,hf_cm=12)
        r=compute(self.beam);self.assertTrue(r['scope_complete']);self.assertEqual(len(r['flange']),1)
        f=r['flange'][0];self.assertGreater(f['vEd_MPa'],0)
        self.assertEqual(len(f['checks']),3)
        self.beam['analysis']['flange_joint']='rough';s=compute(self.beam)['flange'][0]
        self.assertAlmostEqual(s['threshold_MPa'],f['threshold_MPa']/2)
    def test_plastic_ductility_and_pattern_scope_do_not_silently_fall_back(self):
        self.beam['analysis'].update(method='plastic',patterned=False)
        r=compute(self.beam);self.assertEqual(r['method'],'plastic')
        self.assertTrue(all(c['ok'] for c in r['plastic_checks']))
        self.beam['materials']['steelClass']='A'
        r=compute(self.beam);self.assertFalse(r['all_ok'])
        self.assertEqual(r['method'],'plastic')
        self.beam['materials']['steelClass']='B';self.beam['analysis']['patterned']=True
        self.assertFalse(compute(self.beam)['all_ok'])
    def test_actual_compression_bars_remain_continuous_in_a_doubly_reinforced_span(self):
        m=self.beam;m['section'].update(bw_cm=35,h_cm=65);m['detailing'].update(phi_l_mm=20,cnom_mm=40)
        m['materials']['exposure']='XD2';m['spans'][0].update(ln_m=6,g_kN_m=20,q_kN_m=70)
        for support in m['supports']:support['width_m']=1
        r=compute(m);d=r['spans'][0];top=r['bars'][0]['top']['groups'][0]
        self.assertGreater(d['As2_req_mm2'],2*area(20))
        self.assertGreaterEqual(top['area_mm2'],d['As2_req_mm2'])
        self.assertGreaterEqual(d['compression']['area_mm2'],d['As2_req_mm2'])
        self.assertEqual(d['compression']['phi_mm'],20)
        self.assertLessEqual(d['d_mm'],d['actual_d_mm']+1e-8)
        self.assertTrue(any(c['name'].startswith('Nappe comprimée réellement') for c in r['checks']))

    def test_finite_capacity_envelope_minimum_covers_plateau_roots(self):
        cases=[dict(q=[20],moments=[-30,-60])];L=5
        groups=[dict(area_mm2=400,start_m=-1,end_m=6,anchor_m=1)]
        exact=demand_minimum_margin(groups,cases,0,L,.4,-1,400,435,cap=45)
        def margin(x):
            capacity=400*435*400/1e6*min(1,x+1,6-x)
            demand=min(45,max(0,-value(20,L,-30,-60,max(0,x-.4)),-value(20,L,-30,-60,min(L,x+.4))))
            return capacity-demand
        brute=min(margin(L*i/10000) for i in range(10001))
        self.assertLessEqual(exact,brute+1e-6);self.assertAlmostEqual(exact,brute,delta=.02)

if __name__=='__main__':unittest.main(verbosity=2)
