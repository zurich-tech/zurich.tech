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
    title: string;
};

/** A Zurich AI event. */
export type ArchiveEvent = {
    /** The published event description. */
    description: string;
    /** The ISO end time. */
    endsAt: string;
    /** The route slug. */
    slug: string;
    /** The parent series slug. */
    series: ArchiveSeries["slug"];
    /** The published speakers when available. */
    speakers?: ArchiveSpeaker[];
    /** The ISO start time. */
    startsAt: string;
    /** The event tags. */
    tags: string[];
    /** The public title. */
    title: string;
    /** The source page. */
    url: string;
    /** The ETH AI Center floor. */
    venue: "eth-ai-center-14" | "eth-ai-center-19";
};

/** The Zurich AI series represented in the public archive. */
export const archiveSeries: ArchiveSeries[] = [
    {
        description: "Computer vision talks from researchers and engineers in Zurich.",
        slug: "zurichcv",
        tags: ["computer-vision", "machine-learning"],
        title: "ZurichCV",
    },
    {
        description: "Natural language processing talks from researchers and engineers in Zurich.",
        slug: "zurichnlp",
        tags: ["nlp", "language-models", "machine-learning"],
        title: "ZurichNLP",
    },
    {
        description: "Robotics talks from researchers and engineers in Zurich.",
        slug: "zurichrobotics",
        tags: ["robotics", "machine-learning"],
        title: "ZurichRobotics",
    },
];

