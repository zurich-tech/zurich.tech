const numberedEvents = [
    { count: 14, tag: "zurichcv", title: "ZurichCV" },
    { count: 21, tag: "zurichnlp", title: "ZurichNLP" },
    { count: 4, tag: "zurichrobotics", title: "ZurichRobotics" },
] as const;

const schmidhuberSlug = "jurgen-schmidhuber";

/** A Zurich AI event speaker. */
export type ArchiveSpeaker = {
    /** The speaker name. */
    name: string;
    /** The speaker affiliation or role. */
    title?: string;
};

/** A Zurich AI event. */
export type ArchiveEvent = {
    /** The complete event description. */
    description: string;
    /** The ISO end time. */
    endsAt: string;
    /** The route slug. */
    slug: string;
    /** The legacy event identifier. */
    sourceId: string;
    /** The legacy site that published the event. */
    source: "zurich-nlp.ch" | "zurichai.ch";
    /** The published speakers. */
    speakers: ArchiveSpeaker[];
    /** The ISO start time. */
    startsAt: string;
    /** The concise event summary. */
    summary: string;
    /** The event tags. */
    tags: string[];
    /** The public title. */
    title: string;
    /** The source page. */
    sourceUrl: string;
    /** The event venue. */
    venue: "eth-ai-center-14" | "eth-ai-center-19" | "eth-zurich-bin13";
};

