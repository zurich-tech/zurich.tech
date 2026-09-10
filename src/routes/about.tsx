import { For } from "solid-js";
import { Card } from "../component/card";
import { Page } from "../component/page";
import { Seo } from "../component/seo";
import { Image } from "../component/image";
import { SocialLinks, type SocialProfiles } from "../component/social";

/** Team member with a portrait and verified public profiles. */
type TeamMember = {
    /** Public name. */ name: string;
    /** Community responsibility. */ role: string;
    /** Default portrait. */ image: string;
    /** Optional portrait for dark backgrounds. */ imageDark?: string;
    /** Verified accounts and personal website. */ links: SocialProfiles;
};

/** The current team and emeritus organisers. */
const team: TeamMember[] = [
    {
        name: "Florian Cäsar",
        role: "President",
        image: "/team/florian-caesar.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/floriancaesar/",
            github: "https://github.com/flotothemoon",
            x: "https://twitter.com/FlorianCaesar",
        },
    },
    {
        name: "Clara Meister",
        role: "Co-president",
        image: "/team/clara-meister.jpeg",
        links: {
            linkedin: "https://www.linkedin.com/in/clara-meister/",
            github: "https://github.com/cimeister",
            x: "https://x.com/clara__meister",
            website: "https://cimeister.github.io/",
        },
    },
    {
        name: "Alessio Rimoldi",
        role: "Treasurer",
        image: "/team/alessio-rimoldi.jpeg",
        links: {
            linkedin: "https://www.linkedin.com/in/alessio-rimoldi-340787212/",
            github: "https://github.com/AlessioRimoldi",
            x: "https://twitter.com/alessio_rimoldi",
            website: "https://alessiorimoldi.github.io/",
        },
    },
    {
        name: "Arnout Devos",
        role: "Auditor / Advisor",
        image: "/team/arnout-devos.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/arnoutdevos/",
            github: "https://github.com/ArnoutDevos",
            x: "https://twitter.com/ArnoutDevos",
            website: "https://arnoutdevos.github.io/",
        },
    },
    {
        name: "Ayça Takmaz",
        role: "Team",
        image: "/team/ayca-takmaz.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/aycatakmaz/",
            github: "https://github.com/aycatakmaz",
            x: "https://twitter.com/aycatakmaz",
            website: "https://aycatakmaz.github.io/",
        },
    },
    {
        name: "Dominique Paul",
        role: "Team",
        image: "/team/dominique-paul.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/dominique-paul",
            github: "https://github.com/DominiquePaul",
            website: "https://www.thisiscrispin.com/",
            x: "https://x.com/DominiqueCAPaul",
        },
    },
    {
        name: "Matteo Saponati",
        role: "Team",
        image: "/team/matteo-saponati.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/matteosaponati/",
            github: "https://github.com/matteosaponati",
            website: "https://matteosaponati.github.io/",
            x: "https://twitter.com/matteosaponati",
        },
    },
    {
        name: "Nando Metzger",
        role: "Team",
        image: "/team/nando-metzger.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/nando-metzger-68aa0518b/",
            github: "https://github.com/nandometzger",
            website: "https://nandometzger.github.io/",
        },
    },
    {
        name: "Alexander Henkes",
        role: "Team",
        image: "/team/alexander-henkes.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/dr-alexander-henkes",
            github: "https://github.com/ahenkes1",
            website: "https://www.dr-alexander-henkes.com/",
        },
    },
    {
        name: "Nathan Ordonez",
        role: "Team",
        image: "/team/nathan-ordonez.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/nathan-axcan-ordonez/",
            github: "https://github.com/nataxcan",
            website: "https://nataxcan.github.io/",
        },
    },
    {
        name: "Aleksander Ficek",
        role: "Emeritus",
        image: "/team/aleksander-ficek.jpg",
        links: {
            linkedin: "https://www.linkedin.com/in/aleksanderficek",
            github: "https://github.com/aleksficek",
            x: "https://x.com/AlekFicek",
        },
    },
];

/** Introduce the people behind zurich.tech. */
export default function Route() {
    return (
        <>
            <Seo
                title="About"
                description="A registered nonprofit bringing people together around tech in and around Zürich."
            />
            <Page>
                <Card title="About" heading="h1" class="team">
                    <p class="team-intro">
                        zurich.tech is a registered nonprofit organising talks, events, dinners,
                        hackathons and other fun and interesting things around tech in and around
                        Zürich.
                    </p>
                    <ul class="team-grid">
                        <For each={team}>
                            {(member) => (
                                <li class="team-person">
                                    <Image
                                        class="team-portrait"
                                        src={member.image}
                                        darkSrc={member.imageDark}
                                        alt={member.name}
                                        width={320}
                                        height={320}
                                        loading="lazy"
                                    />
                                    <h2>{member.name}</h2>
                                    <p class="team-role">{member.role}</p>
                                    <SocialLinks name={member.name} profiles={member.links} />
                                </li>
                            )}
                        </For>
                    </ul>
                </Card>
            </Page>
        </>
    );
}
