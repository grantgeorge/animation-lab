export type Beat = 'arrival' | 'notice' | 'lantern' | 'reaction' | 'reunion';
export const BEATS: { id: Beat; title: string; shot: string; description: string }[] = [
  { id: 'arrival', title: 'The visitor', shot: 'Wide', description: 'Pip arrives at Bram’s door carrying something.' },
  { id: 'notice', title: 'The glance', shot: 'Medium', description: 'Bram notices Pip and looks toward the hidden object.' },
  { id: 'lantern', title: 'The reveal', shot: 'Insert', description: 'The lost lantern is safe in Pip’s hands.' },
  { id: 'reaction', title: 'The recognition', shot: 'Close-up', description: 'Bram’s concern gives way to a smile.' },
  { id: 'reunion', title: 'The return', shot: 'Two-shot', description: 'They step together into the light.' },
];
export type Cut = { beat: Beat; seconds: number };
export const EDITS: Record<string, Cut[]> = {
  Clear: [{beat:'arrival',seconds:4},{beat:'notice',seconds:2},{beat:'lantern',seconds:2},{beat:'reaction',seconds:3},{beat:'reunion',seconds:4}],
  Suspense: [{beat:'arrival',seconds:3},{beat:'notice',seconds:5},{beat:'reaction',seconds:2},{beat:'lantern',seconds:2},{beat:'reunion',seconds:3}],
  Comedy: [{beat:'arrival',seconds:2},{beat:'lantern',seconds:1},{beat:'notice',seconds:2},{beat:'reaction',seconds:6},{beat:'reunion',seconds:4}],
  Tenderness: [{beat:'arrival',seconds:2},{beat:'notice',seconds:2},{beat:'lantern',seconds:2},{beat:'reaction',seconds:4},{beat:'reunion',seconds:5}],
  Mystery: [{beat:'lantern',seconds:3},{beat:'reaction',seconds:3},{beat:'notice',seconds:2},{beat:'arrival',seconds:4},{beat:'reunion',seconds:3}],
};
export const durationOf = (cuts: Cut[]) => cuts.reduce((sum,c) => sum+c.seconds,0);
export function cutAt(cuts: Cut[], t: number) {
  let start=0;
  for(let i=0;i<cuts.length;i++){ if(t<start+cuts[i].seconds || i===cuts.length-1) return {index:i,start,cut:cuts[i]}; start+=cuts[i].seconds; }
  throw new Error('An edit needs at least one panel');
}
export function moveCut(cuts: Cut[], index: number, direction: number) {
  const next=[...cuts]; const to=index+direction;
  if(to<0||to>=next.length)return next;
  [next[index],next[to]]=[next[to],next[index]];return next;
}
export type Mark = {x:number; z:number};
export function projectMark(mark: Mark, camera: number) {
  const angle=camera*Math.PI/180;
  const x=mark.x*Math.cos(angle)-mark.z*Math.sin(angle);
  const depth=6+mark.x*Math.sin(angle)+mark.z*Math.cos(angle);
  return {x:500+x*670/depth,y:410-35*mark.z,scale:3/depth};
}
export type Grade = { hue:number; saturation:number; light:number; contrast:number };
export const PALETTES: Record<string,Grade> = {
  Hearth:{hue:35,saturation:65,light:50,contrast:55},
  Moonlight:{hue:220,saturation:38,light:29,contrast:65},
  Unease:{hue:155,saturation:35,light:30,contrast:80},
  Rose:{hue:345,saturation:44,light:61,contrast:35},
};
export const initialScript = () => [PALETTES.Moonlight,PALETTES.Moonlight,PALETTES.Hearth,PALETTES.Rose,PALETTES.Hearth].map(g=>({...g}));
export function colors(g:Grade) {
  const hsl=(h:number,s:number,l:number)=>`hsl(${(h+360)%360} ${s}% ${Math.max(4,Math.min(92,l))}%)`;
  return { sky:hsl(g.hue,g.saturation*.48,g.light*.42), wall:hsl(g.hue,g.saturation*.5,g.light), floor:hsl(g.hue,g.saturation*.35,g.light*.55), door:hsl(g.hue+150,g.saturation*.5,g.light*.35), glow:hsl(g.hue,g.saturation,Math.min(90,g.light+28)), ink:hsl(g.hue,20,30-g.contrast*.26) };
}
