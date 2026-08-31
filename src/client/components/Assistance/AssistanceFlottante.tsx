import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
// Le CSS de ce composant est un import global (voir pages/_app.tsx) — en Pages
// Router, Next.js interdit d'importer un CSS global depuis un fichier autre
// que _app.tsx, d'où l'import fait là-bas plutôt qu'ici.

/**
 * Bouton d'assistance flottant "Poser une question", en bas à droite de tout
 * skoleomLive — porté depuis skoleom Travel (composant `AssistanceFlottante`),
 * repalette en noir/lime (identité skoleomLive) et FAQ réécrite pour ce produit
 * (lives, capsules, wallet) plutôt que pour du voyage.
 *
 * ── Comment part le message ─────────────────────────────────────────────
 * Comme sur Travel : pas de route serveur dédiée, le formulaire construit un
 * lien `mailto:` prérempli (objet + corps) et ouvre la messagerie du
 * visiteur, qui envoie depuis sa propre adresse. Zéro dépendance backend.
 *
 * Le jour où une route d'envoi existe côté API, il suffit de remplacer
 * `ouvrirMessagerie()` par un `api.post(...)` : le reste du composant ne
 * bouge pas.
 */

// ── Paramètres (modifiables) ─────────────────────────────────────────────
const ADRESSE_ASSISTANCE = 'support@skoleom.com';
const NOM_EQUIPE = 'Assistance skoleomLive';
const DISPONIBILITE = 'Réponse sous 24h en général';
/* Objet + corps voyagent dans une URL : les clients de messagerie coupent au
   -delà de ~2 000 caractères. La question est donc bornée, métadonnées incluses. */
const LONGUEUR_MAX_QUESTION = 1200;

const SUJETS = [
  'Question générale',
  'Un live (accès, invités, duo)',
  'Achat pendant un live / capsule',
  'Wallet & paiement',
  'Commande / livraison',
  'Compte & modération',
  'Signaler un problème',
  'Partenariat / professionnel',
];

type QuestionRapide = {
  puce: string;
  sujet: string;
  question: string;
  /**
   * Réponse rendue sur place, en paragraphes. Elle ne remplace pas l'humain :
   * le formulaire reste dessous, prérempli, pour qui veut poursuivre.
   */
  reponse: string[];
};

/**
 * Questions fréquentes et leurs réponses.
 *
 * Au clic, la puce affiche la réponse ET prérempli le sujet + la question :
 * la plupart des demandes s'arrêtent là, et celles qui continuent partent avec
 * un formulaire déjà rempli aux trois quarts.
 */
