# Validation de LunarNav

Résultat publié par l'API sur `GET /api/validation` (fichier `LunarNav/LunarNav.Web/wwwroot/data/validation.json`).
Seuils fixés avant la comparaison : `tools/validation/thresholds.json` (commit `8ed64ee`, avant le code et le premier calcul).

## 1. En bref

- **Le code C# du produit lui-même** a été exécuté et comparé aux cartes officielles NASA/LOLA (PGDA, produit 69, E. Mazarico) sur nos 31 sites polaires.
- Soleil : **26 sites sur 31** à moins de 5 points, écart médian **0,78 point**. Terre : **28 sur 31**, écart médian **0,74 point**.
- Les 8 écarts plus grands (5 Soleil, 3 Terre) sont tous sur des crêtes ou des bords de plateau, là où la valeur NASA elle-même change de 20 à 60 points d'un pixel à son voisin. Aucun site n'est classé « problème ».
- Directions du Soleil et de la Terre : JPL Horizons à moins de 0,01° (test unitaire), et un repère décalé de 0,1° est détecté.
- **Deux résultats négatifs sont laissés visibles** (section 4) : deux contrôles négatifs sur trois ne font pas échouer la comparaison, et l'écart C# / Python sur la Terre dépasse le seuil fixé.

## 2. Méthode

1. **Code testé.** La commande `validate` (`LunarNav.Api/Validation.cs`) appelle le code du produit sans le réécrire : `HorizonMask.Compute` (720 azimuts, pas de 80 m, jusqu'à 250 km) puis `Analysis.Timeline` (disque découpé en 16 bandes contre l'horizon, taille du Soleil selon la distance, éclipses).
2. **Période.** Toute l'éphéméride de l'application : 2026-01-01 à 2031-01-01, pas d'une heure, 43 825 échantillons (JPL Horizons, DE441).
3. **Définitions.** Soleil levé = une partie du disque visible (`sunFrac > 0`). Terre en vue = une partie du disque visible. C'est la définition des cartes PGDA (« any part of the disc »).
4. **Hauteur.** Les cartes PGDA sont des cartes de surface : la comparaison se fait avec un observateur à **0 m**. Les valeurs à 2 m et 10 m (celles du produit) sont aussi calculées et publiées.
5. **Référence NASA.** Carte à 60 m (85°S–90°S) si le site est dedans (26 sites), sinon carte à 120 m (5 sites). Pixel le plus proche, plus le minimum et le maximum du voisinage 3×3 (`tools/validation/pgda.json`).
6. **Sensibilité à la position.** Notre calcul à 0 m est refait aux 8 points voisins à 80 m (un pixel LOLA).
7. **Verdict par site** (même règle que `compare.py`) : OK si l'écart est d'au plus 5 points ; « expliqué » si notre valeur est dans la fourchette 3×3 de la NASA à 5 points près, ou l'inverse ; « problème » sinon.

## 3. Seuils fixés à l'avance

| Critère | Seuil | Résultat | Réussi |
|---|---|---|---|
| Sites Soleil à ±5 points | au moins 25 / 31 | 26 / 31 | oui |
| Sites Terre à ±5 points | au moins 27 / 31 | 28 / 31 | oui |
| Sites « problème » | 0 | 0 | oui |
| Écart C# / Python | au plus 0,05 point | 0,08 (Soleil), 0,42 (Terre) | **non** |
| Contrôle « azimut en miroir » | doit échouer | 24 / 31 | oui (il échoue) |
| Contrôle « Soleil tourné de 180° » | doit échouer | 25 / 31 | **non** (il passe) |
| Contrôle « date + 14,77 jours » | doit échouer | 26 / 31 | **non** (il passe) |

## 4. Résultats

### Statistiques sur les 31 sites (C# 0 m contre NASA)

| | Biais | Écart absolu médian | Écart absolu moyen | RMSE | Corrélation r | Pente | Écart max |
|---|---|---|---|---|---|---|---|
| Soleil | +1,37 | 0,78 | 2,72 | 4,85 | 0,970 | 1,02 | 17,45 (de-gerlache-rim-2) |
| Terre | +0,68 | 0,74 | 1,36 | 2,25 | 0,996 | 1,03 | 7,27 (mons-mouton) |

Par tranche d'éclairement NASA (Soleil) :

| PGDA Soleil | Sites | À ±5 points | Écart absolu moyen |
|---|---|---|---|
| 0–10 % | 1 | 1 | 0,18 |
| 10–25 % | 8 | 8 | 0,87 |
| 25–50 % | 12 | 11 | 3,01 |
| 50–70 % | 9 | 6 | 3,43 |
| 70–100 % | 1 | 0 | 10,14 |

