import { num } from '../core/utils.js';

// Cuenta días de clase, incluidos los extremos del semestre, sin descontar festivos.
export function classCount(sub, semester){
    var m=semester;if(!m||!m.start||!m.end||!(sub.days||[]).length)return 0;
    var a=m.start.split("-"),b=m.end.split("-");if(a.length<3||b.length<3)return 0;
    var d=new Date(+a[0],+a[1]-1,+a[2]),e=new Date(+b[0],+b[1]-1,+b[2]),n=0,g=0;
    if(isNaN(d)||isNaN(e)||e<d)return 0;
    while(d<=e&&g++<500){if(sub.days.indexOf(d.getDay())>=0)n++;d.setDate(d.getDate()+1)}
    return n;
  }

export function allowed(sub, semester){
    var p=num(semester&&semester.pct),n=classCount(sub, semester);
    if(p===null||p<0||!n)return null;
    return Math.floor(n*p/100+1e-9);
  }
