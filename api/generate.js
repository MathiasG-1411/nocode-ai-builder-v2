export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { template, description, currentCode, modifyPrompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Clé API Gemini non configurée sur le serveur.' });

  const TEMPLATE_PROMPTS = {
    todo: `Génère une application de gestion de tâches COMPLÈTEMENT FONCTIONNELLE.\nFONCTIONNALITÉS OBLIGATOIRES:\n- Ajouter une tâche (champ texte + bouton + touche Entrée)\n- Cocher/décocher avec strike-through visuel\n- Supprimer une tâche (bouton ×)\n- Filtres: Toutes / Actives / Terminées (onglets fonctionnels)\n- Compteur de tâches restantes en temps réel\n- localStorage pour persistence\n- 5 tâches d'exemple pré-chargées`,
    ecommerce: `Génère une boutique en ligne COMPLÈTEMENT FONCTIONNELLE.\nFONCTIONNALITÉS OBLIGATOIRES:\n- 8 produits avec images (picsum.photos), nom, prix, description\n- Bouton Ajouter au panier — compteur mis à jour instantanément\n- Panneau panier latéral qui s'ouvre/ferme, quantités modifiables, total calculé\n- Supprimer des items du panier\n- Filtres par catégorie fonctionnels\n- Modal de confirmation commande`,
    dashboard: `Génère un dashboard analytics COMPLÈTEMENT FONCTIONNEL.\nFONCTIONNALITÉS OBLIGATOIRES:\n- 4 KPI cards (revenus, utilisateurs, commandes, taux)\n- Graphique à barres en SVG natif\n- Graphique linéaire en SVG natif\n- Tableau avec tri par colonne au clic\n- Sidebar navigation avec sections qui changent le contenu\n- Sélecteur de période (7j/30j/90j) qui met à jour les données`,
    crm: `Génère un CRM de gestion de contacts COMPLÈTEMENT FONCTIONNEL.\nFONCTIONNALITÉS OBLIGATOIRES:\n- Liste de contacts avec avatar, nom, email, téléphone, statut\n- Ajouter un contact (formulaire modal avec validation)\n- Modifier et supprimer un contact\n- Recherche en temps réel\n- Filtrer par statut (lead/client/prospect)\n- 8 contacts d'exemple pré-chargés`,
    finance: `Génère une app de gestion de budget COMPLÈTEMENT FONCTIONNELLE.\nFONCTIONNALITÉS OBLIGATOIRES:\n- Solde total mis à jour en temps réel\n- Ajouter une transaction (revenus/dépenses, montant, catégorie)\n- Liste des transactions avec suppression\n- Graphique camembert SVG des dépenses\n- Totaux revenus vs dépenses\n- 10 transactions d'exemple pré-chargées`,
    quiz: `Génère un quiz interactif COMPLÈTEMENT FONCTIONNEL.\nFONCTIONNALITÉS OBLIGATOIRES:\n- 8 questions avec 4 choix chacune\n- Highlight visuel immédiat sur sélection\n- Feedback immédiat (vert/rouge + bonne réponse)\n- Barre de progression visuelle\n- Timer par question (20 secondes)\n- Écran résultat avec score et bouton recommencer`,
    blog: `Génère une app de blog/notes COMPLÈTEMENT FONCTIONNELLE.\nFONCTIONNALITÉS OBLIGATOIRES:\n- Liste d'articles avec titre, extrait, date, tags\n- Créer/modifier/supprimer un article\n- Vue détail d'un article\n- Recherche en temps réel\n- Filtrer par tag\n- 5 articles d'exemple + localStorage`,
    calendar: `Génère un planning/calendrier COMPLÈTEMENT FONCTIONNEL.\nFONCTIONNALITÉS OBLIGATOIRES:\n- Vue calendrier mensuel avec navigation\n- Clic sur un jour pour ajouter un événement (modal)\n- Événements affichés sur les bons jours\n- Clic sur un événement pour le supprimer\n- Mise en évidence du jour actuel\n- 6 événements d'exemple pré-chargés`,
  };

  let prompt;
  if (modifyPrompt && currentCode) {
    prompt = `Voici une app web HTML/CSS/JS:\n\`\`\`html\n${currentCode}\n\`\`\`\n\nModification demandée: ${modifyPrompt}\n\nRETOURNE UNIQUEMENT le code HTML complet modifié, sans rien d'autre.`;
  } else {
    const base = TEMPLATE_PROMPTS[template] || TEMPLATE_PROMPTS.todo;
    prompt = `${base}\n\nPERSONNALISATION: ${description || 'App standard avec données réalistes'}\n\nRÈGLES ABSOLUES:\n1. Retourne UNIQUEMENT le code HTML complet (<!DOCTYPE html>...</html>)\n2. Tout le CSS et JS inline dans ce fichier\n3. Utilise Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>\n4. Design moderne, coloré, professionnel\n5. TOUTES les fonctionnalités doivent fonctionner\n6. Pas d'import externe sauf Tailwind CDN`;
  }

  const models = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 65536, temperature: 0.4 }
          })
        }
      );
      const data = await response.json();
      if (!response.ok) { lastError = data.error?.message || 'Erreur API'; continue; }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!raw) { lastError = 'Réponse vide'; continue; }
      const code = raw.replace(/^```html\n?/i, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
      return res.status(200).json({ code, model });
    } catch (e) {
      lastError = e.message;
    }
  }

  return res.status(500).json({ error: lastError || 'Tous les modèles ont échoué' });
}