const QUESTIONS_RAPIDES: QuestionRapide[] = [
  {
    puce: 'Comment fonctionne un live privé ?',
    sujet: 'Un live (accès, invités, duo)',
    question: 'Comment fonctionne un live privé sur skoleomLive ?',
    reponse: [
      'Le créateur peut rendre son live privé au démarrage. Il choisit alors lui-même qui peut le regarder — en cherchant un pseudo ou parmi ses abonnés — ou tu peux lui envoyer une demande d’accès directement depuis la page du live, qu’il accepte ou refuse en un clic.',
      'Un live privé reste visible dans les listes (avec un cadenas), mais son contenu — vidéo, commentaires — n’est accessible qu’une fois l’accès accordé.',
    ],
  },
  {
    puce: 'Comment monter en duo sur un live ?',
    sujet: 'Un live (accès, invités, duo)',
    question: 'Comment demander à monter en duo (ou en groupe) sur un live ?',
    reponse: [
      'Depuis la page d’un live, un bouton « Demander à monter » envoie une demande au créateur, qu’il accepte ou refuse. Il peut aussi t’inviter lui-même en te cherchant par pseudo ou parmi ses abonnés.',
      'Plusieurs personnes peuvent être invitées en même temps sur le même live — pas seulement un duo à deux.',
    ],
  },
  {
    puce: 'Comment acheter un produit vu en live ?',
    sujet: 'Achat pendant un live / capsule',
    question: 'Comment acheter un produit mis en avant pendant un live ?',
    reponse: [
      'Quand un créateur met un produit en avant, une capsule apparaît en bas de l’écran — un tap ouvre la fiche produit et le paiement, sans quitter le direct.',
      'Le règlement se fait directement sur skoleomLive, par carte ou depuis ton wallet.',
    ],
  },
  {
    puce: 'À quoi servent le wallet et les jetons ?',
    sujet: 'Wallet & paiement',
    question: 'Comment fonctionnent le wallet et les jetons sur skoleomLive ?',
    reponse: [
      'Le wallet, c’est ton solde sur skoleomLive : tu le recharges pour envoyer des cadeaux pendant les lives ou payer des capsules.',
      'Les jetons, eux, sont uniquement offerts — cadeaux ou bonus — ils ne s’achètent pas séparément.',
    ],
  },
  {
    puce: 'Comment supprimer un commentaire ?',
    sujet: 'Compte & modération',
    question: 'Comment supprimer un commentaire sur un post ?',
    reponse: [
      'Tu peux supprimer tes propres commentaires sur n’importe quel post.',
      'Si tu es le créateur du post, tu peux aussi supprimer les commentaires laissés par d’autres en dessous.',
    ],
  },
  {
    puce: 'Un souci avec une commande ?',
    sujet: 'Commande / livraison',
    question: 'J’ai un souci avec une commande passée sur skoleomLive. Voici la référence et la date : ',
    reponse: [
      'Donne-nous la référence de la commande et la date d’achat : on regarde ça avec le créateur concerné.',
      'Le suivi de livraison dépend du créateur — certains achats sont physiques (produits) et d’autres purement numériques (accès, contenu).',
    ],
  },
];

interface FormState {
  sujet: string;
  prenom: string;
  lien: string;
  email: string;
  question: string;
}

const FORM_VIDE: FormState = {
  sujet: SUJETS[0],
  prenom: '',
  lien: '',
  email: '',
  question: '',
};

const ID_TITRE = 'asf-titre';

/** Bloc d'écriture du courriel : un seul endroit à relire si le format change. */
function composerMessage(form: FormState, page: string) {
  const objet = `[skoleomLive] ${form.sujet}`;

  const details = [
    `Prénom : ${form.prenom.trim()}`,
    form.email.trim() ? `E-mail : ${form.email.trim()}` : null,
    form.lien.trim() ? `Lien concerné : ${form.lien.trim()}` : null,
    page ? `Page : ${page}` : null,
  ].filter(Boolean);

  const corps = `${form.question.trim()}\n\n—\n${details.join('\n')}`;
  return { objet, corps };
}

