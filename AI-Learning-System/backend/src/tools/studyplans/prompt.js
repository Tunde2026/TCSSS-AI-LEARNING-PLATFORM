function buildStudyPlanPrompt({ topic, days, subject, examDate }) {
  const subj = subject ? `Subject: ${subject}` : '';
  const exam = examDate ? `Target exam/date: ${examDate}` : '';
  return `You are a study-plan generator for secondary-school students.

Create a ${days}-day study plan for this topic.
Topic: ${topic}
${subj}
${exam}

Return ONLY valid JSON. No markdown, no code fences, no commentary.

JSON schema (exact shape):
{
  "title": "short descriptive plan title",
  "days": [
    {
      "day": 1,
      "title": "short focus for this day",
      "duration_minutes": 45,
      "tasks": [
        "specific task 1",
        "specific task 2",
        "specific task 3"
      ]
    }
  ]
}

Rules:
- Return exactly ${days} day objects, numbered 1 through ${days}.
- Each day must have 2–4 concrete tasks.
- Tasks must be actionable ("read X", "solve 5 problems on Y", "revise Z").
- Vary the focus across days: introduction, core concepts, practice, revision, testing.
- Total daily duration between 30 and 90 minutes.
- Content must be level-appropriate for a secondary-school student.
- Do not include any text outside the JSON object.`;
}

module.exports = { buildStudyPlanPrompt };