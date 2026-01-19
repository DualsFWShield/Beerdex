# 🍺 Beerdex

> **Le Pokédex ultime pour vos bières.**
> Collectionnez, notez, dégustez et devenez un véritable Zythologue.

![Beerdex Banner](icons/logo-bnr.png)

## 📖 À propos

**Beerdex** est une Progressive Web App (PWA) conçue pour les amateurs de bière qui souhaitent garder une trace de leurs dégustations sans dépendre d'une application lourde ou payante.
Construit avec la philosophie **"0$ Stack"**, le projet est entièrement statique, gratuit, respectueux de la vie privée (données locales uniquement) et fonctionne hors ligne.

---

## ✨ Fonctionnalités

### 🔍 Collection & Découverte
*   **Mode Découverte** : Cacher les bières non découvertes pour gamifier l'expérience. Si vous cherchez une bière inconnue, l'application vous propose de la créer.
*   **Filtres Avancés** :
    *   Par Type (Blonde, Trappiste, IPA...)
    *   Par Brasserie
    *   Par Degré d'alcool (Min, Max, Exact)
    *   Par Volume
*   **Recherche Instantanée** : Trouvez vos boissons par nom ou brasserie.

### 📝 Notes & Dégustation
*   **Fiches Détaillées** : Photo, infos techniques et statistiques personnelles pour chaque bière.
*   **Notation Personnalisable** :
    *   Score sur 20.
    *   Commentaires textuels.
    *   **Éditeur de Modèle** : Ajoutez vos propres critères (Amertume, Douceur, Robe...) via des sliders ou des cases à cocher.
*   **Historique de Consommation** : Suivez combien de fois et dans quel volume (Galopin, Pinte, etc.) vous avez consommé chaque bière.
*   **Ajout de Bières Custom** : Ajoutez vos propres trouvailles avec photo (support du recadrage automatique).

### 🏆 Gamification
*   **Système de Succès** : Plus de **100 succès** à débloquer (Le Centurion, Zythologue, Voyageur...).
*   **Statistiques** : Graphiques de progression, volume total bu (en litres/baignoires/piscines), et analyse de votre palais.
*   **Challenge Alphabet** : Buvez une bière commençant par chaque lettre de l'alphabet !

### 📱 Expérience PWA & Mobile
*   **Installable** : Ajoutez l'app sur votre écran d'accueil (Android/iOS/Desktop).
*   **Support Hors-Ligne** : Consultez votre collection même sans internet.
    *   *Page Offline Immersive* : "Le Bar est Fermé" avec animation interactive.
*   **Mise à jour Intelligente** : Détection automatique des nouvelles versions avec notification "Toast".
*   **Design Premium** : Thème sombre, Glassmorphism et animations fluides.

### 💾 Données & Vie Privée
*   **Local First** : Toutes les données sont stockées dans votre navigateur (IndexedDB/LocalStorage).
*   **Import/Export Avancé** :
    *   **Sauvegarde Fichier** : Export complet ou partiel (Bières perso, notes...) en JSON.
    *   **Lien Magique** : Transférez vos données vers un autre appareil via un simple lien URL.
*   **Partage Social** :
    *   Générez des stories Instagram personnalisées avec vos notes.
    *   Partagez des liens directs vers vos bières préférées.

---

## 🛠️ Stack Technique

Ce projet est réalisé **sans aucun framework** (No React, No Vue, No Build Step). Juste du code pur pour une performance maximale et une maintenance minimale.

*   **Langages** : HTML5, CSS3 (Variables, Flexbox, Grid), JavaScript (ES6+ Modules).
*   **Stockage** : LocalStorage.
*   **Iconographie** : SVG Inline (pour réduire les requêtes).
*   **PWA** : Service Worker personnalisé (Cache First strategy + Network Fallback).

## 🚀 Installation

### En tant qu'utilisateur
1.  Visitez l'URL du projet (ex: `https://votre-domaine.com`).
2.  Cliquez sur "Installer" dans la barre d'adresse ou le menu du navigateur.
3.  Profitez !

### Pour les développeurs
1.  Clonez ce dépôt.
2.  Ouvrez `index.html` dans votre navigateur.
    *   *Note : Pour que le Service Worker (PWA) fonctionne, il est préférable d'utiliser un serveur local simple (ex: Live Server sur VSCode ou `python -m http.server`).*

## 🤝 Contribuer

Les contributions sont les bienvenues ! Pour ajouter de nouvelles bières à la base de données statique :
1.  Ajoutez l'entrée dans le fichier JSON correspondant dans `data/`.
2.  Ajoutez l'image dans `images/beer/`.
3.  Proposez une Pull Request.

## 📄 Licence

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.
Créé avec ❤️ et 🍺 par **DualsFWShield**.
