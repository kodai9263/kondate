import { useEffect, useRef, useState } from "react";
import { RecipeImportControls } from "./RecipeImportControls";
import { organizeSteps } from "../../src/lib/recipes/organizeSteps";
import type { PrivateImportedRecipe } from "../../src/lib/recipes/privateImport";
export type RecipeFields = { name:string;side:string;cookMinutes:number;servings:number;proteinSource:string;ingredients:string;morning:string;steps:string;sourceUrl?:string;sourceServingsText?:string;importConfirmed?:"yes";energyKcal?:number|null;proteinG?:number|null;fatG?:number|null;carbsG?:number|null;fiberG?:number|null;saltG?:number|null;vegetablesG?:number|null };
type EditorData={version:1;fields:RecipeFields;revision:string};
type SaveRequest={id:string;requestId:string;revision:string|null;fields:RecipeFields};
const endpoint=()=>`${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/,"")??""}/api/mobile/v1/recipes/editor`;
async function checked(response:Response){
  if(response.ok) return;
  if(response.status===409) throw new Error("ほかの画面で変更されています。一覧に戻り、最新の内容を開いてから編集してください。");
  if(response.status===401) throw new Error("ログインし直してください。入力内容はコピーして控えてください。");
  if(response.status===404) throw new Error("この料理は編集できません。一覧に戻って確認してください。");
  if(response.status===400) throw new Error("入力内容を確認できませんでした。一覧へ戻ってやり直してください。");
  throw new Error("保存結果を確認できません。同じ内容で再確認するには、もう一度保存を押してください。");
}
const numbers=[['cookMinutes','完成までの時間（分）',240,1],['servings','何人分の材料ですか',20,1]] as const;
export function MenuEditor({id,accessToken,online,onClose,onSaved}:{id:string|null;accessToken:string;online:boolean;onClose:()=>void;onSaved:()=>void}){
  const [loaded,setLoaded]=useState<{key:string;data?:EditorData;error?:string}|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [source,setSource]=useState<PrivateImportedRecipe|null>(null);
  const [importing,setImporting]=useState(false);
  const [beforeOrganize,setBeforeOrganize]=useState<string|null>(null);
  const [pending,setPending]=useState<SaveRequest|null>(null);
  const saving=useRef(false);const form=useRef<HTMLFormElement>(null);
  const [createId]=useState(()=>crypto.randomUUID());
  const key=JSON.stringify([id]);
  const data=loaded?.key===key?loaded.data:undefined;
  useEffect(()=>{const abort=new AbortController();if(id&&online&&!data) void fetch(`${endpoint()}?${new URLSearchParams({id})}`,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store',signal:abort.signal}).then(async response=>{await checked(response);const value=await response.json() as EditorData;if(value.version!==1||!value.fields||typeof value.revision!=="string")throw new Error("編集内容を確認できませんでした。");if(!abort.signal.aborted)setLoaded({key,data:value});}).catch((cause:unknown)=>{if(!abort.signal.aborted)setLoaded({key,error:cause instanceof Error?cause.message:"読み込めませんでした。"});});return()=>abort.abort();},[id,accessToken,online,key,data]);
  useEffect(()=>{form.current?.scrollIntoView({block:'start'});},[]);
  async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!online||saving.current||importing)return;
    const fields=Object.fromEntries(new FormData(event.currentTarget));for(const [name] of numbers) fields[name]=Number(fields[name]) as unknown as FormDataEntryValue;
    const body=pending??{id:id??createId,requestId:crypto.randomUUID(),revision:data?.revision??null,fields:fields as unknown as RecipeFields};
    setPending(body);saving.current=true;setBusy(true);setError("");
    try{const response=await fetch(endpoint(),{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(body)});if(response.status===400)setPending(null);await checked(response);const value=await response.json();if(value.id!==body.id)throw new Error("保存結果を確認できませんでした。もう一度保存を押してください。");onSaved();}
    catch(cause){setError(cause instanceof Error?cause.message:"保存結果を確認できません。同じ内容で再確認できます。");}
    finally{saving.current=false;setBusy(false);}
  }
  function applyImport(recipe:PrivateImportedRecipe){
    if(!form.current)return;
    if(["name","ingredients","steps"].some(name=>(form.current!.elements.namedItem(name) as HTMLInputElement).value)&&!window.confirm("入力済みの料理名・材料・作り方を取り込み結果に置き換えますか？"))return;
    for(const [name,value] of Object.entries({name:recipe.name,ingredients:recipe.ingredients,steps:recipe.steps,servings:recipe.sourceServings??"",cookMinutes:recipe.cookMinutes??"",proteinSource:recipe.proteinSource})) (form.current.elements.namedItem(name) as HTMLInputElement).value=String(value);
    const confirmation=form.current.elements.namedItem("importConfirmed") as HTMLInputElement|null;if(confirmation)confirmation.checked=false;
    form.current.dataset.dirty='true';setSource(recipe);setBeforeOrganize(null);
  }
  const ready=!id||Boolean(data);const defaults=data?.fields;
  return <section className="menu-page"><button type="button" className="secondary-button" disabled={busy||importing} onClick={()=>{if((pending||form.current?.dataset.dirty==='true')&&!window.confirm('保存前の入力、または未確認の保存結果があります。一覧に戻りますか？'))return;onClose();}}>一覧に戻る</button><div className="page-heading"><h1>{id?'メニューを編集':'メニューを登録'}</h1><p>家族だけで共有する料理です。材料は指定した人数分を入力してください。</p></div>
    {!online&&<p role="status">通信を戻してから保存してください。</p>}{id&&!data&&!loaded?.error&&<p role="status">編集内容を読み込んでいます…</p>}{loaded?.key===key&&loaded.error&&<p role="alert">{loaded.error}</p>}
    <p className="read-only-note">外部サイトを参考にする場合は、利用条件を確認し、保存・利用が認められている範囲で入力してください。写真や紹介文の無断転載はお控えください。</p>
    {!id&&<RecipeImportControls accessToken={accessToken} disabled={busy||importing||!!pending||!online} onImport={applyImport} onBusy={setImporting}/>}
    {ready&&<form ref={form} key={data?.revision??'new'} className="menu-editor" onSubmit={event=>void save(event)} onChange={()=>{if(form.current)form.current.dataset.dirty='true';}}>
      <fieldset disabled={busy||importing||Boolean(pending)}><legend>料理の基本</legend>
        <label>料理名<input name="name" required maxLength={80} defaultValue={defaults?.name??''}/></label>
        <label>副菜・汁物<input name="side" maxLength={120} defaultValue={defaults?.side??''}/></label>
        {numbers.slice(0,2).map(([name,label,max,min])=><label key={name}>{label}<input name={name} required type="number" min={min} max={max} step="1" defaultValue={defaults?.[name]??(name==='servings'?4:30)}/></label>)}
        {source&&<div><p>元の表記：{source.sourceServingsText||"人数不明"}。分量はそのままです。範囲表記の場合は何人分として使うかを選んでください。</p><a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">元のレシピを確認（キッコーマン）</a><input type="hidden" name="sourceUrl" value={source.sourceUrl}/><input type="hidden" name="sourceServingsText" value={source.sourceServingsText}/><label><input type="checkbox" name="importConfirmed" value="yes" required/>材料・分量・人数・作り方と、保存・利用できる範囲を確認しました</label></div>}
        <p className="read-only-note">40分を超える料理も献立の変更で選べます。自動提案は40分以内の料理が対象です。</p>
        <label>主なたんぱく源<select name="proteinSource" defaultValue={defaults?.proteinSource??'meat'}><option value="meat">肉</option><option value="fish">魚</option><option value="soy">大豆・豆腐</option><option value="egg">卵</option><option value="noodle">麺・その他</option></select></label>
        {([['ingredients','材料',true],['morning','朝の仕込み（任意）',false],['steps','作り方',true]] as const).map(([name,label,required])=><label key={name}>{label}<textarea name={name} required={required} maxLength={4000} rows={5} defaultValue={defaults?.[name]??''}/><small>1行に1つずつ入力してください。</small></label>)}
        <button type="button" className="secondary-button" onClick={()=>{const field=form.current!.elements.namedItem("steps") as HTMLTextAreaElement;try{const next=organizeSteps(field.value);setBeforeOrganize(field.value);field.value=next;form.current!.dataset.dirty='true';setError("");}catch(cause){setError(cause instanceof Error?cause.message:"整理できませんでした。");}}}>作り方の改行を整理</button>
        {beforeOrganize!==null&&<button type="button" className="secondary-button" onClick={()=>{(form.current!.elements.namedItem("steps") as HTMLTextAreaElement).value=beforeOrganize;setBeforeOrganize(null);}}>整理前に戻す</button>}
        <p className="read-only-note">改行を整える機能です。内容の要約や言い換え、利用許諾の確認は行いません。</p>
      </fieldset>
      {id&&<p className="read-only-note">保存するとWeb版と、この料理を使う献立にも反映されます。材料・工程のチェックは解除されます。</p>}
      {error&&<p className="error-message" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy||importing||!online}>{busy?'保存中…':pending?'同じ内容で保存を確認':'メニューを保存'}</button>
    </form>}
  </section>;
}
