/*global $,Uint8Array,ace,marked,hljs,document,window,XMLHttpRequest,initSqlJs*/
(async function () {
    "use strict";
    
    const SQL = await initSqlJs({
        locateFile: file => `lib/${file}`
    });

    var ecran, hauteur, db, editeur, petit = false, historiqueRequetes = [];
    // Cache du schéma (tables -> colonnes)
    var schemaCache = null;

    // Récupère le schéma de la base courante (synchronous, utilise sql.js API)
    function buildSchema() {
        schemaCache = { tables: [] };
        if (!db) {
            return schemaCache;
        }
        try {
            var tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            if (!tablesRes || !tablesRes[0] || !tablesRes[0].values) {
                return schemaCache;
            }
            var tableNames = tablesRes[0].values.map(function (r) { return r[0]; });
            tableNames.forEach(function (t) {
                try {
                    var colsRes = db.exec("PRAGMA table_info('" + t.replace(/'/g, "''") + "')");
                    var cols = [];
                    if (colsRes && colsRes[0] && colsRes[0].values) {
                        cols = colsRes[0].values.map(function (r) { return r[1]; });
                    }
                    schemaCache.tables.push({ name: t, columns: cols });
                } catch (e) {
                    console.warn('Erreur récupération colonnes pour', t, e);
                }
            });
        } catch (e) {
            console.warn('Impossible de construire le schéma', e);
        }
        return schemaCache;
    }

    function getSchema() {
        if (!schemaCache) {
            return buildSchema();
        }
        return schemaCache;
    }
    
    function tropPetit() {
        petit = true;
        ecran.html("Taille de la fenêtre inadaptée à cette application");
    }
    
    marked.setOptions({
        highlight: function (code) {
            return hljs.highlightAuto(code).value;
        }
    });
    
    // Transformation du résultat d'une requête en une table HTML
    function sql2table(resultat, identifiant, tableContenu) {
        var table, tableHead, tableAttributs, tableLignes;
        if (resultat) {
            table = $("<table>").attr("id", identifiant).attr("class", "display");
            tableHead = $("<thead>");
            table.append(tableHead);
            tableAttributs = $("<tr>");
            tableHead.append(tableAttributs);
            $.each(resultat.columns, function (i, e) {
                tableAttributs.append($("<th>").html(e));
            });
            
            tableLignes = $("<tbody>");
            table.append(tableLignes);
            $.each(resultat.values, function (i, t) {
                var ligne = $("<tr>");
                $.each(t, function (i, e) {
                    var td = $("<td>").html(e);
                    if ((tableContenu) && (i === 0)) {
                        td.click(function () {
                            editeur.setValue("SELECT *\n\tFROM " + e + ";");
                            editeur.gotoLine(1);
                        });
                    }
                    ligne.append(td);
                });
                tableLignes.append(ligne);
            });
        }
        return (table);
    }

    // Résolution simple d'alias -> table (scanne FROM/JOIN pour trouver la table associée à l'alias)
    function resolveAliasToTable(editorText, alias) {
        try {
            var map = parseFromAliases(editorText);
            if (map && map.aliases && map.aliases[alias]) return map.aliases[alias];
        } catch (e) {
            // fallback to regex simple
            var re = new RegExp("\\bFROM\\s+([`\"]?)([A-Za-z0-9_\.]+)\\1\\s+(?:AS\\s+)?" + alias + "\\b", "i");
            var m = re.exec(editorText);
            if (m && m[2]) return m[2];
            re = new RegExp("\\bJOIN\\s+([`\"]?)([A-Za-z0-9_\.]+)\\1\\s+(?:AS\\s+)?" + alias + "\\b", "i");
            m = re.exec(editorText);
            if (m && m[2]) return m[2];
        }
        return null;
    }

    // Parse FROM / JOIN clauses to extract table names and aliases.
    // Improved scanner: handles quoted identifiers, schema.table, subqueries in parentheses, comma-separated lists, aliases with and without AS.
    function parseFromAliases(editorText) {
        var s = editorText || "";
        var i = 0, L = s.length;
        var map = { aliases: {}, tables: [] };

        function isIdentChar(ch) {
            return /[A-Za-z0-9_\.$]/.test(ch);
        }

        function skipWhitespace() {
            while (i < L && /\s/.test(s[i])) i++;
        }

        function readQuoted() {
            var quote = s[i];
            i++; // skip opening
            var start = i;
            while (i < L) {
                if (s[i] === quote) {
                    // handle doubled quotes
                    if (i + 1 < L && s[i + 1] === quote) { i += 2; continue; }
                    var res = s.slice(start, i);
                    i++; return res;
                }
                i++;
            }
            return s.slice(start, i);
        }

        function readIdentifier() {
            skipWhitespace();
            if (i >= L) return null;
            var ch = s[i];
            if (ch === '"' || ch === "'" || ch === '`') {
                return readQuoted();
            }
            var start = i;
            while (i < L && isIdentChar(s[i])) i++;
            return s.slice(start, i).trim() || null;
        }

        while (i < L) {
            // find next FROM or JOIN
            var upper = s.toUpperCase();
            var idxFrom = upper.indexOf('FROM', i);
            var idxJoin = upper.indexOf('JOIN', i);
            var next = -1, kind = null;
            if (idxFrom === -1 && idxJoin === -1) break;
            if (idxFrom === -1) { next = idxJoin; kind = 'JOIN'; }
            else if (idxJoin === -1) { next = idxFrom; kind = 'FROM'; }
            else { if (idxFrom < idxJoin) { next = idxFrom; kind = 'FROM'; } else { next = idxJoin; kind = 'JOIN'; } }
            i = next + kind.length;
            skipWhitespace();
            var stopChars = ['WHERE','GROUP','HAVING','ORDER','LIMIT','UNION','EXCEPT','INTERSECT'];
            if (kind === 'FROM') {
                var continueParsing = true;
                while (continueParsing && i < L) {
                    skipWhitespace();
                    if (i >= L) break;
                    if (s[i] === '(') {
                        var depth = 1; i++; var startSub = i;
                        while (i < L && depth > 0) {
                            if (s[i] === '(') depth++; else if (s[i] === ')') depth--; i++;
                        }
                        skipWhitespace();
                        // optional AS
                        if (s.substr(i,2).toUpperCase() === 'AS') { i += 2; }
                        skipWhitespace();
                        var a = readIdentifier();
                        if (a) { map.aliases[a] = null; }
                    } else {
                        var ident = readIdentifier();
                        if (ident) {
                            var tableOnly = ident.split('.').pop();
                            tableOnly = tableOnly.replace(/^["'`]|["'`]$/g, '');
                            if (map.tables.indexOf(tableOnly) === -1) map.tables.push(tableOnly);
                            skipWhitespace();
                            var alias = null;
                            if (s.substr(i,2).toUpperCase() === 'AS') { i += 2; skipWhitespace(); alias = readIdentifier(); }
                            else {
                                var posBefore = i;
                                var possible = readIdentifier();
                                if (possible) {
                                    var up = possible.toUpperCase();
                                    var keywords = ['ON','USING','WHERE','GROUP','HAVING','ORDER','LIMIT','INNER','LEFT','RIGHT','FULL','CROSS','JOIN','NATURAL',','];
                                    if (keywords.indexOf(up) === -1) { alias = possible; } else { i = posBefore; }
                                }
                            }
                            if (alias) { map.aliases[alias] = tableOnly; }
                        }
                    }
                    skipWhitespace();
                    if (s[i] === ',') { i++; continue; }
                    var rem = s.substr(i,10).toUpperCase();
                    if (rem.indexOf('JOIN') === 0) { continueParsing = false; break; }
                    var stopped = false;
                    for (var si=0; si<stopChars.length; si++) {
                        if (s.substr(i, stopChars[si].length).toUpperCase() === stopChars[si]) { stopped = true; break; }
                    }
                    if (stopped) break;
                    if (i >= L) break;
                    if (/\s/.test(s[i])) { skipWhitespace(); continue; }
                    break;
                }
            } else { // JOIN
                skipWhitespace();
                if (i < L) {
                    if (s[i] === '(') {
                        var depth = 1; i++; while (i < L && depth > 0) { if (s[i] === '(') depth++; else if (s[i] === ')') depth--; i++; }
                        skipWhitespace(); if (s.substr(i,2).toUpperCase() === 'AS') { i += 2; skipWhitespace(); }
                        var a = readIdentifier(); if (a) map.aliases[a] = null;
                    } else {
                        var ident = readIdentifier();
                        if (ident) {
                            var tableOnly = ident.split('.').pop();
                            tableOnly = tableOnly.replace(/^["'`]|["'`]$/g, '');
                            if (map.tables.indexOf(tableOnly) === -1) map.tables.push(tableOnly);
                            skipWhitespace(); var alias = null;
                            if (s.substr(i,2).toUpperCase() === 'AS') { i += 2; skipWhitespace(); alias = readIdentifier(); }
                            else {
                                var posBefore2 = i;
                                var possible = readIdentifier();
                                if (possible) {
                                    var up = possible.toUpperCase();
                                    var keywords = ['ON','USING','WHERE','GROUP','HAVING','ORDER','LIMIT','INNER','LEFT','RIGHT','FULL','CROSS','JOIN','NATURAL'];
                                    if (keywords.indexOf(up) === -1) { alias = possible; } else { i = posBefore2; }
                                }
                            }
                            if (alias) map.aliases[alias] = tableOnly;
                        }
                    }
                }
            }
        }
        return map;
    }

    // Création d'un completer ACE basique (tables, colonnes, et colonnes d'un alias/table si contexte "alias.")
    function createSqlCompleter() {
        var langTools = null;
        try {
            langTools = ace.require("ace/ext/language_tools");
        } catch (e) {
            console.warn('language_tools not available', e);
            return null;
        }

        // Debounce helper
        var debounceTimers = new WeakMap();
        var completer = {
            getCompletions: function (editor, session, pos, prefix, callback) {
                var self = this;
                // debounce per-session to avoid surcharger le compute
                var key = session;
                if (debounceTimers.has(key)) {
                    clearTimeout(debounceTimers.get(key));
                }
                debounceTimers.set(key, setTimeout(function () {
                    var schema = getSchema();
                    var completions = [];
                    var lineFull = session.getLine(pos.row);
                    var cursorIndex = pos.column;
                    var prefixLen = prefix ? prefix.length : 0;
                    var dotPos = cursorIndex - prefixLen - 1;
                    var isDotContext = false;
                    var ident = null;
                    var editorText = editor.getValue();

                    // Robust detection of qualifier before '.' even when user typed a prefix after the dot
                    if (dotPos >= 0 && lineFull[dotPos] === '.') {
                        // scan backwards to find the identifier before the dot
                        var j = dotPos - 1;
                        while (j >= 0 && /[A-Za-z0-9_`"'\.\u00C0-\u017F]/.test(lineFull[j])) { j--; }
                        ident = lineFull.slice(j + 1, dotPos).replace(/^['"`]|['"`]$/g, '').trim();
                        if (ident) isDotContext = true;
                    } else {
                        // fallback to previous simple regex (handles case when cursor at end immediately after dot)
                        var left = lineFull.slice(0, cursorIndex);
                        var dotMatch = left.match(/([A-Za-z0-9_]+)\.$/);
                        if (dotMatch) { ident = dotMatch[1]; isDotContext = true; }
                    }

                    var fromMap = parseFromAliases(editorText);
                    if (isDotContext && ident) {
                        // After a dot: only propose column names (no tables, no keywords)
                        var tableName = null;
                        // check if ident matches a table name first
                        schema.tables.forEach(function (t) { if (t.name.toLowerCase() === ident.toLowerCase()) tableName = t.name; });
                        // otherwise try to resolve alias -> table
                        if (!tableName) {
                            var resolved = resolveAliasToTable(editorText, ident);
                            if (resolved) tableName = resolved;
                        }
                        if (tableName) {
                            var table = schema.tables.filter(function (t) { return t.name === tableName; })[0];
                            if (table && table.columns) {
                                table.columns.forEach(function (c) {
                                    if (!prefix || c.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
                                        completions.push({ caption: c, value: c, meta: tableName, score: 100 });
                                    }
                                });
                            }
                        } else {
                            // If ident is an alias known in FROM clause but not resolved by resolveAliasToTable, try fromMap
                            if (fromMap && fromMap.aliases && fromMap.aliases[ident]) {
                                var tblName = fromMap.aliases[ident];
                                var table2 = schema.tables.filter(function (t) { return t.name.toLowerCase() === tblName.toLowerCase(); })[0];
                                if (table2 && table2.columns) {
                                    table2.columns.forEach(function (c) {
                                        if (!prefix || c.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
                                            completions.push({ caption: c, value: c, meta: tblName, score: 100 });
                                        }
                                    });
                                }
                            }
                        }
                    } else {
                        // Prioriser colonnes non qualifiées des tables dans la requête
                        var pushed = {};
                        if (fromMap.tables.length) {
                            fromMap.tables.forEach(function (tbl) {
                                var table = schema.tables.filter(function (t) { return t.name.toLowerCase() === tbl.toLowerCase(); })[0];
                                if (table) {
                                    table.columns.forEach(function (c) {
                                        if (!prefix || c.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
                                            var key = c.toLowerCase();
                                            if (!pushed[key]) { pushed[key] = true; completions.push({ caption: c, value: c, meta: table.name, score: 90 }); }
                                        }
                                    });
                                }
                            });
                        }
                        // Colonnes qualifiées et noms de tables
                        schema.tables.forEach(function (t) {
                            // table name
                            if (!prefix || t.name.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
                                completions.push({ caption: t.name, value: t.name, meta: 'table', score: 50 });
                            }
                            t.columns.forEach(function (c) {
                                var val = t.name + '.' + c;
                                if (!prefix || c.toLowerCase().indexOf(prefix.toLowerCase()) === 0 || val.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
                                    // éviter duplication si colonne non qualifiée déjà proposée
                                    var key = (t.name + '.' + c).toLowerCase();
                                    if (!pushed[key]) { pushed[key] = true; completions.push({ caption: val, value: val, meta: 'column', score: 40 }); }
                                }
                            });
                        });
                        // alias.col (si alias présent)
                        Object.keys(fromMap.aliases).forEach(function (al) {
                            var tbl = fromMap.aliases[al];
                            var table = schema.tables.filter(function (t) { return t.name.toLowerCase() === tbl.toLowerCase(); })[0];
                            if (table) {
                                table.columns.forEach(function (c) {
                                    var val = al + '.' + c;
                                    if (!prefix || c.toLowerCase().indexOf(prefix.toLowerCase()) === 0 || val.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
                                        var key = val.toLowerCase();
                                        if (!pushed[key]) { pushed[key] = true; completions.push({ caption: val, value: val, meta: 'column', score: 60 }); }
                                    }
                                });
                            }
                        });
                    }

                    // dédoublonner et trier par score puis alphabetique
                    var seen = {};
                    var uniq = [];
                    completions.forEach(function (it) {
                        var k = it.value + '::' + it.meta;
                        if (!seen[k]) {
                            seen[k] = true;
                            uniq.push(it);
                        }
                    });

                    uniq.sort(function (a, b) {
                        var sa = a.score || 0, sb = b.score || 0;
                        if (sa !== sb) return sb - sa;
                        var ca = (a.caption || '').toLowerCase();
                        var cb = (b.caption || '').toLowerCase();
                        if (ca < cb) return -1; if (ca > cb) return 1; return 0;
                    });

                    // limiter le nombre de propositions
                    var MAX_SUGGESTIONS = 200;
                    if (uniq.length > MAX_SUGGESTIONS) uniq = uniq.slice(0, MAX_SUGGESTIONS);

                    callback(null, uniq.map(function (c) {
                        return { caption: c.caption, value: c.value, meta: c.meta };
                    }));
                }, 120)); // debounce 120ms
            }
        };

        try {
            langTools.addCompleter(completer);
        } catch (e) {
            console.warn('Impossible d enregistrer le completer', e);
        }
        return completer;
    }
    
    // Exécution de la requête SQL proposé
    function execution() {
        var sql, resultat, table, erreur;
        $("#resultat").children().remove();
        if (!db) {
            $("#resultat").append($("<div>").html("<strong>Attention :</strong><br>Base de données non choisie").css("color", "red"));
        } else {
            sql = editeur.getValue();
            if (sql.trim()) {
                historiqueRequetes.push(sql);
            }
            try {
                resultat = db.exec(sql)[0];
            } catch (error) {
                erreur = true;
                $("#resultat").html($("<div>").html("<strong>Erreur :</strong><br>" + error.message));
            } finally {
                if (!resultat && !erreur) {
                    erreur = true;
                    $("#resultat").html($("<div>").html("<strong>Attention :</strong><br>Aucun résultat trouvé."));
                }
                if (!erreur) {
                    if (resultat.length) {
                        $("#resultat").html($("<div>").html(resultat));
                    } else {
                        table = sql2table(resultat, "tablesql", false);
                        if (table) {
                            $("#resultat").append(table);
                            $("#tablesql").DataTable({
                                ordering: false,
                                paging: false,
                                scrollY: ($("#resultat").height() - 170) + "px",
                                scrollCollapse: true,
                                autoWidth: false,
                                scrollX: true, // $("#resultat").width() + "px",
                                dom: 'Bfrtip',
                                buttons: [
                                    'copy', 'csv', 'pdf'
                                ]
                            });
                        }
                    }
                }
            }
            editeur.focus();
        }
    }
    
    // Affichage du contenu d'une base de données
    function afficherContenu() {
        var affichage = $("#contenu").css("display");
        if (affichage === "none") {
            $("#contenu").css("display", "block");
            $("#choixBD").css("display", "none");
            $("#lecon").css("display", "none");
            $("#tables").addClass("active");
        } else {
            $("#contenu").css("display", "none");
            $("#choixBD").css("display", "block");
            $("#lecon").css("display", "block");
            $("#tables").removeClass("active");
        }
        editeur.focus();
    }
    
    // Affichage du schéma d'une base de données
    function afficherSchema() {
        var png = "bases/" + $("#bdd").html().replace(".sqlite", "") + ".png";
        window.open(png);
    }
    
    // Affichage de l'historique des requêtes
    function afficherHistorique() {
        if ($("#historique-conteneur").length) {
            $("#historique-conteneur").remove();
            return;
        }

        var conteneur = $("<div>").attr("id", "historique-conteneur").css({
            position: 'absolute',
            top: '60px',
            right: '10px',
            width: '40%',
            maxWidth: '500px',
            maxHeight: 'calc(100% - 80px)',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ccc',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column'
        });

        var header = $("<div>").css({
            padding: '10px',
            borderBottom: '1px solid #ccc',
            backgroundColor: '#eee'
        });

        var titre = $("<h4>").html("Historique des requêtes").css({ margin: 0, flexGrow: 1 });
        var boutonCopier = $("<button>").html("Copier").css({
            marginLeft: '10px',
            padding: '5px 10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap'
        }).click(function () {
            var historiqueTexte = historiqueRequetes.join(";\n\n");
            navigator.clipboard.writeText(historiqueTexte).then(function () {
                boutonCopier.html("Copié !");
                setTimeout(function () {
                    boutonCopier.html("Copier");
                }, 2000);
            });
        });

        var boutonExporter = $("<button>").html("Fichier SQL").css({
            marginLeft: '10px',
            padding: '6px 12px',
            backgroundColor: '#008CBA',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap'
        }).click(function () {
            var historiqueTexte = historiqueRequetes.join(";\n\n");
            var blob = new Blob([historiqueTexte], {type: "text/plain;charset=utf-8"});
            var url = URL.createObjectURL(blob);
            var a = $("<a>").attr("href", url).attr("download", "historique.sql").css("display", "none");
            $("body").append(a);
            a[0].click();
            a.remove();
            URL.revokeObjectURL(url);
        });

        var fermer = $("<button>")
            .html("&times;")
            .attr('aria-label', 'Fermer')
            .css({
                marginLeft: '10px',
                border: 'none',
                background: 'transparent',
                color: '#000',
                fontSize: '28px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap'
            }).click(function () {
                conteneur.remove();
            });

        header.css({ display: 'flex', alignItems: 'center' });
        header.append(titre).append(boutonCopier).append(boutonExporter).append(fermer);
        conteneur.append(header);

        var listeConteneur = $("<div>").css({
            padding: '10px',
            overflowY: 'auto'
        });

        if (historiqueRequetes.length === 0) {
            listeConteneur.append($("<p>").html("Aucune requête exécutée."));
        } else {
            var liste = $("<ul>").css({ listStyle: 'none', padding: 0, margin: 0 });
            $.each(historiqueRequetes.slice().reverse(), function (i, requete) {
                var item = $("<li>").css({ display: 'flex', alignItems: 'center', marginBottom: '5px' });
                var pre = $("<pre>").html(requete).css({
                    cursor: 'pointer',
                    padding: '8px',
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    flexGrow: 1,
                    margin: 0
                }).hover(function () {
                    $(this).css('backgroundColor', '#eef');
                }, function () {
                    $(this).css('backgroundColor', '#fff');
                });

                pre.click(function () {
                    editeur.setValue(requete);
                    editeur.gotoLine(1);
                    conteneur.remove();
                });

                var boutonSupprimer = $("<button>").html("X").css({
                    marginLeft: '3px',
                    padding: '3px 6px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap'
                }).click(function () {
                    var originalIndex = historiqueRequetes.length - 1 - i;
                    if (originalIndex > -1) {
                        historiqueRequetes.splice(originalIndex, 1);
                    }
                    item.remove();
                    if (historiqueRequetes.length === 0) {
                        liste.remove();
                        listeConteneur.append($("<p>").html("Aucune requête exécutée."));
                    }
                });

                item.append(pre);
                item.append(boutonSupprimer);
                liste.append(item);
            });
            listeConteneur.append(liste);
        }
        conteneur.append(listeConteneur);
        $("body").append(conteneur);
    }

    // Lecture d'une base de données
    function lecture(fichier) {
    // lecture de la base demandée
        $("#bdd").html(fichier.replace("bases/", "").replace(".sqlite", ""));
        $("#lancer").css("visibility", "hidden");
        $("#tables").css("visibility", "hidden");
        $("#schema").css("visibility", "hidden");
        $("#resultat").children().remove();
        editeur.setValue("");
        $("#contenu").children().remove();
        var xhr = new XMLHttpRequest();
        xhr.open("GET", fichier, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function () {
            // chargement terminé
            try {
                var len = this.response ? this.response.byteLength || this.response.length : 0;
                var uInt8Array = new Uint8Array(this.response), contenu, html;
                try {
                    db = new SQL.Database(uInt8Array);
                    // instance DB créée
                } catch (e) {
                    console.error('[lecture] Erreur création SQL.Database', e);
                    $("#resultat").html($("<div>").html("<strong>Erreur :</strong><br>Impossible d'ouvrir la base : " + e.message));
                    return;
                }
                // Construire le cache du schéma pour l'autocomplétion
                try {
                    buildSchema();
                } catch (e) {
                    console.warn('Erreur buildSchema après chargement DB', e);
                }
                $("#lancer").css("visibility", "visible");
                $("#tables").css("visibility", "visible");
                $("#schema").css("visibility", "visible");

                try {
                    contenu = db.exec("SELECT name, sql FROM sqlite_master WHERE type='table'");
                } catch (e) {
                    console.error('Erreur interrogation sqlite_master', e);
                    $("#resultat").html($("<div>").html("<strong>Erreur :</strong><br>Impossible d'interroger la base : " + e.message));
                    editeur.focus();
                    return;
                }
                try {
                    html = sql2table(contenu[0], "tabtables", true);
                    $("#contenu").html(html);
                    $("#tabtables").DataTable({
                        "paging":   false,
                        "ordering": false,
                        "info":     false,
                        "searching": false
                    });
                } catch (e) {
                    console.error('Erreur génération contenu table', e);
                }
                editeur.focus();
            } catch (e) {
                console.error('Erreur lors du chargement de la base', e);
            }
        };
        xhr.onerror = function (ev) {
            console.error('Erreur XHR lors du chargement de la base', ev, 'status', this.status);
            $("#resultat").html($("<div>").html("<strong>Erreur :</strong><br>Impossible de charger le fichier : " + fichier));
        };
        xhr.onprogress = function (ev) {
            // progression du téléchargement (optionnel)
            /* if (ev.lengthComputable) { console.log('progress', ev.loaded, '/', ev.total); } */
        };
        xhr.send();
    }

    // Création de l'interface en trois zones
    function initialisation() {
        var information = $("<div>").attr("id", "information"),
            contenu = $("<div>").attr("id", "contenu"),
            requete = $("<div>").attr("id", "requete"),
            requetesql = $("<div>").attr("id", "requetesql"),
            resultat = $("<div>").attr("id", "resultat"),
            droite = $("<div>").attr("id", "droite");
        
        information.append(contenu);
        requete.append(requetesql);
        droite.append(requete);
        droite.append(resultat);
        ecran.children().remove();
        ecran.append(information);
        ecran.append(droite);
        
        editeur = ace.edit("requetesql");
        editeur.setTheme("ace/theme/sqlserver");
        editeur.getSession().setMode("ace/mode/sql");
        editeur.setOption("showPrintMargin", false);
        // Activer l'autocomplétion ACE (language_tools doit être inclus dans la page)
        try {
            var langTools = ace.require("ace/ext/language_tools");
            editeur.setOptions({
                enableBasicAutocompletion: true,
                // activer live autocompletion pour suggestions pendant la frappe
                enableLiveAutocompletion: true,
                enableSnippets: false
            });
            // crée et enregistre un completer basé sur le schéma
            var created = createSqlCompleter();
            var sqlCompleter = created;

            // Tab accepte la suggestion si le popup est ouvert, sinon insertion d'une tabulation
            editeur.commands.addCommand({
                name: 'acceptSuggestionOnTab',
                bindKey: { win: 'Tab', mac: 'Tab' },
                exec: function (editor) {
                    var c = editor.completer;
                    if (c && c.popup && c.popup.isOpen) {
                        c.insertMatch();
                        return;
                    }
                    editor.execCommand('insertTab');
                }
            });
        } catch (e) {
            // language_tools non disponible
            console.warn('language_tools non disponible', e);
        }

        editeur.focus();

    // Sur insertion de '.' : lancer l'autocomplétion en utilisant uniquement
    // notre completer SQL pour n'afficher que des colonnes.
        try {
            editeur.getSession().on('change', function (delta) {
                try {
                    if (delta && delta.action === 'insert' && Array.isArray(delta.lines)) {
                        var inserted = delta.lines.join('\n');
                        if (inserted.indexOf('.') !== -1) {
                            // Lorsque l'utilisateur tape un point, on veut afficher uniquement
                            // les colonnes. Pour cela, remplacer temporairement les completers
                            // de l'éditeur par notre completer SQL (si disponible), lancer
                            // l'autocomplétion puis restaurer la liste précédente quand la
                            // popup se ferme.
                            try {
                                if (sqlCompleter) {
                                    // mémoriser et cloner la liste actuelle
                                    var previous = editeur.completers ? Array.prototype.slice.call(editeur.completers) : null;
                                    try { editeur.completers = [sqlCompleter]; } catch (e) { /* ignore */ }
                                    // lancer l'autocomplete après un court délai
                                    setTimeout(function () {
                                        try { editeur.execCommand('startAutocomplete'); } catch (e) { /* noop */ }
                                    }, 10);
                                    // surveiller la fermeture du popup pour restaurer
                                    var watcherCount = 0;
                                    var watcher = setInterval(function () {
                                        watcherCount++;
                                        try {
                                            var c = editeur.completer;
                                            if (!c || !c.popup || !c.popup.isOpen || watcherCount > 30) {
                                                // restaurer
                                                try { if (previous) editeur.completers = previous; } catch (e) { /* noop */ }
                                                clearInterval(watcher);
                                            }
                                        } catch (e) {
                                            // en cas d'erreur, tenter de restaurer et arrêter
                                            try { if (previous) editeur.completers = previous; } catch (ee) { }
                                            clearInterval(watcher);
                                        }
                                    }, 150);
                                } else {
                                    // pas de completer SQL, on lance l'autocomplete par défaut
                                    setTimeout(function () { try { editeur.execCommand('startAutocomplete'); } catch (e) { /* noop */ } }, 10);
                                }
                            } catch (e) {
                                // degrade gracefully
                                setTimeout(function () { try { editeur.execCommand('startAutocomplete'); } catch (e) { /* noop */ } }, 10);
                            }
                        }
                    }
                } catch (e) {
                    // erreur non critique du handler
                }
            });
        } catch (e) {
            // ignore if session.on not available
        }

    }
    
    // Mise en place d'une interface de requêtage simple, avec choix de la base de données à gauche (et affichage de l'information)
    function requetage() {
        var bds = $("<div>").attr("id", "choixBD").css("text-align", "center"), liste;
        initialisation();
        $("#titre").html("Requêtage direct");
        
    liste = [
            "exemple.sqlite", "Comptoir2000.sqlite", "Gymnase2000.sqlite", "Chinook.sqlite", 
            "world.sqlite", "ca.sqlite", "TourDeFrance.sqlite", "sakila.sqlite", "stages.sqlite", 
            "CabinetMedical.sqlite", "bibliotheque.sqlite", "confiserie.sqlite", "Northwind.sqlite",
            "ClassicModel.sqlite", "db_vide.sqlite"
            ];
    // liste des bases préparée
        liste.sort(function (a, b) {
            return a.localeCompare(b);
        });
        
        $.each(liste, function (i, e) {
            var bouton = $("<button>")
                .addClass("bd")
                .html(e.replace(".sqlite", ""))
                .click(function () {
                    $("button.active").removeClass("active");
                    lecture("bases/" + e);
                    $(this).addClass("active");
                });
            bds.append(bouton);
            // bds.append($("<br>"));
        });
        
        $("#information").append(bds);
    }

    
    // Chargement d'un TP (structure dans TP/TP1, TP/TP2, etc.)
    function lancementTP(tp) {
        initialisation();
        $.getJSON("cours/TP/" + tp + "/" + tp + ".json", function (donnees) {
            var queue,
                lecon = $("<div>").attr("id", "lecon"),
                items = $("<div>").attr("id", "items"),
                textes = $("<div>").attr("id", "textes");
            
            $("#titre").html(donnees.intitule);
            lecture("bases/" + donnees.base);
            
            // Lecture des fichiers md
            queue = donnees.fichiers.map(function (fic) {
                var nomfic = "cours/TP/" + tp + "/" + fic + ".md";
                return $.get(nomfic);
            });
            
            // Intégration de ces fichiers md dans la div de lecon
            $.when.apply(null, queue).done(function () {
                var item, texte;
                $.each(arguments, function (i, e) {
                    item = $("<button>").html(i + 1).attr("class", "item");
                    texte = $("<div>").html(marked(e[0]));
                    item.click(function () {
                        var num = +$(this).html();
                        $("#textes div").css("display", function (iclick) {
                            if ((iclick + 1) === num) {
                                return "block";
                            } else {
                                return "none";
                            }
                        });
                        $("#items button").removeClass("active");
                        $(this).addClass("active");
                        $("#information").scrollTop(0);
                    });
                    if (i !== 0) {
                        texte.css("display", "none");
                    } else {
                        item.addClass("active");
                    }
                    items.append(item);
                    textes.append(texte);
                });
                lecon.append(items).append(textes);
                $("#information").append(lecon);
                $("#textes pre").click(function () {
                    var code = $(this).find("code"),
                        sql = code.html();
                    if (code.hasClass("lang-sql")) {
                        sql = sql.replace(/<span class="hljs-keyword">/g, '');
                        sql = sql.replace(/<span class="hljs-string">/g, '');
                        sql = sql.replace(/<span class="hljs-number">/g, '');
                        sql = sql.replace(/<span class="hljs-built_in">/g, '');
                        sql = sql.replace(/<span class="hljs-literal">/g, '');
                        sql = sql.replace(/&lt;/g, '<');
                        sql = sql.replace(/&gt;/g, '>');
                        sql = sql.replace(/<\/span>/g, '');
                        $("#resultat").children().remove();
                        editeur.setValue(sql);
                        editeur.gotoLine(1);
                    }
                });
                // Gestion des spoilers
                $("#textes .spoiler-button").click(function () {
                    var button = $(this);
                    var content = button.next(".spoiler-content");
                    button.toggleClass("open");
                    content.toggleClass("visible");
                });
            });
            
        });
    }
    
    // Chargemet d'un cours et affichage de celui-ci
    function lancementCours(cours) {
        initialisation();
        $.getJSON("cours/" + cours + "/" + cours + ".json", function (donnees) {
            var queue,
                lecon = $("<div>").attr("id", "lecon"),
                items = $("<div>").attr("id", "items"),
                textes = $("<div>").attr("id", "textes");
            
            $("#titre").html(donnees.intitule);
            lecture("bases/" + donnees.base);
            
            // Lecture des fichiers md
            queue = donnees.fichiers.map(function (fic) {
                var nomfic = "cours/" + cours + "/" + fic + ".md";
                return $.get(nomfic);
            });
            
            // Intégration de ces fichiers md dans la div de lecon
            $.when.apply(null, queue).done(function () {
                var item, texte;
                $.each(arguments, function (i, e) {
                    item = $("<button>").html(i + 1).attr("class", "item");
                    texte = $("<div>").html(marked(e[0]));
                    item.click(function () {
                        var num = +$(this).html();
                        $("#textes div").css("display", function (iclick) {
                            if ((iclick + 1) === num) {
                                return "block";
                            } else {
                                return "none";
                            }
                        });
                        $("#items button").removeClass("active");
                        $(this).addClass("active");
                        $("#information").scrollTop(0);
                    });
                    if (i !== 0) {
                        texte.css("display", "none");
                    } else {
                        item.addClass("active");
                    }
                    items.append(item);
                    textes.append(texte);
                });
                lecon.append(items).append(textes);
                $("#information").append(lecon);
                $("#textes pre").click(function () {
                    var code = $(this).find("code"),
                        sql = code.html();
                    if (code.hasClass("lang-sql")) {
                        sql = sql.replace(/<span class="hljs-keyword">/g, '');
                        sql = sql.replace(/<span class="hljs-string">/g, '');
                        sql = sql.replace(/<span class="hljs-number">/g, '');
                        sql = sql.replace(/<span class="hljs-built_in">/g, '');
                        sql = sql.replace(/<span class="hljs-literal">/g, '');
                        sql = sql.replace(/&lt;/g, '<');
                        sql = sql.replace(/&gt;/g, '>');
                        sql = sql.replace(/<\/span>/g, '');
                        $("#resultat").children().remove();
                        editeur.setValue(sql);
                        editeur.gotoLine(1);
                    }
                });
                // Gestion des spoilers
                $("#textes .spoiler-button").click(function () {
                    var button = $(this);
                    var content = button.next(".spoiler-content");
                    button.toggleClass("open");
                    content.toggleClass("visible");
                });
            });
            
        });
    }
    
    // Ecran de début
    function debut() {
        var choix = $("<div>").attr("id", "choixAccueil");
        ecran.children().remove();
        ecran.html("");
        $("#titre").html("");
        $("#bdd").html("");
        $("#lancer").css("visibility", "hidden");
        $("#tables").css("visibility", "hidden")
            .removeClass("active");
        $("#schema").css("visibility", "hidden");
        
        // Section TP EN HAUT
        var choixTP = $("<div>").attr("id", "choixTP").css({
            "margin-bottom": "30px",
            "padding": "20px",
            "background": "rgba(52, 152, 219, 0.05)",
            "border-radius": "8px",
            "border-left": "4px solid var(--accent-color)"
        });
        choixTP.append($("<h3>").html("🖥️ Travaux Pratiques").css({"margin-top": "0", "color": "var(--primary-color)"}));
        
        // 2 colonnes pour les TP
        var tpGauche = $("<div>").css({
            "float": "left",
            "width": "50%",
            "padding": "10px"
        });
        var tpDroite = $("<div>").css({
            "float": "left",
            "width": "50%",
            "padding": "10px"
        });
        
        tpGauche.append($("<button>").addClass("tp-button").html("TP 1 - Requêtage simple").click(function () { lancementTP("TP1"); }));
        tpGauche.append("<br><br>");
        tpGauche.append($("<button>").addClass("tp-button").html("TP 3 - Jointures et sous-requêtes").click(function () { lancementTP("TP3"); }));
        
        tpDroite.append($("<button>").addClass("tp-button").html("TP 2 - Dates et agrégats").click(function () { lancementTP("TP2"); }));
        tpDroite.append("<br><br>");
        tpDroite.append($("<button>").addClass("tp-button").html("TP 4 - Récapitulatif").click(function () { lancementTP("TP4"); }));
        
        choixTP.append(tpGauche);
        choixTP.append(tpDroite);
        choixTP.append($("<div>").css("clear", "both"));
        choix.append(choixTP);
        
        // Section COURS EN BAS
        var choixCours = $("<div>").attr("id", "choixCours").css({
            "padding": "20px",
            "background": "rgba(149, 165, 166, 0.05)",
            "border-radius": "8px",
            "border-left": "4px solid var(--primary-color)"
        });
        choixCours.append($("<h3>").html("📖 Cours").css({"margin-top": "0", "color": "var(--primary-color)"}));
        
        var coursGauche = $("<div>").css({
            "float": "left",
            "width": "50%",
            "padding": "10px"
        });
        var coursDroite = $("<div>").css({
            "float": "left",
            "width": "50%",
            "padding": "10px"
        });
        
        coursGauche.append($("<button>").html("1 - Requêtage simple").click(function () { lancementCours("1-requetage-simple"); }));
        coursGauche.append("<br>");
        coursGauche.append($("<button>").html("2 - Calculs et fonctions").click(function () { lancementCours("2-calculs-fonctions"); }));
        coursGauche.append("<br>");
        coursGauche.append($("<button>").html("3 - Agrégats").click(function () { lancementCours("3-agrégats"); }));
        coursGauche.append("<br>");
        coursGauche.append($("<button>").html("Récapitulatif 1").click(function () { lancementCours("recapitulatif1"); }));

        coursDroite.append($("<button>").html("4 - Jointures").click(function () { lancementCours("4-jointures"); }));
        coursDroite.append("<br>");
        coursDroite.append($("<button>").html("5 - Sous-requêtes").click(function () { lancementCours("5-sous-requetes"); }));
        coursDroite.append("<br>");
        coursDroite.append($("<button>").html("6 - Opérations ensemblistes").click(function () { lancementCours("6-ensemblistes"); }));
        coursDroite.append("<br>");
        coursDroite.append($("<button>").html("Récapitulatif 2").click(function () { lancementCours("recapitulatif2"); }));
        
        choixCours.append(coursGauche);
        choixCours.append(coursDroite);
        choixCours.append($("<div>").css("clear", "both"));
        choix.append(choixCours);
        
        choix.append("<br>");
        choix.append($("<button>").html("⚙️ Requêtage direct").click(requetage).css({"display": "block", "margin": "30px auto"}));
        ecran.append(choix);
    }

    $(document).ready(function() {
        ecran = $("#interface");

        $("#accueil").click(debut);
        $("#lancer").click(execution);
        $("#tables").click(afficherContenu);
        $("#schema").click(afficherSchema);
        $("#historique").click(afficherHistorique);

        // Permet l'exécution de la requête via CTRL + Enter
        $(document).on('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && (e.which === 13)) {
                execution();
            }
        });

        // Permet la gestion du changement de taille de la fenêtre
        // Test taille originale : 400px nouvelle 600px
        $(window).on("resize", function () {
            hauteur = (window.innerHeight - $("header").height() - $("footer").height());
            ecran.css("height", hauteur + "px");
            if (hauteur < 600) {
                tropPetit();
            } else {
                if (petit) {
                    petit = false;
                    debut();
                }
            }
        }).trigger('resize'); // Trigger resize to set initial size

        debut();
    });

    // Gestion du mode sombre
    var themeToggle = $("#theme-toggle");
    var isDarkMode = localStorage.getItem("darkMode") === "true";
    
    // Initialiser le mode au chargement
    if (isDarkMode) {
        document.documentElement.classList.add("dark-mode");
        themeToggle.html("☀️ Mode clair");
        if (editeur) {
            editeur.setTheme("ace/theme/dracula");
        }
    }
    
    // Gestionnaire de clic pour le toggle
    themeToggle.click(function () {
        isDarkMode = !isDarkMode;
        localStorage.setItem("darkMode", isDarkMode);
        
        if (isDarkMode) {
            document.documentElement.classList.add("dark-mode");
            themeToggle.html("☀️ Mode clair");
            if (editeur) {
                editeur.setTheme("ace/theme/dracula");
            }
        } else {
            document.documentElement.classList.remove("dark-mode");
            themeToggle.html("🌙 Mode sombre");
            if (editeur) {
                editeur.setTheme("ace/theme/sqlserver");
            }
        }
        
        // Forcer redraw de la table DataTables
        try {
            if ($.fn.dataTable.isDataTable("#tabtables")) {
                $("#tabtables").DataTable().draw();
            }
        } catch (e) {
            console.log("DataTable redraw failed:", e);
        }
    });

        // helpers internes (non exposés)

    }());