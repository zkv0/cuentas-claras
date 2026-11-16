import { num, f } from '../core/utils.js';

/** Cálculo puro: porcentajes sobre 100 y notas en la escala de cada materia.
 * Una predicción fija reserva sus puntos antes de repartir la nota necesaria.
 * `need` usa pendientes definidos; `needAll` incluye porcentaje sin asignar.
 */
export function isGraded(r){var p=num(r.p),g=num(r.g);return p!==null&&p>0&&g!==null}

export function calc(sub){
    var earned=0,graded=0,pend=0,predPts=0,lockedPct=0;
    sub.rows.forEach(function(r){
      var p=num(r.p),g=num(r.g),q=num(r.pred);
      if(p===null||p<=0)return;
      if(g!==null){earned+=p*g/100;graded+=p}
      else{pend+=p;if(q!==null){predPts+=p*q/100;lockedPct+=p}}
    });
    var free=Math.max(0,100-graded-pend);
    var openDef=pend-lockedPct;
    var op=openDef>0.0001?openDef:free;
    var min=num(sub.min)||0,max=num(sub.max)||5;
    var need=op>0.0001?(min-earned-predPts)/(op/100):null;
    var all=openDef+free;
    var needAll=all>0.0001?(min-earned-predPts)/(all/100):null;
    return{earned:earned,graded:graded,pend:pend,free:free,open:op,openDef:openDef,needAll:needAll,predPts:predPts,remaining:pend+free,need:need,min:min,max:max,over:graded+pend>100.001};
  }

export function chip(c){
    if(c.graded+c.pend===0)return{cls:"none",t:"Sin evaluaciones"};
    if(c.over)return{cls:"bad",t:"Revisa los %"};
    if(c.remaining<=0.0001)return c.earned>=c.min-0.0001?{cls:"ok",t:"Ganada: "+f(c.earned)}:{cls:"bad",t:"Perdida: "+f(c.earned)};
    if(c.need===null){var t=c.earned+c.predPts;return {cls:t>=c.min-0.0001?"ok":"bad",t:"Proyección: "+f(t)}}
    if(c.need<=0)return{cls:"ok",t:"Ya ganaste"};
    if(c.need>c.max)return{cls:"bad",t:"Imposible ("+f(c.need)+")"};
    return{cls:"",t:"Necesitas "+f(c.need)};
  }
