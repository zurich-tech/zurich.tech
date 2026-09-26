# Zurich organisations

Research checked on 2026-09-26 and imported with `bun scripts/organisations/import.ts`.
There is no target count or category quota.
Sections from the first research pass keep their original counts; the Completeness and Audit sections at the end record what was added and removed since.

## Contents

`organisations.json` contains **289 organisation records**, sorted by slug, after the audit and the completeness pass below.
Of these, 283 have addresses in Canton Zurich and 6 are explicitly marked `region: "outside"`.
The number reflects the records that passed this research pass, not a claim that Zurich has only this many technology organisations.

| Kind       | Entries |
| ---------- | ------: |
| startup    |     131 |
| company    |     108 |
| university |       3 |
| lab        |      32 |
| community  |       3 |
| nonprofit  |       4 |
| space      |       8 |

Every record has a street address or named airport building, coordinates, factual description, existing catalogue topics and source URLs.
Five records have an official logo asset, and every record has a square icon in `public/logos/icons/`, rasterised to 128px, with its URL in `iconSource`.
Icons come from the organisation's own website, its verified GitHub organisation, or for ETH groups without their own icon, ETH Zürich's.
A record without an icon is not listed.
Missing logos are not replaced with aggregator images.

## Scope

Include real technology work at an identifiable local office, laboratory or maintained shared space.
A registered address alone is insufficient when it is a fiduciary, law firm or other domicile arrangement.
An occasional event venue does not establish a permanent base.
A remote company is not excluded merely for being remote, but its mapped office still needs evidence.
Investors and acquisition counterparties mentioned in funding stories are not automatically local technology organisations.

The 11 outside-canton records cover Baden, Baar, Pfäffikon SZ, Steinhausen, Zug and Villigen.
Proxima Fusion's Park Innovaare office in Villigen is included because of its archive coverage and PSI collaboration; this is not a claim that PSI itself has a Zurich site.
These are selected adjacent technology hubs, not an attempt to cover all of Switzerland.

Deduplicate by organisation identity rather than mechanically by domain.
Independent laboratories sharing an ETH or UZH domain remain separate.
The joint Institute of Neuroinformatics is represented once.
A parent university record identifies its main campus, not an inferred location for every research group.
Additional offices are noted rather than creating duplicate company records.

The supplied existing slugs `eth-ai-center`, `zurich-tech` and `dream-machines` are deliberately omitted from this import file.
The live database was not queried.
Keep existing records during any eventual import.

## Verification

The news archive supplied candidates, not current-address evidence.
Official contact, visitor, careers and imprint pages were checked first.
Company-published LinkedIn locations, official university staff directories and Swiss UID records were used where needed.
Some conflicts also required commercial-register reproductions or a building operator's tenant information.
Sources for each included record are in its `sources` array; review qualifications are in `notes` and repeated below.

Descriptions are short factual paraphrases.
The `startup` versus `company` classification is editorial, not an assertion about legal status or the latest funding round.
Suggested missing topics are recorded in notes, not added to the permitted catalogue.

### Coordinates

