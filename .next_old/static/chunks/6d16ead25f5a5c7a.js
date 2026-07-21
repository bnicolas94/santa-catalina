(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,5766,e=>{"use strict";let t,a;var r,s=e.i(71645);let o={data:""},i=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,n=/\/\*[^]*?\*\/|  +/g,l=/\n+/g,c=(e,t)=>{let a="",r="",s="";for(let o in e){let i=e[o];"@"==o[0]?"i"==o[1]?a=o+" "+i+";":r+="f"==o[1]?c(i,o):o+"{"+c(i,"k"==o[1]?"":t)+"}":"object"==typeof i?r+=c(i,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=i&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),s+=c.p?c.p(o,i):o+":"+i+";")}return a+(t&&s?t+"{"+s+"}":s)+r},d={},m=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+m(e[a]);return t}return e};function p(e){let t,a,r=this||{},s=e.call?e(r.p):e;return((e,t,a,r,s)=>{var o;let p=m(e),u=d[p]||(d[p]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(p));if(!d[u]){let t=p!==e?e:(e=>{let t,a,r=[{}];for(;t=i.exec(e.replace(n,""));)t[4]?r.shift():t[3]?(a=t[3].replace(l," ").trim(),r.unshift(r[0][a]=r[0][a]||{})):r[0][t[1]]=t[2].replace(l," ").trim();return r[0]})(e);d[u]=c(s?{["@keyframes "+u]:t}:t,a?"":"."+u)}let h=a&&d.g?d.g:null;return a&&(d.g=d[u]),o=d[u],h?t.data=t.data.replace(h,o):-1===t.data.indexOf(o)&&(t.data=r?o+t.data:t.data+o),u})(s.unshift?s.raw?(t=[].slice.call(arguments,1),a=r.p,s.reduce((e,r,s)=>{let o=t[s];if(o&&o.call){let e=o(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+r+(null==o?"":o)},"")):s.reduce((e,t)=>Object.assign(e,t&&t.call?t(r.p):t),{}):s,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||o})(r.target),r.g,r.o,r.k)}p.bind({g:1});let u,h,g,f=p.bind({k:1});function b(e,t){let a=this||{};return function(){let r=arguments;function s(o,i){let n=Object.assign({},o),l=n.className||s.className;a.p=Object.assign({theme:h&&h()},n),a.o=/ *go\d+/.test(l),n.className=p.apply(a,r)+(l?" "+l:""),t&&(n.ref=i);let c=e;return e[0]&&(c=n.as||e,delete n.as),g&&c[0]&&g(n),u(c,n)}return t?t(s):s}}var x=(e,t)=>"function"==typeof e?e(t):e,y=(t=0,()=>(++t).toString()),v="default",j=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return j(e,{type:+!!e.toasts.find(e=>e.id===r.id),toast:r});case 3:let{toastId:s}=t;return{...e,toasts:e.toasts.map(e=>e.id===s||void 0===s?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let o=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+o}))}}},w=[],N={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},C={},E=(e,t=v)=>{C[t]=j(C[t]||N,e),w.forEach(([e,a])=>{e===t&&a(C[t])})},k=e=>Object.keys(C).forEach(t=>E(e,t)),$=(e=v)=>t=>{E(t,e)},A=e=>(t,a)=>{let r,s=((e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||y()}))(t,e,a);return $(s.toasterId||(r=s.id,Object.keys(C).find(e=>C[e].toasts.some(e=>e.id===r))))({type:2,toast:s}),s.id},S=(e,t)=>A("blank")(e,t);S.error=A("error"),S.success=A("success"),S.loading=A("loading"),S.custom=A("custom"),S.dismiss=(e,t)=>{let a={type:3,toastId:e};t?$(t)(a):k(a)},S.dismissAll=e=>S.dismiss(void 0,e),S.remove=(e,t)=>{let a={type:4,toastId:e};t?$(t)(a):k(a)},S.removeAll=e=>S.remove(void 0,e),S.promise=(e,t,a)=>{let r=S.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let s=t.success?x(t.success,e):void 0;return s?S.success(s,{id:r,...a,...null==a?void 0:a.success}):S.dismiss(r),e}).catch(e=>{let s=t.error?x(t.error,e):void 0;s?S.error(s,{id:r,...a,...null==a?void 0:a.error}):S.dismiss(r)}),e};var O=f`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,T=f`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,z=f`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,P=b("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${O} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
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
`,_=f`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,D=b("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${_} 1s linear infinite;
`,I=f`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,F=f`
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
}`,G=b("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${I} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
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
`,L=b("div")`
  position: absolute;
`,q=b("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,M=f`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,R=b("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${M} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,U=({toast:e})=>{let{icon:t,type:a,iconTheme:r}=e;return void 0!==t?"string"==typeof t?s.createElement(R,null,t):t:"blank"===a?null:s.createElement(q,null,s.createElement(D,{...r}),"loading"!==a&&s.createElement(L,null,"error"===a?s.createElement(P,{...r}):s.createElement(G,{...r})))},B=b("div")`
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
`,K=b("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`;s.memo(({toast:e,position:t,style:r,children:o})=>{let i=e.height?((e,t)=>{let r=e.includes("top")?1:-1,[s,o]=(()=>{if(void 0===a&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");a=!e||e.matches}return a})()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*r}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*r}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${f(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${f(o)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},n=s.createElement(U,{toast:e}),l=s.createElement(K,{...e.ariaProps},x(e.message,e));return s.createElement(B,{className:e.className,style:{...i,...r,...e.style}},"function"==typeof o?o({icon:n,message:l}):s.createElement(s.Fragment,null,n,l))}),r=s.createElement,c.p=void 0,u=r,h=void 0,g=void 0,p`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,e.s(["toast",()=>S],5766)},22216,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(5766),s=e.i(22016);function o(){let[e,o]=(0,a.useState)([]),[i,n]=(0,a.useState)(!0),[l,c]=(0,a.useState)(!1),[d,m]=(0,a.useState)(!1),[p,u]=(0,a.useState)(!1),[h,g]=(0,a.useState)({id:"",nombre:"",color:"#E74C3C"});async function f(){n(!0);try{let e=await fetch("/api/gastos/categorias"),t=await e.json();o(Array.isArray(t)?t:[])}catch{r.toast.error("Error al cargar categorías")}finally{n(!1)}}async function b(e){e.preventDefault(),u(!0);let t=d?`/api/gastos/categorias/${h.id}`:"/api/gastos/categorias";try{let e=await fetch(t,{method:d?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nombre:h.nombre,color:h.color})}),a=await e.json();if(!e.ok)throw Error(a.error||"Error al guardar categoría");r.toast.success(d?"Categoría actualizada":"Categoría creada"),c(!1),f()}catch(e){r.toast.error(e.message)}finally{u(!1)}}async function x(e){if(confirm("¿Estás seguro de que deseas eliminar esta categoría? Si tiene gastos asignados, se ocultará en nuevos formularios pero se mantendrá su historial.")){n(!0);try{if(!(await fetch(`/api/gastos/categorias/${e}`,{method:"DELETE"})).ok)throw Error("Error al eliminar");r.toast.success("Categoría eliminada"),f()}catch{r.toast.error("Error al intentar eliminar")}finally{n(!1)}}}return(0,a.useEffect)(()=>{f()},[]),(0,t.jsxs)("div",{className:"page-content",children:[(0,t.jsxs)("div",{className:"page-header",children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("h1",{className:"page-title",children:"Configuración de Gastos"}),(0,t.jsx)("p",{style:{color:"var(--color-gray-500)",fontSize:"var(--text-sm)"},children:"Administra los tipos de gastos disponibles en el sistema."})]}),(0,t.jsxs)("div",{className:"page-actions",children:[(0,t.jsx)(s.default,{href:"/costos",className:"btn btn-ghost",children:"← Volver a Costos"}),(0,t.jsx)("button",{className:"btn btn-primary",onClick:function(){g({id:"",nombre:"",color:"#E74C3C"}),m(!1),c(!0)},children:"+ Nueva Categoría"})]})]}),(0,t.jsxs)("div",{className:"card",children:[(0,t.jsx)("div",{className:"card-header",children:(0,t.jsx)("h2",{className:"card-title",children:"Tipos de Gastos"})}),(0,t.jsx)("div",{className:"table-container",children:(0,t.jsxs)("table",{className:"table",children:[(0,t.jsx)("thead",{children:(0,t.jsxs)("tr",{children:[(0,t.jsx)("th",{children:"Atributo"}),(0,t.jsx)("th",{children:"Nombre de la Categoría"}),(0,t.jsx)("th",{children:"Tipo Operativo"}),(0,t.jsx)("th",{style:{textAlign:"right"},children:"Acciones"})]})}),(0,t.jsx)("tbody",{children:i?(0,t.jsx)("tr",{children:(0,t.jsx)("td",{colSpan:4,className:"text-center",style:{padding:"2rem"},children:"Cargando..."})}):0===e.length?(0,t.jsx)("tr",{children:(0,t.jsx)("td",{colSpan:4,className:"text-center",style:{padding:"2rem"},children:"No hay categorías registradas."})}):e.map(e=>(0,t.jsxs)("tr",{children:[(0,t.jsx)("td",{style:{width:"60px"},children:(0,t.jsx)("div",{style:{width:24,height:24,borderRadius:"50%",backgroundColor:e.color||"#E74C3C",border:"1px solid var(--color-gray-200)"},title:e.color||"#E74C3C"})}),(0,t.jsx)("td",{style:{fontWeight:"bold"},children:e.nombre}),(0,t.jsx)("td",{children:(0,t.jsx)("span",{className:`badge badge-${e.esOperativo?"success":"warning"}`,children:e.esOperativo?"Costos Puros":"Movi. General"})}),(0,t.jsxs)("td",{style:{textAlign:"right"},children:[(0,t.jsx)("button",{className:"btn btn-ghost btn-sm",onClick:()=>{g({id:e.id,nombre:e.nombre,color:e.color||"#E74C3C"}),m(!0),c(!0)},children:"Editar"}),(0,t.jsx)("button",{className:"btn btn-ghost btn-danger btn-sm",onClick:()=>x(e.id),children:"Eliminar"})]})]},e.id))})]})})]}),l&&(0,t.jsx)("div",{className:"modal-overlay",onClick:()=>c(!1),children:(0,t.jsxs)("div",{className:"modal",onClick:e=>e.stopPropagation(),style:{maxWidth:400},children:[(0,t.jsxs)("div",{className:"modal-header",children:[(0,t.jsx)("h2",{children:d?"Editar Categoría":"Nueva Categoría"}),(0,t.jsx)("button",{className:"btn btn-ghost btn-icon",onClick:()=>c(!1),children:"✕"})]}),(0,t.jsxs)("form",{onSubmit:b,children:[(0,t.jsxs)("div",{className:"modal-body",children:[(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Nombre del gasto"}),(0,t.jsx)("input",{type:"text",className:"form-input",value:h.nombre,onChange:e=>g({...h,nombre:e.target.value}),placeholder:"Ej: Combustibles, Comida...",required:!0})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Color de Etiqueta"}),(0,t.jsx)("input",{type:"color",className:"form-input",style:{padding:"0 4px",height:40,cursor:"pointer"},value:h.color,onChange:e=>g({...h,color:e.target.value})})]})]}),(0,t.jsxs)("div",{className:"modal-footer",children:[(0,t.jsx)("button",{type:"button",className:"btn btn-ghost",onClick:()=>c(!1),children:"Cancelar"}),(0,t.jsx)("button",{type:"submit",className:"btn btn-primary",disabled:p,children:p?"Guardando...":"Guardar"})]})]})]})})]})}e.s(["default",()=>o])}]);