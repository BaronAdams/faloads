"""EC2 beam sections, SI boundaries in mm/MPa/kN. Shared by every span.
Source: supplied ec2-flexion-simple and ec2-effort-tranchant skills.
No result is declared valid without checking the actual bar arrangement.
"""
import math

DIAMETERS = [8, 10, 12, 14, 16, 20, 25, 32]
CAQUOT_MM = [70, 80, 90, 100, 110, 130, 160, 200, 250, 350, 400, 600]
ES = 200000.0

def area(phi):
    return math.pi * phi * phi / 4

def check(name, value, limit, ok, unit=""):
    return dict(name=name, value=value, limit=limit, ok=bool(ok), unit=unit)

def materials(m):
    fck, fyk = float(m['fck']), float(m.get('fyk', 500))
    if not 12 <= fck <= 50 or fyk not in (400, 500, 600):
        raise ValueError('Matériaux hors domaine : 12 ≤ fck ≤ 50 MPa, fyk = 400, 500 ou 600 MPa.')
    diagram = m.get('diagram', 'horizontal')
    if m.get('exposure','XC1').upper().startswith(('XD','XF','XS')) and fyk!=500:
        raise ValueError('Les relations de moment limite ELS en XD, XF et XS couvrent S500 uniquement dans ce profil. Choisissez S500 pour ces classes.')
    if diagram == 'inclined' and fyk != 500:
        raise ValueError('Le palier incliné fourni couvre S500 uniquement. Choisissez le palier horizontal.')
    fyd, fcd = fyk / 1.15, fck / 1.5
    return dict(fck=fck, fyk=fyk, fyd=fyd, fcd=fcd, fctm=.3*fck**(2/3),
                ae=m.get('alpha_e', 15), diagram=diagram, steel_class=m.get('steelClass','B'),
                limited=m.get('exposure','XC1').upper().startswith(('XD','XF','XS')),
                crack_control=m.get('crack_control',False))

def steel_stress(eps, mat):
    eps = max(0.,eps)
    if eps <= mat['fyd']/ES:
        return ES*eps
    if mat['diagram'] == 'horizontal':
        return mat['fyd']
    a,b,cap = {'A':(432.71,952.38,454.),'B':(433.20,727.27,466.),'C':(432.84,895.52,493.)}[mat['steel_class']]
    return min(cap,a+b*eps)

def moment_limit(mat, gamma):
    if not mat['limited']:
        alpha = .0035 / (.0035+mat['fyd']/ES)
        return .8*alpha*(1-.4*alpha)
    f,ae = mat['fck'],mat['ae']
    if mat['diagram'] == 'inclined':
        den=(4.62-1.66*gamma)*f+165.69-79.62*gamma
        K=(75.3*f-189.8+(-5.6*f+874.5)*ae+(.04*f-13)*ae*ae)*1e-4
    else:
        den=(4.69-1.70*gamma)*f+159.90-76.20*gamma
        K=(71.2*f+108+(-5.2*f+847.4)*ae+(.03*f-12.5)*ae*ae)*1e-4
    if den <= 0 or K <= 0:
        raise ValueError('La relation de moment limite ELS sort de son domaine : vérifier les charges et αe.')
    return min(.499999, f/den*K)

