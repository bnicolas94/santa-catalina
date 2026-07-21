(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,5766,e=>{"use strict";let t,a;var r,o=e.i(71645);let s={data:""},i=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,n=/\/\*[^]*?\*\/|  +/g,l=/\n+/g,c=(e,t)=>{let a="",r="",o="";for(let s in e){let i=e[s];"@"==s[0]?"i"==s[1]?a=s+" "+i+";":r+="f"==s[1]?c(i,s):s+"{"+c(i,"k"==s[1]?"":t)+"}":"object"==typeof i?r+=c(i,t?t.replace(/([^,])+/g,e=>s.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):s):null!=i&&(s=/^--/.test(s)?s:s.replace(/[A-Z]/g,"-$&").toLowerCase(),o+=c.p?c.p(s,i):s+":"+i+";")}return a+(t&&o?t+"{"+o+"}":o)+r},d={},p=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+p(e[a]);return t}return e};function m(e){let t,a,r=this||{},o=e.call?e(r.p):e;return((e,t,a,r,o)=>{var s;let m=p(e),u=d[m]||(d[m]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(m));if(!d[u]){let t=m!==e?e:(e=>{let t,a,r=[{}];for(;t=i.exec(e.replace(n,""));)t[4]?r.shift():t[3]?(a=t[3].replace(l," ").trim(),r.unshift(r[0][a]=r[0][a]||{})):r[0][t[1]]=t[2].replace(l," ").trim();return r[0]})(e);d[u]=c(o?{["@keyframes "+u]:t}:t,a?"":"."+u)}let h=a&&d.g?d.g:null;return a&&(d.g=d[u]),s=d[u],h?t.data=t.data.replace(h,s):-1===t.data.indexOf(s)&&(t.data=r?s+t.data:t.data+s),u})(o.unshift?o.raw?(t=[].slice.call(arguments,1),a=r.p,o.reduce((e,r,o)=>{let s=t[o];if(s&&s.call){let e=s(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;s=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+r+(null==s?"":s)},"")):o.reduce((e,t)=>Object.assign(e,t&&t.call?t(r.p):t),{}):o,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||s})(r.target),r.g,r.o,r.k)}m.bind({g:1});let u,h,f,g=m.bind({k:1});function b(e,t){let a=this||{};return function(){let r=arguments;function o(s,i){let n=Object.assign({},s),l=n.className||o.className;a.p=Object.assign({theme:h&&h()},n),a.o=/ *go\d+/.test(l),n.className=m.apply(a,r)+(l?" "+l:""),t&&(n.ref=i);let c=e;return e[0]&&(c=n.as||e,delete n.as),f&&c[0]&&f(n),u(c,n)}return t?t(o):o}}var x=(e,t)=>"function"==typeof e?e(t):e,y=(t=0,()=>(++t).toString()),v="default",j=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return j(e,{type:+!!e.toasts.find(e=>e.id===r.id),toast:r});case 3:let{toastId:o}=t;return{...e,toasts:e.toasts.map(e=>e.id===o||void 0===o?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let s=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+s}))}}},w=[],N={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},E={},A=(e,t=v)=>{E[t]=j(E[t]||N,e),w.forEach(([e,a])=>{e===t&&a(E[t])})},C=e=>Object.keys(E).forEach(t=>A(e,t)),S=(e=v)=>t=>{A(t,e)},D=e=>(t,a)=>{let r,o=((e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||y()}))(t,e,a);return S(o.toasterId||(r=o.id,Object.keys(E).find(e=>E[e].toasts.some(e=>e.id===r))))({type:2,toast:o}),o.id},k=(e,t)=>D("blank")(e,t);k.error=D("error"),k.success=D("success"),k.loading=D("loading"),k.custom=D("custom"),k.dismiss=(e,t)=>{let a={type:3,toastId:e};t?S(t)(a):C(a)},k.dismissAll=e=>k.dismiss(void 0,e),k.remove=(e,t)=>{let a={type:4,toastId:e};t?S(t)(a):C(a)},k.removeAll=e=>k.remove(void 0,e),k.promise=(e,t,a)=>{let r=k.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let o=t.success?x(t.success,e):void 0;return o?k.success(o,{id:r,...a,...null==a?void 0:a.success}):k.dismiss(r),e}).catch(e=>{let o=t.error?x(t.error,e):void 0;o?k.error(o,{id:r,...a,...null==a?void 0:a.error}):k.dismiss(r)}),e};var $=g`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,I=g`
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
}`,L=b("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${$} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${I} 0.15s ease-out forwards;
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
`,O=g`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,T=b("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${O} 1s linear infinite;
`,V=g`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,_=g`
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
}`,F=b("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${V} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${_} 0.2s ease-out forwards;
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
`,P=b("div")`
  position: absolute;
`,q=b("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,R=g`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,U=b("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${R} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,M=({toast:e})=>{let{icon:t,type:a,iconTheme:r}=e;return void 0!==t?"string"==typeof t?o.createElement(U,null,t):t:"blank"===a?null:o.createElement(q,null,o.createElement(T,{...r}),"loading"!==a&&o.createElement(P,null,"error"===a?o.createElement(L,{...r}):o.createElement(F,{...r})))},W=b("div")`
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
`,B=b("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`;o.memo(({toast:e,position:t,style:r,children:s})=>{let i=e.height?((e,t)=>{let r=e.includes("top")?1:-1,[o,s]=(()=>{if(void 0===a&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");a=!e||e.matches}return a})()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*r}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*r}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${g(o)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${g(s)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},n=o.createElement(M,{toast:e}),l=o.createElement(B,{...e.ariaProps},x(e.message,e));return o.createElement(W,{className:e.className,style:{...i,...r,...e.style}},"function"==typeof s?s({icon:n,message:l}):o.createElement(o.Fragment,null,n,l))}),r=o.createElement,c.p=void 0,u=r,h=void 0,f=void 0,m`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,e.s(["toast",()=>k],5766)},57888,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(5766);function o({chofer:e,onClose:o,onSuccess:s}){let[i,n]=(0,a.useState)(!1),[l,c]=(0,a.useState)(e.documentos?.[0]?.fechaVencimiento?new Date(e.documentos[0].fechaVencimiento).toISOString().split("T")[0]:""),[d,p]=(0,a.useState)(null),[m,u]=(0,a.useState)(e.documentos?.[0]?.diasAviso?.toString()||"30"),[h,f]=(0,a.useState)(e.documentos?.[0]?.observaciones||""),g=async t=>{if(t.preventDefault(),!d&&!e.documentos?.[0])return void r.toast.error("Debes subir el archivo del carnet");n(!0);try{let t=new FormData;t.append("empleadoId",e.id),t.append("tipoDocumento","LICENCIA_CONDUCIR"),l&&t.append("fechaVencimiento",l),m&&t.append("diasAviso",m),h&&t.append("observaciones",h),d&&t.append("file",d);let a=await fetch("/api/documentos-empleado",{method:"POST",body:t});if(!a.ok){let e=await a.json();throw Error(e.error||"Error al subir documento")}r.toast.success("Licencia actualizada correctamente"),s(),o()}catch(e){console.error("Error uploading license:",e),r.toast.error(e.message)}finally{n(!1)}};return(0,t.jsx)("div",{className:"modal-overlay",children:(0,t.jsxs)("div",{className:"modal",style:{maxWidth:"500px"},children:[(0,t.jsxs)("div",{className:"modal-header",children:[(0,t.jsxs)("h2",{children:["Actualizar Licencia: ",e.nombre," ",e.apellido]}),(0,t.jsx)("button",{onClick:o,className:"btn btn-ghost",children:"✕"})]}),(0,t.jsxs)("form",{onSubmit:g,children:[(0,t.jsxs)("div",{className:"modal-body",style:{display:"flex",flexDirection:"column",gap:"var(--space-4)"},children:[(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--space-4)"},children:[(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Fecha de Vencimiento"}),(0,t.jsx)("input",{type:"date",className:"form-input",value:l,onChange:e=>c(e.target.value),required:!0})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Días de Aviso"}),(0,t.jsx)("input",{type:"number",className:"form-input",value:m,onChange:e=>u(e.target.value),placeholder:"Ej: 30",required:!0})]})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Archivo del Carnet (Imagen o PDF)"}),(0,t.jsx)("input",{type:"file",className:"form-input",onChange:e=>p(e.target.files?.[0]||null),accept:"image/*,.pdf",required:!e.documentos?.[0]}),e.documentos?.[0]&&(0,t.jsx)("p",{style:{fontSize:"var(--text-xs)",color:"var(--color-gray-500)",marginTop:"4px"},children:"Ya existe un archivo cargado. Subí uno nuevo para reemplazarlo."})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Observaciones"}),(0,t.jsx)("textarea",{className:"form-input",value:h,onChange:e=>f(e.target.value),placeholder:"Ej: Categoría E1, requiere anteojos...",rows:3})]})]}),(0,t.jsxs)("div",{className:"modal-footer",children:[(0,t.jsx)("button",{type:"button",onClick:o,className:"btn btn-ghost",disabled:i,children:"Cancelar"}),(0,t.jsx)("button",{type:"submit",className:"btn btn-primary",disabled:i,children:i?"Guardando...":"💾 Guardar Cambios"})]})]})]})})}var s=e.i(22016);function i(){let[e,i]=(0,a.useState)([]),[n,l]=(0,a.useState)(!0),[c,d]=(0,a.useState)(null);async function p(){try{let e=await fetch("/api/logistica/choferes"),t=await e.json();i(t)}catch(e){console.error("Error fetching choferes:",e),r.toast.error("Error al cargar choferes")}finally{l(!1)}}return(0,a.useEffect)(()=>{p()},[]),(0,t.jsxs)("div",{className:"page-content",children:[(0,t.jsxs)("div",{className:"page-header",children:[(0,t.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-3)"},children:(0,t.jsx)("h1",{className:"page-title",children:"Administración de Choferes"})}),(0,t.jsx)("div",{className:"page-actions",children:(0,t.jsx)(s.default,{href:"/logistica",className:"btn btn-ghost",children:"← Volver"})})]}),(0,t.jsxs)("div",{className:"card shadow-sm",children:[(0,t.jsx)("div",{className:"card-header",children:(0,t.jsx)("h2",{className:"card-title",children:"Listado de Personal de Logística"})}),(0,t.jsx)("div",{className:"table-container",children:(0,t.jsxs)("table",{className:"table",children:[(0,t.jsx)("thead",{children:(0,t.jsxs)("tr",{children:[(0,t.jsx)("th",{children:"Nombre y Apellido"}),(0,t.jsx)("th",{children:"Vencimiento Licencia"}),(0,t.jsx)("th",{children:"Estado"}),(0,t.jsx)("th",{style:{textAlign:"right"},children:"Acciones"})]})}),(0,t.jsx)("tbody",{children:n?(0,t.jsx)("tr",{children:(0,t.jsx)("td",{colSpan:4,style:{textAlign:"center",padding:"var(--space-10)"},children:"Cargando choferes..."})}):0===e.length?(0,t.jsx)("tr",{children:(0,t.jsx)("td",{colSpan:4,style:{textAlign:"center",padding:"var(--space-10)"},children:"No se encontraron empleados con rol Logística."})}):e.map(e=>{let a=e.documentos?.[0],r=((e,t=30)=>{if(!e)return{label:"PENDIENTE",color:"var(--color-gray-500)",bg:"var(--color-gray-100)"};let a=new Date(e),r=new Date,o=Math.ceil((a.getTime()-r.getTime())/864e5);return o<0?{label:"VENCIDO",color:"var(--color-danger)",bg:"var(--color-danger-light)"}:o<=t?{label:`VENCE EN ${o} D\xcdAS`,color:"var(--color-warning-dark)",bg:"var(--color-warning-light)"}:{label:"AL DÍA",color:"var(--color-success)",bg:"var(--color-success-light)"}})(a?.fechaVencimiento,a?.diasAviso);return(0,t.jsxs)("tr",{children:[(0,t.jsxs)("td",{style:{fontWeight:"bold"},children:[e.nombre," ",e.apellido]}),(0,t.jsx)("td",{children:a?.fechaVencimiento?new Date(a.fechaVencimiento).toLocaleDateString("es-AR"):"Sin registrar"}),(0,t.jsx)("td",{children:(0,t.jsx)("span",{style:{padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"bold",color:r.color,backgroundColor:r.bg},children:r.label})}),(0,t.jsx)("td",{style:{textAlign:"right"},children:(0,t.jsxs)("div",{style:{display:"flex",gap:"var(--space-2)",justifyContent:"flex-end"},children:[a?.archivoUrl&&(0,t.jsx)("a",{href:a.archivoUrl,target:"_blank",rel:"noopener noreferrer",className:"btn btn-ghost btn-sm",title:"Ver documento actual",children:"👁️ Ver"}),(0,t.jsxs)("button",{onClick:()=>d(e),className:"btn btn-outline btn-sm",children:["🪪 ",a?"Actualizar":"Cargar"," Licencia"]})]})})]},e.id)})})]})})]}),c&&(0,t.jsx)(o,{chofer:c,onClose:()=>d(null),onSuccess:p})]})}e.s(["default",()=>i],57888)}]);