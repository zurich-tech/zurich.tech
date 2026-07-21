const lastEventNumber = {
    zurichcv: 14,
    zurichnlp: 21,
    zurichrobotics: 4,
} as const;

const schmidhuberSlug = "jurgen-schmidhuber";

/** A Zurich AI event series. */
export type ArchiveSeries = {
    /** The series description. */
    description: string;
    /** The route slug. */
    slug: "zurichcv" | "zurichnlp" | "zurichrobotics";
    /** The series tags. */
    tags: string[];
    /** The public title. */
    title: string;
};

/** A Zurich AI event speaker. */
export type ArchiveSpeaker = {
    /** The speaker name. */
    name: string;
    /** The speaker affiliation or role. */
    title?: string;
};

/** A Zurich AI event. */
export type ArchiveEvent = {
    /** The public event summary. */
    description: string;
    /** The ISO end time. */
    endsAt: string;
    /** The event number within its series. */
    number?: number;
    /** The route slug. */
    slug: string;
    /** The parent series slug. */
    series?: ArchiveSeries["slug"];
    /** The legacy event identifier. */
    sourceId: string;
    /** The legacy site that published the event. */
    source: "zurich-nlp.ch" | "zurichai.ch";
    /** The published speakers. */
    speakers: ArchiveSpeaker[];
    /** The ISO start time. */
    startsAt: string;
    /** The event tags. */
    tags: string[];
    /** The public title. */
    title: string;
    /** The source page. */
    sourceUrl: string;
    /** The event venue. */
    venue: "eth-ai-center-14" | "eth-ai-center-19" | "eth-zurich-bin13";
};

/** The Zurich AI series represented in the public archive. */
export const archiveSeries: ArchiveSeries[] = [
    {
        description: "Computer vision research and engineering.",
        slug: "zurichcv",
        tags: ["computer-vision", "machine-learning"],
        title: "ZurichCV",
    },
    {
        description: "Natural language processing research and engineering.",
        slug: "zurichnlp",
        tags: ["nlp", "language-models", "machine-learning"],
        title: "ZurichNLP",
    },
    {
        description: "Robotics research and engineering.",
        slug: "zurichrobotics",
        tags: ["robotics", "machine-learning"],
        title: "ZurichRobotics",
    },
];

