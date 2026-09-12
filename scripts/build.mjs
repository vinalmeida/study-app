import{mkdir,readFile,writeFile}from"node:fs/promises";import{join}from"node:path";
const root=process.cwd(),src=join(root,"src"),out=join(root,"dist","server");await mkdir(out,{recursive:true});
const [html,css,app,worker,favicon]=await Promise.all(["index.html","styles.css","app.js"].map(file=>readFile(join(src,file),"utf8")).concat(readFile(join(root,"worker","index.js"),"utf8"),readFile(join(root,"public","favicon.svg"),"utf8")));
await writeFile(join(out,"index.js"),`const INDEX_HTML=${JSON.stringify(html)};\nconst STYLES_CSS=${JSON.stringify(css)};\nconst APP_JS=${JSON.stringify(app)};\nconst FAVICON_SVG=${JSON.stringify(favicon)};\n${worker}`);
await writeFile(join(out,"wrangler.json"),JSON.stringify({name:"caderno-de-estudos",main:"index.js",compatibility_date:"2026-09-01",d1_databases:[{binding:"DB",database_name:"DB",database_id:"local"}]},null,2));
console.log("Build concluído em dist/server/index.js");
