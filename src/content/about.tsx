import Link from "next/link";
import { localePath } from "@/i18n/config";

const FAQ_EN: [string, React.ReactNode][] = [
  [
    "Why is my speed lower than my plan?",
    "Plan speeds are a maximum. Wi-Fi distance and interference, older routers and devices, other people using the connection, and congestion in your provider's network all reduce what you see. Testing over an Ethernet cable is the best way to see what reaches your home.",
  ],
  [
    "What do 50/10 Mbps and \"served\" mean?",
    "The CRTC set 50 Mbps download and 10 Mbps upload (with an unlimited data option) as the universal service objective for Canadian homes. Governments fund projects to bring 50/10 to every household by 2030.",
  ],
  [
    "What types of internet connection are there?",
    "Fibre to the home, cable (coaxial), DSL over phone lines, fixed wireless from a tower, mobile/5G home internet, and satellite — both traditional geostationary satellites and newer low-Earth-orbit services such as Starlink. Each has different speeds, latency and prices.",
  ],
  [
    "How can I improve my speed at home?",
    "Place the router centrally and in the open, use Ethernet for computers and TVs, restart the modem and router, update their firmware, and ask your provider whether your modem is up to date. If speeds stay low on a wired connection, contact your provider with your test results.",
  ],
  [
    "Where can I complain about my service?",
    "Start with your provider. If that doesn't resolve it, the Commission for Complaints for Telecom-television Services (CCTS) handles complaints about internet service in Canada, free of charge.",
  ],
];

const FAQ_FR: [string, React.ReactNode][] = [
  [
    "Pourquoi ma vitesse est-elle inférieure à celle de mon forfait?",
    "La vitesse d'un forfait est un maximum. La distance et l'interférence du Wi-Fi, les vieux routeurs et appareils, l'utilisation par d'autres personnes et la congestion du réseau du fournisseur réduisent la vitesse obtenue. Un test par câble Ethernet montre le mieux ce qui arrive chez vous.",
  ],
  [
    "Que signifient 50/10 Mbit/s et « desservi »?",
    "Le CRTC a fixé l'objectif de service universel à 50 Mbit/s en téléchargement et 10 Mbit/s en téléversement (avec une option de données illimitées) pour les foyers canadiens. Les gouvernements financent des projets pour offrir le 50/10 à tous les ménages d'ici 2030.",
  ],
  [
    "Quels types de connexion Internet existe-t-il?",
    "La fibre jusqu'au domicile, le câble (coaxial), le DSL sur ligne téléphonique, le sans-fil fixe à partir d'une tour, l'Internet résidentiel cellulaire ou 5G, et le satellite — géostationnaire traditionnel ou en orbite basse, comme Starlink. Chacun a ses vitesses, sa latence et ses prix.",
  ],
  [
    "Comment améliorer ma vitesse à la maison?",
    "Placez le routeur au centre et à découvert, branchez les ordinateurs et téléviseurs par Ethernet, redémarrez le modem et le routeur, mettez leur micrologiciel à jour et demandez à votre fournisseur si votre modem est récent. Si la vitesse reste basse en filaire, communiquez avec votre fournisseur en lui montrant vos résultats.",
  ],
  [
    "Où porter plainte au sujet de mon service?",
    "Commencez par votre fournisseur. Si le problème persiste, la Commission des plaintes relatives aux services de télécom-télévision (CPRST) traite gratuitement les plaintes concernant les services Internet au Canada.",
  ],
];

