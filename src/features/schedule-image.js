import { toMin, fm } from '../core/utils.js';
export function exportScheduleImage(state, onError, semesterId = state.activeSemesterId){
  const semester = state.semesters.find(period => period.id === semesterId);
  const source = semesterId === state.activeSemesterId ? state.subjects : semester?.subjects;
  const subjects = (source ?? []).filter(subject => !subject.archived && subject.days?.length);
  if(!subjects.length){onError(semester ? 'Este semestre no tiene un horario para descargar.' : 'Agrega un horario para exportarlo.');return}
  const order=[1,2,3,4,5,6,0],days=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const blocks=[],loose=[];
  subjects.forEach(subject=>{
    const covered=new Set();
    (subject.blocks||[]).forEach(b=>{
      const start=toMin(b.s),end=toMin(b.e);
      if(start===null)return;
      covered.add(b.d);blocks.push({name:subject.name||'Sin nombre',day:b.d,start,end:end!==null&&end>start?end:start+60});
    });
    subject.days.forEach(d=>{if(!covered.has(d))loose.push((subject.name||'Sin nombre')+' · '+days[order.indexOf(d)]+' (sin hora)')});
  });
  const low=blocks.length?Math.floor(Math.min(...blocks.map(b=>b.start))/60):0;
  const high=blocks.length?Math.ceil(Math.max(...blocks.map(b=>b.end))/60):0;
  const hour=100,top=160,left=92,col=210,width=1600;
  const height=top+(high-low)*hour+50+loose.length*30;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');
  if(!ctx){onError('No se pudo crear la imagen.');return}
  ctx.fillStyle='#151515';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#eeeeee';ctx.font='500 30px Arial';ctx.fillText('Horario · '+(semester?.name||'Semestre'),32,52,width-64);
  ctx.font='20px Arial';ctx.fillStyle='#bdbdbd';
  days.forEach((day,i)=>ctx.fillText(day,left+i*col+12,120));
  for(let h=low;h<=high;h++){
    const y=top+(h-low)*hour;ctx.strokeStyle='#333333';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+7*col,y);ctx.stroke();
    ctx.fillStyle='#aaaaaa';ctx.font='16px Arial';ctx.fillText(fm(h*60),24,y+6);
  }
  for(let d=0;d<=7;d++){ctx.strokeStyle='#333333';ctx.beginPath();ctx.moveTo(left+d*col,top);ctx.lineTo(left+d*col,top+(high-low)*hour);ctx.stroke()}
  blocks.forEach(b=>{
    const x=left+order.indexOf(b.day)*col+3,y=top+(b.start/60-low)*hour+2,h=(b.end-b.start)/60*hour-4;
    ctx.fillStyle='#303030';ctx.fillRect(x,y,col-6,h);
    ctx.save();ctx.beginPath();ctx.rect(x+6,y+2,col-18,h-4);ctx.clip();
    ctx.fillStyle='#cccccc';ctx.font='15px Arial';ctx.fillText(fm(b.start)+' – '+fm(b.end),x+9,y+19);
    ctx.fillStyle='#ffffff';ctx.font='18px Arial';
    let line='',row=0;for(const word of b.name.split(/\s+/)){
      const next=line?line+' '+word:word;
      if(ctx.measureText(next).width>col-28&&line){ctx.fillText(line,x+9,y+43+row*22,col-28);row++;line=word}else line=next;
    }ctx.fillText(line,x+9,y+43+row*22,col-28);ctx.restore();
  });
  ctx.font='18px Arial';ctx.fillStyle='#bdbdbd';loose.forEach((text,i)=>ctx.fillText(text,32,top+(high-low)*hour+35+i*30,width-64));
  canvas.toBlob(blob=>{
    if(!blob){onError('No se pudo crear la imagen.');return}
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='horario-'+String(semester?.name||'semestre').replace(/[^a-z0-9_-]/gi,'-')+'.png';
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'image/png');
}
