"""Continuous RC beam: equilibrium, load envelopes, EC2 steel and bar schedules.
Finite beams always use the general stiffness/three-moment system. Equal-span
1/12 shortcuts are intentionally not applied to simply-supported finite ends.
"""
import itertools
import math
from beam_sections import materials, design_section, shear, anchorage, area, check, CAQUOT_MM, bar_layout, service

def gauss(A,b):
    a=[list(row)+[float(v)] for row,v in zip(A,b)];n=len(b)
    for k in range(n):
        p=max(range(k,n),key=lambda i:abs(a[i][k]))
        if abs(a[p][k])<1e-12: raise ValueError('Système structural singulier : vérifier les portées et les appuis.')
        a[k],a[p]=a[p],a[k];v=a[k][k]
        a[k]=[x/v for x in a[k]]
        for i in range(n):
            if i==k:continue
            t=a[i][k]
            a[i]=[x-t*y for x,y in zip(a[i],a[k])]
    return [row[-1] for row in a]

def moments(L,q,left='simple',right='simple'):
    n=len(L);A=[[0.]*(n+1) for _ in range(n+1)];rhs=[0.]*(n+1)
    if left=='fixed':A[0][0]=2*L[0];A[0][1]=L[0];rhs[0]=-q[0]*L[0]**3/4
    else:A[0][0]=1
    if right=='fixed':A[n][n-1]=L[-1];A[n][n]=2*L[-1];rhs[n]=-q[-1]*L[-1]**3/4
    else:A[n][n]=1
    for i in range(1,n):
        A[i][i-1]=L[i-1];A[i][i]=2*(L[i-1]+L[i]);A[i][i+1]=L[i]
        rhs[i]=-(q[i-1]*L[i-1]**3+q[i]*L[i]**3)/4
    return gauss(A,rhs)

def value(q,L,a,b,x):return q*x*(L-x)/2+a+(b-a)*x/L

def reaction_left(q,L,a,b):return q*L/2+(b-a)/L

def peak(q,L,a,b):
    x=max(0,min(L,L/2+(b-a)/(q*L))) if q>1e-12 else (0 if a>=b else L)
    return value(q,L,a,b,x),x

def reactions(L,q,M):
    R=[0.]*(len(L)+1)
    for i,l in enumerate(L):
        r=reaction_left(q[i],l,M[i],M[i+1]);R[i]+=r;R[i+1]+=q[i]*l-r
    return R

def case_record(pattern,L,q,M,name):
    return dict(name=name,pattern=list(pattern),q=q,moments=M,reactions=reactions(L,q,M),
                maxima=[peak(q[i],l,M[i],M[i+1])[0] for i,l in enumerate(L)])

def elastic_cases(model,L,g,q):
    n=len(L)
    patterns=list(itertools.product([False,True],repeat=n)) if model['analysis']['patterned'] else [[True]*n]
    U=[];S=[]
    for j,p in enumerate(patterns):
        qu=[1.35*g[i]+(1.5*q[i] if p[i] else 0) for i in range(n)]
        qs=[g[i]+(q[i] if p[i] else 0) for i in range(n)]
        label='Q : '+', '.join(str(i+1) for i,v in enumerate(p) if v) if any(p) else 'G seul'
        U.append(case_record(p,L,qu,moments(L,qu,model['supports'][0]['condition'],model['supports'][-1]['condition']),label))
        S.append(case_record(p,L,qs,moments(L,qs,model['supports'][0]['condition'],model['supports'][-1]['condition']),label))
    return U,S

def redistribution(model,L,cases,mat,d_mm):
    if not model['analysis']['redistribution'] or len(L)<2:return cases,[],[]
    checks=[];trace=[]
    lower=.8 if mat['steel_class']=='A' else .7
    original=[max(c['maxima'][i] for c in cases) for i in range(len(L))]
    governing={max(range(len(cases)),key=lambda j:cases[j]['maxima'][i]) for i in range(len(L))}
    worst=[min(c['moments'][i] for c in cases) for i in range(len(L)+1)]
    ratios=[L[i]/L[i+1] for i in range(len(L)-1)]
    admissible=all(.5<=r<=2 for r in ratios)
    checks.append(check('Redistribution : rapport des portées entre 0,5 et 2',ratios,[.5,2],admissible))
    if not admissible:return cases,trace,checks
    output=[]
    for j,c in enumerate(cases):
        target=c['moments'][:];factors=[1.]*(len(L)+1)
        if j not in governing:
            for i in range(1,len(L)):
                if c['moments'][i]>=0 or abs(c['moments'][i]-worst[i])>1e-7:continue
                mu=abs(c['moments'][i])*1e6/(model['section']['bw_cm']*10*d_mm*d_mm*mat['fcd'])
                def admiss(delta):
                    if delta*mu>=.5:return False
                    xu=(1-math.sqrt(1-2*delta*mu))/.8
                    return delta>=.44+1.25*xu-1e-10
                if not admiss(1.):
                    checks.append(check('Redistribution : capacité de rotation à l’appui '+str(i+1),mu,.5,False))
                    continue
                lo,hi=lower,1.
                for _ in range(60):
                    mid=(lo+hi)/2
                    if admiss(mid):hi=mid
                    else:lo=mid
                delta=max(model['analysis']['delta'],lower,hi)
                factors[i]=min(1.,delta);target[i]*=factors[i]
        def trial(t):return [a+t*(b-a) for a,b in zip(c['moments'],target)]
        def fits(t):
            m=trial(t)
            return all(peak(c['q'][i],l,m[i],m[i+1])[0]<=original[i]+1e-7 for i,l in enumerate(L))
        lo,hi=0.,1.
        if fits(1.):lo=1.
        else:
            for _ in range(55):
                mid=(lo+hi)/2
                if fits(mid):lo=mid
                else:hi=mid
        M=trial(lo)
        for i in range(1,len(L)):
            if abs(M[i]-c['moments'][i])>1e-8:
                trace.append(dict(case=c['name'],support=i+1,before_kNm=c['moments'][i],after_kNm=M[i],delta=M[i]/c['moments'][i]))
        output.append(case_record(c['pattern'],L,c['q'],M,c['name']))
    return output,trace,checks

