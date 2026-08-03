# Script vidéo — "Comment lancer ta première Enchère" (Skoleom Live)

**Durée cible :** 1 min 30
**Public :** créateurs/vendeurs qui découvrent Skoleom Live
**Ton :** dynamique, direct, énergique — pas corporate
**Langue :** français
**Emplacement d'intégration :** modal "Comment ça marche ?" → onglet "Je suis Créateur" (`src/client/components/Guide/GuideModal.tsx`, composant `ExplainerVideo`)

---

## Charte visuelle

- **Fond** : noir/anthracite (`#0d0d10`), ambiance "app mobile premium"
- **Couleur d'accent principale** : vert néon `#a8ff35` (CTA, highlights, montants qui montent)
- **Couleur secondaire** : vert émeraude `#22c55e` (succès, paiement, gains)
- **Typo** : sans-serif bold, gros titres courts, jamais de paragraphe à l'écran
- **Logo** : icône Skoleom (calques verts, voir `/skoleom-mark.png`) en watermark coin bas-droit tout du long
- **Style d'animation recommandé** : captures d'écran réelles de l'app animées (zoom, transitions douces) plutôt que 3D abstrait — l'app existe déjà, mieux vaut montrer le vrai produit

---

## Scène par scène

### 0:00 – 0:08 — Accroche
**Visuel :** Logo Skoleom qui apparaît en glow vert néon sur fond noir, puis transition vers un live en cours (viewers qui commentent, produit affiché).
**Texte à l'écran :** "Vends en direct. Au meilleur prix."
**Voix off :**
> "Tu crées du contenu ? Et si chaque Live devenait une vente aux enchères ?"

### 0:08 – 0:20 — Étape 1 : Créer son compte
**Visuel :** Capture d'écran de l'inscription (30 secondes chrono à l'écran), puis écran de choix d'offre (Standard / Premium / Ultra Premium) avec les 3 cartes qui s'animent l'une après l'autre.
**Texte à l'écran :** "1. Crée ton compte & choisis ton offre"
**Voix off :**
> "Inscris-toi en 30 secondes. Ton offre détermine combien de manches d'enchère tu peux lancer par Live — commence gratuitement avec 2 manches, passe en Premium pour scaler."

### 0:20 – 0:35 — Étape 2 : Lancer l'enchère
**Visuel :** Écran Studio → sélection d'un produit (capsule) → réglage mise de départ + durée → bouton "Démarrer" qui pulse en vert néon.
**Texte à l'écran :** "2. Lance ton Enchère"
**Voix off :**
> "Depuis ton Studio, choisis un produit, fixe une mise de départ et une durée. Neuf ou d'occasion, tout est bienvenu. C'est parti."

### 0:35 – 0:55 — Étape 3 : Le prix qui grimpe en direct
**Visuel :** Écran live réel — bandeau "Mise actuelle" qui s'incrémente en temps réel (75€ → 90€ → 110€), chat qui défile avec des mises, compte à rebours qui se prolonge automatiquement dans les 3 dernières secondes (anti-sniping visible : le timer qui repart).
**Texte à l'écran :** "3. Le prix grimpe en direct" puis flash "Anti-sniping activé ⚡"
**Voix off :**
> "Tes viewers misent en temps réel dans le chat. Une mise de dernière seconde ? L'enchère se prolonge automatiquement. Le plus offrant remporte — ton pourcentage tombe immédiatement."

### 0:55 – 1:10 — Étape 4 : Ou un Live classique
**Visuel :** Transition vers un Live à prix fixe — bouton "Capsule" flottant qui apparaît à l'écran, viewer qui clique, fiche produit qui s'ouvre en overlay, achat validé.
**Texte à l'écran :** "4. Ou lance un Live classique"
**Voix off :**
> "Pas envie d'enchère ? Présente tes produits à prix fixe. Le bouton Capsule apparaît à l'écran, tes viewers achètent sans quitter le Live."

### 1:10 – 1:25 — Tes gains
**Visuel :** Écran wallet/gains qui s'anime, compteur qui monte, badge "jusqu'à 88%" qui apparaît en grand, glow vert émeraude.
**Texte à l'écran :** "Tes gains, tes règles — jusqu'à 88%"
**Voix off :**
> "Tu fixes ton prix, on s'occupe du paiement. Tu touches ton pourcentage dès validation de la commande."

### 1:25 – 1:30 — CTA final
**Visuel :** Retour logo Skoleom + bouton "Lancer mon premier Live" qui pulse, fond qui s'éclaircit légèrement.
**Texte à l'écran :** "Lance ton premier Live — skoleomLive"
**Voix off :**
> "Prêt à vendre en direct ? Lance ton premier Live, maintenant."

---

## Notes pour l'outil IA (Claude Design / génération vidéo)

- Respecter l'ordre exact des 4 étapes ci-dessus (elles correspondent au texte déjà affiché dans l'app — ne pas réinventer le contenu).
- Éviter tout jargon technique (pas de "API", "backend", etc.) — le public est un créateur de contenu, pas un développeur.
- Le montant "jusqu'à 88%" et le prix des offres (0€ / 9,90€ / 29,90€) doivent rester cohérents avec ce qui est affiché dans l'app — à vérifier avant export si ces chiffres changent côté produit.
- Format de sortie recommandé : vertical 9:16 **et** horizontal 16:9 (l'app affiche la vidéo en 16:9 dans la modal, mais un format vertical est utile pour du réutilisage en story/reel).
- Musique : rythmée, énergique, sans paroles (pour ne pas couvrir la voix off).
