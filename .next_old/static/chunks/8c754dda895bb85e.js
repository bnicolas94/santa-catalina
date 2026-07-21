(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,5766,e=>{"use strict";let t,a;var s,r=e.i(71645);let o={data:""},i=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,n=/\n+/g,c=(e,t)=>{let a="",s="",r="";for(let o in e){let i=e[o];"@"==o[0]?"i"==o[1]?a=o+" "+i+";":s+="f"==o[1]?c(i,o):o+"{"+c(i,"k"==o[1]?"":t)+"}":"object"==typeof i?s+=c(i,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=i&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),r+=c.p?c.p(o,i):o+":"+i+";")}return a+(t&&r?t+"{"+r+"}":r)+s},d={},p=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+p(e[a]);return t}return e};function m(e){let t,a,s=this||{},r=e.call?e(s.p):e;return((e,t,a,s,r)=>{var o;let m=p(e),u=d[m]||(d[m]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(m));if(!d[u]){let t=m!==e?e:(e=>{let t,a,s=[{}];for(;t=i.exec(e.replace(l,""));)t[4]?s.shift():t[3]?(a=t[3].replace(n," ").trim(),s.unshift(s[0][a]=s[0][a]||{})):s[0][t[1]]=t[2].replace(n," ").trim();return s[0]})(e);d[u]=c(r?{["@keyframes "+u]:t}:t,a?"":"."+u)}let g=a&&d.g?d.g:null;return a&&(d.g=d[u]),o=d[u],g?t.data=t.data.replace(g,o):-1===t.data.indexOf(o)&&(t.data=s?o+t.data:t.data+o),u})(r.unshift?r.raw?(t=[].slice.call(arguments,1),a=s.p,r.reduce((e,s,r)=>{let o=t[r];if(o&&o.call){let e=o(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+s+(null==o?"":o)},"")):r.reduce((e,t)=>Object.assign(e,t&&t.call?t(s.p):t),{}):r,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||o})(s.target),s.g,s.o,s.k)}m.bind({g:1});let u,g,h,f=m.bind({k:1});function x(e,t){let a=this||{};return function(){let s=arguments;function r(o,i){let l=Object.assign({},o),n=l.className||r.className;a.p=Object.assign({theme:g&&g()},l),a.o=/ *go\d+/.test(n),l.className=m.apply(a,s)+(n?" "+n:""),t&&(l.ref=i);let c=e;return e[0]&&(c=l.as||e,delete l.as),h&&c[0]&&h(l),u(c,l)}return t?t(r):r}}var v=(e,t)=>"function"==typeof e?e(t):e,y=(t=0,()=>(++t).toString()),b="default",j=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:s}=t;return j(e,{type:+!!e.toasts.find(e=>e.id===s.id),toast:s});case 3:let{toastId:r}=t;return{...e,toasts:e.toasts.map(e=>e.id===r||void 0===r?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let o=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+o}))}}},w=[],N={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},S={},C=(e,t=b)=>{S[t]=j(S[t]||N,e),w.forEach(([e,a])=>{e===t&&a(S[t])})},E=e=>Object.keys(S).forEach(t=>C(e,t)),$=(e=b)=>t=>{C(t,e)},A=e=>(t,a)=>{let s,r=((e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||y()}))(t,e,a);return $(r.toasterId||(s=r.id,Object.keys(S).find(e=>S[e].toasts.some(e=>e.id===s))))({type:2,toast:r}),r.id},T=(e,t)=>A("blank")(e,t);T.error=A("error"),T.success=A("success"),T.loading=A("loading"),T.custom=A("custom"),T.dismiss=(e,t)=>{let a={type:3,toastId:e};t?$(t)(a):E(a)},T.dismissAll=e=>T.dismiss(void 0,e),T.remove=(e,t)=>{let a={type:4,toastId:e};t?$(t)(a):E(a)},T.removeAll=e=>T.remove(void 0,e),T.promise=(e,t,a)=>{let s=T.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let r=t.success?v(t.success,e):void 0;return r?T.success(r,{id:s,...a,...null==a?void 0:a.success}):T.dismiss(s),e}).catch(e=>{let r=t.error?v(t.error,e):void 0;r?T.error(r,{id:s,...a,...null==a?void 0:a.error}):T.dismiss(s)}),e};var k=f`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,D=f`
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
}`,O=x("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${k} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${D} 0.15s ease-out forwards;
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
`,I=f`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,_=x("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${I} 1s linear infinite;
`,F=f`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,L=f`
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
}`,M=x("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${F} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${L} 0.2s ease-out forwards;
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
`,P=x("div")`
  position: absolute;
`,R=x("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,G=f`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,V=x("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${G} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,q=({toast:e})=>{let{icon:t,type:a,iconTheme:s}=e;return void 0!==t?"string"==typeof t?r.createElement(V,null,t):t:"blank"===a?null:r.createElement(R,null,r.createElement(_,{...s}),"loading"!==a&&r.createElement(P,null,"error"===a?r.createElement(O,{...s}):r.createElement(M,{...s})))},W=x("div")`
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
`,B=x("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`;r.memo(({toast:e,position:t,style:s,children:o})=>{let i=e.height?((e,t)=>{let s=e.includes("top")?1:-1,[r,o]=(()=>{if(void 0===a&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");a=!e||e.matches}return a})()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*s}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*s}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${f(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${f(o)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},l=r.createElement(q,{toast:e}),n=r.createElement(B,{...e.ariaProps},v(e.message,e));return r.createElement(W,{className:e.className,style:{...i,...s,...e.style}},"function"==typeof o?o({icon:l,message:n}):r.createElement(r.Fragment,null,l,n))}),s=r.createElement,c.p=void 0,u=s,g=void 0,h=void 0,m`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,e.s(["toast",()=>T],5766)},42609,e=>{"use strict";var t=e.i(43476),a=e.i(71645),s=e.i(5766);function r(){let e,[r,o]=(0,a.useState)(new Date().toISOString().split("T")[0]),[i,l]=(0,a.useState)([]),[n,c]=(0,a.useState)([]),[d,p]=(0,a.useState)([]),[m,u]=(0,a.useState)(!0),[g,h]=(0,a.useState)(!1),f=new Date,x=new Date(f.getFullYear(),f.getMonth(),1).toISOString().split("T")[0],v=new Date(f.getFullYear(),f.getMonth()+1,0).toISOString().split("T")[0],[y,b]=(0,a.useState)(x),[j,w]=(0,a.useState)(v),[N,S]=(0,a.useState)(""),[C,E]=(0,a.useState)(""),[$,A]=(0,a.useState)(""),[T,k]=(0,a.useState)("caja_chica"),[D,z]=(0,a.useState)(""),[O,I]=(0,a.useState)(""),[_,F]=(0,a.useState)(""),[L,M]=(0,a.useState)(""),[P,R]=(0,a.useState)(""),[G,V]=(0,a.useState)(null),q=n.find(e=>e.id===$)?.nombre.toLowerCase()==="vtv";async function W(){u(!0);try{let e=new URLSearchParams;y&&e.set("fechaDesde",y),j&&e.set("fechaHasta",j);let[t,a,s]=await Promise.all([fetch("/api/flota/vehiculos"),fetch("/api/reportes/categorias"),fetch(`/api/logistica/flota/gastos?${e.toString()}`)]),r=await t.json(),o=await a.json(),i=await s.json();l(Array.isArray(r)?r.filter(e=>e.activo):[]),c(Array.isArray(o)?o:[]),p(Array.isArray(i)?i:[])}catch(e){console.error("Error fetching data:",e),s.toast.error("Error al cargar datos")}finally{u(!1)}}(0,a.useEffect)(()=>{W()},[y,j]);let B=()=>{V(null),z(""),I(""),F(""),M(""),R("")};async function K(e){if(e.preventDefault(),!C||!$||!D||!T)return void s.toast.error("Completá todos los campos obligatorios");if(q&&!P&&!G)return void s.toast.error("Completá la fecha de vencimiento de la VTV");h(!0);try{let e=G?`/api/logistica/flota/gastos/${G}`:"/api/logistica/flota/gastos",t=await fetch(e,{method:G?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fecha:r,monto:D,descripcion:O,categoriaId:$,vehiculoId:C,kmVehiculo:_,taller:L,cajaTipo:T,vencimientoVtv:q?P:null})});if(!t.ok){let e=await t.json();throw Error(e.error)}s.toast.success(G?"Gasto actualizado":"Gasto registrado con éxito"),B(),W()}catch(e){s.toast.error(e.message||"Error al procesar el gasto")}finally{h(!1)}}async function U(e){if(confirm("¿Estás seguro de eliminar este gasto? El monto será devuelto a la caja de origen."))try{let t=await fetch(`/api/logistica/flota/gastos/${e}`,{method:"DELETE"});if(!t.ok){let e=await t.json();throw Error(e.error)}s.toast.success("Gasto eliminado y caja actualizada"),W()}catch(e){s.toast.error(e.message||"Error al eliminar el gasto")}}return(0,t.jsxs)("div",{className:"page-content",children:[(0,t.jsxs)("div",{className:"page-header",children:[(0,t.jsx)("h1",{className:"page-title",children:"Gastos de Flota"}),(0,t.jsx)("p",{style:{color:"var(--color-gray-500)",fontSize:"var(--text-sm)"},children:"Cargá gastos específicos vinculados a vehículos y descontá de caja automáticamente."})]}),(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"400px 1fr",gap:"var(--space-6)",alignItems:"start"},children:[(0,t.jsxs)("div",{className:"card shadow-sm",style:{padding:"var(--space-5)"},children:[(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"var(--space-4)"},children:[(0,t.jsx)("h2",{className:"card-title",style:{margin:0},children:G?"Editar Gasto":"Registrar Gasto"}),G&&(0,t.jsx)("button",{onClick:B,className:"btn btn-ghost btn-sm",children:"Cancelar"})]}),(0,t.jsxs)("form",{onSubmit:K,style:{display:"flex",flexDirection:"column",gap:"var(--space-4)"},children:[(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Fecha"}),(0,t.jsx)("input",{type:"date",className:"form-input",value:r,onChange:e=>o(e.target.value),required:!0})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Vehículo"}),(0,t.jsxs)("select",{className:"form-select",value:C,onChange:e=>E(e.target.value),required:!0,children:[(0,t.jsx)("option",{value:"",children:"Seleccionar vehículo..."}),i.map(e=>(0,t.jsx)("option",{value:e.id,children:e.alias?`${e.alias} (${e.patente})`:`${e.patente} - ${e.marca} ${e.modelo}`},e.id))]})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Categoría"}),(0,t.jsxs)("select",{className:"form-select",value:$,onChange:e=>A(e.target.value),required:!0,children:[(0,t.jsx)("option",{value:"",children:"Seleccionar categoría..."}),n.map(e=>(0,t.jsx)("option",{value:e.id,children:e.nombre},e.id))]})]}),q&&(0,t.jsxs)("div",{className:"form-group",style:{backgroundColor:"var(--color-success-light)",padding:"var(--space-3)",borderRadius:"var(--radius-md)",border:"1px solid var(--color-success)"},children:[(0,t.jsx)("label",{className:"form-label",style:{color:"var(--color-success-dark)",fontWeight:"bold"},children:"📅 Nuevo Vencimiento VTV"}),(0,t.jsx)("input",{type:"date",className:"form-input",value:P,onChange:e=>R(e.target.value),required:!0})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Caja de Origen"}),(0,t.jsxs)("select",{className:"form-select",value:T,onChange:e=>k(e.target.value),required:!0,children:[(0,t.jsx)("option",{value:"caja_chica",children:"Caja Chica (Efectivo)"}),(0,t.jsx)("option",{value:"caja_madre",children:"Caja Madre"}),(0,t.jsx)("option",{value:"mercado_pago",children:"Mercado Pago"}),(0,t.jsx)("option",{value:"mercado_pago_juani",children:"MP Juani"}),(0,t.jsx)("option",{value:"local",children:"Caja Local"})]})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Monto ($)"}),(0,t.jsx)("input",{type:"number",step:"0.01",className:"form-input",value:D,onChange:e=>z(e.target.value),placeholder:"0.00",required:!0})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Descripción / Novedad"}),(0,t.jsx)("textarea",{className:"form-input",rows:2,value:O,onChange:e=>I(e.target.value),placeholder:"Ej: Carga de Diesel, Cambio de aceite..."})]}),(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--space-3)"},children:[(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"KM (Opcional)"}),(0,t.jsx)("input",{type:"number",className:"form-input",value:_,onChange:e=>F(e.target.value),placeholder:"KM actual"})]}),(0,t.jsxs)("div",{className:"form-group",children:[(0,t.jsx)("label",{className:"form-label",children:"Taller (Opcional)"}),(0,t.jsx)("input",{type:"text",className:"form-input",value:L,onChange:e=>M(e.target.value),placeholder:"Nombre taller"})]})]}),(0,t.jsx)("button",{className:"btn btn-primary",type:"submit",disabled:g,style:{marginTop:"var(--space-2)"},children:g?"Procesando...":G?"💾 Guardar Cambios":"💰 Registrar Gasto"})]})]}),(0,t.jsxs)("div",{className:"card",children:[(0,t.jsxs)("div",{className:"card-header",style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"var(--space-2)"},children:[(0,t.jsx)("h2",{className:"card-title",style:{margin:0},children:"Últimos Gastos (Agrupados por Vehículo)"}),(0,t.jsxs)("div",{style:{display:"flex",gap:"var(--space-2)"},children:[(0,t.jsxs)("select",{className:"form-select",style:{padding:"4px 8px",fontSize:"12px",height:"32px",width:"auto"},value:N,onChange:e=>S(e.target.value),children:[(0,t.jsx)("option",{value:"",children:"Todas las categorías"}),n.map(e=>(0,t.jsx)("option",{value:e.id,children:e.nombre},e.id))]}),(0,t.jsx)("input",{type:"date",className:"form-input",style:{padding:"4px 8px",fontSize:"12px",height:"32px"},value:y,onChange:e=>b(e.target.value),title:"Fecha Desde"}),(0,t.jsx)("input",{type:"date",className:"form-input",style:{padding:"4px 8px",fontSize:"12px",height:"32px"},value:j,onChange:e=>w(e.target.value),title:"Fecha Hasta"})]})]}),(0,t.jsx)("div",{style:{padding:"var(--space-4)",display:"flex",flexDirection:"column",gap:"var(--space-4)"},children:m?(0,t.jsx)("p",{style:{textAlign:"center",padding:"var(--space-10)"},children:"Cargando historial..."}):0===d.length?(0,t.jsx)("p",{style:{textAlign:"center",padding:"var(--space-10)"},children:"No hay gastos registrados."}):0===(e=N?d.filter(e=>e.categoria.id===N):d).length?(0,t.jsx)("p",{style:{textAlign:"center",padding:"var(--space-10)"},children:"No hay gastos que coincidan con los filtros."}):Object.entries(e.reduce((e,t)=>{let a=t.vehiculo||{patente:"Desconocido",alias:""},s=a.alias?`${a.alias} (${a.patente})`:a.patente;return e[s]||(e[s]={items:[],total:0}),e[s].items.push(t),e[s].total+=t.monto,e},{})).map(([e,a])=>(0,t.jsxs)("div",{style:{border:"1px solid var(--color-gray-200)",borderRadius:"var(--radius-md)",overflow:"hidden"},children:[(0,t.jsxs)("div",{style:{backgroundColor:"var(--color-gray-50)",padding:"var(--space-3) var(--space-4)",borderBottom:"1px solid var(--color-gray-200)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[(0,t.jsxs)("h3",{style:{margin:0,fontSize:"var(--text-sm)",fontWeight:"bold"},children:["🚗 ",e]}),(0,t.jsxs)("span",{style:{fontWeight:"bold",color:"var(--color-danger)",fontSize:"var(--text-sm)"},children:["Total Agrupado: -$",a.total.toLocaleString("es-AR")]})]}),(0,t.jsx)("div",{className:"table-container",style:{border:"none",margin:0,borderRadius:0},children:(0,t.jsxs)("table",{className:"table table-sm",children:[(0,t.jsx)("thead",{children:(0,t.jsxs)("tr",{children:[(0,t.jsx)("th",{children:"Fecha"}),(0,t.jsx)("th",{children:"Categoría"}),(0,t.jsx)("th",{children:"Descripción / Novedad"}),(0,t.jsx)("th",{style:{textAlign:"right"},children:"Monto"}),(0,t.jsx)("th",{style:{textAlign:"right"}})]})}),(0,t.jsx)("tbody",{children:a.items.map(e=>(0,t.jsxs)("tr",{children:[(0,t.jsx)("td",{style:{fontSize:"var(--text-xs)"},children:new Date(e.fecha).toLocaleDateString("es-AR")}),(0,t.jsx)("td",{children:(0,t.jsx)("span",{className:"badge badge-outline",children:e.categoria.nombre})}),(0,t.jsxs)("td",{style:{fontSize:"var(--text-xs)",color:"var(--color-gray-600)"},children:[e.descripcion||"Sin descripción",e.taller&&(0,t.jsxs)("span",{style:{marginLeft:"6px",fontSize:"10px",color:"var(--color-primary)"},children:["🛠️ ",e.taller]})]}),(0,t.jsxs)("td",{style:{textAlign:"right",fontWeight:"bold",color:"var(--color-danger)"},children:["-$",e.monto.toLocaleString("es-AR")]}),(0,t.jsxs)("td",{style:{textAlign:"right",display:"flex",gap:"var(--space-1)",justifyContent:"flex-end"},children:[(0,t.jsx)("button",{onClick:()=>{V(e.id),o(new Date(e.fecha).toISOString().split("T")[0]),E(e.vehiculoId),A(e.categoriaId),z(e.monto.toString()),I(e.descripcion||""),F(e.kmVehiculo?.toString()||""),M(e.taller||""),window.scrollTo({top:0,behavior:"smooth"})},className:"btn btn-ghost btn-sm",style:{padding:"4px"},title:"Editar gasto",children:"✏️"}),(0,t.jsx)("button",{onClick:()=>U(e.id),className:"btn btn-ghost btn-sm",style:{color:"var(--color-danger)",padding:"4px"},title:"Eliminar gasto y devolver dinero a caja",children:"🗑️"})]})]},e.id))})]})})]},e))})]})]})]})}e.s(["default",()=>r])}]);