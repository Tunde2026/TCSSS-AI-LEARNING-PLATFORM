// ============================================================
// tools/spark/seed-questions.js
// ------------------------------------------------------------
// Seeds the Spark question bank with a starter set.
// Safe to re-run: skips questions already present.
//
// Run:  node backend/src/tools/spark/seed-questions.js
// ============================================================

require('dotenv').config();
const db = require('../../db');
const logger = require('../../core/logger');

const QUESTIONS = [
  /* ============================================================
     NUMERICAL REASONING
     ============================================================ */
  {
    category: 'numerical',
    skill: 'numerical_reasoning',
    difficulty: 'easy',
    answer_type: 'mcq',
    question_text: 'A shirt costs N2500 and is discounted by 20%. What is the new price?',
    options: [
      { label: 'A', text: 'N2000' },
      { label: 'B', text: 'N2200' },
      { label: 'C', text: 'N2300' },
      { label: 'D', text: 'N1800' },
    ],
    correct_answer: 'A',
    explanation: '20% of N2500 is N500. 2500 - 500 = 2000.',
    target_streams: ['science', 'commerce'],
  },
  {
    category: 'numerical',
    skill: 'numerical_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'A trader buys 15 pens at N40 each and sells all of them for N750. What is the profit percentage?',
    options: [
      { label: 'A', text: '20%' },
      { label: 'B', text: '25%' },
      { label: 'C', text: '30%' },
      { label: 'D', text: '35%' },
    ],
    correct_answer: 'B',
    explanation: 'Cost = 15 x 40 = 600. Profit = 750 - 600 = 150. Profit % = 150/600 x 100 = 25%.',
    target_streams: ['commerce'],
  },
  {
    category: 'numerical',
    skill: 'numerical_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'If 3 workers build a wall in 12 days, how many days would 4 workers take (same rate)?',
    options: [
      { label: 'A', text: '8 days' },
      { label: 'B', text: '9 days' },
      { label: 'C', text: '10 days' },
      { label: 'D', text: '16 days' },
    ],
    correct_answer: 'B',
    explanation: 'Work = 3 x 12 = 36 worker-days. 4 workers -> 36/4 = 9 days.',
    target_streams: ['science', 'commerce'],
  },
  {
    category: 'numerical',
    skill: 'numerical_reasoning',
    difficulty: 'hard',
    answer_type: 'mcq',
    question_text: 'A sum of money doubles in 8 years at simple interest. What is the annual interest rate?',
    options: [
      { label: 'A', text: '8%' },
      { label: 'B', text: '10%' },
      { label: 'C', text: '12.5%' },
      { label: 'D', text: '15%' },
    ],
    correct_answer: 'C',
    explanation: 'P doubles -> interest equals P over 8 years. Rate = 100/8 = 12.5%.',
    target_streams: ['science', 'commerce'],
  },

  /* ============================================================
     SCIENTIFIC REASONING
     ============================================================ */
  {
    category: 'scientific',
    skill: 'scientific_reasoning',
    difficulty: 'easy',
    answer_type: 'mcq',
    question_text: 'A plant is placed in a dark cupboard for a week. What is most likely to happen?',
    options: [
      { label: 'A', text: 'It grows faster' },
      { label: 'B', text: 'It turns yellow and weakens' },
      { label: 'C', text: 'It becomes greener' },
      { label: 'D', text: 'Nothing changes' },
    ],
    correct_answer: 'B',
    explanation: 'Without light, photosynthesis stops, so the plant loses chlorophyll and weakens.',
    target_streams: ['science'],
  },
  {
    category: 'scientific',
    skill: 'scientific_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'Two identical ice cubes are placed on metal and on wood in a warm room. Which melts faster and why?',
    options: [
      { label: 'A', text: 'On wood — wood is warm' },
      { label: 'B', text: 'On metal — metal conducts heat better' },
      { label: 'C', text: 'Both melt at the same time' },
      { label: 'D', text: 'Neither melts' },
    ],
    correct_answer: 'B',
    explanation: 'Metals are good conductors of heat, so they transfer room heat to the ice faster.',
    target_streams: ['science'],
  },
  {
    category: 'scientific',
    skill: 'scientific_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'A student adds salt to water and the water becomes cooler. What is the best explanation?',
    options: [
      { label: 'A', text: 'The salt destroys heat' },
      { label: 'B', text: 'Dissolving absorbs energy from the water' },
      { label: 'C', text: 'The water evaporates' },
      { label: 'D', text: 'The salt is cold' },
    ],
    correct_answer: 'B',
    explanation: 'Dissolving is endothermic for some salts — it takes energy from the surroundings, cooling them.',
    target_streams: ['science'],
  },
  {
    category: 'scientific',
    skill: 'scientific_reasoning',
    difficulty: 'hard',
    answer_type: 'mcq',
    question_text: 'A sealed bottle contains air at room temperature. It is placed in a freezer. What happens to the pressure inside?',
    options: [
      { label: 'A', text: 'It increases' },
      { label: 'B', text: 'It decreases' },
      { label: 'C', text: 'It stays the same' },
      { label: 'D', text: 'It becomes zero' },
    ],
    correct_answer: 'B',
    explanation: 'At constant volume, cooling a gas lowers pressure (Gay-Lussac\'s law).',
    target_streams: ['science'],
  },

  /* ============================================================
     VERBAL REASONING
     ============================================================ */
  {
    category: 'verbal',
    skill: 'verbal_reasoning',
    difficulty: 'easy',
    answer_type: 'mcq',
    question_text: '"The market was flooded with tomatoes." What does this sentence most likely mean?',
    options: [
      { label: 'A', text: 'The market was physically covered with water' },
      { label: 'B', text: 'There were a lot of tomatoes available' },
      { label: 'C', text: 'The tomatoes were destroyed' },
      { label: 'D', text: 'The sellers were angry' },
    ],
    correct_answer: 'B',
    explanation: '"Flooded with" is a figure of speech meaning "filled with a large amount".',
    target_streams: ['arts'],
  },
  {
    category: 'verbal',
    skill: 'verbal_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'Which word is OPPOSITE in meaning to "frugal"?',
    options: [
      { label: 'A', text: 'Careful' },
      { label: 'B', text: 'Wasteful' },
      { label: 'C', text: 'Kind' },
      { label: 'D', text: 'Quiet' },
    ],
    correct_answer: 'B',
    explanation: 'Frugal means careful with money. The opposite is wasteful.',
    target_streams: ['arts'],
  },
  {
    category: 'verbal',
    skill: 'verbal_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: '"Ada studied hard; consequently, she passed." What is the relationship between the two clauses?',
    options: [
      { label: 'A', text: 'Contrast' },
      { label: 'B', text: 'Cause and effect' },
      { label: 'C', text: 'Comparison' },
      { label: 'D', text: 'Addition' },
    ],
    correct_answer: 'B',
    explanation: '"Consequently" signals that the second clause is a result of the first.',
    target_streams: ['arts'],
  },

  /* ============================================================
     ANALYTICAL REASONING
     ============================================================ */
  {
    category: 'analytical',
    skill: 'analytical_reasoning',
    difficulty: 'easy',
    answer_type: 'mcq',
    question_text: 'All fish swim. Tilapia is a fish. Which conclusion follows?',
    options: [
      { label: 'A', text: 'Tilapia swims' },
      { label: 'B', text: 'Tilapia lives in the sea' },
      { label: 'C', text: 'Tilapia is a bird' },
      { label: 'D', text: 'All swimmers are fish' },
    ],
    correct_answer: 'A',
    explanation: 'If all fish swim and tilapia is a fish, then tilapia swims.',
    target_streams: ['science', 'arts', 'commerce'],
  },
  {
    category: 'analytical',
    skill: 'analytical_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'If some doctors are women and all women are human, which MUST be true?',
    options: [
      { label: 'A', text: 'All doctors are women' },
      { label: 'B', text: 'Some doctors are human' },
      { label: 'C', text: 'All humans are women' },
      { label: 'D', text: 'Some humans are not doctors' },
    ],
    correct_answer: 'B',
    explanation: 'The overlap between doctors and women means some doctors are humans.',
    target_streams: ['science', 'arts', 'commerce'],
  },
  {
    category: 'analytical',
    skill: 'analytical_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'A trader said: "Every time it rains, sales drop." Yesterday sales dropped. Can we conclude it rained?',
    options: [
      { label: 'A', text: 'Yes, definitely' },
      { label: 'B', text: 'No, sales could have dropped for another reason' },
      { label: 'C', text: 'Yes, if the trader is honest' },
      { label: 'D', text: 'Only on weekends' },
    ],
    correct_answer: 'B',
    explanation: 'Rain implies a drop in sales — but a drop does not necessarily imply rain (other causes possible).',
    target_streams: ['science', 'commerce'],
  },

  /* ============================================================
     PATTERN RECOGNITION
     ============================================================ */
  {
    category: 'pattern',
    skill: 'pattern_recognition',
    difficulty: 'easy',
    answer_type: 'mcq',
    question_text: 'What comes next: 2, 4, 8, 16, ___?',
    options: [
      { label: 'A', text: '20' },
      { label: 'B', text: '24' },
      { label: 'C', text: '32' },
      { label: 'D', text: '18' },
    ],
    correct_answer: 'C',
    explanation: 'Each term doubles the previous: 2, 4, 8, 16, 32.',
    target_streams: ['science', 'commerce'],
  },
  {
    category: 'pattern',
    skill: 'pattern_recognition',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'What comes next: 1, 4, 9, 16, 25, ___?',
    options: [
      { label: 'A', text: '30' },
      { label: 'B', text: '36' },
      { label: 'C', text: '40' },
      { label: 'D', text: '49' },
    ],
    correct_answer: 'B',
    explanation: 'These are perfect squares: 1²=1, 2²=4, 3²=9, 4²=16, 5²=25, 6²=36.',
    target_streams: ['science'],
  },
  {
    category: 'pattern',
    skill: 'pattern_recognition',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'A trader counts stock daily: 20, 17, 14, 11, ___. What comes next?',
    options: [
      { label: 'A', text: '9' },
      { label: 'B', text: '8' },
      { label: 'C', text: '7' },
      { label: 'D', text: '10' },
    ],
    correct_answer: 'B',
    explanation: 'Each day decreases by 3: 20, 17, 14, 11, 8.',
    target_streams: ['commerce'],
  },

  /* ============================================================
     CREATIVE REASONING
     ============================================================ */
  {
    category: 'creative',
    skill: 'creative_reasoning',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'A school has no electricity for a week. Suggest two different ways students could still study in the evening.',
    explanation: 'Looking for two distinct, practical ideas (e.g. solar lamps, study groups with shared resources).',
    target_streams: ['science', 'arts'],
  },
  {
    category: 'creative',
    skill: 'creative_reasoning',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'Imagine you could invent one thing to help farmers in your area. What would it be and why?',
    explanation: 'Looking for originality, practicality, and clear reasoning.',
    target_streams: ['science', 'commerce'],
  },
  {
    category: 'creative',
    skill: 'creative_reasoning',
    difficulty: 'hard',
    answer_type: 'open',
    question_text: 'Give one good reason FOR and one good reason AGAINST using AI to do school homework. Take both sides seriously.',
    explanation: 'Looking for balanced reasoning and understanding of trade-offs.',
    target_streams: ['arts', 'science', 'commerce'],
  },

  /* ============================================================
     COMMERCIAL REASONING
     ============================================================ */
  {
    category: 'commercial',
    skill: 'commercial_reasoning',
    difficulty: 'easy',
    answer_type: 'mcq',
    question_text: 'A shop sells a product for less than it costs to buy. What is the result?',
    options: [
      { label: 'A', text: 'Profit' },
      { label: 'B', text: 'Loss' },
      { label: 'C', text: 'No change' },
      { label: 'D', text: 'More sales guaranteed' },
    ],
    correct_answer: 'B',
    explanation: 'Selling below cost always produces a loss per unit (unless offset elsewhere, which is not stated).',
    target_streams: ['commerce'],
  },
  {
    category: 'commercial',
    skill: 'commercial_reasoning',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'A shop can sell 100 pens per day at N20 each, or 80 pens at N25 each. Which choice earns more revenue?',
    options: [
      { label: 'A', text: '100 pens at N20' },
      { label: 'B', text: '80 pens at N25' },
      { label: 'C', text: 'Both earn the same' },
      { label: 'D', text: 'Cannot be determined' },
    ],
    correct_answer: 'C',
    explanation: 'Both earn N2000. Understanding this shows flexible commercial reasoning.',
    target_streams: ['commerce'],
  },
  {
    category: 'commercial',
    skill: 'commercial_reasoning',
    difficulty: 'hard',
    answer_type: 'open',
    question_text: 'You have N10,000 to start a small business. Describe the business you would start and how you would use the money.',
    explanation: 'Looking for cost awareness, pricing logic, and a realistic plan.',
    target_streams: ['commerce'],
  },

  /* ============================================================
     PROBLEM SOLVING
     ============================================================ */
  {
    category: 'problem_solving',
    skill: 'problem_solving',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'Your friend always arrives late for group study. Suggest one approach that could help without hurting the friendship.',
    explanation: 'Looking for constructive, non-punitive problem solving.',
    target_streams: ['arts', 'commerce'],
  },
  {
    category: 'problem_solving',
    skill: 'problem_solving',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'You need to cross a river with a canoe that only fits you and one item. You have a bag of maize, a chicken, and a bag of rice. The chicken eats the maize; nothing eats the rice. How do you get everything across?',
    explanation: 'A classic logic puzzle. Answer: take chicken first, return alone, take maize, bring chicken back, take rice, return alone, take chicken.',
    target_streams: ['science', 'arts'],
  },

  /* ============================================================
     COMMUNICATION
     ============================================================ */
  {
    category: 'communication',
    skill: 'communication',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'Explain "evaporation" to a younger student in one or two short sentences without using the word "evaporate".',
    explanation: 'Looking for clarity, simplicity, and analogies appropriate to a younger listener.',
    target_streams: ['arts', 'science'],
  },
  {
    category: 'communication',
    skill: 'communication',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'A friend is upset because they failed a test. Write one short sentence that is supportive without pretending the failure does not matter.',
    explanation: 'Looking for empathy and honesty together, not empty reassurance.',
    target_streams: ['arts'],
  },

  /* ============================================================
     DECISION MAKING
     ============================================================ */
  {
    category: 'decision',
    skill: 'decision_making',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'You have N5,000. You can either buy a textbook you need or pay for extra lessons. How would you decide?',
    explanation: 'Looking for trade-off reasoning based on the student\'s situation.',
    target_streams: ['arts', 'commerce'],
  },
  {
    category: 'decision',
    skill: 'decision_making',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'A friend asks you to lie to a teacher on their behalf. What do you do, and why?',
    explanation: 'Looking for ethical reasoning, honesty, and consideration of consequences.',
    target_streams: ['arts'],
  },

  /* ============================================================
     PRACTICAL REASONING
     ============================================================ */
  {
    category: 'practical',
    skill: 'practical_reasoning',
    difficulty: 'easy',
    answer_type: 'mcq',
    question_text: 'A bulb in a room does not turn on when you flip the switch. What is a reasonable first step?',
    options: [
      { label: 'A', text: 'Buy a new house' },
      { label: 'B', text: 'Check whether the bulb is properly screwed in' },
      { label: 'C', text: 'Call the electricity company immediately' },
      { label: 'D', text: 'Replace all the wires' },
    ],
    correct_answer: 'B',
    explanation: 'Start with the simplest, safest check before assuming bigger problems.',
    target_streams: ['science'],
  },
  {
    category: 'practical',
    skill: 'practical_reasoning',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'You notice water dripping from a pipe under the sink. What do you do first, and why?',
    explanation: 'Looking for sensible ordering: turn off supply, contain spill, then fix or report.',
    target_streams: ['science'],
  },

  /* ============================================================
     INTEREST ALIGNMENT (RIASEC-inspired)
     ============================================================ */
  {
    category: 'interest',
    skill: 'interest_alignment',
    difficulty: 'easy',
    answer_type: 'ranking',
    question_text: 'Rank these school activities from MOST to LEAST enjoyable for you.',
    options: [
      { label: 'A', text: 'Solving maths problems' },
      { label: 'B', text: 'Writing stories or essays' },
      { label: 'C', text: 'Doing science experiments' },
      { label: 'D', text: 'Debating or presenting ideas' },
    ],
    correct_answer: ['A', 'C', 'B', 'D'],
    explanation: 'This question explores preference across science, arts, and communication areas.',
    target_streams: ['science', 'arts', 'commerce'],
  },
  {
    category: 'interest',
    skill: 'interest_alignment',
    difficulty: 'easy',
    answer_type: 'open',
    question_text: 'What kind of problem do you enjoy solving most — a number puzzle, a story, a science question, or a business idea? Why?',
    explanation: 'Free-response interest probe. Any answer is valid; we look at the reasoning.',
    target_streams: ['science', 'arts', 'commerce'],
  },
  {
    category: 'interest',
    skill: 'interest_alignment',
    difficulty: 'medium',
    answer_type: 'open',
    question_text: 'If you could spend a whole afternoon learning about ONE topic for free, what would it be?',
    explanation: 'Reveals intrinsic interest. No wrong answer.',
    target_streams: ['science', 'arts', 'commerce'],
  },
  {
    category: 'interest',
    skill: 'interest_alignment',
    difficulty: 'medium',
    answer_type: 'mcq',
    question_text: 'Which of these best describes what you would do if school had a free "help day"?',
    options: [
      { label: 'A', text: 'Teach a younger student something I know' },
      { label: 'B', text: 'Repair or build something useful for the school' },
      { label: 'C', text: 'Design a poster or write an article about it' },
      { label: 'D', text: 'Organise a small fundraising activity' },
    ],
    correct_answer: 'A', // no wrong answer — this is preference only
    explanation: 'All options are valid. Each points toward different strengths.',
    target_streams: ['science', 'arts', 'commerce'],
  },
];

(async () => {
  let inserted = 0, skipped = 0;
  for (const q of QUESTIONS) {
    try {
      // Simple dedupe: same text already exists?
      const exists = await db.pool.query(
        'SELECT id FROM spark_question_bank WHERE question_text = $1 LIMIT 1',
        [q.question_text]
      );
      if (exists.rowCount > 0) { skipped++; continue; }

      await db.spark.createQuestion({
        category: q.category,
        skill: q.skill,
        difficulty: q.difficulty,
        answerType: q.answer_type,
        questionText: q.question_text,
        options: q.options || null,
        correctAnswer: q.correct_answer != null ? q.correct_answer : null,
        explanation: q.explanation || null,
        targetStreams: q.target_streams || [],
      });
      inserted++;
    } catch (err) {
      logger.error('[spark seed] failed on: ' + q.question_text.slice(0, 50) + ' — ' + err.message);
    }
  }
  logger.info('[spark seed] complete — ' + inserted + ' inserted, ' + skipped + ' skipped');
  await db.pool.end();
})().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});