# Ma Station

Un comparateur de stations qui calcule le **coût réel du détour** pour aller
faire le plein — pas juste le prix affiché le plus bas — en tenant compte de
la consommation réelle de ton véhicule.

Les applications existantes (Waze, Essence et Stations…) classent les
stations par prix brut ou par simple proximité. Ma Station calcule, pour
chaque station à proximité, le coût du détour aller-retour depuis ta
position : `(distance A/R en km × conso L/100km / 100) × prix du litre`, et
te propose les 3 meilleures.

## Fonctionnalités (MVP)

- ✅ **Thermique** : choix du carburant (SP95, Gazole, E10, SP98, E85, GPLc),
  saisie de la consommation moyenne, calcul du coût réel du détour pour les
  stations à proximité (rayon 15 km), classement des 3 meilleures, lien
  itinéraire Google Maps.
- 🚧 **Électrique** : à venir, une fois le schéma des données IRVE (bornes de
  recharge) vérifié en conditions réelles.

## Stack

Site 100% statique : HTML / CSS / JavaScript vanilla, sans framework ni
backend. Les données sont interrogées directement depuis le navigateur via
l'API publique du gouvernement.

- Données carburants : [API prix des carburants (data.economie.gouv.fr)](https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/)
- Géolocalisation : `navigator.geolocation` (API navigateur)
- Itinéraire : lien Google Maps Directions

## Lancer en local

Aucune dépendance ni build. Sers simplement les fichiers statiques, par
exemple :

```bash
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

(La géolocalisation du navigateur nécessite HTTPS ou `localhost` — `python3
-m http.server` fonctionne car `localhost` est considéré comme une origine
sécurisée.)

## Déploiement

Déployé automatiquement sur GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`) à chaque push sur `main`.

Pour activer le déploiement sur un nouveau dépôt : dans **Settings → Pages**,
choisir **Source : GitHub Actions**.

Démo : `https://<ton-username>.github.io/<nom-du-repo>/`

## Roadmap

- [ ] Vérifier le schéma réel du dataset IRVE (bornes de recharge) et
      brancher le flow électrique.
- [ ] v2 : coût de la recharge électrique si une source de tarifs fiable en
      open data est identifiée.
