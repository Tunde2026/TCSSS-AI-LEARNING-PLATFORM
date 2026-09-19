// System prompt used only for quiz generation.
// The gateway uses this instead of the default tutor prompt.

function buildQuizPrompt({ topic, count, difficulty, subject }) {
  const subj = subject ? `Subject: ${subject}` : '';
  return `You are a quiz generator for secondary-school students.

Generate exactly ${count} multiple-choice questions.
Topic: ${topic}
Difficulty: ${difficulty}
${subj}

Return ONLY valid JSON. No markdown, no code fences, no commentary before or after.

JSON schema (exact shape):
{
  "title": "short descriptive title",
  "questions": [
    {
      "question": "the question text",
      "options": [
        { "label": "A", "text": "option text" },
        { "label": "B", "text": "option text" },
        { "label": "C", "text": "option text" },
        { "label": "D", "text": "option text" }
      ],
      "correct": "A",
      "explanation": "one or two sentences explaining why the correct answer is right"
    }
  ]
}

Rules:
- Every question must have exactly 4 options labeled A, B, C, D.
- Exactly one option is correct.
- The "correct" field must be one of "A", "B", "C", "D".
- Explanations must be clear and brief.
- Questions must be unambiguous and factually correct.
- Do not include any text outside the JSON object.`;
}

module.exports = { buildQuizPrompt };