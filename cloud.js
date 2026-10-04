// Partage d'équipe en ligne pour AccordGo (Supabase, sans bibliothèque externe).
// Actif seulement si config.js contient l'adresse et la clé du projet Supabase.
(function () {
  "use strict";
  var cfg = window.EAGLE_CONFIG || {};
  var slot = document.getElementById("cloudSlot");
  if (!slot || !/^https:\/\//.test(cfg.supabaseUrl || "") || !cfg.supabaseKey || !window.EAGLE) return;

  var base = cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/";
  var KEY = "eagle-studio:cloud:v1";
  var conf = { code: "", key: "" };
  try {
    var r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (r && typeof r === "object") conf = { code: String(r.code || ""), key: String(r.key || "") };
  } catch (e) {}
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(conf)); } catch (e) {} }
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function rpc(fn, body) {
    var headers = { "Content-Type": "application/json", apikey: cfg.supabaseKey };
    // Les anciennes clés « anon » sont des JWT (eyJ…) ; les nouvelles « publishable » (sb_publishable_…) vont seulement dans apikey.
    if (/^eyJ/.test(cfg.supabaseKey)) headers.Authorization = "Bearer " + cfg.supabaseKey;
    return fetch(base + fn, { method: "POST", headers: headers, body: JSON.stringify(body) }).then(function (res) {
      return res.text().then(function (t) {
        var d = null;
        try { d = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) throw new Error((d && d.message) || t || ("Erreur " + res.status));
        return d;
      });
    });
  }
  function friendly(err) {
    var m = String((err && err.message) || err || "");
    if (/acces refuse/i.test(m)) return "Code d'équipe ou clé de publication incorrect.";
    if (/trop volumineux/i.test(m)) return "Ce programme est trop volumineux.";
    if (/failed to fetch|networkerror|load failed|network request/i.test(m)) return "Pas de connexion internet.";
    return "Erreur : " + m;
  }

  var style = document.createElement("style");
  style.textContent =
    ".cl-item{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)}" +
    ".cl-item strong{display:block;font-family:var(--serif);font-size:17px}" +
    ".cl-item span{color:var(--muted);font-size:14px}" +
    ".cl-btns{display:flex;gap:8px;flex:none}" +
    ".cl-btns button{min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:12px;background:none;color:var(--ink)}";
  document.head.appendChild(style);

  slot.innerHTML =
    "<h2 class='group'>Équipe (partage en ligne)</h2>" +
    "<p class='hint' style='text-align:left'>Le chanteur publie le programme, et toute l'équipe le reçoit avec le code de l'équipe. Les musiciens n'ont besoin que du code. Seule la personne qui publie a besoin de la clé de publication.</p>" +
    "<label class='param' style='display:block'><span class='plabel'>Code de l'équipe</span><input class='inp' id='cloudCode' autocomplete='off' autocapitalize='off' spellcheck='false'></label>" +
    "<label class='param' style='display:block'><span class='plabel'>Clé de publication (chanteur ou responsable)</span><input class='inp' id='cloudKey' type='password' autocomplete='off' spellcheck='false'></label>" +
    "<div class='actions' style='margin-top:12px'><button type='button' class='secondary' data-act='save'>Enregistrer</button><button type='button' class='primary' data-act='fetch'>Recevoir les programmes</button></div>" +
    "<div id='cloudList'></div>" +
    "<h2 class='group'>Publier un programme</h2>" +
    "<label class='row-label' for='cloudPick'><span>Liste à publier</span><select class='sel' id='cloudPick'></select></label>" +
    "<button type='button' class='primary' data-act='publish' style='margin-top:12px'>Publier pour l'équipe</button>" +
    "<p class='hint' id='cloudMsg' style='text-align:left' role='status'></p>";

  function $(id) { return slot.querySelector("#" + id); }
  function msg(t) { $("cloudMsg").textContent = t; }
  $("cloudCode").value = conf.code;
  $("cloudKey").value = conf.key;

  function readFields() {
    conf.code = $("cloudCode").value.trim();
    conf.key = $("cloudKey").value.trim();
    persist();
  }
  function refreshPick() {
    var sel = $("cloudPick"), lists = window.EAGLE.lists(), cur = sel.value;
    sel.innerHTML = "";
    lists.forEach(function (l) {
      var o = document.createElement("option");
      o.value = l.id; o.textContent = l.name + (l.date ? " · " + l.date : "");
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }
  refreshPick();
  slot.addEventListener("focusin", function (e) { if (e.target && e.target.id === "cloudPick") refreshPick(); });

  function when(iso) {
    try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ""; }
  }

  function renderList(rows) {
    var box = $("cloudList");
    box.innerHTML = "";
    if (!rows || !rows.length) { box.innerHTML = "<p class='hint' style='text-align:left'>Aucun programme publié pour cette équipe.</p>"; return; }
    rows.forEach(function (p) {
      var d = document.createElement("div");
      d.className = "cl-item";
      var meta = [p.prog_date, p.leader, when(p.updated_at)].filter(Boolean).join(" · ");
      d.innerHTML = "<div><strong>" + esc(p.prog_name) + "</strong><span>" + esc(meta) + "</span></div>" +
        "<div class='cl-btns'><button type='button' data-act='add' data-id='" + esc(p.id) + "'>Ajouter</button>" +
        (conf.key ? "<button type='button' data-act='del' data-id='" + esc(p.id) + "' aria-label='Supprimer ce programme publié'>✕</button>" : "") + "</div>";
      box.appendChild(d);
    });
  }

  function doFetch() {
    readFields();
    if (!conf.code) { msg("Entre d'abord le code de l'équipe."); return; }
    msg("Recherche des programmes…");
    rpc("eagle_list", { p_code: conf.code }).then(function (rows) {
      renderList(rows);
      msg(rows && rows.length ? "Touche « Ajouter » pour recevoir un programme." : "");
    }).catch(function (e) { msg(friendly(e)); });
  }

  slot.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el) return;
    var act = el.dataset.act;
    if (act === "save") { readFields(); msg("Enregistré sur cet appareil."); }
    else if (act === "fetch") doFetch();
    else if (act === "add") {
      msg("Réception du programme…");
      rpc("eagle_get", { p_code: conf.code, p_id: el.dataset.id }).then(function (pk) {
        if (!pk) { msg("Ce programme n'existe plus."); return; }
        msg(window.EAGLE.importPackage(pk));
      }).catch(function (er) { msg(friendly(er)); });
    }
    else if (act === "del") {
      if (el.dataset.sure !== "1") { el.dataset.sure = "1"; el.textContent = "Sûr ?"; setTimeout(function () { el.dataset.sure = ""; el.textContent = "✕"; }, 3000); return; }
      rpc("eagle_delete", { p_code: conf.code, p_key: conf.key, p_id: el.dataset.id })
        .then(function () { msg("Programme supprimé."); doFetch(); })
        .catch(function (er) { msg(friendly(er)); });
    }
    else if (act === "publish") {
      readFields();
      if (!conf.code || !conf.key) { msg("Entre le code de l'équipe et la clé de publication."); return; }
      var id = $("cloudPick").value, list = window.EAGLE.lists().filter(function (l) { return l.id === id; })[0];
      if (!list) { msg("Choisis une liste à publier."); return; }
      if (!list.ids.length) { msg("Cette liste est vide."); return; }
      var pk = window.EAGLE.buildPackage(list);
      msg("Publication…");
      rpc("eagle_publish", { p_code: conf.code, p_key: conf.key, p_name: pk.name, p_date: pk.date || "", p_leader: pk.leader || "", p_payload: pk })
        .then(function () { msg("Programme « " + pk.name + " » publié. L'équipe peut le recevoir avec le code."); })
        .catch(function (er) { msg(friendly(er)); });
    }
  });
})();