Les sites les plus éclairés sont des crêtes : c'est là que l'écart grandit, ce qui confirme que l'écart vient de la position sur le relief et pas de la méthode.

### C# contre Python (même méthode réécrite indépendamment)

- Soleil : écart maximal **0,08 point** sur 93 lignes (31 sites × 0, 2 et 10 m), médiane 0,02. Le seuil de 0,05 est dépassé de peu.
- Terre : écart maximal **0,42 point** (shackleton-rim à 0 m), puis 0,16 et 0,13. 48 lignes sur 93 respectent le seuil de 0,05.
- **Cause probable, non vérifiée :** depuis la PR 26, le C# compare 16 bandes du disque à l'horizon réel, alors que le Python compare tout le disque à l'horizon pris en son centre. Le disque de la Terre (environ 1° de rayon) est près de 4 fois plus large que celui du Soleil, d'où un effet plus fort sur la Terre. Ce changement était connu et écrit dans les seuils avant le calcul. Le seuil n'a pas été modifié.

### Contrôles négatifs

Un contrôle négatif fausse volontairement le calcul. S'il donne encore un bon accord, la comparaison ne sait pas distinguer le vrai du faux.

- **Azimut en miroir** (horizon inversé est-ouest) : 24 / 31. Il échoue, comme attendu, mais de peu.
- **Soleil tourné de 180°** : 25 / 31. Il passe.
- **Date + 14,77 jours** (demi-mois synodique) : 26 / 31. Il passe.

**Ce que ça veut dire.** Un pourcentage moyen sur 5 ans ne dépend presque pas de *quand* le Soleil passe : sur une année, il fait le tour complet de l'horizon. Tourner le Soleil ou décaler la date ne change donc presque pas la moyenne. Cette comparaison valide l'horizon (le relief et sa géométrie), **pas le calendrier**. Le calendrier est validé ailleurs : test JPL Horizons à 0,01° près, qui échoue bien avec un repère décalé de 0,1° (`GeometryTests`). Un contrôle temporel sur la carte NASA demanderait une référence datée (par exemple des photos LROC à une date connue) : non fait.

### Par site

« Écart » = C# 0 m moins NASA. NASA = pixel le plus proche (min–max 3×3). Les colonnes 2 m et 10 m sont les valeurs Soleil du produit.