export default function AssistanceFlottante() {
  const router = useRouter();
  const pathname = router.pathname ?? '/';

  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [copie, setCopie] = useState(false);
  /* Réponse ouverte, s'il y en a une : index dans QUESTIONS_RAPIDES. */
  const [reponseIdx, setReponseIdx] = useState<number | null>(null);
  /* Lien retenu après l'envoi : l'écran de confirmation le repropose si aucune
     messagerie ne s'est ouverte (poste sans client mail, webmail non déclaré). */
  const [lienMail, setLienMail] = useState('');

  const declencheurRef = useRef<HTMLButtonElement | null>(null);
  const panneauRef = useRef<HTMLDivElement | null>(null);
  const premierChampRef = useRef<HTMLInputElement | null>(null);

  const ouvrir = () => {
    setErreur(null);
    setEnvoye(false);
    setCopie(false);
    setReponseIdx(null);
    setOuvert(true);
  };

  const fermer = () => {
    setOuvert(false);
    // Le focus revient d'où il venait, sinon il repart en haut de la page.
    declencheurRef.current?.focus();
  };

  /**
   * Échap pour fermer, Tab bouclé dans le panneau, et défilement de la page
   * bloqué pendant l'ouverture — sans quoi, le panneau arrivé en bout de course,
   * c'est la page derrière qui se met à défiler sous le doigt.
   */
  useEffect(() => {
    if (!ouvert) return;

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fermer();
        return;
      }
      if (e.key !== 'Tab') return;
      const panneau = panneauRef.current;
      if (!panneau) return;
      const cibles = Array.from(
        panneau.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (!cibles.length) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      } else if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      }
    };

    document.addEventListener('keydown', auClavier);
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', auClavier);
      document.body.style.overflow = avant;
    };
  }, [ouvert]);

  /**
   * Focus du prénom réservé au bureau : sur mobile, il ouvre le clavier
   * dès l'ouverture du panneau et mange la moitié de l'écran.
   */
  useEffect(() => {
    if (!ouvert || envoye) return;
    if (window.matchMedia('(max-width: 760px)').matches) return;
    premierChampRef.current?.focus();
  }, [ouvert, envoye]);

  /**
   * La réponse s'insère sous les puces : sur un panneau de téléphone, elle naît
   * donc sous la ligne de flottaison, et on croit que le clic n'a rien fait. On
   * l'amène dans la vue — sans animation si l'on a demandé moins de mouvement.
   */
  useEffect(() => {
    if (reponseIdx === null) return;
    const bloc = panneauRef.current?.querySelector<HTMLElement>('.asf-reponse');
    if (!bloc) return;
    const doux = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bloc.scrollIntoView({ block: 'nearest', behavior: doux ? 'smooth' : 'auto' });
  }, [reponseIdx]);

  const maj =
    (champ: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [champ]: e.target.value }));

  /**
   * Une puce fait deux choses à la fois : elle répond, et elle prépare le
   * message. La réponse est affichée sur place — c'est là que la plupart des
   * demandes s'arrêtent — et le formulaire dessous est déjà rempli pour qui veut
   * poursuivre avec quelqu'un.
   */
  const choisirQuestion = (q: QuestionRapide, index: number) => {
    setErreur(null);
    setReponseIdx(index);
    setForm((f) => ({ ...f, sujet: q.sujet, question: q.question }));
  };

  /** « Écrire quand même » : le curseur en fin de texte, plusieurs questions
      préremplies attendant une suite (référence, lien...). */
  const allerAuFormulaire = () => {
    const zone = panneauRef.current?.querySelector<HTMLTextAreaElement>('.asf-zone-texte');
    if (!zone) return;
    zone.focus();
    zone.setSelectionRange(zone.value.length, zone.value.length);
    zone.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  /**
   * Un `<a>` détaché plutôt que `window.location.href` : la page courante n'est
   * pas engagée dans une navigation (certains navigateurs affichent sinon un
   * écran blanc le temps du basculement), et rien n'est bloqué comme une popup.
   */
  const ouvrirMessagerie = (lien: string) => {
    const a = document.createElement('a');
    a.href = lien;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const soumettre = (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (!form.prenom.trim()) {
      setErreur('Merci d’indiquer ton prénom, pour qu’on sache à qui l’on répond.');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      setErreur('Cette adresse e-mail semble incomplète.');
      return;
    }
    if (form.question.trim().length < 10) {
      setErreur('Décris ta question en quelques mots — même brièvement.');
      return;
    }

    const page = typeof window !== 'undefined' ? window.location.href : '';
    const { objet, corps } = composerMessage(form, page);
    const lien = `mailto:${ADRESSE_ASSISTANCE}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;

    setLienMail(lien);
    ouvrirMessagerie(lien);
    setEnvoye(true);
  };

  const copierMessage = async () => {
    const page = typeof window !== 'undefined' ? window.location.href : '';
    const { objet, corps } = composerMessage(form, page);
    try {
      await navigator.clipboard.writeText(
        `À : ${ADRESSE_ASSISTANCE}\nObjet : ${objet}\n\n${corps}`,
      );
      setCopie(true);
    } catch {
      setErreur(`Copie impossible depuis ce navigateur. Écris-nous à ${ADRESSE_ASSISTANCE}.`);
    }
  };

  const recommencer = () => {
    setForm(FORM_VIDE);
    setEnvoye(false);
    setCopie(false);
    setErreur(null);
    setReponseIdx(null);
  };

  // Les pages immersives (live plein écran, studio) n'admettent aucun élément flottant —
  // même arbitrage que Travel pour ses pages `/watch/` et `/touch`.
  if (pathname.startsWith('/live/') || pathname.startsWith('/studio')) return null;

  return (
    <>
      <button
        ref={declencheurRef}
        type="button"
        onClick={ouvrir}
        className={`asf-declencheur${ouvert ? ' asf-declencheur--efface' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
      >
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
          <path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="asf-declencheur-texte">Poser une question</span>
      </button>

      {/* Panneau monté en permanence, masqué par `visibility` : c'est ce qui
          permet d'animer la fermeture autant que l'ouverture — un panneau
          démonté disparaît d'un coup. `visibility: hidden` le retire du parcours
          de tabulation, le brouillon en cours de saisie est conservé. */}
      <div
        className={`asf-voile${ouvert ? ' asf-voile--ouvert' : ''}`}
        onClick={fermer}
        aria-hidden={!ouvert}
      >
        <div
          ref={panneauRef}
          className="asf-panneau"
          role="dialog"
          aria-modal="true"
          aria-labelledby={ID_TITRE}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── En-tête : qui répond, et en combien de temps ─────────── */}
          <header className="asf-entete">
            <span className="asf-medaillon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <circle
                  cx="12"
                  cy="12"
                  r="9.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path d="M15.4 8.6l-2 4.8-4.8 2 2-4.8z" fill="currentColor" />
              </svg>
              <i className="asf-presence" />
            </span>
            <div className="asf-identite">
              <p className="asf-nom" id={ID_TITRE}>
                {NOM_EQUIPE}
              </p>
              <p className="asf-dispo">{DISPONIBILITE}</p>
            </div>
            <button
              type="button"
              onClick={fermer}
              className="asf-fermer"
              aria-label="Fermer l’assistance"
            >
              ×
            </button>
          </header>

          {envoye ? (
            /* ── Confirmation ───────────────────────────────────────── */
            <div className="asf-succes">
              <span className="asf-succes-coche" aria-hidden="true">
                ✓
              </span>
              <h3 className="asf-succes-titre">Ta messagerie s’ouvre</h3>
              <p className="asf-succes-texte">
                Le message est prêt, prérempli pour <strong>{ADRESSE_ASSISTANCE}</strong> : il ne
                reste plus qu’à l’envoyer depuis ta boîte mail.
              </p>
              <p className="asf-succes-secours">Rien ne s’est ouvert ?</p>
              <div className="asf-succes-actions">
                <a href={lienMail} className="asf-bouton-secondaire">
                  Rouvrir ma messagerie
                </a>
                <button type="button" onClick={copierMessage} className="asf-bouton-secondaire">
                  {copie ? 'Message copié ✓' : 'Copier le message'}
                </button>
              </div>
              {erreur && (
                <p className="asf-erreur" role="alert">
                  {erreur}
                </p>
              )}
              <button type="button" onClick={recommencer} className="asf-lien-discret">
                Poser une autre question
              </button>
            </div>
          ) : (
            <form className="asf-form" onSubmit={soumettre}>
              <div className="asf-corps">
                <p className="asf-intro">
                  Une question sur un live, un achat ou ton compte ? Écris-nous, une personne de
                  l’équipe te répond.
                </p>

                {/* Les puces répondent sur place et préremplissent le message. */}
                <div className="asf-puces">
                  {QUESTIONS_RAPIDES.map((q, i) => (
                    <button
                      key={q.puce}
                      type="button"
                      className={`asf-puce${reponseIdx === i ? ' asf-puce--active' : ''}`}
                      onClick={() => choisirQuestion(q, i)}
                      aria-expanded={reponseIdx === i}
                    >
                      {q.puce}
                    </button>
                  ))}
                </div>

                {/* Réponse de l'équipe. `role="status"` : les lecteurs d'écran
                    l'annoncent sans qu'on ait à déplacer le focus, qui reste sur
                    la puce — donc navigable d'une question à l'autre. */}
                {reponseIdx !== null && (
                  <div className="asf-reponse" role="status">
                    <p className="asf-reponse-source">
                      {NOM_EQUIPE}
                      <button
                        type="button"
                        onClick={() => setReponseIdx(null)}
                        className="asf-reponse-fermer"
                        aria-label="Masquer la réponse"
                      >
                        ×
                      </button>
                    </p>
                    {QUESTIONS_RAPIDES[reponseIdx].reponse.map((paragraphe) => (
                      <p key={paragraphe.slice(0, 40)} className="asf-reponse-texte">
                        {paragraphe}
                      </p>
                    ))}
                    <div className="asf-reponse-actions">
                      <button type="button" onClick={fermer} className="asf-bouton-secondaire">
                        Merci, c’est clair
                      </button>
                      <button
                        type="button"
                        onClick={allerAuFormulaire}
                        className="asf-bouton-secondaire"
                      >
                        Écrire quand même à l’équipe
                      </button>
                    </div>
                  </div>
                )}

                <div className="asf-champ">
                  <label className="asf-etiquette" htmlFor="asf-sujet">
                    Sujet
                  </label>
                  <select
                    id="asf-sujet"
                    value={form.sujet}
                    onChange={maj('sujet')}
                    className="asf-select"
                  >
                    {SUJETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="asf-duo">
                  <div className="asf-champ">
                    <label className="asf-etiquette" htmlFor="asf-prenom">
                      Prénom
                    </label>
                    <input
                      id="asf-prenom"
                      ref={premierChampRef}
                      value={form.prenom}
                      onChange={maj('prenom')}
                      className="asf-input"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="asf-champ">
                    <label className="asf-etiquette" htmlFor="asf-lien">
                      Lien concerné <span className="asf-facultatif">(facultatif)</span>
                    </label>
                    <input
                      id="asf-lien"
                      value={form.lien}
                      onChange={maj('lien')}
                      className="asf-input"
                      placeholder="Lien du live, du post…"
                    />
                  </div>
                </div>

                <div className="asf-champ">
                  <label className="asf-etiquette" htmlFor="asf-email">
                    E-mail <span className="asf-facultatif">(facultatif)</span>
                  </label>
                  <input
                    id="asf-email"
                    type="email"
                    value={form.email}
                    onChange={maj('email')}
                    className="asf-input"
                    placeholder="toi@exemple.com"
                    autoComplete="email"
                  />
                </div>

                <div className="asf-champ">
                  <label className="asf-etiquette" htmlFor="asf-question">
                    Ta question
                  </label>
                  <textarea
                    id="asf-question"
                    value={form.question}
                    onChange={maj('question')}
                    className="asf-input asf-zone-texte"
                    rows={4}
                    maxLength={LONGUEUR_MAX_QUESTION}
                    placeholder="…"
                  />
                </div>
              </div>

              {/* L'erreur voyage avec le bouton : elle doit être sous les yeux
                    au moment où l'on appuie, feuille défilée ou non. */}
              <div className="asf-pied">
                {erreur && (
                  <p className="asf-erreur" role="alert">
                    {erreur}
                  </p>
                )}
                <button type="submit" className="asf-envoyer">
                  Envoyer ma demande
                </button>
                <p className="asf-mention">
                  Ouvre ta messagerie, message prérempli pour {ADRESSE_ASSISTANCE}
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
