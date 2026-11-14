# HagraCorp
Nasa Sherbrooke Hakaton
### Missions to the Moon’s south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information with efficiency. Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows.

##Geospatial and data Visualization
#1. Données & Topographie
Récupérer et ingérer les MNT (Modèles Numériques de Terrain) LOLA (Lunar Orbiter Laser Altimeter) de la région du pôle Sud lunaire (résolution 5m à 20m).
#2. Masques d'horizon
Calculer le profil d'élévation de l'horizon dans toutes les directions azimuthales ($0^\circ$ à $360^\circ$) depuis des sites candidats (ex: Shackleton, Malapert, Faustini).
#3. Éphémérides & Positions
Calculer la position apparente exacte du Soleil et de la Terre vus du pôle Sud lunaire en fonction du temps (durant un cycle lunaire de ~29.5 jours).
#4. Croisement & Validation
Croiser les masques d'horizon avec les éphémérides pour déterminer les fenêtres d'illumination (puissance) et de visibilité directe de la Terre (télécommunications).