def plastic_case(model,L,g,q):
    loads=[1.35*a+1.5*b for a,b in zip(g,q)];cap=[]
    for i,l in enumerate(L):
        left=i>0 or model['supports'][0]['condition']=='fixed'
        right=i<len(L)-1 or model['supports'][-1]['condition']=='fixed'
        lo,hi=0.,max(loads[i]*l*l,1)
        for _ in range(90):
            mid=(lo+hi)/2
            if peak(loads[i],l,-mid if left else 0,-mid if right else 0)[0]>mid:lo=mid
            else:hi=mid
        cap.append((lo+hi)/2)
    M=[-cap[0] if model['supports'][0]['condition']=='fixed' else 0.]
    M.extend(-max(cap[i-1],cap[i]) for i in range(1,len(L)))
    M.append(-cap[-1] if model['supports'][-1]['condition']=='fixed' else 0.)
    return case_record([True]*len(L),L,loads,M,'Équilibre plastique'),cap

def envelope(cases,i,L,x,sign=1,shift=0,cap=None):
    a=max(0,x-shift);b=min(L,x+shift);best=0.
    for c in cases:
        vals=[sign*value(c['q'][i],L,c['moments'][i],c['moments'][i+1],a),sign*value(c['q'][i],L,c['moments'][i],c['moments'][i+1],b)]
        if sign>0:
            v,t=peak(c['q'][i],L,c['moments'][i],c['moments'][i+1])
            if a<=t<=b:vals.append(v)
        best=max(best,*vals)
    return min(best,cap) if cap is not None else best

def demand_minimum_margin(groups,cases,i,L,shift,sign,lever,stress,cap=None,domain=None):
    """Exact piecewise minimum; linear in load cases rather than quadratic.
    R - max(D_i) = min(R - D_i), including a shared clipping plateau. Each
    load case only needs its own critical abscissae plus bar ramp corners.
    """
    def resistance(x):
        return sum(g['area_mm2']*stress*lever/1e6*max(0,min(1,(x-g['start_m'])/g['anchor_m'],(g['end_m']-x)/g['anchor_m'])) for g in groups)
    xmin,xmax=domain or (0.,L)
    common={xmin,xmax}
    for g in groups:
        common.update(max(xmin,min(xmax,t)) for t in [g['start_m'],g['start_m']+g['anchor_m'],g['end_m']-g['anchor_m'],g['end_m'],(g['start_m']+g['end_m'])/2])
    worst=float('inf')
    for c in cases:
        q=c['q'][i];a,b=c['moments'][i:i+2]
        _,xp=peak(q,L,a,b)
        boundaries=common|{max(xmin,min(xmax,t)) for t in [shift,L-shift,xp-shift,xp+shift]}
        v0=reaction_left(q,L,a,b)
        if cap is not None and q>1e-12:
            disc=v0*v0+2*q*(a-sign*cap)
            if disc>=0:
                for root in [(v0-math.sqrt(disc))/q,(v0+math.sqrt(disc))/q]:
                    for offset in [-shift,shift]:boundaries.add(max(xmin,min(xmax,root-offset)))
        B=sorted(boundaries);points=set(B)
        for left,right in zip(B,B[1:]):
            if right-left<1e-10:continue
            slope=(resistance(right)-resistance(left))/(right-left)
            if q>1e-12:
                for offset in [-shift,shift]:
                    x=(v0-sign*slope)/q-offset
                    if left<x<right and 0<x+offset<L:points.add(x)
            points.add((left+right)/2)
        worst=min(worst,min(resistance(x)-envelope([c],i,L,x,sign,shift,cap) for x in points))
    return worst

