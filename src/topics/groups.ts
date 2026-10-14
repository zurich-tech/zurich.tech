/** Present related interests together; content editing still uses the complete topic catalogue. */
export const interestGroups = [
    {
        name: "AI",
        topics: ["robotics", "reinforcement-learning", "nlp", "computer-vision", "agents"],
    },
    {
        name: "Technology",
        topics: [
            "hardware",
            "electronics",
            "software-engineering",
            "data-engineering",
            "graphics",
            "security",
        ],
    },
    {
        name: "People & society",
        topics: ["ai-policy", "climate-tech", "biotech", "product-design", "startups"],
    },
];

export const excludedInterests = ["machine-learning", "distributed-systems", "community"];
