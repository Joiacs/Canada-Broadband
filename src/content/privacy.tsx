/*
 * Privacy notice (PIPEDA; Quebec Law 25). Before launch Ideva must:
 *  - fill in PRIVACY_CONTACT below (Law 25 requires naming the person in charge
 *    of the protection of personal information and publishing contact details);
 *  - have the text reviewed by counsel;
 *  - confirm the database region (Supabase ca-central-1) matches "stored in Canada".
 */
const PRIVACY_CONTACT = {
  name: "[Name], [Title]",
  email: "[privacy@your-domain.ca]",
};
const UPDATED = "2026-11-08";

export function PrivacyEn() {
  return (
    <>
      <p className="text-sm text-muted">Last updated: {UPDATED}</p>
      <p>
        Ideva Inc. (&quot;Ideva&quot;, &quot;we&quot;) runs this website. We designed it to collect as little personal information as possible. This notice explains what we collect, why, and the
        choices you have.
      </p>

      <h2>Browsing the map</h2>
      <p>
        Viewing the map requires no account and sets no tracking cookies. We store your language choice in a cookie (<code>NEXT_LOCALE</code>) and your light/dark preference in your
        browser&apos;s local storage. Our hosting providers keep standard server logs (such as IP address and pages requested) for security and reliability, for a short period.
      </p>

      <h2>Running a speed test</h2>
      <p>
        The speed test is provided by <strong>Measurement Lab (M-Lab)</strong>, an independent non-profit. When you run it, M-Lab receives your IP address and test measurements and publishes them
        openly as part of its research data, under its own <a href="https://www.measurementlab.net/privacy/">privacy policy</a>. This happens whether or not you add your result to our map, and
        Ideva cannot remove data from M-Lab&apos;s archive. We ask for your explicit consent before every test.
      </p>

      <h2>Adding your result to our map (optional)</h2>
      <p>If you choose to add your result, we store:</p>
      <ul>
        <li>your download and upload speeds, latency, and the M-Lab test IDs (used to verify the result);</li>
        <li>the areas your location falls in — province, census division, community and 25 km² hexagon. If you share your device location, it is rounded to about 100 m in your browser, used
          once to look up those areas, and then discarded. We never store coordinates;</li>
        <li>any optional answers you give: provider, connection type, plan speeds, monthly price, Wi-Fi or wired;</li>
        <li>a one-way hash of your IP address combined with the date and a secret key. It lets us count one result per connection per day and limit abuse. It can&apos;t be reversed into your IP
          address and changes every day. We never store your IP address.</li>
      </ul>
      <p>
        We use this information only to produce the statistics on this site and in our open data. Published statistics are aggregated, and an area is only shown once enough people have tested
        there. We don&apos;t sell personal information and don&apos;t use it for advertising.
      </p>

      <h2>Abuse prevention</h2>
      <p>
        Submissions are protected by Cloudflare Turnstile, which may process your IP address and browser signals to tell people from bots. See{" "}
        <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare&apos;s privacy policy</a>.
      </p>

      <h2>Where data is stored and for how long</h2>
      <p>
        Our database is hosted in Canada. The website is served by a global content-delivery network. Submitted results are kept as long as they are useful for the map and our historical
        statistics; because they don&apos;t identify you, they cannot be linked back to you on request. Rate-limiting records are deleted after two days.
      </p>

      <h2>Your rights and questions</h2>
      <p>
        You can ask us about our handling of personal information, request access to or correction of information about you, or withdraw consent, by contacting our person in charge of the
        protection of personal information: {PRIVACY_CONTACT.name}, <a href={`mailto:${PRIVACY_CONTACT.email}`}>{PRIVACY_CONTACT.email}</a>. You may also contact the Office of the Privacy
        Commissioner of Canada or, in Quebec, the Commission d&apos;accès à l&apos;information.
      </p>
    </>
  );
}