def bar_schedule(layout,cases,i,L,ln,mat,shift,lever,sign,support_area,cap=None,cnom=35):
    phi=layout['phi_mm'];base=min(layout['count'],max(2,math.ceil(support_area/area(phi)-1e-10)))
    anch=anchorage(mat,phi,mat['fyd'],cnom,layout['clear_min_mm'],good_bond=sign>0)
    la=anch['lbd_mm']/1000
    groups=[];remaining=layout['count'];row=0
    groups.append(dict(id='filant',count=base,phi_mm=phi,area_mm2=base*area(phi),start_m=-la,end_m=L+la,anchor_m=la,filant=True))
    remaining-=base
    for r in reversed(layout['rows']):
        n=min(remaining,r['count'])
        if n:
            groups.append(dict(id='lit-'+str(row+1),count=n,phi_mm=phi,area_mm2=n*area(phi),start_m=-la,end_m=L+la,anchor_m=la,filant=False))
            remaining-=n;row+=1
    if remaining:
        groups.append(dict(id='complément',count=remaining,phi_mm=phi,area_mm2=remaining*area(phi),start_m=-la,end_m=L+la,anchor_m=la,filant=False))
    # Keep all bars if the conservative constant-lever model cannot envelop demand.
    optimised=demand_minimum_margin(groups,cases,i,L,shift,sign,lever,mat['fyd'],cap)>=-1e-5
    if optimised:
        for group in groups[1:]:
            original=group['start_m'];lo,hi=original,L/2
            for _ in range(35):
                mid=(lo+hi)/2;group['start_m']=mid
                if demand_minimum_margin(groups,cases,i,L,shift,sign,lever,mat['fyd'],cap)>=-1e-7:lo=mid
                else:hi=mid
            group['start_m']=lo
            lo,hi=L/2,group['end_m']
            for _ in range(35):
                mid=(lo+hi)/2;group['end_m']=mid
                if demand_minimum_margin(groups,cases,i,L,shift,sign,lever,mat['fyd'],cap)>=-1e-7:hi=mid
                else:lo=mid
            group['end_m']=hi
    groups=[g for g in groups if g['filant'] or g['end_m']-g['start_m']>1e-6]
    for g in groups:
        # End extensions are measured from the clear faces for physical lengths.
        g['length_m']=ln+2*la if g['filant'] else max(0,g['end_m']-g['start_m'])
        g['diagram']='II' if any(h is not g and abs(h['start_m']-g['start_m'])<max(g['anchor_m'],h['anchor_m']) for h in groups[1:]) else 'I'
    return dict(groups=groups,anchorage=anch,optimised=optimised,shift_m=shift,
                margin_kNm=demand_minimum_margin(groups,cases,i,L,shift,sign,lever,mat['fyd'],cap))

def stirrup_schedule(model,cases,i,L,d,mat,Asl,compressed_phi):
    det=model['detailing'];opt=model['shear'];bw=model['section']['bw_cm']*10
    def V(x):return max(abs(reaction_left(c['q'][i],L,c['moments'][i],c['moments'][i+1])-c['q'][i]*x) for c in cases)
    faces=[min(model['supports'][i]['width_m']/2,L/2),min(model['supports'][i+1]['width_m']/2,L/2)]
    critical=[];positions=[];zones=[]
    for side in range(2):
        face=faces[side];direction=1 if side==0 else -1;origin=face if side==0 else L-face
        nu=V(origin);atd=origin+direction*min(d/1000,max(0,L/2-face))
        initial=shear(bw,d,mat,nu,V(atd),Asl,det['phi_t_mm'],det['branches'],det['alpha_deg'],opt['method'],compressed_phi,det['cnom_mm'],det['phi_l_mm'])
        initial.update(side='gauche' if side==0 else 'droite',x_m=origin)
        critical.append(initial)
        extent=max(0,L/2-face)
        if extent<=0:continue
        current=0.;last_spacing=0.;guard=0
        while current<extent-1e-8:
            guard+=1
            if guard>2000:raise ValueError('Répartition des cadres trop dense : revoir la section.')
            # Caquot uses its commercial sequence beneath the required envelope.
            # Direct uses 5 mm increments. Both retain a pointwise conservative cap.
            sample=origin+direction*max(d/1000,current)
            sc=shear(bw,d,mat,nu,V(max(face,min(L-face,sample))),Asl,det['phi_t_mm'],det['branches'],det['alpha_deg'],opt['method'],compressed_phi,det['cnom_mm'],det['phi_l_mm'])
            limit=sc['spacing_mm']
            if limit<50:break
            if opt['distribution']=='caquot':
                available=[s for s in CAQUOT_MM if s<=limit+1e-8]
                spacing=max(available) if available else limit
            else:spacing=math.floor(limit/5)*5
            spacing=max(last_spacing,spacing)
            # A varying envelope can require a tighter later interval: retain the
            # safe smaller spacing, rather than declaring a non-enveloping plan valid.
            spacing=min(spacing,limit)
            distance=spacing/2000 if current==0 else spacing/1000
            if current+distance>extent:break
            current+=distance
            x=origin+direction*current;positions.append(x)
            if zones and zones[-1]['span']==i and zones[-1]['side']==side and zones[-1]['spacing_mm']==spacing:
                zones[-1]['count']+=1;zones[-1]['end_m']=x
            else:zones.append(dict(span=i,side=side,spacing_mm=spacing,count=1,start_m=x,end_m=x))
            last_spacing=spacing
    positions=sorted(set(round(x,8) for x in positions))
    # Ensure the join between the two halves satisfies the same constructive cap.
    max_gap=min(c['maximum_spacing_mm'] for c in critical)/1000
    extra=[]
    if max_gap>0:
        for a,b in zip(positions,positions[1:]):
            count=max(0,math.ceil((b-a)/max_gap-1e-8)-1)
            extra.extend(a+(b-a)*j/(count+1) for j in range(1,count+1))
    positions=sorted(positions+extra)
    def limit_at(x):
        # Face-to-d reduction only for the distributed-load tie demand.
        x=max(faces[0]+d/1000,min(L-faces[1]-d/1000,x))
        return shear(bw,d,mat,max(c['VEd_kN'] for c in critical),V(x),Asl,det['phi_t_mm'],det['branches'],det['alpha_deg'],opt['method'],compressed_phi,det['cnom_mm'],det['phi_l_mm'])['spacing_mm']/1000
    for _ in range(12):
        supplement=[]
        for a,b in zip(positions,positions[1:]):
            limit=min(limit_at(a),limit_at(b))
            if limit>0 and b-a>limit+1e-8:
                count=math.ceil((b-a)/limit-1e-8)
                supplement.extend(a+(b-a)*j/count for j in range(1,count))
        if not supplement:break
        extra.extend(supplement);positions=sorted(positions+supplement)
    safe=all(b-a<=min(limit_at(a),limit_at(b))+1e-7 for a,b in zip(positions,positions[1:]))
    if extra:zones.append(dict(span=i,side=2,spacing_mm=min((b-a)*1000 for a,b in zip(positions,positions[1:])),count=len(extra),start_m=min(extra),end_m=max(extra)))
    interval_checks=[check('Enveloppe des pas réels de cadres',len(positions),None,safe)]
    return dict(critical=critical,positions_m=positions,zones=zones,count=len(positions),method=opt['distribution'],
                shift_mm=max(s['shift_mm'] for s in critical),checks=[c for s in critical for c in s['checks']]+interval_checks)


