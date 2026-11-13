/* Backroom Admin v0.23: region flag utilities for all registered countries and territories. */
(() => {
'use strict';
const countryCodes={"Afghanistan":"AF","Åland Islands":"AX","Albania":"AL","Algeria":"DZ","American Samoa":"AS","Andorra":"AD","Angola":"AO","Anguilla":"AI","Antarctica":"AQ","Antigua & Barbuda":"AG","Argentina":"AR","Armenia":"AM","Aruba":"AW","Australia":"AU","Austria":"AT","Azerbaijan":"AZ","Bahamas":"BS","Bahrain":"BH","Bangladesh":"BD","Barbados":"BB","Belarus":"BY","Belgium":"BE","Belize":"BZ","Benin":"BJ","Bermuda":"BM","Bhutan":"BT","Bolivia":"BO","Bosnia & Herzegovina":"BA","Botswana":"BW","Bouvet Island":"BV","Brazil":"BR","British Indian Ocean Territory":"IO","British Virgin Islands":"VG","Brunei":"BN","Bulgaria":"BG","Burkina Faso":"BF","Burundi":"BI","Cambodia":"KH","Cameroon":"CM","Canada":"CA","Cape Verde":"CV","Caribbean Netherlands":"BQ","Cayman Islands":"KY","Central African Republic":"CF","Chad":"TD","Chile":"CL","China":"CN","Christmas Island":"CX","Cocos (Keeling) Islands":"CC","Colombia":"CO","Comoros":"KM","Cook Islands":"CK","Costa Rica":"CR","Côte d'Ivoire":"CI","Croatia":"HR","Cuba":"CU","Curaçao":"CW","Cyprus":"CY","Czechia":"CZ","Democratic Republic of the Congo":"CD","Denmark":"DK","Djibouti":"DJ","Dominica":"DM","Dominican Republic":"DO","Ecuador":"EC","Egypt":"EG","El Salvador":"SV","Equatorial Guinea":"GQ","Eritrea":"ER","Estonia":"EE","Eswatini":"SZ","Ethiopia":"ET","Falkland Islands (Islas Malvinas)":"FK","Faroe Islands":"FO","Fiji":"FJ","Finland":"FI","France":"FR","French Guiana":"GF","French Polynesia":"PF","French Southern Territories":"TF","Gabon":"GA","Gambia":"GM","Georgia":"GE","Germany":"DE","Ghana":"GH","Gibraltar":"GI","Greece":"GR","Greenland":"GL","Grenada":"GD","Guadeloupe":"GP","Guam":"GU","Guatemala":"GT","Guernsey":"GG","Guinea":"GN","Guinea-Bissau":"GW","Guyana":"GY","Haiti":"HT","Heard & McDonald Islands":"HM","Honduras":"HN","Hong Kong":"HK","Hungary":"HU","Iceland":"IS","India":"IN","Indonesia":"ID","Iran":"IR","Iraq":"IQ","Ireland":"IE","Isle of Man":"IM","Israel":"IL","Italy":"IT","Jamaica":"JM","Japan":"JP","Jersey":"JE","Jordan":"JO","Kazakhstan":"KZ","Kenya":"KE","Kiribati":"KI","Kosovo":"XK","Kuwait":"KW","Kyrgyzstan":"KG","Laos":"LA","Latvia":"LV","Lebanon":"LB","Lesotho":"LS","Liberia":"LR","Libya":"LY","Liechtenstein":"LI","Lithuania":"LT","Luxembourg":"LU","Macao":"MO","Madagascar":"MG","Malawi":"MW","Malaysia":"MY","Maldives":"MV","Mali":"ML","Malta":"MT","Marshall Islands":"MH","Martinique":"MQ","Mauritania":"MR","Mauritius":"MU","Mayotte":"YT","Mexico":"MX","Micronesia":"FM","Moldova":"MD","Monaco":"MC","Mongolia":"MN","Montenegro":"ME","Montserrat":"MS","Morocco":"MA","Mozambique":"MZ","Myanmar (Burma)":"MM","Namibia":"NA","Nauru":"NR","Nepal":"NP","Netherlands":"NL","New Caledonia":"NC","New Zealand":"NZ","Nicaragua":"NI","Niger":"NE","Nigeria":"NG","Niue":"NU","Norfolk Island":"NF","North Korea":"KP","North Macedonia":"MK","Northern Mariana Islands":"MP","Norway":"NO","Oman":"OM","Pakistan":"PK","Palau":"PW","Palestine":"PS","Panama":"PA","Papua New Guinea":"PG","Paraguay":"PY","Peru":"PE","Philippines":"PH","Pitcairn Islands":"PN","Poland":"PL","Portugal":"PT","Puerto Rico":"PR","Qatar":"QA","Republic of the Congo":"CG","Réunion":"RE","Romania":"RO","Russia":"RU","Rwanda":"RW","Samoa":"WS","San Marino":"SM","São Tomé and Príncipe":"ST","Saudi Arabia":"SA","Senegal":"SN","Serbia":"RS","Seychelles":"SC","Sierra Leone":"SL","Singapore":"SG","Sint Maarten":"SX","Slovakia":"SK","Slovenia":"SI","Solomon Islands":"SB","Somalia":"SO","South Africa":"ZA","South Georgia & South Sandwich Islands":"GS","South Korea":"KR","South Sudan":"SS","Spain":"ES","Sri Lanka":"LK","St. Barthélemy":"BL","St. Helena":"SH","St. Kitts & Nevis":"KN","St. Lucia":"LC","St. Martin":"MF","St. Pierre & Miquelon":"PM","St. Vincent & Grenadines":"VC","Sudan":"SD","Suriname":"SR","Svalbard & Jan Mayen":"SJ","Sweden":"SE","Switzerland":"CH","Syria":"SY","Taiwan":"TW","Tajikistan":"TJ","Tanzania":"TZ","Thailand":"TH","Timor-Leste":"TL","Togo":"TG","Tokelau":"TK","Tonga":"TO","Trinidad & Tobago":"TT","Tunisia":"TN","Turkey":"TR","Turkmenistan":"TM","Turks & Caicos Islands":"TC","Tuvalu":"TV","U.S. Outlying Islands":"UM","U.S. Virgin Islands":"VI","Uganda":"UG","Ukraine":"UA","United Arab Emirates":"AE","United Kingdom":"GB","United States":"US","Uruguay":"UY","Uzbekistan":"UZ","Vanuatu":"VU","Vatican City":"VA","Venezuela":"VE","Vietnam":"VN","Wallis & Futuna":"WF","Western Sahara":"EH","Yemen":"YE","Zambia":"ZM","Zimbabwe":"ZW"};
const aliases={"Türkiye":"Turkey","United States of America":"United States","UK":"United Kingdom","Republic of Korea":"South Korea","Czech Republic":"Czechia","Russian Federation":"Russia","Hong Kong SAR":"Hong Kong","Viet Nam":"Vietnam","USA":"United States","U.S.A.":"United States","Deutschland":"Germany","España":"Spain","Italia":"Italy","Korea, Republic of":"South Korea","Korea, Democratic People's Republic of":"North Korea","Russia":"Russia","The Netherlands":"Netherlands","Taiwan, Province of China":"Taiwan"};
const key=value=>String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en');
const lookup=new Map(Object.entries(countryCodes).map(([name,code])=>[key(name),code]));
for(const [alias,canonical] of Object.entries(aliases)) {
  const code=lookup.get(key(canonical));if(code)lookup.set(key(alias),code);
}
for(const code of Object.values(countryCodes))lookup.set(code.toLowerCase(),code);
function code(country) { return lookup.get(key(country)) || null; }
function flag(country) {
  const value=code(country);
  if(!value||!/^[A-Z]{2}$/.test(value)||value==='XK')return '🌍';
  return String.fromCodePoint(...[...value].map(letter=>127397+letter.charCodeAt(0)));
}
function label(country) {const name=String(country??'').trim();return name?flag(name)+' '+name:'🌍 Unknown';}
const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const validCode=country=>{
  const c=code(country);
  return c&&/^[A-Z]{2}$/.test(c)&&c!=='XK'?c.toLowerCase():null;
};
function iconUrl(country,size='24x18'){
  const c=validCode(country);
  return c?'https://flagcdn.com/'+size+'/'+c+'.png':null;
}
/* Actual flag image, not a Unicode regional-indicator emoji (Windows Chrome
   commonly renders those as two letters, e.g. "de" instead of Germany's flag). */
function html(country){
  const name=String(country??'').trim();
  const source=iconUrl(country);
  if(!source)return '<span class="br-country-flag-missing" role="img" aria-label="Flag unavailable">🌐</span>';
  return '<span class="br-country-flag-frame" title="'+esc(name||code(country))+'">'+
    '<img class="br-country-flag-image" src="'+source+'" srcset="'+iconUrl(country,'48x36')+' 2x" width="24" height="18" loading="lazy" decoding="async" alt="'+esc(name||code(country))+' flag">'+
    '<span class="br-country-flag-fallback" aria-hidden="true">🌐</span></span>';
}
const countrySelectQuery='select[data-cf="country"],select[data-quality="country"],select[data-cover="country"],#br-reg-country,#admin-json-country-filter,#admin-location-country-filter';
function decorateCountrySelectors(root=document){
  const nodes=[...(root.matches?.(countrySelectQuery)?[root]:[]),...root.querySelectorAll(countrySelectQuery)];
  for(const select of nodes){
    const url=iconUrl(select.value);
    if(url){
      // Inline important values override the admin's existing !important select
      // background/padding styles while leaving its native change events intact.
      select.style.setProperty('background-image','url("'+url+'")','important');
      select.style.setProperty('background-position','10px center','important');
      select.style.setProperty('background-repeat','no-repeat','important');
      select.style.setProperty('background-size','24px 18px','important');
      select.style.setProperty('padding-left','43px','important');
      select.classList.add('br-flagged-select');
    }else{
      for(const prop of ['background-image','background-position','background-repeat','background-size','padding-left'])select.style.removeProperty(prop);
      select.classList.remove('br-flagged-select');
    }
  }
}
function install(){
  decorateCountrySelectors();
  document.addEventListener('change',event=>{
    if(event.target?.matches?.(countrySelectQuery))decorateCountrySelectors(event.target);
  },true);
  // Dynamic country selectors are recreated by the filters and country registry.
  // Batch updates to one scan per microtask instead of repeatedly processing
  // each table row from the MutationObserver.
  let scheduled=false;
  const observer=new MutationObserver(mutations=>{
    if(!mutations.some(item=>item.addedNodes.length))return;
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;decorateCountrySelectors();});
  });
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('error',event=>{
    if(event.target?.classList?.contains('br-country-flag-image'))
      event.target.parentElement?.classList?.add('br-country-flag-error');
  },true);
}
window.BackroomAdminFlags={code,flag,label,html,iconUrl,decorateCountrySelectors};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
else install();
})();
