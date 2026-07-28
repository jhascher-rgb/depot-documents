/* ============================================================================
   DepotDoc - logique partagee (version passerelle Apps Script)
   - Moteur de renommage
   - Encodage / decodage de la configuration des zones dans l'URL
   - Envoi des fichiers vers la passerelle Apps Script (qui ecrit dans le Drive)
   Aucun compte Google requis cote deposant. Tout s'execute dans le navigateur.
   ==========================================================================*/

/* ----------------------------- Stockage local ---------------------------- */
const Store = {
  KEY_ZONES: 'depotdoc.zones',
  KEY_GW: 'depotdoc.gateway',

  getGatewayUrl() { return localStorage.getItem(this.KEY_GW) || ''; },
  setGatewayUrl(u) { localStorage.setItem(this.KEY_GW, (u || '').trim()); },
  getZones() {
    try { return JSON.parse(localStorage.getItem(this.KEY_ZONES)) || []; }
    catch (e) { return []; }
  },
  saveZones(zones) { localStorage.setItem(this.KEY_ZONES, JSON.stringify(zones)); }
};

/* ---------------------------- Utilitaires ------------------------------- */
const Util = {
  uid() { return 'z' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); },

  b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  b64decode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return decodeURIComponent(escape(atob(str)));
  },
  pad(n, len = 3) { return String(n).padStart(len, '0'); },

  // Nettoie un fragment de NOM DE FICHIER (retire les caracteres interdits)
  slug(s) {
    return (s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
  },
  // Nettoie un NOM DE DOSSIER : garde les espaces/accents, retire l'interdit
  folderName(s) {
    return (s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  }
};

/* --------------------------- Config des zones --------------------------- */
// zone : { id, name, description, rootFolderId, template, structured,
//          campuses:[{name,groups:[]}], deliverables:[{name,deadline}],
//          fields:{name,email}, maxMb }

const ZoneConfig = {
  encode(zone, gatewayUrl) {
    const payload = {
      n: zone.name,
      d: zone.description || '',
      f: zone.rootFolderId || '',
      t: zone.template,
      m: zone.maxMb || 50,
      st: !!zone.structured,
      cp: (zone.structured && zone.campuses)
        ? zone.campuses.map((c) => ({ n: c.name, g: c.groups || [] })) : null,
      dl: (zone.deliverables && zone.deliverables.length)
        ? zone.deliverables.map((d) => ({ n: d.name, x: d.deadline || '' })) : null,
      r: { n: !!(zone.fields && zone.fields.name), e: !!(zone.fields && zone.fields.email) },
      g: gatewayUrl || Store.getGatewayUrl()
    };
    return Util.b64encode(JSON.stringify(payload));
  },

  decode(hash) {
    const p = JSON.parse(Util.b64decode(hash));
    return {
      name: p.n,
      description: p.d || '',
      rootFolderId: p.f || '',
      template: p.t,
      maxMb: p.m || 50,
      structured: !!p.st,
      campuses: (p.cp || []).map((c) => ({ name: c.n, groups: c.g || [] })),
      deliverables: (p.dl || []).map((d) => ({ name: d.n, deadline: d.x || '' })),
      hasDeliverables: !!(p.dl && p.dl.length),
      fields: { name: !!(p.r && p.r.n), email: !!(p.r && p.r.e) },
      gatewayUrl: p.g || ''
    };
  },

  depositLink(zone, gatewayUrl) {
    const base = location.href.replace(/admin\.html.*$/, '').replace(/#.*$/, '');
    return base + 'index.html#z=' + this.encode(zone, gatewayUrl);
  }
};

/* --------------------------- Moteur de renommage ------------------------ */
const Renamer = {
  variables: [
    ['{date}', 'Date du depot (2026-07-28)'],
    ['{time}', 'Heure (14-05-32)'],
    ['{datetime}', 'Date et heure'],
    ['{year}', 'Annee'], ['{month}', 'Mois'], ['{day}', 'Jour'],
    ['{zone}', 'Nom de la zone'],
    ['{campus}', 'Campus (Nice, Bordeaux...)'],
    ['{groupe}', 'Groupe'],
    ['{name}', "Nom de l'etudiant / deposant"],
    ['{email}', 'Email du deposant'],
    ['{livrable}', 'Nom du livrable'],
    ['{retard}', 'Marqueur EN-RETARD si hors delai'],
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
      '{campus}': Util.slug(ctx.campus),
      '{groupe}': Util.slug(ctx.groupe),
      '{name}': Util.slug(ctx.name),
      '{email}': Util.slug(ctx.email),
      '{livrable}': Util.slug(ctx.livrable),
      '{retard}': ctx.late ? 'EN-RETARD_' : '',
      '{original}': Util.slug(base),
      '{ext}': ext,
      '{counter}': Util.pad(ctx.counter || 1),
      '{rand}': Math.random().toString(36).slice(2, 7)
    };

    let out = (template || '{datetime}_{original}').replace(
      /\{(date|time|datetime|year|month|day|zone|campus|groupe|name|email|livrable|retard|original|ext|counter|rand)\}/g,
      (m) => (map[m] !== undefined ? map[m] : '')
    );
    out = out.replace(/[_-]{2,}/g, '_').replace(/^[_-]+|[_-]+$/g, '');
    if (ext && !out.toLowerCase().endsWith('.' + ext.toLowerCase())) out += '.' + ext;
    return out || ctx.original;
  }
};

/* ----------------------- Envoi vers la passerelle ----------------------- */
const Gateway = {
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const bytes = new Uint8Array(r.result);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        resolve(btoa(bin));
      };
      r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      r.readAsArrayBuffer(file);
    });
  },

  // Envoie un fichier deja encode en base64 vers la passerelle.
  // Content-Type text/plain => requete "simple" (pas de preflight CORS).
  send(url, payload, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let r = null;
        try { r = JSON.parse(xhr.responseText); } catch (e) { r = null; }
        if (r && r.ok) return resolve(r);
        if (r && r.error) return reject(new Error(r.error));
        if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true });
        reject(new Error('Reponse inattendue de la passerelle (' + xhr.status + ').'));
      };
      xhr.onerror = () => reject(new Error('Passerelle injoignable. Verifiez l\'URL et le deploiement du script.'));
      xhr.send(JSON.stringify(payload));
    });
  }
};
