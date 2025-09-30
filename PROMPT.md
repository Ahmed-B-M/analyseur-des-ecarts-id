# Prompt Détaillé pour la Création d'une Application d'Analyse Logistique

## 1. Objectif de l'Application

Créer une application web complète avec Next.js pour l'analyse de données logistiques. L'application doit permettre aux utilisateurs de téléverser deux fichiers (tournées et tâches), de visualiser des KPIs, d'analyser la performance via des graphiques et des tableaux, et d'identifier les anomalies. L'application doit être esthétique, performante et intuitive.

## 2. Pile Technologique

-   **Framework Principal** : Next.js 15+ avec App Router
-   **Langage** : TypeScript
-   **Style** : Tailwind CSS
-   **Composants UI** : shadcn/ui. Les composants doivent être utilisés autant que possible pour une cohérence visuelle.
-   **Graphiques** : Recharts
-   **Gestion d'état** : React Context API pour un état global simple.
-   **Intelligence Artificielle** : Genkit pour l'analyse sémantique des commentaires.
-   **Icônes** : Lucide React

## 3. Structure des Données et Fichiers

L'application doit gérer deux types de fichiers en entrée (.xlsx ou .csv). Les en-têtes de colonnes peuvent varier, le système doit donc être capable de les mapper à partir d'une liste d'alias.

### a. Fichier "Tournées"

Ce fichier contient les informations globales sur chaque tournée de livraison planifiée et réalisée.

| Champ Clé                             | Signification                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `nom`                                 | Identifiant unique de la tournée (ex: 'Bordeaux_2024-05-20_1').                           |
| `date`                                | Date de la tournée au format AAAA-MM-JJ.                                               |
| `entrepôt`                            | Nom de l'entrepôt de départ.                                                           |
| `livreur`                             | Nom du chauffeur assigné à la tournée.                                                 |
| `durée prévue (s)`                    | Temps total estimé pour la tournée en secondes, tel que planifié.                      |
| `durée réelle de la tournée (s)`      | Temps total réel de la tournée mesuré par le système.                                  |
| `capacité poids (kg)`                 | Charge maximale autorisée pour le véhicule en kilogrammes.                             |
| `poids (kg)`                          | Poids total planifié des marchandises pour la tournée.                                 |
| `kilométrage (km)`                    | Distance totale prévue pour la tournée en kilomètres.                                  |
| `heure de départ réelle du livreur`   | Heure exacte à laquelle le livreur a commencé sa tournée (timestamp ou format HH:mm:ss). |

### b. Fichier "Tâches"

Ce fichier contient les détails de chaque livraison individuelle (tâche) au sein d'une tournée.

| Champ Clé                                     | Signification                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Tournée`                                     | Nom de la tournée parente (sert de clé de jointure avec le fichier "Tournées").                             |
| `Date`                                        | Date de la tâche (sert aussi pour la jointure).                                                            |
| `Entrepôt`                                    | Entrepôt de la tâche (sert aussi pour la jointure).                                                        |
| `Avancement`                                  | Statut de la tâche (ex: 'Complétée', 'Annulée'). Seules les tâches 'Complétée' sont analysées.            |
| `Poids`                                       | Poids de la livraison en kilogrammes.                                                                      |
| `Départ` (début créneau)                      | Heure de début du créneau de livraison promis au client.                                                   |
| `Arrivée` (fin créneau)                       | Heure de fin du créneau de livraison promis au client.                                                     |
| `Heure d'arrivée sur site`                    | Heure exacte à laquelle le livreur est arrivé chez le client.                                              |
| `Heure de clôture`                            | Heure à laquelle la livraison a été finalisée dans le système (ex: signature client).                      |
| `Retard (s)`                                  | Écart en secondes entre l'heure de clôture et la fin du créneau (`Heure de clôture` - `Arrivée`).          |
| `Ville`                                       | Ville de l'adresse de livraison.                                                                           |
| `Code postal`                                 | Code postal de l'adresse de livraison.                                                                     |
| `Notez votre livraison`                       | Note attribuée par le client (généralement de 1 à 5).                                                      |
| `Qu'avez vous pensé de la livraison...?`      | Commentaire textuel laissé par le client.                                                                  |

### c. Fusion des Données

Les deux sources de données doivent être fusionnées en un seul tableau `MergedData`. La clé de fusion est une combinaison du nom de la tournée, de la date et de l'entrepôt (`uniqueId`). Chaque tâche doit être associée à sa tournée correspondante pour permettre une analyse complète.

## 4. Fonctionnalités Clés et Structure de l'Interface

L'interface principale doit être un tableau de bord organisé en onglets.

### a. Page Principale (`/`)

-   **En-tête** : Logo, titre de l'application "A-E-L - Analyse des Écarts Logistiques".
-   **Zone de Téléversement** : Deux zones de "drag-and-drop" pour les fichiers "Tournées" et "Tâches". Un indicateur de chargement doit s'afficher pendant le traitement des fichiers, qui se fait dans un web worker pour ne pas bloquer l'interface.
-   **Barre de Filtres** : Une barre de filtres complète doit être présente une fois les données chargées.
    -   Filtres : Période (DateRangePicker), Dépôt (Select), Entrepôt (Select), Ville (Select), Seuil de Ponctualité en secondes (Input, valeur par défaut : 959).
    -   Options avancées : Switch pour exclure les retards MAD (Mise à Disposition), bouton pour gérer les dates/entrepôts concernés par les MAD.
