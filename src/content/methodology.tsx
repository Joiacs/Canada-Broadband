import Link from "next/link";
import { localePath } from "@/i18n/config";

export function MethodologyEn() {
  return (
    <>
      <p>
        This map combines two very different kinds of information: <strong>measured speeds</strong> from real internet speed tests, and <strong>advertised availability</strong> reported by
        internet providers to the federal government. Looking at both side by side is the point — but they answer different questions, so it helps to know how each is built.
      </p>

      <h2>Measured speeds</h2>
      <h3>Where the tests come from</h3>
      <ul>
        <li>
          <strong>Measurement Lab (M-Lab)</strong> runs the open-source NDT speed test used by many websites and apps (including CIRA&apos;s Internet Performance Test). Every result is published as
          open data. We import Canadian tests every night from M-Lab&apos;s public BigQuery tables (<code>measurement-lab.ndt.unified_downloads</code> and <code>unified_uploads</code>), which already
          apply M-Lab&apos;s own quality filters.
        </li>
        <li>
          <strong>Ideva speed tests</strong> — people who use <Link href={localePath("en", "speedTest")}>our speed test</Link> and choose to add their result. These run on the same M-Lab
          infrastructure, so the same test is never counted twice.
        </li>
      </ul>

      <h3>Counting people, not clicks</h3>
      <p>
        Someone frustrated with their connection may run a test ten times in a row. To stop that from skewing an area, we count <strong>one result per connection per day</strong> — the median of
        that connection&apos;s tests that day. Connections are told apart with a one-way, salted hash of the IP address and the date, created in the database query itself. We never store IP
        addresses, and the hash changes every day so it can&apos;t follow anyone over time. When we say &quot;people tested&quot;, we mean these connection-days.
      </p>

      <h3>Statistics</h3>
      <ul>
        <li>
          <strong>Median speed</strong> — half of the people who tested got at least this speed. We use medians because a few very fast fibre connections would pull an average far above what a
          typical household experiences.
        </li>
        <li>
          <strong>Middle 50%</strong> — the range between the 25th and 75th percentiles.
        </li>
        <li>
          <strong>% meeting 50/10</strong> — the share of people whose download was at least 50 Mbps (or, when viewing uploads, whose upload was at least 10 Mbps). 50/10 Mbps is the CRTC&apos;s
          universal service objective and the target of the federal Universal Broadband Fund.
        </li>
      </ul>
      <p>
        Speeds are stored as fine-grained histograms per area and day, with 10 and 50 Mbps as exact boundaries, so percentages against the target are exact and medians are accurate to within a
        few percent. An area needs at least <strong>10 people</strong> in the selected period before it is coloured, and is shown lighter when fewer than 30 people tested.
      </p>

      <h3>Locating tests</h3>
      <p>
        M-Lab estimates where a test came from using the IP address. That is usually accurate to the town or city, sometimes worse in rural areas where an ISP routes traffic through a distant
        hub. M-Lab tests are therefore shown for provinces, census divisions and communities, but <strong>not</strong> for 25 km² hexagons. Ideva speed tests use the location you choose (your
        device location, rounded to about 100 m before it leaves your browser, or a community you search for). It is used once to find your community and hexagon and is not stored.
      </p>

      <h3>Providers</h3>
      <p>
        Each test records the network (autonomous system) it came from. We map networks to provider brands — for example, Shaw&apos;s networks count toward Rogers since the 2023 merger. Provider
        breakdowns are available for provinces and census divisions.
      </p>

      <h3>Verifying Ideva speed tests</h3>
      <p>
        Results submitted from our page carry the ID of the M-Lab test they came from. Once M-Lab publishes that test (usually within two days), we compare the download speed with M-Lab&apos;s
        server-side measurement. Results within 30% are marked verified; others are excluded. Results that never appear in M-Lab&apos;s Canadian data within 7 days stop counting.
      </p>

      <h2>Advertised availability</h2>
      <p>
        Innovation, Science and Economic Development Canada (ISED) publishes the <a href="https://open.canada.ca/data/en/dataset/00a331db-121b-445d-b119-35dbbe3eedd9">National Broadband Data</a>,
        built from information providers report about where they offer service. ISED models where households are using &quot;pseudo-households&quot; — points placed along roads and in
        dissemination blocks, each carrying a share of the 2021 census population.
      </p>
      <p>
        For each area we add up the population of pseudo-households where ISED reports that 50/10 Mbps service is available (any wired or wireless technology) and divide by the area&apos;s total
        population. Because this uses the individual points rather than averaging hexagons, it is an exact population-weighted figure. We also list the providers ISED reports in each area.
      </p>

      <h2>The gap</h2>
      <p>
        The <strong>gap</strong> is the advertised share minus the measured share meeting the target, in percentage points. A large positive gap means many people <em>could</em> buy 50/10
        service on paper, but few people who tested are getting it. It is a prompt for questions, not proof of anything on its own:
      </p>
      <ul>
        <li>Many households choose plans slower than 50/10, often because of price.</li>
        <li>Wi-Fi, older devices and busy home networks reduce test results.</li>
        <li>People are more likely to run a speed test when something feels slow.</li>
        <li>NDT uses a single connection, which can under-report very fast plans compared with multi-connection tests.</li>
        <li>Advertised availability reflects what providers report, and ISED updates it periodically.</li>
      </ul>

      <h2>Boundaries</h2>
      <p>
        Provinces and territories, census divisions and census subdivisions (&quot;communities&quot;) are Statistics Canada&apos;s 2021 cartographic boundary files. Hexagons are ISED&apos;s
        25 km² grid, published only for populated areas.
      </p>

      <h2>Updates</h2>
      <p>
        M-Lab data is imported nightly, with a delay of one to two days. Ideva speed tests appear within minutes. ISED availability is refreshed when ISED publishes a new release. Older raw
        test records are deleted after a retention period; the aggregated statistics are kept.
      </p>
    </>
  );
}

