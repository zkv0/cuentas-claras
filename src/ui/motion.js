/** Animaciones de apertura, cierre, reordenación y pulsación.
 * Respeta la preferencia del sistema de reducir movimiento.
 */
export function createMotion({ ui, renderRaw }) {
  var EASE="cubic-bezier(.2,0,0,1)",reduced=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
  function pads(el){var c=getComputedStyle(el);return{pt:c.paddingTop,pb:c.paddingBottom,mb:c.marginBottom}}
  function grow(el,chev){
    if(!el||reduced)return;
    var h=el.offsetHeight,p=pads(el);el.style.overflow="hidden";
    var a=el.animate([{height:"0px",paddingTop:"0px",paddingBottom:"0px",opacity:0},{height:h+"px",paddingTop:p.pt,paddingBottom:p.pb,opacity:1}],{duration:300,easing:EASE});
    a.onfinish=a.oncancel=function(){el.style.overflow=""};
    if(chev)chev.animate([{transform:"rotate(0deg)"},{transform:"rotate(90deg)"}],{duration:250,easing:EASE});
  }
  function shrink(el,chev,cb){
    if(!el||reduced){cb();return}
    var h=el.offsetHeight,p=pads(el);el.style.overflow="hidden";
    var a=el.animate([{height:h+"px",paddingTop:p.pt,paddingBottom:p.pb,marginBottom:p.mb,opacity:1},{height:"0px",paddingTop:"0px",paddingBottom:"0px",marginBottom:"0px",opacity:0}],{duration:220,easing:EASE,fill:"forwards"});
    if(chev)chev.animate([{transform:"rotate(90deg)"},{transform:"rotate(0deg)"}],{duration:220,easing:EASE,fill:"forwards"});
    a.onfinish=cb;
  }
  function render(){
    var app=document.getElementById("app"),pos={};
    if(ui.anim.flip)app.querySelectorAll(".card").forEach(function(c){pos[c.dataset.id]=c.getBoundingClientRect().top});
    renderRaw();
    var f=ui.anim;ui.anim={};
    if(reduced)return;
    app.querySelectorAll(".card").forEach(function(c,i){
      var id=c.dataset.id;
      if(f.first)c.animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],{duration:350,delay:i*50,easing:EASE,fill:"backwards"});
      else if(f.flip){
        if(pos[id]==null)c.animate([{opacity:0,transform:"scale(.92)"},{opacity:1,transform:"none"}],{duration:300,easing:EASE});
        else{var d=pos[id]-c.getBoundingClientRect().top;if(d)c.animate([{transform:"translateY("+d+"px)"},{transform:"none"}],{duration:320,easing:EASE})}
      }
      if(f.arch&&i===0)grow(app.querySelector(".arch-list"),app.querySelector(".arch-h .chev"));
      if(f.open===id)grow(c.querySelector(".body"),c.querySelector(".chev"));
      if(f.grp===id)grow(c.querySelector(".grpbody"),c.querySelector(".grp .chev"));
      if(f.rowCard===id){var r=c.querySelector('.row[data-i="'+f.row+'"]');if(r)r.animate([{opacity:0,transform:"translateY(-8px)"},{opacity:1,transform:"none"}],{duration:280,easing:EASE})}
    });
  }
  document.addEventListener("pointerdown",function(e){
    var b=e.target.closest&&e.target.closest("button");if(!b||b.disabled||reduced)return;
    var r=b.getBoundingClientRect(),z=Math.max(r.width,r.height)*2,sp=document.createElement("span");
    sp.className="ripple";sp.style.cssText="width:"+z+"px;height:"+z+"px;left:"+(e.clientX-r.left-z/2)+"px;top:"+(e.clientY-r.top-z/2)+"px";
    b.appendChild(sp);setTimeout(function(){sp.remove()},600);
  });



  return { render, shrink };
}
