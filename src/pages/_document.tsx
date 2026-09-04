import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        {/* Direction artistique "Ticket Show" — Poppins (texte) + Bebas Neue (titres/affiche) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />

        {/* Favicon/icone d'app — l'etoile du logo "Live" sur badge degrade lime/jaune. Pas de
            variante SVG (voir public/favicon-32x32.png etc.) : un <link rel="icon"> SVG sans
            `sizes` est prefere par Chrome a ces PNG, meme mis a jour — l'ancien mark ("Live Bag")
            continuerait sinon a s'afficher dans l'onglet malgre le changement de logo. */}
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#24102a" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