/** The events published by zurichai.ch. */
export const archiveEvents: ArchiveEvent[] = [
    {
        description: "Scaling LoRA serving for AWS and defending against hoodwinked agents.",
        endsAt: "2024-07-09T20:00:00+02:00",
        series: "zurichnlp",
        slug: "zurichnlp-11",
        startsAt: "2024-07-09T18:00:00+02:00",
        tags: ["nlp", "language-models"],
        title: "ZurichNLP #11",
        url: "https://www.zurichai.ch/events/zurichnlp-11",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Image tokenizers in the age of VLMs and photorealistic reconstruction of 3D scenes.",
        endsAt: "2024-07-16T20:00:00+02:00",
        series: "zurichcv",
        slug: "zurichcv-4",
        startsAt: "2024-07-16T18:00:00+02:00",
        tags: ["computer-vision", "3d"],
        title: "ZurichCV #4",
        url: "https://www.zurichai.ch/events/zurichcv-4",
        venue: "eth-ai-center-14",
    },
    {
        description: "Yannic Kilcher on OpenAssistant and Afra Amini on aligning LLM algorithms.",
        endsAt: "2024-09-10T20:00:00+02:00",
        series: "zurichnlp",
        slug: "zurichnlp-12",
        startsAt: "2024-09-10T18:00:00+02:00",
        tags: ["nlp", "language-models"],
        title: "ZurichNLP #12",
        url: "https://www.zurichai.ch/events/zurichnlp-12",
        venue: "eth-ai-center-14",
    },
    {
        description: "Julian Eisenschlos from Google DeepMind and Anton Obukhov from ETH Zurich.",
        endsAt: "2024-09-17T20:00:00+02:00",
        series: "zurichcv",
        slug: "zurichcv-5",
        startsAt: "2024-09-17T18:00:00+02:00",
        tags: ["computer-vision", "machine-learning"],
        title: "ZurichCV #5",
        url: "https://www.zurichai.ch/events/zurichcv-5",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Betsa Maciej and Riccardo Maggioni from ETH Zurich on graph of thoughts and accelerating industrial programming with AI.",
        endsAt: "2024-10-22T20:00:00+02:00",
        series: "zurichnlp",
        slug: "zurichnlp-13",
        startsAt: "2024-10-22T18:00:00+02:00",
        tags: ["nlp", "programming"],
        title: "ZurichNLP #13",
        url: "https://www.zurichai.ch/events/zurichnlp-13",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Barath Daniel Béla from ETH Zurich on GLOMAP and Peter Karkus from NVIDIA Research on autonomous driving in the age of LLMs.",
        endsAt: "2024-11-19T20:00:00+01:00",
        series: "zurichcv",
        slug: "zurichcv-6",
        startsAt: "2024-11-19T18:00:00+01:00",
        tags: ["computer-vision", "autonomous-driving"],
        title: "ZurichCV #6",
        url: "https://www.zurichai.ch/events/zurichcv-6",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Jonas Hübotter and Imanol Schlag from ETH Zurich on learning at test time and Swiss sovereign AI.",
        endsAt: "2024-12-03T20:00:00+01:00",
        series: "zurichnlp",
        slug: "zurichnlp-14",
        startsAt: "2024-12-03T18:00:00+01:00",
        tags: ["nlp", "language-models"],
        title: "ZurichNLP #14",
        url: "https://www.zurichai.ch/events/zurichnlp-14",
        venue: "eth-ai-center-14",
    },
    {
        description: "Ayca Takmaz on open-vocabulary 3D scene understanding.",
        endsAt: "2025-01-23T20:00:00+01:00",
        series: "zurichcv",
        slug: "zurichcv-7",
        startsAt: "2025-01-23T18:00:00+01:00",
        tags: ["computer-vision", "3d"],
        title: "ZurichCV #7",
        url: "https://www.zurichai.ch/events/zurichcv-7",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Matej Jusup from the ETH AI Center on mastering board games and Bobby He from the University of Oxford on understanding outlier features.",
        endsAt: "2025-02-20T20:00:00+01:00",
        series: "zurichnlp",
        slug: "zurichnlp-15",
        startsAt: "2025-02-20T18:00:00+01:00",
        tags: ["nlp", "language-models"],
        title: "ZurichNLP #15",
        url: "https://www.zurichai.ch/events/zurichnlp-15",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Xi Wang on egocentric learning and Nikolai Kalischek on diffusion-based panorama generation.",
        endsAt: "2025-02-24T20:00:00+01:00",
        series: "zurichcv",
        slug: "zurichcv-8",
        startsAt: "2025-02-24T18:00:00+01:00",
        tags: ["computer-vision", "diffusion"],
        title: "ZurichCV #8",
        url: "https://www.zurichai.ch/events/zurichcv-8",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Linus Scheibenreif from ETH Zurich on self-supervised learning for satellite imagery and Pascal Chang from ETH Zurich and Disney Research on visual anagram generation.",
        endsAt: "2025-04-29T20:00:00+02:00",
        series: "zurichcv",
        slug: "zurichcv-9",
        startsAt: "2025-04-29T18:00:00+02:00",
        tags: ["computer-vision", "diffusion", "satellite-imagery"],
        title: "ZurichCV #9",
        url: "https://www.zurichai.ch/events/zurichcv-9",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Ivan Vulić from the University of Cambridge and Google DeepMind on vision-language models for spatial reasoning and Tiago Pimentel from ETH Zurich on generalisation in language models.",
        endsAt: "2025-05-21T20:00:00+02:00",
        series: "zurichnlp",
        slug: "zurichnlp-16",
        startsAt: "2025-05-21T18:00:00+02:00",
        tags: ["nlp", "vision-language-models"],
        title: "ZurichNLP #16",
        url: "https://www.zurichai.ch/events/zurichnlp-16",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Aleksander Ficek from NVIDIA on synthetic generators and verifiers for coding and Matteo Saponati from ETH Zurich on the structures of self-attention.",
        endsAt: "2025-06-17T20:00:00+02:00",
        series: "zurichnlp",
        slug: "zurichnlp-17",
        startsAt: "2025-06-17T18:00:00+02:00",
        tags: ["nlp", "programming", "transformers"],
        title: "ZurichNLP #17",
        url: "https://www.zurichai.ch/events/zurichnlp-17",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Felix Wimbauer from the Technical University of Munich and Google on understanding the 3D world from videos, and Joan Puigcerver from Google DeepMind on scaling computer vision architectures.",
        endsAt: "2025-08-07T20:00:00+02:00",
        series: "zurichcv",
        slug: "zurichcv-10",
        startsAt: "2025-08-07T18:00:00+02:00",
        tags: ["computer-vision", "3d"],
        title: "ZurichCV #10",
        url: "https://www.zurichai.ch/events/zurichcv-10",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Barnabas Gavin Cangan from ETH Zurich on robot hands and Caterina Caccavella from ZHAW and ETH Zurich on bio-inspired active sensing.",
        endsAt: "2025-09-24T20:00:00+02:00",
        series: "zurichrobotics",
        slug: "zurichrobotics-1",
        startsAt: "2025-09-24T18:00:00+02:00",
        tags: ["robotics", "manipulation", "sensing"],
        title: "ZurichRobotics #1",
        url: "https://www.zurichai.ch/events/zurichrobotics-1",
        venue: "eth-ai-center-14",
    },
    {
        description: "Jürgen Schmidhuber on the past, present, and future of AI.",
        endsAt: "2025-10-21T20:00:00+02:00",
        series: "zurichnlp",
        slug: "zurichai-jurgen-schmidhuber",
        speakers: [{ name: "Jürgen Schmidhuber", title: "AI researcher" }],
        startsAt: "2025-10-21T18:00:00+02:00",
        tags: ["artificial-intelligence", "machine-learning"],
        title: "ZurichAI: Jürgen Schmidhuber",
        url: "https://www.zurichai.ch/events/zurichai-jurgen-schmidhuber",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Paul-Edouard Sarlin from Google on 3D reconstruction for localization and Nando Metzger from ETH Zurich on high-resolution maps.",
        endsAt: "2025-11-20T20:00:00+01:00",
        series: "zurichcv",
        slug: "zurichcv-11",
        startsAt: "2025-11-20T18:00:00+01:00",
        tags: ["computer-vision", "3d", "mapping"],
        title: "ZurichCV #11",
        url: "https://www.zurichai.ch/events/zurichcv-11",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Philippe Bich from Huawei on calibration-free low-precision LLMs and Alejandro Hernandez Cano from EPFL on Apertus, the Swiss open LLM.",
        endsAt: "2025-11-24T20:00:00+01:00",
        series: "zurichnlp",
        slug: "zurichnlp-18",
        startsAt: "2025-11-24T18:00:00+01:00",
        tags: ["nlp", "language-models", "apertus"],
        title: "ZurichNLP #18",
        url: "https://www.zurichai.ch/events/zurichnlp-18",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Antonio Arbues from Loki Robotics on building useful robots in the age of AI and Giacomo Manzoni from Hexagon on imitation learning for dexterous manipulation.",
        endsAt: "2025-12-15T20:00:00+01:00",
        series: "zurichrobotics",
        slug: "zurichrobotics-2",
        startsAt: "2025-12-15T18:00:00+01:00",
        tags: ["robotics", "imitation-learning", "manipulation"],
        title: "ZurichRobotics #2",
        url: "https://www.zurichai.ch/events/zurichrobotics-2",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Sina Ahmadi from the University of Zurich on low-resource language varieties and Barna Pasztor from ETH Zurich on sample-efficient dataset collection for RLHF.",
        endsAt: "2026-01-19T20:00:00+01:00",
        series: "zurichnlp",
        slug: "zurichnlp-19",
        startsAt: "2026-01-19T18:00:00+01:00",
        tags: ["nlp", "rlhf", "low-resource-languages"],
        title: "ZurichNLP #19",
        url: "https://www.zurichai.ch/events/zurichnlp-19",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Zan Gojcic from NVIDIA on generative reconstruction and Vanessa Sklyarova from ETH Zurich on hairstyle modelling for avatars.",
        endsAt: "2026-01-20T20:00:00+01:00",
        series: "zurichcv",
        slug: "zurichcv-12",
        startsAt: "2026-01-20T18:00:00+01:00",
        tags: ["computer-vision", "3d", "avatars"],
        title: "ZurichCV #12",
        url: "https://www.zurichai.ch/events/zurichcv-12",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Michael Neunert from Google DeepMind on efficient models for bringing AI into the real world and Riccardo Maggioni from FORGIS on the intelligence layer for the factory floor.",
        endsAt: "2026-03-19T20:00:00+01:00",
        series: "zurichrobotics",
        slug: "zurichrobotics-3",
        startsAt: "2026-03-19T18:00:00+01:00",
        tags: ["robotics", "efficient-models", "industrial-automation"],
        title: "ZurichRobotics #3",
        url: "https://www.zurichai.ch/events/zurichrobotics-3",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Fabian Schaipp from Inria on training algorithms for machine learning and Valentina Pyatkin from the Allen Institute and ETH Zurich on training open-source LLMs.",
        endsAt: "2026-04-01T20:00:00+02:00",
        series: "zurichnlp",
        slug: "zurichnlp-20",
        startsAt: "2026-04-01T18:00:00+02:00",
        tags: ["nlp", "language-models", "training"],
        title: "ZurichNLP #20",
        url: "https://www.zurichai.ch/events/zurichnlp-20",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Francis Engelmann from USI on superquadric representations for world models and Korrawe Karunratanakul from Flexion on versatile character control.",
        endsAt: "2026-04-16T20:00:00+02:00",
        series: "zurichcv",
        slug: "zurichcv-13",
        speakers: [
            { name: "Francis Engelmann", title: "Assistant Professor, USI" },
            { name: "Korrawe Karunratanakul", title: "Motion Generation Lead, Flexion" },
        ],
        startsAt: "2026-04-16T18:00:00+02:00",
        tags: ["computer-vision", "world-models", "character-control"],
        title: "ZurichCV #13",
        url: "https://www.zurichai.ch/events/zurichcv-13",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Seif Ismail from Watney Robotics on Conway's Law in robotics and Victor Klemm from ETH Zurich on designing robots with legs, wheels, and arms.",
        endsAt: "2026-05-21T20:00:00+02:00",
        series: "zurichrobotics",
        slug: "zurichrobotics-4",
        speakers: [
            { name: "Seif Ismail", title: "Founding Engineer, Watney Robotics" },
            { name: "Victor Klemm", title: "PhD, ETH Zurich" },
        ],
        startsAt: "2026-05-21T18:00:00+02:00",
        tags: ["robotics", "robot-design", "manipulation"],
        title: "ZurichRobotics #4",
        url: "https://www.zurichai.ch/events/zurichrobotics-3-1-1",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Jannis Vamvas from the University of Zurich on the challenge of Romansh and Eric Chen from EPFL on reasoning as test-time learning.",
        endsAt: "2026-06-08T20:00:00+02:00",
        series: "zurichnlp",
        slug: "zurichnlp-21",
        speakers: [
            { name: "Jannis Vamvas", title: "University of Zurich" },
            { name: "Eric Chen", title: "EPFL" },
        ],
        startsAt: "2026-06-08T18:00:00+02:00",
        tags: ["nlp", "romansh", "reasoning"],
        title: "ZurichNLP #21",
        url: "https://www.zurichai.ch/events/zurichnlp-21",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Haithem Turki from NVIDIA on photorealistic world models and Omar Sanseviero from Google DeepMind on the open Gemma model family.",
        endsAt: "2026-06-30T20:00:00+02:00",
        series: "zurichcv",
        slug: "zurichcv-14",
        speakers: [
            { name: "Haithem Turki", title: "Senior Research Scientist, NVIDIA" },
            { name: "Omar Sanseviero", title: "Google DeepMind" },
        ],
        startsAt: "2026-06-30T18:00:00+02:00",
        tags: ["computer-vision", "world-models", "gemma"],
        title: "ZurichCV #14",
        url: "https://www.zurichai.ch/events/zurichcv-14",
        venue: "eth-ai-center-14",
    },
];