/** The numbered Zurich AI events and the Schmidhuber special. */
export const archiveEvents: ArchiveEvent[] = [
    {
        description:
            "We are doing our first kick-off event on March 21st from 6:00 – 8:00 PM at Binzmühlestrasse 13, 4th Floor, 8050 Zürich\n\nWe are very excited to be hosting two speakers, Luca Beurer-Kellner from the SRI lab at ETH Zurich and Basil Mustafa from Google Brain Zurich. Looking forward to seeing you there!",
        summary: "Luca Beurer-Kellner from ETH Zurich and Basil Mustafa from Google Brain.",
        endsAt: "2023-03-21T20:00:00+01:00",
        slug: "zurichnlp-1",
        source: "zurich-nlp.ch",
        sourceId: "690",
        speakers: [
            { name: "Luca Beurer-Kellner", title: "ETH Zurich" },
            { name: "Basil Mustafa", title: "Google Brain" },
        ],
        startsAt: "2023-03-21T18:00:00+01:00",
        tags: ["zurichnlp", "nlp", "machine-learning"],
        title: "ZurichNLP #1",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-1/",
        venue: "eth-zurich-bin13",
    },
    {
        description:
            "Coming off the success of our first meetup, we welcome all NLP researchers, engineers and enthusiasts to our second event. We have two really exciting guests presenting: [Julian Eisenschlos](https://eisenjulian.github.io) from Google and [Alex Warstadt](https://alexwarstadt.com) from ETH Zurich.\n\nPlease RSVP, spots are limited!\n\nFollow us on [Twitter](https://twitter.com/zurich_nlp) for updates.",
        summary: "Julian Eisenschlos from Google and Alex Warstadt from ETH Zurich.",
        endsAt: "2023-05-10T20:00:00+02:00",
        slug: "zurichnlp-2",
        source: "zurich-nlp.ch",
        sourceId: "548",
        speakers: [
            { name: "Julian Eisenschlos", title: "Google" },
            { name: "Alex Warstadt", title: "ETH Zurich" },
        ],
        startsAt: "2023-05-10T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "machine-learning"],
        title: "ZurichNLP #2",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-2/",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Join us for our third meetup this time with an exciting fireside chat between [Tim Scarfe](https://twitter.com/ecsquendor) and [Zeerak Talat](http://zeerak.org) on democratization of AI, policy and ethics. The panel is being rescheduled to sometime this fall.\n\nPlease RSVP, spots are limited!",
        summary: "Tim Scarfe and Zeerak Talat on the democratization, policy, and ethics of AI.",
        endsAt: "2023-06-27T20:00:00+02:00",
        slug: "zurichnlp-3",
        source: "zurich-nlp.ch",
        sourceId: "873",
        speakers: [
            { name: "Tim Scarfe", title: "Machine Learning Street Talk" },
            { name: "Zeerak Talat" },
        ],
        startsAt: "2023-06-27T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "ai-policy", "ai-ethics"],
        title: "ZurichNLP #3",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-3/",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "We’re back with an exciting fourth meetup! We are thrilled to be hosting two talks:\n\n- “Reinforced Active Learning for Text classification” by **Katya Mirylenka** from IBM Research.\n- “AI Summarizers for Lawyers and the People” by **Prof. Dr. Elliott Ash** from ETH Zurich\n\nRSVP soon as spots are limited, we hope to see you there!",
        summary:
            "Katya Mirylenka from IBM Research and Elliott Ash from ETH Zurich on text classification and legal summarization.",
        endsAt: "2023-09-26T20:00:00+02:00",
        slug: "zurichnlp-4",
        source: "zurich-nlp.ch",
        sourceId: "980",
        speakers: [
            { name: "Katya Mirylenka", title: "IBM Research" },
            { name: "Elliott Ash", title: "ETH Zurich" },
        ],
        startsAt: "2023-09-26T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "active-learning", "legal-ai"],
        title: "ZurichNLP #4",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-4/",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Meetup \\#5 is fast approaching and will be our best one yet! It’s our pleasure to announce the following speakers:\n\n- Jonas Pfeiffer, Research Scientist at Deepmind presenting “[Modular Deep Learning](https://www.modulardeeplearning.com/)“\n- Eiso Kant, CTO and Co-founder of Poolside presenting “Roadmap for AI progress by learning from code”\n\nRSVP soon as spots are limited, last time we maxed capacity. Hope to see you there!",
        summary:
            "Jonas Pfeiffer from Google DeepMind on modular deep learning and Eiso Kant from Poolside on learning from code.",
        endsAt: "2023-10-19T20:00:00+02:00",
        slug: "zurichnlp-5",
        source: "zurich-nlp.ch",
        sourceId: "1099",
        speakers: [
            { name: "Jonas Pfeiffer", title: "Google DeepMind" },
            { name: "Eiso Kant", title: "Co-founder and CTO, Poolside" },
        ],
        startsAt: "2023-10-19T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "modular-deep-learning", "programming"],
        title: "ZurichNLP #5",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-5/",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "Meetup \\#6 is coming soon and will be our best one yet! It’s our pleasure to announce the following speakers:\n\n- Lucas Beyer (Google DeepMind/Brain)\n- Ana Kotarcic (University of Zurich)\n\nRSVP soon as spots are limited, the last few times we maxed out capacity. Hope to see you there!",
        summary: "Lucas Beyer from Google DeepMind and Ana Kotarcic from the University of Zurich.",
        endsAt: "2023-12-07T19:00:00+01:00",
        slug: "zurichnlp-6",
        source: "zurich-nlp.ch",
        sourceId: "1239",
        speakers: [
            { name: "Lucas Beyer", title: "Google DeepMind" },
            { name: "Ana Kotarcic", title: "University of Zurich" },
        ],
        startsAt: "2023-12-07T17:00:00+01:00",
        tags: ["zurichnlp", "nlp", "machine-learning"],
        title: "ZurichNLP #6",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-6/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Happy new year! We are kicking off 2024 with Meetup \\#7 on January 16th! It’s our pleasure to announce the following speakers:\n\n- Martina Forster and Luca Campanella from Typewise\n- Tiago Pimentel from ETH Zurich\n\nRSVP soon as spots are limited, the last few times we maxed out capacity. Talk details:\n\nSpeaker \\#1: Martina Forster and Luca Campanella\n\nTitle: Life in an NLP Startup: A Glimpse into Typewise’s Journey in Revolutionizing Customer Service\nAbstract: Ever wondered what it’s like to work in an NLP startup in Switzerland? Join us as we share our experiences at Typewise, a Zurich-based startup that’s transforming customer service with AI. We’ll give you a taste of our day-to-day, the challenges we face, and the excitement of working in the rapidly evolving field of NLP. You’ll also get a sneak peek of our text prediction technology and how it’s making customer service communication more efficient. Plus, we’ll dive into one of the NLP tasks we work on – Grammatical Error Correction. If you’re curious about the practical applications of AI and the realities of working in an NLP startup, this talk is for you.\n\nSpeaker \\#2: Tiago Pimentel\n\nTitle: Revisiting the Optimality of Word Lengths\nZipf posited that wordforms are optimized to minimize utterances’ communicative costs. He supported this claim by showing that words’ lengths are inversely correlated with their frequencies. This correlation, however, is only expected if one assumes that a words’ communicative cost is given by its length. We explore this assumption, comparing the predictive power over word lengths we get when assuming different operationalisations of communicative cost.\n\nHope to see you there!",
        summary:
            "Martina Forster and Luca Campanella from Typewise on building an NLP startup, and Tiago Pimentel from ETH Zurich on word lengths.",
        endsAt: "2024-01-16T20:00:00+01:00",
        slug: "zurichnlp-7",
        source: "zurich-nlp.ch",
        sourceId: "1354",
        speakers: [
            { name: "Martina Forster", title: "Typewise" },
            { name: "Luca Campanella", title: "Typewise" },
            { name: "Tiago Pimentel", title: "ETH Zurich" },
        ],
        startsAt: "2024-01-16T18:00:00+01:00",
        tags: ["zurichnlp", "nlp", "startups", "linguistics"],
        title: "ZurichNLP #7",
        sourceUrl: "https://zurich-nlp.ch/event/zurich-nlp-meetup-7/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "We are continuing strong in 2024 with Meetup \\#8 on February 27th! We’re happy to announce the following speakers:\n\n- Brian DuSell, Postdoc @ ETH Zurich\n- Leandro von Werra, Chief Loss Officer @ Hugging Face\n\nRSVP soon as spots are limited, the last few times we maxed out capacity. Talk details:\n\nSpeaker \\#1: Brian DuSell\nTitle: Stack Attention: Improving the Ability of Transformers to Model Hierarchical Patterns\nSummary: Language contains hierarchical syntactic patterns, but transformers do not have a mechanism for dealing with hierarchies of arbitrary depth. In this talk I will present my work on Stack Attention, a kind of self-attention with a latent model of syntax that addresses this limitation and allows transformers to model any context-free language.\n\nSpeaker \\#2: Leandro von Werra\n\nTitle: BigCode: Building LLM’s for Code in an Open and Responsible Way\n\nHope to see you there!",
        summary:
            "Brian DuSell from ETH Zurich on stack attention and Leandro von Werra from Hugging Face on BigCode.",
        endsAt: "2024-02-27T20:00:00+01:00",
        slug: "zurichnlp-8",
        source: "zurich-nlp.ch",
        sourceId: "1447",
        speakers: [
            { name: "Brian DuSell", title: "ETH Zurich" },
            { name: "Leandro von Werra", title: "Hugging Face" },
        ],
        startsAt: "2024-02-27T18:00:00+01:00",
        tags: ["zurichnlp", "nlp", "transformers", "programming"],
        title: "ZurichNLP #8",
        sourceUrl: "https://zurich-nlp.ch/event/zurichnlp-meetup-8/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "With all of the success with ZurichNLP we are now kicking off our first ZurichCV meetup this upcoming March 14th (Pi day)! Our first meetup will feature the following speakers:\n\n- Felix Bauer, Senior R&D Engineer at SynSense\n- Songyou Peng,  Senior Researcher/Postdoc at ETH Zurich\n\nPlease RSVP as soon as possible because spots fill up quick, hope to see you there!",
        summary:
            "Felix Bauer from SynSense and Songyou Peng from ETH Zurich launch the ZurichCV series.",
        endsAt: "2024-03-14T20:00:00+01:00",
        slug: "zurichcv-1",
        source: "zurich-nlp.ch",
        sourceId: "1587",
        speakers: [
            { name: "Felix Bauer", title: "Senior R&D Engineer, SynSense" },
            { name: "Songyou Peng", title: "ETH Zurich" },
        ],
        startsAt: "2024-03-14T18:00:00+01:00",
        tags: ["zurichcv", "computer-vision", "machine-learning"],
        title: "ZurichCV #1",
        sourceUrl: "https://zurich-nlp.ch/event/zurichcv-meetup-1/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Our computer vision series is continuing strong: **ZurichCV \\#2 on April 16th at 17:00** will feature an in depth talk by **Lucas Beyer from Google Brain**/DeepMind about structured computer vision in the age of LLMs, specifically:\n\n“Structured output tasks in computer vision are tasks which require more “complicated” output than just a probability, and need to be “globally consistent”. Examples are detection, (panoptic) segmentation, colorization, tracking, and many more. Classically, communities have formed around each such task, with their very specialized approaches. We take a step back, understand why, and devise a general solution, that is surprisingly similar to LLMs, hence bringing the communities closer together. Papers covered: [https://arxiv.org/abs/2205.10337](https://t.co/IsWE8adVfV) and [https://arxiv.org/abs/2302.08242](https://t.co/ZdDpz0s4XA).”\n\nRSVP soon. See you there!",
        summary:
            "Lucas Beyer from Google DeepMind on structured computer vision in the age of language models.",
        endsAt: "2024-04-16T20:00:00+02:00",
        slug: "zurichcv-2",
        source: "zurich-nlp.ch",
        sourceId: "1703",
        speakers: [{ name: "Lucas Beyer", title: "Google DeepMind" }],
        startsAt: "2024-04-16T17:00:00+02:00",
        tags: ["zurichcv", "computer-vision", "language-models"],
        title: "ZurichCV #2",
        sourceUrl: "https://zurich-nlp.ch/event/zurichcv-meetup-2/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "We’re happy to announce **ZurichNLP \\#9 on April 25th** with the following speakers:\n\n- **Lewis Tunstall** (MLE @ HuggingFace) on **How to Align Your LLM**\n- **Vilém Zouhar** (PhD @ ETH Zurich) on **Pride and BPE: How We Solved Tokenization but Got It Wrong**\n\n  “Tokenization is present in almost all NLP pipelines, but rarely examined mathematically. We formalize and show boundaries to the most popular tokenization algorithm, Byte-Pair Encoding. Then, with information theory, we show what makes some tokenization better than others and how to use this as a metric before training your expensive models. Lastly, we admit how we got this hypothesis wrong.”\n\nSlides from Lewis’s presentation can be found [here](https://docs.google.com/presentation/d/1Ca8YOaK5H4W2y78AjwaSt2OQM1tcnpH1/edit?usp=sharing&ouid=115433555762337855818&rtpof=true&sd=true)!\n\nRSVP soon as spots are limited.",
        summary:
            "Lewis Tunstall from Hugging Face on LLM alignment and Vilém Zouhar from ETH Zurich on tokenization.",
        endsAt: "2024-04-25T20:00:00+02:00",
        slug: "zurichnlp-9",
        source: "zurich-nlp.ch",
        sourceId: "1769",
        speakers: [
            { name: "Lewis Tunstall", title: "Hugging Face" },
            { name: "Vilém Zouhar", title: "ETH Zurich" },
        ],
        startsAt: "2024-04-25T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "language-models", "tokenization"],
        title: "ZurichNLP #9",
        sourceUrl: "https://zurich-nlp.ch/event/zurichnlp-meetup-9/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "We’re happy to announce **ZurichNLP \\#10 on May 28th** with the following speakers:\n\n- **Kacper Lukawski** (Senior Developer Advocate @ **Qdrant**) on **optimizing RAG applications**:\n  “LLM outputs in the Retrieval Augmented Generation pipelines are only as good as the documents we provide for answer generation. We will review the strategies of semantic search optimization depending on your speed, memory, and quality requirements”\n- **Tannon Kew** (PhD student @ **University of Zurich**) on **tuning English-centric LLMs into polyglots**\n\nRSVP soon as spots are limited.",
        summary:
            "Kacper Lukawski from Qdrant on optimizing RAG and Tannon Kew from the University of Zurich on multilingual language models.",
        endsAt: "2024-05-28T20:00:00+02:00",
        slug: "zurichnlp-10",
        source: "zurich-nlp.ch",
        sourceId: "1930",
        speakers: [
            { name: "Kacper Lukawski", title: "Qdrant" },
            { name: "Tannon Kew", title: "University of Zurich" },
        ],
        startsAt: "2024-05-28T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "rag", "multilingual-models"],
        title: "ZurichNLP #10",
        sourceUrl: "https://zurich-nlp.ch/event/zurichnlp-meetup-10/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**ZurichCV \\#3 on June 13th at 18:00** will feature two talks:\n\n1.  **Julian Schilliger from ETH Zurich** on deciphering ancient papyrus for the Scroll Prize (Vesuvius Challenge):\n    “On how to unroll and read a 2000 year old papyrus scroll that was buried by the Vesuvius eruption with computer vision, from ancient Rome to a modern particle accelerator and into an high resolution and large CT scan of the scroll.”\n2.  **Nicolas Muntwyler from nunu.ai** on building visual agents to playtest video games\n\nRSVP soon. See you there!",
        summary:
            "Julian Schilliger from ETH Zurich on reading ancient papyrus and Nicolas Muntwyler from nunu.ai on visual game agents.",
        endsAt: "2024-06-13T20:00:00+02:00",
        slug: "zurichcv-3",
        source: "zurich-nlp.ch",
        sourceId: "2147",
        speakers: [
            { name: "Julian Schilliger", title: "ETH Zurich" },
            { name: "Nicolas Muntwyler", title: "nunu.ai" },
        ],
        startsAt: "2024-06-13T18:00:00+02:00",
        tags: ["zurichcv", "computer-vision", "3d", "game-agents"],
        title: "ZurichCV #3",
        sourceUrl: "https://zurich-nlp.ch/event/zurichcv-meetup-3/",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "We’re happy to announce ZurichNLP #11 on July 9th with the following speakers:\n\n- **Arlind Nocaj** (Solutions Architect @ AWS) on **scaling LoRA serving**\n- **Edoardo Debenedetti** (PhD @ ETH) on **on measuring the security of AI agent systems**",
        summary: "Scaling LoRA serving for AWS and defending against hoodwinked agents.",
        endsAt: "2024-07-09T20:00:00+02:00",
        slug: "zurichnlp-11",
        source: "zurichai.ch",
        sourceId: "cdb3efee-77a8-45f1-b014-46e601bc4789",
        speakers: [
            { name: "Arlind Nocaj", title: "Solutions Architect, AWS" },
            { name: "Edoardo Debenedetti", title: "ETH Zurich" },
        ],
        startsAt: "2024-07-09T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "language-models"],
        title: "ZurichNLP #11",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-11",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**ZurichCV #4 on July 16th at 18:00** will feature two talks:\n\n1. **Michael Tschannen from Google DeepMind** on image tokenizers in the age of VLMs\n1. **Tobias Fischer from ETH Zurich** on photorealistic reconstruction of dynamic scenes with 3D Gaussian Splatting",
        summary:
            "Image tokenizers in the age of VLMs and photorealistic reconstruction of 3D scenes.",
        endsAt: "2024-07-16T20:00:00+02:00",
        slug: "zurichcv-4",
        source: "zurichai.ch",
        sourceId: "4bed1af6-850e-4d3d-94e7-bf3e4f4627da",
        speakers: [
            { name: "Michael Tschannen", title: "Google DeepMind" },
            { name: "Tobias Fischer", title: "ETH Zurich" },
        ],
        startsAt: "2024-07-16T18:00:00+02:00",
        tags: ["zurichcv", "computer-vision", "3d"],
        title: "ZurichCV #4",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-4",
        venue: "eth-ai-center-14",
    },
    {
        description:
            '**Yannic Kilcher** (from DeepJudge) will be discussing the OpenAssistant project, which collected over 10000 answers & preference labels from volunteer annotators for finetuning LLMs.\n\n**Afra Amini** (from ETH Zurich) will be talking about Variational Best-of-N alignment:\n\n"Best-of-N is an effective and straightforward LLM algorithm for aligning language models to human preferences: at inference time, N samples are drawn from the language model, and the sample with the highest reward, as judged by a reward model, is returned as the output. Despite its effectiveness, BoN is computationally expensive; it reduces sampling throughput by a factor of N. In this talk, we will explore how to approximate the BoN algorithm by fine-tuning a language model. The goal is to make sampling a single output from the fine-tuned model equivalent to performing BoN on the reference model before alignment."',
        summary: "Yannic Kilcher on OpenAssistant and Afra Amini on aligning LLM algorithms.",
        endsAt: "2024-09-10T20:00:00+02:00",
        slug: "zurichnlp-12",
        source: "zurichai.ch",
        sourceId: "6b6fe7fa-37e4-4da9-964f-c919cb3b8c3e",
        speakers: [
            { name: "Yannic Kilcher", title: "DeepJudge" },
            { name: "Afra Amini", title: "ETH Zurich" },
        ],
        startsAt: "2024-09-10T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "language-models"],
        title: "ZurichNLP #12",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-12",
        venue: "eth-ai-center-14",
    },
    {
        description:
            '**Julian Eisenschlos** (from Google Deepmind) will talk about: "Visual language: how generation can drive understanding of charts and plots"\n\n"Large amounts of content both online and offline relies on structure to organize and communicate information more effectively. While natural image understanding and generation has been studied extensively, visually situated language such as tables, charts, plots, and infographics, continues to be a challenge for models large and small. In this talk we will show how teaching models to generate visually situated language can improve downstream reading and reasoning on this data modality for tasks such as question answering, entailment and summarization."\n\n**Anton Obukhov** (from ETH Zurich) will talk about "Beyond Astronaut on a Horse: Repurposing Text-to-Image Models".\n\n"Stable Diffusion has garnered significant attention from the vision community, artists, and content creators. Its widespread adoption stems from notable enhancements in generation quality, versatile conditioning across different modalities, and the availability of open-source models. In this talk, we will initially explore leveraging the rich generative image prior in 3D contexts, focusing on the task of painting 3D geometry. Subsequently, we will examine the application of these pretrained generative diffusion models within the perception stack. Specifically, we enhance domain generalization in semantic segmentation through a data-centric approach for image and label generation. In the final segment, we introduce an innovative monocular depth estimation pipeline. This pipeline, built upon the generative prior and refined with synthetic data, achieves state-of-the-art results across multiple real-world datasets in a zero-shot fashion."',
        summary: "Julian Eisenschlos from Google DeepMind and Anton Obukhov from ETH Zurich.",
        endsAt: "2024-09-17T20:00:00+02:00",
        slug: "zurichcv-5",
        source: "zurichai.ch",
        sourceId: "fe2a861f-0763-4ed6-bc07-4b80d08aadb6",
        speakers: [
            { name: "Julian Eisenschlos", title: "Google DeepMind" },
            { name: "Anton Obukhov", title: "ETH Zurich" },
        ],
        startsAt: "2024-09-17T18:00:00+02:00",
        tags: ["zurichcv", "computer-vision", "machine-learning"],
        title: "ZurichCV #5",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-5",
        venue: "eth-ai-center-14",
    },
    {
        description:
            '**Besta Maciej (ETH Zurich)** on "Effective and Efficient LLM Ecosystems with Graph of Thoughts and Beyond":\nGraph of Thoughts (GoT) is a framework that advances reasoning and prompting capabilities in large language models (LLMs) beyond those offered by paradigms such as Chain-of-Thought or Tree of Thoughts (ToT). The key idea and primary advantage of GoT is the ability to model the information generated by an LLM as an arbitrary graph, where units of information ("LLM thoughts") are vertices, and edges correspond to dependencies between these vertices. This approach enables combining arbitrary LLM thoughts and whole reasoning chains into synergistic outcomes, preserving the experience from failures instead of discarding it, distilling the essence of whole networks of thoughts, or enhancing thoughts using feedback loops. We illustrate that GoT offers advantages in the outcome accuracy and token cost over state of the art on different tasks such as keyword counting, NDA merging, or sorting. We then discuss how to augment GoT with more powerful capabilities that include tool usage and RAG using an abstraction called Topologies of Reasoning (ToR) that forms a blueprint for building an effective and efficient LLM ecosystem. We finalize with an overview of our recent developments within ToR, which include CheckEmbed (a method for robust verification of LLM outcomes and hallucination detection) and Multi-Head RAG (a design that enhances RAG when dealing with multi-aspectual data).\n\n**Riccardo M. (ETH Zurich)** on "Accelerating Industrial Programming with AI: Bridging LLM and Industrial Automation":\nDespite the growing sophistication of industrial automation, the complexity of programming production lines remains a bottleneck for engineers. In addition, automation engineers are becoming very rare, and the current number cannot satisfy the high demand, leading to costly delays for System integrators. At Xelerit, we are pioneering a solution that leverages LLM to simplify and expedite the process of generating code for industrial robots and PLC. By bridging the gap between human instructions and machine code, our platform empowers engineers to focus on innovation and design rather than tedious coding tasks, speeding up the process and reducing the number of engineers needed for projects. This talk will explore the role of LLM combined with techniques such as RAG, COT and close-loop in transforming industrial programming, the challenges we are overcoming, and the potential this technology holds for revolutionizing industrial automation.',
        summary:
            "Betsa Maciej and Riccardo Maggioni from ETH Zurich on graph of thoughts and accelerating industrial programming with AI.",
        endsAt: "2024-10-22T20:00:00+02:00",
        slug: "zurichnlp-13",
        source: "zurichai.ch",
        sourceId: "22fc85f9-32c2-4f32-a028-570126bb2dea",
        speakers: [
            { name: "Betsa Maciej", title: "ETH Zurich" },
            { name: "Riccardo Maggioni", title: "ETH Zurich" },
        ],
        startsAt: "2024-10-22T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "programming"],
        title: "ZurichNLP #13",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-13",
        venue: "eth-ai-center-14",
    },
    {
        description:
            '**Barath Daniel Béla** from ETH Zurich on **3D Reconstruction with Global Structure-from-Motion**:\n\n"In this presentation, I will discuss key components of global Structure-from-Motion (SfM) pipelines, focusing on essential steps such as pose graph generation, and rotation and translation averaging. I will introduce GLOMAP, our recent method that significantly enhances the efficiency of SfM pipelines. GLOMAP delivers an order-of-magnitude improvement in run-time over COLMAP, while maintaining or even exceeding its accuracy. This talk will cover the theoretical advancements driving GLOMAP\'s superior performance and explore its implications for large-scale 3D reconstruction tasks across various applications."\n\n**Peter Karkus** from NVIDIA Research on **Autonomous Driving in the Era of Foundation Models**:\n"I will briefly review open research questions in autonomous driving, and share our vision for next generation autonomous vehicles in the era of internet scale foundation models at NVIDIA research. I will review some of our recent and ongoing works along four key areas: on-vehicle AV stacks, simulation, auto-labeling, and safety."',
        summary:
            "Barath Daniel Béla from ETH Zurich on GLOMAP and Peter Karkus from NVIDIA Research on autonomous driving in the age of LLMs.",
        endsAt: "2024-11-19T20:00:00+01:00",
        slug: "zurichcv-6",
        source: "zurichai.ch",
        sourceId: "6a6276cb-e66c-4044-9e27-8d349206ef80",
        speakers: [
            { name: "Barath Daniel Béla", title: "ETH Zurich" },
            { name: "Peter Karkus", title: "NVIDIA Research" },
        ],
        startsAt: "2024-11-19T18:00:00+01:00",
        tags: ["zurichcv", "computer-vision", "autonomous-driving"],
        title: "ZurichCV #6",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-6",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Jonas Hübotter** from ETH Zurich on **Efficiently Learning at Test-Time with LLMs**:\nThe standard paradigm of machine learning separates training and testing. Training aims to learn a model by inductively extracting general rules from data, and testing applies this model to new, unseen data. We investigate an alternative transductive paradigm where the model is fine-tuned at test-time specifically to the given task. Our evaluation on the Pile dataset indicates that this paradigm can improve language modeling on a wide range of tasks. We identify the key challenge of deciding which data to select for test-time fine-tuning and show that the previously used Nearest Neighbor retrieval is ill-suited since it tends to select redundant data. To address this, we introduce SIFT, a data selection algorithm designed to reduce uncertainty about the model's response given a prompt, which unifies ideas from retrieval and active learning. Whereas Nearest Neighbor retrieval typically fails in the presence of information duplication, SIFT accounts for information duplication and optimizes the overall information gain of the selected examples.\n\n**Imanol Schlag** from ETH Zurich on **The Swiss AI LLM Effort: Building Transparent and Responsible AI for Switzerland and Beyond**:\n\nThis talk will present the Swiss AI Large Language Model (LLM) Effort, a collaborative initiative led by ETH Zurich and EPFL. We aim to develop a 70B parameter LLM trained on 10+ trillion high-quality, multilingual tokens, with a focus on transparency, ethical alignment, and support for Swiss national languages. We'll share technical insights into our training approach on the Alps supercomputer, including our strategies for efficient scaling across thousands of GH200 GPUs. Our commitment to open science and legal compliance forms the foundation for disseminating AI technology across Swiss academia and industry. We'll discuss how this effort can drive innovation in various sectors, exemplified by projects like Meditron for healthcare and Ethel for education while providing a strong general-purpose AI foundation for Switzerland.",
        summary:
            "Jonas Hübotter and Imanol Schlag from ETH Zurich on learning at test time and Swiss sovereign AI.",
        endsAt: "2024-12-03T20:00:00+01:00",
        slug: "zurichnlp-14",
        source: "zurichai.ch",
        sourceId: "420c3dd1-b6ce-493f-8580-d87a3e12042d",
        speakers: [
            { name: "Jonas Hübotter", title: "ETH Zurich" },
            { name: "Imanol Schlag", title: "ETH Zurich" },
        ],
        startsAt: "2024-12-03T18:00:00+01:00",
        tags: ["zurichnlp", "nlp", "language-models"],
        title: "ZurichNLP #14",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-14",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "Open-vocabulary 3D scene understanding unlocks the ability to explore and interact with 3D environments using free-form language descriptions. This is achieved by leveraging the knowledge of vision-language models to bridge the gap between language and 3D perception. In this talk, we will explore recent advancements in this field and highlight potential applications in augmented reality and robotics.",
        summary: "Ayca Takmaz on open-vocabulary 3D scene understanding.",
        endsAt: "2025-01-23T20:00:00+01:00",
        slug: "zurichcv-7",
        source: "zurichai.ch",
        sourceId: "2ea8a8b7-04bb-471c-a81e-30e4e2495add",
        speakers: [{ name: "Ayca Takmaz", title: "ETH Zurich" }],
        startsAt: "2025-01-23T18:00:00+01:00",
        tags: ["zurichcv", "computer-vision", "3d"],
        title: "ZurichCV #7",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-7",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Matej Jusup: Mastering Board Games by External and Internal Planning with Language Models**\n\nThis talk showcases the ability of Large Language Models (LLMs) to achieve advanced strategic planning in complex domains (Chess, Chess960, Hex, and Connect Four). We focus on reaching Grandmaster-level performance in chess while operating closer to the human search budget. To achieve this goal, we introduce, compare, and contrast two major approaches: In external search, our LLM guides Monte Carlo Tree Search rollouts and evaluations without calls to an external game engine, and in internal search, LLM is trained to generate in-context a linearized tree of search and a resulting final choice.\n\n**Bobby He: Outlier Features in LLMs: what are they, why do they matter, and how can we prevent them?**\nOutlier Features (OFs) are widely documented to emerge in LLM training and have the undesirable effect of hindering quantisation, and ensuing efficiency gains, in afflicted models. Despite their practical importance, little is known about OFs: are they a regrettable necessity, or simply a consequence of suboptimal design choices? In this talk we'll show the latter, by identifying key architectural and optimiser choices that lead to OFs and presenting alternative options that mitigate them, without compromising training convergence.",
        summary:
            "Matej Jusup from the ETH AI Center on mastering board games and Bobby He from the University of Oxford on understanding outlier features.",
        endsAt: "2025-02-20T20:00:00+01:00",
        slug: "zurichnlp-15",
        source: "zurichai.ch",
        sourceId: "3e1c325e-5e4b-4449-86f1-9d7c482b79e8",
        speakers: [
            { name: "Matej Jusup", title: "ETH AI Center" },
            { name: "Bobby He", title: "University of Oxford" },
        ],
        startsAt: "2025-02-20T18:00:00+01:00",
        tags: ["zurichnlp", "nlp", "language-models"],
        title: "ZurichNLP #15",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-15",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Xi Wang on** **Egocentric Learning**: Predicting the Future from a First-Person Perspective\n\nResearch in artificial intelligence continues to advance rapidly, outperforming humans in many tasks and integrating into our daily lives. However, despite their superior performance, current technologies face limitations in perceiving, processing, and understanding our visual world, particularly when it comes to understanding and interacting with people. These challenges raise the core question of my research: How do we build intelligent systems that can interact with people and offer assistance in a natural and seamless way? In this talk, I will present our work on making predictions in egocentric videos.\n\n**Nikolai Kalischek on CubeDiff**: Repurposing Diffusion-Based Image Models for Panorama Generation\nWe introduce a novel method for generating 360° panoramas from text prompts or images. Our approach leverages recent advances in 3D generation by employing multi-view diffusion models to jointly synthesize the six faces of a cubemap. Unlike previous methods that rely on processing equirectangular projections or autoregressive generation, our method treats each face as a standard perspective image, simplifying the generation process and enabling the use of existing multi-view diffusion models. We demonstrate that these models can be adapted to produce high-quality cubemaps without requiring correspondence-aware attention layers. Our model allows for fine-grained text control, generates high resolution panorama images and generalizes well beyond its training set, whilst achieving state-of-the-art results, both qualitatively and quantitatively.",
        summary:
            "Xi Wang on egocentric learning and Nikolai Kalischek on diffusion-based panorama generation.",
        endsAt: "2025-02-24T20:00:00+01:00",
        slug: "zurichcv-8",
        source: "zurichai.ch",
        sourceId: "7920ccda-9721-4044-8b0d-d2f1069933a1",
        speakers: [{ name: "Xi Wang" }, { name: "Nikolai Kalischek", title: "ETH Zurich" }],
        startsAt: "2025-02-24T18:00:00+01:00",
        tags: ["zurichcv", "computer-vision", "diffusion"],
        title: "ZurichCV #8",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-8",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Linus Scheibenreif** (Photogrammetry and Remote Sensing Lab, ETH Zurich): Self-Supervised Learning for Remote Sensing\n\nDeep learning methods are commonly used for the interpretation of satellite remote sensing data. However, labeled datasets for many important remote sensing tasks are small, while large archives of unlabeled imagery exist. This motivates the use of self-supervised learning techniques in the remote sensing domain. Self-supervised learning and resolution geospatial foundation models promise to facilitate training of deep neural networks on remote sensing data and to improve performance on downstream tasks. This talk will give an overview of current approaches and challenges of self-supervised learning in  remote sensing.\n\n**Pascal Chang** (ETH Zurich/Disney Research): LookingGlass: Generative Anamorphoses via Laplacian Pyramid Warping\n\nIn this talk, we revisit the classical concept of anamorphosis—images that appear distorted and only reveal their true form from a specific viewpoint—through the lens of generative modeling. We present a method based on latent rectified flow models and introduce Laplacian Pyramid Warping, a frequency-aware image warping technique crucial for producing high-quality results. Our approach enables the creation of anamorphic images that not only reveal surprising hidden content when seen from the right angle but also retain a meaningful and coherent interpretation when viewed directly.",
        summary:
            "Linus Scheibenreif from ETH Zurich on self-supervised learning for satellite imagery and Pascal Chang from ETH Zurich and Disney Research on visual anagram generation.",
        endsAt: "2025-04-29T20:00:00+02:00",
        slug: "zurichcv-9",
        source: "zurichai.ch",
        sourceId: "68554d44-73aa-487f-8304-e7c9539e90e7",
        speakers: [
            { name: "Linus Scheibenreif", title: "ETH Zurich" },
            { name: "Pascal Chang", title: "ETH Zurich and Disney Research" },
        ],
        startsAt: "2025-04-29T18:00:00+02:00",
        tags: ["zurichcv", "computer-vision", "diffusion", "satellite-imagery"],
        title: "ZurichCV #9",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-9",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**[Ivan Vulić ](https://sites.google.com/corp/site/ivanvulic/)(University of Cambridge/Google DeepMind): Guiding Vision-Language Models to Climb the Mountain of Spatial Reasoning**\n\nLarge Vision-Language Models (VLMs) have demonstrated impressive performance in general vision-language tasks. However, even the most recent and most powerful VLMs still struggle even with simple spatial understanding and reasoning capabilities. In this talk, I will first provide a brief overview of our recent work on creating new benchmarks and improving evaluation of VLMs for a range of spatial reasoning tasks. I will then outline our novel methodology related to enhancing spatial reasoning capabilities of VLMs, with a focus on spatial navigation tasks, such as multi-modal visualization-of-thought and purely visual planning.\n\n**[Tiago Pimentel](https://tpimentelms.github.io/) (ETH Zurich): Duplicating Vocabularies to Analyse Generalisation in Language Models**\n\nIn this talk, we will explore how duplicating a language model’s vocabulary can create controlled experiments, which we can leverage to address two research questions. First, we use vocabulary duplication to investigate lexical generalisation in LMs, looking at the effect of near duplicate subwords (e.g., vocabulary items such as Now and now) in an LM's performance. Second, we will analyse cross-linguistic generalisation, investigating how cross-linguistic data (im)balance affects performance LMs' performance.",
        summary:
            "Ivan Vulić from the University of Cambridge and Google DeepMind on vision-language models for spatial reasoning and Tiago Pimentel from ETH Zurich on generalisation in language models.",
        endsAt: "2025-05-21T20:00:00+02:00",
        slug: "zurichnlp-16",
        source: "zurichai.ch",
        sourceId: "457947ac-7f4d-42c8-a942-29433e7f98ff",
        speakers: [
            { name: "Ivan Vulić", title: "University of Cambridge and Google DeepMind" },
            { name: "Tiago Pimentel", title: "ETH Zurich" },
        ],
        startsAt: "2025-05-21T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "vision-language-models"],
        title: "ZurichNLP #16",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-16",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Aleksander Ficek (NVIDIA): Synthetic Generators and Verifiers for Coding**\n\n**Matteo Saponati (ETH Zurich): Structure of Self-Attention Beyond Queries and Keys**\n\nSelf-attention is essential to Transformer architectures, yet how information is embedded in the self-attention matrices and how different objective functions impact this process remains unclear. We present a mathematical framework to analyze self-attention matrices by deriving the structures governing their weight updates. Using this framework, we demonstrate that bidirectional training induces symmetry in the weight matrices, while autoregressive training results in directionality and column dominance. Our theoretical findings are validated across multiple Transformer models - including ModernBERT, GPT, LLaMA3, and Mistral - and input modalities like text, vision, and audio. Finally, we apply these insights by showing that symmetric initialization improves the performance of encoder-only models on language tasks. This mathematical analysis offers a novel theoretical perspective on how information is embedded through self-attention, thereby improving the interpretability of Transformer models.",
        summary:
            "Aleksander Ficek from NVIDIA on synthetic generators and verifiers for coding and Matteo Saponati from ETH Zurich on the structures of self-attention.",
        endsAt: "2025-06-17T20:00:00+02:00",
        slug: "zurichnlp-17",
        source: "zurichai.ch",
        sourceId: "65434f32-b4a7-4361-98e5-d9e075d303d4",
        speakers: [
            { name: "Aleksander Ficek", title: "NVIDIA" },
            { name: "Matteo Saponati", title: "ETH Zurich" },
        ],
        startsAt: "2025-06-17T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "programming", "transformers"],
        title: "ZurichNLP #17",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-17",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**[Felix Wimbauer](https://fwmb.github.io/)** (Technical University of Munich/Google): Learning to Understand the 3D World from Large-Scale Video Datasets\n\nFelix will cover three of his works (MonoRec, BehindTheScenes, S4C) for understanding 3D scenes from video data, highlighting approaches that shift from traditional supervised learning to more data-efficient, self-supervised techniques. Each method addresses the common challenges of estimating depth, handling dynamic objects, and synthesizing new views, all while working with minimal labeled data. These techniques share a focus on leveraging large video datasets to improve depth prediction, semantic segmentation, and camera motion estimation without relying on specialized sensors. Building on that, he will present his recent CVPR 2025 paper AnyCam, which builds on these principles by estimating camera motion and scene geometry from casual videos, aiming for more reliable performance in diverse environments.\n\n**[Joan Puigcerver ](https://www.jpuigcerver.net/)**(Google DeepMind): Scaling Computer Vision: Transformers and Sparse Mixture-of-Experts Models\n\nThe field of Computer Vision shifted from ad-hoc models trained on a few thousands of examples, to more general models trained on large and diverse datasets, able to solve many tasks. We will review how Transformers have been a fundamental part of this shift, both in Computer Vision and Natural Language Processing, and more recently Sparse Mixture-of-Experts (MoE) enabled to further increase the model capacity without increasing the training or evaluation time complexity. We will explore different types of MoE models, and discuss some particularities of vision models compared to language models.",
        summary:
            "Felix Wimbauer from the Technical University of Munich and Google on understanding the 3D world from videos, and Joan Puigcerver from Google DeepMind on scaling computer vision architectures.",
        endsAt: "2025-08-07T20:00:00+02:00",
        slug: "zurichcv-10",
        source: "zurichai.ch",
        sourceId: "5d2e1200-cee4-4827-80ea-35de2f1f2d29",
        speakers: [
            { name: "Felix Wimbauer", title: "Technical University of Munich and Google" },
            { name: "Joan Puigcerver", title: "Google DeepMind" },
        ],
        startsAt: "2025-08-07T18:00:00+02:00",
        tags: ["zurichcv", "computer-vision", "3d"],
        title: "ZurichCV #10",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-10",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "After two years and over 25 events of NLP and CV we are finally launching our Robotics series! We have many exciting topics and speakers in the pipeline here, thank you for all your patience and support. For the first one:\n\n**Barnabas Gavin Cangan (ETHZ): Why Robot Hands are Hard: A Hands-On Perspective on Dexterous Manipulation**\nDexterous manipulation is a central challenge in robotics and embodied AI. Despite decades of progress, replicating the adaptability and sensory richness of the human hand remains elusive. In this talk, I will discuss the current state of the art in dexterous manipulation from two perspectives: the design and durability of robotic hands, and the use of learning-based methods for control. Drawing on our experiences in surgical robotics, I will share insights from building hardware for dexterous manipulation as well as lessons learned from applying learning-based approaches in practice. These perspectives highlight both the promise and the limits of current methods, and point toward where future progress may lie.\n\n**Caterina Caccavella (ZHAW, ETHZ): Bio-Inspired Active Sensing for Scene Understanding**\nConventional robotic perception often depends on large deep neural networks (DNNs), which are costly to deploy, slow to adapt, and prone to overconfidence. Most approaches also rely on passive datasets, overlooking the crucial perception–action coupling needed for real-world adaptability. We provide examples of how biology can inspire artificial systems that are not only more efficient but also more adaptable and reliable in complex, ever-changing environments. Inspired by biology, we propose an active perception strategy that maintains a coarse, continuously updated map of the environment and selectively focuses on the most relevant regions. Attention arises through bottom-up cues and competition via Dynamic Neural Fields (DNFs), while top-down mechanisms prevent repeated fixations and guide exploration based on task or uncertainty. This approach reduces reliance on exhaustive scene processing and large passive networks, leading to more efficient, adaptive, and reliable systems for dynamic environments.",
        summary:
            "Barnabas Gavin Cangan from ETH Zurich on robot hands and Caterina Caccavella from ZHAW and ETH Zurich on bio-inspired active sensing.",
        endsAt: "2025-09-24T20:00:00+02:00",
        slug: "zurichrobotics-1",
        source: "zurichai.ch",
        sourceId: "9e796faf-f3dd-4778-b704-dda22c2ee620",
        speakers: [
            { name: "Barnabas Gavin Cangan", title: "ETH Zurich" },
            { name: "Caterina Caccavella", title: "ZHAW and ETH Zurich" },
        ],
        startsAt: "2025-09-24T18:00:00+02:00",
        tags: ["zurichrobotics", "robotics", "manipulation", "sensing"],
        title: "ZurichRobotics #1",
        sourceUrl: "https://www.zurichai.ch/events/zurichrobotics-1",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**NOTE: This event is fully booked. Registration will be checked for entry!**\n\nWe're honoured to host an original legend in the field of machine learning: **Prof. Jürgen Schmidhuber**. Jürgen has pioneered and advanced many techniques that are foundational to modern AI:\n\nJürgen led groups at TUM and IDSIA which developed the foundations of today’s most-cited neural nets, e.g., LSTM (1997, most-cited AI of the 20th century), Highway Network (2015 - its later variant ResNet became the most-cited AI of the 21st), DanNet (2011 - the first deep GPU CNN to win image-recognition competitions, before AlexNet/VGG!); Generative Adversarial Network (1990, for Artificial Curiosity), unnormalized linear Transformer (1991). The core ideas behind GANs, Transformers, pre-training, and neural distillation can all be traced to his lab's work.\n\nNote: We're on the **19th floor** this time for extra seating capacity, not the usual 14th.",
        summary: "Jürgen Schmidhuber on the past, present, and future of AI.",
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
            "**[Paul-Edouard Sarlin](https://psarlin.com/): Learning to Guide Geometry: From 3D Reconstruction to Global Localization**\n\n**[Nando Metzger](https://nandometzger.github.io/): Guided Solutions to Ill-posed Problems: High-resolution Population and Depth Maps**\n\n**NOTE: Floor changed to 19th floor!**",
        summary:
            "Paul-Edouard Sarlin from Google on 3D reconstruction for localization and Nando Metzger from ETH Zurich on high-resolution maps.",
        endsAt: "2025-11-20T20:00:00+01:00",
        slug: "zurichcv-11",
        source: "zurichai.ch",
        sourceId: "06650402-8262-45eb-af60-56bcdc2ee501",
        speakers: [
            { name: "Paul-Edouard Sarlin", title: "Google" },
            { name: "Nando Metzger", title: "ETH Zurich" },
        ],
        startsAt: "2025-11-20T18:00:00+01:00",
        tags: ["zurichcv", "computer-vision", "3d", "mapping"],
        title: "ZurichCV #11",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-11",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "**Philippe Bich (Huawei)**: **SINQ: Sinkhorn-Normalized Quantization for calibration-free low-precision LLM weights**\n\nQuantization is a key technique for making Large Language Models (LLMs) and Vision-Language Models (VLMs) faster and less memory-demanding, but maintaining accuracy at low precision remains challenging. Outlier weights often dominate shared scales, leading to large errors and degraded performance. We introduce SINQ, our novel open-source approach that makes post-training quantization both simpler and more accurate.\n\nSINQ adds a second normalization axis and applies a fast Sinkhorn-Knopp-style algorithm to balance per-row and per-column variances in weight matrices. Tested on Qwen3 and DeepSeek-V2.5, SINQ improves perplexity on WikiText2 and C4 benchmarks without calibration data or model-specific tuning. It can quantize billion-parameter models in just a few seconds while achieving accuracy comparable to, or better than, existing methods.\n\n**Alejandro Hernández Cano (EPFL)**:\n\nApertus is a fully open suite of large language models (LLMs) designed to address two systemic shortcomings in today's open model ecosystem: data compliance and multilingual representation. Unlike many prior models that release weights without reproducible data pipelines or regard for content-owner rights, Apertus models are pretrained exclusively on openly available data and filtering for non-permissive, toxic, and personally identifiable content. The Apertus models also expand multilingual coverage, training on 15T tokens from over 1800 languages, with ~40% of pretraining data allocated to non-English content. Released at 8B and 70B scales, Apertus approaches state-of-the-art results among fully open models on multilingual benchmarks, rivalling or surpassing open-weight counterparts.",
        summary:
            "Philippe Bich from Huawei on calibration-free low-precision LLMs and Alejandro Hernandez Cano from EPFL on Apertus, the Swiss open LLM.",
        endsAt: "2025-11-24T20:00:00+01:00",
        slug: "zurichnlp-18",
        source: "zurichai.ch",
        sourceId: "8a604720-393d-43cc-a328-90f7b998e5b5",
        speakers: [
            { name: "Philippe Bich", title: "Huawei" },
            { name: "Alejandro Hernandez Cano", title: "EPFL" },
        ],
        startsAt: "2025-11-24T18:00:00+01:00",
        tags: ["zurichnlp", "nlp", "language-models", "apertus"],
        title: "ZurichNLP #18",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-18",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Antonio Arbues (Loki Robotics): Loki: Building Useful Robots in The Age of AI**\n\nIn a time of shiny robot demos, building useful robots is the real challenge. This talk is about how at Loki Robotics we are approaching the problem of building robots that handle all the manual background work required to keep facilities functional. I will dive deep into the challenges of deploying robots in the real world, how a full-stack approach is key to building something really useful, how a teleoperation-first approach enables small teams to build the right thing, and how we are taking decisions to leverage the coming wave of AI as an enabler for scalability.\n\n**Giacomo Manzoni (Hexagon): A Gentle Introduction to Imitation Learning for Dexterous Manipulation**\nA comprehensive and accessible introduction to learning-based methods for dexterous robotic manipulation. We start by motivating the need for learning in this domain, then we will introduce imitation learning as one of the most prominent and practical frameworks. We will then dive into a technical analysis of some of the most widespread models like diffusion policies, flow-based models, and VLAs, collecting insightful ideas from academia while highlighting limitations of real-world deployment. We will task data (or rather the scarcity of it) and evaluations.",
        summary:
            "Antonio Arbues from Loki Robotics on building useful robots in the age of AI and Giacomo Manzoni from Hexagon on imitation learning for dexterous manipulation.",
        endsAt: "2025-12-15T20:00:00+01:00",
        slug: "zurichrobotics-2",
        source: "zurichai.ch",
        sourceId: "48564eb0-e3ca-43c0-a67e-f7233e94e693",
        speakers: [
            { name: "Antonio Arbues", title: "Loki Robotics" },
            { name: "Giacomo Manzoni", title: "Hexagon" },
        ],
        startsAt: "2025-12-15T18:00:00+01:00",
        tags: ["zurichrobotics", "robotics", "imitation-learning", "manipulation"],
        title: "ZurichRobotics #2",
        sourceUrl: "https://www.zurichai.ch/events/zurichrobotics-2",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Sina Ahmadi (UZH): Language beyond the Standard: NLP for Low-Resource Varieties**\n\nNLP has made remarkable progress, yet these advancements remain unevenly distributed, with low-resourced languages still significantly underserved. This talk explores how we can broaden the scope of language technologies by developing computational models that effectively support languages with limited data, documentation, or digital presence. I discuss core challenges, including data scarcity, orthographic and linguistic variation as well as emerging strategies for data creation, model adaptation, and community-driven resource development. By addressing these issues, we can move toward more inclusive and equitable language technologies.\n\n**Barna Pasztor (ETH): Sample-efficient dataset collection for Reinforcement Learning from Human Feedback with active learning**\n\nIncreasing accessibility of RLHF via reducing annotation costs and identifying valuable datapoints to training reward models and DPO fine-tuning.",
        summary:
            "Sina Ahmadi from the University of Zurich on low-resource language varieties and Barna Pasztor from ETH Zurich on sample-efficient dataset collection for RLHF.",
        endsAt: "2026-01-19T20:00:00+01:00",
        slug: "zurichnlp-19",
        source: "zurichai.ch",
        sourceId: "b9b5bdf4-8211-4aca-89e4-cfd6797f5f55",
        speakers: [
            { name: "Sina Ahmadi", title: "University of Zurich" },
            { name: "Barna Pasztor", title: "ETH Zurich" },
        ],
        startsAt: "2026-01-19T18:00:00+01:00",
        tags: ["zurichnlp", "nlp", "rlhf", "low-resource-languages"],
        title: "ZurichNLP #19",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-19",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**[Zan Gojcic](https://zgojcic.github.io/) (NVIDIA): From Reconstruction and Generation to Generative Reconstruction**\n\nNeural reconstruction has traditionally focused on faithfully recovering geometry and appearance from posed real-world images, while large generative models have excelled at synthesizing realistic content beyond the constraints of captured data. Recently, this distinction has begun to blur. Neural reconstruction methods are increasingly learned on large datasets and benefit from powerful generative priors, while the advances in conditioning on sparse observations and camera control have made video generative modeling strong candidates for novel view synthesis. This raises fundamental questions: Are reconstruction and generation on the brink of convergence? Do we still need explicit scene representations? And is reconstruction ultimately a strongly conditioned generative problem?\n[Download the Slides](https://drive.google.com/drive/folders/1R9JN8LMyb4uv_mo9bPRc_q3KPyVZwS5m?usp=sharing)\n\n**[Vanessa Sklyarova](https://vanessik.github.io/) (ETH): Modeling Realistic Hairstyles for Digital Human Avatars**\nWhile 3D avatar creation has advanced rapidly, realistic hair remains a bottleneck. Current methods using meshes or implicit surfaces often lack the physical realism required for production pipelines. This talk presents a framework for physically plausible, strand-based hair modeling. I introduce methods for hair reconstruction from multi-view and monocular video, utilizing structured Gaussian splatting for high-frequency detail and synthetic priors for single-image reconstruction. Finally, I demonstrate conditional generative models that enable text-to-hair workflows, resulting in simulation-ready representations that bridge the gap between AI generation and production-grade rendering.",
        summary:
            "Zan Gojcic from NVIDIA on generative reconstruction and Vanessa Sklyarova from ETH Zurich on hairstyle modelling for avatars.",
        endsAt: "2026-01-20T20:00:00+01:00",
        slug: "zurichcv-12",
        source: "zurichai.ch",
        sourceId: "0c903e7a-f568-4b3a-bbfe-40efe5b26d49",
        speakers: [
            { name: "Zan Gojcic", title: "NVIDIA" },
            { name: "Vanessa Sklyarova", title: "ETH Zurich" },
        ],
        startsAt: "2026-01-20T18:00:00+01:00",
        tags: ["zurichcv", "computer-vision", "3d", "avatars"],
        title: "ZurichCV #12",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-12",
        venue: "eth-ai-center-19",
    },
    {
        description:
            '**Michael Neunert (Google Deepmind): Building AI agents for the physical world**\nThe realization of truly general-purpose robots relies on three fundamental capabilities: a deep understanding of the physical world, advanced reasoning, and highly dexterous control. We will explore the development and impact of two groundbreaking models: Gemini Robotics 1.5, a multi-embodiment Vision-Language-Action (VLA) model, and Gemini Robotics-ER 1.5, our state-of-the-art Embodied Reasoning (ER) model.\nWe will examine three major innovations driving this new generation of physical agents:\n - Multi-Embodiment Learning via Motion Transfer (MT): How a novel architecture allows the VLA model to learn seamlessly from heterogeneous data across different types of robotic hardware\n - "Thinking Before Acting": How interleaving actions with a multi-level internal reasoning process in natural language greatly improves a robot\'s ability to decompose complex tasks while remaining interpretable to human users.\n- State-of-the-Art Embodied Reasoning: How Gemini Robotics-ER 1.5 establishes new benchmarks in critical areas like visual and spatial understanding, task planning, and progress estimation.\n\n**Riccardo Maggioni (FORGIS): FORGIS: Building the Intelligence Layer for the Factory Floor**\n\nForgis is building the layer that makes industrial robots truly flexible, able to perform new tasks without the costly, months-long reprogramming cycle. By combining a foundation model with intelligent, transferable skills, Forgis deploys and scales robots on any production line in days instead of months.',
        summary:
            "Michael Neunert from Google DeepMind on efficient models for bringing AI into the real world and Riccardo Maggioni from FORGIS on the intelligence layer for the factory floor.",
        endsAt: "2026-03-19T20:00:00+01:00",
        slug: "zurichrobotics-3",
        source: "zurichai.ch",
        sourceId: "a2294a49-01e7-4cde-80c1-c7a0c61c87b0",
        speakers: [
            { name: "Michael Neunert", title: "Google DeepMind" },
            { name: "Riccardo Maggioni", title: "FORGIS" },
        ],
        startsAt: "2026-03-19T18:00:00+01:00",
        tags: ["zurichrobotics", "robotics", "efficient-models", "industrial-automation"],
        title: "ZurichRobotics #3",
        sourceUrl: "https://www.zurichai.ch/events/zurichrobotics-3",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "**Fabian Schaipp (Inria): All Quiet on the Optimization Front? Recent Trends in Training Algorithms for ML**\n\nFine-tuned training recipes remain a core challenge for crafting state-of-the-art machine learning models. In this talk, we will give an overview of recent developments around optimization and training algorithms. In particular, this will cover (i) new optimization methods (Muon, SOAP, ...) challenging the reign of AdamW and (ii) hyperparameter tuning and scaling laws (learning-rates and schedules, muP, ...) for efficient training at scale.\n\n**Valentina Pyatkin (Allen Institute, ETH): Open LLM Post-Training: Lessons from Training Olmo and Tülu**\n\nDrawing on the OLMo and Tülu projects, which openly release not just model weights but data, code, and training decisions, this talk shares lessons about what works, what doesn't, and what we still don't understand about the post-training of language models.",
        summary:
            "Fabian Schaipp from Inria on training algorithms for machine learning and Valentina Pyatkin from the Allen Institute and ETH Zurich on training open-source LLMs.",
        endsAt: "2026-04-01T20:00:00+02:00",
        slug: "zurichnlp-20",
        source: "zurichai.ch",
        sourceId: "536061f8-a5b2-4929-9bbf-a139e8044fed",
        speakers: [
            { name: "Fabian Schaipp", title: "Inria" },
            { name: "Valentina Pyatkin", title: "Allen Institute and ETH Zurich" },
        ],
        startsAt: "2026-04-01T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "language-models", "training"],
        title: "ZurichNLP #20",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-20",
        venue: "eth-ai-center-19",
    },
    {
        description:
            "**Francis Engelmann (Assistant Professor, USI): Thinking Shapes: Superquadric Representations for World Models**\n\n**Korrawe Karunratanakul (Motion Generation Lead, Flexion): Diffusion + RL for Humanoid: Navigating Diffusion Prior for Versatile Character Control**",
        summary:
            "Francis Engelmann from USI on superquadric representations for world models and Korrawe Karunratanakul from Flexion on versatile character control.",
        endsAt: "2026-04-16T20:00:00+02:00",
        slug: "zurichcv-13",
        source: "zurichai.ch",
        sourceId: "31309fc3-126b-45b9-a0b7-e351dd1c03f5",
        speakers: [
            { name: "Francis Engelmann", title: "Assistant Professor, USI" },
            { name: "Korrawe Karunratanakul", title: "Motion Generation Lead, Flexion" },
        ],
        startsAt: "2026-04-16T18:00:00+02:00",
        tags: ["zurichcv", "computer-vision", "world-models", "character-control"],
        title: "ZurichCV #13",
        sourceUrl: "https://www.zurichai.ch/events/zurichcv-13",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Seif Ismail (Founding Engineer, Watney Robotics): Conway's Law in Robotics**\nOver the past two years building and deploying robots at Watney, we arrived at a set of counterintuitive lessons that fundamentally reshaped how we think about robot systems. Deployability and scalability became the driving principles behind every technical and organizational decision: hardware architectures optimized for serviceability, software systems prioritized simplicity, robustness, and generalizability over novelty and operations evolved into a first-class engineering discipline rather than an afterthought. Deploying useful robots requires complete alignment at all company levels, and the real-world constraints that come with it paradoxically produce better research and engineering outcomes. Drawing from concrete deployment experiences, this talk argues that the future of scalable robotics will not be determined solely by breakthroughs in model capability or hardware sophistication, but by organizations capable of aligning every function—from engineering to operations—around the realities of deployment.\n\n**Victor Klemm (PhD, ETH Zurich): Robots with Legs, Wheels, and Arms: Controlling and Designing Robots at RSL that move purposefully**\n\nLegged, wheeled, and manipulating robots are increasingly capable of operating in complex, real-world environments. This talk presents research from the Robotic Systems Lab (RSL) at ETH Zürich on the development of robots that combine locomotion and manipulation. Over the past years, the field has undergone a profound paradigm shift: learning-based methods, trained at massive scale in simulation, have replaced many classical control pipelines and unlocked levels of robustness and agility that were previously out of reach. Simulation and massive parallelization have become central in this process, rendering challenges in bridging the gap between simulation and reality increasingly important.",
        summary:
            "Seif Ismail from Watney Robotics on Conway's Law in robotics and Victor Klemm from ETH Zurich on designing robots with legs, wheels, and arms.",
        endsAt: "2026-05-21T20:00:00+02:00",
        slug: "zurichrobotics-4",
        source: "zurichai.ch",
        sourceId: "d3a0b9dc-9d4e-4251-9578-72e00c7d4818",
        speakers: [
            { name: "Seif Ismail", title: "Founding Engineer, Watney Robotics" },
            { name: "Victor Klemm", title: "PhD, ETH Zurich" },
        ],
        startsAt: "2026-05-21T18:00:00+02:00",
        tags: ["zurichrobotics", "robotics", "robot-design", "manipulation"],
        title: "ZurichRobotics #4",
        sourceUrl: "https://www.zurichai.ch/events/zurichrobotics-3-1-1",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Jannis Vamvas (University of Zurich): LLMs and the Challenge of Romansh**\nOne language of Switzerland – Romansh – poses a challenge: Even the few LLMs that understand it are not good at speaking it, because they are unaware of its different varieties. This talk presents how we created the first variety-aware Romansh machine translation system, burning through thousands of dollars in API credits along the way – and why authentic, human-written text remains the gold standard in the age of LLMs.\n\n**Eric Chen (EPFL): Reasoning as Test-Time Learning**",
        summary:
            "Jannis Vamvas from the University of Zurich on the challenge of Romansh and Eric Chen from EPFL on reasoning as test-time learning.",
        endsAt: "2026-06-08T20:00:00+02:00",
        slug: "zurichnlp-21",
        source: "zurichai.ch",
        sourceId: "25dece0e-b160-4b52-9760-e86040e712e6",
        speakers: [
            { name: "Jannis Vamvas", title: "University of Zurich" },
            { name: "Eric Chen", title: "EPFL" },
        ],
        startsAt: "2026-06-08T18:00:00+02:00",
        tags: ["zurichnlp", "nlp", "romansh", "reasoning"],
        title: "ZurichNLP #21",
        sourceUrl: "https://www.zurichai.ch/events/zurichnlp-21",
        venue: "eth-ai-center-14",
    },
    {
        description:
            "**Haithem Turki (Senior Research Scientist, NVIDIA): Photoreal Worlds at Scale – From Capture to Generation**\n\nNeural reconstruction and generative video modeling have evolved in parallel: the former focused on faithfully recovering photoreal 3D scenes from real-world sensors, the latter on synthesizing plausible content at internet scale. Recently, the boundary between them has begun to blur. Per-scene reconstruction is bounded by what was observed, motivating generative priors to fill in unseen regions, while large video models — strong on plausibility but lacking explicit geometry — are increasingly conditioned on 3D scaffolding to enforce spatial consistency. This talk walks through three recent works at this intersection, and asks: How should explicit 3D representations handle real sensor complexity? Where do generative priors fit without overwriting what was captured? And is throwing more parameters at 3D foundation models really the answer?\n\n**Omar Sanseviero (Google DeepMind): Gemma, DeepMinds's family of open models**\nRunning open-weights models entirely locally tackles data privacy, latency, and cloud cost issues, but it requires extreme efficiency. In this session, we explore the design philosophy behind Google's Gemma 4, focusing on how we pushed the boundaries of intelligence per parameter for edge hardware. Beyond just running the model, we'll look under the hood at the model quantization, hardware optimization, and architectural decisions required to build high-performance, on-device AI.",
        summary:
            "Haithem Turki from NVIDIA on photorealistic world models and Omar Sanseviero from Google DeepMind on the open Gemma model family.",
        endsAt: "2026-06-30T20:00:00+02:00",
        slug: "zurichcv-14",
        source: "zurichai.ch",
        sourceId: "f883221f-d16a-4945-b830-dfc89ca644fa",
        speakers: [
            { name: "Haithem Turki", title: "Senior Research Scientist, NVIDIA" },
            { name: "Omar Sanseviero", title: "Google DeepMind" },
        ],
        startsAt: "2026-06-30T18:00:00+02:00",
        tags: ["zurichcv", "computer-vision", "world-models", "gemma"],
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

        // require complete public copy without source markup
        if (event.summary.trim().length === 0 || event.description.trim().length === 0) {
            throw new Error(`Archive event ${event.slug} is missing public copy.`);
        }
        if (/<\/?[a-z][^>]*>/i.test(event.description) || /\bTBD\b/i.test(event.description)) {
            throw new Error(`Archive event ${event.slug} has unfinished public copy.`);
        }

        // require one valid chronological range
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

    // require every canonical numbered event and its grouping tag
    for (const sequence of numberedEvents) {
        for (let number = 1; number <= sequence.count; number += 1) {
            const slug = `${sequence.tag}-${number}`;
            const event = archiveEvents.find((candidate) => candidate.slug === slug);
            if (
                event?.title !== `${sequence.title} #${number}` ||
                !event.tags.includes(sequence.tag)
            ) {
                throw new Error(`Archive event ${slug} is invalid.`);
            }
        }
    }

    // require exactly the numbered archive and one special event
    const numberedCount = numberedEvents.reduce((count, sequence) => count + sequence.count, 0);
    const special = archiveEvents.find((event) => event.slug === schmidhuberSlug);
    if (archiveEvents.length !== numberedCount + 1 || special === undefined) {
        throw new Error(
            "The archive must contain every numbered event and the Schmidhuber special.",
        );
    }
}