-   **Navigation par Onglets** :
    -   `Tableau de Bord` : Vue principale avec les KPIs et graphiques.
    -   `Analyse Comparative` : Comparaison des KPIs sur plusieurs semaines.
    -   `Comparaison Dépôts` : Comparaison des performances entre les dépôts.
    -   `Avis Négatifs` : Tableau détaillé des commentaires avec note <= 3.
    -   `Analyse par Période` : Vue Calendrier pour sélectionner des jours/semaines.
    -   `Données Détaillées` : Tableau brut des données fusionnées et filtrées.
    -   `RDP` et `Rapport RD` : Pages spécifiques existantes.

### b. Onglet "Tableau de Bord"

-   **KPIs Globaux** : Cartes pour afficher : Taux de Ponctualité, Nb. Tournées, Nb. Livraisons, Notation Moyenne, Nb. Livraisons en Retard/Avance, Nb. Avis Négatifs.
-   **KPIs d'Écarts** : Cartes comparatives (Planifié vs. Réalisé) pour : Taux de Ponctualité, Durée Totale, Poids Total.
-   **Analyse IA des Retours Clients** :
    -   Un bouton "Lancer l'analyse avec l'IA" qui analyse les commentaires avec note <= 3.
    -   Utilise un flux Genkit pour catégoriser chaque commentaire (ex: 'Retard', 'Avance', 'Attitude Livreur', 'Casse', 'Manquant', 'Autre').
    -   Affiche un graphique (BarChart) des résultats.
-   **Analyse des Anomalies** : Un accordéon avec des sections pour :
    -   `Dépassements de Charge`
    -   `Écarts de Durée Positifs`
    -   `Anomalies de Planification` (tournées parties à l'heure mais avec des livraisons en retard).
-   **Analyses Détaillées** :
    -   Graphiques de performance par jour et par créneau (ComposedChart).
    -   Histogramme de répartition des écarts (BarChart).
    -   Graphiques d'écarts par heure et par entrepôt.
-   **Tableaux de Performance** : Onglets pour afficher des tableaux triables de performance par Livreur, Dépôt, Entrepôt, Ville, et Code Postal.

### c. Onglet "Avis Négatifs"

-   Tableau listant uniquement les livraisons avec une note de 3 ou moins et un commentaire.
-   Afficher : Date, Livreur, Ville, Note, Commentaire.
-   Bouton "Analyser avec l'IA" pour lancer la catégorisation Genkit.
-   Carte affichant la répartition des catégories (résultats de l'IA).

## 5. Calculs et Formules Essentiels

Le fichier `src/lib/dataAnalyzer.ts` doit contenir la logique pour ces calculs.

-   **Seuil de Ponctualité par Défaut** : `959` secondes (environ 16 minutes).
-   **Statut de Retard d'une Tâche** (`retardStatus`) :
    -   `retard` = `heureCloture` - `heureFinCreneau`
    -   `late` si `retard` > `seuilDeToleranceEnSecondes`
    -   `early` si `retard` < `-seuilDeToleranceEnSecondes`
    -   `onTime` sinon.
-   **Taux de Ponctualité (Réalisé)** : `(Nombre de tâches 'onTime' / Nombre total de tâches) * 100`
-   **Durée Réelle Calculée (Tournée)** : Pour une tournée, `heureCloture` de la dernière tâche - `heureArriveeReelle` de la première tâche.
-   **Écart de Durée (Tournée)** : `dureeReelleCalculee` - `dureePrevue`
-   **% Dépassement de Poids (Tournée)** : `((poidsReel - poidsPrevu) / poidsPrevu) * 100` (calculé si `poidsPrevu > 0`).
-   **Anomalie de Planification** : Une tournée est en anomalie si `heureDepartReelle <= heureDepartPrevue` ET au moins une des tâches de la tournée a `retardStatus === 'late'`.
-   **Corrélation Retards / Avis Négatifs** : `(Nombre d'avis négatifs sur des livraisons en retard / Nombre total d'avis négatifs) * 100`

## 6. Palette de Couleurs (Thème)

Utiliser les variables CSS de `globals.css` pour assurer la cohérence.

-   **Primaire (Primary)** : `hsl(217 100% 31%)` (Bleu Carrefour)
-   **Accent (Accent)** : `hsl(349 100% 45%)` (Rouge pour les retards/erreurs)
-   **Avance (Couleur custom)** : `hsl(210 100% 56%)` (Bleu clair pour les livraisons en avance)
-   **Graphiques (Charts)** :
    -   `--chart-1: hsl(220 70% 50%)`
    -   `--chart-2: hsl(160 60% 45%)`
    -   `--chart-3: hsl(30 80% 55%)`
    -   Utiliser ces variables dans les graphiques Recharts pour une apparence cohérente.