def flange_shear(model,cases,i,L,mat,design):
    """EC2 6.2.4, each overhang, conservative force variation on L/4 windows.
    Delta x is further limited to half the zero-to-peak distance. A uniform
    transverse tie schedule envelopes all candidate windows and both sides.
    """
    sec=model['section'];hf=sec['hf_cm']*10;overhang=(sec['beff_cm']-sec['bw_cm'])*5
    cot=2.;nu=.6*(1-mat['fck']/250);capacity=nu*mat['fcd']*cot/(1+cot*cot)
    k=1. if model['analysis']['flange_joint']=='monolithic' else .5
    threshold=k*.7*mat['fctm']/1.5
    def flange_force(M):
        from beam_sections import flexure
        f=flexure(sec,mat,max(0,M),design['Mser_kNm'],design['d_mm'],design['dp_mm'])
        return overhang*min(.8*f['alpha']*design['d_mm'],hf)*mat['fcd']
    worst=dict(vEd_MPa=0.,deltaF_kN=0.,dx_m=L/4,case='',x_m=0.)
    if overhang>0:
        for c in cases:
            q=c['q'][i];a,b=c['moments'][i:i+2];M,xp=peak(q,L,a,b)
            if M<=0:continue
            # The positive region roots delimit admissible force windows.
            r=reaction_left(q,L,a,b);disc=r*r+2*q*a
            roots=[max(0,min(L,(r-v*math.sqrt(max(0,disc)))/q)) for v in (1,-1)] if q>1e-12 else [0,L]
            for edge in roots:
                dx=min(L/4,abs(xp-edge)/2)
                if dx<1e-8:continue
                direction=1 if edge<xp else -1
                # Until the flange compression force plateaus, F(x) is a
                # scaled 1-sqrt(quadratic) with constant curvature sign.
                # Sliding-window extrema therefore occur at branch endpoints
                # or when a window touches the plateau. Include these exact
                # candidates rather than relying on a plotted sampling grid.
                start,end=sorted((edge,xp));candidates={start,max(start,end-dx)}
                target=min(flange_force(M),overhang*hf*mat['fcd'])
                lo,hi=0.,M
                for _ in range(70):
                    mid=(lo+hi)/2
                    if flange_force(mid)>=target-1e-7:hi=mid
                    else:lo=mid
                v0=reaction_left(q,L,a,b);dd=v0*v0+2*q*(a-hi)
                if q>1e-12 and dd>=0:
                    for root in [(v0-math.sqrt(dd))/q,(v0+math.sqrt(dd))/q]:
                        candidates.update([max(start,min(end-dx,root)),max(start,min(end-dx,root-dx))])
                for x in candidates:
                    F1=flange_force(value(q,L,a,b,x));F2=flange_force(value(q,L,a,b,x+dx))
                    delta=abs(F2-F1);v=delta/(hf*dx*1000)
                    if v>worst['vEd_MPa']:worst=dict(vEd_MPa=v,deltaF_kN=delta/1000,dx_m=dx,case=c['name'],x_m=x)
    required=max(0,worst['vEd_MPa']*hf/(mat['fyd']*cot)) if worst['vEd_MPa']>threshold else 0.
    phi=model['detailing']['phi_t_mm'];As=area(phi)
    spacing=min(300,math.floor(As/required/5)*5) if required>0 else 300
    provided=As/spacing if spacing>0 else 0.
    checks=[check('Couture T : compression des bielles',worst['vEd_MPa'],capacity,worst['vEd_MPa']<=capacity,'MPa'),
            check('Couture T : espacement constructible',spacing,50,spacing>=50,'mm'),
            check('Couture T : acier transversal par côté',provided,required,provided>=required-1e-8,'mm²/mm')]
    return dict(**worst,cot_theta=cot,VRdmax_MPa=capacity,threshold_MPa=threshold,required_mm2_mm=required,
                phi_mm=phi,spacing_mm=spacing,provided_mm2_mm=provided,overhang_mm=overhang,checks=checks)

