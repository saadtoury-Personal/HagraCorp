# Product

<!-- impeccable:product-schema 1 -->

> Contexte déduit du brief de l'utilisateur et du README (aucune entrevue formelle). Les éléments marqués « à confirmer » sont des hypothèses.

## Platform

web

## Stack

React + TypeScript + Vite, D3 pour les graphiques, Three.js / WebGL pour le globe et le terrain (choix de l'utilisateur, option A). Maquette jetable en HTML statique dans `design/mockup/`.

## Users

- Planificateurs de missions lunaires (science et ingénierie) qui comparent des sites d'atterrissage et des dates.
- Enseignants et grand public qui veulent comprendre pourquoi le pôle Sud lunaire est difficile (lumière rasante, liaison avec la Terre).
- Contexte : défi NASA Space Apps 2026 « Lunar Landing Site Navigator » (équipe HagraCorp, Sherbrooke).

## Product Purpose

Un outil intuitif qui compare des sites d'atterrissage et des dates au pôle Sud lunaire, en montrant le Soleil et la Terre par rapport à l'horizon, pour évaluer la production d'énergie et les fenêtres de communication directe avec la Terre (DTE). Succès : répondre en quelques secondes à « ce site est-il viable à cette date ? ».

## Positioning

Les outils existants (Moon Trek, JMARS, LROC QuickMap) sont puissants mais à l'interface compliquée. Ici : un seul zoom continu du globe jusqu'au sol, un curseur de temps qui pilote tout, et un classement inversé (on décrit la mission, l'outil propose les créneaux).

## Capabilities and Constraints

- 3 pages : Globe (Lune et Soleil à 45°, zoom jusqu'aux 13 régions), Site (survol du terrain façon vidéo NASA SVS 5013, indicateurs, chronogramme Soleil / Terre / les deux), Comparer (carte de chaleur sites × dates, classement).
- Backend prévu : FastAPI, pré-calcul par site (terrain LOLA, éphémérides SPICE ou Skyfield). Le frontend se développe d'abord contre des données simulées.
- Langue : français (anglais à confirmer).
- Les 13 régions candidates Artemis III sont celles de la vidéo NASA SVS 5013. Leurs positions dans la maquette sont illustratives.

## Brand Commitments

Direction visuelle imposée par l'utilisateur : proche des sites de la NASA et de SpaceX, propre et professionnel.

## Evidence on Hand

- Défi : https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- Vidéo de référence : https://svs.gsfc.nasa.gov/5013/
- Aucune donnée scientifique réelle intégrée pour l'instant : tout chiffre affiché dans la maquette est simulé et doit rester étiqueté comme tel.

## Product Principles

1. Une réponse lisible avant le détail : verdict d'abord, courbes ensuite.
2. Un seul temps partagé : le curseur de date pilote le globe, le terrain et les indicateurs.
3. Honnêteté scientifique : chaque valeur indique sa source ou son statut (simulé / calculé).
4. L'image porte la page, l'interface reste en retrait.

## Accessibility & Inclusion

Thème sombre par nature ; contraste texte AA, couleurs lisibles par les daltoniens (ne jamais coder le verdict par la couleur seule), navigation au clavier, respect de `prefers-reduced-motion`.
