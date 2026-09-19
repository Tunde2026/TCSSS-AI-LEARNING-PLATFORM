function buildVisualizationPrompt({ topic, kind }) {
  var kindHint = '';
  if (kind === 'flowchart') kindHint = 'Use a flowchart (graph TD or graph LR).';
  else if (kind === 'sequence') kindHint = 'Use a sequence diagram.';
  else if (kind === 'mindmap') kindHint = 'Use a mindmap.';
  else if (kind === 'class') kindHint = 'Use a class diagram.';
  else if (kind === 'timeline') kindHint = 'Use a timeline.';
  else kindHint = 'Choose the most appropriate diagram type for the topic.';

  return `You are a diagram generator for secondary-school students.

Produce a single Mermaid.js diagram explaining this topic:
Topic: ${topic}
${kindHint}

Return ONLY valid JSON. No markdown, no code fences, no commentary.

JSON schema:
{
  "title": "short title",
  "kind": "flowchart | sequence | mindmap | class | timeline | state",
  "mermaid": "the mermaid diagram source code as a single string with \\n for line breaks",
  "explanation": "2-3 sentences explaining what the diagram shows"
}

Rules:
- The mermaid field must be valid Mermaid.js syntax that renders without errors.
- Use simple node IDs (A, B, C or word IDs).
- Avoid special characters inside node labels unless quoted.
- Maximum 20 nodes so it stays readable on a phone screen.
- Content must be factually accurate and level-appropriate.
- Do not include any text outside the JSON object.`;
}

module.exports = { buildVisualizationPrompt };