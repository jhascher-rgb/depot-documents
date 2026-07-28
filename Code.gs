/**
 * DepotDoc - Passerelle Google Apps Script
 * -----------------------------------------
 * - doPost : recoit un depot et enregistre le fichier dans VOTRE Drive,
 *            en creant automatiquement l'arborescence des dossiers.
 * - doGet?action=list&root=ID : renvoie la liste des fichiers deposes
 *            (pour le suivi "qui a rendu quoi" dans le tableau de bord).
 *
 * Le script s'execute avec VOS droits : les etudiants n'ont pas besoin de
 * compte Google, et il n'y a aucune limite de perimetre.
 *
 * DEPLOIEMENT : voir README (Deployer > Application Web > Executer en tant
 * que Moi, Acces Tout le monde).
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
  return json({ ok: true, msg: 'Passerelle DepotDoc active' });
}

/** Parcourt le dossier racine et renvoie tous les fichiers avec leur chemin. */
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

function getOrCreate(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
