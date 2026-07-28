# DepotDoc — application de dépôt de documents

Application web qui permet de créer des zones de dépôt, de **renommer automatiquement** les fichiers reçus et de les **ranger dans un dossier Google Drive** en créant l'arborescence (campus / groupe / étudiant, livrables…). L'interface est hébergée gratuitement sur **GitHub Pages** ; l'enregistrement dans le Drive passe par une **passerelle Google Apps Script** déployée sur votre compte.

Avantage clé de cette approche : **les déposants n'ont pas besoin de compte Google**, et les dossiers se créent tout seuls, sans doublon.

## Les fichiers

- **`admin.html`** — tableau de bord privé : zones, campus/groupes, livrables, liens à partager.
- **`index.html`** — page publique de dépôt, ouverte par un lien.
- **`app.js` / `styles.css`** — logique et style.
- **`Code.gs`** — le script de la passerelle, à déployer sur Google Apps Script.

---

## 1. Déployer la passerelle (Apps Script) — une seule fois

C'est ce qui autorise l'écriture dans **votre** Drive.

1. Ouvrez [script.google.com](https://script.google.com) → **Nouveau projet**.
2. Supprimez le code par défaut et **collez tout le contenu de `Code.gs`**.
3. Cliquez **Déployer → Nouveau déploiement**.
4. Choisissez le type **Application Web** (icône engrenage → *Application Web*), avec :
   - **Exécuter en tant que : Moi**
   - **Qui a accès : Tout le monde**
5. **Déployer**, puis autorisez l'accès à votre Drive quand Google le demande. (Comme c'est votre propre script, passez l'écran « Google n'a pas validé cette application » via **Paramètres avancés → Accéder au projet**.)
6. Copiez l'**URL de l'application Web** (elle se termine par `/exec`).

---

## 2. Héberger l'interface sur GitHub Pages (gratuit)

1. Créez un dépôt public sur [github.com](https://github.com) (ex. `depot-documents`).
2. Téléversez `index.html`, `admin.html`, `app.js`, `styles.css`, `README.md`, `Code.gs` et les logos `sup-photo.png` / `campus-11-arts.png`.
3. **Settings → Pages → Source : Deploy from a branch → main → /(root) → Save**.
4. Le site est en ligne à `https://VOTRE-COMPTE.github.io/depot-documents/` (tableau de bord : `.../admin.html`).

---

## 3. Configurer le tableau de bord

1. Ouvrez `admin.html`.
2. Dans **Passerelle Google Drive**, collez l'URL de l'application Web (`/exec`) et **Enregistrez**. Le bouton **Tester la passerelle** confirme qu'elle répond.
3. Créez une **zone** :
   - **Dossier Drive racine** : ouvrez le dossier voulu dans votre Drive et copiez son identifiant depuis l'URL `drive.google.com/drive/folders/`**`IDENTIFIANT`**.
   - **Organiser en Campus / Groupe / Étudiant** : définissez vos campus et, pour chacun, ses groupes (l'étudiant les choisira dans des menus).
   - **Livrables attendus** (optionnel) : nom + deadline pour chacun.
   - **Modèle de renommage** des fichiers.
4. Cliquez sur 🔗 pour obtenir le **lien de dépôt** à partager.

Les dossiers (campus, groupe, dossier au nom de l'étudiant) sont créés **automatiquement** dans votre Drive au premier dépôt.

---

## 4. Modèle de renommage

Assemblez des variables entre accolades, par ex. `{retard}{livrable}_{name}_{original}` :

| Variable | Résultat |
|---|---|
| `{date}` `{time}` `{datetime}` | date / heure du dépôt |
| `{campus}` `{groupe}` | campus et groupe choisis |
| `{name}` | nom de l'étudiant |
| `{livrable}` | nom du livrable |
| `{retard}` | `EN-RETARD_` si déposé après la deadline |
| `{original}` `{ext}` `{counter}` `{rand}` | nom d'origine, extension, compteur, aléatoire |

Les accents et caractères interdits sont nettoyés ; l'extension d'origine est conservée.

---

## Deadlines

Chaque livrable peut avoir une date limite. Le dépôt **reste possible après la deadline**, mais le fichier est marqué **« en retard »** (badge à l'écran + préfixe `EN-RETARD_` dans le nom du fichier).

## Notes

- Taille max ~50 Mo par fichier (limite de la passerelle Apps Script).
- Les configurations du tableau de bord sont stockées **dans votre navigateur** ; utilisez **Exporter / Importer** pour les sauvegarder ou changer de poste.
- Sécurité : la passerelle n'écrit que dans les dossiers que vous configurez, avec vos droits ; elle ne lit rien d'autre.

## Dépannage

- **« Passerelle injoignable »** : revérifiez l'URL (`/exec`) et que le déploiement est en *Exécuter en tant que : Moi* / *Accès : Tout le monde*.
- **Erreur au dépôt** : vérifiez que l'identifiant du dossier racine est correct et appartient au compte qui a déployé la passerelle.
- **Après une modification du code** : les fichiers `app.js`/`styles.css` sont versionnés (`?v=`) pour éviter les problèmes de cache navigateur.