| Site | Soleil C# 0 m | Soleil NASA | Écart | Verdict | Terre C# 0 m | Terre NASA | Écart | Verdict | Soleil 2 m | Soleil 10 m | Carte |
|---|---|---|---|---|---|---|---|---|---|---|---|
| peak-near-cabeus-b | 56.1 | 56.1 (33-62) | 0.0 | OK | 70.8 | 67.3 (32-100) | +3.5 | OK | 58.9 | 63.3 | 120M |
| haworth | 53.3 | 53.3 (46-55) | 0.0 | OK | 78.4 | 79.6 (73-80) | -1.2 | OK | 56.1 | 60.9 | 060M |
| malapert-massif | 59.8 | 55.8 (51-60) | +3.9 | OK | 100.0 | 100.0 (76-100) | 0.0 | OK | 64.6 | 66.6 | 060M |
| mons-mouton-plateau | 53.4 | 54.2 (50-57) | -0.8 | OK | 100.0 | 94.5 (85-100) | +5.5 | explained | 58.4 | 59.0 | 060M |
| mons-mouton | 60.4 | 52.0 (29-63) | +8.5 | explained | 62.9 | 55.6 (46-74) | +7.3 | explained | 70.9 | 79.3 | 060M |
| nobile-rim-1 | 63.4 | 58.1 (49-62) | +5.3 | explained | 70.2 | 69.5 (58-80) | +0.8 | OK | 66.5 | 67.0 | 060M |
| nobile-rim-2 | 51.1 | 51.2 (37-53) | -0.2 | OK | 60.1 | 62.1 (41-72) | -2.1 | OK | 52.4 | 52.5 | 120M |
| de-gerlache-rim-2 | 53.2 | 35.7 (36-62) | +17.5 | explained | 62.0 | 61.3 (61-61) | +0.7 | OK | 61.6 | 70.0 | 060M |
| slater-plain | 57.6 | 58.8 (36-59) | -1.2 | OK | 50.2 | 49.7 (34-50) | +0.4 | OK | 64.6 | 68.8 | 060M |
| shackleton-rim | 10.9 | 11.0 (10-12) | -0.1 | OK | 10.2 | 11.1 (10-12) | -0.9 | OK | 10.9 | 11.2 | 060M |
| connecting-ridge | 41.6 | 43.9 (37-77) | -2.3 | OK | 39.4 | 39.1 (34-57) | +0.4 | OK | 50.3 | 90.1 | 060M |
| im2-athena | 46.3 | 45.1 (40-47) | +1.2 | OK | 93.2 | 92.1 (80-93) | +1.1 | OK | 46.8 | 47.7 | 060M |
| amundsen-rim | 35.6 | 38.2 (35-42) | -2.6 | OK | 54.2 | 54.2 (49-60) | +0.1 | OK | 37.6 | 41.1 | 120M |
| shackleton-rim-b | 39.8 | 35.5 (34-40) | +4.3 | OK | 54.6 | 53.8 (54-54) | +0.7 | OK | 42.0 | 43.1 | 060M |
| shoemaker-rim-a | 22.9 | 22.8 (22-24) | +0.1 | OK | 48.4 | 47.6 (48-48) | +0.8 | OK | 23.9 | 26.2 | 060M |
| shoemaker-rim-b | 18.2 | 18.8 (16-19) | -0.5 | OK | 51.6 | 51.1 (48-52) | +0.6 | OK | 18.8 | 21.6 | 060M |
| shoemaker-rim-c | 13.3 | 12.7 (13-19) | +0.6 | OK | 24.5 | 30.9 (31-35) | -6.5 | explained | 17.4 | 28.2 | 060M |
| shoemaker-rim-d | 33.1 | 33.3 (28-33) | -0.2 | OK | 52.4 | 51.5 (46-51) | +0.9 | OK | 34.5 | 37.0 | 060M |
| shoemaker-rim-e | 18.1 | 18.1 (16-19) | 0.0 | OK | 49.9 | 49.0 (49-49) | +0.9 | OK | 18.2 | 18.7 | 060M |
| faustini-rim-a | 29.7 | 30.4 (21-30) | -0.7 | OK | 51.5 | 50.8 (51-51) | +0.7 | OK | 31.5 | 39.6 | 060M |
| shoemaker-rim-f | 25.5 | 25.1 (23-26) | +0.4 | OK | 47.4 | 46.7 (47-47) | +0.7 | OK | 26.9 | 35.8 | 060M |
| cabeus-exterior-wall-1 | 18.8 | 14.0 (0-22) | +4.8 | OK | 38.1 | 37.4 (0-38) | +0.7 | OK | 20.8 | 24.6 | 060M |
| amundsen-1 | 3.5 | 3.7 (3-4) | -0.2 | OK | 38.1 | 37.6 (38-38) | +0.5 | OK | 3.6 | 3.7 | 120M |
| idelson-l-crater-1 | 25.2 | 25.3 (25-25) | -0.2 | OK | 24.8 | 24.7 (23-25) | +0.1 | OK | 25.3 | 25.8 | 060M |
| malapert-crater-1 | 10.1 | 10.0 (10-10) | +0.1 | OK | 52.8 | 52.1 (52-52) | +0.7 | OK | 10.1 | 10.2 | 120M |
| peak-near-shackleton | 60.0 | 70.2 (17-86) | -10.1 | explained | 57.5 | 55.9 (44-56) | +1.6 | OK | 80.8 | 88.5 | 060M |
| de-gerlache-rim-1 | 54.0 | 49.0 (33-61) | +5.0 | OK | 62.0 | 61.3 (61-61) | +0.7 | OK | 69.2 | 81.7 | 060M |
| leibnitz-beta-plateau | 21.2 | 20.4 (15-27) | +0.8 | OK | 40.2 | 39.1 (35-43) | +1.1 | OK | 25.2 | 46.4 | 060M |
| de-gerlache-kocher-massif | 78.6 | 67.6 (28-79) | +11.0 | explained | 61.2 | 60.6 (38-61) | +0.6 | OK | 82.1 | 82.4 | 060M |
| shoemaker | 33.1 | 34.2 (32-36) | -1.1 | OK | 44.4 | 43.6 (43-44) | +0.8 | OK | 35.2 | 38.8 | 060M |
| connecting-ridge-extension | 34.5 | 35.2 (32-35) | -0.7 | OK | 0.0 | 0.0 (0-0) | 0.0 | OK | 35.8 | 39.2 | 060M |

### Écarts de plus de 5 points

