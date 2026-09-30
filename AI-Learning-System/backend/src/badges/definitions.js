// ============================================================
// badges/definitions.js
// ------------------------------------------------------------
// The complete catalog of every badge the platform can award.
//
// Fields:
//   name     — display name
//   desc     — one-line description shown to the student
//   icon     — Font Awesome class
//   color    — one of: navy | gold | red | green
//   category — used for grouping on the badges page
//   secret   — if true, hidden from the catalog until earned
// ============================================================

const BADGES = {
  /* ---------- Getting started ---------- */
  first_chat:       { name: 'First Words',       desc: 'Send your first message to the AI',        icon: 'fa-comment-dots',    color: 'navy',  category: 'start' },
  first_quiz:       { name: 'First Quiz',        desc: 'Complete your first quiz',                 icon: 'fa-circle-question', color: 'gold',  category: 'start' },
  first_flashcard:  { name: 'Card Sharp',        desc: 'Review your first flashcard',              icon: 'fa-clone',           color: 'red',   category: 'start' },
  first_theory:     { name: 'Theory Starter',    desc: 'Complete your first theory set',           icon: 'fa-spell-check',     color: 'green', category: 'start' },
  first_exam:       { name: 'Exam Survivor',     desc: 'Complete your first exam',                 icon: 'fa-stopwatch',       color: 'red',   category: 'start' },
  first_note:       { name: 'Note Taker',        desc: 'Save your first note',                     icon: 'fa-note-sticky',     color: 'navy',  category: 'start' },
  first_sketch:     { name: 'Sketcher',          desc: 'Save your first formula',                  icon: 'fa-pen-ruler',       color: 'gold',  category: 'start' },

  /* ---------- Streaks ---------- */
  streak_3:         { name: 'Three in a Row',    desc: 'Study 3 days in a row',                    icon: 'fa-fire',            color: 'gold',  category: 'streak' },
  streak_7:         { name: 'Week Warrior',      desc: 'Study 7 days in a row',                    icon: 'fa-fire',            color: 'red',   category: 'streak' },
  streak_14:        { name: 'Two Weeks Strong',  desc: 'Study 14 days in a row',                   icon: 'fa-fire-flame-curved', color: 'red', category: 'streak' },
  streak_30:        { name: 'Monthly Master',    desc: 'Study 30 days in a row',                   icon: 'fa-fire-flame-simple', color: 'red', category: 'streak' },

  /* ---------- Quizzes ---------- */
  quiz_5:           { name: 'Five Under Belt',   desc: 'Complete 5 quizzes',                       icon: 'fa-circle-check',    color: 'gold',  category: 'quiz' },
  quiz_10:          { name: 'Quiz Enthusiast',   desc: 'Complete 10 quizzes',                      icon: 'fa-trophy',          color: 'gold',  category: 'quiz' },
  quiz_25:          { name: 'Quiz Veteran',      desc: 'Complete 25 quizzes',                      icon: 'fa-trophy',          color: 'red',   category: 'quiz' },
  quiz_50:          { name: 'Quiz Champion',     desc: 'Complete 50 quizzes',                      icon: 'fa-trophy',          color: 'red',   category: 'quiz' },
  quiz_100:         { name: 'Century Scholar',   desc: 'Complete 100 quizzes',                     icon: 'fa-crown',           color: 'gold',  category: 'quiz', secret: true },
  perfect_quiz:     { name: 'Perfect Score',     desc: 'Score 100% on a quiz',                     icon: 'fa-star',            color: 'gold',  category: 'quiz' },
  perfect_3:        { name: 'Three Perfects',    desc: 'Score 100% on 3 different quizzes',        icon: 'fa-stars',           color: 'gold',  category: 'quiz' },
  quiz_ace:         { name: 'Quiz Ace',          desc: 'Average 90%+ over 10 quizzes',             icon: 'fa-medal',           color: 'gold',  category: 'quiz', secret: true },

  /* ---------- Flashcards ---------- */
  flashcard_10:     { name: 'Card Starter',      desc: 'Review 10 flashcards',                     icon: 'fa-clone',           color: 'navy',  category: 'flashcard' },
  flashcard_100:    { name: 'Card Collector',    desc: 'Review 100 flashcards',                    icon: 'fa-layer-group',     color: 'navy',  category: 'flashcard' },
  flashcard_500:    { name: 'Card Master',       desc: 'Review 500 flashcards',                    icon: 'fa-layer-group',     color: 'gold',  category: 'flashcard' },

  /* ---------- Question volume ---------- */
  knowledge_seeker: { name: 'Knowledge Seeker',  desc: 'Ask 100 questions',                        icon: 'fa-graduation-cap',  color: 'navy',  category: 'volume' },
  question_master:  { name: 'Curious Mind',      desc: 'Ask 500 questions',                        icon: 'fa-brain',           color: 'gold',  category: 'volume', secret: true },

  /* ---------- Time invested ---------- */
  hour_1:           { name: 'First Hour',        desc: 'Spend 1 hour studying',                    icon: 'fa-hourglass-start', color: 'navy',  category: 'time' },
  hour_10:          { name: 'Ten Hours In',      desc: 'Spend 10 hours studying',                  icon: 'fa-hourglass-half',  color: 'gold',  category: 'time' },
  hour_50:          { name: 'Dedicated Learner', desc: 'Spend 50 hours studying',                  icon: 'fa-hourglass-end',   color: 'red',   category: 'time', secret: true },

  /* ---------- Time of day ---------- */
  early_bird:       { name: 'Early Bird',        desc: 'Study before 7am',                         icon: 'fa-sun',             color: 'gold',  category: 'time' },
  night_owl:        { name: 'Night Owl',         desc: 'Study after 10pm',                         icon: 'fa-moon',            color: 'navy',  category: 'time' },

  /* ---------- Exploration ---------- */
  explorer:         { name: 'Explorer',          desc: 'Try every study tool at least once',       icon: 'fa-compass',         color: 'gold',  category: 'explore', secret: true },
  multi_subject:    { name: 'Well-Rounded',      desc: 'Study 5 different subjects',               icon: 'fa-shapes',          color: 'navy',  category: 'explore' },

  /* ---------- Subject-specific ---------- */
  bio_master:       { name: 'Biology Master',    desc: 'Complete 10 Biology quizzes',              icon: 'fa-dna',             color: 'green', category: 'subject' },
  math_whiz:        { name: 'Math Whiz',         desc: 'Complete 10 Mathematics quizzes',          icon: 'fa-calculator',      color: 'navy',  category: 'subject' },
  chem_whiz:        { name: 'Chemistry Whiz',    desc: 'Complete 10 Chemistry quizzes',            icon: 'fa-flask',           color: 'green', category: 'subject' },

  /* ---------- Identity ---------- */
  verified:         { name: 'Verified',          desc: 'Verified member of the platform',          icon: 'fa-circle-check',    color: 'gold',  category: 'identity' },
};

/* Helper: get all badges in a category */
function byCategory(cat) {
  return Object.keys(BADGES)
    .filter(k => BADGES[k].category === cat)
    .map(k => Object.assign({ key: k }, BADGES[k]));
}

module.exports = { BADGES, byCategory };
