/* ============================================================================
   DepotDoc - logique partagee
   - Moteur de renommage
   - Encodage / decodage de la configuration des zones dans l'URL
   - Authentification Google (Google Identity Services)
   - Upload vers Google Drive (API multipart)
   Aucune dependance, aucun serveur : tout s'execute dans le navigateur.
   ==========================================================================*/

/* ----------------------------- Stockage local ---------------------------- */
const Store = {
  KEY_ZONES: 'depotdoc.zones',
  KEY_CLIENT: 'depotdoc.clientId',

  getClientId() {
    return localStorage.getItem(this.KEY_CLIENT) || '';
  },
  setClientId(id) {
    localStorage.setItem(this.KEY_CLIENT, (id || '').trim());
  },
  getZones() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY_ZONES)) || [];
    } catch (e) {
      return [];
    }
  },
  saveZones(zones) {
    localStorage.setItem(this.KEY_ZONES, JSON.stringify(zones));
  }
};

/* ---------------------------- Utilitaires ------------------------------- */
const Util = {
  uid() {
    return 'z' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  },

  // Encodage compatible URL de l'UTF-8 en base64 (gere les accents)
  b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  b64decode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return decodeURIComponent(escape(atob(str)));
  },

  pad(n, len = 3) {
    return String(n).padStart(len, '0');
  },

  // Nettoie un fragment de nom de fichier (retire les caracteres interdits)
  slug(s) {
    return (s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')       // accents
      .replace(/[\\/:*?"<>|]/g, '')                            // interdits
      .replace(/\s+/g, '-')                                    // espaces
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
  }
};

/* --------------------------- Config des zones --------------------------- */
// Une zone : { id, name, description, folderId, template, fields:{name,email}, maxMb }

const ZoneConfig = {
  // Version compacte encodee dans le lien de depot
  encode(zone, clientId) {
    const payload = {
      n: zone.name,
      d: zone.description || '',
      f: zone.folderId,
      t: zone.template,
      r: { n: !!(zone.fields && zone.fields.name), e: !!(zone.fields && zone.fields.email) },
      m: zone.maxMb || 25,
      c: clientId || Store.getClientId()
    };
    return Util.b64encode(JSON.stringify(payload));
  },

  decode(hash) {
    const p = JSON.parse(Util.b64decode(hash));
    return {
      name: p.n,
      description: p.d || '',
      folderId: p.f,
      template: p.t,
      fields: { name: !!(p.r && p.r.n), email: !!(p.r && p.r.e) },
      maxMb: p.m || 25,
      clientId: p.c || ''
    };
  },

  // Construit le lien public de depot
  depositLink(zone, clientId) {
    const base = location.href.replace(/admin\.html.*$/, '').replace(/#.*$/, '');
    return base + 'index.html#z=' + this.encode(zone, clientId);
  }
};

/* --------------------------- Moteur de renommage ------------------------ */
// Variables disponibles dans un modele :
//   {date} {time} {datetime} {year} {month} {day}
//   {zone} {name} {email} {original} {ext} {counter} {rand}

const Renamer = {
  variables: [
    ['{date}', 'Date du depot (2026-07-28)'],
    ['{time}', 'Heure (14-05-32)'],
    ['{datetime}', 'Date et heure'],
    ['{year}', 'Annee'], ['{month}', 'Mois'], ['{day}', 'Jour'],
    ['{zone}', 'Nom de la zone'],
    ['{name}', 'Nom du deposant'],
    ['{email}', 'Email du deposant'],
    ['{original}', "Nom d'origine du fichier"],
    ['{ext}', 'Extension'],
    ['{counter}', 'Numero sequentiel (001...)'],
    ['{rand}', 'Identifiant aleatoire']
  ],

  apply(template, ctx) {
    const d = ctx.date || new Date();
    const p = (n, l = 2) => String(n).padStart(l, '0');
    const dateStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const timeStr = `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
    const dot = ctx.original.lastIndexOf('.');
    const base = dot > 0 ? ctx.original.slice(0, dot) : ctx.original;
    const ext = dot > 0 ? ctx.original.slice(dot + 1) : '';

    const map = {
      '{date}': dateStr,
      '{time}': timeStr,
      '{datetime}': dateStr + '_' + timeStr,
      '{year}': d.getFullYear(),
      '{month}': p(d.getMonth() + 1),
      '{day}': p(d.getDate()),
      '{zone}': Util.slug(ctx.zone),
      '{name}': Util.slug(ctx.name),
      '{email}': Util.slug(ctx.email),
      '{original}': Util.slug(base),
      '{ext}': ext,
      '{counter}': Util.pad(ctx.counter || 1),
      '{rand}': Math.random().toString(36).slice(2, 7)
    };

    let out = (template || '{datetime}_{original}').replace(
      /\{(date|time|datetime|year|month|day|zone|name|email|original|ext|counter|rand)\}/g,
      (m) => (map[m] !== undefined ? map[m] : '')
    );

    // Nettoyage final : retire les separateurs orphelins dus aux champs vides
    out = out.replace(/[_-]{2,}/g, '_').replace(/^[_-]+|[_-]+$/g, '');
    if (ext && !out.toLowerCase().endsWith('.' + ext.toLowerCase())) {
      out += '.' + ext;
    }
    return out || ctx.original;
  }
};

/* ----------------------- Authentification Google ------------------------ */
const GDrive = {
  _tokenClient: null,
  _token: null,
  SCOPE: 'https://www.googleapis.com/auth/drive.file',

  init(clientId) {
    return new Promise((resolve, reject) => {
      if (!window.google || !google.accounts) {
        return reject(new Error('Bibliotheque Google non chargee.'));
      }
      this._tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: this.SCOPE,
        callback: () => {} // remplace a la demande
      });
      resolve();
    });
  },

  // Demande un jeton d'acces (ouvre la fenetre Google si necessaire)
  requestToken() {
    return new Promise((resolve, reject) => {
      if (!this._tokenClient) return reject(new Error('Client non initialise.'));
      this._tokenClient.callback = (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        this._token = resp.access_token;
        resolve(this._token);
      };
      this._tokenClient.requestAccessToken({ prompt: this._token ? '' : 'consent' });
    });
  },

  signOut() {
    if (this._token) {
      try { google.accounts.oauth2.revoke(this._token, () => {}); } catch (e) {}
    }
    this._token = null;
  },

  isSignedIn() {
    return !!this._token;
  },

  // Upload d'un fichier avec suivi de progression
  upload(file, filename, folderId, onProgress) {
    return new Promise((resolve, reject) => {
      const metadata = { name: filename };
      if (folderId) metadata.parents = [folderId];

      const boundary = '-------depotdoc' + Date.now();
      const delim = '\r\n--' + boundary + '\r\n';
      const close = '\r\n--' + boundary + '--';

      const reader = new FileReader();
      reader.onload = () => {
        const contentType = file.type || 'application/octet-stream';
        const bytes = new Uint8Array(reader.result);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);

        const body =
          delim +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delim +
          'Content-Type: ' + contentType + '\r\n' +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          base64 +
          close;

        const xhr = new XMLHttpRequest();
        xhr.open('POST',
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink');
        xhr.setRequestHeader('Authorization', 'Bearer ' + this._token);
        xhr.setRequestHeader('Content-Type', 'multipart/related; boundary=' + boundary);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Erreur Drive ' + xhr.status + ' : ' + xhr.responseText));
          }
        };
        xhr.onerror = () => reject(new Error('Erreur reseau pendant l\'envoi.'));
        xhr.send(body);
      };
      reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      reader.readAsArrayBuffer(file);
    });
  }
};
