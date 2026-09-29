// ============================================================
// tools/spark/seed-questions-jss.js
// ------------------------------------------------------------
// JSS-level Spark questions. Short, tricky-but-fair, ages 11-14.
// Safe to re-run — skips questions already present.
//
// Run:  node backend/src/tools/spark/seed-questions-jss.js
// ============================================================

require('dotenv').config();
const db = require('../../db');
const logger = require('../../core/logger');

const QUESTIONS = [
  /* ---------- NUMERICAL — easy ---------- */
  { category: 'numerical', skill: 'numerical_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'If 3 pencils cost N60, how much does 1 pencil cost?',
    options: [ {label:'A',text:'N15'}, {label:'B',text:'N20'}, {label:'C',text:'N25'}, {label:'D',text:'N30'} ],
    correct_answer: 'B', explanation: '60 divided by 3 equals 20.',
    target_streams: ['science','commerce'] },

  { category: 'numerical', skill: 'numerical_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'What is half of 46?',
    options: [ {label:'A',text:'21'}, {label:'B',text:'22'}, {label:'C',text:'23'}, {label:'D',text:'24'} ],
    correct_answer: 'C', explanation: '46 divided by 2 is 23.',
    target_streams: ['science','commerce'] },

  { category: 'numerical', skill: 'numerical_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'A trader has 20 oranges and sells 7. How many are left?',
    options: [ {label:'A',text:'11'}, {label:'B',text:'12'}, {label:'C',text:'13'}, {label:'D',text:'14'} ],
    correct_answer: 'C', explanation: '20 - 7 = 13.',
    target_streams: ['commerce'] },

  /* ---------- NUMERICAL — medium ---------- */
  { category: 'numerical', skill: 'numerical_reasoning', difficulty: 'medium', answer_type: 'mcq',
    question_text: 'A bag of rice costs N900. What is 10% of that price?',
    options: [ {label:'A',text:'N9'}, {label:'B',text:'N90'}, {label:'C',text:'N99'}, {label:'D',text:'N900'} ],
    correct_answer: 'B', explanation: '10% of 900 is 90.',
    target_streams: ['commerce'] },

  { category: 'numerical', skill: 'numerical_reasoning', difficulty: 'medium', answer_type: 'mcq',
    question_text: 'What is the average of 4, 8, 10, and 14?',
    options: [ {label:'A',text:'8'}, {label:'B',text:'9'}, {label:'C',text:'10'}, {label:'D',text:'11'} ],
    correct_answer: 'B', explanation: '4+8+10+14 = 36. 36 / 4 = 9.',
    target_streams: ['science'] },

  /* ---------- SCIENTIFIC — easy ---------- */
  { category: 'scientific', skill: 'scientific_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'Which of these is NOT a source of water?',
    options: [ {label:'A',text:'Rain'}, {label:'B',text:'River'}, {label:'C',text:'Sun'}, {label:'D',text:'Well'} ],
    correct_answer: 'C', explanation: 'The sun is a source of light and heat, not water.',
    target_streams: ['science'] },

  { category: 'scientific', skill: 'scientific_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'A plant is kept in a dark room for 3 days. What is most likely to happen?',
    options: [ {label:'A',text:'It grows taller'}, {label:'B',text:'Its leaves turn yellow'}, {label:'C',text:'It produces more flowers'}, {label:'D',text:'Nothing changes'} ],
    correct_answer: 'B', explanation: 'Without light, the plant cannot make food and its leaves turn yellow.',
    target_streams: ['science'] },

  { category: 'scientific', skill: 'scientific_reasoning', difficulty: 'medium', answer_type: 'mcq',
    question_text: 'When water is heated and turns to steam, this is called…',
    options: [ {label:'A',text:'Freezing'}, {label:'B',text:'Melting'}, {label:'C',text:'Evaporation'}, {label:'D',text:'Condensation'} ],
    correct_answer: 'C', explanation: 'Liquid water changing to gas is evaporation.',
    target_streams: ['science'] },

  { category: 'scientific', skill: 'scientific_reasoning', difficulty: 'medium', answer_type: 'mcq',
    question_text: 'Which of these animals is a mammal?',
    options: [ {label:'A',text:'Lizard'}, {label:'B',text:'Goat'}, {label:'C',text:'Frog'}, {label:'D',text:'Fish'} ],
    correct_answer: 'B', explanation: 'A goat is a mammal — it has fur and feeds its young with milk.',
    target_streams: ['science'] },

  /* ---------- VERBAL — easy ---------- */
  { category: 'verbal', skill: 'verbal_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'Which word is the OPPOSITE of "hot"?',
    options: [ {label:'A',text:'Warm'}, {label:'B',text:'Cold'}, {label:'C',text:'Dry'}, {label:'D',text:'Wet'} ],
    correct_answer: 'B', explanation: 'Cold is the direct opposite of hot.',
    target_streams: ['arts'] },

  { category: 'verbal', skill: 'verbal_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'Which word does NOT belong: mango, orange, banana, carrot?',
    options: [ {label:'A',text:'Mango'}, {label:'B',text:'Orange'}, {label:'C',text:'Banana'}, {label:'D',text:'Carrot'} ],
    correct_answer: 'D', explanation: 'Carrot is a vegetable. The rest are fruits.',
    target_streams: ['arts','science'] },

  { category: 'verbal', skill: 'verbal_reasoning', difficulty: 'medium', answer_type: 'mcq',
    question_text: 'If "begin" means the same as "start", then "end" means the same as…',
    options: [ {label:'A',text:'Open'}, {label:'B',text:'Finish'}, {label:'C',text:'Continue'}, {label:'D',text:'Return'} ],
    correct_answer: 'B', explanation: 'Finish is a synonym of end.',
    target_streams: ['arts'] },

  /* ---------- ANALYTICAL — easy ---------- */
  { category: 'analytical', skill: 'analytical_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'All goats eat grass. Binta has a goat. What must be true?',
    options: [ {label:'A',text:'Binta\'s goat eats grass'}, {label:'B',text:'All grass-eaters are goats'}, {label:'C',text:'Binta has many animals'}, {label:'D',text:'The goat is white'} ],
    correct_answer: 'A', explanation: 'If all goats eat grass and this is a goat, it eats grass.',
    target_streams: ['science','arts'] },

  { category: 'analytical', skill: 'analytical_reasoning', difficulty: 'medium', answer_type: 'mcq',
    question_text: 'Kemi is taller than Ada. Ada is taller than Bola. Who is the shortest?',
    options: [ {label:'A',text:'Kemi'}, {label:'B',text:'Ada'}, {label:'C',text:'Bola'}, {label:'D',text:'Cannot tell'} ],
    correct_answer: 'C', explanation: 'Kemi > Ada > Bola. Bola is shortest.',
    target_streams: ['science','arts'] },

  /* ---------- PATTERN — easy ---------- */
  { category: 'pattern', skill: 'pattern_recognition', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'What comes next: 2, 4, 6, 8, ___?',
    options: [ {label:'A',text:'9'}, {label:'B',text:'10'}, {label:'C',text:'11'}, {label:'D',text:'12'} ],
    correct_answer: 'B', explanation: 'The numbers increase by 2 each time.',
    target_streams: ['science','commerce'] },

  { category: 'pattern', skill: 'pattern_recognition', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'What comes next: 5, 10, 15, 20, ___?',
    options: [ {label:'A',text:'21'}, {label:'B',text:'23'}, {label:'C',text:'25'}, {label:'D',text:'30'} ],
    correct_answer: 'C', explanation: 'The numbers count by 5.',
    target_streams: ['science','commerce'] },

  { category: 'pattern', skill: 'pattern_recognition', difficulty: 'medium', answer_type: 'mcq',
    question_text: 'What comes next: 1, 4, 9, 16, ___?',
    options: [ {label:'A',text:'20'}, {label:'B',text:'25'}, {label:'C',text:'24'}, {label:'D',text:'30'} ],
    correct_answer: 'B', explanation: 'These are perfect squares: 1×1, 2×2, 3×3, 4×4, then 5×5 = 25.',
    target_streams: ['science'] },

  /* ---------- PRACTICAL — easy ---------- */
  { category: 'practical', skill: 'practical_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'A bulb does not light when you flip the switch. What should you check FIRST?',
    options: [ {label:'A',text:'Buy a new house'}, {label:'B',text:'If the bulb is properly fixed'}, {label:'C',text:'Call the electric company'}, {label:'D',text:'Replace all the wires'} ],
    correct_answer: 'B', explanation: 'Check the simple things before assuming big problems.',
    target_streams: ['science'] },

  /* ---------- COMMERCIAL — easy ---------- */
  { category: 'commercial', skill: 'commercial_reasoning', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'You buy a pen for N20 and sell it for N25. What is your profit?',
    options: [ {label:'A',text:'N3'}, {label:'B',text:'N5'}, {label:'C',text:'N20'}, {label:'D',text:'N25'} ],
    correct_answer: 'B', explanation: '25 - 20 = 5 naira profit.',
    target_streams: ['commerce'] },

  { category: 'commercial', skill: 'commercial_reasoning', difficulty: 'medium', answer_type: 'mcq',
    question_text: 'A shopkeeper buys 10 bags of sachet water at N5 each and sells them at N8 each. What is his total profit?',
    options: [ {label:'A',text:'N3'}, {label:'B',text:'N30'}, {label:'C',text:'N50'}, {label:'D',text:'N80'} ],
    correct_answer: 'B', explanation: 'Profit per bag is N3. 3 × 10 = N30.',
    target_streams: ['commerce'] },

  /* ---------- INTEREST — easy ---------- */
  { category: 'interest', skill: 'interest_alignment', difficulty: 'easy', answer_type: 'mcq',
    question_text: 'Which of these would you most enjoy doing?',
    options: [
      {label:'A',text:'Solving a number puzzle'},
      {label:'B',text:'Writing a story'},
      {label:'C',text:'Doing a science experiment'},
      {label:'D',text:'Organising a small business idea'}
    ],
    correct_answer: 'A',
    explanation: 'There is no wrong answer — each choice points to different strengths.',
    target_streams: ['science','arts','commerce'] },

  { category: 'interest', skill: 'interest_alignment', difficulty: 'easy', answer_type: 'open',
    question_text: 'What is one school subject you enjoy most, and why?',
    explanation: 'No wrong answer. We look at the reasoning.',
    target_streams: ['science','arts','commerce'] },
];

(async () => {
  let inserted = 0, skipped = 0;
  for (const q of QUESTIONS) {
    try {
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
      logger.error('[spark jss seed] failed on: ' + q.question_text.slice(0, 50) + ' — ' + err.message);
    }
  }
  logger.info('[spark jss seed] complete — ' + inserted + ' inserted, ' + skipped + ' skipped');
  await db.pool.end();
})().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
