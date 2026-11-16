// Conversiones compartidas. Las fechas de asistencia se interpretan en hora local.
export function uid(){return Math.random().toString(36).slice(2,9)}

export function num(v){var n=parseFloat(String(v).replace(",","."));return isNaN(n)?null:n}

export function f(n){return (Math.round(n*100)/100).toFixed(2)}

export function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")}

export function tm(x){var m=String(x||"").match(/(\d{1,2}):(\d{2})/);return m?("0"+m[1]).slice(-2)+":"+m[2]:""}

export function toMin(t){var m=String(t||"").match(/^(\d{1,2}):(\d{2})$/);return m?(+m[1])*60+(+m[2]):null}

export function fm(min){return ("0"+Math.floor(min/60)).slice(-2)+":"+("0"+(min%60)).slice(-2)}