def flexure(section, mat, M_kNm, Mser_kNm, d_mm, dp_mm, negative=False):
    """Skill §3–4; compression flange applies only for sagging moments."""
    bw,h=section['bw_cm']*10,section['h_cm']*10
    bf=section.get('beff_cm',section['bw_cm'])*10 if section['type']=='t' else bw
    hf=section.get('hf_cm',0)*10 if section['type']=='t' else 0
    if negative: bf,hf=bw,0
    if not 0 < dp_mm < d_mm < h: raise ValueError('Hauteurs utiles incohérentes : 0 < d′ < d < h requis.')
    M=abs(M_kNm)*1e6
    gamma=abs(M_kNm/Mser_kNm) if abs(Mser_kNm)>1e-10 else 1.5
    mu_lim=moment_limit(mat,gamma)
    fcd,fyd=mat['fcd'],mat['fyd']
    MT=bf*hf*fcd*(d_mm-hf/2)
    flange_M=0.
    width=bw
    if bf>bw:
        if M <= MT:
            width=bf
        else:
            flange_M=MT*(bf-bw)/bf
    web_M=max(0,M-flange_M)
    mu=web_M/(width*d_mm*d_mm*fcd)
    use_mu=min(mu,mu_lim)
    alpha=(1-math.sqrt(max(0,1-2*use_mu)))/.8
    epsud={'A':.0225,'B':.045,'C':.0675}[mat['steel_class']]
    alpha_ab=.0035/(.0035+epsud) if mat['diagram']=='inclined' else 0
    pivot='A' if alpha <= alpha_ab and M>0 else 'B'
    eps=epsud if pivot=='A' else .0035*(1-alpha)/max(alpha,1e-12)
    sigma=steel_stress(eps,mat)
    lever=d_mm*(1-.6*use_mu) if use_mu<=.225 else d_mm*(1-.4*alpha)
    As2=0.;sigma2=0.;Mlim=mu_lim*width*d_mm*d_mm*fcd
    if mu > mu_lim:
        # Supplementary compression steel is never replaced by a fake SLS pass.
        if mat['limited'] and mat['fck']<=35 and mat['fyk']==500:
            if mat['diagram']=='inclined': A,B=-5/mat['ae']+13,6855/mat['ae']-9
            else:A,B=.5/mat['ae']+13,6517/mat['ae']+1
            sigma2=.6*mat['ae']*gamma*mat['fck']-dp_mm/d_mm*(A*mat['fck']+B)
            sigma2=min(fyd,max(1e-9,sigma2))
        else:
            sigma2=min(fyd,ES*.0035*max(0,alpha-dp_mm/d_mm)/max(alpha,1e-12))
        if sigma2<=1e-8: raise ValueError('Aciers comprimés inefficaces : augmenter la hauteur de section.')
        As2=(web_M-Mlim)/((d_mm-dp_mm)*sigma2)
    As1=min(web_M,Mlim)/(max(lever,1e-9)*max(sigma,1e-9))+As2*sigma2/max(sigma,1e-9)
    if flange_M:
        As1+=flange_M/((d_mm-hf/2)*fyd)
    fcteff=mat['fctm'] if mat['crack_control'] else max(1,1.6-h/1000)*mat['fctm']
    amin=max(.26*fcteff/mat['fyk']*bw*d_mm,.0013*bw*d_mm)
    Ac=section['bw_cm']*10*h+(section.get('beff_cm',section['bw_cm'])*10-bw)*hf if section['type']=='t' else bw*h
    return dict(MEd_kNm=abs(M_kNm),Mser_kNm=abs(Mser_kNm),negative=negative,d_mm=d_mm,dp_mm=dp_mm,
                mu=mu,mu_limit=mu_lim,alpha=alpha,pivot=pivot,epsilon_s=eps,sigma_s_MPa=sigma,
                sigma_s2_MPa=sigma2,z_mm=lever,MT_kNm=MT/1e6,flange_M_kNm=flange_M/1e6,
                As1_calc_mm2=As1,As2_calc_mm2=As2,As_min_mm2=amin,As_max_mm2=.04*Ac,
                As1_req_mm2=max(As1,amin),As2_req_mm2=As2,Ac_mm2=Ac)

def bar_layout(required, width_mm, h_mm, cnom, phit, phi, dg, mounting=False):
    count=max(2,math.ceil(required/area(phi)-1e-10))
    e=cnom+phit+phi/2
    minimum=max(phi,dg+5,20)
    available=width_mm-2*e
    # Count using clear distance between centres, not concrete face width.
    per_row=math.floor(available/(phi+minimum))+1 if available>=0 else 0
    if per_row<2 or count>3*per_row:
        raise ValueError('Les barres ne tiennent pas dans trois lits : élargir la section ou changer le diamètre.')
    rows=[];left=count
    while left:
        k=min(per_row,left)
        if left-k==1 and k>2: k-=1
        y=e+len(rows)*(phi+minimum)
        rows.append(dict(count=k,phi_mm=phi,offset_mm=y,area_mm2=k*area(phi),
                         xs_mm=[width_mm/2] if k==1 else [e+j*available/(k-1) for j in range(k)]))
        left-=k
    steel=sum(r['area_mm2'] for r in rows)
    centroid=sum(r['area_mm2']*r['offset_mm'] for r in rows)/steel
    return dict(phi_mm=phi,count=count,area_mm2=steel,centroid_mm=centroid,rows=rows,
                clear_min_mm=minimum,required_mm2=required,mounting=mounting)

