/* ============================================================
   Hapvida Learn — autenticação + progresso (Supabase)
   Inclua com: <script src="hl-auth.js"></script>
   Deriva o capítulo do nome do arquivo (ou window.HL_CAP).
   API: window.HL.recordAssistido() · HL.recordQuiz(acertos,total)
        HL.logout() · HL.perfil · HL.user · evento 'hl:ready'
   ============================================================ */
(function () {
  var SUPA_URL = "https://xqmhzvkzjkkzwqhbyneo.supabase.co";
  var SUPA_KEY = "sb_publishable_hbPdC6CRhyY2tPGAAJL0dA_2wG7lcuR";
  var CAP = (window.HL_CAP || location.pathname.split("/").pop().replace(/\.html$/, "") || "index");

  var sb = null, user = null, perfil = null, gate = null;
  var HL = { ready: false, cap: CAP };
  window.HL = HL;

  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }

  var CSS = "\
  #hlGate{position:fixed;inset:0;z-index:99999;background:linear-gradient(160deg,#013ba6,#0a2a6b);display:flex;\
   align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}\
  #hlGate.hlHidden{display:none}\
  #hlGate .box{background:#fff;border-radius:22px;padding:30px 28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.3)}\
  #hlGate .brand{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:4px}\
  #hlGate .brand b{color:#013ba6;font-size:22px;font-weight:800}\
  #hlGate .brand span{color:#e8720c;font-size:22px;font-weight:800}\
  #hlGate .sub{text-align:center;color:#5b6b82;font-size:13px;margin-bottom:18px}\
  #hlGate .tabs{display:flex;background:#eef2f9;border-radius:12px;padding:4px;margin-bottom:16px}\
  #hlGate .tabs button{flex:1;border:0;background:transparent;padding:9px;border-radius:9px;font-size:14px;font-weight:600;color:#5b6b82;cursor:pointer}\
  #hlGate .tabs button.on{background:#fff;color:#013ba6;box-shadow:0 1px 4px rgba(0,0,0,.1)}\
  #hlGate label{display:block;font-size:12px;color:#5b6b82;font-weight:600;margin:10px 0 4px}\
  #hlGate input{width:100%;padding:12px 14px;font-size:15px;border:2px solid #e4ebf5;border-radius:11px;outline:none;box-sizing:border-box}\
  #hlGate input:focus{border-color:#0956c6}\
  #hlGate .go{width:100%;margin-top:18px;padding:13px;border:0;border-radius:11px;background:#013ba6;color:#fff;font-size:15px;font-weight:700;cursor:pointer}\
  #hlGate .go:disabled{opacity:.6;cursor:default}\
  #hlGate .msg{margin-top:12px;font-size:13px;text-align:center;min-height:16px}\
  #hlGate .msg.err{color:#c0392b}#hlGate .msg.ok{color:#0f6e56}\
  #hlGate .foot{margin-top:14px;text-align:center;font-size:11px;color:#9aa7ba}\
  #hlGate [data-panel]{display:none}#hlGate [data-panel].on{display:block}";

  var HTML = '\
  <div class="box">\
    <div class="brand"><span>❋</span><b>Hapvida Learn</b></div>\
    <div class="sub">Academia de Vendas · acesso do time</div>\
    <div class="tabs"><button data-tab="login" class="on">Entrar</button><button data-tab="signup">Criar conta</button></div>\
    <div data-panel="login" class="on">\
      <label>E-mail corporativo</label><input type="email" id="hlLE" placeholder="nome@hapvida.com.br" autocomplete="email">\
      <label>Senha</label><input type="password" id="hlLP" placeholder="sua senha" autocomplete="current-password">\
      <button class="go" id="hlLbtn">Entrar</button>\
    </div>\
    <div data-panel="signup">\
      <label>Nome completo</label><input type="text" id="hlSN" placeholder="Seu nome">\
      <label>E-mail corporativo</label><input type="email" id="hlSE" placeholder="nome@hapvida.com.br">\
      <label>Senha (mín. 6)</label><input type="password" id="hlSP" placeholder="crie uma senha">\
      <label>Código da equipe</label><input type="text" id="hlSC" placeholder="ex.: VEND2026" style="text-transform:uppercase">\
      <button class="go" id="hlSbtn">Criar conta</button>\
    </div>\
    <div data-panel="code">\
      <div class="sub" style="margin-bottom:0">Falta vincular sua equipe.</div>\
      <label>Código da equipe</label><input type="text" id="hlCC" placeholder="ex.: VEND2026" style="text-transform:uppercase">\
      <button class="go" id="hlCbtn">Confirmar</button>\
    </div>\
    <div class="msg" id="hlMsg"></div>\
    <div class="foot">Seus dados são protegidos e usados só para o acompanhamento da capacitação.</div>\
  </div>';

  function q(id){ return document.getElementById(id); }
  function msg(t, cls){ var m=q("hlMsg"); m.textContent=t||""; m.className="msg"+(cls?" "+cls:""); }
  function showPanel(name){
    var box=gate.querySelector(".box");
    box.querySelectorAll("[data-panel]").forEach(function(p){ p.classList.toggle("on", p.getAttribute("data-panel")===name); });
    gate.querySelectorAll(".tabs button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-tab")===name); });
    msg("");
  }

  function injectGate(){
    if(gate) return;
    var st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);
    gate=document.createElement("div"); gate.id="hlGate"; gate.innerHTML=HTML; document.body.appendChild(gate);
    gate.querySelectorAll(".tabs button").forEach(function(b){ b.onclick=function(){ showPanel(b.getAttribute("data-tab")); }; });
    q("hlLbtn").onclick=doLogin; q("hlSbtn").onclick=doSignup; q("hlCbtn").onclick=doCode;
    q("hlLP").addEventListener("keydown",function(e){ if(e.key==="Enter") doLogin(); });
    q("hlSC").addEventListener("keydown",function(e){ if(e.key==="Enter") doSignup(); });
  }
  function hideGate(){ if(gate) gate.classList.add("hlHidden"); }

  async function ensurePerfil(){
    var r=await sb.from("perfis").select("nome,papel,aprovado,equipe_id").eq("id",user.id).maybeSingle();
    perfil=r.data||null; HL.perfil=perfil; return perfil;
  }
  async function tryPending(){
    var code=localStorage.getItem("hl_pcode"), nome=localStorage.getItem("hl_pnome");
    if(code){
      try{ await sb.rpc("registrar_perfil",{p_nome:nome||user.email,p_codigo:code}); }catch(e){}
      localStorage.removeItem("hl_pcode"); localStorage.removeItem("hl_pnome");
      await ensurePerfil();
    }
  }
  // Progressão sequencial: só libera um capítulo após concluir o anterior (assistir + quiz)
  var ORDER=["cap3-institucional","cap1-portabilidade","cap2-nosso-medico","cap4-produtos-sp","cap5-produtos-bh","cap6-ppo"];
  async function prereqPendente(){
    var i=ORDER.indexOf(CAP);
    if(i<=0) return null;                 // index/gestao ou 1º capítulo → nunca bloqueia
    var prev=ORDER[i-1];
    try{
      var r=await sb.from("progresso").select("assistido,quiz_feito").eq("usuario_id",user.id).eq("capitulo",prev).maybeSingle();
      var d=r.data;
      if(d && d.assistido && d.quiz_feito) return null;   // anterior concluído → liberado
    }catch(e){ return null; }             // em erro, não bloqueia
    return prev;                          // bloqueado
  }
  function showLock(){
    var st=document.createElement("style");
    st.textContent="#hlLock{position:fixed;inset:0;z-index:100000;background:linear-gradient(160deg,#013ba6,#0a2a6b);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}#hlLock .b{background:#fff;border-radius:22px;padding:34px 30px;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35)}#hlLock .i{font-size:42px}#hlLock h2{color:#013ba6;margin:10px 0 6px;font-size:20px}#hlLock p{color:#5b6b82;font-size:14px;line-height:1.55;margin-bottom:20px}#hlLock a{display:inline-block;background:#013ba6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:11px;font-weight:700;font-size:14px}";
    document.head.appendChild(st);
    var d=document.createElement("div"); d.id="hlLock";
    d.innerHTML='<div class="b"><div class="i">🔒</div><h2>Capítulo bloqueado</h2><p>A trilha segue em ordem: conclua o <b>capítulo anterior</b> (assistir o vídeo + fazer o quiz) para liberar este.</p><a href="index.html">← Voltar aos capítulos</a></div>';
    document.body.appendChild(d);
  }
  async function finish(){
    if(user) HL.user=user;
    if(ORDER.indexOf(CAP)>0){
      var prev=await prereqPendente();
      if(prev){ hideGate(); showLock(); return; }   // não libera o player
    }
    HL.ready=true; hideGate(); document.dispatchEvent(new Event("hl:ready")); if(typeof window.HL_onReady==="function"){ try{window.HL_onReady(perfil);}catch(e){} }
  }

  async function doLogin(){
    var email=q("hlLE").value.trim(), pw=q("hlLP").value;
    if(!email||!pw){ msg("Preencha e-mail e senha.","err"); return; }
    q("hlLbtn").disabled=true; msg("Entrando…");
    var r=await sb.auth.signInWithPassword({email:email,password:pw});
    q("hlLbtn").disabled=false;
    if(r.error){ msg("E-mail ou senha inválidos.","err"); return; }
    user=r.data.user; await tryPending(); await ensurePerfil();
    if(!perfil){ showPanel("code"); return; }
    finish();
  }
  async function doSignup(){
    var nome=q("hlSN").value.trim(), email=q("hlSE").value.trim(), pw=q("hlSP").value, code=q("hlSC").value.trim().toUpperCase();
    if(!nome||!email||!pw||!code){ msg("Preencha todos os campos.","err"); return; }
    if(pw.length<6){ msg("A senha deve ter ao menos 6 caracteres.","err"); return; }
    q("hlSbtn").disabled=true; msg("Criando conta…");
    var r=await sb.auth.signUp({email:email,password:pw});
    if(r.error){ q("hlSbtn").disabled=false; msg(r.error.message.indexOf("registered")>-1?"E-mail já cadastrado — use Entrar.":r.error.message,"err"); return; }
    if(r.data.session){
      user=r.data.session.user;
      try{ await sb.rpc("registrar_perfil",{p_nome:nome,p_codigo:code}); }
      catch(e){ q("hlSbtn").disabled=false; msg("Código de equipe inválido.","err"); await sb.auth.signOut(); user=null; return; }
      await ensurePerfil(); finish();
    } else {
      localStorage.setItem("hl_pcode",code); localStorage.setItem("hl_pnome",nome);
      q("hlSbtn").disabled=false;
      msg("Conta criada! Confirme o e-mail que enviamos e depois faça login.","ok");
      showPanel("login");
    }
  }
  async function doCode(){
    var code=q("hlCC").value.trim().toUpperCase();
    if(!code){ msg("Informe o código da equipe.","err"); return; }
    q("hlCbtn").disabled=true; msg("Validando…");
    try{ await sb.rpc("registrar_perfil",{p_nome:user.email,p_codigo:code}); }
    catch(e){ q("hlCbtn").disabled=false; msg("Código de equipe inválido.","err"); return; }
    await ensurePerfil(); if(perfil){ finish(); } else { q("hlCbtn").disabled=false; msg("Não foi possível vincular. Tente de novo.","err"); }
  }

  HL.logout=async function(){ try{ await sb.auth.signOut(); }catch(e){} location.reload(); };
  HL.recordAssistido=async function(){
    if(!sb||!user) return;
    try{ await sb.from("progresso").upsert({usuario_id:user.id,capitulo:CAP,assistido:true,assistido_em:new Date().toISOString(),atualizado_em:new Date().toISOString()},{onConflict:"usuario_id,capitulo"}); }catch(e){ console.warn("HL assistido",e); }
  };
  HL.recordQuiz=async function(acertos,total){
    if(!sb||!user) return;
    try{ await sb.from("progresso").upsert({usuario_id:user.id,capitulo:CAP,assistido:true,quiz_feito:true,quiz_acertos:acertos,quiz_total:total,quiz_em:new Date().toISOString(),atualizado_em:new Date().toISOString()},{onConflict:"usuario_id,capitulo"}); }catch(e){ console.warn("HL quiz",e); }
  };

  async function boot(){
    try{ await load("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"); }
    catch(e){ console.error("Falha ao carregar Supabase",e); return; }
    sb=window.supabase.createClient(SUPA_URL,SUPA_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"hl_auth"}});
    HL.sb=sb;
    var s=(await sb.auth.getSession()).data.session;
    if(s){ user=s.user; await tryPending(); await ensurePerfil(); if(perfil){ finish(); return; } }
    injectGate();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();
})();
