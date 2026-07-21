module.exports=[6704,a=>{"use strict";let b,c;var d,e=a.i(72131);let f={data:""},g=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,h=/\/\*[^]*?\*\/|  +/g,i=/\n+/g,j=(a,b)=>{let c="",d="",e="";for(let f in a){let g=a[f];"@"==f[0]?"i"==f[1]?c=f+" "+g+";":d+="f"==f[1]?j(g,f):f+"{"+j(g,"k"==f[1]?"":b)+"}":"object"==typeof g?d+=j(g,b?b.replace(/([^,])+/g,a=>f.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,b=>/&/.test(b)?b.replace(/&/g,a):a?a+" "+b:b)):f):null!=g&&(f=/^--/.test(f)?f:f.replace(/[A-Z]/g,"-$&").toLowerCase(),e+=j.p?j.p(f,g):f+":"+g+";")}return c+(b&&e?b+"{"+e+"}":e)+d},k={},l=a=>{if("object"==typeof a){let b="";for(let c in a)b+=c+l(a[c]);return b}return a};function m(a){let b,c,d=this||{},e=a.call?a(d.p):a;return((a,b,c,d,e)=>{var f;let m=l(a),n=k[m]||(k[m]=(a=>{let b=0,c=11;for(;b<a.length;)c=101*c+a.charCodeAt(b++)>>>0;return"go"+c})(m));if(!k[n]){let b=m!==a?a:(a=>{let b,c,d=[{}];for(;b=g.exec(a.replace(h,""));)b[4]?d.shift():b[3]?(c=b[3].replace(i," ").trim(),d.unshift(d[0][c]=d[0][c]||{})):d[0][b[1]]=b[2].replace(i," ").trim();return d[0]})(a);k[n]=j(e?{["@keyframes "+n]:b}:b,c?"":"."+n)}let o=c&&k.g?k.g:null;return c&&(k.g=k[n]),f=k[n],o?b.data=b.data.replace(o,f):-1===b.data.indexOf(f)&&(b.data=d?f+b.data:b.data+f),n})(e.unshift?e.raw?(b=[].slice.call(arguments,1),c=d.p,e.reduce((a,d,e)=>{let f=b[e];if(f&&f.call){let a=f(c),b=a&&a.props&&a.props.className||/^go/.test(a)&&a;f=b?"."+b:a&&"object"==typeof a?a.props?"":j(a,""):!1===a?"":a}return a+d+(null==f?"":f)},"")):e.reduce((a,b)=>Object.assign(a,b&&b.call?b(d.p):b),{}):e,d.target||f,d.g,d.o,d.k)}m.bind({g:1});let n,o,p,q=m.bind({k:1});function r(a,b){let c=this||{};return function(){let d=arguments;function e(f,g){let h=Object.assign({},f),i=h.className||e.className;c.p=Object.assign({theme:o&&o()},h),c.o=/ *go\d+/.test(i),h.className=m.apply(c,d)+(i?" "+i:""),b&&(h.ref=g);let j=a;return a[0]&&(j=h.as||a,delete h.as),p&&j[0]&&p(h),n(j,h)}return b?b(e):e}}var s=(a,b)=>"function"==typeof a?a(b):a,t=(b=0,()=>(++b).toString()),u="default",v=(a,b)=>{let{toastLimit:c}=a.settings;switch(b.type){case 0:return{...a,toasts:[b.toast,...a.toasts].slice(0,c)};case 1:return{...a,toasts:a.toasts.map(a=>a.id===b.toast.id?{...a,...b.toast}:a)};case 2:let{toast:d}=b;return v(a,{type:+!!a.toasts.find(a=>a.id===d.id),toast:d});case 3:let{toastId:e}=b;return{...a,toasts:a.toasts.map(a=>a.id===e||void 0===e?{...a,dismissed:!0,visible:!1}:a)};case 4:return void 0===b.toastId?{...a,toasts:[]}:{...a,toasts:a.toasts.filter(a=>a.id!==b.toastId)};case 5:return{...a,pausedAt:b.time};case 6:let f=b.time-(a.pausedAt||0);return{...a,pausedAt:void 0,toasts:a.toasts.map(a=>({...a,pauseDuration:a.pauseDuration+f}))}}},w=[],x={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},y={},z=(a,b=u)=>{y[b]=v(y[b]||x,a),w.forEach(([a,c])=>{a===b&&c(y[b])})},A=a=>Object.keys(y).forEach(b=>z(a,b)),B=(a=u)=>b=>{z(b,a)},C=a=>(b,c)=>{let d,e=((a,b="blank",c)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:b,ariaProps:{role:"status","aria-live":"polite"},message:a,pauseDuration:0,...c,id:(null==c?void 0:c.id)||t()}))(b,a,c);return B(e.toasterId||(d=e.id,Object.keys(y).find(a=>y[a].toasts.some(a=>a.id===d))))({type:2,toast:e}),e.id},D=(a,b)=>C("blank")(a,b);D.error=C("error"),D.success=C("success"),D.loading=C("loading"),D.custom=C("custom"),D.dismiss=(a,b)=>{let c={type:3,toastId:a};b?B(b)(c):A(c)},D.dismissAll=a=>D.dismiss(void 0,a),D.remove=(a,b)=>{let c={type:4,toastId:a};b?B(b)(c):A(c)},D.removeAll=a=>D.remove(void 0,a),D.promise=(a,b,c)=>{let d=D.loading(b.loading,{...c,...null==c?void 0:c.loading});return"function"==typeof a&&(a=a()),a.then(a=>{let e=b.success?s(b.success,a):void 0;return e?D.success(e,{id:d,...c,...null==c?void 0:c.success}):D.dismiss(d),a}).catch(a=>{let e=b.error?s(b.error,a):void 0;e?D.error(e,{id:d,...c,...null==c?void 0:c.error}):D.dismiss(d)}),a};var E=q`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,F=q`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,G=q`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,H=r("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${a=>a.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${E} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${F} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${a=>a.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${G} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,I=q`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,J=r("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${a=>a.secondary||"#e0e0e0"};
  border-right-color: ${a=>a.primary||"#616161"};
  animation: ${I} 1s linear infinite;
`,K=q`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,L=q`
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
}`,M=r("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${a=>a.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${K} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
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
    border-color: ${a=>a.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,N=r("div")`
  position: absolute;
`,O=r("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,P=q`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Q=r("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${P} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,R=({toast:a})=>{let{icon:b,type:c,iconTheme:d}=a;return void 0!==b?"string"==typeof b?e.createElement(Q,null,b):b:"blank"===c?null:e.createElement(O,null,e.createElement(J,{...d}),"loading"!==c&&e.createElement(N,null,"error"===c?e.createElement(H,{...d}):e.createElement(M,{...d})))},S=r("div")`
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
`,T=r("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`;e.memo(({toast:a,position:b,style:d,children:f})=>{let g=a.height?((a,b)=>{let d=a.includes("top")?1:-1,[e,f]=c?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*d}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*d}%,-1px) scale(.6); opacity:0;}
`];return{animation:b?`${q(e)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${q(f)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(a.position||b||"top-center",a.visible):{opacity:0},h=e.createElement(R,{toast:a}),i=e.createElement(T,{...a.ariaProps},s(a.message,a));return e.createElement(S,{className:a.className,style:{...g,...d,...a.style}},"function"==typeof f?f({icon:h,message:i}):e.createElement(e.Fragment,null,h,i))}),d=e.createElement,j.p=void 0,n=d,o=void 0,p=void 0,m`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,a.s(["toast",()=>D],6704)},31408,a=>{"use strict";var b=a.i(87924),c=a.i(72131),d=a.i(6704);function e({chofer:a,onClose:e,onSuccess:f}){let[g,h]=(0,c.useState)(!1),[i,j]=(0,c.useState)(a.documentos?.[0]?.fechaVencimiento?new Date(a.documentos[0].fechaVencimiento).toISOString().split("T")[0]:""),[k,l]=(0,c.useState)(null),[m,n]=(0,c.useState)(a.documentos?.[0]?.diasAviso?.toString()||"30"),[o,p]=(0,c.useState)(a.documentos?.[0]?.observaciones||""),q=async b=>{if(b.preventDefault(),!k&&!a.documentos?.[0])return void d.toast.error("Debes subir el archivo del carnet");h(!0);try{let b=new FormData;b.append("empleadoId",a.id),b.append("tipoDocumento","LICENCIA_CONDUCIR"),i&&b.append("fechaVencimiento",i),m&&b.append("diasAviso",m),o&&b.append("observaciones",o),k&&b.append("file",k);let c=await fetch("/api/documentos-empleado",{method:"POST",body:b});if(!c.ok){let a=await c.json();throw Error(a.error||"Error al subir documento")}d.toast.success("Licencia actualizada correctamente"),f(),e()}catch(a){console.error("Error uploading license:",a),d.toast.error(a.message)}finally{h(!1)}};return(0,b.jsx)("div",{className:"modal-overlay",children:(0,b.jsxs)("div",{className:"modal",style:{maxWidth:"500px"},children:[(0,b.jsxs)("div",{className:"modal-header",children:[(0,b.jsxs)("h2",{children:["Actualizar Licencia: ",a.nombre," ",a.apellido]}),(0,b.jsx)("button",{onClick:e,className:"btn btn-ghost",children:"✕"})]}),(0,b.jsxs)("form",{onSubmit:q,children:[(0,b.jsxs)("div",{className:"modal-body",style:{display:"flex",flexDirection:"column",gap:"var(--space-4)"},children:[(0,b.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--space-4)"},children:[(0,b.jsxs)("div",{className:"form-group",children:[(0,b.jsx)("label",{className:"form-label",children:"Fecha de Vencimiento"}),(0,b.jsx)("input",{type:"date",className:"form-input",value:i,onChange:a=>j(a.target.value),required:!0})]}),(0,b.jsxs)("div",{className:"form-group",children:[(0,b.jsx)("label",{className:"form-label",children:"Días de Aviso"}),(0,b.jsx)("input",{type:"number",className:"form-input",value:m,onChange:a=>n(a.target.value),placeholder:"Ej: 30",required:!0})]})]}),(0,b.jsxs)("div",{className:"form-group",children:[(0,b.jsx)("label",{className:"form-label",children:"Archivo del Carnet (Imagen o PDF)"}),(0,b.jsx)("input",{type:"file",className:"form-input",onChange:a=>l(a.target.files?.[0]||null),accept:"image/*,.pdf",required:!a.documentos?.[0]}),a.documentos?.[0]&&(0,b.jsx)("p",{style:{fontSize:"var(--text-xs)",color:"var(--color-gray-500)",marginTop:"4px"},children:"Ya existe un archivo cargado. Subí uno nuevo para reemplazarlo."})]}),(0,b.jsxs)("div",{className:"form-group",children:[(0,b.jsx)("label",{className:"form-label",children:"Observaciones"}),(0,b.jsx)("textarea",{className:"form-input",value:o,onChange:a=>p(a.target.value),placeholder:"Ej: Categoría E1, requiere anteojos...",rows:3})]})]}),(0,b.jsxs)("div",{className:"modal-footer",children:[(0,b.jsx)("button",{type:"button",onClick:e,className:"btn btn-ghost",disabled:g,children:"Cancelar"}),(0,b.jsx)("button",{type:"submit",className:"btn btn-primary",disabled:g,children:g?"Guardando...":"💾 Guardar Cambios"})]})]})]})})}var f=a.i(38246);function g(){let[a,g]=(0,c.useState)([]),[h,i]=(0,c.useState)(!0),[j,k]=(0,c.useState)(null);async function l(){try{let a=await fetch("/api/logistica/choferes"),b=await a.json();g(b)}catch(a){console.error("Error fetching choferes:",a),d.toast.error("Error al cargar choferes")}finally{i(!1)}}return(0,c.useEffect)(()=>{l()},[]),(0,b.jsxs)("div",{className:"page-content",children:[(0,b.jsxs)("div",{className:"page-header",children:[(0,b.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-3)"},children:(0,b.jsx)("h1",{className:"page-title",children:"Administración de Choferes"})}),(0,b.jsx)("div",{className:"page-actions",children:(0,b.jsx)(f.default,{href:"/logistica",className:"btn btn-ghost",children:"← Volver"})})]}),(0,b.jsxs)("div",{className:"card shadow-sm",children:[(0,b.jsx)("div",{className:"card-header",children:(0,b.jsx)("h2",{className:"card-title",children:"Listado de Personal de Logística"})}),(0,b.jsx)("div",{className:"table-container",children:(0,b.jsxs)("table",{className:"table",children:[(0,b.jsx)("thead",{children:(0,b.jsxs)("tr",{children:[(0,b.jsx)("th",{children:"Nombre y Apellido"}),(0,b.jsx)("th",{children:"Vencimiento Licencia"}),(0,b.jsx)("th",{children:"Estado"}),(0,b.jsx)("th",{style:{textAlign:"right"},children:"Acciones"})]})}),(0,b.jsx)("tbody",{children:h?(0,b.jsx)("tr",{children:(0,b.jsx)("td",{colSpan:4,style:{textAlign:"center",padding:"var(--space-10)"},children:"Cargando choferes..."})}):0===a.length?(0,b.jsx)("tr",{children:(0,b.jsx)("td",{colSpan:4,style:{textAlign:"center",padding:"var(--space-10)"},children:"No se encontraron empleados con rol Logística."})}):a.map(a=>{let c=a.documentos?.[0],d=((a,b=30)=>{if(!a)return{label:"PENDIENTE",color:"var(--color-gray-500)",bg:"var(--color-gray-100)"};let c=new Date(a),d=new Date,e=Math.ceil((c.getTime()-d.getTime())/864e5);return e<0?{label:"VENCIDO",color:"var(--color-danger)",bg:"var(--color-danger-light)"}:e<=b?{label:`VENCE EN ${e} D\xcdAS`,color:"var(--color-warning-dark)",bg:"var(--color-warning-light)"}:{label:"AL DÍA",color:"var(--color-success)",bg:"var(--color-success-light)"}})(c?.fechaVencimiento,c?.diasAviso);return(0,b.jsxs)("tr",{children:[(0,b.jsxs)("td",{style:{fontWeight:"bold"},children:[a.nombre," ",a.apellido]}),(0,b.jsx)("td",{children:c?.fechaVencimiento?new Date(c.fechaVencimiento).toLocaleDateString("es-AR"):"Sin registrar"}),(0,b.jsx)("td",{children:(0,b.jsx)("span",{style:{padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:"bold",color:d.color,backgroundColor:d.bg},children:d.label})}),(0,b.jsx)("td",{style:{textAlign:"right"},children:(0,b.jsxs)("div",{style:{display:"flex",gap:"var(--space-2)",justifyContent:"flex-end"},children:[c?.archivoUrl&&(0,b.jsx)("a",{href:c.archivoUrl,target:"_blank",rel:"noopener noreferrer",className:"btn btn-ghost btn-sm",title:"Ver documento actual",children:"👁️ Ver"}),(0,b.jsxs)("button",{onClick:()=>k(a),className:"btn btn-outline btn-sm",children:["🪪 ",c?"Actualizar":"Cargar"," Licencia"]})]})})]},a.id)})})]})})]}),j&&(0,b.jsx)(e,{chofer:j,onClose:()=>k(null),onSuccess:l})]})}a.s(["default",()=>g],31408)}];

//# sourceMappingURL=_988e98f5._.js.map