export function MethodologyFr() {
  return (
    <>
      <p>
        Cette carte réunit deux types d&apos;information très différents : les <strong>vitesses mesurées</strong> par de vrais tests de vitesse, et la <strong>disponibilité annoncée</strong> que
        les fournisseurs déclarent au gouvernement fédéral. Les comparer est tout l&apos;intérêt, mais elles répondent à des questions différentes; voici comment chacune est construite.
      </p>

      <h2>Vitesses mesurées</h2>
      <h3>Provenance des tests</h3>
      <ul>
        <li>
          <strong>Measurement Lab (M-Lab)</strong> exploite le test de vitesse libre NDT, utilisé par de nombreux sites et applications (dont le Test de performance Internet de l&apos;ACEI). Chaque
          résultat est publié en données ouvertes. Nous importons chaque nuit les tests canadiens des tables BigQuery publiques de M-Lab (<code>measurement-lab.ndt.unified_downloads</code> et{" "}
          <code>unified_uploads</code>), qui appliquent déjà les filtres de qualité de M-Lab.
        </li>
        <li>
          <strong>Tests de vitesse Ideva</strong> — les personnes qui utilisent <Link href={localePath("fr", "speedTest")}>notre test de vitesse</Link> et choisissent d&apos;ajouter leur
          résultat. Ces tests passent par la même infrastructure M-Lab, et un même test n&apos;est jamais compté deux fois.
        </li>
      </ul>

      <h3>Compter des personnes, pas des clics</h3>
      <p>
        Une personne frustrée par sa connexion peut lancer dix tests d&apos;affilée. Pour éviter que cela fausse une zone, nous comptons <strong>un résultat par connexion par jour</strong> — la
        médiane des tests de cette connexion ce jour-là. Les connexions sont distinguées par un hachage salé et irréversible de l&apos;adresse IP et de la date, calculé dans la requête
        elle-même. Nous ne conservons jamais d&apos;adresse IP, et le hachage change chaque jour pour qu&apos;il soit impossible de suivre quelqu&apos;un dans le temps. Quand nous parlons de
        « personnes testées », il s&apos;agit de ces connexions-jours.
      </p>

      <h3>Statistiques</h3>
      <ul>
        <li>
          <strong>Vitesse médiane</strong> — la moitié des personnes testées ont obtenu au moins cette vitesse. Nous utilisons la médiane parce que quelques connexions par fibre très rapides
          tireraient une moyenne bien au-dessus de ce que vit un ménage typique.
        </li>
        <li>
          <strong>50 % du milieu</strong> — l&apos;écart entre le 25<sup>e</sup> et le 75<sup>e</sup> centile.
        </li>
        <li>
          <strong>% atteignant 50/10</strong> — la part des personnes dont le téléchargement atteint au moins 50 Mbit/s (ou, pour le téléversement, au moins 10 Mbit/s). Le 50/10 Mbit/s est
          l&apos;objectif de service universel du CRTC et la cible du Fonds pour la large bande universelle.
        </li>
      </ul>
      <p>
        Les vitesses sont conservées sous forme d&apos;histogrammes détaillés par zone et par jour, avec 10 et 50 Mbit/s comme bornes exactes; les pourcentages par rapport à l&apos;objectif sont
        donc exacts et les médianes précises à quelques pour cent près. Une zone doit compter au moins <strong>10 personnes</strong> pendant la période choisie pour être colorée, et elle
        apparaît plus pâle sous 30 personnes.
      </p>

      <h3>Localisation des tests</h3>
      <p>
        M-Lab estime la provenance d&apos;un test à partir de l&apos;adresse IP, généralement avec une précision à l&apos;échelle de la ville, parfois moins en milieu rural lorsque le
        fournisseur achemine le trafic par un centre éloigné. Les tests M-Lab sont donc affichés pour les provinces, les divisions de recensement et les collectivités, mais{" "}
        <strong>pas</strong> pour les hexagones de 25 km². Les tests Ideva utilisent l&apos;emplacement que vous choisissez (la position de votre appareil, arrondie à environ 100 m avant de
        quitter votre navigateur, ou une collectivité recherchée). Il sert une seule fois à trouver votre collectivité et votre hexagone et n&apos;est pas conservé.
      </p>

      <h3>Fournisseurs</h3>
      <p>
        Chaque test indique le réseau (système autonome) d&apos;où il provient. Nous associons les réseaux aux marques — par exemple, les réseaux de Shaw comptent pour Rogers depuis la fusion de
        2023. La répartition par fournisseur est offerte pour les provinces et les divisions de recensement.
      </p>

      <h3>Vérification des tests Ideva</h3>
      <p>
        Les résultats envoyés depuis notre page portent l&apos;identifiant du test M-Lab correspondant. Quand M-Lab publie ce test (habituellement en moins de deux jours), nous comparons la
        vitesse de téléchargement à la mesure du serveur de M-Lab. Les résultats à moins de 30 % d&apos;écart sont vérifiés; les autres sont exclus. Ceux qui n&apos;apparaissent pas dans les
        données canadiennes de M-Lab après 7 jours cessent d&apos;être comptés.
      </p>

      <h2>Disponibilité annoncée</h2>
      <p>
        Innovation, Sciences et Développement économique Canada (ISDE) publie les{" "}
        <a href="https://ouvert.canada.ca/data/fr/dataset/00a331db-121b-445d-b119-35dbbe3eedd9">Données nationales sur la large bande</a>, établies à partir des renseignements que les
        fournisseurs déclarent sur leurs zones de service. ISDE modélise l&apos;emplacement des ménages à l&apos;aide de « pseudo-ménages » — des points placés le long des routes et dans les îlots
        de diffusion, chacun portant une part de la population du recensement de 2021.
      </p>
      <p>
        Pour chaque zone, nous additionnons la population des pseudo-ménages où ISDE indique que le service 50/10 Mbit/s est offert (toute technologie filaire ou sans fil), puis nous la divisons
        par la population totale de la zone. Comme le calcul utilise chaque point plutôt qu&apos;une moyenne d&apos;hexagones, il s&apos;agit d&apos;un chiffre exact pondéré par la population.
        Nous indiquons aussi les fournisseurs déclarés par ISDE dans chaque zone.
      </p>

      <h2>L&apos;écart</h2>
      <p>
        L&apos;<strong>écart</strong> correspond à la part annoncée moins la part mesurée qui atteint l&apos;objectif, en points de pourcentage. Un écart positif important signifie que beaucoup de
        gens <em>pourraient</em> s&apos;abonner au 50/10 sur papier, mais que peu de personnes testées l&apos;obtiennent. C&apos;est une piste de questionnement, pas une preuve en soi :
      </p>
      <ul>
        <li>Beaucoup de ménages choisissent un forfait plus lent que 50/10, souvent pour des raisons de prix.</li>
        <li>Le Wi-Fi, les vieux appareils et les réseaux domestiques chargés réduisent les résultats.</li>
        <li>On a davantage tendance à faire un test quand la connexion semble lente.</li>
        <li>NDT utilise une seule connexion, ce qui peut sous-estimer les forfaits très rapides par rapport aux tests à connexions multiples.</li>
        <li>La disponibilité annoncée reflète ce que déclarent les fournisseurs; ISDE la met à jour périodiquement.</li>
      </ul>

      <h2>Limites géographiques</h2>
      <p>
        Les provinces et territoires, les divisions de recensement et les subdivisions de recensement (« collectivités ») proviennent des fichiers des limites cartographiques de 2021 de
        Statistique Canada. Les hexagones sont la grille de 25 km² d&apos;ISDE, publiée seulement pour les zones habitées.
      </p>

      <h2>Mises à jour</h2>
      <p>
        Les données de M-Lab sont importées chaque nuit, avec un délai d&apos;un à deux jours. Les tests Ideva apparaissent en quelques minutes. La disponibilité d&apos;ISDE est mise à jour à
        chaque nouvelle publication. Les anciens enregistrements de tests bruts sont supprimés après une période de conservation; les statistiques agrégées sont conservées.
      </p>
    </>
  );
}
