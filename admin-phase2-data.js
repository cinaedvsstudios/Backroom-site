/* Backroom Admin Phase 2 — import/export and schema/validation utilities.
   Data tools are local-only. No production files are modified by these utilities. */
(() => {
'use strict';
if(window.BackroomPhase2Data)return;
const idField=mode=>mode==='events'?'Event_ID':'Venue_ID';
const blank=v=>v===undefined||v===null||(typeof v==='string'&&v.trim()==='');
const norm=v=>String(v??'').trim();
const clone=v=>JSON.parse(JSON.stringify(v));
const allKeys=rows=>{
  const keys=new Set();
  (Array.isArray(rows)?rows:[]).forEach(row=>{
    if(row&&typeof row==='object'&&!Array.isArray(row))Object.keys(row).forEach(k=>keys.add(k));
  });
  return [...keys];
};
function csvEncode(value){
  if(value===undefined||value===null)return'""';
  const string=typeof value==='object'?JSON.stringify(value):String(value);
  return '"'+string.replace(/"/g,'""')+'"';
}
function csvSerialize(rows,fields=allKeys(rows)){
  return '\ufeff'+[fields.map(csvEncode).join(','),...rows.map(row=>fields.map(k=>csvEncode(row?.[k])).join(','))].join('\r\n');
}
function sniffDelimiter(text){
  const count={',':0,';':0,'\t':0};let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;continue;}
    if(!quoted&&(ch==='\r'||ch==='\n'))break;
    if(!quoted&&Object.prototype.hasOwnProperty.call(count,ch))count[ch]++;
  }
  return Object.keys(count).sort((a,b)=>count[b]-count[a])[0]||',';
}
function csvParse(input){
  const text=String(input??'').replace(/^\ufeff/,'');
  const delimiter=sniffDelimiter(text);const matrix=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=false;
      else cell+=ch;
    }else if(ch==='"'&&cell===''){quoted=true;}
    else if(ch===delimiter){row.push(cell);cell='';}
    else if(ch==='\r'||ch==='\n'){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);matrix.push(row);row=[];cell='';
    }else cell+=ch;
  }
  if(quoted)throw Error('CSV has an unclosed quoted cell.');
  if(cell!==''||row.length)matrix.push([...row,cell]);
  const nonblank=matrix.filter(row=>row.some(v=>norm(v)!==''));
  if(!nonblank.length)throw Error('CSV is empty.');
  const headers=nonblank[0].map(x=>String(x).trim());
  if(headers.some(x=>!x))throw Error('CSV contains an unnamed column.');
  const repeated=headers.filter((x,i)=>headers.indexOf(x)!==i);
  if(repeated.length)throw Error('CSV contains duplicate column names: '+[...new Set(repeated)].join(', '));
  const rows=nonblank.slice(1).map((values,index)=>{
    if(values.length>headers.length)throw Error('CSV row '+(index+2)+' has more cells than headers.');
    return Object.fromEntries(headers.map((key,i)=>[key,values[i]??'']));
  });
  return {rows,fields:headers,delimiter};
}
function readFile(text,filename){
  if(/\.csv$/i.test(filename)||/\.tsv$/i.test(filename))return csvParse(text);
  let value;
  try{value=JSON.parse(text.replace(/^\ufeff/,''));}catch(e){throw Error('Invalid JSON: '+e.message);}
  if(!Array.isArray(value))throw Error('Expected a top-level JSON array of records.');
  if(value.some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('Every record must be a JSON object.');
  return {rows:value,fields:allKeys(value),delimiter:null};
}
function schemaHints(rows,mode){
  const hints=new Map(),possible=new Map();
  rows.forEach(row=>Object.entries(row||{}).forEach(([key,value])=>{
    if(value===undefined||value===null||value==='')return;
    const type=Array.isArray(value)?'array':typeof value;
    if(!possible.has(key))possible.set(key,new Map());
    possible.get(key).set(type,(possible.get(key).get(type)||0)+1);
  }));
  for(const [key,counts] of possible)hints.set(key,[...counts].sort((a,b)=>b[1]-a[1])[0][0]);
  if(mode==='venues'){
    for(const f of ['Feature_Darkroom','Feature_Dresscode','Feature_Men_Only','Feature_Dancefloor','Feature_Smoking_Area','Feature_Cocktails','Feature_Cruise_Focused','Feature_Sauna','Feature_Playroom'])if(!hints.has(f))hints.set(f,'boolean');
    for(const f of ['Rating_General','Rating_Darkroom','Rating_Age_Range','Rating_Cost','Rating_Size','Rating_Location','Rating_Busyness','Views'])if(!hints.has(f))hints.set(f,'number');
  }
  return hints;
}
function convertCell(value,key,hints,previous){
  if(typeof value!=='string')return value;
  const hint=previous!==undefined&&previous!==null&&previous!==''?(Array.isArray(previous)?'array':typeof previous):hints.get(key);
  if(!hint||hint==='string')return value;
  if(hint==='boolean'){
    if(/^(true|1|yes)$/i.test(value.trim()))return true;
    if(/^(false|0|no)$/i.test(value.trim()))return false;
    throw Error(key+' must be true or false; got '+JSON.stringify(value));
  }
  if(hint==='number'){
    const number=Number(value.trim());
    if(!Number.isFinite(number))throw Error(key+' must be numeric; got '+JSON.stringify(value));
    return number;
  }
  if(hint==='array'||hint==='object'){
    let parsed;try{parsed=JSON.parse(value);}catch{throw Error(key+' must contain valid JSON '+hint+'.');}
    if(hint==='array'?!Array.isArray(parsed):(!parsed||typeof parsed!=='object'||Array.isArray(parsed)))throw Error(key+' must contain a JSON '+hint+'.');
    return parsed;
  }
  return value;
}
function clearField(value,hint){
  const type=value===undefined||value===null?hint:(Array.isArray(value)?'array':typeof value);
  return ['boolean','number','array','object'].includes(type)?null:'';
}
function changed(a,b){
  const clean=row=>{const x={...row};delete x.Last_Updated;return JSON.stringify(x);};
  return clean(a)!==clean(b);
}
const allowedStatuses=new Set(['live','hold','closed','flag','review','cancelled','canceled','expired','draft','tba','archived','pending']);
function validateRow(row,mode,options={}){
  const errors=[],warnings=[],id=idField(mode);
  const must=mode==='venues'?['Venue_ID','Name','City','Country','Category','Status']:['Event_ID','Event_Name','Event_Date','Status'];
  for(const key of must)if(blank(row[key]))errors.push('Missing required '+key);
  if(!blank(row.Status)&&!allowedStatuses.has(norm(row.Status).toLowerCase()))warnings.push('Unrecognized status: '+row.Status);
  const lat=row.Latitude,lon=row.Longitude;
  if(!blank(lat)&&(!Number.isFinite(Number(lat))||Math.abs(Number(lat))>90))errors.push('Latitude must be between -90 and 90');
  if(!blank(lon)&&(!Number.isFinite(Number(lon))||Math.abs(Number(lon))>180))errors.push('Longitude must be between -180 and 180');
  if((blank(lat)&&!blank(lon))||(!blank(lat)&&blank(lon)))warnings.push('Only one GPS coordinate is present');
  for(const key of Object.keys(row).filter(x=>/_URL$/.test(x)&&x!=='Image_URL'&&x!=='Share_URL'&&x!=='Source_URLs')){
    const value=row[key];if(blank(value))continue;
    if(typeof value!=='string'||!/^https?:\/\/\S+/i.test(value.trim()))warnings.push(key+' is not an absolute HTTP(S) URL');
  }
  if(mode==='events'){
    if(!blank(row.Event_Date)){
      const value=norm(row.Event_Date);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)errors.push('Event_Date must be a real YYYY-MM-DD date');
    }
    if(!blank(row.Venue_ID)){
      if(options.venueIDs&&options.venueIDs.size&&!options.venueIDs.has(norm(row.Venue_ID)))warnings.push('Venue_ID is not found in the venue database');
    }else warnings.push('Event has no Venue_ID; link it to a venue where possible');
  }
  if(mode==='venues'&&blank(row.Website_URL))warnings.push('Missing website');
  return {errors,warnings,id:norm(row[id])};
}
function makePlan(currentRows,uploadedRows,fields,mode,operation,venueRows=[]){
  if(!['add','replace','remove'].includes(operation))throw Error('Unknown import mode.');
  if(!['venues','events'].includes(mode))throw Error('Unknown dataset.');
  if(!Array.isArray(currentRows)||!Array.isArray(uploadedRows))throw Error('Import requires two arrays.');
  const key=idField(mode),inputFields=fields?.length?fields:allKeys(uploadedRows);
  if(!inputFields.includes(key))throw Error('Upload is missing '+key+' column.');
  const originals=new Map(),errors=[],warnings=[],changes=[];
  currentRows.forEach((row,i)=>{
    const id=norm(row[key]);
    if(!id){errors.push('Existing row '+(i+1)+' has no '+key+'.');return;}
    if(originals.has(id))errors.push('Existing dataset has duplicate '+key+': '+id);
    originals.set(id,row);
  });
  const idsSeen=new Set();
  const rows=uploadedRows.map((entry,i)=>{
    const id=norm(entry?.[key]);
    if(!id)errors.push('Uploaded row '+(i+1)+' is missing '+key+'.');
    else if(idsSeen.has(id))errors.push('Uploaded file contains duplicate '+key+': '+id);
    idsSeen.add(id);
    return entry;
  });
  const hints=schemaHints([...currentRows,...venueRows],mode);
  const venueIDs=new Set(venueRows.map(x=>norm(x.Venue_ID)).filter(Boolean));
  const stamp=new Date().toISOString(),output=[],targetById=new Map();
  if(operation==='remove'){
    for(const row of currentRows){if(!idsSeen.has(norm(row[key])))output.push(row);}
    rows.forEach(entry=>{
      const id=norm(entry?.[key]);
      if(!id)return;
      if(originals.has(id))changes.push({id,kind:'remove',before:originals.get(id),after:null,fields:[]});
      else warnings.push(id+': ID not found; nothing to remove.');
    });
  }else if(operation==='replace'){
    rows.forEach((entry,i)=>{
      const id=norm(entry?.[key]);
      if(!id)return;
      const old=originals.get(id);
      let next={};
      for(const [field,value] of Object.entries(entry)){
        if(value==='__CLEAR__'){next[field]=clearField(old?.[field],hints.get(field));continue;}
        if(value===''&&typeof value==='string'){next[field]='';continue;}
        try{next[field]=convertCell(value,field,hints,old?.[field]);}
        catch(error){errors.push('Row '+(i+2)+' '+id+': '+error.message);}
      }
      const valid=validateRow(next,mode,{venueIDs});
      valid.errors.forEach(x=>errors.push(id+': '+x));
      valid.warnings.forEach(x=>warnings.push(id+': '+x));
      if(old&&!changed(old,next))next.Last_Updated=old.Last_Updated;
      else next.Last_Updated=stamp;
      if(mode==='venues'&&!next.Created_At)next.Created_At=old?.Created_At||stamp;
      output.push(next);targetById.set(id,next);
      if(!old)changes.push({id,kind:'add',before:null,after:next,fields:Object.keys(next)});
      else if(changed(old,next))changes.push({id,kind:'update',before:old,after:next,fields:allKeys([old,next]).filter(f=>JSON.stringify(old[f])!==JSON.stringify(next[f]))});
    });
    currentRows.forEach(old=>{if(!idsSeen.has(norm(old[key])))changes.push({id:norm(old[key]),kind:'remove',before:old,after:null,fields:[]});});
  }else{
    currentRows.forEach(row=>{const id=norm(row[key]);output.push(row);targetById.set(id,row);});
    rows.forEach((entry,i)=>{
      const id=norm(entry?.[key]);if(!id)return;
      const old=originals.get(id),next=old?{...old}:{};
      for(const field of inputFields){
        if(!Object.prototype.hasOwnProperty.call(entry,field)||field===key||field==='Last_Updated')continue;
        const value=entry[field];
        if(value===''||value===undefined||value===null)continue;
        if(value==='__CLEAR__'){next[field]=clearField(old?.[field],hints.get(field));continue;}
        try{next[field]=convertCell(value,field,hints,old?.[field]);}
        catch(error){errors.push('Row '+(i+2)+' '+id+': '+error.message);}
      }
      next[key]=id;
      const valid=validateRow(next,mode,{venueIDs});
      // Existing rows may be historically incomplete; only validate changed coordinates/dates and block new invalid rows.
      if(!old)valid.errors.forEach(x=>errors.push(id+': '+x));
      else valid.errors.filter(x=>/Latitude|Longitude|Event_Date/.test(x)).forEach(x=>errors.push(id+': '+x));
      valid.warnings.forEach(x=>warnings.push(id+': '+x));
      if(!old||changed(old,next)){
        next.Last_Updated=stamp;
        if(mode==='venues'&&!old)next.Created_At=next.Created_At||stamp;
        if(old)output[targetById.has(id)?output.indexOf(targetById.get(id)):-1]=next;
        else output.push(next);
        targetById.set(id,next);
        changes.push({id,kind:old?'update':'add',before:old||null,after:next,fields:old?allKeys([old,next]).filter(f=>JSON.stringify(old[f])!==JSON.stringify(next[f])):Object.keys(next)});
      }
    });
  }
  const counts={existing:currentRows.length,uploaded:rows.length,after:output.length,added:changes.filter(x=>x.kind==='add').length,updated:changes.filter(x=>x.kind==='update').length,removed:changes.filter(x=>x.kind==='remove').length,unchanged:Math.max(0,operation==='replace'?rows.length-changes.filter(x=>x.kind!=='remove').length:rows.length-changes.filter(x=>x.kind!=='remove').length)};
  return {mode,operation,fields:inputFields,output,changes,errors:[...new Set(errors)],warnings:[...new Set(warnings)],counts,previewAt:stamp};
}
window.BackroomPhase2Data={idField,allKeys,csvEncode,csvParse,csvSerialize,readFile,schemaHints,convertCell,validateRow,makePlan,changed};
})();
