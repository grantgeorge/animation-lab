import { useId } from 'react';
import { colors, PALETTES, projectMark, type Beat, type Grade, type Mark } from './engine';

export function Scene({beat='arrival',grade=PALETTES.Hearth,bram={x:beat==='reunion'?-.55:-1.25,z:0},pip={x:beat==='reunion'?.55:1.3,z:.5},camera=0,gesture=0,silhouette=false,guides=false}:{beat?:Beat;grade?:Grade;bram?:Mark;pip?:Mark;camera?:number;gesture?:number;silhouette?:boolean;guides?:boolean}) {
  const id=useId().replaceAll(':','');const c=colors(grade);
  const a=projectMark(bram,camera), b=projectMark(pip,camera);
  const crops:Record<Beat,string>={arrival:'0 0 1000 560',notice:'130 100 740 415',lantern:'620 336 90 51',reaction:'255 245 220 124',reunion:'140 100 720 403'};
  const marks=[{...a,name:'Bram',coat:'#ae5144',hat:'#42413d',small:false},{...b,name:'Pip',coat:'#d2af55',hat:'#d2af55',small:true}].sort((a,b)=>a.scale-b.scale);
  return <svg viewBox={crops[beat]} role="img" aria-label={`${beat}: Bram and Pip at the lantern-lit doorway`} className="story-scene" preserveAspectRatio="xMidYMid slice">
    <defs><radialGradient id={id}><stop stopColor={c.glow} stopOpacity=".7"/><stop offset="1" stopColor={c.glow} stopOpacity="0"/></radialGradient></defs>
    <rect width="1000" height="560" fill={c.sky}/><circle cx="810" cy="90" r="33" fill={c.glow} opacity=".7"/>
    <path d="M0 320L70 240 130 275 225 180 330 270 440 210 550 280 690 170 820 250 1000 180V560H0Z" fill={c.ink} opacity=".4"/>
    <path d="M110 170L430 65 730 170Z" fill={c.ink}/><path d="M145 170H700V455H145Z" fill={c.wall}/>
    <path d="M385 455V255a65 65 0 0 1 130 0V455Z" fill={c.door}/><path d="M385 455V255Q385 225 405 208V455Z" fill={c.glow}/>
    <rect x="205" y="220" width="98" height="108" rx="2" fill={c.ink}/><rect x="213" y="228" width="82" height="92" fill={c.glow} opacity=".6"/><path d="M254 224V324M208 273H300" stroke={c.ink} strokeWidth="7"/>
    <rect y="430" width="1000" height="130" fill={c.floor}/><path d="M403 430H490L640 560H225Z" fill={c.glow} opacity=".15"/>
    <circle cx="588" cy="222" r="190" fill={`url(#${id})`}/><path d="M589 170V211" stroke={c.ink} strokeWidth="6"/><rect x="574" y="208" width="30" height="40" rx="5" fill={c.glow}/>
    {marks.map(m=><g key={m.name} transform={`translate(${m.x} ${m.y}) scale(${m.scale*(m.small?.8:1)})`}>
      <ellipse cy="15" rx="80" ry="18" fill={c.ink} opacity=".4"/>
      <path d="M-38-65L-43 4H-14L-2-65M8-65L16 4H45L42-65" stroke={c.ink} strokeWidth="18" fill={c.ink}/>
      <path d="M-62-170Q0-200 62-170L72-55Q0-35-72-55Z" fill={silhouette?c.ink:m.coat} stroke={c.ink} strokeWidth="3"/>
      <path d={`M-55-158Q-100-100 -76-${85+gesture*45}M55-158Q90-130 ${85+gesture*25}-${115+gesture*40}`} fill="none" stroke={silhouette?c.ink:m.coat} strokeWidth="25" strokeLinecap="round"/>
      <ellipse cy="-222" rx="48" ry="55" fill={silhouette?c.ink:'#e8c6a0'} stroke={c.ink} strokeWidth="3"/>
      <path d="M-55-248Q-45-302 18-285Q55-278 57-248Z" fill={silhouette?c.ink:m.hat}/><path d="M-62-248Q0-263 68-247" fill="none" stroke={silhouette?c.ink:m.hat} strokeWidth="16" strokeLinecap="round"/>
      {!silhouette&&<><path d="M-28-227L-12-231M12-231L28-227" stroke={c.ink} strokeWidth="4"/><circle cx="-18" cy="-219" r="4" fill={c.ink}/><circle cx="18" cy="-219" r="4" fill={c.ink}/><path d={beat==='reaction'||beat==='reunion'?'M-17-195Q0-177 17-195':'M-12-190Q0-195 12-190'} stroke={c.ink} strokeWidth="4" fill="none"/>{!m.small&&<path d="M-33-202Q-12-215 0-203Q15-215 33-202Q20-188 0-200Q-20-188-33-202" fill={c.ink}/>}<path d="M-42-169Q0-152 40-173M28-163V-106" stroke="#e4d9ba" strokeWidth="18" fill="none"/></>}
      {m.small&&<g transform="translate(70 -100)"><path d="M-18 0V-15Q0-40 18-15V0" fill="none" stroke={c.ink} strokeWidth="6"/><rect x="-27" width="54" height="62" rx="4" fill={silhouette?c.ink:c.glow} stroke={c.ink} strokeWidth="6"/><path d="M0 0V62M-27 6H27" stroke={c.ink} strokeWidth="4"/></g>}
    </g>)}
    {guides&&<g stroke="#fff" opacity=".35" strokeDasharray="5 8"><path d="M333 0V560M667 0V560M0 187H1000M0 373H1000"/><line x1={a.x} y1={a.y-a.scale*220} x2={b.x} y2={b.y-b.scale*176}/></g>}
  </svg>;
}