def service(section, mat, bottom, top, Mser_kNm, d_mm, dp_mm, negative=False):
    bw,h=section['bw_cm']*10,section['h_cm']*10
    bf=section.get('beff_cm',section['bw_cm'])*10 if section['type']=='t' else bw
    hf=section.get('hf_cm',0)*10 if section['type']=='t' else 0
    # Use the actual T concrete area, including a tension flange for hogging.
    if negative:
        # Rotate the coordinate system: the flange is now at the tension face.
        bands=[(0,h,bw)]+([(h-hf,h,bf-bw)] if hf else [])
    else: bands=[(0,h,bw)]+([(0,hf,bf-bw)] if hf else [])
    ae=mat['ae'];A1=bottom['area_mm2'];A2=top['area_mm2'];Ms=abs(Mser_kNm)*1e6
    Ac=sum((b-a)*w for a,b,w in bands)
    first=sum((b*b-a*a)*w/2 for a,b,w in bands)
    second=sum((b**3-a**3)*w/3 for a,b,w in bands)
    Ach=Ac+ae*(A1+A2);v=(first+ae*(A1*d_mm+A2*dp_mm))/Ach
    I=second+ae*(A1*d_mm*d_mm+A2*dp_mm*dp_mm)-Ach*v*v
    sigct=Ms*(h-v)/I
    fcteff=mat['fctm'] if mat['crack_control'] else max(1,1.6-h/1000)*mat['fctm']
    cracked=sigct>fcteff+1e-8
    if cracked:
        def equilibrium(x):
            q=0.
            for a,b,w in bands:
                end=min(x,b)
                if end>a:q+=w*(x*(end-a)-(end*end-a*a)/2)
            return q+ae*A2*(x-dp_mm)-ae*A1*(d_mm-x)
        lo,hi=0.,h
        for _ in range(90):
            mid=(lo+hi)/2
            if equilibrium(mid)>0:hi=mid
            else:lo=mid
        v=(lo+hi)/2
        I=ae*A1*(d_mm-v)**2+ae*A2*(v-dp_mm)**2
        for a,b,w in bands:
            end=min(v,b)
            if end>a:I+=w*((v-a)**3-(v-end)**3)/3
    sigma_c=Ms*v/I
    sigma_s=ae*Ms*abs(d_mm-v)/I
    return dict(cracked=cracked,initial_tension_MPa=sigct,fct_eff_MPa=fcteff,x_mm=v,I_mm4=I,
                sigma_c_MPa=sigma_c,sigma_s_MPa=sigma_s,sigma_c_limit_MPa=.6*mat['fck'] if mat['limited'] else None,
                sigma_s_limit_MPa=.8*mat['fyk'],ok=(not mat['limited'] or sigma_c<=.6*mat['fck']+1e-6) and sigma_s<=.8*mat['fyk']+1e-6)

def design_section(section, mat, detailing, M, Ms, negative=False, els=True, provided=None):
    provided=provided or (0.,0.)
    h=section['h_cm']*10;bw=section['bw_cm']*10
    c=detailing['cnom_mm'];phit=detailing['phi_t_mm'];phi=detailing['phi_l_mm'];dg=detailing['dg_mm']
    if phi not in DIAMETERS or phit not in [6]+DIAMETERS: raise ValueError('Choisir un diamètre commercial HA8 à HA32.')
    dp=c+phit+phi/2
    d=min(.9*h,h-dp) if section.get('depthMode','auto')=='auto' else section['d_cm']*10
    iterations=[]
    for iteration in range(12):
        calc=flexure(section,mat,M,Ms,d,dp,negative)
        tension=bar_layout(max(calc['As1_req_mm2'],provided[0]),bw,h,c,phit,phi,dg)
        compression=bar_layout(max(calc['As2_req_mm2'],provided[1]),bw,h,c,phit,phi,dg,mounting=calc['As2_req_mm2']==0)
        real_d=h-tension['centroid_mm'];real_dp=compression['centroid_mm']
        iterations.append(dict(iteration=iteration+1,d_mm=d,real_d_mm=real_d,dp_mm=dp,real_dp_mm=real_dp,
                               As1_mm2=tension['area_mm2'],As2_mm2=compression['area_mm2']))
        if real_d>=d-1e-8 and (calc['As2_req_mm2']==0 or real_dp<=dp+1e-8):break
        d=min(d,real_d);dp=max(dp,real_dp)
        if dp>=d:raise ValueError('Les nappes se recouvrent : augmenter la hauteur de section.')
    else: raise ValueError('Le calcul des lits ne converge pas : revoir la section et les diamètres.')
    checks=[check('Section d’acier tendu suffisante',tension['area_mm2'],calc['As1_req_mm2'],tension['area_mm2']>=calc['As1_req_mm2']-1e-8,'mm²'),
            check('Section totale d’acier ≤ 4 % du béton',tension['area_mm2']+compression['area_mm2'],calc['As_max_mm2'],tension['area_mm2']+compression['area_mm2']<=calc['As_max_mm2']+1e-8,'mm²'),
            check('Séparation des nappes',tension['rows'][-1]['offset_mm']+compression['rows'][-1]['offset_mm']+phi,h,tension['rows'][-1]['offset_mm']+compression['rows'][-1]['offset_mm']+phi<=h,'mm'),
            check('Diamètre minimal des cadres',phit,max(6,phi/4),phit>=max(6,phi/4),'mm'),
            check('Enrobage nominal de liaison avec tolérance',c,phi+detailing.get('coverDev_mm',10),c>=phi+detailing.get('coverDev_mm',10),'mm')]
    sls=service(section,mat,tension,compression,Ms,real_d,real_dp,negative) if els else None
    if sls: checks.append(check('Contraintes ELS',sls['sigma_s_MPa'],sls['sigma_s_limit_MPa'],sls['ok'],'MPa'))
    return dict(**calc,tension=tension,compression=compression,iterations=iterations,service=sls,checks=checks,
                all_ok=all(c['ok'] for c in checks),actual_d_mm=real_d,actual_dp_mm=real_dp)

