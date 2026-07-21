(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,5766,e=>{"use strict";let t,a;var r,s=e.i(71645);let i={data:""},o=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,n=/\n+/g,c=(e,t)=>{let a="",r="",s="";for(let i in e){let o=e[i];"@"==i[0]?"i"==i[1]?a=i+" "+o+";":r+="f"==i[1]?c(o,i):i+"{"+c(o,"k"==i[1]?"":t)+"}":"object"==typeof o?r+=c(o,t?t.replace(/([^,])+/g,e=>i.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):i):null!=o&&(i=/^--/.test(i)?i:i.replace(/[A-Z]/g,"-$&").toLowerCase(),s+=c.p?c.p(i,o):i+":"+o+";")}return a+(t&&s?t+"{"+s+"}":s)+r},d={},p=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+p(e[a]);return t}return e};function m(e){let t,a,r=this||{},s=e.call?e(r.p):e;return((e,t,a,r,s)=>{var i;let m=p(e),u=d[m]||(d[m]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(m));if(!d[u]){let t=m!==e?e:(e=>{let t,a,r=[{}];for(;t=o.exec(e.replace(l,""));)t[4]?r.shift():t[3]?(a=t[3].replace(n," ").trim(),r.unshift(r[0][a]=r[0][a]||{})):r[0][t[1]]=t[2].replace(n," ").trim();return r[0]})(e);d[u]=c(s?{["@keyframes "+u]:t}:t,a?"":"."+u)}let h=a&&d.g?d.g:null;return a&&(d.g=d[u]),i=d[u],h?t.data=t.data.replace(h,i):-1===t.data.indexOf(i)&&(t.data=r?i+t.data:t.data+i),u})(s.unshift?s.raw?(t=[].slice.call(arguments,1),a=r.p,s.reduce((e,r,s)=>{let i=t[s];if(i&&i.call){let e=i(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;i=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+r+(null==i?"":i)},"")):s.reduce((e,t)=>Object.assign(e,t&&t.call?t(r.p):t),{}):s,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||i})(r.target),r.g,r.o,r.k)}m.bind({g:1});let u,h,f,g=m.bind({k:1});function x(e,t){let a=this||{};return function(){let r=arguments;function s(i,o){let l=Object.assign({},i),n=l.className||s.className;a.p=Object.assign({theme:h&&h()},l),a.o=/ *go\d+/.test(n),l.className=m.apply(a,r)+(n?" "+n:""),t&&(l.ref=o);let c=e;return e[0]&&(c=l.as||e,delete l.as),f&&c[0]&&f(l),u(c,l)}return t?t(s):s}}var y=(e,t)=>"function"==typeof e?e(t):e,v=(t=0,()=>(++t).toString()),b="default",j=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return j(e,{type:+!!e.toasts.find(e=>e.id===r.id),toast:r});case 3:let{toastId:s}=t;return{...e,toasts:e.toasts.map(e=>e.id===s||void 0===s?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let i=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+i}))}}},w=[],N={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},S={},A=(e,t=b)=>{S[t]=j(S[t]||N,e),w.forEach(([e,a])=>{e===t&&a(S[t])})},$=e=>Object.keys(S).forEach(t=>A(e,t)),E=(e=b)=>t=>{A(t,e)},C=e=>(t,a)=>{let r,s=((e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||v()}))(t,e,a);return E(s.toasterId||(r=s.id,Object.keys(S).find(e=>S[e].toasts.some(e=>e.id===r))))({type:2,toast:s}),s.id},k=(e,t)=>C("blank")(e,t);k.error=C("error"),k.success=C("success"),k.loading=C("loading"),k.custom=C("custom"),k.dismiss=(e,t)=>{let a={type:3,toastId:e};t?E(t)(a):$(a)},k.dismissAll=e=>k.dismiss(void 0,e),k.remove=(e,t)=>{let a={type:4,toastId:e};t?E(t)(a):$(a)},k.removeAll=e=>k.remove(void 0,e),k.promise=(e,t,a)=>{let r=k.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let s=t.success?y(t.success,e):void 0;return s?k.success(s,{id:r,...a,...null==a?void 0:a.success}):k.dismiss(r),e}).catch(e=>{let s=t.error?y(t.error,e):void 0;s?k.error(s,{id:r,...a,...null==a?void 0:a.error}):k.dismiss(r)}),e};var I=g`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,T=g`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,z=g`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,O=x("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${I} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${T} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${z} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,D=g`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,P=x("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${D} 1s linear infinite;
`,_=g`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,F=g`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,L=x("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${_} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${F} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,M=x("div")`
  position: absolute;
`,q=x("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,G=g`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,R=x("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${G} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,V=({toast:e})=>{let{icon:t,type:a,iconTheme:r}=e;return void 0!==t?"string"==typeof t?s.createElement(R,null,t):t:"blank"===a?null:s.createElement(q,null,s.createElement(P,{...r}),"loading"!==a&&s.createElement(M,null,"error"===a?s.createElement(O,{...r}):s.createElement(L,{...r})))},B=x("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,H=x("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`;s.memo(({toast:e,position:t,style:r,children:i})=>{let o=e.height?((e,t)=>{let r=e.includes("top")?1:-1,[s,i]=(()=>{if(void 0===a&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");a=!e||e.matches}return a})()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*r}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*r}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${g(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${g(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},l=s.createElement(V,{toast:e}),n=s.createElement(H,{...e.ariaProps},y(e.message,e));return s.createElement(B,{className:e.className,style:{...o,...r,...e.style}},"function"==typeof i?i({icon:l,message:n}):s.createElement(s.Fragment,null,l,n))}),r=s.createElement,c.p=void 0,u=r,h=void 0,f=void 0,m`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,e.s(["toast",()=>k],5766)},35125,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(5766);function s(){let[e,s]=(0,a.useState)(new Date().toISOString().split("T")[0]),[i,o]=(0,a.useState)("Mañana"),[l,n]=(0,a.useState)([]),[c,d]=(0,a.useState)([]),[p,m]=(0,a.useState)([]),[u,h]=(0,a.useState)(!0),[f,g]=(0,a.useState)(!1),[x,y]=(0,a.useState)(""),[v,b]=(0,a.useState)("");async function j(){h(!0);try{let[t,a,r]=await Promise.all([fetch("/api/empleados"),fetch("/api/flota/vehiculos"),fetch(`/api/logistica/flota/asignaciones?fecha=${e}&turno=${i}`)]),s=await t.json(),o=await a.json(),l=await r.json(),c=Array.isArray(s)?s.filter(e=>"LOGISTICA"===e.rol||"ADMIN"===e.rol):[];n(c);let p=Array.isArray(o)?o.filter(e=>e.activo):[];d(p),m(l)}catch(e){console.error("Error fetching data:",e),r.toast.error("Error al cargar datos")}finally{h(!1)}}async function w(){if(!x||!v)return void r.toast.error("Seleccioná chofer y vehículo");g(!0);try{let t=await fetch("/api/logistica/flota/asignaciones",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fecha:e,turno:i,empleadoId:x,vehiculoId:v})}),a=await t.json();if(!t.ok)throw Error(a.error);r.toast.success("Asignación guardada"),y(""),b(""),j()}catch(e){r.toast.error(e.message||"Error al guardar asignación")}finally{g(!1)}}async function N(e){if(confirm("¿Eliminar esta asignación?"))try{(await fetch(`/api/logistica/flota/asignaciones?id=${e}`,{method:"DELETE"})).ok&&(r.toast.success("Asignación eliminada"),j())}catch(e){r.toast.error("Error al eliminar")}}(0,a.useEffect)(()=>{j()},[e,i]);let S=c.filter(e=>!p.some(t=>t.vehiculoId===e.id));return(0,t.jsxs)("div",{className:"page-content",children:[(0,t.jsxs)("div",{className:"page-header",children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("h1",{className:"page-title",children:"Asignación Diaria de Flota"}),(0,t.jsx)("p",{style:{color:"var(--color-gray-500)",fontSize:"var(--text-sm)"},children:"Control de qué vehículo usa cada chofer por día y turno."})]}),(0,t.jsxs)("div",{style:{display:"flex",gap:"var(--space-3)",alignItems:"center"},children:[(0,t.jsx)("input",{type:"date",className:"form-input",value:e,onChange:e=>s(e.target.value)}),(0,t.jsxs)("select",{className:"form-select",value:i,onChange:e=>o(e.target.value),children:[(0,t.jsx)("option",{value:"Mañana",children:"🌅 Mañana"}),(0,t.jsx)("option",{value:"Siesta",children:"☀️ Siesta"}),(0,t.jsx)("option",{value:"Tarde",children:"🌇 Tarde"})]})]})]}),(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 350px",gap:"var(--space-6)",alignItems:"start"},children:[(0,t.jsxs)("div",{className:"card",children:[(0,t.jsx)("div",{className:"card-header",children:(0,t.jsxs)("h2",{className:"card-title",children:["Planilla de Asignaciones (",p.length,")"]})}),(0,t.jsx)("div",{className:"table-container",children:(0,t.jsxs)("table",{className:"table",children:[(0,t.jsx)("thead",{children:(0,t.jsxs)("tr",{children:[(0,t.jsx)("th",{children:"Chofer"}),(0,t.jsx)("th",{children:"Vehículo"}),(0,t.jsx)("th",{children:"Estado"}),(0,t.jsx)("th",{style:{textAlign:"right"},children:"Acciones"})]})}),(0,t.jsx)("tbody",{children:u?(0,t.jsx)("tr",{children:(0,t.jsx)("td",{colSpan:4,style:{textAlign:"center"},children:"Cargando asignaciones..."})}):0===p.length?(0,t.jsx)("tr",{children:(0,t.jsx)("td",{colSpan:4,style:{textAlign:"center"},children:"No hay asignaciones para este turno."})}):p.map(e=>(0,t.jsxs)("tr",{children:[(0,t.jsxs)("td",{style:{fontWeight:600},children:[e.empleado.nombre," ",e.empleado.apellido]}),(0,t.jsxs)("td",{children:[(0,t.jsxs)("div",{style:{fontWeight:"bold",fontSize:"var(--text-sm)"},children:[e.vehiculo.alias?`${e.vehiculo.alias} `:"",(0,t.jsx)("span",{style:{fontSize:e.vehiculo.alias?"0.85em":"1em",color:e.vehiculo.alias?"var(--color-gray-500)":"inherit"},children:e.vehiculo.alias?`(${e.vehiculo.patente})`:e.vehiculo.patente})]}),(0,t.jsxs)("div",{style:{fontSize:"11px",color:"var(--color-gray-500)"},children:[e.vehiculo.marca," ",e.vehiculo.modelo]})]}),(0,t.jsx)("td",{children:(0,t.jsx)("span",{className:"badge badge-success",children:"ASIGNADO"})}),(0,t.jsx)("td",{style:{textAlign:"right"},children:(0,t.jsx)("button",{onClick:()=>N(e.id),className:"btn btn-ghost btn-sm",style:{color:"var(--color-danger)"},children:"Quitar"})})]},e.id))})]})})]}),(0,t.jsxs)("div",{className:"card shadow-sm",style:{backgroundColor:"var(--color-gray-50)"},children:[(0,t.jsx)("div",{className:"card-header",children:(0,t.jsx)("h2",{className:"card-title",children:"Nueva Asignación"})}),(0,t.jsxs)("div",{style:{padding:"var(--space-4)",display:"flex",flexDirection:"column",gap:"var(--space-4)"},children:[(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Chofer"}),(0,t.jsxs)("select",{className:"form-select",value:x,onChange:e=>y(e.target.value),children:[(0,t.jsx)("option",{value:"",children:"Seleccionar chofer..."}),l.map(e=>(0,t.jsxs)("option",{value:e.id,disabled:p.some(t=>t.empleadoId===e.id),children:[e.nombre," ",e.apellido," ",p.some(t=>t.empleadoId===e.id)?"(Ya asignado)":""]},e.id))]})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Vehículo Disponible"}),(0,t.jsxs)("select",{className:"form-select",value:v,onChange:e=>b(e.target.value),children:[(0,t.jsx)("option",{value:"",children:"Seleccionar vehículo..."}),S.map(e=>(0,t.jsx)("option",{value:e.id,children:e.alias?`${e.alias} (${e.patente})`:`${e.patente} - ${e.marca}`},e.id))]}),0===S.length&&(0,t.jsx)("p",{style:{fontSize:"11px",color:"var(--color-danger)",marginTop:"4px"},children:"⚠️ No hay más vehículos disponibles para este turno."})]}),(0,t.jsx)("button",{onClick:w,className:"btn btn-primary",style:{marginTop:"var(--space-2)"},disabled:f||!x||!v,children:f?"Guardando...":"➡️ Asignar Vehículo"})]})]})]}),(0,t.jsxs)("div",{className:"card",style:{marginTop:"var(--space-6)"},children:[(0,t.jsx)("div",{className:"card-header",children:(0,t.jsx)("h2",{className:"card-title",children:"Historial y Consultas Rápidas"})}),(0,t.jsx)("div",{style:{padding:"var(--space-4)"},children:(0,t.jsx)("p",{style:{color:"var(--color-gray-600)",fontSize:"var(--text-sm)"},children:"Cambiá la fecha en el selector de arriba para consultar el registro histórico de cualquier día. El sistema mantiene un log permanente de quién utilizó cada móvil."})})]})]})}e.s(["default",()=>s])}]);