function buildPracticePrompt({ topic, count, difficulty, subject }) {
  const subj = subject ? `Subject: ${subject}` : '';
  return `You are a practice-question generator for secondary-school students.

Generate exactly ${count} open-ended practice questions.
Topic: ${topic}
Difficulty: ${difficulty}
${subj}

Return ONLY valid JSON. No markdown, no code fences, no commentary.

JSON schema (exact shape):
{
  "title": "short descriptive title",
  "questions": [
    {
      "question": "the question",
      "answer": "the full worked answer or explanation",
      "hint": "one short sentence to nudge the student"
    }
  ]
}

Rules:
- Each question must be answerable in a paragraph, not multiple choice.
- Answers must be complete and correct, showing reasoning where relevant.
- Hints must not give away the answer.
- Content must be factually correct and level-appropriate.
- Do not include any text outside the JSON object.`;
}

module.exports = { buildPracticePrompt };