// ============================================================
// badges/definitions.js
// The catalog of every badge the platform can award.
// ============================================================
const BADGES = {
  // Getting started
  first_chat:       { name: 'First Words',       desc: 'Sent your first message to the AI',        icon: 'fa-comment-dots',    color: 'navy' },
  first_quiz:       { name: 'First Quiz',        desc: 'Completed your first quiz',                icon: 'fa-circle-question', color: 'gold' },
  first_flashcard:  { name: 'Card Sharp',        desc: 'Reviewed your first flashcard',            icon: 'fa-clone',           color: 'red' },
  first_theory:     { name: 'Theory Starter',    desc: 'Completed your first theory set',          icon: 'fa-spell-check',     color: 'green' },
  first_exam:       { name: 'Exam Survivor',     desc: 'Completed your first exam',                icon: 'fa-stopwatch',       color: 'red' },
  first_note:       { name: 'Note Taker',        desc: 'Saved your first note',                    icon: 'fa-note-sticky',     color: 'navy' },

  // Streaks
  streak_3:         { name: 'Three in a Row',    desc: 'Studied 3 days in a row',                  icon: 'fa-fire',            color: 'gold' },
  streak_7:         { name: 'Week Warrior',      desc: 'Studied 7 days in a row',                  icon: 'fa-fire',            color: 'red' },
  streak_30:        { name: 'Monthly Master',    desc: 'Studied 30 days in a row',                 icon: 'fa-fire',            color: 'red' },

  // Volume
  quiz_10:          { name: 'Quiz Enthusiast',   desc: 'Completed 10 quizzes',                     icon: 'fa-trophy',          color: 'gold' },
  quiz_50:          { name: 'Quiz Champion',     desc: 'Completed 50 quizzes',                     icon: 'fa-trophy',          color: 'red' },
  flashcard_100:    { name: 'Card Collector',    desc: 'Reviewed 100 flashcards',                  icon: 'fa-layer-group',     color: 'navy' },
  knowledge_seeker: { name: 'Knowledge Seeker',  desc: 'Asked 100 questions',                      icon: 'fa-graduation-cap',  color: 'navy' },

  // Achievements
  perfect_quiz:     { name: 'Perfect Score',     desc: 'Got 100% on a quiz',                       icon: 'fa-star',            color: 'gold' },
  early_bird:       { name: 'Early Bird',        desc: 'Studied before 7am',                       icon: 'fa-sun',             color: 'gold' },
  night_owl:        { name: 'Night Owl',         desc: 'Studied after 10pm',                       icon: 'fa-moon',            color: 'navy' },

  // Identity
  verified:         { name: 'Verified',          desc: 'Verified member of the platform',          icon: 'fa-circle-check',    color: 'gold' },
};

module.exports = { BADGES };
