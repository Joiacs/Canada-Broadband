import ExportBuilder from "@/components/export-builder";
import type { Locale } from "@/i18n/config";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.ca";

function Endpoints() {
  const rows: [string, string][] = [
    ["GET /api/meta", "latest data date, default period, provider list"],
    ["GET /api/stats?level=&direction=&source=&isp=&from=&to=", "per-region [people, median, p25, p75, % meeting target, mean min RTT]"],
    ["GET /api/regions/{id}?source=&isp=&from=&to=", "detail for one region (e.g. csd:3520005)"],
    ["GET /api/regions/search?q=", "place search"],
    ["GET /api/export?level=&direction=&source=&isp=&from=&to=", "CSV of the same statistics"],
  ];
  return (
    <table>
      <tbody>
        {rows.map(([e, d]) => (
          <tr key={e}>
            <td>
              <code>{e}</code>
            </td>
            <td>{d}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DataEn({ locale, latest }: { locale: Locale; latest: string }) {
  return (
    <>
      <p>All statistics on this site are free to reuse. Download them as CSV, or call the same JSON API the map uses.</p>
      <h2>Download a CSV</h2>
      <ExportBuilder locale={locale} latest={latest} />
      <h2>Licence and attribution</h2>
      <p>
        Ideva&apos;s aggregated statistics are published under <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 (CC BY 4.0)</a>. Please cite:{" "}
        <em>Ideva Broadband ({SITE.replace(/^https?:\/\//, "")}), using Measurement Lab and ISED National Broadband Data.</em>
      </p>
      <ul>
        <li>
          Measured speeds derive from <a href="https://www.measurementlab.net/data/">M-Lab NDT data</a> (CC0 public domain).
        </li>
        <li>
          Advertised availability derives from ISED&apos;s <a href="https://open.canada.ca/data/en/dataset/00a331db-121b-445d-b119-35dbbe3eedd9">National Broadband Data</a>, under the{" "}
          <a href="https://open.canada.ca/en/open-government-licence-canada">Open Government Licence – Canada</a>.
        </li>
        <li>Boundaries: Statistics Canada, 2021 Census cartographic boundary files (Open Government Licence – Canada).</li>
      </ul>
      <h2>API</h2>
      <p>
        Responses are JSON and cached for an hour. Region ids look like <code>pr:35</code>, <code>cd:3520</code>, <code>csd:3520005</code>. Dates are <code>YYYY-MM-DD</code>; ranges can span up to
        three years. Please be considerate — for bulk work, download CSVs.
      </p>
      <Endpoints />
    </>
  );
}

export function DataFr({ locale, latest }: { locale: Locale; latest: string }) {
  return (
    <>
      <p>Toutes les statistiques de ce site peuvent être réutilisées gratuitement. Téléchargez-les en CSV ou utilisez la même API JSON que la carte.</p>
      <h2>Télécharger un CSV</h2>
      <ExportBuilder locale={locale} latest={latest} />
      <h2>Licence et attribution</h2>
      <p>
        Les statistiques agrégées d&apos;Ideva sont publiées sous licence <a href="https://creativecommons.org/licenses/by/4.0/deed.fr">Creative Commons Attribution 4.0 (CC BY 4.0)</a>. Veuillez
        citer : <em>Ideva Haute vitesse ({SITE.replace(/^https?:\/\//, "")}), à partir des données de Measurement Lab et des Données nationales sur la large bande d&apos;ISDE.</em>
      </p>
      <ul>
        <li>
          Les vitesses mesurées proviennent des <a href="https://www.measurementlab.net/data/">données NDT de M-Lab</a> (domaine public CC0).
        </li>
        <li>
          La disponibilité annoncée provient des{" "}
          <a href="https://ouvert.canada.ca/data/fr/dataset/00a331db-121b-445d-b119-35dbbe3eedd9">Données nationales sur la large bande</a> d&apos;ISDE, sous la{" "}
          <a href="https://ouvert.canada.ca/fr/licence-du-gouvernement-ouvert-canada">Licence du gouvernement ouvert – Canada</a>.
        </li>
        <li>Limites : Statistique Canada, fichiers des limites cartographiques du Recensement de 2021 (Licence du gouvernement ouvert – Canada).</li>
      </ul>
      <h2>API</h2>
      <p>
        Les réponses sont en JSON et mises en cache pendant une heure. Les identifiants de régions ressemblent à <code>pr:35</code>, <code>cd:3520</code>, <code>csd:3520005</code>. Les dates sont au
        format <code>AAAA-MM-JJ</code>; une période peut couvrir jusqu&apos;à trois ans. Merci d&apos;en faire un usage raisonnable — pour les gros volumes, téléchargez les CSV.
      </p>
      <Endpoints />
    </>
  );
}