export function PrivacyFr() {
  return (
    <>
      <p className="text-sm text-muted">Dernière mise à jour : {UPDATED}</p>
      <p>
        Ideva Inc. (« Ideva », « nous ») exploite ce site Web. Nous l&apos;avons conçu pour recueillir le moins de renseignements personnels possible. Le présent avis explique ce que nous
        recueillons, pourquoi, et vos choix.
      </p>

      <h2>Consultation de la carte</h2>
      <p>
        La carte ne nécessite aucun compte et n&apos;utilise aucun témoin de suivi. Nous conservons votre choix de langue dans un témoin (<code>NEXT_LOCALE</code>) et votre préférence de thème
        clair ou sombre dans le stockage local de votre navigateur. Nos hébergeurs conservent brièvement des journaux de serveur standard (comme l&apos;adresse IP et les pages consultées) à des
        fins de sécurité et de fiabilité.
      </p>

      <h2>Faire un test de vitesse</h2>
      <p>
        Le test de vitesse est fourni par <strong>Measurement Lab (M-Lab)</strong>, un organisme indépendant sans but lucratif. Lorsque vous le lancez, M-Lab reçoit votre adresse IP et les mesures du
        test et les publie ouvertement dans ses données de recherche, selon sa propre <a href="https://www.measurementlab.net/privacy/">politique de confidentialité</a>. Cela se produit que vous
        ajoutiez ou non votre résultat à notre carte, et Ideva ne peut pas retirer de données des archives de M-Lab. Nous demandons votre consentement explicite avant chaque test.
      </p>

      <h2>Ajouter votre résultat à la carte (facultatif)</h2>
      <p>Si vous choisissez d&apos;ajouter votre résultat, nous conservons :</p>
      <ul>
        <li>vos vitesses de téléchargement et de téléversement, la latence et les identifiants des tests M-Lab (pour vérifier le résultat);</li>
        <li>les zones où se trouve votre emplacement — province, division de recensement, collectivité et hexagone de 25 km². Si vous partagez la position de votre appareil, elle est arrondie à
          environ 100 m dans votre navigateur, utilisée une seule fois pour trouver ces zones, puis supprimée. Nous ne conservons jamais de coordonnées;</li>
        <li>vos réponses facultatives : fournisseur, type de connexion, vitesses du forfait, prix mensuel, Wi-Fi ou câble;</li>
        <li>un hachage irréversible de votre adresse IP combinée à la date et à une clé secrète. Il permet de compter un résultat par connexion par jour et de limiter les abus. Il ne permet pas de
          retrouver votre adresse IP et change chaque jour. Nous ne conservons jamais votre adresse IP.</li>
      </ul>
      <p>
        Nous utilisons ces renseignements uniquement pour produire les statistiques de ce site et de nos données ouvertes. Les statistiques publiées sont agrégées, et une zone n&apos;est affichée
        qu&apos;une fois que suffisamment de personnes y ont fait un test. Nous ne vendons pas de renseignements personnels et ne les utilisons pas à des fins publicitaires.
      </p>

      <h2>Prévention des abus</h2>
      <p>
        Les envois sont protégés par Cloudflare Turnstile, qui peut traiter votre adresse IP et des signaux de votre navigateur pour distinguer les personnes des robots. Consultez la{" "}
        <a href="https://www.cloudflare.com/fr-fr/privacypolicy/">politique de confidentialité de Cloudflare</a>.
      </p>

      <h2>Lieu et durée de conservation</h2>
      <p>
        Notre base de données est hébergée au Canada. Le site est diffusé par un réseau mondial de diffusion de contenu. Les résultats envoyés sont conservés tant qu&apos;ils sont utiles à la carte
        et à nos statistiques historiques; comme ils ne vous identifient pas, ils ne peuvent pas être associés à vous sur demande. Les enregistrements de limitation de débit sont supprimés après
        deux jours.
      </p>

      <h2>Vos droits et vos questions</h2>
      <p>
        Vous pouvez nous interroger sur notre traitement des renseignements personnels, demander l&apos;accès à des renseignements vous concernant ou leur rectification, ou retirer votre
        consentement en communiquant avec la personne responsable de la protection des renseignements personnels : {PRIVACY_CONTACT.name},{" "}
        <a href={`mailto:${PRIVACY_CONTACT.email}`}>{PRIVACY_CONTACT.email}</a>. Vous pouvez aussi vous adresser au Commissariat à la protection de la vie privée du Canada ou, au Québec, à la
        Commission d&apos;accès à l&apos;information.
      </p>
    </>
  );
}
