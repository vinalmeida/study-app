const json=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const asset=(body,type)=>new Response(body,{headers:{"content-type":type,"cache-control":"public, max-age=300","x-content-type-options":"nosniff","content-security-policy":"default-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'"}});
const userId=request=>request.headers.get("oai-authenticated-user-id");
async function readBody(request){const length=Number(request.headers.get("content-length")||0);if(length>8000)throw new Error("PAYLOAD_TOO_LARGE");return request.json().catch(()=>{throw new Error("INVALID_JSON")})}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`))}
function validColor(value){return /^#[0-9a-f]{6}$/i.test(value)}

async function handleApi(request,env,url,user){
  if(!user)return json({error:"Entre com sua conta para acessar seus registros."},401);
  if(!env.DB)return json({error:"O armazenamento está temporariamente indisponível."},503);
  if(url.pathname==="/api/state"&&request.method==="GET"){
    const [subjectsResult,entriesResult]=await env.DB.batch([
      env.DB.prepare("SELECT id, name, color FROM subjects WHERE user_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE").bind(user),
      env.DB.prepare("SELECT id, subject_id AS subjectId, study_date AS studyDate, duration_minutes AS durationMinutes, study_type AS studyType, notes FROM study_entries WHERE user_id = ? ORDER BY study_date DESC, id DESC").bind(user)
    ]);
    return json({subjects:subjectsResult.results||[],entries:entriesResult.results||[]});
  }
  if(url.pathname==="/api/subjects"&&request.method==="POST"){
    const data=await readBody(request),name=String(data.name||"").trim(),color=String(data.color||"").toLowerCase();
    if(name.length<1||name.length>50)return json({error:"Use um nome entre 1 e 50 caracteres."},400);
    if(!validColor(color))return json({error:"Escolha uma cor válida."},400);
    const duplicate=await env.DB.prepare("SELECT id FROM subjects WHERE user_id = ? AND lower(name) = lower(?) AND deleted_at IS NULL LIMIT 1").bind(user,name).first();
    if(duplicate)return json({error:"Você já possui uma disciplina com esse nome."},409);
    const result=await env.DB.prepare("INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)").bind(user,name,color).run();
    return json({id:Number(result.meta.last_row_id),name,color},201);
  }
  if(url.pathname==="/api/entries"&&request.method==="POST"){
    const data=await readBody(request),subjectId=Number(data.subjectId),durationMinutes=Number(data.durationMinutes),studyDate=String(data.studyDate||""),studyType=String(data.studyType||""),notes=String(data.notes||"").trim();
    if(!Number.isInteger(subjectId)||!validDate(studyDate)||!Number.isInteger(durationMinutes)||durationMinutes<1||durationMinutes>1439||!["theory","exercises"].includes(studyType)||notes.length>1200)return json({error:"Revise os dados do registro."},400);
    const subject=await env.DB.prepare("SELECT id FROM subjects WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(subjectId,user).first();
    if(!subject)return json({error:"A disciplina selecionada não está disponível."},404);
    const result=await env.DB.prepare("INSERT INTO study_entries (user_id, subject_id, study_date, duration_minutes, study_type, notes) VALUES (?, ?, ?, ?, ?, ?)").bind(user,subjectId,studyDate,durationMinutes,studyType,notes).run();
    return json({id:Number(result.meta.last_row_id),subjectId,studyDate,durationMinutes,studyType,notes},201);
  }
  const subjectMatch=url.pathname.match(/^\/api\/subjects\/(\d+)$/);
  if(subjectMatch&&request.method==="DELETE"){const result=await env.DB.prepare("UPDATE subjects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(Number(subjectMatch[1]),user).run();return result.meta.changes?json(null,204):json({error:"Disciplina não encontrada."},404)}
  const entryMatch=url.pathname.match(/^\/api\/entries\/(\d+)$/);
  if(entryMatch&&request.method==="DELETE"){const result=await env.DB.prepare("DELETE FROM study_entries WHERE id = ? AND user_id = ?").bind(Number(entryMatch[1]),user).run();return result.meta.changes?json(null,204):json({error:"Registro não encontrado."},404)}
  return json({error:"Não encontrado."},404);
}

export default{async fetch(request,env){const url=new URL(request.url);try{if(url.pathname.startsWith("/api/"))return await handleApi(request,env,url,userId(request));if(request.method!=="GET")return new Response("Método não permitido",{status:405});if(url.pathname==="/"||url.pathname==="/index.html"||url.pathname==="/historico"||url.pathname==="/estatisticas")return asset(INDEX_HTML,"text/html; charset=utf-8");if(url.pathname==="/styles.css")return asset(STYLES_CSS,"text/css; charset=utf-8");if(url.pathname==="/app.js")return asset(APP_JS,"text/javascript; charset=utf-8");return new Response("Não encontrado",{status:404})}catch(error){console.error("Request failed",error);if(error?.message==="PAYLOAD_TOO_LARGE")return json({error:"Conteúdo muito grande."},413);if(error?.message==="INVALID_JSON")return json({error:"Dados inválidos."},400);return json({error:"Não foi possível concluir a ação. Tente novamente."},500)}}};
