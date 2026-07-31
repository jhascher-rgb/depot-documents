/**
 * DepotDoc - Passerelle Google Apps Script
 * -----------------------------------------
 * - doPost : recoit un depot et enregistre le fichier dans VOTRE Drive.
 * - doGet?action=list&root=ID : liste TOUS les fichiers (suivi cote admin).
 * - doGet?action=mine&root=ID&path=Campus/Groupe/Nom : liste UNIQUEMENT
 *      les fichiers du dossier indique (pour que l'etudiant revoie ses depots).
 *
 * Le script s'execute avec VOS droits ; les etudiants n'ont pas de compte Google.
 * DEPLOIEMENT : voir README (Application Web, Executer en tant que Moi, Acces Tout le monde).
 */

function doPost(e) {
  var out = { ok: false };
  try {
    var d = JSON.parse(e.postData.contents);
    var folder = DriveApp.getFolderById(d.root);
    (d.path || []).forEach(function (name) {
      if (name && String(name).trim()) folder = getOrCreate(folder, String(name).trim());
    });
    var bytes = Utilities.base64Decode(d.content);
    var blob = Utilities.newBlob(bytes, d.mimeType || 'application/octet-stream', d.filename);
    var file = folder.createFile(blob);
    out.ok = true;
    out.id = file.getId();
    out.name = file.getName();
  } catch (err) {
    out.error = String(err);
  }
  return json(out);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'list' && p.root) return json(listZone(p.root));
  if (p.action === 'mine' && p.root) return json(listFolder(p.root, p.path || ''));
  return json({ ok: true, msg: 'Passerelle DepotDoc active' });
}

/** Liste TOUS les fichiers sous la racine (suivi admin). */
function listZone(rootId) {
  try {
    var root = DriveApp.getFolderById(rootId);
    var files = [];
    collect(root, [], files, 0);
    return { ok: true, files: files };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function collect(folder, path, files, depth) {
  if (depth > 6) return;
  var fit = folder.getFiles();
  while (fit.hasNext()) {
    var f = fit.next();
    files.push({ path: path, name: f.getName(), date: f.getLastUpdated().toISOString() });
  }
  var dit = folder.getFolders();
  while (dit.hasNext()) {
    var d = dit.next();
    collect(d, path.concat([d.getName()]), files, depth + 1);
  }
}

/** Liste UNIQUEMENT les fichiers d'un dossier precis (root + chemin). */
function listFolder(rootId, pathStr) {
  try {
    var folder = DriveApp.getFolderById(rootId);
    var segs = pathStr ? pathStr.split('/') : [];
    for (var i = 0; i < segs.length; i++) {
      if (!segs[i]) continue;
      var it = folder.getFoldersByName(segs[i]);
      if (!it.hasNext()) return { ok: true, files: [] };  // dossier pas encore cree
      folder = it.next();
    }
    var files = [];
    var fit = folder.getFiles();
    while (fit.hasNext()) {
      var f = fit.next();
      files.push({ name: f.getName(), date: f.getLastUpdated().toISOString() });
    }
    return { ok: true, files: files };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function getOrCreate(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
