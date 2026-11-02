import {describe,expect,it} from 'vitest';
import {BEATS,colors,cutAt,durationOf,EDITS,initialScript,moveCut,projectMark} from './engine';
describe('storytelling experiments',()=>{
 it('all preset edits keep the same five moments and fifteen-second budget',()=>{for(const cuts of Object.values(EDITS)){expect(durationOf(cuts)).toBe(15);expect(new Set(cuts.map(c=>c.beat))).toEqual(new Set(BEATS.map(b=>b.id)))}});
 it('cuts change on exact boundaries and the final frame remains visible',()=>{expect(cutAt(EDITS.Clear,3.99).index).toBe(0);expect(cutAt(EDITS.Clear,4).index).toBe(1);expect(cutAt(EDITS.Clear,15).index).toBe(4)});
 it('reordering changes knowledge without losing durations or mutating the preset',()=>{const moved=moveCut(EDITS.Clear,2,-1);expect(moved[1].beat).toBe('lantern');expect(EDITS.Clear[1].beat).toBe('notice');expect(durationOf(moved)).toBe(15)});
 it('depth overlap can be separated through the viewing angle',()=>{const a={x:0,z:0},b={x:0,z:2};expect(projectMark(a,0).x).toBe(projectMark(b,0).x);expect(projectMark(a,30).x).not.toBe(projectMark(b,30).x);expect(projectMark(b,0).scale).toBeLessThan(projectMark(a,0).scale)});
 it('color beats are independent and value controls change the drawing palette',()=>{const script=initialScript();script[0].light=70;expect(script[1].light).not.toBe(70);expect(colors(script[0]).wall).not.toBe(colors(script[1]).wall);expect(colors({...script[0],contrast:0}).ink).not.toBe(colors({...script[0],contrast:100}).ink)});
});
