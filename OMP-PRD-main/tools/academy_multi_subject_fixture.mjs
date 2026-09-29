/* QA fixture ONLY. Never included in the public catalogue or deployed lessons. */
export function multiSubjectFixture(seed) {
  const data = structuredClone(seed);
  const id = (n) => `80000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  data.categories.push(
    {
      id: id(10),
      slug: "programming",
      name: "Programming",
      description: "Learn to write, understand and improve programs.",
      sort_order: 1,
      is_active: true,
    },
    {
      id: id(20),
      slug: "design",
      name: "Design",
      description: "Build clear, useful interfaces around people's needs.",
      sort_order: 2,
      is_active: true,
    },
  );
  for (const [n, category, slug, name, language] of [
    [100, 10, "python-fundamentals", "Python Fundamentals", "python"],
    [
      200,
      10,
      "javascript-fundamentals",
      "JavaScript Fundamentals",
      "javascript",
    ],
    [300, 20, "interface-design", "Interface Design", null],
  ]) {
    data.paths.push({
      id: id(n),
      category_id: id(category),
      slug,
      name,
      description: `A focused introduction to ${name}.`,
      audience: "Beginners learning this subject for the first time.",
      difficulty: "Beginner",
      prerequisites: ["Comfort using a computer."],
      outcomes: [`Explain and apply the basics of ${name}.`],
      next_steps:
        "Review the exercises, then compare another course in this subject.",
      is_start_here: n !== 200,
      sort_order: n,
      status: "published",
    });
    data.modules.push({
      id: id(n + 1),
      path_id: id(n),
      category_id: id(category),
      slug: "getting-started",
      name: `Getting started with ${name}`,
      description: "Learn the core ideas before practicing independently.",
      outcome: `Create a simple ${language ? "program" : "interface sketch"} and explain your choices.`,
      sort_order: 0,
      status: "published",
    });
    for (const [offset, lessonSlug] of [
      [2, "introduction"],
      [3, "practice-basics"],
    ]) {
      data.topics.push({
        id: id(n + offset),
        path_id: id(n),
        module_id: id(n + 1),
        category_id: id(category),
        slug: lessonSlug,
        name: offset === 2 ? "Introduction" : `Practice ${name}`,
        description: `Understand the essential ideas in ${name} through a worked example and an exercise.`,
        difficulty: "Beginner",
        estimated_minutes: 15,
        sort_order: offset,
        status: "published",
        content: {
          sections: [
            {
              id: "overview",
              title: "What you’ll learn",
              blocks: [
                {
                  type: "paragraph",
                  text: `This lesson belongs to ${name}, not another subject's curriculum.`,
                },
              ],
            },
            {
              id: "examples",
              title: "A worked example",
              blocks: language
                ? [
                    {
                      type: "code",
                      language,
                      text:
                        language === "python"
                          ? 'message = "Hello, learner"\nprint(message)\n# <script>window.injection = true</script>'
                          : 'const message = "Hello, learner";\nconsole.log(message);',
                    },
                  ]
                : [
                    {
                      type: "list",
                      items: [
                        "Identify the user's main task.",
                        "Sketch one clear action.",
                      ],
                    },
                  ],
            },
            {
              id: "exercise",
              title: "Try it yourself",
              blocks: [
                {
                  type: "paragraph",
                  text: "Change the example, observe the result and explain why it works.",
                },
              ],
            },
          ],
          references: [
            language === "python"
              ? "https://docs.python.org/3/tutorial/"
              : language === "javascript"
                ? "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"
                : "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility",
          ],
          practice_guidance:
            "Use your own practice environment. Follow the resource’s instructions; code examples on this page do not execute.",
        },
      });
      data.labs.push({
        id: id(n + offset + 10),
        topic_id: id(n + offset),
        title: `Practice ${name}`,
        description: "Follow the worked example and try the suggested changes.",
        provider: "Learning resource",
        url:
          language === "python"
            ? "https://docs.python.org/3/tutorial/"
            : language === "javascript"
              ? "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"
              : "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility",
        sort_order: 0,
        is_active: true,
      });
    }
  }
  return data;
}