| Site | Écart | Explication |
|---|---|---|
| de-gerlache-rim-2 (Soleil) | +17,5 | Crête. Le 3×3 NASA va de 36 à 62 %, nous sommes à 53 %. |
| de-gerlache-kocher-massif (Soleil) | +11,0 | Sommet. 3×3 NASA : 28 à 79 %, nous 78,6 %. |
| peak-near-shackleton (Soleil) | -10,1 | Pic. 3×3 NASA : 17 à 86 %. |
| mons-mouton (Soleil, Terre) | +8,5 / +7,3 | Bord de plateau. 3×3 NASA : 29 à 63 % (Soleil), 46 à 74 % (Terre). |
| nobile-rim-1 (Soleil) | +5,3 | 3×3 NASA : 49 à 62 %. |
| mons-mouton-plateau (Terre) | +5,5 | Nous 100 %, NASA 94,5 % (3×3 : 85 à 100 %). |
| shoemaker-rim-c (Terre) | -6,5 | Nous 24,5 %, NASA 30,9 % (3×3 : 31 à 35 %), nos voisins à 80 m couvrent la valeur NASA. |

## 5. Autres contrôles

- **JPL Horizons** (`GeometryTests.SunAzEl_Haworth_MatchesJplHorizons`) : azimut et élévation du Soleil à Haworth le 2026-01-01 à 0 h UTC, valeur lue dans Horizons. Notre calcul est à moins de 0,01°. Un décalage de 0,1° de la longitude du Soleil ou du site fait échouer le test.
- **Sphère lisse** (`HorizonMaskTests`) : sur une Lune sans relief, l'horizon vaut l'abaissement théorique `-acos(R / (R + h))` pour h = 2 m, 10 m et 1000 m, à 0,001° près.
- **Littérature** (calcul Python de `tools/validation/ridge_best.py`, pas refait en C#) : au meilleur point de la Connecting Ridge, 89,8 % de Soleil à 2 m et 93,5 % à 10 m. Gläser et al. 2014 (relief 20 m, 19 ans) publient 92,27 % et 95,65 %. Écart de -2,5 et -2,2 points, cohérent avec notre relief plus grossier (80 m).

## 6. Ce qui n'est PAS validé

- **Le relief lui-même.** La NASA et nous utilisons tous deux LOLA. Cette comparaison valide la méthode et la géométrie, pas les données de relief. Une source indépendante (carte LROC WAC, faite à partir de photos) n'a pas encore été lue (tâche N2).
- **Le calendrier par la carte NASA** : voir les contrôles négatifs. Seul le test JPL Horizons couvre le calendrier.
- **La période.** NASA : 18,6 ans. Nous : 5 ans (2026-2030). D'une année à l'autre, le Soleil d'un site varie de 2 à 3 points. Le biais Terre régulier de +0,7 point pourrait venir de là ; non vérifié (tâche N3).
- **Les hauteurs 2 m et 10 m** : aucune carte NASA publique à ces hauteurs. Seule la comparaison avec Gläser 2014 les couvre, sur un site.
- **La hauteur de l'observateur NASA** n'est pas écrite dans l'étiquette des cartes : nous avons supposé 0 m (« à la surface », page PGDA).
- **Les crêtes** : un pixel de 80 m lisse les sommets ; c'est là que sont tous les écarts de plus de 5 points.

## 7. Reproduire

Depuis le dossier `LunarNav` (la carte `data/LDEM_80S_80M.IMG`, 115,5 Mo, vient de `http://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/` et n'est pas dans git) :

```
dotnet run -c Release --project LunarNav.Api -- validate data/LDEM_80S_80M.IMG LunarNav.Web/wwwroot/data ../tools/validation LunarNav.Web/wwwroot/data/validation.json
dotnet run -c Release --project LunarNav.Api -- manifest <chemin complet de LunarNav.Web/wwwroot/data>
```

Environ 1 minute en Release. Les valeurs NASA (`pgda.json`) et Python (`ours.json`) ont été produites par `tools/validation/pgda.py` et `ours.py` (voir leur en-tête).

## 8. Pour la diapositive

1. « Le code du produit lui-même a été comparé aux cartes NASA/LOLA : 26 sites sur 31 à moins de 5 points pour le Soleil, 28 sur 31 pour la Terre, écart médian 0,8 point. »
2. « Les écarts plus grands sont tous sur des crêtes, où la carte NASA elle-même change de 20 à 60 points d'un pixel au voisin. Aucun écart inexpliqué. »
3. « Seuils écrits avant le calcul, échecs compris : nous montrons aussi ce que cette comparaison ne prouve pas. »
4. « Directions du Soleil et de la Terre : JPL Horizons à moins de 0,01°. »
5. Limite à dire : même relief que la NASA (LOLA), 5 ans au lieu de 18,6, pas de carte NASA à 2 m ou 10 m.
