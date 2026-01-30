#!/usr/bin/env node
/**
 * Validates all quiz JSON files against the exams.json schema.
 * Usage: node scripts/validate-quizzes.js [--fix-ids]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUIZZES_DIR = path.join(ROOT, 'data', 'quizzes');
const EXAMS_FILE = path.join(ROOT, 'data', 'exams.json');
const TARGET_COUNT = 300;

const exams = JSON.parse(fs.readFileSync(EXAMS_FILE, 'utf8'));
const examMap = {};
exams.forEach(e => { examMap[e.id] = e; });

let totalErrors = 0;
let totalWarnings = 0;

const files = fs.readdirSync(QUIZZES_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const examId = file.replace('.json', '');
  const filePath = path.join(QUIZZES_DIR, file);
  const errors = [];
  const warnings = [];

  let questions;
  try {
    questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    errors.push(`Invalid JSON: ${e.message}`);
    printResults(file, errors, warnings);
    continue;
  }

  // 1. Must be an array
  if (!Array.isArray(questions)) {
    errors.push('Root element is not an array');
    printResults(file, errors, warnings);
    continue;
  }

  // 2. Count
  if (questions.length !== TARGET_COUNT) {
    if (questions.length < TARGET_COUNT) {
      errors.push(`Has ${questions.length} questions, need ${TARGET_COUNT}`);
    } else {
      errors.push(`Has ${questions.length} questions, expected ${TARGET_COUNT}`);
    }
  }

  // 3. Check each question
  const ids = new Set();
  const questionTexts = new Set();
  const topicCounts = {};

  questions.forEach((q, idx) => {
    const prefix = `q[${idx}]`;

    // Required fields
    for (const field of ['id', 'topic', 'topicName', 'question', 'choices', 'correct', 'explanation']) {
      if (q[field] === undefined || q[field] === null) {
        errors.push(`${prefix}: missing field "${field}"`);
      }
    }

    // ID format and uniqueness
    if (q.id) {
      if (ids.has(q.id)) {
        errors.push(`${prefix}: duplicate id "${q.id}"`);
      }
      ids.add(q.id);
    }

    // Choices validation
    if (Array.isArray(q.choices)) {
      if (q.choices.length !== 4) {
        errors.push(`${prefix}: has ${q.choices.length} choices, expected 4`);
      }
      const expectedPrefixes = ['A. ', 'B. ', 'C. ', 'D. '];
      q.choices.forEach((c, ci) => {
        if (ci < 4 && typeof c === 'string' && !c.startsWith(expectedPrefixes[ci])) {
          warnings.push(`${prefix}: choice ${ci} doesn't start with "${expectedPrefixes[ci]}"`);
        }
      });
    }

    // Correct answer validation
    if (typeof q.correct === 'number') {
      if (q.correct < 0 || q.correct > 3 || !Number.isInteger(q.correct)) {
        errors.push(`${prefix}: "correct" must be integer 0-3, got ${q.correct}`);
      }
    } else if (q.correct !== undefined) {
      errors.push(`${prefix}: "correct" must be a number, got ${typeof q.correct}`);
    }

    // Explanation length
    if (typeof q.explanation === 'string' && q.explanation.length < 50) {
      warnings.push(`${prefix}: explanation is very short (${q.explanation.length} chars)`);
    }

    // Question length
    if (typeof q.question === 'string' && q.question.length < 20) {
      warnings.push(`${prefix}: question is very short (${q.question.length} chars)`);
    }

    // Duplicate question text
    if (q.question) {
      const normalized = q.question.toLowerCase().trim();
      if (questionTexts.has(normalized)) {
        errors.push(`${prefix}: duplicate question text`);
      }
      questionTexts.add(normalized);
    }

    // Topic tracking
    if (q.topic) {
      topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
    }
  });

  // 4. Topic distribution check against exams.json
  const examMeta = examMap[examId];
  if (examMeta && examMeta.topics) {
    const definedTopics = examMeta.topics.map(t => t.id);

    // Check all defined topics have questions
    for (const t of examMeta.topics) {
      if (!topicCounts[t.id]) {
        warnings.push(`Topic "${t.id}" (${t.name}) has 0 questions`);
      } else {
        const expected = Math.round(TARGET_COUNT * t.weight / 100);
        const actual = topicCounts[t.id];
        const diff = Math.abs(actual - expected);
        if (diff > 5) {
          warnings.push(`Topic "${t.id}": has ${actual} questions, expected ~${expected} (weight ${t.weight}%, diff ${diff})`);
        }
      }
    }

    // Check for unknown topics
    for (const tid of Object.keys(topicCounts)) {
      if (!definedTopics.includes(tid)) {
        warnings.push(`Unknown topic "${tid}" not defined in exams.json`);
      }
    }
  } else {
    warnings.push(`No exam metadata found in exams.json for "${examId}"`);
  }

  printResults(file, errors, warnings);
  totalErrors += errors.length;
  totalWarnings += warnings.length;
}

console.log('\n' + '='.repeat(60));
console.log(`Total: ${files.length} files, ${totalErrors} errors, ${totalWarnings} warnings`);
if (totalErrors > 0) {
  process.exit(1);
}

function printResults(file, errors, warnings) {
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`✓ ${file}`);
    return;
  }
  console.log(`\n--- ${file} ---`);
  errors.forEach(e => console.log(`  ERROR: ${e}`));
  warnings.forEach(w => console.log(`  WARN:  ${w}`));
}
