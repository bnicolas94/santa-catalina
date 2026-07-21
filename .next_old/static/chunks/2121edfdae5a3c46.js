(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,5766,e=>{"use strict";let t,a;var s,r=e.i(71645);let o={data:""},i=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,n=/\/\*[^]*?\*\/|  +/g,l=/\n+/g,d=(e,t)=>{let a="",s="",r="";for(let o in e){let i=e[o];"@"==o[0]?"i"==o[1]?a=o+" "+i+";":s+="f"==o[1]?d(i,o):o+"{"+d(i,"k"==o[1]?"":t)+"}":"object"==typeof i?s+=d(i,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=i&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),r+=d.p?d.p(o,i):o+":"+i+";")}return a+(t&&r?t+"{"+r+"}":r)+s},c={},u=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+u(e[a]);return t}return e};function p(e){let t,a,s=this||{},r=e.call?e(s.p):e;return((e,t,a,s,r)=>{var o;let p=u(e),m=c[p]||(c[p]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(p));if(!c[m]){let t=p!==e?e:(e=>{let t,a,s=[{}];for(;t=i.exec(e.replace(n,""));)t[4]?s.shift():t[3]?(a=t[3].replace(l," ").trim(),s.unshift(s[0][a]=s[0][a]||{})):s[0][t[1]]=t[2].replace(l," ").trim();return s[0]})(e);c[m]=d(r?{["@keyframes "+m]:t}:t,a?"":"."+m)}let h=a&&c.g?c.g:null;return a&&(c.g=c[m]),o=c[m],h?t.data=t.data.replace(h,o):-1===t.data.indexOf(o)&&(t.data=s?o+t.data:t.data+o),m})(r.unshift?r.raw?(t=[].slice.call(arguments,1),a=s.p,r.reduce((e,s,r)=>{let o=t[r];if(o&&o.call){let e=o(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":d(e,""):!1===e?"":e}return e+s+(null==o?"":o)},"")):r.reduce((e,t)=>Object.assign(e,t&&t.call?t(s.p):t),{}):r,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||o})(s.target),s.g,s.o,s.k)}p.bind({g:1});let m,h,f,g=p.bind({k:1});function x(e,t){let a=this||{};return function(){let s=arguments;function r(o,i){let n=Object.assign({},o),l=n.className||r.className;a.p=Object.assign({theme:h&&h()},n),a.o=/ *go\d+/.test(l),n.className=p.apply(a,s)+(l?" "+l:""),t&&(n.ref=i);let d=e;return e[0]&&(d=n.as||e,delete n.as),f&&d[0]&&f(n),m(d,n)}return t?t(r):r}}var v=(e,t)=>"function"==typeof e?e(t):e,y=(t=0,()=>(++t).toString()),b="default",j=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:s}=t;return j(e,{type:+!!e.toasts.find(e=>e.id===s.id),toast:s});case 3:let{toastId:r}=t;return{...e,toasts:e.toasts.map(e=>e.id===r||void 0===r?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let o=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+o}))}}},S=[],w={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},_={},N=(e,t=b)=>{_[t]=j(_[t]||w,e),S.forEach(([e,a])=>{e===t&&a(_[t])})},C=e=>Object.keys(_).forEach(t=>N(e,t)),R=(e=b)=>t=>{N(t,e)},$=e=>(t,a)=>{let s,r=((e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||y()}))(t,e,a);return R(r.toasterId||(s=r.id,Object.keys(_).find(e=>_[e].toasts.some(e=>e.id===s))))({type:2,toast:r}),r.id},k=(e,t)=>$("blank")(e,t);k.error=$("error"),k.success=$("success"),k.loading=$("loading"),k.custom=$("custom"),k.dismiss=(e,t)=>{let a={type:3,toastId:e};t?R(t)(a):C(a)},k.dismissAll=e=>k.dismiss(void 0,e),k.remove=(e,t)=>{let a={type:4,toastId:e};t?R(t)(a):C(a)},k.removeAll=e=>k.remove(void 0,e),k.promise=(e,t,a)=>{let s=k.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let r=t.success?v(t.success,e):void 0;return r?k.success(r,{id:s,...a,...null==a?void 0:a.success}):k.dismiss(s),e}).catch(e=>{let r=t.error?v(t.error,e):void 0;r?k.error(r,{id:s,...a,...null==a?void 0:a.error}):k.dismiss(s)}),e};var z=g`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,E=g`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,F=g`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,T=x("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${z} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${E} 0.15s ease-out forwards;
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
    animation: ${F} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,A=g`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,I=x("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${A} 1s linear infinite;
`,L=g`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,O=g`
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
}`,P=x("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${L} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${O} 0.2s ease-out forwards;
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
`,D=x("div")`
  position: absolute;
`,M=x("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,B=g`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,q=x("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${B} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,H=({toast:e})=>{let{icon:t,type:a,iconTheme:s}=e;return void 0!==t?"string"==typeof t?r.createElement(q,null,t):t:"blank"===a?null:r.createElement(M,null,r.createElement(I,{...s}),"loading"!==a&&r.createElement(D,null,"error"===a?r.createElement(T,{...s}):r.createElement(P,{...s})))},U=x("div")`
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
`,Y=x("div")`
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
`];return{animation:t?`${g(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${g(o)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},n=r.createElement(H,{toast:e}),l=r.createElement(Y,{...e.ariaProps},v(e.message,e));return r.createElement(U,{className:e.className,style:{...i,...s,...e.style}},"function"==typeof o?o({icon:n,message:l}):r.createElement(r.Fragment,null,n,l))}),s=r.createElement,d.p=void 0,m=s,h=void 0,f=void 0,p`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,e.s(["toast",()=>k],5766)},16015,(e,t,a)=>{},98547,(e,t,a)=>{var s=e.i(47167);e.r(16015);var r=e.r(71645),o=r&&"object"==typeof r&&"default"in r?r:{default:r},i=void 0!==s.default&&s.default.env&&!0,n=function(e){return"[object String]"===Object.prototype.toString.call(e)},l=function(){function e(e){var t=void 0===e?{}:e,a=t.name,s=void 0===a?"stylesheet":a,r=t.optimizeForSpeed,o=void 0===r?i:r;d(n(s),"`name` must be a string"),this._name=s,this._deletedRulePlaceholder="#"+s+"-deleted-rule____{}",d("boolean"==typeof o,"`optimizeForSpeed` must be a boolean"),this._optimizeForSpeed=o,this._serverSheet=void 0,this._tags=[],this._injected=!1,this._rulesCount=0;var l="u">typeof window&&document.querySelector('meta[property="csp-nonce"]');this._nonce=l?l.getAttribute("content"):null}var t,a=e.prototype;return a.setOptimizeForSpeed=function(e){d("boolean"==typeof e,"`setOptimizeForSpeed` accepts a boolean"),d(0===this._rulesCount,"optimizeForSpeed cannot be when rules have already been inserted"),this.flush(),this._optimizeForSpeed=e,this.inject()},a.isOptimizeForSpeed=function(){return this._optimizeForSpeed},a.inject=function(){var e=this;if(d(!this._injected,"sheet already injected"),this._injected=!0,"u">typeof window&&this._optimizeForSpeed){this._tags[0]=this.makeStyleTag(this._name),this._optimizeForSpeed="insertRule"in this.getSheet(),this._optimizeForSpeed||(i||console.warn("StyleSheet: optimizeForSpeed mode not supported falling back to standard mode."),this.flush(),this._injected=!0);return}this._serverSheet={cssRules:[],insertRule:function(t,a){return"number"==typeof a?e._serverSheet.cssRules[a]={cssText:t}:e._serverSheet.cssRules.push({cssText:t}),a},deleteRule:function(t){e._serverSheet.cssRules[t]=null}}},a.getSheetForTag=function(e){if(e.sheet)return e.sheet;for(var t=0;t<document.styleSheets.length;t++)if(document.styleSheets[t].ownerNode===e)return document.styleSheets[t]},a.getSheet=function(){return this.getSheetForTag(this._tags[this._tags.length-1])},a.insertRule=function(e,t){if(d(n(e),"`insertRule` accepts only strings"),"u"<typeof window)return"number"!=typeof t&&(t=this._serverSheet.cssRules.length),this._serverSheet.insertRule(e,t),this._rulesCount++;if(this._optimizeForSpeed){var a=this.getSheet();"number"!=typeof t&&(t=a.cssRules.length);try{a.insertRule(e,t)}catch(t){return i||console.warn("StyleSheet: illegal rule: \n\n"+e+"\n\nSee https://stackoverflow.com/q/20007992 for more info"),-1}}else{var s=this._tags[t];this._tags.push(this.makeStyleTag(this._name,e,s))}return this._rulesCount++},a.replaceRule=function(e,t){if(this._optimizeForSpeed||"u"<typeof window){var a="u">typeof window?this.getSheet():this._serverSheet;if(t.trim()||(t=this._deletedRulePlaceholder),!a.cssRules[e])return e;a.deleteRule(e);try{a.insertRule(t,e)}catch(s){i||console.warn("StyleSheet: illegal rule: \n\n"+t+"\n\nSee https://stackoverflow.com/q/20007992 for more info"),a.insertRule(this._deletedRulePlaceholder,e)}}else{var s=this._tags[e];d(s,"old rule at index `"+e+"` not found"),s.textContent=t}return e},a.deleteRule=function(e){if("u"<typeof window)return void this._serverSheet.deleteRule(e);if(this._optimizeForSpeed)this.replaceRule(e,"");else{var t=this._tags[e];d(t,"rule at index `"+e+"` not found"),t.parentNode.removeChild(t),this._tags[e]=null}},a.flush=function(){this._injected=!1,this._rulesCount=0,"u">typeof window?(this._tags.forEach(function(e){return e&&e.parentNode.removeChild(e)}),this._tags=[]):this._serverSheet.cssRules=[]},a.cssRules=function(){var e=this;return"u"<typeof window?this._serverSheet.cssRules:this._tags.reduce(function(t,a){return a?t=t.concat(Array.prototype.map.call(e.getSheetForTag(a).cssRules,function(t){return t.cssText===e._deletedRulePlaceholder?null:t})):t.push(null),t},[])},a.makeStyleTag=function(e,t,a){t&&d(n(t),"makeStyleTag accepts only strings as second parameter");var s=document.createElement("style");this._nonce&&s.setAttribute("nonce",this._nonce),s.type="text/css",s.setAttribute("data-"+e,""),t&&s.appendChild(document.createTextNode(t));var r=document.head||document.getElementsByTagName("head")[0];return a?r.insertBefore(s,a):r.appendChild(s),s},t=[{key:"length",get:function(){return this._rulesCount}}],function(e,t){for(var a=0;a<t.length;a++){var s=t[a];s.enumerable=s.enumerable||!1,s.configurable=!0,"value"in s&&(s.writable=!0),Object.defineProperty(e,s.key,s)}}(e.prototype,t),e}();function d(e,t){if(!e)throw Error("StyleSheet: "+t+".")}var c=function(e){for(var t=5381,a=e.length;a;)t=33*t^e.charCodeAt(--a);return t>>>0},u={};function p(e,t){if(!t)return"jsx-"+e;var a=String(t),s=e+a;return u[s]||(u[s]="jsx-"+c(e+"-"+a)),u[s]}function m(e,t){"u"<typeof window&&(t=t.replace(/\/style/gi,"\\/style"));var a=e+t;return u[a]||(u[a]=t.replace(/__jsx-style-dynamic-selector/g,e)),u[a]}var h=function(){function e(e){var t=void 0===e?{}:e,a=t.styleSheet,s=void 0===a?null:a,r=t.optimizeForSpeed,o=void 0!==r&&r;this._sheet=s||new l({name:"styled-jsx",optimizeForSpeed:o}),this._sheet.inject(),s&&"boolean"==typeof o&&(this._sheet.setOptimizeForSpeed(o),this._optimizeForSpeed=this._sheet.isOptimizeForSpeed()),this._fromServer=void 0,this._indices={},this._instancesCounts={}}var t=e.prototype;return t.add=function(e){var t=this;void 0===this._optimizeForSpeed&&(this._optimizeForSpeed=Array.isArray(e.children),this._sheet.setOptimizeForSpeed(this._optimizeForSpeed),this._optimizeForSpeed=this._sheet.isOptimizeForSpeed()),"u">typeof window&&!this._fromServer&&(this._fromServer=this.selectFromServer(),this._instancesCounts=Object.keys(this._fromServer).reduce(function(e,t){return e[t]=0,e},{}));var a=this.getIdAndRules(e),s=a.styleId,r=a.rules;if(s in this._instancesCounts){this._instancesCounts[s]+=1;return}var o=r.map(function(e){return t._sheet.insertRule(e)}).filter(function(e){return -1!==e});this._indices[s]=o,this._instancesCounts[s]=1},t.remove=function(e){var t=this,a=this.getIdAndRules(e).styleId;if(function(e,t){if(!e)throw Error("StyleSheetRegistry: "+t+".")}(a in this._instancesCounts,"styleId: `"+a+"` not found"),this._instancesCounts[a]-=1,this._instancesCounts[a]<1){var s=this._fromServer&&this._fromServer[a];s?(s.parentNode.removeChild(s),delete this._fromServer[a]):(this._indices[a].forEach(function(e){return t._sheet.deleteRule(e)}),delete this._indices[a]),delete this._instancesCounts[a]}},t.update=function(e,t){this.add(t),this.remove(e)},t.flush=function(){this._sheet.flush(),this._sheet.inject(),this._fromServer=void 0,this._indices={},this._instancesCounts={}},t.cssRules=function(){var e=this,t=this._fromServer?Object.keys(this._fromServer).map(function(t){return[t,e._fromServer[t]]}):[],a=this._sheet.cssRules();return t.concat(Object.keys(this._indices).map(function(t){return[t,e._indices[t].map(function(e){return a[e].cssText}).join(e._optimizeForSpeed?"":"\n")]}).filter(function(e){return!!e[1]}))},t.styles=function(e){var t,a;return t=this.cssRules(),void 0===(a=e)&&(a={}),t.map(function(e){var t=e[0],s=e[1];return o.default.createElement("style",{id:"__"+t,key:"__"+t,nonce:a.nonce?a.nonce:void 0,dangerouslySetInnerHTML:{__html:s}})})},t.getIdAndRules=function(e){var t=e.children,a=e.dynamic,s=e.id;if(a){var r=p(s,a);return{styleId:r,rules:Array.isArray(t)?t.map(function(e){return m(r,e)}):[m(r,t)]}}return{styleId:p(s),rules:Array.isArray(t)?t:[t]}},t.selectFromServer=function(){return Array.prototype.slice.call(document.querySelectorAll('[id^="__jsx-"]')).reduce(function(e,t){return e[t.id.slice(2)]=t,e},{})},e}(),f=r.createContext(null);function g(){return new h}function x(){return r.useContext(f)}f.displayName="StyleSheetContext";var v=o.default.useInsertionEffect||o.default.useLayoutEffect,y="u">typeof window?g():void 0;function b(e){var t=y||x();return t&&("u"<typeof window?t.add(e):v(function(){return t.add(e),function(){t.remove(e)}},[e.id,String(e.dynamic)])),null}b.dynamic=function(e){return e.map(function(e){return p(e[0],e[1])}).join(" ")},a.StyleRegistry=function(e){var t=e.registry,a=e.children,s=r.useContext(f),i=r.useState(function(){return s||t||g()})[0];return o.default.createElement(f.Provider,{value:i},a)},a.createStyleRegistry=g,a.style=b,a.useStyleRegistry=x},37902,(e,t,a)=>{t.exports=e.r(98547).style},76460,e=>{"use strict";let t=null,a=null;async function s(e){try{let t=await fetch(e);if(!t.ok)throw Error(`Failed to fetch image: ${t.statusText}`);let a=await t.blob();return new Promise(t=>{let s=new FileReader;s.onloadend=()=>{t(s.result)},s.onerror=()=>{t(e)},s.readAsDataURL(a)})}catch(t){return console.error("Error converting image to base64:",t),e}}async function r(){let e=window.location.origin;return t||(t=await s(`${e}/images/logo.png`)),a||(a=await s(`${e}/images/logo-watermark.png`)),{logo:t,watermark:a}}e.s(["getPrintLogos",()=>r])},5208,35695,e=>{"use strict";var t=e.i(43476),a=e.i(37902),s=e.i(71645);function r(e){let t=Math.floor(e),a=Math.round((e-t)*100),s=function e(t){let a=["","un","dos","tres","cuatro","cinco","seis","siete","ocho","nueve"];if(0===t)return"cero";if(100===t)return"cien";let s="";if(t>=1e6){let a=Math.floor(t/1e6);s+=1===a?"un millón ":e(a)+" millones ",t%=1e6}if(t>=1e3){let a=Math.floor(t/1e3);s+=1===a?"mil ":e(a)+" mil ",t%=1e3}return t>=100&&(s+=["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"][Math.floor(t/100)]+" ",t%=100),t>=20?(s+=["","diez","veinte","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"][Math.floor(t/10)],t%10!=0&&(s+=" y "+a[t%10])):t>=10?s+=["diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve"][t-10]:t>0&&(s+=a[t]),s.trim().toLowerCase()}(t);return a>0?`${s} con ${a}/100`:s}e.s(["formatCurrencyToWords",()=>r],35695);var o=e.i(76460);function i({empleado:e,onClose:i,onSuccess:n}){let[l,d]=(0,s.useState)(""),[c,u]=(0,s.useState)(""),[p,m]=(0,s.useState)(""),[h,f]=(0,s.useState)(""),[g,x]=(0,s.useState)(""),[v,y]=(0,s.useState)([]),[b,j]=(0,s.useState)([]),[S,w]=(0,s.useState)([]),[_,N]=(0,s.useState)(""),[C,R]=(0,s.useState)(""),[$,k]=(0,s.useState)(()=>{let e=new Date,t=e.getDay(),a=e.getDate()-t+(0===t?-6:1);return e.setDate(a),e.toISOString().split("T")[0]}),[z,E]=(0,s.useState)(()=>{let e=new Date,t=e.getDay(),a=e.getDate()-t+7*(0!==t);return e.setDate(a),e.toISOString().split("T")[0]}),[F,T]=(0,s.useState)(new Date().toISOString().split("T")[0]),[A,I]=(0,s.useState)([]),[L,O]=(0,s.useState)("caja_madre"),[P,D]=(0,s.useState)(!1);(0,s.useEffect)(()=>{let t=async()=>{let e=await fetch("/api/licencias");y((await e.json()).filter(e=>e.activo))},a=async()=>{let e=await fetch("/api/conceptos-salariales");j((await e.json()).filter(e=>e.activo))};if((async()=>{let e=await fetch("/api/caja/saldos"),t=await e.json();I([{id:"caja_madre",nombre:"Caja Madre",saldo:t.cajaMadre?.saldo||0},{id:"caja_chica",nombre:"Caja Chica",saldo:t.cajaChica?.saldo||0},{id:"local",nombre:"Caja Local",saldo:t.local?.saldo||0}])})(),t(),a(),e){let t=e.rolRel?.jornal||0,a=e.sueldoBaseMensual||0,s=t>0?t:a;t<=0&&a>0&&("SEMANAL"===e.cicloPago?s=a/4.3:"QUINCENAL"===e.cicloPago&&(s=a/2)),d(Math.round(s))}},[e]);let M=e?.valorHoraExtra&&e.valorHoraExtra>0?e.valorHoraExtra:e?.rolRel?.valorHoraExtra||0,B=Number(l)||0,q=Number(p)||0,H=Number(h)||0,U=B+q+S.reduce((e,t)=>e+t.montoCalculado,0)-H,Y=async()=>{if(!(U<=0)||confirm("El total es 0 o negativo. ¿Deseas continuar?")){D(!0);try{let t=await fetch("/api/liquidaciones",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({empleadoId:e.id,periodo:`Express ${$.split("-").reverse().join("/")} - ${z.split("-").reverse().join("/")}`,fechaInicio:`${$}T00:00:00.000Z`,fechaFin:`${z}T23:59:59.999Z`,cajaId:L,concepto:"pago_sueldo",manualData:{sueldoBase:B,horasExtras:Number(c)||0,montoHsExtras:q,descuentoPrestamos:H,diasTrabajados:6},adicionales:S.map(e=>({conceptoSalarialId:e.conceptoSalarialId,montoCalculado:e.montoCalculado,detalle:"Manual Express"}))})});if(t.ok){let e=await t.json();G(e),n(),i()}else{let e=await t.json();alert(e.error||"Error al guardar liquidación")}}catch(e){console.error(e),alert("Error en la petición")}finally{D(!1)}}},G=async t=>{let a=new Date(F+"T12:00:00"),s=a.getDate(),i=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][a.getMonth()],n=a.getFullYear(),l=$.split("-").reverse().join("/"),d=`${z.split("-")[2]}/${z.split("-")[1]}/${z.split("-")[0]}`,c=r(B),u=r(q),p=B+q,m=r(p),{logo:h,watermark:f}=await (0,o.getPrintLogos)(),x=v.find(e=>e.id===g),y=x?` Asimismo, se contemplan d\xedas correspondientes a licencia por ${x.nombre}.`:"",b=`
            <html>
            <head>
                <title>Recibo de Sueldo Express</title>
                <style>
                    @page { size: A4; margin: 20mm; }
                    body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #000; padding: 20px; font-size: 14pt; }
                    .recibo-container { border: 1px solid #eee; padding: 40px; max-width: 800px; margin: 0 auto; position: relative; z-index: 1; background: transparent !important; }
                    .watermark {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 80%;
                        max-width: 500px;
                        height: auto;
                        opacity: 0.35; /* Opacidad aumentada a pedido del usuario */
                        z-index: 0;   /* Ya no est\xe1 detr\xe1s del fondo, sino encima pero debajo del texto (z-index: 1) */
                        pointer-events: none;
                    }
                    .header { margin-bottom: 40px; position: relative; z-index: 10; }
                    .texto { text-align: justify; margin-bottom: 60px; position: relative; z-index: 10; }
                    .firma-section { display: flex; flex-direction: column; align-items: flex-end; gap: 20px; margin-top: 80px; position: relative; z-index: 10; }
                    .firma-line { border-top: 1px solid #000; width: 250px; text-align: center; padding-top: 5px; }
                    .data-label { font-weight: bold; }
                    .amount { font-weight: bold; }
                    @media print { 
                        .no-print { display: none; } 
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                </style>
            </head>
            <body>
                <div class="recibo-container">
                    <img src="${f}" class="watermark" alt="Logo Santa Catalina" />
                    
                    <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <img src="${h}" style="height: 60px;" />
                        <p>Berazategui, ${s} de ${i} de ${n}</p>
                    </div>

                    <div class="texto">
                        Recibo la cantidad de <span class="amount">$${B.toLocaleString()}</span> 
                        (pesos ${c}) en concepto de pago por semana laboral y 
                        <span class="amount">$${q.toLocaleString()}</span> 
                        (pesos ${u}) en concepto de horas extras al 100% m\xe1s de su valor 
                        del <span class="data-label">${l}</span> al <span class="data-label">${d}</span>.${y} 
                        Recibiendo un total de <span class="amount">$${p.toLocaleString()}</span> 
                        (pesos ${m}).
                    </div>

                    <div class="firma-section">
                        <div class="firma-line">Firma</div>
                        <div style="width: 250px;">Aclaraci\xf3n: ${e.nombre} ${e.apellido||""}</div>
                        <div style="width: 250px;">D.N.I: ${e.dni||""}</div>
                    </div>
                </div>
                <script>
                    window.onload = () => {
                        const images = document.querySelectorAll('img');
                        let loaded = 0;
                        if (images.length === 0) return window.print();
                        images.forEach(img => {
                            if (img.complete) {
                                loaded++;
                                if (loaded === images.length) window.print();
                            } else {
                                img.addEventListener('load', () => {
                                    loaded++;
                                    if (loaded === images.length) window.print();
                                });
                                img.addEventListener('error', () => {
                                    loaded++;
                                    if (loaded === images.length) window.print();
                                });
                            }
                        });
                    }
                </script>
            </body>
            </html>
        `,j=window.open("","_blank");j&&(j.document.write(b),j.document.close())};return(0,t.jsxs)("div",{onClick:i,className:"jsx-1744d2731d4e85d9 modal-overlay",children:[(0,t.jsxs)("div",{onClick:e=>e.stopPropagation(),style:{width:"500px"},className:"jsx-1744d2731d4e85d9 modal",children:[(0,t.jsx)("div",{className:"jsx-1744d2731d4e85d9 modal-header",children:(0,t.jsx)("h2",{className:"jsx-1744d2731d4e85d9",children:"💸 Liquidación Express"})}),(0,t.jsxs)("div",{style:{display:"flex",flexDirection:"column",gap:"var(--space-4)"},className:"jsx-1744d2731d4e85d9 modal-body",children:[(0,t.jsxs)("div",{style:{padding:"var(--space-3)",backgroundColor:"var(--color-primary-bg)",borderRadius:"var(--radius-md)",marginBottom:"var(--space-2)"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsxs)("div",{style:{fontWeight:600},className:"jsx-1744d2731d4e85d9",children:[e.nombre," ",e.apellido]}),(0,t.jsx)("div",{style:{fontSize:"var(--text-xs)",opacity:.8},className:"jsx-1744d2731d4e85d9",children:e.rolRel?.jornal>0?(0,t.jsxs)(t.Fragment,{children:["Sueldo Base del Rol: $",e.rolRel.jornal.toLocaleString()," (",e.cicloPago,")"]}):(0,t.jsxs)(t.Fragment,{children:["Sueldo Base Indiv.: $",e.sueldoBaseMensual.toLocaleString()," (",e.cicloPago,")"]})})]}),(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--space-3)"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:"Desde"}),(0,t.jsx)("input",{type:"date",value:$,onChange:e=>k(e.target.value),onClick:e=>e.currentTarget.showPicker?.(),className:"jsx-1744d2731d4e85d9 form-input"})]}),(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:"Hasta"}),(0,t.jsx)("input",{type:"date",value:z,onChange:e=>E(e.target.value),onClick:e=>e.currentTarget.showPicker?.(),className:"jsx-1744d2731d4e85d9 form-input"})]})]}),(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:"Importe Pagado (Sueldo/Semana)"}),(0,t.jsxs)("div",{style:{position:"relative"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsx)("span",{style:{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"var(--color-gray-400)"},className:"jsx-1744d2731d4e85d9",children:"$"}),(0,t.jsx)("input",{type:"number",style:{paddingLeft:"25px"},value:l,onChange:e=>d(""===e.target.value?"":Number(e.target.value)),className:"jsx-1744d2731d4e85d9 form-input"})]}),(0,t.jsxs)("div",{style:{fontSize:"10px",color:"var(--color-gray-500)",marginTop:"4px"},className:"jsx-1744d2731d4e85d9",children:["pesos ",r(B)]})]}),(0,t.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--space-3)"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:"Horas Extras (cant.)"}),(0,t.jsx)("input",{type:"number",value:c,onChange:e=>{let t=""===e.target.value?"":Number(e.target.value);u(t),M>0&&""!==t&&m(Math.round(Number(t)*M))},className:"jsx-1744d2731d4e85d9 form-input"}),M>0&&(0,t.jsxs)("span",{style:{fontSize:"var(--text-xs)",color:"var(--color-gray-500)",marginTop:"2px",display:"block"},className:"jsx-1744d2731d4e85d9",children:["Valor/hora: $",M.toLocaleString("es-AR"),e?.rolRel?.valorHoraExtra>0&&!(e?.valorHoraExtra>0)&&(0,t.jsxs)(t.Fragment,{children:[" (según rol ",e.rolRel.nombre,")"]})]})]}),(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:"Monto Horas Extras"}),(0,t.jsxs)("div",{style:{position:"relative"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsx)("span",{style:{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"var(--color-gray-400)"},className:"jsx-1744d2731d4e85d9",children:"$"}),(0,t.jsx)("input",{type:"number",style:{paddingLeft:"25px"},value:p,onChange:e=>m(""===e.target.value?"":Number(e.target.value)),className:"jsx-1744d2731d4e85d9 form-input"})]})]})]}),(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:"Descuento Préstamos/Adelantos"}),(0,t.jsxs)("div",{style:{position:"relative"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsx)("span",{style:{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:"var(--color-danger)"},className:"jsx-1744d2731d4e85d9",children:"-$"}),(0,t.jsx)("input",{type:"number",style:{paddingLeft:"25px",color:"var(--color-danger)"},value:h,onChange:e=>f(""===e.target.value?"":Number(e.target.value)),className:"jsx-1744d2731d4e85d9 form-input"})]})]}),(0,t.jsxs)("div",{style:{border:"1px dashed var(--color-gray-300)",padding:"var(--space-3)",borderRadius:"var(--radius-md)"},className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{style:{display:"flex",justifyContent:"space-between"},className:"jsx-1744d2731d4e85d9 form-label",children:(0,t.jsx)("span",{className:"jsx-1744d2731d4e85d9",children:"Conceptos Adicionales (Premios, Bonos, etc.)"})}),S.map((e,a)=>(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",backgroundColor:"white",padding:"var(--space-2)",borderRadius:"var(--radius-sm)",marginBottom:"var(--space-2)",border:"1px solid var(--color-gray-200)"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsx)("span",{className:"jsx-1744d2731d4e85d9",children:e.nombre}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"var(--space-2)"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsxs)("strong",{style:{color:e.montoCalculado<0?"var(--color-danger)":"var(--color-success)"},className:"jsx-1744d2731d4e85d9",children:[e.montoCalculado<0?"":"+","$",e.montoCalculado.toLocaleString()]}),(0,t.jsx)("button",{onClick:()=>w(S.filter((e,t)=>t!==a)),style:{color:"var(--color-danger)",height:"24px",width:"24px",padding:0},className:"jsx-1744d2731d4e85d9 btn btn-ghost btn-sm btn-icon",children:"✕"})]})]},a)),(0,t.jsxs)("div",{style:{display:"flex",gap:"var(--space-2)",marginTop:"var(--space-2)"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsxs)("select",{style:{flex:2},value:_,onChange:e=>{N(e.target.value);let t=b.find(t=>t.id===e.target.value);t?.valorPorDefecto?t.esPorcentaje?R(Math.round(B*(t.valorPorDefecto/100))):R(t.valorPorDefecto):R("")},className:"jsx-1744d2731d4e85d9 form-select",children:[(0,t.jsx)("option",{value:"",className:"jsx-1744d2731d4e85d9",children:"Seleccionar concepto..."}),b.map(e=>(0,t.jsxs)("option",{value:e.id,className:"jsx-1744d2731d4e85d9",children:[e.nombre," ","DESCUENTO"===e.tipo?"(-)":"(+)"]},e.id))]}),(0,t.jsx)("input",{type:"number",style:{flex:1},placeholder:"$ Monto",value:C,onChange:e=>R(""===e.target.value?"":Number(e.target.value)),className:"jsx-1744d2731d4e85d9 form-input"}),(0,t.jsx)("button",{onClick:()=>{if(!_||!C)return;let e=b.find(e=>e.id===_);if(!e)return;let t=Number(C);"DESCUENTO"===e.tipo&&(t=-Math.abs(t)),w([...S,{conceptoSalarialId:e.id,nombre:e.nombre,montoCalculado:t}]),N(""),R("")},disabled:!_||!C,className:"jsx-1744d2731d4e85d9 btn btn-outline",children:"Add"})]})]}),(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:"Incluir Licencia (Opcional)"}),(0,t.jsxs)("select",{value:g,onChange:e=>x(e.target.value),className:"jsx-1744d2731d4e85d9 form-select",children:[(0,t.jsx)("option",{value:"",className:"jsx-1744d2731d4e85d9",children:"-- Ninguna --"}),v.map(e=>(0,t.jsxs)("option",{value:e.id,className:"jsx-1744d2731d4e85d9",children:[e.nombre," ",e.conGoceSueldo?"(Remunerada)":""]},e.id))]}),(0,t.jsx)("span",{style:{fontSize:"var(--text-xs)",color:"var(--color-gray-500)",marginTop:"4px",display:"block"},className:"jsx-1744d2731d4e85d9",children:"Si se selecciona, figurará en el texto del recibo."})]}),(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:'Fecha de "Impresión"'}),(0,t.jsx)("input",{type:"date",value:F,onChange:e=>T(e.target.value),onClick:e=>e.currentTarget.showPicker?.(),className:"jsx-1744d2731d4e85d9 form-input"})]}),(0,t.jsxs)("div",{className:"jsx-1744d2731d4e85d9 form-group",children:[(0,t.jsx)("label",{className:"jsx-1744d2731d4e85d9 form-label",children:"Caja de Salida"}),(0,t.jsx)("select",{value:L,onChange:e=>O(e.target.value),className:"jsx-1744d2731d4e85d9 form-select",children:A.map(e=>(0,t.jsxs)("option",{value:e.id,className:"jsx-1744d2731d4e85d9",children:[e.nombre," ($",e.saldo.toLocaleString(),")"]},e.id))})]}),(0,t.jsxs)("div",{style:{marginTop:"var(--space-2)",padding:"var(--space-4)",background:"var(--color-gray-900)",color:"white",borderRadius:"var(--radius-lg)",display:"flex",justifyContent:"space-between",alignItems:"center"},className:"jsx-1744d2731d4e85d9",children:[(0,t.jsx)("span",{className:"jsx-1744d2731d4e85d9",children:"Total Neto:"}),(0,t.jsxs)("span",{style:{fontSize:"var(--text-xl)",fontWeight:"bold"},className:"jsx-1744d2731d4e85d9",children:["$",U.toLocaleString()]})]}),(0,t.jsxs)("div",{style:{fontSize:"10px",color:"var(--color-gray-500)",textAlign:"center",fontStyle:"italic"},className:"jsx-1744d2731d4e85d9",children:["(pesos ",r(U),")"]})]}),(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"flex-end",gap:"var(--space-3)"},className:"jsx-1744d2731d4e85d9 modal-footer",children:[(0,t.jsx)("button",{onClick:i,className:"jsx-1744d2731d4e85d9 btn btn-outline",children:"Cancelar"}),(0,t.jsx)("button",{disabled:P,onClick:Y,className:"jsx-1744d2731d4e85d9 btn btn-primary",children:P?"Guardando...":"Guardar e Imprimir Recibo"})]})]}),(0,t.jsx)(a.default,{id:"1744d2731d4e85d9",children:".modal-overlay.jsx-1744d2731d4e85d9{z-index:2000;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);background:#00000080;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.modal.jsx-1744d2731d4e85d9{border-radius:var(--radius-lg);box-shadow:var(--shadow-2xl);background:#fff;flex-direction:column;display:flex}"})]})}e.s(["ExpressLiquidationModal",()=>i],5208)}]);