def shear(bw_mm,d_mm,mat,Ved_kN,Vred_kN,Asl_mm2,phi_t=8,branches=2,alpha_deg=90,method='variable',compressed_phi=0,cover=35,phi_l=20):
    z=.9*d_mm;V=abs(Ved_kN)*1000;Vr=abs(Vred_kN)*1000
    sa=math.sin(math.radians(alpha_deg));ca=1/math.tan(math.radians(alpha_deg))
    nu=.6*(1-mat['fck']/250);fcd=mat['fcd'];fy=mat['fyd']
    k=min(1+math.sqrt(200/d_mm),2);rho=min(Asl_mm2/(bw_mm*d_mm),.02)
    Vc1=.12*k*(100*rho*mat['fck'])**(1/3)*bw_mm*d_mm
    Vc2=.035*k**1.5*math.sqrt(mat['fck'])*bw_mm*d_mm
    Vc=max(Vc1,Vc2)
    v0=V/(bw_mm*z*nu*fcd)
    disc=1-4*v0*(v0-ca)
    raw=(1+math.sqrt(max(0,disc)))/(2*v0) if v0>1e-12 else 2.5
    cot=1. if method=='standard' else max(1,min(2.5,math.floor(raw*100+1e-10)/100))
    Vmax=bw_mm*z*nu*fcd*(cot+ca)/(1+cot*cot)
    minimum=.08*math.sqrt(mat['fck'])/mat['fyk']*bw_mm*sa
    demand=Vr/(z*fy*(cot+ca)*sa) if Vr>Vc else 0.
    required=max(demand,minimum)
    upper=.5*nu*fcd*sa/(1-math.cos(math.radians(alpha_deg)))*bw_mm/fy
    Asw=branches*area(phi_t)
    smax=min(.75*d_mm*(1+ca),Asw/minimum,15*compressed_phi if compressed_phi else 1e9)
    spacing=math.floor(min(smax,Asw/required)/5)*5
    clear_span=bw_mm-2*(cover+phi_t+phi_l/2)
    transverse_spacing=clear_span/(branches-1)
    checks=[check('Compression des bielles : VEd ≤ VRd,max',V/1000,Vmax/1000,disc>=-1e-10 and V<=Vmax+1e-6,'kN'),
            check('Borne supérieure Asw/s',required,upper,required<=upper+1e-9,'mm²/mm'),
            check('Espacement constructible des cadres',spacing,50,spacing>=50,'mm'),
            check('Espacement transversal des brins',transverse_spacing,min(.75*d_mm,600),transverse_spacing<=min(.75*d_mm,600),'mm')]
    return dict(VEd_kN=V/1000,Vreduced_kN=Vr/1000,VRdc_kN=Vc/1000,VRdc1_kN=Vc1/1000,VRdc2_kN=Vc2/1000,
                cot_theta=cot,theta_deg=math.degrees(math.atan(1/cot)),VRdmax_kN=Vmax/1000,
                Asw_per_s_mm2_mm=required,minimum_mm2_mm=minimum,Asw_mm2=Asw,spacing_mm=spacing,
                maximum_spacing_mm=smax,shift_mm=z*(cot-ca)/2,shear_shift_mm=z*(cot+ca),
                z_mm=z,k=k,rho_l=rho,nu1=nu,method=method,checks=checks,all_ok=all(c['ok'] for c in checks))

def anchorage(mat,phi,sigma_sd,cover=35,clear=25,good_bond=True):
    fbd=2.25*(1 if good_bond else .7)*.7*mat['fctm']/1.5
    lb=phi/4*max(0,min(sigma_sd,mat['fyd']))/fbd
    cd=min(clear/2,cover)
    a2=max(.7,min(1,1-.15*(cd-phi)/phi))
    minimum=max(.3*lb,10*phi,100)
    length=math.ceil(max(a2*lb,.7*lb,minimum)/10)*10
    return dict(fbd_MPa=fbd,sigma_sd_MPa=sigma_sd,lb_rqd_mm=lb,alpha2=a2,minimum_mm=minimum,lbd_mm=length)