def run(model):
    mat=materials(model['materials']);sec=model['section'];det=model['detailing'];opts=model['analysis']
    spans=model['spans'];n=len(spans);supports=model['supports']
    if len(supports)!=n+1 or not 1<=n<=8:raise ValueError('Définir 1 à 8 travées et exactement n + 1 appuis.')
    if any(s['condition']!='simple' for s in supports[1:-1]):raise ValueError('Les appuis intermédiaires sont continus sans blocage de rotation. Les encastrements intermédiaires ne sont pas couverts.')
    if opts['construction'] not in ('posed','monolithic'):raise ValueError('Précisez si la poutre est posée ou solidaire de ses appuis.')
    h=sec['h_cm']/100;bw=sec['bw_cm']/100
    if h<=0 or bw<=0:raise ValueError('Les dimensions de section doivent être positives.')
    if sec['type']=='t' and not (sec['beff_cm']>=sec['bw_cm'] and 0<sec['hf_cm']<sec['h_cm']):raise ValueError('Section en T incohérente : beff ≥ bw et 0 < hf < h.')
    Ac=bw*h+(sec.get('beff_cm',sec['bw_cm'])/100-bw)*sec.get('hf_cm',0)/100 if sec['type']=='t' else bw*h
    L=[s['ln_m']+min(supports[i]['width_m']/2,h/2)+min(supports[i+1]['width_m']/2,h/2) for i,s in enumerate(spans)]
    if any(l<=0 for l in L):raise ValueError('La portée doit être strictement positive.')
    g=[s['g_kN_m']+(25*Ac if model['selfWeight'] else 0) for s in spans];q=[s['q_kN_m'] for s in spans]
    if any(v<0 for v in g+q):raise ValueError('Les charges G/Q doivent être positives ou nulles.')
    U,S=elastic_cases(model,L,g,q)
    d=min(.9*h*1000,h*1000-det['cnom_mm']-det['phi_t_mm']-det['phi_l_mm']/2) if sec.get('depthMode','auto')=='auto' else sec['d_cm']*10
    elastic,redtrace,redchecks=redistribution(model,L,U,mat,d)
    plastic,plastic_cap=plastic_case(model,L,g,q)
    active=opts['method'] if opts['method']!='compare' else opts['reference']
    cases=elastic if active=='elastic' else [plastic]
    notes=['Béton ≤ C50/60 ; bloc rectangulaire λ = 0,8 ; coefficients γc = 1,5, γs = 1,15, αcc = 1.',
           'Les diagrammes d’équilibre sont distincts des moments réduits d’écrêtage servant au ferraillage.',
           'La répartition des cadres enveloppe les besoins par dessous : grille commerciale Caquot ou pas direct de 5 mm, sans combinaison des deux méthodes.',
           'Les arrêts de barres sont contrôlés par une enveloppe de capacités avec rampes d’ancrage. Les longueurs filantes utilisent les portées aux nus.']
    if opts['construction']=='monolithic':notes.append('Nappe supérieure conservée filante pour couvrir les minima de construction sur les appuis solidaires.')
    warnings=[];checks=list(redchecks) if active=='elastic' else []
    for i,l in enumerate(L):
        checks.append(check('Domaine de poutre : leff/h ≥ 3 — '+spans[i]['name'],l/h,3,l/h>=3))
    support_design=[];support_theoretical=[];support_clipping=[]
    for j in range(n+1):
        theory=max(0,max(-c['moments'][j] for c in cases));support_theoretical.append(theory)
        values=[]
        for c in cases:
            v=max(0,-c['moments'][j]);reduction=max(0,c['reactions'][j])*supports[j]['width_m']/8 if active=='elastic' else 0
            values.append(max(0,v-reduction))
        des=max(values)
        if opts['construction']=='monolithic':
            for k in [j-1,j]:
                if 0<=k<n:
                    pmax=max(c['q'][k] for c in cases)
                    if 0<j<n:des=max(des,.65*pmax*spans[k]['ln_m']**2/12)
                    else:des=max(des,.15*max(c['maxima'][k] for c in cases))
        support_design.append(des);support_clipping.append(theory-max(values))
    flex_spans=[];flex_supports=[];shears=[];bars=[]
    for i,l in enumerate(L):
        M=max(0,max(c['maxima'][i] for c in cases))
        if active=='plastic':M=max(M,plastic_cap[i])
        Ms=max(0,max(c['maxima'][i] for c in S))
        design=design_section(sec,mat,det,M,Ms,False,model['serviceChecks'])
        design.update(id='span:'+str(i),label=spans[i]['name'],x_m=(l/2 if M<=0 else max(min(supports[i]['width_m']/2,h/2),min(l-min(supports[i+1]['width_m']/2,h/2),peak(max(cases,key=lambda c:c['maxima'][i])['q'][i],l,*max(cases,key=lambda c:c['maxima'][i])['moments'][i:i+2])[1]))))
        flex_spans.append(design)
    for j in range(n+1):
        Ms=max(0,max(-c['moments'][j] for c in S))
        design=design_section(sec,mat,det,support_design[j],Ms,True,model['serviceChecks'])
        design.update(id='support:'+str(j),label='Appui '+str(j+1),theoretical_kNm=support_theoretical[j],clipping_kNm=support_clipping[j])
        flex_supports.append(design)
    # Nappes shared with neighbouring support sections can move the actual
    # centroid or require compression steel in the opposite design case.
    # Iterate the constructive layout until those needs are all covered.
    layout_history=[]
    for constructive_iteration in range(16):
        span_provided=[]
        for i in range(n):
            bottom=max(flex_spans[i]['tension']['area_mm2'],flex_supports[i]['As2_req_mm2'],flex_supports[i+1]['As2_req_mm2'])
            top=max(flex_spans[i]['compression']['area_mm2'],flex_supports[i]['tension']['area_mm2'],flex_supports[i+1]['tension']['area_mm2'])
            if layout_history:
                bottom=max(bottom,layout_history[-1][i][0]);top=max(top,layout_history[-1][i][1])
            span_provided.append((bottom,top))
        next_spans=[];next_supports=[]
        for i,old in enumerate(flex_spans):
            d=design_section(sec,mat,det,old['MEd_kNm'],old['Mser_kNm'],False,model['serviceChecks'],span_provided[i])
            d.update(id=old['id'],label=old['label'],x_m=old['x_m']);next_spans.append(d)
        for j,old in enumerate(flex_supports):
            neighbours=[span_provided[k] for k in [j-1,j] if 0<=k<n]
            provided=(max(v[1] for v in neighbours),max(v[0] for v in neighbours))
            d=design_section(sec,mat,det,old['MEd_kNm'],old['Mser_kNm'],True,model['serviceChecks'],provided)
            d.update(id=old['id'],label=old['label'],theoretical_kNm=old['theoretical_kNm'],clipping_kNm=old['clipping_kNm']);next_supports.append(d)
        flex_spans,flex_supports=next_spans,next_supports
        if layout_history and all(abs(a-b)<1e-6 for p,q in zip(span_provided,layout_history[-1]) for a,b in zip(p,q)):break
        layout_history.append(span_provided)
    else:raise ValueError('La continuité constructive des nappes ne converge pas : revoir les sections et les diamètres.')
    for i,l in enumerate(L):
        design=flex_spans[i]
        # Conservative anchored longitudinal area: the continuous corner bars.
        Asl=2*area(design['tension']['phi_mm'])
        sh=stirrup_schedule(model,cases,i,l,design['d_mm'],mat,Asl,design['compression']['phi_mm'] if design['As2_calc_mm2']>0 else 0)
        shears.append(sh);checks.extend(dict(c,element='span:'+str(i)) for c in sh['checks'])
        shift=sh['shift_mm']/1000
        end_areas=[]
        for side in range(2):
            critical=sh['critical'][side];j=i+side
            # Signed concomitant bending relieves the lower tie at a hogging support.
            M_signed=-support_design[j]
            force=max(0,critical['VEd_kN']*1000*critical['shift_mm']/critical['z_mm']+M_signed*1e6/critical['z_mm'])
            need=max(force/mat['fyd'],opts.get('beta2',.25)*design['tension']['area_mm2'],flex_supports[j]['As2_req_mm2'])
            end_areas.append(need)
        lower=bar_schedule(design['tension'],cases,i,l,spans[i]['ln_m'],mat,shift,design['z_mm'],1,max(max(end_areas),design['As_min_mm2']),None,det['cnom_mm'])
        # Top bars also carry the compression reinforcement required in span.
        top_layout=max([design['compression'],flex_supports[i]['tension'],flex_supports[i+1]['tension']],key=lambda v:v['area_mm2'])
        top_lev=min(flex_supports[i]['z_mm'],flex_supports[i+1]['z_mm'])
        top_min=max(design['As2_req_mm2'],flex_supports[i]['As_min_mm2'],flex_supports[i+1]['As_min_mm2'])
        if opts['construction']=='monolithic':top_min=top_layout['area_mm2']
        upper=bar_schedule(top_layout,cases,i,l,spans[i]['ln_m'],mat,shift,top_lev,-1,top_min,max(support_design[i],support_design[i+1]),det['cnom_mm'])
        for side,need in enumerate(end_areas):
            j=i+side
            base=lower['groups'][0]['area_mm2']
            checks.append(check('Armature inférieure ancrée — '+spans[i]['name']+' / '+str(j+1),base,need,base+1e-7>=need,'mm²'))
            if j in (0,n):
                V=sh['critical'][side]['VEd_kN']*1000
                face=min(supports[j]['width_m']/2,h/2)
                face_x=face if side==0 else l-face
                tie=max(V*shift*1000/sh['critical'][side]['z_mm'],envelope(cases,i,l,face_x,1,shift)*1e6/design['z_mm'])
                sigma=max(0,tie)/base
                a=anchorage(mat,design['tension']['phi_mm'],sigma,det['cnom_mm'],design['tension']['clear_min_mm'])
                a['available_mm']=supports[j]['width_m']*1000-det['cnom_mm']
                a['fits']=a['available_mm']>=a['lbd_mm']
                sn=1/(1+(a['lbd_mm']/sh['critical'][side]['z_mm'])**2)
                stress=V/(a['lbd_mm']*bw*1000*sn) if V>0 else 0
                cap=.85*(1-mat['fck']/250)*mat['fcd']
                a['strut_MPa']=stress;a['strut_limit_MPa']=cap
                # Physical extension from the clear face; the development ramp
                # still uses the full-stress anchorage length.
                face=min(supports[j]['width_m']/2,h/2)
                for group in lower['groups']:
                    if side==0:group['start_m']=face-a['lbd_mm']/1000
                    else:group['end_m']=l-face+a['lbd_mm']/1000
                checks.append(check('Ancrage droit disponible — appui '+str(j+1),a['lbd_mm'],a['available_mm'],a['fits'],'mm'))
                checks.append(check('Bielle d’about — appui '+str(j+1),stress,cap,stress<=cap,'MPa'))
                lower['left_end' if side==0 else 'right_end']=a
        for side in range(2):
            j=i+side
            if j not in (0,n):continue
            face=min(supports[j]['width_m']/2,h/2)
            x=face if side==0 else l-face
            anchored=[g for g in upper['groups'] if g['start_m']-1e-8<=x<=g['end_m']+1e-8]
            As=sum(g['area_mm2'] for g in anchored)
            if As<=0:raise ValueError('Aucune barre supérieure ne rejoint l’appui de rive.')
            sigma=support_design[j]*1e6/(flex_supports[j]['z_mm']*As)
            if flex_supports[j]['service']:sigma=max(sigma,flex_supports[j]['service']['sigma_s_MPa'])
            checks.append(check('Acier supérieur réellement ancré — appui '+str(j+1),As,flex_supports[j]['As1_req_mm2'],As>=flex_supports[j]['As1_req_mm2']-1e-8,'mm²'))
            a=anchorage(mat,top_layout['phi_mm'],sigma,det['cnom_mm'],top_layout['clear_min_mm'],good_bond=False)
            a['available_mm']=supports[j]['width_m']*1000-det['cnom_mm'];a['fits']=a['available_mm']>=a['lbd_mm']
            a['anchored_mm2']=As
            upper['left_end' if side==0 else 'right_end']=a
            checks.append(check('Ancrage droit supérieur disponible — appui '+str(j+1),a['lbd_mm'],a['available_mm'],a['fits'],'mm'))
            for group in anchored:
                if side==0:group['start_m']=face-a['lbd_mm']/1000
                else:group['end_m']=l-face+a['lbd_mm']/1000
        for group in lower['groups']+upper['groups']:
            group['length_m']=group['end_m']-group['start_m']
        upper['margin_kNm']=demand_minimum_margin(upper['groups'],cases,i,l,shift,-1,top_lev,mat['fyd'],max(support_design[i],support_design[i+1]),domain=(min(supports[i]['width_m']/2,h/2),l-min(supports[i+1]['width_m']/2,h/2)))
        upper['optimised']=upper['optimised'] and upper['margin_kNm']>=-1e-5
        lower['margin_kNm']=demand_minimum_margin(lower['groups'],cases,i,l,shift,1,design['z_mm'],mat['fyd'],domain=(min(supports[i]['width_m']/2,h/2),l-min(supports[i+1]['width_m']/2,h/2)))
        # The design tie force controls end anchorage. The moment-shift model
        # is conservative but must never be presented as a verified cut plan
        # when a development ramp does not envelop its demand.
        lower['optimised']=lower['optimised'] and lower['margin_kNm']>=-1e-5
        checks.append(check('Enveloppe des arrêts de barres inférieures — '+spans[i]['name'],lower['margin_kNm'],0,lower['margin_kNm']>=-1e-5,'kN·m'))
        checks.append(check('Enveloppe des arrêts de barres supérieures — '+spans[i]['name'],upper['margin_kNm'],0,upper['margin_kNm']>=-1e-5,'kN·m'))
        if not lower['optimised'] or not upper['optimised']:
            notes.append(spans[i]['name']+' : barres conservées filantes lorsque le modèle conservatif d’arrêt ne permet pas de les raccourcir.')
        bars.append(dict(bottom=lower,top=upper))
    # Re-read the physical rods actually present at each positive design point.
    # Cuts may remove top support bars there: ELS must not credit absent steel.
    for i,d in enumerate(flex_spans):
        x=d['x_m'];actual=[]
        for key in ['bottom','top']:
            count=sum(g['count'] for g in bars[i][key]['groups'] if g['start_m']-1e-8<=x<=g['end_m']+1e-8)
            actual.append(bar_layout(count*area(det['phi_l_mm']),sec['bw_cm']*10,sec['h_cm']*10,det['cnom_mm'],det['phi_t_mm'],det['phi_l_mm'],det['dg_mm']))
        original_total=d['tension']['area_mm2']+d['compression']['area_mm2']
        d['tension'],d['compression']=actual
        d['actual_d_mm']=sec['h_cm']*10-actual[0]['centroid_mm'];d['actual_dp_mm']=actual[1]['centroid_mm']
        d['checks'].append(check('Nappe comprimée réellement continue en travée',actual[1]['area_mm2'],d['As2_req_mm2'],actual[1]['area_mm2']>=d['As2_req_mm2']-1e-8,'mm²'))
        d['checks'].append(check('Acier réellement présent à la section de travée',actual[0]['area_mm2'],d['As1_req_mm2'],actual[0]['area_mm2']>=d['As1_req_mm2']-1e-8,'mm²'))
        d['checks'].append(check('Maximum constructif des nappes ≤ 4 % Ac',original_total,d['As_max_mm2'],original_total<=d['As_max_mm2']+1e-8,'mm²'))
        if model['serviceChecks']:
            sls=service(sec,mat,*actual,d['Mser_kNm'],d['actual_d_mm'],d['actual_dp_mm'])
            d['service']=sls
            for c in d['checks']:
                if c['name']=='Contraintes ELS':c.update(value=sls['sigma_s_MPa'],limit=sls['sigma_s_limit_MPa'],ok=sls['ok'])
        d['all_ok']=all(c['ok'] for c in d['checks'])
    for d in flex_spans+flex_supports:checks.extend(dict(c,element=d['id']) for c in d['checks'])
    # Plastic admissibility is explicit and cannot silently select an elastic design.
    comparison=[];plastic_checks=[]
    if opts['method'] in ('plastic','compare'):
        plastic_checks.append(check('Analyse plastique : acier B ou C',mat['steel_class'],['B','C'],mat['steel_class'] in ('B','C')))
        for i,l in enumerate(L):
            Ms=max(0,max(c['maxima'][i] for c in S))
            pd=design_section(sec,mat,det,plastic_cap[i],Ms,False,model['serviceChecks'])
            ed=design_section(sec,mat,det,max(c['maxima'][i] for c in elastic),Ms,False,model['serviceChecks'])
            comparison.append(dict(span=i,elastic_kNm=max(c['maxima'][i] for c in elastic),plastic_kNm=plastic_cap[i],elastic_As_mm2=ed['As1_req_mm2'],plastic_As_mm2=pd['As1_req_mm2']))
            plastic_checks.append(check('Plastique : x/d ≤ 0,25 — '+spans[i]['name'],pd['alpha'],.25,pd['alpha']<=.25))
            if max(abs(plastic['moments'][i]),abs(plastic['moments'][i+1]))>0:
                ratio=plastic_cap[i]/max(abs(plastic['moments'][i]),abs(plastic['moments'][i+1]))
                plastic_checks.append(check('Plastique : rapport travée/appui — '+spans[i]['name'],ratio,[.5,2],.5<=ratio<=2))
        for j in range(n+1):
            pd=design_section(sec,mat,det,abs(plastic['moments'][j]),max(0,max(-c['moments'][j] for c in S)),True,model['serviceChecks'])
            plastic_checks.append(check('Plastique : x/d ≤ 0,25 — appui '+str(j+1),pd['alpha'],.25,pd['alpha']<=.25))
        plastic_checks.append(check('Plastique : chargement intégral explicitement choisi',not opts['patterned'],True,not opts['patterned']))
        if opts['patterned']:warnings.append('L’équilibre plastique fourni couvre le chargement intégral. Désactivez les damiers pour l’utiliser ; sinon retenez le dimensionnement élastique enveloppe.')
        if any(c['plastic_As_mm2']>1.2*c['elastic_As_mm2'] for c in comparison):notes.append('L’analyse plastique augmente de plus de 20 % l’acier d’au moins une travée ; comparer avant de la retenir.')
        if active=='plastic':checks.extend(plastic_checks)
    if opts['construction']=='posed':
        for c in cases:
            checks.append(check('Appuis posés : absence de soulèvement — '+c['name'],min(c['reactions']),0,min(c['reactions'])>=-1e-7,'kN'))
    flange_checks=[]
    if sec['type']=='t':
        for i,l in enumerate(L):
            flange=flange_shear(model,cases,i,l,mat,flex_spans[i])
            flange_checks.append(flange)
            checks.extend(dict(c,element='span:'+str(i)) for c in flange['checks'])
        notes.append('Couture du T vérifiée de chaque côté de l’âme pour la table comprimée. Sur appui, les aciers supérieurs restent dans l’âme ; la table tendue ne contribue pas à la résistance ELU.')
    if not model['serviceChecks']:warnings.append('Vérification des contraintes ELS désactivée par l’utilisateur.')
    limits=['Flèche différée, ouverture des fissures, feu, fatigue, torsion et poinçonnement non calculés.',
            'Section constante ; charges réparties G/Q ; au plus huit travées. Les charges ponctuelles doivent rester dans l’analyse structurale dédiée.',
            'Durabilité de l’enrobage et conditions d’adhérence à confirmer ; les ancrages courbes ne sont pas dimensionnés.']
    traces=[]
    for i,l in enumerate(L):
        pts=[]
        for j in range(121):
            x=l*j/120
            pts.append(dict(x_m=x,Mmax_kNm=envelope(cases,i,l,x),Mmin_kNm=-envelope(cases,i,l,x,-1),
                            Vmax_kN=max(reaction_left(c['q'][i],l,*c['moments'][i:i+2])-c['q'][i]*x for c in cases),
                            Vmin_kN=min(reaction_left(c['q'][i],l,*c['moments'][i:i+2])-c['q'][i]*x for c in cases)))
        traces.append(pts)
    equilibrium=max(abs(sum(c['reactions'])-sum(a*b for a,b in zip(c['q'],L))) for c in cases)
    checks.append(check('Équilibre vertical global',equilibrium,1e-6,equilibrium<=1e-6,'kN'))
    return dict(kind='rc-beam',materials=mat,effective_lengths_m=L,self_weight_kN_m=25*Ac if model['selfWeight'] else 0,
                permanent_kN_m=g,variable_kN_m=q,method=active,cases=cases,elastic_cases=U,service_cases=S,
                redistribution=redtrace,plastic_case=plastic,plastic_checks=plastic_checks,comparison=comparison,
                spans=flex_spans,supports=flex_supports,shear=shears,flange=flange_checks,bars=bars,traces=traces,
                checks=checks,warnings=warnings,notes=notes,limits=limits,
                all_ok=all(c['ok'] for c in checks),scope_complete=True)
