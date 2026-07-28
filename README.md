# DepotDoc — application de dépôt de documents

Application web **sans serveur** qui permet de créer des zones de dépôt, de **renommer automatiquement** les fichiers reçus et de les **envoyer directement dans un dossier Google Drive**. Tout fonctionne dans le navigateur — hébergement **100 % gratuit** sur GitHub Pages.

## Aperçu

- **`admin.html`** — le tableau de bord privé où vous configurez vos zones et générez les liens à partager.
- **`index.html`** — la page publique de dépôt, ouverte par les déposants via un lien. Aucune configuration de leur côté.
- **`app.js` / `styles.css`** — logique et style partagés.

Chaque zone possède : un nom, une description, un **dossier Drive de destination**, un **modèle de renommage** personnalisable, et des champs facultatifs (nom / email du déposant).

---

## 1. Déploiement sur GitHub Pages (gratuit)

1. Créez un compte sur [github.com](https://github.com) si besoin.
2. Créez un nouveau dépôt (**New repository**), par exemple `depot-documents`, en **Public**.
3. Téléversez les fichiers **ainsi que le dossier `assets/`** (qui contient les logos `sup-photo.png` et `campus-11-arts.png`) : bouton **Add file → Upload files**, glissez l'ensemble, puis **Commit changes**. Les fichiers à envoyer sont : `index.html`, `admin.html`, `app.js`, `styles.css`, `README.md` et le dossier `assets/`.
4. Allez dans **Settings → Pages**.
5. Sous *Build and deployment*, choisissez **Source : Deploy from a branch**, branche **main**, dossier **/ (root)**, puis **Save**.
6. Au bout d'une minute, votre site est en ligne à une adresse du type :
   `https://VOTRE-COMPTE.github.io/depot-documents/`

Le tableau de bord est alors accessible à :
`https://VOTRE-COMPTE.github.io/depot-documents/admin.html`

> **Note :** notez bien cette adresse `.github.io`, elle sert à l'étape suivante.

---

## 2. Configurer l'accès à Google Drive (une seule fois)

Pour que les fichiers puissent être envoyés vers Drive, il faut créer un **identifiant client OAuth** gratuit dans Google Cloud. Cela prend ~10 minutes.

### a. Créer un projet
1. Ouvrez [console.cloud.google.com](https://console.cloud.google.com).
2. En haut, **Select a project → New project**. Donnez-lui un nom (ex. `DepotDoc`) et créez-le.

### b. Activer l'API Google Drive
1. Menu **APIs & Services → Library**.
2. Cherchez **Google Drive API** et cliquez **Enable**.

### c. Écran de consentement
1. **APIs & Services → OAuth consent screen**.
2. Type **External**, puis **Create**.
3. Renseignez le nom de l'application, votre email de support et votre email de contact. Enregistrez.
4. À l'étape *Scopes*, vous pouvez continuer sans rien ajouter.
5. À l'étape *Test users*, ajoutez les adresses Google qui déposeront des fichiers **tant que l'application est en mode Test** (voir la note plus bas).

### d. Créer l'identifiant client
1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Type d'application : **Web application**.
3. Sous **Authorized JavaScript origins**, ajoutez **exactement** l'origine de votre site, sans slash final :
   `https://VOTRE-COMPTE.github.io`
4. Cliquez **Create**. Copiez le **Client ID** affiché (il ressemble à `1234...-abcd.apps.googleusercontent.com`).

### e. Renseigner l'identifiant dans l'application
1. Ouvrez `admin.html` de votre site.
2. Collez le **Client ID** dans le champ *Identifiant client OAuth* et **Enregistrez**.

> **Mode Test vs Publication :** en mode « Test », seuls les comptes Google ajoutés en *Test users* peuvent déposer. Pour ouvrir à tout le monde, revenez à *OAuth consent screen* et cliquez **Publish app**. Comme l'application ne demande que le périmètre `drive.file` (accès uniquement aux fichiers qu'elle crée), aucune validation Google lourde n'est requise pour un usage courant.

---

## 3. Créer une zone de dépôt

1. Dans `admin.html`, cliquez **+ Nouvelle zone**.
2. Renseignez :
   - **Nom** (ex. *Inscriptions 2026*)
   - **Description** affichée au déposant
   - **Dossier Drive** : ouvrez le dossier voulu dans Google Drive et copiez l'identifiant depuis l'URL :
     `drive.google.com/drive/folders/`**`1AbCdEf...`** ← c'est cet identifiant qu'il faut coller.
   - **Modèle de renommage** (voir ci-dessous)
   - Les **informations demandées** au déposant (nom, email)
3. **Enregistrez**, puis cliquez sur l'icône 🔗 pour obtenir le **lien de dépôt** à partager.

> Le déposant doit avoir le **droit d'écriture** sur le dossier Drive. Le plus simple : partagez le dossier Drive en « **Tous les utilisateurs disposant du lien → Éditeur** », ou ajoutez nommément les personnes concernées.

---

## 4. Modèle de renommage

Le nom final se compose en assemblant des variables entre accolades. Exemple :

`{date}_{zone}_{name}_{original}` → `2026-07-28_Inscriptions-2026_Marie-Dupont_Mon-Dossier.pdf`

| Variable      | Résultat                          |
|---------------|-----------------------------------|
| `{date}`      | `2026-07-28`                      |
| `{time}`      | `14-05-32`                        |
| `{datetime}`  | `2026-07-28_14-05-32`             |
| `{year}` `{month}` `{day}` | composants de date   |
| `{zone}`      | nom de la zone                    |
| `{name}`      | nom du déposant                   |
| `{email}`     | email du déposant                 |
| `{original}`  | nom d'origine du fichier          |
| `{ext}`       | extension                         |
| `{counter}`   | numéro séquentiel (`001`, `002`…) |
| `{rand}`      | identifiant aléatoire court       |

Les accents et caractères interdits sont automatiquement nettoyés, et l'extension d'origine est toujours conservée. Un aperçu en direct s'affiche pendant que vous éditez le modèle.

---

## 5. Sauvegarde de la configuration

Les zones sont enregistrées **dans le navigateur** où vous utilisez `admin.html`. Pour les conserver ou les transférer sur un autre poste, utilisez les liens **Exporter / Importer** en bas du tableau de bord (fichier `depotdoc-config.json`).

---

## Sécurité & confidentialité

- L'application ne stocke **aucune donnée sur un serveur** : le lien de dépôt contient la configuration de la zone, et l'envoi se fait de navigateur à Google Drive.
- Le périmètre OAuth utilisé est `drive.file` : l'application ne voit **que les fichiers qu'elle dépose**, jamais le reste du Drive.
- Le déposant s'authentifie avec **son propre compte Google**.

## Dépannage

- **« Connexion Google impossible »** : vérifiez que l'origine `https://VOTRE-COMPTE.github.io` est bien dans *Authorized JavaScript origins* (sans slash final), et que le Client ID est correct.
- **« Erreur Drive 403/404 »** : le déposant n'a pas accès au dossier. Partagez le dossier Drive en écriture.
- **Le lien affiche « invalide »** : régénérez-le depuis le tableau de bord (le format a pu changer).
