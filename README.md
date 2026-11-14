# HagraCorp
Nasa Sherbrooke Hakaton
### Missions to the Moon’s south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information with efficiency. Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows.

## Rôles et Responsabilités de l'Équipe
### Saad — Tech Lead & Full-Stack / Ephemeris Engineer  
Responsabilités / Owns : Architecture globale de l'application, conception du moteur de position du Soleil et de la Terre (via SPICE ou Skyfield), et intégration générale.  
### Edi — Geospatial Scientist & Data Validation Lead
Responsabilités / Owns : Gestion du terrain LOLA, extraction des masques d'horizon, calcul des fenêtres d'illumination et de visibilité (DTE), et vérifications numériques de cohérence physique.
### Youssef — Frontend & Data Visualization Engineer  
Responsabilités / Owns : Développement des graphiques d'horizon, du chronogramme puissance/communications, de la matrice de comparaison des sites et de la visualisation en globe 3D (optionnel).
### Nizar — Backend & API Developer
Responsabilités / Owns : Développement de l'API (FastAPI), mise en place du système de pré-calcul par site (cache) et gestion du déploiement.
### Nazim — UI/UX Designer & Frontend Support
Responsabilités / Owns : Création des wireframes, du design system, des composants d'interface de base et optimisation de l'ergonomie (UX). (Note : Nizar et Nazim peuvent permuter leurs rôles selon leurs compétences en design).
### Maggie — Mission Domain Specialist & Pitch Lead
Responsabilités / Owns : Recherche scientifique sur les sites d'atterrissage, rédaction des explications textuelles dans l'application, réalisation de la vidéo, soumission finale et présentation (pitch).
## Actions, Activités et Traitements par Domaine
### Pour mener à bien le projet, les actions et traitements techniques se répartissent ainsi :
Traitements Géospatiaux & Topographiques :Ingestion et traitement des Modèles Numériques de Terrain (MNT) LOLA (Lunar Orbiter Laser Altimeter).
Algorithmes de ray-casting pour déterminer les profils d'élévation de l'horizon sur 360°.
Vérifications numériques des seuils d'interception par rapport aux hauteurs de mâts.
Traitements Orbitauml & Éphémérides :Calculs de mécanique spatiale pour suivre la trajectoire apparente du Soleil et les oscillations de la Terre (libration) vus du pôle Sud lunaire.
Croisement des positions des astres avec les masques d'horizon pour identifier les périodes d'éclipse et les fenêtres de communication directe (DTE).
Architecture Back-end & API :Mise en place d'un serveur FastAPI pour servir les données géospatiales et les résultats de simulation.   Stratégie de pré-calcul (precompute) et de mise en cache pour garantir des performances fluides sur l'interface.
Interface et Data Visualization (Front-end) :Affichage interactif des diagrammes polaires d'horizon et des chronogrammes temporels.   Intégration du comparateur multi-sites.
