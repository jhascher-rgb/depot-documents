/**
 * DepotDoc — Passerelle Google Apps Script
 * -----------------------------------------
 * Recoit les depots depuis le site (GitHub Pages) et enregistre les fichiers
 * dans VOTRE Google Drive, en creant automatiquement l'arborescence des dossiers.
 *
 * Le script s'execute avec VOS droits : les etudiants n'ont pas besoin de compte
 * Google, et il n'y a aucune limite de perimetre (drive.file).
 *
 * DEPLOIEMENT (une seule fois) :
 *   1. script.google.com  ->  Nouveau projet
 *   2. Collez tout ce fichier dans l'editeur (remplacez le contenu par defaut).
 *   3. Deployer  ->  Nouveau deploiement  ->  Type : Application Web
 *        - Executer en tant que : Moi
 *        - Qui a acces : Tout le monde
 *   4. Autorisez l'acces a votre Drive quand Google le demande.
 *   5. Copiez l'URL de l'application Web (se termine par /exec) et collez-la
 *      dans le tableau de bord DepotDoc (champ « URL de la passerelle »).
 */

function doPost(e) {
  var out = { ok: false };
  try {
    var d = JSON.parse(e.postData.contents);

    // Dossier racine (vous en etes proprietaire => acces complet)
    var folder = DriveApp.getFolderById(d.root);

    // Cree/retrouve chaque niveau de l'arborescence (campus, groupe, etudiant...)
    (d.path || []).forEach(function (name) {
      if (name && String(name).trim()) folder = getOrCreate(folder, String(name).trim());
    });

    // Enregistre le fichier
    var bytes = Utilities.base64Decode(d.content);
    var blob = Utilities.newBlob(bytes, d.mimeType || 'application/octet-stream', d.filename);
    var file = folder.createFile(blob);

    out.ok = true;
    out.id = file.getId();
    out.name = file.getName();
  } catch (err) {
    out.error = String(err);
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Retourne le sous-dossier existant portant ce nom, sinon le cree. */
function getOrCreate(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** Petit point de controle pour verifier que la passerelle est active. */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: 'Passerelle DepotDoc active' }))
    .setMimeType(ContentService.MimeType.JSON);
}