/** The numbered Zurich AI events and the Schmidhuber special. */
export const archiveEvents: ArchiveEvent[] = [
    {
        description: "Luca Beurer-Kellner from ETH Zurich and Basil Mustafa from Google Brain.",
        endsAt: "2023-03-21T20:00:00+01:00",
        number: 1,
        series: "zurichnlp",
        slug: "zurichnlp-1",
        source: "zurich-nlp.ch",
        sourceId: "690",
        speakers: [
            { name: "Luca Beurer-Kellner", title: "ETH Zurich" },
            { name: "Basil Mustafa", title: "Google Brain" },
        ],
        startsAt: "2023-03-21T18:00:00+01:00",
        tags: ["nlp", "machine-learning"],
        title: "ZurichNLP #1",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-1/",
        venue: "eth-zurich-bin13",
    },
    {
        description: "Julian Eisenschlos from Google and Alex Warstadt from ETH Zurich.",
        endsAt: "2023-05-10T20:00:00+02:00",
        number: 2,
        series: "zurichnlp",
        slug: "zurichnlp-2",
        source: "zurich-nlp.ch",
        sourceId: "548",
        speakers: [
            { name: "Julian Eisenschlos", title: "Google" },
            { name: "Alex Warstadt", title: "ETH Zurich" },
        ],
        startsAt: "2023-05-10T18:00:00+02:00",
        tags: ["nlp", "machine-learning"],
        title: "ZurichNLP #2",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-2/",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Tim Scarfe and Zeerak Talat on the democratization, policy, and ethics of AI.",
        endsAt: "2023-06-27T20:00:00+02:00",
        number: 3,
        series: "zurichnlp",
        slug: "zurichnlp-3",
        source: "zurich-nlp.ch",
        sourceId: "873",
        speakers: [
            { name: "Tim Scarfe", title: "Machine Learning Street Talk" },
            { name: "Zeerak Talat" },
        ],
        startsAt: "2023-06-27T18:00:00+02:00",
        tags: ["nlp", "ai-policy", "ai-ethics"],
        title: "ZurichNLP #3",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-3/",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Katya Mirylenka from IBM Research and Elliott Ash from ETH Zurich on text classification and legal summarization.",
        endsAt: "2023-09-26T20:00:00+02:00",
        number: 4,
        series: "zurichnlp",
        slug: "zurichnlp-4",
        source: "zurich-nlp.ch",
        sourceId: "980",
        speakers: [
            { name: "Katya Mirylenka", title: "IBM Research" },
            { name: "Elliott Ash", title: "ETH Zurich" },
        ],
        startsAt: "2023-09-26T18:00:00+02:00",
        tags: ["nlp", "active-learning", "legal-ai"],
        title: "ZurichNLP #4",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-4/",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Jonas Pfeiffer from Google DeepMind on modular deep learning and Eiso Kant from Poolside on learning from code.",
        endsAt: "2023-10-19T20:00:00+02:00",
        number: 5,
        series: "zurichnlp",
        slug: "zurichnlp-5",
        source: "zurich-nlp.ch",
        sourceId: "1099",
        speakers: [
            { name: "Jonas Pfeiffer", title: "Google DeepMind" },
            { name: "Eiso Kant", title: "Co-founder and CTO, Poolside" },
        ],
        startsAt: "2023-10-19T18:00:00+02:00",
        tags: ["nlp", "modular-deep-learning", "programming"],
        title: "ZurichNLP #5",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-5/",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Lucas Beyer from Google DeepMind and Ana Kotarcic from the University of Zurich.",
        endsAt: "2023-12-07T19:00:00+01:00",
        number: 6,
        series: "zurichnlp",
        slug: "zurichnlp-6",
        source: "zurich-nlp.ch",
        sourceId: "1239",
        speakers: [
            { name: "Lucas Beyer", title: "Google DeepMind" },
            { name: "Ana Kotarcic", title: "University of Zurich" },
        ],
        startsAt: "2023-12-07T17:00:00+01:00",
        tags: ["nlp", "machine-learning"],
        title: "ZurichNLP #6",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-6/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Martina Forster and Luca Campanella from Typewise on building an NLP startup, and Tiago Pimentel from ETH Zurich on word lengths.",
        endsAt: "2024-01-16T20:00:00+01:00",
        number: 7,
        series: "zurichnlp",
        slug: "zurichnlp-7",
        source: "zurich-nlp.ch",
        sourceId: "1354",
        speakers: [
            { name: "Martina Forster", title: "Typewise" },
            { name: "Luca Campanella", title: "Typewise" },
            { name: "Tiago Pimentel", title: "ETH Zurich" },
        ],
        startsAt: "2024-01-16T18:00:00+01:00",
        tags: ["nlp", "startups", "linguistics"],
        title: "ZurichNLP #7",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-7/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Brian DuSell from ETH Zurich on stack attention and Leandro von Werra from Hugging Face on BigCode.",
        endsAt: "2024-02-27T20:00:00+01:00",
        number: 8,
        series: "zurichnlp",
        slug: "zurichnlp-8",
        source: "zurich-nlp.ch",
        sourceId: "1447",
        speakers: [
            { name: "Brian DuSell", title: "ETH Zurich" },
            { name: "Leandro von Werra", title: "Hugging Face" },
        ],
        startsAt: "2024-02-27T18:00:00+01:00",
        tags: ["nlp", "transformers", "programming"],
        title: "ZurichNLP #8",
        sourceUrl: "https://zurich-nlp.ch/event/zurichnlp-meetup-8/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Felix Bauer from SynSense and Songyou Peng from ETH Zurich launch the ZurichCV series.",
        endsAt: "2024-03-14T20:00:00+01:00",
        number: 1,
        series: "zurichcv",
        slug: "zurichcv-1",
        source: "zurich-nlp.ch",
        sourceId: "1587",
        speakers: [
            { name: "Felix Bauer", title: "Senior R&D Engineer, SynSense" },
            { name: "Songyou Peng", title: "ETH Zurich" },
        ],
        startsAt: "2024-03-14T18:00:00+01:00",
        tags: ["computer-vision", "machine-learning"],
        title: "ZurichCV #1",
        sourceUrl: "https://zurich-nlp.ch/event/zurichcv-meetup-1/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Lucas Beyer from Google DeepMind on structured computer vision in the age of language models.",
        endsAt: "2024-04-16T20:00:00+02:00",
        number: 2,
        series: "zurichcv",
        slug: "zurichcv-2",
        source: "zurich-nlp.ch",
        sourceId: "1703",
        speakers: [{ name: "Lucas Beyer", title: "Google DeepMind" }],
        startsAt: "2024-04-16T17:00:00+02:00",
        tags: ["computer-vision", "language-models"],
        title: "ZurichCV #2",
        sourceUrl: "https://zurich-nlp.ch/event/zurichcv-meetup-2/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Lewis Tunstall from Hugging Face on LLM alignment and Vilém Zouhar from ETH Zurich on tokenization.",
        endsAt: "2024-04-25T20:00:00+02:00",
        number: 9,
        series: "zurichnlp",
        slug: "zurichnlp-9",
        source: "zurich-nlp.ch",
        sourceId: "1769",
        speakers: [
            { name: "Lewis Tunstall", title: "Hugging Face" },
            { name: "Vilém Zouhar", title: "ETH Zurich" },
        ],
        startsAt: "2024-04-25T18:00:00+02:00",
        tags: ["nlp", "language-models", "tokenization"],
        title: "ZurichNLP #9",
        sourceUrl: "https://zurich-nlp.ch/event/zurichnlp-meetup-9/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Kacper Lukawski from Qdrant on optimizing RAG and Tannon Kew from the University of Zurich on multilingual language models.",
        endsAt: "2024-05-28T20:00:00+02:00",
        number: 10,
        series: "zurichnlp",
        slug: "zurichnlp-10",
        source: "zurich-nlp.ch",
        sourceId: "1930",
        speakers: [
            { name: "Kacper Lukawski", title: "Qdrant" },
            { name: "Tannon Kew", title: "University of Zurich" },
        ],
        startsAt: "2024-05-28T18:00:00+02:00",
        tags: ["nlp", "rag", "multilingual-models"],
        title: "ZurichNLP #10",
        sourceUrl: "https://zurich-nlp.ch/event/zurichnlp-meetup-10/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Julian Schilliger from ETH Zurich on reading ancient papyrus and Nicolas Muntwyler from nunu.ai on visual game agents.",
        endsAt: "2024-06-13T20:00:00+02:00",
        number: 3,
        series: "zurichcv",
        slug: "zurichcv-3",
        source: "zurich-nlp.ch",
        sourceId: "2147",
        speakers: [
            { name: "Julian Schilliger", title: "ETH Zurich" },
            { name: "Nicolas Muntwyler", title: "nunu.ai" },
        ],
        startsAt: "2024-06-13T18:00:00+02:00",
        tags: ["computer-vision", "3d", "game-agents"],
        title: "ZurichCV #3",
        sourceUrl: "https://zurich-nlp.ch/event/zurichcv-meetup-3/",
        venue: "eth-ai-center-14",
    },
    {
        description: "Scaling LoRA serving for AWS and defending against hoodwinked agents.",
        endsAt: "2024-07-09T20:00:00+02:00",
        number: 11,
        series: "zurichnlp",
        slug: "zurichnlp-11",
        source: "zurichai.ch",
        sourceId: "cdb3efee-77a8-45f1-b014-46e601bc4789",
        speakers: [
            { name: "Arlind Nocaj", title: "Solutions Architect, AWS" },
            { name: "Edoardo Debenedetti", title: "ETH Zurich" },
        ],
        startsAt: "2024-07-09T18:00:00+02:00",
        tags: ["nlp", "language-models"],
        title: "ZurichNLP #11",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-11",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Image tokenizers in the age of VLMs and photorealistic reconstruction of 3D scenes.",
        endsAt: "2024-07-16T20:00:00+02:00",
        number: 4,
        series: "zurichcv",
        slug: "zurichcv-4",
        source: "zurichai.ch",
        sourceId: "4bed1af6-850e-4d3d-94e7-bf3e4f4627da",
        speakers: [
            { name: "Michael Tschannen", title: "Google DeepMind" },
            { name: "Tobias Fischer", title: "ETH Zurich" },
        ],
        startsAt: "2024-07-16T18:00:00+02:00",
        tags: ["computer-vision", "3d"],
        title: "ZurichCV #4",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-4",
        venue: "eth-ai-center-14",
    },
    {
        description: "Yannic Kilcher on OpenAssistant and Afra Amini on aligning LLM algorithms.",
        endsAt: "2024-09-10T20:00:00+02:00",
        number: 12,
        series: "zurichnlp",
        slug: "zurichnlp-12",
        source: "zurichai.ch",
        sourceId: "6b6fe7fa-37e4-4da9-964f-c919cb3b8c3e",
        speakers: [
            { name: "Yannic Kilcher", title: "DeepJudge" },
            { name: "Afra Amini", title: "ETH Zurich" },
        ],
        startsAt: "2024-09-10T18:00:00+02:00",
        tags: ["nlp", "language-models"],
        title: "ZurichNLP #12",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-12",
        venue: "eth-ai-center-14",
    },
    {
        description: "Julian Eisenschlos from Google DeepMind and Anton Obukhov from ETH Zurich.",
        endsAt: "2024-09-17T20:00:00+02:00",
        number: 5,
        series: "zurichcv",
        slug: "zurichcv-5",
        source: "zurichai.ch",
        sourceId: "fe2a861f-0763-4ed6-bc07-4b80d08aadb6",
        speakers: [
            { name: "Julian Eisenschlos", title: "Google DeepMind" },
            { name: "Anton Obukhov", title: "ETH Zurich" },
        ],
        startsAt: "2024-09-17T18:00:00+02:00",
        tags: ["computer-vision", "machine-learning"],
        title: "ZurichCV #5",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-5",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Betsa Maciej and Riccardo Maggioni from ETH Zurich on graph of thoughts and accelerating industrial programming with AI.",
        endsAt: "2024-10-22T20:00:00+02:00",
        number: 13,
        series: "zurichnlp",
        slug: "zurichnlp-13",
        source: "zurichai.ch",
        sourceId: "22fc85f9-32c2-4f32-a028-570126bb2dea",
        speakers: [
            { name: "Betsa Maciej", title: "ETH Zurich" },
            { name: "Riccardo Maggioni", title: "ETH Zurich" },
        ],
        startsAt: "2024-10-22T18:00:00+02:00",
        tags: ["nlp", "programming"],
        title: "ZurichNLP #13",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-13",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Barath Daniel Béla from ETH Zurich on GLOMAP and Peter Karkus from NVIDIA Research on autonomous driving in the age of LLMs.",
        endsAt: "2024-11-19T20:00:00+01:00",
        number: 6,
        series: "zurichcv",
        slug: "zurichcv-6",
        source: "zurichai.ch",
        sourceId: "6a6276cb-e66c-4044-9e27-8d349206ef80",
        speakers: [
            { name: "Barath Daniel Béla", title: "ETH Zurich" },
            { name: "Peter Karkus", title: "NVIDIA Research" },
        ],
        startsAt: "2024-11-19T18:00:00+01:00",
        tags: ["computer-vision", "autonomous-driving"],
        title: "ZurichCV #6",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-6",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Jonas Hübotter and Imanol Schlag from ETH Zurich on learning at test time and Swiss sovereign AI.",
        endsAt: "2024-12-03T20:00:00+01:00",
        number: 14,
        series: "zurichnlp",
        slug: "zurichnlp-14",
        source: "zurichai.ch",
        sourceId: "420c3dd1-b6ce-493f-8580-d87a3e12042d",
        speakers: [
            { name: "Jonas Hübotter", title: "ETH Zurich" },
            { name: "Imanol Schlag", title: "ETH Zurich" },
        ],
        startsAt: "2024-12-03T18:00:00+01:00",
        tags: ["nlp", "language-models"],
        title: "ZurichNLP #14",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-14",
        venue: "eth-ai-center-14",
    },
    {
        description: "Ayca Takmaz on open-vocabulary 3D scene understanding.",
        endsAt: "2025-01-23T20:00:00+01:00",
        number: 7,
        series: "zurichcv",
        slug: "zurichcv-7",
        source: "zurichai.ch",
        sourceId: "2ea8a8b7-04bb-471c-a81e-30e4e2495add",
        speakers: [{ name: "Ayca Takmaz", title: "ETH Zurich" }],
        startsAt: "2025-01-23T18:00:00+01:00",
        tags: ["computer-vision", "3d"],
        title: "ZurichCV #7",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-7",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Matej Jusup from the ETH AI Center on mastering board games and Bobby He from the University of Oxford on understanding outlier features.",
        endsAt: "2025-02-20T20:00:00+01:00",
        number: 15,
        series: "zurichnlp",
        slug: "zurichnlp-15",
        source: "zurichai.ch",
        sourceId: "3e1c325e-5e4b-4449-86f1-9d7c482b79e8",
        speakers: [
            { name: "Matej Jusup", title: "ETH AI Center" },
            { name: "Bobby He", title: "University of Oxford" },
        ],
        startsAt: "2025-02-20T18:00:00+01:00",
        tags: ["nlp", "language-models"],
        title: "ZurichNLP #15",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-15",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Xi Wang on egocentric learning and Nikolai Kalischek on diffusion-based panorama generation.",
        endsAt: "2025-02-24T20:00:00+01:00",
        number: 8,
        series: "zurichcv",
        slug: "zurichcv-8",
        source: "zurichai.ch",
        sourceId: "7920ccda-9721-4044-8b0d-d2f1069933a1",
        speakers: [{ name: "Xi Wang" }, { name: "Nikolai Kalischek", title: "ETH Zurich" }],
        startsAt: "2025-02-24T18:00:00+01:00",
        tags: ["computer-vision", "diffusion"],
        title: "ZurichCV #8",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-8",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Linus Scheibenreif from ETH Zurich on self-supervised learning for satellite imagery and Pascal Chang from ETH Zurich and Disney Research on visual anagram generation.",
        endsAt: "2025-04-29T20:00:00+02:00",
        number: 9,
        series: "zurichcv",
        slug: "zurichcv-9",
        source: "zurichai.ch",
        sourceId: "68554d44-73aa-487f-8304-e7c9539e90e7",
        speakers: [
            { name: "Linus Scheibenreif", title: "ETH Zurich" },
            { name: "Pascal Chang", title: "ETH Zurich and Disney Research" },
        ],
        startsAt: "2025-04-29T18:00:00+02:00",
        tags: ["computer-vision", "diffusion", "satellite-imagery"],
        title: "ZurichCV #9",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-9",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Ivan Vulić from the University of Cambridge and Google DeepMind on vision-language models for spatial reasoning and Tiago Pimentel from ETH Zurich on generalisation in language models.",
        endsAt: "2025-05-21T20:00:00+02:00",
        number: 16,
        series: "zurichnlp",
        slug: "zurichnlp-16",
        source: "zurichai.ch",
        sourceId: "457947ac-7f4d-42c8-a942-29433e7f98ff",
        speakers: [
            { name: "Ivan Vulić", title: "University of Cambridge and Google DeepMind" },
            { name: "Tiago Pimentel", title: "ETH Zurich" },
        ],
        startsAt: "2025-05-21T18:00:00+02:00",
        tags: ["nlp", "vision-language-models"],
        title: "ZurichNLP #16",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-16",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Aleksander Ficek from NVIDIA on synthetic generators and verifiers for coding and Matteo Saponati from ETH Zurich on the structures of self-attention.",
        endsAt: "2025-06-17T20:00:00+02:00",
        number: 17,
        series: "zurichnlp",
        slug: "zurichnlp-17",
        source: "zurichai.ch",
        sourceId: "65434f32-b4a7-4361-98e5-d9e075d303d4",
        speakers: [
            { name: "Aleksander Ficek", title: "NVIDIA" },
            { name: "Matteo Saponati", title: "ETH Zurich" },
        ],
        startsAt: "2025-06-17T18:00:00+02:00",
        tags: ["nlp", "programming", "transformers"],
        title: "ZurichNLP #17",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-17",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Felix Wimbauer from the Technical University of Munich and Google on understanding the 3D world from videos, and Joan Puigcerver from Google DeepMind on scaling computer vision architectures.",
        endsAt: "2025-08-07T20:00:00+02:00",
        number: 10,
        series: "zurichcv",
        slug: "zurichcv-10",
        source: "zurichai.ch",
        sourceId: "5d2e1200-cee4-4827-80ea-35de2f1f2d29",
        speakers: [
            { name: "Felix Wimbauer", title: "Technical University of Munich and Google" },
            { name: "Joan Puigcerver", title: "Google DeepMind" },
        ],
        startsAt: "2025-08-07T18:00:00+02:00",
        tags: ["computer-vision", "3d"],
        title: "ZurichCV #10",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-10",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Barnabas Gavin Cangan from ETH Zurich on robot hands and Caterina Caccavella from ZHAW and ETH Zurich on bio-inspired active sensing.",
        endsAt: "2025-09-24T20:00:00+02:00",
        number: 1,
        series: "zurichrobotics",
        slug: "zurichrobotics-1",
        source: "zurichai.ch",
        sourceId: "9e796faf-f3dd-4778-b704-dda22c2ee620",
        speakers: [
            { name: "Barnabas Gavin Cangan", title: "ETH Zurich" },
            { name: "Caterina Caccavella", title: "ZHAW and ETH Zurich" },
        ],
        startsAt: "2025-09-24T18:00:00+02:00",
        tags: ["robotics", "manipulation", "sensing"],
        title: "ZurichRobotics #1",
        sourceUrl: "https://www.zurichai.ch/events/zurichrobotics-1",
        venue: "eth-ai-center-14",
    },
    {
        description: "Jürgen Schmidhuber on the past, present, and future of AI.",
        endsAt: "2025-10-21T20:00:00+02:00",
        slug: "jurgen-schmidhuber",
        source: "zurichai.ch",
        sourceId: "d039e74f-db8e-4049-8526-922c1c29f72e",
        speakers: [{ name: "Jürgen Schmidhuber" }],
        startsAt: "2025-10-21T18:00:00+02:00",
        tags: ["artificial-intelligence", "machine-learning"],
        title: "ZurichAI: Jürgen Schmidhuber",
        sourceUrl: "https://www.zurichai.ch/events/zurichai-jurgen-schmidhuber",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Paul-Edouard Sarlin from Google on 3D reconstruction for localization and Nando Metzger from ETH Zurich on high-resolution maps.",
        endsAt: "2025-11-20T20:00:00+01:00",
        number: 11,
        series: "zurichcv",
        slug: "zurichcv-11",
        source: "zurichai.ch",
        sourceId: "06650402-8262-45eb-af60-56bcdc2ee501",
        speakers: [
            { name: "Paul-Edouard Sarlin", title: "Google" },
            { name: "Nando Metzger", title: "ETH Zurich" },
        ],
        startsAt: "2025-11-20T18:00:00+01:00",
        tags: ["computer-vision", "3d", "mapping"],
        title: "ZurichCV #11",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-11",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Philippe Bich from Huawei on calibration-free low-precision LLMs and Alejandro Hernandez Cano from EPFL on Apertus, the Swiss open LLM.",
        endsAt: "2025-11-24T20:00:00+01:00",
        number: 18,
        series: "zurichnlp",
        slug: "zurichnlp-18",
        source: "zurichai.ch",
        sourceId: "8a604720-393d-43cc-a328-90f7b998e5b5",
        speakers: [
            { name: "Philippe Bich", title: "Huawei" },
            { name: "Alejandro Hernandez Cano", title: "EPFL" },
        ],
        startsAt: "2025-11-24T18:00:00+01:00",
        tags: ["nlp", "language-models", "apertus"],
        title: "ZurichNLP #18",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-18",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Antonio Arbues from Loki Robotics on building useful robots in the age of AI and Giacomo Manzoni from Hexagon on imitation learning for dexterous manipulation.",
        endsAt: "2025-12-15T20:00:00+01:00",
        number: 2,
        series: "zurichrobotics",
        slug: "zurichrobotics-2",
        source: "zurichai.ch",
        sourceId: "48564eb0-e3ca-43c0-a67e-f7233e94e693",
        speakers: [
            { name: "Antonio Arbues", title: "Loki Robotics" },
            { name: "Giacomo Manzoni", title: "Hexagon" },
        ],
        startsAt: "2025-12-15T18:00:00+01:00",
        tags: ["robotics", "imitation-learning", "manipulation"],
        title: "ZurichRobotics #2",
        sourceUrl: "https://www.zurichai.ch/events/zurichrobotics-2",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Sina Ahmadi from the University of Zurich on low-resource language varieties and Barna Pasztor from ETH Zurich on sample-efficient dataset collection for RLHF.",
        endsAt: "2026-01-19T20:00:00+01:00",
        number: 19,
        series: "zurichnlp",
        slug: "zurichnlp-19",
        source: "zurichai.ch",
        sourceId: "b9b5bdf4-8211-4aca-89e4-cfd6797f5f55",
        speakers: [
            { name: "Sina Ahmadi", title: "University of Zurich" },
            { name: "Barna Pasztor", title: "ETH Zurich" },
        ],
        startsAt: "2026-01-19T18:00:00+01:00",
        tags: ["nlp", "rlhf", "low-resource-languages"],
        title: "ZurichNLP #19",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-19",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Zan Gojcic from NVIDIA on generative reconstruction and Vanessa Sklyarova from ETH Zurich on hairstyle modelling for avatars.",
        endsAt: "2026-01-20T20:00:00+01:00",
        number: 12,
        series: "zurichcv",
        slug: "zurichcv-12",
        source: "zurichai.ch",
        sourceId: "0c903e7a-f568-4b3a-bbfe-40efe5b26d49",
        speakers: [
            { name: "Zan Gojcic", title: "NVIDIA" },
            { name: "Vanessa Sklyarova", title: "ETH Zurich" },
        ],
        startsAt: "2026-01-20T18:00:00+01:00",
        tags: ["computer-vision", "3d", "avatars"],
        title: "ZurichCV #12",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-12",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Michael Neunert from Google DeepMind on efficient models for bringing AI into the real world and Riccardo Maggioni from FORGIS on the intelligence layer for the factory floor.",
        endsAt: "2026-03-19T20:00:00+01:00",
        number: 3,
        series: "zurichrobotics",
        slug: "zurichrobotics-3",
        source: "zurichai.ch",
        sourceId: "a2294a49-01e7-4cde-80c1-c7a0c61c87b0",
        speakers: [
            { name: "Michael Neunert", title: "Google DeepMind" },
            { name: "Riccardo Maggioni", title: "FORGIS" },
        ],
        startsAt: "2026-03-19T18:00:00+01:00",
        tags: ["robotics", "efficient-models", "industrial-automation"],
        title: "ZurichRobotics #3",
        sourceUrl: "https://www.zurichai.ch/events/zurichrobotics-3",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Fabian Schaipp from Inria on training algorithms for machine learning and Valentina Pyatkin from the Allen Institute and ETH Zurich on training open-source LLMs.",
        endsAt: "2026-04-01T20:00:00+02:00",
        number: 20,
        series: "zurichnlp",
        slug: "zurichnlp-20",
        source: "zurichai.ch",
        sourceId: "536061f8-a5b2-4929-9bbf-a139e8044fed",
        speakers: [
            { name: "Fabian Schaipp", title: "Inria" },
            { name: "Valentina Pyatkin", title: "Allen Institute and ETH Zurich" },
        ],
        startsAt: "2026-04-01T18:00:00+02:00",
        tags: ["nlp", "language-models", "training"],
        title: "ZurichNLP #20",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-20",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Francis Engelmann from USI on superquadric representations for world models and Korrawe Karunratanakul from Flexion on versatile character control.",
        endsAt: "2026-04-16T20:00:00+02:00",
        number: 13,
        series: "zurichcv",
        slug: "zurichcv-13",
        source: "zurichai.ch",
        sourceId: "31309fc3-126b-45b9-a0b7-e351dd1c03f5",
        speakers: [
            { name: "Francis Engelmann", title: "Assistant Professor, USI" },
            { name: "Korrawe Karunratanakul", title: "Motion Generation Lead, Flexion" },
        ],
        startsAt: "2026-04-16T18:00:00+02:00",
        tags: ["computer-vision", "world-models", "character-control"],
        title: "ZurichCV #13",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-13",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Seif Ismail from Watney Robotics on Conway's Law in robotics and Victor Klemm from ETH Zurich on designing robots with legs, wheels, and arms.",
        endsAt: "2026-05-21T20:00:00+02:00",
        number: 4,
        series: "zurichrobotics",
        slug: "zurichrobotics-4",
        source: "zurichai.ch",
        sourceId: "d3a0b9dc-9d4e-4251-9578-72e00c7d4818",
        speakers: [
            { name: "Seif Ismail", title: "Founding Engineer, Watney Robotics" },
            { name: "Victor Klemm", title: "PhD, ETH Zurich" },
        ],
        startsAt: "2026-05-21T18:00:00+02:00",
        tags: ["robotics", "robot-design", "manipulation"],
        title: "ZurichRobotics #4",
        sourceUrl: "https://www.zurichai.ch/events/zurichrobotics-3-1-1",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Jannis Vamvas from the University of Zurich on the challenge of Romansh and Eric Chen from EPFL on reasoning as test-time learning.",
        endsAt: "2026-06-08T20:00:00+02:00",
        number: 21,
        series: "zurichnlp",
        slug: "zurichnlp-21",
        source: "zurichai.ch",
        sourceId: "25dece0e-b160-4b52-9760-e86040e712e6",
        speakers: [
            { name: "Jannis Vamvas", title: "University of Zurich" },
            { name: "Eric Chen", title: "EPFL" },
        ],
        startsAt: "2026-06-08T18:00:00+02:00",
        tags: ["nlp", "romansh", "reasoning"],
        title: "ZurichNLP #21",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-21",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Haithem Turki from NVIDIA on photorealistic world models and Omar Sanseviero from Google DeepMind on the open Gemma model family.",
        endsAt: "2026-06-30T20:00:00+02:00",
        number: 14,
        series: "zurichcv",
        slug: "zurichcv-14",
        source: "zurichai.ch",
        sourceId: "f883221f-d16a-4945-b830-dfc89ca644fa",
        speakers: [
            { name: "Haithem Turki", title: "Senior Research Scientist, NVIDIA" },
            { name: "Omar Sanseviero", title: "Google DeepMind" },
        ],
        startsAt: "2026-06-30T18:00:00+02:00",
        tags: ["computer-vision", "world-models", "gemma"],
        title: "ZurichCV #14",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-14",
        venue: "eth-ai-center-14",
    },
];