function Faq({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
      {items.map(([q, a]) => (
        <details key={q} className="group p-4">
          <summary className="cursor-pointer list-none font-medium marker:hidden">
            <span className="mr-2 inline-block text-brand transition group-open:rotate-90">›</span>
            {q}
          </summary>
          <p className="mt-2 pl-4 text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}

export function AboutEn() {
  return (
    <>
      <p className="text-lg">
        Canada Broadband shows how fast internet really is across Canada — community by community — and how that compares with what providers say is available.
      </p>
      <p>
        Federal maps tell you where 50/10 Mbps service is <em>offered</em>. They can&apos;t tell you what people actually get. We bring together millions of open speed-test results with the
        government&apos;s own availability data so residents, journalists, municipalities and policymakers can see where the two line up and where they don&apos;t.
      </p>
      <h2>What you can do here</h2>
      <ul>
        <li>
          <Link href={localePath("en", "home")}>Explore the map</Link> by province, census division, community or 25 km² hexagon, filtered by provider and time period.
        </li>
        <li>
          <Link href={localePath("en", "speedTest")}>Test your connection</Link> and add your result — your test makes the map better for your neighbours.
        </li>
        <li>
          <Link href={localePath("en", "data")}>Download the data</Link> for your own analysis.
        </li>
      </ul>
      <h2>Who we are</h2>
      <p>
        Canada Broadband is built and maintained by Ideva Inc. The project started in 2023 as a prototype map of M-Lab data and was rebuilt in 2026 with exact ISED availability data, community
        speed testing and a fully bilingual interface. Learn more about Ideva at <a href="https://ideva.app/">ideva.app</a>.
      </p>
      <h2>Data we rely on</h2>
      <p>
        Measurement Lab (M-Lab) open speed-test data; ISED&apos;s National Broadband Data (Open Government Licence – Canada); Statistics Canada boundary files; and map tiles from OpenFreeMap and
        OpenStreetMap contributors. These organisations provide data; they don&apos;t endorse this site. See the <Link href={localePath("en", "methodology")}>methodology</Link> for details.
      </p>
      <h2>Frequently asked questions</h2>
      <Faq items={FAQ_EN} />
    </>
  );
}

export function AboutFr() {
  return (
    <>
      <p className="text-lg">
        Large bande Canada montre la vitesse réelle d&apos;Internet partout au Canada — collectivité par collectivité — et la compare à ce que les fournisseurs disent offrir.
      </p>
      <p>
        Les cartes fédérales indiquent où le service 50/10 Mbit/s est <em>offert</em>. Elles ne disent pas ce que les gens obtiennent vraiment. Nous réunissons des millions de résultats ouverts
        de tests de vitesse et les données de disponibilité du gouvernement pour que les résidents, les journalistes, les municipalités et les décideurs voient où les deux concordent, et où ce
        n&apos;est pas le cas.
      </p>
      <h2>Ce que vous pouvez faire ici</h2>
      <ul>
        <li>
          <Link href={localePath("fr", "home")}>Explorer la carte</Link> par province, division de recensement, collectivité ou hexagone de 25 km², avec des filtres par fournisseur et par période.
        </li>
        <li>
          <Link href={localePath("fr", "speedTest")}>Tester votre connexion</Link> et ajouter votre résultat — votre test améliore la carte pour vos voisins.
        </li>
        <li>
          <Link href={localePath("fr", "data")}>Télécharger les données</Link> pour vos propres analyses.
        </li>
      </ul>
      <h2>Qui sommes-nous</h2>
      <p>
        Large bande Canada est conçu et maintenu par Ideva Inc. Le projet a commencé en 2023 comme prototype de carte des données de M-Lab et a été reconstruit en 2026 avec les données exactes
        de disponibilité d&apos;ISDE, des tests de vitesse communautaires et une interface entièrement bilingue. Pour en savoir plus sur Ideva : <a href="https://ideva.app/">ideva.app</a>.
      </p>
      <h2>Nos sources de données</h2>
      <p>
        Les données ouvertes de tests de vitesse de Measurement Lab (M-Lab); les Données nationales sur la large bande d&apos;ISDE (Licence du gouvernement ouvert – Canada); les fichiers des
        limites de Statistique Canada; et les tuiles cartographiques d&apos;OpenFreeMap et des contributeurs d&apos;OpenStreetMap. Ces organisations fournissent des données; elles
        n&apos;appuient pas ce site. Consultez la <Link href={localePath("fr", "methodology")}>méthodologie</Link> pour les détails.
      </p>
      <h2>Foire aux questions</h2>
      <Faq items={FAQ_FR} />
    </>
  );
}