Most coordinates come from the [swisstopo address search](https://api3.geo.admin.ch/rest/services/api/SearchServer), with `type=locations`, `origins=address` and `sr=4326`.
Street name and house number are matched exactly, including suffixes.
Stored coordinates were rechecked against returned address points; institutional postcode differences are retained rather than mistaken for different buildings.
Values are rounded to five decimal places; JSON numbers may omit trailing zeroes.

Seven records use documented alternatives to the swisstopo address result.

| Record                      | Coordinate evidence                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `topadur`                   | Exact OpenStreetMap house-number node 2974876628 for Grabenstrasse 11a, returned by Nominatim.                                                             |
| `eth-student-project-house` | Zentrum building pin linked from the organisation's own directions.                                                                                        |
| `zuehlke`                   | Schlieren office pin linked from the company's own directions for Zürcherstrasse 39j.                                                                      |
| `medyria`                   | Winterthur office pin embedded in the company's public map configuration; postal address specifies entrance 2c while the map labels the building number 2. |

| `sanos` | Google Maps exact address result for Industriestrasse 44, 8304 Wallisellen; pin visually checked. |
| `sygnum` | Google Maps exact address result for Uetlibergstrasse 134a, 8045 Zürich; not the conflicting company listing at number 132. |
| `assaia` | Google Maps company pin at Operation Center 4, matching the company's published exhibitor address. |

These are building/address points and company-published pins, not surveyed entrances.
No independent aerial-image audit of every building was performed.
Medyria's entrance suffix is an explicit review qualification, not a separately verified entrance coordinate.
Sanos and Sygnum were resolved using exact Google Maps address results, with the building pins checked visually.
Sygnum's business listing still points to number 132, so the pin for its officially published number 134a is used instead.
Assaia uses a named airport building rather than an invented street number.

ETH postcodes 8092/8093 and ZHAW postcode 8401 are institutional mailing postcodes.
Their geographic building postcodes may be 8001/8006/8049 and 8400 respectively.
Scanvio publishes 8058 Zürich for its airport address, while the address point is The Circle 60, 8302 Kloten.
Shared-address records intentionally have identical coordinates.

## Archive Reconciliation

All **179 articles** in `content/news/`, excluding its README, have a disposition below.
The reconciliation covers the subject organisations, not every investor or customer mentioned by a linked external article.

The article totals are 157 linked to included records, 16 linked to held candidates, four linked to exclusions, one about the existing community and one institutional release.
Repeated stories and renamed companies are consolidated.
This resolves to **132 included subject organisations**, **14 held candidates** and **four excluded candidates**.
The other 62 included records come from the broader ecosystem research.
Some records reconciled here were later excluded; the Audit section lists them.

Important identity decisions are listed here.

| Archive identity         | Record                                           |
| ------------------------ | ------------------------------------------------ |
| Swiss-Mile               | `rivr`                                           |
| Spiden                   | `liom`                                           |
| EthonAI                  | `ethon`                                          |
| AVIAN / Innovire         | `avian`                                          |
| TestResults.io / progile | `testresults`                                    |
| Candi Solar              | `candi-solar`                                    |
| Memo Therapeutics        | `memo-therapeutics`                              |
| Tethys Robotics          | `tethys-robotics`                                |
| Beekeeper / LumApps      | `beekeeper`, operating product identity retained |
| Daedalean / Destinus     | `daedalean`, operating company identity retained |

The complete article-to-record ledger follows.
“Held” means missing verification, not a finding that the company is inactive.

| Organisation or subject             | Disposition   | Local articles                                                                                                                                                                              |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8inks                               | included      | [8inks-pre-seed](../news/8inks-pre-seed.md)                                                                                                                                                 |
| a-metal                             | included      | [a-metal-seed](../news/a-metal-seed.md)                                                                                                                                                     |
| aisot                               | included      | [aisot-seed-extension](../news/aisot-seed-extension.md)                                                                                                                                     |
| akina                               | included      | [akina-seed](../news/akina-seed.md)                                                                                                                                                         |
| albatross                           | included      | [albatross-funding-2025](../news/albatross-funding-2025.md), [albatross-seed](../news/albatross-seed.md)                                                                                    |
| amnis                               | included      | [amnis-series-b](../news/amnis-series-b.md)                                                                                                                                                 |
| anapaya                             | included      | [anapaya-funding-2024](../news/anapaya-funding-2024.md)                                                                                                                                     |
| anybotics                           | included      | [anybotics-2024](../news/anybotics-2024.md)                                                                                                                                                 |
| apheros                             | included      | [apheros-pre-seed](../news/apheros-pre-seed.md)                                                                                                                                             |
| araris                              | included      | [araris-acquisition](../news/araris-acquisition.md)                                                                                                                                         |
| arcoris-bio                         | included      | [arcoris-bio-seed](../news/arcoris-bio-seed.md)                                                                                                                                             |
| arqh                                | included      | [arqh-pre-seed](../news/arqh-pre-seed.md)                                                                                                                                                   |
| askearth                            | included      | [askearth-seed](../news/askearth-seed.md)                                                                                                                                                   |
| assaia                              | included      | [assaia-series-b](../news/assaia-series-b.md)                                                                                                                                               |
| auterion                            | included      | [auterion-series-b](../news/auterion-series-b.md)                                                                                                                                           |
| avian                               | included      | [avian-pre-seed](../news/avian-pre-seed.md)                                                                                                                                                 |
| aylight                             | included      | [aylight-pre-seed](../news/aylight-pre-seed.md)                                                                                                                                             |
| beekeeper                           | included      | [beekeeper-financing-2025](../news/beekeeper-financing-2025.md)                                                                                                                             |
| bloom                               | held          | [bloom-pre-seed](../news/bloom-pre-seed.md)                                                                                                                                                 |
| boost                               | included      | [boost-series-b](../news/boost-series-b.md)                                                                                                                                                 |
| borobotics                          | included      | [borobotics-funding-2025](../news/borobotics-funding-2025.md)                                                                                                                               |
| brighty                             | held          | [brighty-funding-2024](../news/brighty-funding-2024.md)                                                                                                                                     |
| btry                                | included      | [btry-seed-2025](../news/btry-seed-2025.md)                                                                                                                                                 |
| bubble-robotics                     | held          | [bubble-robotics-pre-seed](../news/bubble-robotics-pre-seed.md)                                                                                                                             |
| calvin-risk                         | included      | [calvin-risk-seed](../news/calvin-risk-seed.md)                                                                                                                                             |
| candi-solar                         | included      | [candi-debt-2024](../news/candi-debt-2024.md), [candi-funding-2025](../news/candi-funding-2025.md), [candi-series-c](../news/candi-series-c.md)                                             |
| caplena                             | included      | [caplena-pre-series-a](../news/caplena-pre-series-a.md)                                                                                                                                     |
| cellvie                             | included      | [cellvie-funding-2025](../news/cellvie-funding-2025.md)                                                                                                                                     |
| cellx                               | included      | [cellx-pre-seed](../news/cellx-pre-seed.md)                                                                                                                                                 |
| cerrion                             | included      | [cerrion-funding-2024](../news/cerrion-funding-2024.md), [cerrion-series-a](../news/cerrion-series-a.md)                                                                                    |
| chipmind                            | included      | [chipmind-pre-seed](../news/chipmind-pre-seed.md)                                                                                                                                           |
| chiral                              | included      | [chiral-seed-2024](../news/chiral-seed-2024.md)                                                                                                                                             |
| circleg                             | included      | [circleg-funding-2024](../news/circleg-funding-2024.md)                                                                                                                                     |
| climeworks                          | included      | [climeworks-funding-2025](../news/climeworks-funding-2025.md), [climeworks-innovation-center](../news/climeworks-innovation-center.md), [climeworks-mammoth](../news/climeworks-mammoth.md) |
| corflow                             | included      | [corflow-series-b](../news/corflow-series-b.md)                                                                                                                                             |
| covalo                              | included      | [covalo-seed-extension](../news/covalo-seed-extension.md)                                                                                                                                   |
| cutiss                              | included      | [cutiss-series-c-extension](../news/cutiss-series-c-extension.md), [cutiss-series-c](../news/cutiss-series-c.md)                                                                            |
| daedalean                           | included      | [daedalean-acquisition](../news/daedalean-acquisition.md)                                                                                                                                   |
| deepjudge                           | included      | [deepjudge-seed](../news/deepjudge-seed.md), [deepjudge-series-a](../news/deepjudge-series-a.md)                                                                                            |
| deskbird                            | held          | [deskbird-series-b](../news/deskbird-series-b.md)                                                                                                                                           |
| drone-harmony                       | included      | [drone-harmony-funding-2024](../news/drone-harmony-funding-2024.md)                                                                                                                         |
| duramon                             | included      | [duramon-seed-extension](../news/duramon-seed-extension.md)                                                                                                                                 |
| embotech                            | included      | [embotech-series-b](../news/embotech-series-b.md)                                                                                                                                           |
| enantios                            | included      | [enantios-seed](../news/enantios-seed.md)                                                                                                                                                   |
| enshift                             | included      | [enshift-series-a](../news/enshift-series-a.md)                                                                                                                                             |
| etfbook                             | held          | [etfbook-series-a](../news/etfbook-series-a.md)                                                                                                                                             |
| eth-zurich; EPFL/CSCS outside scope | institutional | [apertus-release](../news/apertus-release.md)                                                                                                                                               |
| ethon                               | included      | [ethonai-series-a](../news/ethonai-series-a.md)                                                                                                                                             |
| evlabio                             | excluded      | [evlabio-seed](../news/evlabio-seed.md)                                                                                                                                                     |
| evulpo                              | included      | [evulpo-series-a](../news/evulpo-series-a.md)                                                                                                                                               |
| exclaim-robotics                    | held          | [exclaim-robotics-pre-seed](../news/exclaim-robotics-pre-seed.md)                                                                                                                           |
| flexion                             | included      | [flexion-series-a](../news/flexion-series-a.md)                                                                                                                                             |
| flowit                              | included      | [flowit-seed](../news/flowit-seed.md)                                                                                                                                                       |
| food-brewer                         | included      | [food-brewer-seed](../news/food-brewer-seed.md)                                                                                                                                             |
| forgis                              | included      | [forgis-pre-seed](../news/forgis-pre-seed.md)                                                                                                                                               |
| fotokite                            | included      | [fotokite-series-b](../news/fotokite-series-b.md)                                                                                                                                           |
| freename                            | included      | [freename-series-a](../news/freename-series-a.md)                                                                                                                                           |
| gelato                              | held          | [gelato-series-a-extension](../news/gelato-series-a-extension.md)                                                                                                                           |
| glycoera                            | included      | [glycoera-series-b](../news/glycoera-series-b.md)                                                                                                                                           |
| gravis-robotics                     | included      | [gravis-funding-2025](../news/gravis-funding-2025.md), [gravis-robotics-series-a](../news/gravis-robotics-series-a.md)                                                                      |
| grensol                             | included      | [grensol-seed](../news/grensol-seed.md)                                                                                                                                                     |
| hemotune                            | included      | [hemotune-series-b2](../news/hemotune-series-b2.md)                                                                                                                                         |
| hyperscale-power                    | included      | [hyperscale-power-seed](../news/hyperscale-power-seed.md)                                                                                                                                   |
| immunos                             | included      | [immunos-series-c](../news/immunos-series-c.md)                                                                                                                                             |
| jua                                 | included      | [jua-seed](../news/jua-seed.md), [jua-series-a](../news/jua-series-a.md)                                                                                                                    |
| knime                               | included      | [knime-funding-2024](../news/knime-funding-2024.md)                                                                                                                                         |
| kyan-health                         | included      | [kyan-health-series-a](../news/kyan-health-series-a.md)                                                                                                                                     |
| lakera                              | included      | [lakera-acquisition](../news/lakera-acquisition.md), [lakera-series-a](../news/lakera-series-a.md)                                                                                          |
| ledcity                             | excluded      | [ledcity-funding-2024](../news/ledcity-funding-2024.md)                                                                                                                                     |
| libattion                           | included      | [libattion-funding-2024](../news/libattion-funding-2024.md)                                                                                                                                 |
| lightium                            | included      | [lightium-seed](../news/lightium-seed.md)                                                                                                                                                   |
| limmatech                           | included      | [limmatech-series-a-extension](../news/limmatech-series-a-extension.md)                                                                                                                     |
| liom                                | included      | [liom-series-a-extension](../news/liom-series-a-extension.md), [liom-series-a](../news/liom-series-a.md), [spiden-financing-2024](../news/spiden-financing-2024.md)                         |
| localstack                          | held          | [localstack-series-a](../news/localstack-series-a.md)                                                                                                                                       |
| loft-dynamics                       | included      | [loft-dynamics-series-b](../news/loft-dynamics-series-b.md)                                                                                                                                 |
| logicstar                           | included      | [logicstar-pre-seed](../news/logicstar-pre-seed.md)                                                                                                                                         |
| loki                                | included      | [loki-pre-seed](../news/loki-pre-seed.md)                                                                                                                                                   |
| mabylon                             | included      | [mabylon-funding-2025](../news/mabylon-funding-2025.md)                                                                                                                                     |
| medyria                             | included      | [medyria-funding-2025](../news/medyria-funding-2025.md)                                                                                                                                     |
| memo-therapeutics                   | included      | [memo-series-c-extension](../news/memo-series-c-extension.md)                                                                                                                               |
| metafuels                           | included      | [metafuels-funding-2025](../news/metafuels-funding-2025.md), [metafuels-funding](../news/metafuels-funding.md)                                                                              |
| microagi                            | included      | [microagi-seed](../news/microagi-seed.md)                                                                                                                                                   |
| microcaps                           | included      | [microcaps-series-a](../news/microcaps-series-a.md)                                                                                                                                         |
| mimic                               | included      | [mimic-pre-seed](../news/mimic-pre-seed.md), [mimic-seed](../news/mimic-seed.md)                                                                                                            |
| modulos                             | included      | [modulos-pre-series-a](../news/modulos-pre-series-a.md)                                                                                                                                     |
| mosaic-soc                          | included      | [mosaic-soc-pre-seed](../news/mosaic-soc-pre-seed.md)                                                                                                                                       |
| motley                              | held          | [motley-pre-seed](../news/motley-pre-seed.md)                                                                                                                                               |
| nautica                             | included      | [nautica-seed](../news/nautica-seed.md)                                                                                                                                                     |
| netfabric                           | included      | [netfabric-pre-seed](../news/netfabric-pre-seed.md)                                                                                                                                         |
| neura-robotics                      | included      | [neura-robotics-series-c](../news/neura-robotics-series-c.md), [neura-robotics-zurich](../news/neura-robotics-zurich.md)                                                                    |
| nevermined                          | held          | [nevermined-funding-2025](../news/nevermined-funding-2025.md)                                                                                                                               |
| nextesy                             | included      | [nextesy-pre-seed](../news/nextesy-pre-seed.md)                                                                                                                                             |
| numab                               | included      | [numab-nm26-acquisition](../news/numab-nm26-acquisition.md), [numab-series-c-extension](../news/numab-series-c-extension.md)                                                                |
| nunu                                | held          | [nunu-pre-seed](../news/nunu-pre-seed.md), [nunu-seed](../news/nunu-seed.md)                                                                                                                |
| obligate                            | included      | [obligate-funding-2025](../news/obligate-funding-2025.md)                                                                                                                                   |
| odne                                | included      | [odne-series-a1-2024](../news/odne-series-a1-2024.md), [odne-series-a1](../news/odne-series-a1.md)                                                                                          |
| omnilex                             | included      | [omnilex-seed](../news/omnilex-seed.md)                                                                                                                                                     |
| onchainlabs                         | included      | [onchainlabs-seed](../news/onchainlabs-seed.md)                                                                                                                                             |
| oncobit                             | included      | [oncobit-funding-2025](../news/oncobit-funding-2025.md), [oncobit-pre-series-a](../news/oncobit-pre-series-a.md)                                                                            |
| onesoil                             | held          | [onesoil-funding](../news/onesoil-funding.md)                                                                                                                                               |
| optiml                              | included      | [optiml-pre-seed-extension](../news/optiml-pre-seed-extension.md), [optiml-seed](../news/optiml-seed.md)                                                                                    |
| oxyle                               | included      | [oxyle-seed](../news/oxyle-seed.md)                                                                                                                                                         |
| oxyprem                             | included      | [oxyprem-funding-2025](../news/oxyprem-funding-2025.md)                                                                                                                                     |
| positrigo                           | included      | [positrigo-funding-2025](../news/positrigo-funding-2025.md)                                                                                                                                 |
| proxima-fusion                      | included      | [proxima-fusion-series-a](../news/proxima-fusion-series-a.md)                                                                                                                               |
| qala                                | excluded      | [qala-pre-seed](../news/qala-pre-seed.md)                                                                                                                                                   |
| qcella                              | included      | [qcella-pre-seed](../news/qcella-pre-seed.md)                                                                                                                                               |
| raisenow                            | included      | [raisenow-funding-2025](../news/raisenow-funding-2025.md)                                                                                                                                   |
| relai                               | included      | [relai-series-a](../news/relai-series-a.md)                                                                                                                                                 |
| rivero                              | included      | [rivero-series-a](../news/rivero-series-a.md)                                                                                                                                               |
| rivia                               | included      | [rivia-seed](../news/rivia-seed.md), [rivia-series-a](../news/rivia-series-a.md)                                                                                                            |
| rivr                                | included      | [swiss-mile-seed](../news/swiss-mile-seed.md)                                                                                                                                               |
| roompricegenie                      | included      | [roompricegenie-investment-2025](../news/roompricegenie-investment-2025.md)                                                                                                                 |
| rtdt                                | included      | [rtdt-pre-seed](../news/rtdt-pre-seed.md)                                                                                                                                                   |
| saeki                               | included      | [saeki-funding-2025](../news/saeki-funding-2025.md)                                                                                                                                         |
| sallea                              | included      | [sallea-pre-seed](../news/sallea-pre-seed.md)                                                                                                                                               |
| sanos                               | included      | [sanos-funding-2024](../news/sanos-funding-2024.md)                                                                                                                                         |
| scalera                             | included      | [scalera-seed](../news/scalera-seed.md)                                                                                                                                                     |
| scanvio                             | included      | [scanvio-funding-2025](../news/scanvio-funding-2025.md)                                                                                                                                     |
| schuman                             | excluded      | [schuman-seed](../news/schuman-seed.md)                                                                                                                                                     |
| scrona                              | included      | [scrona-funding-2024](../news/scrona-funding-2024.md)                                                                                                                                       |
| scyai                               | included      | [scyai-pre-seed](../news/scyai-pre-seed.md)                                                                                                                                                 |
| seito                               | held          | [seito-funding-2025](../news/seito-funding-2025.md)                                                                                                                                         |
| skycell                             | included      | [skycell-series-d-extension](../news/skycell-series-d-extension.md)                                                                                                                         |
| somagenetix                         | included      | [somagenetix-series-a](../news/somagenetix-series-a.md)                                                                                                                                     |
| soverli                             | included      | [soverli-pre-seed](../news/soverli-pre-seed.md)                                                                                                                                             |
| sparkli                             | included      | [sparkli-pre-seed](../news/sparkli-pre-seed.md)                                                                                                                                             |
| stellar-alpina                      | included      | [stellar-alpina-pre-seed](../news/stellar-alpina-pre-seed.md)                                                                                                                               |
| sunflower-labs                      | included      | [sunflower-labs-series-b](../news/sunflower-labs-series-b.md)                                                                                                                               |
| swissdrones                         | included      | [swissdrones-series-b](../news/swissdrones-series-b.md)                                                                                                                                     |
| sygnum                              | included      | [sygnum-funding-2024](../news/sygnum-funding-2024.md), [sygnum-funding-2025](../news/sygnum-funding-2025.md)                                                                                |
| synthara                            | included      | [synthara-funding-2024](../news/synthara-funding-2024.md)                                                                                                                                   |
| taskbase                            | included      | [taskbase-series-a](../news/taskbase-series-a.md)                                                                                                                                           |
| terralayr                           | included      | [terralayr-funding-2024](../news/terralayr-funding-2024.md)                                                                                                                                 |
| testresults                         | included      | [testresults-seed](../news/testresults-seed.md)                                                                                                                                             |
| tethys-robotics                     | included      | [tethys-pre-seed](../news/tethys-pre-seed.md)                                                                                                                                               |
| tiun                                | included      | [tiun-pre-seed](../news/tiun-pre-seed.md)                                                                                                                                                   |
| topadur                             | included      | [topadur-funding-2024](../news/topadur-funding-2024.md)                                                                                                                                     |
| unbound-potential                   | included      | [unbound-potential-pre-seed](../news/unbound-potential-pre-seed.md)                                                                                                                         |
| unique                              | included      | [unique-series-a](../news/unique-series-a.md)                                                                                                                                               |
| validation-cloud                    | held          | [validation-cloud-funding-2024](../news/validation-cloud-funding-2024.md), [validation-cloud-series-a](../news/validation-cloud-series-a.md)                                                |
| veezoo                              | included      | [veezoo-series-a](../news/veezoo-series-a.md)                                                                                                                                               |
| viboo                               | included      | [viboo-funding-2025](../news/viboo-funding-2025.md)                                                                                                                                         |
| virometix                           | included      | [virometix-funding-2025](../news/virometix-funding-2025.md)                                                                                                                                 |
| voliro                              | included      | [voliro-series-a-extension](../news/voliro-series-a-extension.md), [voliro-series-a](../news/voliro-series-a.md)                                                                            |
| vvardis                             | included      | [vvardis-funding-february-2025](../news/vvardis-funding-february-2025.md), [vvardis-funding-july-2025](../news/vvardis-funding-july-2025.md)                                                |
| work-id                             | included      | [work-id-funding-2025](../news/work-id-funding-2025.md)                                                                                                                                     |
| wyden                               | included      | [wyden-series-b](../news/wyden-series-b.md)                                                                                                                                                 |
| xorlab                              | included      | [xorlab-series-a](../news/xorlab-series-a.md)                                                                                                                                               |
| zenline                             | included      | [zenline-pre-seed](../news/zenline-pre-seed.md)                                                                                                                                             |
| zurich-tech                         | existing      | [introducing-zurich-tech](../news/introducing-zurich-tech.md)                                                                                                                               |
| zuriq                               | included      | [zuriq-seed-2025](../news/zuriq-seed-2025.md), [zuriq-seed](../news/zuriq-seed.md)                                                                                                          |

## Held Archive Candidates

These are not in the import JSON.
Each needs the specific evidence below, not another funding announcement.

| Candidate        | Missing evidence or conflict                                                                                                                                                             | Source                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Bloom            | Zurich office and team are documented; no street address found.                                                                                                                          | [Source](https://bloom.diy/careers)                                   |
| Brighty          | Current imprint identifies Polish Wireflexion; older Swiss address at Mühlegasse 18, Baar is not verified as a current operating office.                                                 | [Source](https://brighty.app/)                                        |
| Bubble Robotics  | Company lists Zurich among its locations, but no street address was verified.                                                                                                            | [Source](https://www.bubble-robotics.com/)                            |
| deskbird         | Churerstrasse 54, Pfäffikon SZ is a registered address; local working-office evidence remains insufficient.                                                                              | [Source](https://www.deskbird.com/)                                   |
| ETFbook          | Company publishes Weissenrainstrasse 28, Uetikon am See as its business address; evidence of a staffed technical office remains insufficient.                                            | [Source](https://etfbook.com/contact-thank-you)                       |
| Exclaim Robotics | Register changed to Hardturmstrasse 161 in August 2026; company imprint still says Josefstrasse 178a. Current operating office not reconciled.                                           | [Source](https://www.uid.admin.ch/Detail.aspx?uid_id=CHE-279.576.904) |
| Gelato           | Register moved to Dammstrasse 16, Zug; technical staff at this shared registered address not established.                                                                                | [Source](https://www.gelato.network/)                                 |
| LocalStack       | Company publishes Uetlibergstrasse 95 and describes a remote team with Central European offices, but does not establish this address as one of those offices.                            | [Source](https://www.localstack.cloud/about)                          |
| Motley           | Published Berglistrasse 30, Wetzikon is a founder c/o address; maintained working office not established.                                                                                | [Source](https://motley.ai/legal/terms-of-service/)                   |
| Nevermined       | Industriestrasse 47, Zug appears in legal material; local technical operations not established.                                                                                          | [Source](https://nevermined.io/)                                      |
| nunu.ai          | Zurich team is documented; no verified Zurich street address. Venture Kick identifies Generai AG as nunu.ai's legal entity; its Vorderthal registration does not locate the Zurich team. | [Source](https://nunu.ai/)                                            |
| OneSoil          | Current Churerstrasse 54, Pfäffikon SZ registration does not establish a working office; older Seefeldstrasse address not reused.                                                        | [Source](https://onesoil.ai/)                                         |
| SEITO Biologics  | Official contact is a Küsnacht post-office box; a laboratory at the registered Boglerenstrasse address was not established.                                                              | [Source](https://www.seitobio.ch/disclaimer)                          |
| Validation Cloud | Dammstrasse 16, Zug is published in legal terms; a working local technical office was not established.                                                                                   | [Source](https://www.validationcloud.io/)                             |

### Maps and LinkedIn Follow-up

The follow-up added 15 records, including 12 previously held archive subjects.
A company-published location can corroborate a shared office; sharing an address does not itself prove a domicile service.
Maps results were matched by business name, website and address, not accepted merely because a search returned a pin.
Registered offices and actual workplaces remain distinct.

The following checks narrowed the remaining gaps.

| Candidate        | Evidence checked                                                                                                                                                                          | Remaining gap                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Bloom            | [Company LinkedIn](https://www.linkedin.com/company/bloomlabs-inc) and careers page identify Zurich.                                                                                      | No street address; similarly named marketing agencies are unrelated.              |
| Brighty          | Current imprint names Polish Wireflexion; older Swiss pages name Razz Finanzz.                                                                                                            | Current Swiss operating office not established.                                   |
| Bubble Robotics  | [Company LinkedIn](https://www.linkedin.com/company/bubble-robotics) lists Zurich and local recruitment.                                                                                  | No street address.                                                                |
| deskbird         | [Company LinkedIn](https://www.linkedin.com/company/deskbird) agrees with the registered Pfäffikon address. Maps has a business listing without a street address.                         | No additional evidence distinguishing that address from a mailing location.       |
| ETFbook          | [September 2026 company announcement](https://etfbook.com/company/announcements/funding-round-with-expedition-growth-and-blackfin) names Zurich headquarters and a Cracow technology hub. | Exact local working office remains unconfirmed.                                   |
| Exclaim Robotics | [Current vacancy](https://jobs.ashbyhq.com/exclaim/3df86c99-0bc6-4e19-8fad-e68ae5b046b0) confirms Zurich work; Maps returns unrelated robotics companies.                                 | Hardturmstrasse register move still conflicts with the old imprint.               |
| Gelato           | [Company recruitment](https://ch.linkedin.com/jobs/view/site-reliability-engineer-at-gelato-3804491356) describes a Zug office; Maps did not locate the company.                          | Current office street, rather than its registered address.                        |
| LocalStack       | [Company DPA](https://www.localstack.cloud/legal/dpa) agrees with the register; Maps has no street address.                                                                               | Which of the remote team's Central European offices is at this address.           |
| Motley           | [Company terms](https://motley.ai/legal/terms-of-service/) retain Berglistrasse 30.                                                                                                       | No separate evidence of a maintained working office at the founder's c/o address. |
| Nevermined       | Company legal pages and register establish the Zug entity.                                                                                                                                | Local technical workplace.                                                        |
| nunu.ai          | [Venture Kick](https://www.venturekick.ch/nunuai) establishes the Generai AG identity; [company LinkedIn](https://www.linkedin.com/company/nunu-ai) lists Zurich.                         | Zurich street address, not the Vorderthal registration.                           |
| OneSoil          | Current registration is in Pfäffikon; company posts describe its Polish office.                                                                                                           | Working Swiss office.                                                             |
| SEITO Biologics  | [Company LinkedIn](https://www.linkedin.com/company/seito-biologics-ag) lists Zurich; official contact remains a post-office box.                                                         | Actual laboratory street address.                                                 |
| Validation Cloud | [Current terms](https://www.validationcloud.io/terms) and registry agree on Dammstrasse 16.                                                                                               | Evidence of technical operations at this registered office.                       |

Apple's [current research recruitment](https://jobs.apple.com/fr-ch/details/200666757-4170/senior-data-engineer?team=HRDWR) establishes the Zurich Vision Lab, but Maps returned retail stores rather than the laboratory.
Meta's announced Mythenquai move is scheduled for autumn 2026; [the report](https://www.inside-it.ch/meta-wird-in-zuerich-nachbar-von-aws-und-google-20250717) does not establish that the move has happened.
Neither search supplied a verified current research-office pin.

## Excluded Archive Candidates

These exclusions concern the available local entity or address, not the value of the underlying product.

| Candidate         | Reason                                                                                                                                                                | Source                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| EvlaBio           | Swiss listing is c/o ABT Treuhand at Seestrasse 352; no local working laboratory established.                                                                         | [Source](https://www.evlabio.com/)                                    |
| LEDCity           | Original funded entity is in liquidation. Current brand operator NOMUS explicitly says it is not the legal successor; do not import the historical company as active. | [Source](https://ledcity.ch/agb)                                      |
| Qala              | Swiss registration is c/o Wicki Partners at Stockerstrasse 44; available working-office evidence points to London, not Zurich.                                        | [Source](https://www.moneyhouse.ch/de/company/qala-ag-4685865251)     |
| Schuman Financial | Swiss registration is c/o F Trust AG, Bahnhofplatz, Zug; no separate local working office established.                                                                | [Source](https://www.uid.admin.ch/Detail.aspx?uid_id=CHE-310.888.949) |

The current LEDCity brand should be researched as its new operator if it is to be listed.
Do not attach the historical company's funding or identity to NOMUS automatically.

## Broader Coverage

University coverage includes ETH, UZH and ZHAW, with distinct groups across robotics, vision, language, systems, security, graphics and quantum information.
Research and big-tech records include Google, Microsoft Spatial AI, NVIDIA, IBM Research, Disney Research, Huawei, Sony AI, Oracle and AWS.
Established companies include Scandit, Climeworks, Beekeeper, Sensirion, u-blox, Ergon, Adnovum, Avaloq and Zühlke.
Shared-space coverage includes Technopark Zürich and Winterthur, Impact Hub, Innovation Park Zürich, Bluelion, Trust Square, ZKSD, DARE Campus and the ETH Student Project House.
Communities include CCC Zürich, Hackteria and LUGS; technical nonprofits include Digitale Gesellschaft and SGMK.
These examples describe coverage, not a closed list of eligible organisations.

The following investigated candidates did not produce additional pins.

| Candidate             | Disposition                       | Evidence or next check                                                                                                                                                                               |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple research        | Held                              | Zurich activity is known, but a current working research address was not verified; do not substitute a retail or fiduciary address.                                                                  |
| Meta research         | Held                              | Older Giesshübelstrasse listings and a 2026 office transition need reconciliation before choosing a current research pin.                                                                            |
| Frontify              | Outside scope on current evidence | [Official offices](https://www.frontify.com/en/about-us) list St. Gallen, New York and London; no Zurich site verified.                                                                              |
| EPFL and PSI          | No additional Zurich pin          | No qualifying Zurich site established in this pass; their main campuses are not in the requested area.                                                                                               |
| Swiss AI Initiative   | No separate pin                   | [Joint ETH/EPFL initiative](https://www.swiss-ai.org/); a distinct staffed local office was not established, and ETH AI Center already exists.                                                       |
| ETH DS3Lab            | Held as a historical group        | Its site still describes an ETH group, but [Ce Zhang's current university profile](https://www.computerscience.uchicago.edu/people/ce-zhang/) places him in Chicago; verify continued ETH operation. |
| ETH Entrepreneur Club | Held                              | Rämistrasse 101/Postfach is not sufficient evidence of the club's actual working space.                                                                                                              |

## Included Record Qualifications

These notes are also stored alongside the relevant records.
They distinguish known address transitions, shared locations, renamed products and other review points.

| Record                          | Qualification                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `albatross`                     | Maps the operating office, sixth floor. Registered headquarters: Arbachstrasse 60b, 6340 Baar.                                                                                                                                                                                                                               |
| `apheros`                       | ETH spinout covered in the Zurich news archive; current operating address is in neighbouring Baden.                                                                                                                                                                                                                          |
| `araris`                        | Acquired by Taiho; operating research company retained rather than a separate entry for the acquisition.                                                                                                                                                                                                                     |
| `askearth`                      | Maps the working office at ZKSD, third floor. Postal domicile is c/o Impact Hub, Sihlquai 131.                                                                                                                                                                                                                               |
| `auterion`                      | The company lists its Zurich site on its official LinkedIn page; Zurich engineering vacancies corroborate local activity.                                                                                                                                                                                                    |
| `avaloq`                        | Working headquarters independently corroborated by its on-site staff restaurant: https://www.zfv.ch/de/essen-gehen/avaloq.                                                                                                                                                                                                   |
| `avian`                         | AVIAN is the product brand of Innovire AG; keep one organisation record.                                                                                                                                                                                                                                                     |
| `beekeeper`                     | Part of LumApps. Current developer-published contact address replaces older Hardturmstrasse listings.                                                                                                                                                                                                                        |
| `cellx`                         | The company moved from its ETH address to Schlieren in May 2026.                                                                                                                                                                                                                                                             |
| `climeworks`                    | Uses the current contact-page address; the October 2024 privacy policy still lists Birchstrasse 155.                                                                                                                                                                                                                         |
| `corflow`                       | Outside the canton, included as an archive company in the adjacent Zug hub. Contact page specifies Neuhofstrasse 5a; imprint body still lists 3d.                                                                                                                                                                            |
| `covalo`                        | Official site spells the street Hoeschgasse; the address is normalised to Höschgasse.                                                                                                                                                                                                                                        |
| `daedalean`                     | Acquired by Destinus; retain the operating Daedalean identity rather than create a duplicate parent-company pin.                                                                                                                                                                                                             |
| `dare-campus`                   | Building D at The JED; the address is independently published by resident FORGIS.                                                                                                                                                                                                                                            |
| `deepjudge`                     | Current policy contact address agrees with the September 2025 register move; older body text retains Zeughausstrasse 31.                                                                                                                                                                                                     |
| `digitale-gesellschaft`         | Map location is the staffed Zurich office, not a claim that this is the registered headquarters. Suggested topic: digital-rights.                                                                                                                                                                                            |
| `disney-research`               | May 2026 official delegation itinerary confirms the operating research laboratory address.                                                                                                                                                                                                                                   |
| `duramon`                       | Current contact address supersedes the ETH address still present in the privacy policy.                                                                                                                                                                                                                                      |
| `embotech`                      | Current contact page supersedes older Giessereistrasse 18 materials. Additional technology centre: Wangenstrasse 68, 8600 Dübendorf.                                                                                                                                                                                         |
| `empa`                          | Dübendorf campus. Empa also operates sites in St. Gallen and Thun, not additional Zurich pins.                                                                                                                                                                                                                               |
| `enantios`                      | ETH laboratory-visit instructions identify the operating laboratory.                                                                                                                                                                                                                                                         |
| `ergon`                         | One organisation including its Airlock security product, not a separate Airlock company pin.                                                                                                                                                                                                                                 |
| `eth-cgl`                       | Institutional postcode 8092; geographic postcode 8006.                                                                                                                                                                                                                                                                       |
| `eth-igl`                       | Institutional postcode 8092; geographic postcode 8006.                                                                                                                                                                                                                                                                       |
| `eth-qit`                       | Institutional postcode 8093; geographic postcode 8049. Suggested catalogue topic: quantum.                                                                                                                                                                                                                                   |
| `eth-qudev`                     | Quantum is not in the existing topic catalogue; hardware is used.                                                                                                                                                                                                                                                            |
| `eth-sip`                       | Building STD, floor G. Institutional postcode 8092; geographic postcode 8006.                                                                                                                                                                                                                                                |
| `eth-student-project-house`     | Zentrum makerspace mapped; additional locations at John-von-Neumann-Weg 9, Otto-Stern-Weg 3 and Tannenstrasse 3. Administrative imprint address is not the mapped workshop. Coordinates use the Zentrum building pin linked from the organisation's own directions; swisstopo and Nominatim did not resolve house number 16. |
| `eth-systems`                   | ETH institutional postcode; the building's geographic postcode differs.                                                                                                                                                                                                                                                      |
| `eth-zurich`                    | Main university building, not a substitute address for separately listed laboratories. Institutional postcode differs from geographic postcode 8006.                                                                                                                                                                         |
| `ethon`                         | Formerly branded EthonAI; legal entity remains EthonAI AG.                                                                                                                                                                                                                                                                   |
| `forgis`                        | The company's own research-night invitation explicitly identifies this as its headquarters, not merely an event venue.                                                                                                                                                                                                       |
| `fotokite`                      | Current homepage, contact page and imprint agree on Heinrichstrasse 235; older Josefstrasse listings were not used.                                                                                                                                                                                                          |
| `freename`                      | Company-published Zurich location mapped; legal registration remains at Samstagernstrasse 41, Wollerau.                                                                                                                                                                                                                      |
| `google-zurich`                 | Additional office listed by Google: Europaallee 36, 8004 Zürich. One local organisation record covers both sites.                                                                                                                                                                                                            |
| `gravis-robotics`               | Working office corroborated by the building operator. Gravis privacy page retains an obsolete ETH room label and calls the locality Zürich.                                                                                                                                                                                  |
| `hackteria`                     | Zurich base at Bitwäscherei, third floor; the wider network also operates internationally.                                                                                                                                                                                                                                   |
| `huawei-zurich-research-center` | Research centre mapped; Huawei also lists an office at Zürichstrasse 130, 8600 Dübendorf.                                                                                                                                                                                                                                    |
| `ibm-research-zurich`           | Suggested topic: quantum. Coordinates identify the exact Säumerstrasse 4 building address; the visitor page gives a different point for arrival at the campus.                                                                                                                                                               |
| `immunos`                       | Current contact page gives Wagistrasse 18; imprint and privacy policy still give Wagistrasse 14.                                                                                                                                                                                                                             |
| `impact-hub-zurich`             | Additional locations: Viaduktstrasse 93-95, 8005 Zürich; Selnaustrasse 25, 8001 Zürich. One organisation record, not three duplicates.                                                                                                                                                                                       |
| `ini`                           | Joint institute of UZH and ETH; represented once.                                                                                                                                                                                                                                                                            |
| `libattion`                     | Contact page uses municipal name Opfikon; legal notice uses postal locality Glattbrugg.                                                                                                                                                                                                                                      |
| `lightium`                      | Suggested topic: photonics.                                                                                                                                                                                                                                                                                                  |
| `liom`                          | Outside the canton in the adjacent upper-lake technology cluster. Formerly Spiden; do not create a separate Spiden record.                                                                                                                                                                                                   |
| `lugs`                          | Zurich base at Bitwäscherei, third floor; corroborated by the shared space's operator.                                                                                                                                                                                                                                       |
| `medyria`                       | Company page publishes this Winterthur office pin for Technoparkstrasse 2; its postal address specifies entrance 2c. Swisstopo and Nominatim do not resolve the entrance suffix.                                                                                                                                             |
| `memo-therapeutics`             | Acquired by Ipsen; official site continues to list the Schlieren head office. Not classified as an independent startup.                                                                                                                                                                                                      |
| `microcaps`                     | Manufacturing also at Breitfeldstrasse 19, 3252 Worben, outside this map's core area. Suggested topic: materials-science.                                                                                                                                                                                                    |
| `neura-robotics`                | The company identifies its working Zurich development site on Zollikerstrasse; the commercial register supplies house number 141: https://www.moneyhouse.ch/en/company/neura-robotics-switzerland-ag-3241410831.                                                                                                             |
| `nextesy`                       | Company-published working location mapped; imprint retains Bändliweg 20.                                                                                                                                                                                                                                                     |
| `onchainlabs`                   | Outside the canton, included as an archive company in the adjacent Zug technology hub. The company explicitly invites office visits at its Zug HQ; this is not inferred solely from its registered address.                                                                                                                  |
| `oracle-zurich`                 | Prime Tower office mapped; Oracle also lists The Circle 32, floor 9, 8058 Zürich-Flughafen.                                                                                                                                                                                                                                  |
| `oxyprem`                       | Working office at Startupspace; registered office is at the University Hospital, Frauenklinikstrasse 10.                                                                                                                                                                                                                     |
| `positrigo`                     | Suggested topic: medical-devices.                                                                                                                                                                                                                                                                                            |
| `qcella`                        | Located at ETH's Laboratory for Multifunctional Materials, HCI F 503; institutional postcode differs from the geographic postcode.                                                                                                                                                                                           |
| `rivero`                        | Zurich working office mapped; engineering recruitment corroborates technical activity here. Registered headquarters is in Schaffhausen.                                                                                                                                                                                      |
| `rivr`                          | Formerly Swiss-Mile; both names refer to one organisation.                                                                                                                                                                                                                                                                   |
| `roompricegenie`                | Outside the canton, included as an archive company in the adjacent Zug hub.                                                                                                                                                                                                                                                  |
| `scanvio`                       | Published airport mailing address is 8058 Zürich; the building address is 8302 Kloten.                                                                                                                                                                                                                                       |
| `scyai`                         | Current homepage identifies the Seefeld headquarters; privacy policy retains a c/o address at Bederstrasse 72, which is not mapped.                                                                                                                                                                                          |
| `sgmk`                          | Third floor of Bitwäscherei. Current website is mechatronicart.ch; the former sgmk-ssam.ch domain timed out.                                                                                                                                                                                                                 |
| `skycell`                       | PULS 5 Zurich branch mapped, not the parent company's Zug legal address.                                                                                                                                                                                                                                                     |
| `soverli`                       | Company-published address mapped; older registry c/o at Max-Bill-Platz 5 and ETH lab addresses are not used.                                                                                                                                                                                                                 |
| `swissdrones`                   | Maps the Zurich head office; manufacturing is at Lagerstrasse 30, 9470 Buchs.                                                                                                                                                                                                                                                |
| `taskbase`                      | Current contact and imprint agree; the 2023 privacy-policy body retains Dreikönigstrasse 47. Product has evolved from the adaptive-learning tools covered in the archive.                                                                                                                                                    |
| `testresults`                   | Product of progile AG. Current imprint and privacy-policy controller address agree; a later privacy-policy paragraph still gives Riedwiesenstrasse 23, Dietlikon.                                                                                                                                                            |
| `topadur`                       | Coordinates use the exact OpenStreetMap house-number node 2974876628; swisstopo only returns Grabenstrasse 11.                                                                                                                                                                                                               |
| `unbound-potential`             | Company site and register cover numbers 14/16; company LinkedIn identifies number 14 for this pin.                                                                                                                                                                                                                           |
| `uzh`                           | Main university building; individual laboratories are listed separately where their own addresses are verified.                                                                                                                                                                                                              |
| `zhaw`                          | Main institutional address; ZHAW also operates campuses in Zurich and Wädenswil.                                                                                                                                                                                                                                             |
| `zhaw-ines`                     | Institutional postcode 8401; geographic postcode 8400.                                                                                                                                                                                                                                                                       |
| `zhaw-init`                     | Institutional postcode 8401; geographic postcode 8400.                                                                                                                                                                                                                                                                       |
| `zuehlke`                       | Coordinates use the exact Schlieren office pin linked from the company's own directions. Swisstopo does not resolve building suffix 39j.                                                                                                                                                                                     |
| `zuriq`                         | ETH Physics laboratory HPF E14, not a fiduciary c/o. Company LinkedIn confirms the location; quantum is absent from the current topic catalogue.                                                                                                                                                                             |

| `assaia` | The company's own site uses the airport mailing address Operation Center, 8058 Zurich. Its exhibitor profile and Google Maps identify the physical office as Operation Center 4, Fracht West, 8302 Kloten. The named airport building is used instead of inventing a street number. |
| `bitwaescherei` | Third floor of the former Zentralwäscherei. The bare-domain site is indexed with current activities; the www hostname previously failed certificate validation. Separate from its member organisations. |
| `dfinity` | The foundation's own event invitation identifies this as its staffed headquarters; its current privacy policy and register retain the same address. |
| `lakera` | Google Maps identifies the Zurich office at Hardturmstrasse 3; the company's careers page confirms a Zurich team. This is not the registered Spreitenbach address of the acquired business. |
| `logicstar` | Maps the current company-published Zurich office, not the registered address in Dübendorf. Older indexed LinkedIn copies list Konradstrasse 20; retain this transition for review. |
| `loki` | Google Maps corroborates the September 2026 register move to Lessingstrasse 5. Older Grubenstrasse and Giesshuebelstrasse addresses are not used. |
| `proxima-fusion` | Outside Canton Zurich. Included because the archive covers the company and PSI and Switzerland Innovation confirm a staffed magnet-development office at Park Innovaare. Maps the office, not every PSI laboratory used by the team. |
| `sanos` | Exact building address verified on Google Maps, including the building footprint and street image. Swisstopo did not resolve house number 44. |
| `somagenetix` | The company's manufacturing vacancy explicitly names this Wyss Zurich workplace and Wagistrasse 12, 8952 Schlieren. The pin represents laboratory work, not the registered Altendorf address. UZH's 2026 report also places the gene-therapy project in the Moussonstrasse cleanrooms. |
| `sparkli` | The company's LinkedIn location, July 2026 privacy notice and Google Maps business listing agree on Churerstrasse 158, third floor. This replaces the original founder c/o address at number 44b. Outside the canton in the adjacent upper-lake technology cluster. |
| `sygnum` | Coordinates use the exact Google Maps address point for 134a, checked on the building footprint. The separate Sygnum business listing currently says number 132; the company's current contact page and imprint consistently say 134A, which is retained. |
| `terralayr` | Company-published primary location agrees with the Swiss register. Other working locations are in Berlin and London; the live website is trlyr.com. |
| `threema` | Outside Canton Zurich in the adjacent upper-lake technology cluster. Current engineering recruitment explicitly places the working team in Pfäffikon SZ. |
| `tiun` | The company publishes this Zurich location on LinkedIn. Its imprint says c/o ZWEIG, a cofounder's name, not an identified fiduciary; the cofounder separately confirms building the company from Zurich. |
| `vvardis` | Current company-published headquarters and Swiss UID agree on Zug; the older Baar privacy address is not used. |

## Logos

Official source assets are included for Anapaya, Positrigo, Voliro, KNIME, Tufa Labs, Scandit and Scanvio.
Their asset URLs are in the records' source arrays.
No aggregator assets are used.

The first five have a `logo` field.
Tufa's transparent symbol is also supplied as `mapLogo`.
Scandit and Scanvio were available as white-lettered marks, so only their verified `logoDark` variants are supplied.
They should fall back to initials on light backgrounds rather than rendering invisible white text.
No recoloured “official” light variants were invented.

The PNG is cropped to its transparent bounds and remains 273 pixels tall.
Scanvio's SVG viewBox is cropped to its rendered bounds; its paths and colours are unchanged.
SVG assets were checked for scripts, foreign objects and external resource references and rendered for visual inspection.
Positrigo, Voliro, KNIME and Tufa need appropriate contrast on dark backgrounds where no official dark variant has been verified.

Every record now also has a square icon; see Contents for its sources.

## Validation and Handoff

Validation covers JSON parsing, unique and sorted slugs, required fields, allowed kind/topic values, headline length, coordinate bounds and precision, HTTPS source URLs, existing local logo paths and archive-ledger coverage.
The import script also rejects any record without an icon.

This is a documented research pass, not a claim of an exhaustive census.
New candidates can be added on the same evidence standard without any numerical cap.

## Completeness

On 2026-09-26 candidates were harvested from official lists rather than general searching.
The sources were the ETH, UZH, ZHAW and Empa spin-off lists, TOP 100 Swiss Startups, Venture Kick, Y Combinator, Swiss investor portfolios, startupticker funding rounds, the Technopark and Innovation Park directories, and speakers at zurich.tech events.
Every candidate was rendered and reviewed visually, then checked for an office address on its own imprint or the commercial register, recent activity and an icon.
Addresses that are only c/o a person, law firm or incubator desk were excluded.
A c/o at a hosting site where the team works, such as the Air Force Center in Dübendorf, was accepted and noted.

## Audit

On 2026-09-26 every record was checked again for a working website, recent activity, a current office and technology focus.
The bar is deliberately strict: when in doubt, a record is excluded rather than overselling the ecosystem.
Research labs, major company divisions and hackerspaces qualify; life sciences, generic services and anything unverifiable do not.

Every homepage was also rendered and reviewed visually, and anything without a solid website or logo was excluded.

The following records were removed from `organisations.json`.

| Record                          | Reason                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `scyai`                         | Generic early-access landing page without evidence of a product.                                                             |
| `zenline`                       | Generic AI landing page with little substance.                                                                               |
| `flowit`                        | Pivoted to buzzword positioning; website reads as generic.                                                                   |
| `nextesy`                       | Generic SME administration software; thin evidence of substance.                                                             |
| `unbound-potential`             | Homepage is a placeholder video without real content.                                                                        |
| `work-id`                       | Only a c/o address at a related company.                                                                                     |
| `medyria`                       | Medtech device company on a minimal website.                                                                                 |
| `oxyprem`                       | Neonatal medtech device, not technology focused.                                                                             |
| `enantios`                      | Chemistry instrument maker on a template website.                                                                            |
| `sallea`                        | Small materials company that recently pivoted; no logo.                                                                      |
| `openai-zurich`                 | Real research office, but the only published address is a company-services c/o; excluded until the office address is public. |
| `snap-zurich`                   | Only a c/o address; Zurich no longer appears on its careers site and it has no Zurich jobs.                                  |
| `palantir-zurich`               | Legal entity for IT and marketing services with no evidence of engineering in Zurich.                                        |
| `magic-leap-zurich`             | The Zurich site lead left in August 2026 and there are no open roles; the site appears to be winding down.                   |
| `aisot`                         | Website reads as generated filler rather than a credible product.                                                            |
| `araris`                        | Antibody-drug-conjugate pharma, now a Taiho subsidiary.                                                                      |
| `arcoris-bio`                   | Life-science biomarker reagents.                                                                                             |
| `cellvie`                       | Mitochondria therapeutics biotech.                                                                                           |
| `cellx`                         | Microbial PFAS remediation biotech.                                                                                          |
| `corflow`                       | Clinical cardiology device company in Baar.                                                                                  |
| `cutiss`                        | Clinical tissue-engineering biotech.                                                                                         |
| `glycoera`                      | Drug developer.                                                                                                              |
| `immunos`                       | Immunotherapy biotech.                                                                                                       |
| `limmatech`                     | Vaccine biotech, being acquired by Eli Lilly.                                                                                |
| `mabylon`                       | Antibody drug developer.                                                                                                     |
| `memo-therapeutics`             | Antibody biotech, acquired by Ipsen in July 2026.                                                                            |
| `numab`                         | Antibody drug developer.                                                                                                     |
| `oncobit`                       | Wet-lab molecular diagnostics.                                                                                               |
| `somagenetix`                   | Gene-therapy biotech.                                                                                                        |
| `topadur`                       | Clinical-stage pharma.                                                                                                       |
| `virometix`                     | Vaccine biotech.                                                                                                             |
| `odne`                          | Dental device company.                                                                                                       |
| `vvardis`                       | Dental materials company in Zug.                                                                                             |
| `food-brewer`                   | Food company growing cocoa and coffee from plant cells.                                                                      |
| `microcaps`                     | Fragrance encapsulation producer.                                                                                            |
| `boost`                         | Vending operator.                                                                                                            |
| `candi-solar`                   | Solar project finance in India and South Africa.                                                                             |
| `enshift`                       | Energy installer in Baar without a Zurich office.                                                                            |
| `grensol`                       | Chemical recycling process moving to Biberist, stale website.                                                                |
| `circleg`                       | Prosthetics maker with little technology substance.                                                                          |
| `zksd`                          | University sustainability office, not a technology organisation.                                                             |
| `hemotune`                      | Blood purification medtech.                                                                                                  |
| `bitwaescherei`                 | Website serves an invalid TLS certificate; the building is covered by its member organisations.                              |
| `freename`                      | Non-ICANN web3 domain registrar with public complaints about misleading marketing.                                           |
| `onchainlabs`                   | Small crypto studio in Zug with little independent evidence of substance.                                                    |
| `sanos`                         | Thin website without verifiable team, customers or recent activity.                                                          |
| `dfinity`                       | Crypto token project with a controversial history; excluded when in doubt.                                                   |
| `relai`                         | Retail Bitcoin app; excluded when in doubt.                                                                                  |
| `huawei-zurich-research-center` | Reputationally sensitive; excluded when in doubt.                                                                            |
| `daedalean`                     | Acquired by Destinus, a defence company; its own website now redirects there.                                                |
| `proxima-fusion`                | Munich company with a satellite office outside the canton.                                                                   |
| `logicstar`                     | Office address unverified; the register seat is in Dübendorf.                                                                |
| `qcella`                        | Office address unverified.                                                                                                   |
| `lakera`                        | Acquired by Check Point; office address unverified.                                                                          |
| `tiun`                          | Only a c/o address found, possibly private.                                                                                  |
| `beekeeper`                     | Acquired by LumApps; office address unverified.                                                                              |