/** Validate the complete checked event archive. */
export function validateArchive() {
    const slugs = new Set<string>();
    const sources = new Set<string>();
    let previousStart = 0;

    // validate each event identity, source, and time range
    for (const event of archiveEvents) {
        const start = Date.parse(event.startsAt);
        const end = Date.parse(event.endsAt);
        const source = `${event.source}:${event.sourceId}`;
        const sourceHost = new URL(event.sourceUrl).hostname.replace(/^www\./, "");

        if (slugs.has(event.slug)) {
            throw new Error(`Duplicate archive event slug: ${event.slug}.`);
        }
        if (sources.has(source)) {
            throw new Error(`Duplicate archive event source: ${source}.`);
        }
        if (sourceHost !== event.source) {
            throw new Error(`Archive event ${event.slug} has a mismatched source URL.`);
        }
        if (event.sourceId.length === 0 || event.speakers.length === 0) {
            throw new Error(`Archive event ${event.slug} is missing source or speaker records.`);
        }
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
            throw new Error(`Archive event ${event.slug} has an invalid time range.`);
        }
        if (start < previousStart) {
            throw new Error(`Archive event ${event.slug} is out of chronological order.`);
        }

        // retain validated event state
        slugs.add(event.slug);
        sources.add(source);
        previousStart = start;
    }

    // require every numbered event in every series
    for (const series of archiveSeries) {
        const actual = archiveEvents
            .filter((event) => event.series === series.slug)
            .map((event) => event.number)
            .sort((left, right) => (left ?? 0) - (right ?? 0));
        const expected = Array.from(
            { length: lastEventNumber[series.slug] },
            (_, index) => index + 1,
        );

        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Archive series ${series.slug} is not continuous.`);
        }

        // require canonical numbered titles and routes
        for (const number of expected) {
            const event = archiveEvents.find(
                (candidate) => candidate.series === series.slug && candidate.number === number,
            );
            if (
                event?.slug !== `${series.slug}-${number}` ||
                event.title !== `${series.title} #${number}`
            ) {
                throw new Error(`Archive series ${series.slug} has an invalid event ${number}.`);
            }
        }
    }

    // require exactly one unnumbered special event
    const specials = archiveEvents.filter(
        (event) => event.series === undefined || event.number === undefined,
    );
    const special = specials[0];
    if (
        specials.length !== 1 ||
        special?.slug !== schmidhuberSlug ||
        special.series !== undefined ||
        special.number !== undefined
    ) {
        throw new Error("The archive must contain only the Schmidhuber special event.");
    }
}
